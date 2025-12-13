# Invite Link System

## Overview

The invite system allows GMs to generate shareable links for players to join campaigns. Links expire after 24 hours, are one-time use, and can be revoked by the GM.

## PRD References

- [Settings](/home/tobiasd/github/vanguard-pbp/prd/settings.md) - Invite link management, expiration, states
- [Technical](/home/tobiasd/github/vanguard-pbp/prd/technical.md) - InviteLink data model, API endpoints

## Skills

- **go-api-server**: Invite generation, validation, rate limiting
- **supabase-integration**: Database queries, unique code generation
- **shadcn-react**: Invite management UI, copyable links

---

## Backend Implementation

### Database Schema

```sql
-- invite_links table
CREATE TABLE invite_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_invite_links_campaign ON invite_links(campaign_id);
CREATE INDEX idx_invite_links_code ON invite_links(code);
CREATE INDEX idx_invite_links_expires_at ON invite_links(expires_at);
```

### sqlc Queries

Add to `/backend/internal/db/queries/campaigns.sql` or create `/backend/internal/db/queries/invites.sql`:

```sql
-- name: CreateInviteLink :one
INSERT INTO invite_links (
    campaign_id,
    code,
    created_by,
    expires_at
) VALUES (
    $1, $2, $3, $4
) RETURNING *;

-- name: GetInviteLinkByCode :one
SELECT
    il.*,
    c.title as campaign_title,
    c.owner_id as campaign_owner_id
FROM invite_links il
INNER JOIN campaigns c ON il.campaign_id = c.id
WHERE il.code = $1;

-- name: ListCampaignInvites :many
SELECT * FROM invite_links
WHERE campaign_id = $1
ORDER BY created_at DESC;

-- name: MarkInviteUsed :one
UPDATE invite_links
SET
    used_at = now(),
    used_by = $2
WHERE id = $1
RETURNING *;

-- name: RevokeInvite :one
UPDATE invite_links
SET revoked_at = now()
WHERE id = $1 AND campaign_id = $2
RETURNING *;

-- name: CountActiveCampaignInvites :one
SELECT COUNT(*) FROM invite_links
WHERE campaign_id = $1
  AND used_at IS NULL
  AND revoked_at IS NULL
  AND expires_at > now();
```

### Service Layer

Create `/backend/internal/service/invite.go`:

```go
package service

import (
    "context"
    "crypto/rand"
    "database/sql"
    "encoding/base64"
    "errors"
    "time"

    "github.com/google/uuid"
    "vanguard-pbp/internal/db/generated"
)

var (
    ErrInviteLimitReached = errors.New("too many active invites (max ~100)")
    ErrInviteExpired      = errors.New("invite link has expired")
    ErrInviteUsed         = errors.New("invite link has already been used")
    ErrInviteRevoked      = errors.New("invite link has been revoked")
    ErrInviteNotFound     = errors.New("invite link not found")
    ErrCampaignFull       = errors.New("campaign has reached player limit (50)")
)

const (
    InviteExpiration = 24 * time.Hour
    MaxActiveInvites = 100
    MaxCampaignMembers = 50
)

type InviteService struct {
    queries *generated.Queries
}

func NewInviteService(queries *generated.Queries) *InviteService {
    return &InviteService{queries: queries}
}

func (s *InviteService) GenerateInvite(ctx context.Context, campaignID, userID uuid.UUID) (*generated.InviteLink, error) {
    // Verify user is GM
    campaign, err := s.queries.GetCampaign(ctx, campaignID)
    if err != nil {
        return nil, err
    }
    if !campaign.OwnerID.Valid || campaign.OwnerID.UUID != userID {
        return nil, ErrNotGM
    }

    // Check active invite count (soft limit)
    count, err := s.queries.CountActiveCampaignInvites(ctx, campaignID)
    if err != nil {
        return nil, err
    }
    if count >= MaxActiveInvites {
        return nil, ErrInviteLimitReached
    }

    // Generate cryptographically random code
    code, err := generateInviteCode()
    if err != nil {
        return nil, err
    }

    // Create invite
    invite, err := s.queries.CreateInviteLink(ctx, generated.CreateInviteLinkParams{
        CampaignID: campaignID,
        Code:       code,
        CreatedBy:  userID,
        ExpiresAt:  time.Now().Add(InviteExpiration),
    })
    if err != nil {
        return nil, err
    }

    return &invite, nil
}

func (s *InviteService) GetInvite(ctx context.Context, code string) (*generated.InviteLink, error) {
    invite, err := s.queries.GetInviteLinkByCode(ctx, code)
    if err != nil {
        if errors.Is(err, sql.ErrNoRows) {
            return nil, ErrInviteNotFound
        }
        return nil, err
    }
    return &invite, nil
}

func (s *InviteService) ListCampaignInvites(ctx context.Context, campaignID, userID uuid.UUID) ([]generated.InviteLink, error) {
    // Verify user is GM
    campaign, err := s.queries.GetCampaign(ctx, campaignID)
    if err != nil {
        return nil, err
    }
    if !campaign.OwnerID.Valid || campaign.OwnerID.UUID != userID {
        return nil, ErrNotGM
    }

    return s.queries.ListCampaignInvites(ctx, campaignID)
}

func (s *InviteService) RevokeInvite(ctx context.Context, inviteID, campaignID, userID uuid.UUID) error {
    // Verify user is GM
    campaign, err := s.queries.GetCampaign(ctx, campaignID)
    if err != nil {
        return err
    }
    if !campaign.OwnerID.Valid || campaign.OwnerID.UUID != userID {
        return ErrNotGM
    }

    _, err = s.queries.RevokeInvite(ctx, generated.RevokeInviteParams{
        ID:         inviteID,
        CampaignID: campaignID,
    })
    return err
}

func (s *InviteService) ValidateAndUseInvite(ctx context.Context, code string, userID uuid.UUID) (*generated.InviteLink, error) {
    invite, err := s.GetInvite(ctx, code)
    if err != nil {
        return nil, err
    }

    // Check if revoked
    if invite.RevokedAt.Valid {
        return nil, ErrInviteRevoked
    }

    // Check if used
    if invite.UsedAt.Valid {
        return nil, ErrInviteUsed
    }

    // Check if expired
    if time.Now().After(invite.ExpiresAt) {
        return nil, ErrInviteExpired
    }

    // Check campaign member count
    members, err := s.queries.GetCampaignMembers(ctx, invite.CampaignID)
    if err != nil {
        return nil, err
    }
    if len(members) >= MaxCampaignMembers {
        return nil, ErrCampaignFull
    }

    // Mark as used
    used, err := s.queries.MarkInviteUsed(ctx, generated.MarkInviteUsedParams{
        ID:     invite.ID,
        UsedBy: uuid.NullUUID{UUID: userID, Valid: true},
    })
    if err != nil {
        return nil, err
    }

    return &used, nil
}

// Helper: Generate cryptographically random invite code
func generateInviteCode() (string, error) {
    bytes := make([]byte, 16) // 128 bits
    if _, err := rand.Read(bytes); err != nil {
        return "", err
    }
    // URL-safe base64 encoding, remove padding
    code := base64.URLEncoding.EncodeToString(bytes)
    code = code[:22] // Trim to fixed length
    return code, nil
}
```

### HTTP Handlers

Create `/backend/internal/api/handlers/invites.go`:

```go
package handlers

import (
    "errors"
    "net/http"
    "time"

    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
    "vanguard-pbp/internal/service"
)

type InviteHandler struct {
    service *service.InviteService
}

func NewInviteHandler(service *service.InviteService) *InviteHandler {
    return &InviteHandler{service: service}
}

// POST /api/campaigns/:id/invite
func (h *InviteHandler) GenerateInvite(c *gin.Context) {
    userID := c.MustGet("userID").(uuid.UUID)
    campaignID, err := uuid.Parse(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "error": map[string]interface{}{
                "code":      "INVALID_CAMPAIGN_ID",
                "message":   "Invalid campaign ID format.",
                "timestamp": time.Now(),
            },
        })
        return
    }

    invite, err := h.service.GenerateInvite(c.Request.Context(), campaignID, userID)
    if err != nil {
        if errors.Is(err, service.ErrNotGM) {
            c.JSON(http.StatusForbidden, gin.H{
                "error": map[string]interface{}{
                    "code":      "FORBIDDEN",
                    "message":   "Only the GM can generate invite links.",
                    "timestamp": time.Now(),
                },
            })
            return
        }
        if errors.Is(err, service.ErrInviteLimitReached) {
            c.JSON(http.StatusTooManyRequests, gin.H{
                "error": map[string]interface{}{
                    "code":      "INVITE_LIMIT_REACHED",
                    "message":   "Too many active invites. Revoke unused invites to create new ones.",
                    "timestamp": time.Now(),
                },
            })
            return
        }
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": map[string]interface{}{
                "code":      "INTERNAL_ERROR",
                "message":   "Something went wrong. Please try again.",
                "timestamp": time.Now(),
            },
        })
        return
    }

    c.JSON(http.StatusCreated, invite)
}

// GET /api/campaigns/:id/invites
func (h *InviteHandler) ListInvites(c *gin.Context) {
    userID := c.MustGet("userID").(uuid.UUID)
    campaignID, err := uuid.Parse(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "error": map[string]interface{}{
                "code":      "INVALID_CAMPAIGN_ID",
                "message":   "Invalid campaign ID format.",
                "timestamp": time.Now(),
            },
        })
        return
    }

    invites, err := h.service.ListCampaignInvites(c.Request.Context(), campaignID, userID)
    if err != nil {
        if errors.Is(err, service.ErrNotGM) {
            c.JSON(http.StatusForbidden, gin.H{
                "error": map[string]interface{}{
                    "code":      "FORBIDDEN",
                    "message":   "Only the GM can view invite links.",
                    "timestamp": time.Now(),
                },
            })
            return
        }
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": map[string]interface{}{
                "code":      "INTERNAL_ERROR",
                "message":   "Something went wrong. Please try again.",
                "timestamp": time.Now(),
            },
        })
        return
    }

    c.JSON(http.StatusOK, invites)
}

// DELETE /api/campaigns/:id/invites/:inviteId
func (h *InviteHandler) RevokeInvite(c *gin.Context) {
    userID := c.MustGet("userID").(uuid.UUID)
    campaignID, err := uuid.Parse(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "error": map[string]interface{}{
                "code":      "INVALID_CAMPAIGN_ID",
                "message":   "Invalid campaign ID format.",
                "timestamp": time.Now(),
            },
        })
        return
    }

    inviteID, err := uuid.Parse(c.Param("inviteId"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "error": map[string]interface{}{
                "code":      "INVALID_INVITE_ID",
                "message":   "Invalid invite ID format.",
                "timestamp": time.Now(),
            },
        })
        return
    }

    err = h.service.RevokeInvite(c.Request.Context(), inviteID, campaignID, userID)
    if err != nil {
        if errors.Is(err, service.ErrNotGM) {
            c.JSON(http.StatusForbidden, gin.H{
                "error": map[string]interface{}{
                    "code":      "FORBIDDEN",
                    "message":   "Only the GM can revoke invite links.",
                    "timestamp": time.Now(),
                },
            })
            return
        }
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": map[string]interface{}{
                "code":      "INTERNAL_ERROR",
                "message":   "Something went wrong. Please try again.",
                "timestamp": time.Now(),
            },
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Invite revoked successfully"})
}

// GET /api/invites/:code (public endpoint)
func (h *InviteHandler) LookupInvite(c *gin.Context) {
    code := c.Param("code")

    invite, err := h.service.GetInvite(c.Request.Context(), code)
    if err != nil {
        if errors.Is(err, service.ErrInviteNotFound) {
            c.JSON(http.StatusNotFound, gin.H{
                "error": map[string]interface{}{
                    "code":      "INVITE_NOT_FOUND",
                    "message":   "Invite link not found or invalid.",
                    "timestamp": time.Now(),
                },
            })
            return
        }
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": map[string]interface{}{
                "code":      "INTERNAL_ERROR",
                "message":   "Something went wrong. Please try again.",
                "timestamp": time.Now(),
            },
        })
        return
    }

    // Check invite status
    var status string
    if invite.RevokedAt.Valid {
        status = "revoked"
    } else if invite.UsedAt.Valid {
        status = "used"
    } else if time.Now().After(invite.ExpiresAt) {
        status = "expired"
    } else {
        status = "active"
    }

    c.JSON(http.StatusOK, gin.H{
        "campaign_title": invite.CampaignTitle,
        "status":         status,
        "expires_at":     invite.ExpiresAt,
    })
}
```

### Rate Limiting

Add to `/backend/internal/api/middleware/ratelimit.go`:

```go
// Rate limit for invite generation: 5 requests per 15 minutes
func InviteGenerationRateLimit() gin.HandlerFunc {
    limiter := rate.NewLimiter(rate.Every(15*time.Minute/5), 2)

    return func(c *gin.Context) {
        userID := c.MustGet("userID").(uuid.UUID)

        if !limiter.Allow() {
            c.JSON(http.StatusTooManyRequests, gin.H{
                "error": map[string]interface{}{
                    "code":      "RATE_LIMIT_EXCEEDED",
                    "message":   "You're generating invites too quickly. Please wait a few minutes and try again.",
                    "timestamp": time.Now(),
                },
            })
            c.Abort()
            return
        }

        c.Next()
    }
}
```

---

## Frontend Implementation

### Invite Management Component

Create `/frontend/src/components/campaign/InviteManager.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Copy, Plus, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { InviteLink } from '@/types/generated';
import { formatDistanceToNow } from 'date-fns';

interface InviteManagerProps {
  campaignId: string;
}

export function InviteManager({ campaignId }: InviteManagerProps) {
  const { toast } = useToast();
  const [invites, setInvites] = useState<InviteLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInvites();
  }, [campaignId]);

  const loadInvites = async () => {
    try {
      const data = await api.get(`/api/campaigns/${campaignId}/invites`);
      setInvites(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load invite links.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateInvite = async () => {
    try {
      const invite = await api.post(`/api/campaigns/${campaignId}/invite`);
      setInvites([invite, ...invites]);
      copyInviteLink(invite.code);
      toast({
        title: 'Invite created',
        description: 'Link copied to clipboard!',
      });
    } catch (error: any) {
      if (error.response?.data?.error?.code === 'INVITE_LIMIT_REACHED') {
        toast({
          title: 'Too many invites',
          description: 'Revoke unused invites to create new ones.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to generate invite link.',
          variant: 'destructive',
        });
      }
    }
  };

  const revokeInvite = async (inviteId: string) => {
    try {
      await api.delete(`/api/campaigns/${campaignId}/invites/${inviteId}`);
      setInvites(invites.map(inv =>
        inv.id === inviteId ? { ...inv, revoked_at: new Date().toISOString() } : inv
      ));
      toast({
        title: 'Invite revoked',
        description: 'The invite link has been revoked.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to revoke invite.',
        variant: 'destructive',
      });
    }
  };

  const copyInviteLink = (code: string) => {
    const link = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(link);
  };

  const getInviteStatus = (invite: InviteLink): string => {
    if (invite.revoked_at) return 'revoked';
    if (invite.used_at) return 'used';
    if (new Date(invite.expires_at) < new Date()) return 'expired';
    return 'active';
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'default',
      used: 'secondary',
      expired: 'outline',
      revoked: 'destructive',
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return <div>Loading invites...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Invite Links</CardTitle>
            <CardDescription>
              Generate one-time invite links that expire after 24 hours
            </CardDescription>
          </div>
          <Button onClick={generateInvite}>
            <Plus className="mr-2 h-4 w-4" />
            New Invite
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {invites.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No invite links yet. Create one to invite players!</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Link</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Used By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => {
                const status = getInviteStatus(invite);
                const link = `${window.location.origin}/join/${invite.code}`;

                return (
                  <TableRow key={invite.id}>
                    <TableCell>{getStatusBadge(status)}</TableCell>
                    <TableCell className="font-mono text-sm">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          copyInviteLink(invite.code);
                          toast({ title: 'Copied!', description: 'Link copied to clipboard.' });
                        }}
                      >
                        <Copy className="mr-2 h-3 w-3" />
                        {invite.code.slice(0, 8)}...
                      </Button>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(invite.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {invite.used_by ? 'Yes' : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {status === 'active' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeInvite(invite.id)}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
```

### Join via Invite Page

Create `/frontend/src/app/routes/join/[code].tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

export function JoinCampaignPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (code) {
      lookupInvite(code);
    }
  }, [code]);

  const lookupInvite = async (inviteCode: string) => {
    try {
      const data = await api.get(`/api/invites/${inviteCode}`);
      setInvite(data);
    } catch (error: any) {
      toast({
        title: 'Invalid invite',
        description: 'This invite link is not valid or has expired.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const joinCampaign = async () => {
    setJoining(true);
    try {
      const campaign = await api.post(`/api/campaigns/join`, { code });
      toast({
        title: 'Joined campaign!',
        description: `You've successfully joined ${campaign.title}.`,
      });
      navigate(`/campaigns/${campaign.id}`);
    } catch (error: any) {
      const errorCode = error.response?.data?.error?.code;
      if (errorCode === 'CAMPAIGN_FULL') {
        toast({
          title: 'Campaign is full',
          description: 'This campaign has reached the maximum number of players (50).',
          variant: 'destructive',
        });
      } else if (errorCode === 'INVITE_EXPIRED') {
        toast({
          title: 'Invite expired',
          description: 'This invite link has expired. Ask the GM for a new one.',
          variant: 'destructive',
        });
      } else if (errorCode === 'INVITE_USED') {
        toast({
          title: 'Invite already used',
          description: 'This invite link has already been used. Ask the GM for a new one.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to join campaign. Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return <div className="container mx-auto py-8">Loading...</div>;
  }

  if (!invite) {
    return (
      <div className="container mx-auto max-w-md py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              <CardTitle>Invalid Invite</CardTitle>
            </div>
            <CardDescription>
              This invite link is not valid or has expired.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isActive = invite.status === 'active';

  return (
    <div className="container mx-auto max-w-md py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {isActive ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <Clock className="h-5 w-5 text-muted-foreground" />
            )}
            <CardTitle>Campaign Invite</CardTitle>
          </div>
          <CardDescription>
            You've been invited to join <strong>{invite.campaign_title}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isActive ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Expires {new Date(invite.expires_at).toLocaleString()}
              </p>
              <Button onClick={joinCampaign} disabled={joining} className="w-full">
                {joining ? 'Joining...' : 'Join Campaign'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This invite is <strong>{invite.status}</strong>. Ask the GM for a new invite link.
              </p>
              <Button variant="outline" onClick={() => navigate('/')} className="w-full">
                Go Home
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Edge Cases

### Concurrent Join Attempts
- **Scenario**: Two users click join simultaneously when campaign is at 49/50 members
- **Handling**: Database unique constraint + transaction ensures one succeeds, one fails with "Campaign Full"
- **Test**: Simulate concurrent joins at limit

### Invite Code Collision
- **Scenario**: Generated code already exists (astronomically unlikely)
- **Handling**: Database unique constraint fails insert, service retries with new code
- **Test**: Mock collision, verify retry logic

### Expired Invite Cleanup
- **Scenario**: Database accumulates thousands of expired invites
- **Handling**: Optional: Background job deletes invites older than 30 days
- **Test**: Create old invites, verify cleanup doesn't affect active links

### Rate Limit Bypass
- **Scenario**: User opens multiple tabs to bypass rate limit
- **Handling**: Rate limit keyed by userID, applies across all tabs
- **Test**: Multiple concurrent requests from same user

---

## Testing Checklist

### Backend
- [ ] Generate invite as GM
- [ ] Block generate as non-GM
- [ ] Generate invite creates unique code
- [ ] Invite expires after 24 hours
- [ ] Invite can only be used once
- [ ] Revoked invite cannot be used
- [ ] Expired invite cannot be used
- [ ] Campaign at 50 members blocks join
- [ ] List invites as GM shows all states
- [ ] Block list invites as non-GM
- [ ] Revoke invite as GM succeeds
- [ ] Block revoke as non-GM
- [ ] Rate limit enforced on invite generation

### Frontend
- [ ] Invite list displays all invites with correct status
- [ ] Copy invite link button works
- [ ] Generate invite button creates new link
- [ ] Status badges display correctly (active/used/expired/revoked)
- [ ] Revoke button only shows for active invites
- [ ] Join page shows campaign name
- [ ] Join page detects invite status
- [ ] Join button disabled for non-active invites
- [ ] Join success redirects to campaign
- [ ] Error messages display for all failure cases

### Integration
- [ ] End-to-end: Generate → Copy → Join → Verify membership
- [ ] Invite used status updates in real-time
- [ ] Revoked invite immediately unusable
- [ ] Expired invite blocks join
- [ ] Campaign full error at limit

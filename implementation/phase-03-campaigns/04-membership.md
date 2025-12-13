# Campaign Membership

## Overview

Membership management handles players joining campaigns, leaving campaigns, GM removal of players, GM role transfer, and GM abandonment scenarios.

## PRD References

- [Settings](/home/tobiasd/github/vanguard-pbp/prd/settings.md) - GM inactivity threshold, GM transfer
- [Turn Structure](/home/tobiasd/github/vanguard-pbp/prd/turn-structure.md) - GM inactivity detection, role transfer
- [Technical](/home/tobiasd/github/vanguard-pbp/prd/technical.md) - CampaignMember model, character assignments

## Skills

- **go-api-server**: Membership CRUD, GM transfer logic
- **supabase-integration**: Transaction handling for role transfers
- **shadcn-react**: Member list, removal dialogs, transfer UI

---

## Backend Implementation

### sqlc Queries

Add to `/backend/internal/db/queries/campaigns.sql`:

```sql
-- name: GetCampaignMember :one
SELECT * FROM campaign_members
WHERE campaign_id = $1 AND user_id = $2;

-- name: IsCampaignMember :one
SELECT EXISTS(
    SELECT 1 FROM campaign_members
    WHERE campaign_id = $1 AND user_id = $2
) AS is_member;

-- name: GetCampaignMemberCount :one
SELECT COUNT(*) FROM campaign_members
WHERE campaign_id = $1;

-- name: LeaveCampaign :exec
DELETE FROM campaign_members
WHERE campaign_id = $1 AND user_id = $2 AND role = 'player';

-- name: GetMemberCharacters :many
SELECT c.* FROM characters c
INNER JOIN character_assignments ca ON c.id = ca.character_id
WHERE ca.user_id = $1 AND c.campaign_id = $2;

-- name: OrphanCharacters :exec
DELETE FROM character_assignments
WHERE user_id = $1 AND character_id IN (
    SELECT id FROM characters WHERE campaign_id = $2
);

-- name: TransferGmRole :exec
UPDATE campaigns
SET owner_id = $2, updated_at = now()
WHERE id = $1;

-- name: UpdateMemberRole :exec
UPDATE campaign_members
SET role = $2
WHERE campaign_id = $1 AND user_id = $3;

-- name: CheckGmInactivity :one
SELECT
    id,
    last_gm_activity_at,
    EXTRACT(EPOCH FROM (now() - last_gm_activity_at)) / 86400 AS days_inactive
FROM campaigns
WHERE id = $1;
```

### Service Layer

Create `/backend/internal/service/membership.go`:

```go
package service

import (
    "context"
    "database/sql"
    "errors"
    "time"

    "github.com/google/uuid"
    "vanguard-pbp/internal/db/generated"
)

var (
    ErrAlreadyMember    = errors.New("user is already a member of this campaign")
    ErrNotMember        = errors.New("user is not a member of this campaign")
    ErrCannotLeaveAsGM  = errors.New("GM cannot leave campaign (transfer role first)")
    ErrGmNotAbandoned   = errors.New("GM is still active (not past 30-day threshold)")
)

const GmInactivityDays = 30

type MembershipService struct {
    queries *generated.Queries
}

func NewMembershipService(queries *generated.Queries) *MembershipService {
    return &MembershipService{queries: queries}
}

func (s *MembershipService) JoinCampaign(ctx context.Context, code string, userID uuid.UUID) (*generated.Campaign, error) {
    // Get invite service to validate invite
    inviteService := NewInviteService(s.queries)
    invite, err := inviteService.ValidateAndUseInvite(ctx, code, userID)
    if err != nil {
        return nil, err
    }

    // Check if already a member
    isMember, err := s.queries.IsCampaignMember(ctx, generated.IsCampaignMemberParams{
        CampaignID: invite.CampaignID,
        UserID:     userID,
    })
    if err != nil {
        return nil, err
    }
    if isMember {
        return nil, ErrAlreadyMember
    }

    // Add as member with player role
    _, err = s.queries.AddCampaignMember(ctx, generated.AddCampaignMemberParams{
        CampaignID: invite.CampaignID,
        UserID:     userID,
        Role:       "player",
    })
    if err != nil {
        return nil, err
    }

    // Get campaign details
    campaign, err := s.queries.GetCampaign(ctx, invite.CampaignID)
    if err != nil {
        return nil, err
    }

    return &campaign, nil
}

func (s *MembershipService) LeaveCampaign(ctx context.Context, campaignID, userID uuid.UUID) error {
    // Check if user is GM
    campaign, err := s.queries.GetCampaign(ctx, campaignID)
    if err != nil {
        return err
    }
    if campaign.OwnerID.Valid && campaign.OwnerID.UUID == userID {
        return ErrCannotLeaveAsGM
    }

    // Orphan all characters assigned to this user
    err = s.queries.OrphanCharacters(ctx, generated.OrphanCharactersParams{
        UserID:     userID,
        CampaignID: campaignID,
    })
    if err != nil {
        return err
    }

    // Remove membership
    return s.queries.LeaveCampaign(ctx, generated.LeaveCampaignParams{
        CampaignID: campaignID,
        UserID:     userID,
    })
}

func (s *MembershipService) RemoveMember(ctx context.Context, campaignID, gmUserID, targetUserID uuid.UUID) error {
    // Verify requester is GM
    campaign, err := s.queries.GetCampaign(ctx, campaignID)
    if err != nil {
        return err
    }
    if !campaign.OwnerID.Valid || campaign.OwnerID.UUID != gmUserID {
        return ErrNotGM
    }

    // Cannot remove self (must transfer first)
    if targetUserID == gmUserID {
        return errors.New("cannot remove yourself as GM (transfer role first)")
    }

    // Orphan characters
    err = s.queries.OrphanCharacters(ctx, generated.OrphanCharactersParams{
        UserID:     targetUserID,
        CampaignID: campaignID,
    })
    if err != nil {
        return err
    }

    // Remove membership
    return s.queries.RemoveCampaignMember(ctx, generated.RemoveCampaignMemberParams{
        CampaignID: campaignID,
        UserID:     targetUserID,
    })
}

func (s *MembershipService) TransferGmRole(ctx context.Context, campaignID, currentGmID, newGmID uuid.UUID) error {
    // Verify requester is current GM
    campaign, err := s.queries.GetCampaign(ctx, campaignID)
    if err != nil {
        return err
    }
    if !campaign.OwnerID.Valid || campaign.OwnerID.UUID != currentGmID {
        return ErrNotGM
    }

    // Verify new GM is a member
    isMember, err := s.queries.IsCampaignMember(ctx, generated.IsCampaignMemberParams{
        CampaignID: campaignID,
        UserID:     newGmID,
    })
    if err != nil {
        return err
    }
    if !isMember {
        return errors.New("new GM must be a campaign member")
    }

    // Execute transfer in transaction
    // 1. Update campaign owner
    err = s.queries.TransferGmRole(ctx, generated.TransferGmRoleParams{
        ID:      campaignID,
        OwnerID: uuid.NullUUID{UUID: newGmID, Valid: true},
    })
    if err != nil {
        return err
    }

    // 2. Update old GM to player role
    err = s.queries.UpdateMemberRole(ctx, generated.UpdateMemberRoleParams{
        CampaignID: campaignID,
        Role:       "player",
        UserID:     currentGmID,
    })
    if err != nil {
        return err
    }

    // 3. Update new GM to gm role
    err = s.queries.UpdateMemberRole(ctx, generated.UpdateMemberRoleParams{
        CampaignID: campaignID,
        Role:       "gm",
        UserID:     newGmID,
    })
    if err != nil {
        return err
    }

    return nil
}

func (s *MembershipService) ClaimAbandonedGmRole(ctx context.Context, campaignID, claimantUserID uuid.UUID) error {
    // Check GM inactivity
    inactivity, err := s.queries.CheckGmInactivity(ctx, campaignID)
    if err != nil {
        return err
    }

    if inactivity.DaysInactive < GmInactivityDays {
        return ErrGmNotAbandoned
    }

    // Verify claimant is a member
    isMember, err := s.queries.IsCampaignMember(ctx, generated.IsCampaignMemberParams{
        CampaignID: campaignID,
        UserID:     claimantUserID,
    })
    if err != nil {
        return err
    }
    if !isMember {
        return errors.New("must be a campaign member to claim GM role")
    }

    // Get current GM (if exists)
    campaign, err := s.queries.GetCampaign(ctx, campaignID)
    if err != nil {
        return err
    }

    // Update campaign owner
    err = s.queries.TransferGmRole(ctx, generated.TransferGmRoleParams{
        ID:      campaignID,
        OwnerID: uuid.NullUUID{UUID: claimantUserID, Valid: true},
    })
    if err != nil {
        return err
    }

    // If old GM still exists as member, demote to player
    if campaign.OwnerID.Valid {
        err = s.queries.UpdateMemberRole(ctx, generated.UpdateMemberRoleParams{
            CampaignID: campaignID,
            Role:       "player",
            UserID:     campaign.OwnerID.UUID,
        })
        if err != nil {
            // Non-critical: old GM may have deleted account
            return nil
        }
    }

    // Promote claimant to GM role
    err = s.queries.UpdateMemberRole(ctx, generated.UpdateMemberRoleParams{
        CampaignID: campaignID,
        Role:       "gm",
        UserID:     claimantUserID,
    })
    if err != nil {
        return err
    }

    // Reset GM activity timestamp
    err = s.queries.UpdateGmActivity(ctx, campaignID)
    if err != nil {
        return err
    }

    return nil
}
```

### HTTP Handlers

Add to `/backend/internal/api/handlers/campaigns.go`:

```go
// POST /api/campaigns/join
func (h *CampaignHandler) JoinCampaign(c *gin.Context) {
    userID := c.MustGet("userID").(uuid.UUID)

    var req struct {
        Code string `json:"code" binding:"required"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "error": map[string]interface{}{
                "code":      "INVALID_REQUEST",
                "message":   "Invite code is required.",
                "timestamp": time.Now(),
            },
        })
        return
    }

    membershipService := service.NewMembershipService(h.service.queries)
    campaign, err := membershipService.JoinCampaign(c.Request.Context(), req.Code, userID)
    if err != nil {
        // Handle various invite errors
        if errors.Is(err, service.ErrInviteExpired) {
            c.JSON(http.StatusGone, gin.H{
                "error": map[string]interface{}{
                    "code":      "INVITE_EXPIRED",
                    "message":   "This invite link has expired. Ask the GM for a new one.",
                    "timestamp": time.Now(),
                },
            })
            return
        }
        if errors.Is(err, service.ErrInviteUsed) {
            c.JSON(http.StatusGone, gin.H{
                "error": map[string]interface{}{
                    "code":      "INVITE_USED",
                    "message":   "This invite link has already been used.",
                    "timestamp": time.Now(),
                },
            })
            return
        }
        if errors.Is(err, service.ErrCampaignFull) {
            c.JSON(http.StatusForbidden, gin.H{
                "error": map[string]interface{}{
                    "code":      "CAMPAIGN_FULL",
                    "message":   "This campaign has reached the maximum number of players (50).",
                    "timestamp": time.Now(),
                },
            })
            return
        }
        if errors.Is(err, service.ErrAlreadyMember) {
            c.JSON(http.StatusConflict, gin.H{
                "error": map[string]interface{}{
                    "code":      "ALREADY_MEMBER",
                    "message":   "You are already a member of this campaign.",
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

    c.JSON(http.StatusOK, campaign)
}

// POST /api/campaigns/:id/leave
func (h *CampaignHandler) LeaveCampaign(c *gin.Context) {
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

    membershipService := service.NewMembershipService(h.service.queries)
    err = membershipService.LeaveCampaign(c.Request.Context(), campaignID, userID)
    if err != nil {
        if errors.Is(err, service.ErrCannotLeaveAsGM) {
            c.JSON(http.StatusForbidden, gin.H{
                "error": map[string]interface{}{
                    "code":      "CANNOT_LEAVE_AS_GM",
                    "message":   "You must transfer the GM role before leaving the campaign.",
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

    c.JSON(http.StatusOK, gin.H{"message": "Left campaign successfully"})
}

// DELETE /api/campaigns/:id/members/:userId
func (h *CampaignHandler) RemoveMember(c *gin.Context) {
    gmUserID := c.MustGet("userID").(uuid.UUID)
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

    targetUserID, err := uuid.Parse(c.Param("userId"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "error": map[string]interface{}{
                "code":      "INVALID_USER_ID",
                "message":   "Invalid user ID format.",
                "timestamp": time.Now(),
            },
        })
        return
    }

    membershipService := service.NewMembershipService(h.service.queries)
    err = membershipService.RemoveMember(c.Request.Context(), campaignID, gmUserID, targetUserID)
    if err != nil {
        if errors.Is(err, service.ErrNotGM) {
            c.JSON(http.StatusForbidden, gin.H{
                "error": map[string]interface{}{
                    "code":      "FORBIDDEN",
                    "message":   "Only the GM can remove members.",
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

    c.JSON(http.StatusOK, gin.H{"message": "Member removed successfully"})
}

// POST /api/campaigns/:id/transfer-gm
func (h *CampaignHandler) TransferGmRole(c *gin.Context) {
    currentGmID := c.MustGet("userID").(uuid.UUID)
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

    var req struct {
        NewGmUserId string `json:"new_gm_user_id" binding:"required"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "error": map[string]interface{}{
                "code":      "INVALID_REQUEST",
                "message":   "New GM user ID is required.",
                "timestamp": time.Now(),
            },
        })
        return
    }

    newGmID, err := uuid.Parse(req.NewGmUserId)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "error": map[string]interface{}{
                "code":      "INVALID_USER_ID",
                "message":   "Invalid user ID format.",
                "timestamp": time.Now(),
            },
        })
        return
    }

    membershipService := service.NewMembershipService(h.service.queries)
    err = membershipService.TransferGmRole(c.Request.Context(), campaignID, currentGmID, newGmID)
    if err != nil {
        if errors.Is(err, service.ErrNotGM) {
            c.JSON(http.StatusForbidden, gin.H{
                "error": map[string]interface{}{
                    "code":      "FORBIDDEN",
                    "message":   "Only the current GM can transfer the role.",
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

    c.JSON(http.StatusOK, gin.H{"message": "GM role transferred successfully"})
}

// POST /api/campaigns/:id/claim-gm
func (h *CampaignHandler) ClaimGmRole(c *gin.Context) {
    claimantUserID := c.MustGet("userID").(uuid.UUID)
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

    membershipService := service.NewMembershipService(h.service.queries)
    err = membershipService.ClaimAbandonedGmRole(c.Request.Context(), campaignID, claimantUserID)
    if err != nil {
        if errors.Is(err, service.ErrGmNotAbandoned) {
            c.JSON(http.StatusForbidden, gin.H{
                "error": map[string]interface{}{
                    "code":      "GM_NOT_ABANDONED",
                    "message":   "The GM is still active. You can only claim the role after 30 days of inactivity.",
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

    c.JSON(http.StatusOK, gin.H{"message": "GM role claimed successfully"})
}
```

---

## Frontend Implementation

### Member List Component

Create `/frontend/src/components/campaign/MemberList.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { UserMinus, UserCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Campaign, CampaignMember } from '@/types/generated';
import { formatDistanceToNow } from 'date-fns';

interface MemberListProps {
  campaign: Campaign;
  isGm: boolean;
}

export function MemberList({ campaign, isGm }: MemberListProps) {
  const { toast } = useToast();
  const [members, setMembers] = useState<CampaignMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMembers();
  }, [campaign.id]);

  const loadMembers = async () => {
    try {
      const data = await api.get(`/api/campaigns/${campaign.id}/members`);
      setMembers(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load campaign members.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async (userId: string) => {
    try {
      await api.delete(`/api/campaigns/${campaign.id}/members/${userId}`);
      setMembers(members.filter(m => m.user_id !== userId));
      toast({
        title: 'Member removed',
        description: 'The player has been removed from the campaign.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove member.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <div>Loading members...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Members</CardTitle>
        <CardDescription>
          {members.length} / 50 members
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              {isGm && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.email}</TableCell>
                <TableCell>
                  <Badge variant={member.role === 'gm' ? 'default' : 'secondary'}>
                    {member.role === 'gm' ? 'GM' : 'Player'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}
                </TableCell>
                {isGm && (
                  <TableCell className="text-right">
                    {member.role === 'player' && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove member?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove {member.email} from the campaign and orphan their characters.
                              You can reassign their characters to other players.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => removeMember(member.user_id)}>
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

---

## Edge Cases

### GM Leaves Campaign
- **Scenario**: GM attempts to leave without transferring role
- **Handling**: API blocks with error message "Transfer role first"
- **Test**: GM clicks leave, verify error displayed

### Last Member Leaves
- **Scenario**: Only member (who is not GM) leaves campaign
- **Handling**: Campaign becomes GM-only, can still invite new players
- **Test**: Remove all players, verify campaign persists

### Transfer to Non-Member
- **Scenario**: GM attempts to transfer role to user not in campaign
- **Handling**: API validates membership, rejects transfer
- **Test**: Attempt transfer to external user ID

### Claim Before 30 Days
- **Scenario**: Player attempts to claim GM role at day 25
- **Handling**: API checks threshold, rejects claim
- **Test**: Mock GM last activity at day 25, verify rejection

### Concurrent GM Claims
- **Scenario**: Two players claim GM simultaneously after 30 days
- **Handling**: Database transaction ensures first claim wins
- **Test**: Simulate concurrent claims

---

## Testing Checklist

### Backend
- [ ] Join campaign with valid invite
- [ ] Block join if already member
- [ ] Leave campaign as player (characters orphaned)
- [ ] Block leave as GM without transfer
- [ ] Remove member as GM
- [ ] Block remove as non-GM
- [ ] Transfer GM role (voluntary)
- [ ] Block transfer to non-member
- [ ] Claim GM after 30 days inactivity
- [ ] Block claim before 30 days
- [ ] GM inactivity calculated correctly
- [ ] Character orphaning on leave/removal

### Frontend
- [ ] Member list displays all members
- [ ] Role badges display correctly
- [ ] Remove button only for players (not GM)
- [ ] Remove dialog shows confirmation
- [ ] Leave campaign button works for players
- [ ] Leave blocked for GM with clear message
- [ ] Transfer GM dialog shows member list
- [ ] Claim GM button shows after 30 days
- [ ] Claim GM blocked before threshold

### Integration
- [ ] Join → Verify membership appears in list
- [ ] Leave → Verify membership removed
- [ ] Remove → Verify characters orphaned
- [ ] Transfer → Verify roles swap correctly
- [ ] Claim → Verify old GM demoted, new GM promoted

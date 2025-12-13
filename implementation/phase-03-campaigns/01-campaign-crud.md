# Campaign CRUD Operations

## Overview

Core create, read, update, delete operations for campaigns. Each user can own up to 5 campaigns as GM.

## PRD References

- [Scope](/home/tobiasd/github/vanguard-pbp/prd/scope.md) - Campaign creation, 5-campaign limit
- [Settings](/home/tobiasd/github/vanguard-pbp/prd/settings.md) - Default settings, campaign ownership limit
- [Technical](/home/tobiasd/github/vanguard-pbp/prd/technical.md) - Campaign data model, API endpoints

## Skills

- **go-api-server**: HTTP handlers, service layer, validation
- **supabase-integration**: Database queries, RLS policies
- **shadcn-react**: Campaign list, create form, edit form

---

## Backend Implementation

### Database Schema

```sql
-- campaigns table
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL CHECK (length(title) >= 1 AND length(title) <= 100),
    description TEXT NOT NULL DEFAULT '',
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    settings JSONB NOT NULL DEFAULT '{
        "timeGatePreset": "24h",
        "fogOfWar": true,
        "hiddenPosts": true,
        "oocVisibility": "gm_only",
        "characterLimit": 3000,
        "rollRequestTimeoutHours": 24,
        "systemPreset": {
            "name": "D&D 5e",
            "intentions": ["Stealth", "Persuasion", "Intimidation", "Perception", "Investigation", "Athletics", "Acrobatics", "Arcana", "History", "Nature", "Religion", "Animal Handling", "Insight", "Medicine", "Survival", "Deception", "Performance", "Sleight of Hand"],
            "diceType": "d20"
        }
    }'::jsonb,
    current_phase TEXT NOT NULL DEFAULT 'gm_phase' CHECK (current_phase IN ('gm_phase', 'pc_phase')),
    current_phase_expires_at TIMESTAMPTZ,
    is_paused BOOLEAN NOT NULL DEFAULT false,
    last_gm_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    storage_used_bytes BIGINT NOT NULL DEFAULT 0,
    scene_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying user's campaigns
CREATE INDEX idx_campaigns_owner ON campaigns(owner_id) WHERE owner_id IS NOT NULL;

-- Index for GM inactivity checks
CREATE INDEX idx_campaigns_gm_activity ON campaigns(last_gm_activity_at) WHERE owner_id IS NOT NULL;

-- campaign_members table
CREATE TABLE campaign_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('gm', 'player')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(campaign_id, user_id)
);

-- Indexes
CREATE INDEX idx_campaign_members_campaign ON campaign_members(campaign_id);
CREATE INDEX idx_campaign_members_user ON campaign_members(user_id);
```

### sqlc Queries

Create `/backend/internal/db/queries/campaigns.sql`:

```sql
-- name: CreateCampaign :one
INSERT INTO campaigns (
    title,
    description,
    owner_id,
    settings,
    last_gm_activity_at
) VALUES (
    $1, $2, $3, $4, now()
) RETURNING *;

-- name: AddCampaignMember :one
INSERT INTO campaign_members (
    campaign_id,
    user_id,
    role
) VALUES (
    $1, $2, $3
) RETURNING *;

-- name: GetCampaign :one
SELECT * FROM campaigns WHERE id = $1;

-- name: GetCampaignWithMembership :one
SELECT
    c.*,
    cm.role as user_role
FROM campaigns c
LEFT JOIN campaign_members cm ON c.id = cm.campaign_id AND cm.user_id = $2
WHERE c.id = $1;

-- name: ListUserCampaigns :many
SELECT
    c.*,
    cm.role as user_role
FROM campaigns c
INNER JOIN campaign_members cm ON c.id = cm.campaign_id
WHERE cm.user_id = $1
ORDER BY c.updated_at DESC;

-- name: CountUserOwnedCampaigns :one
SELECT COUNT(*) FROM campaigns WHERE owner_id = $1;

-- name: UpdateCampaign :one
UPDATE campaigns
SET
    title = COALESCE(sqlc.narg('title'), title),
    description = COALESCE(sqlc.narg('description'), description),
    settings = COALESCE(sqlc.narg('settings'), settings),
    is_paused = COALESCE(sqlc.narg('is_paused'), is_paused),
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteCampaign :exec
DELETE FROM campaigns WHERE id = $1;

-- name: GetCampaignMembers :many
SELECT
    cm.*,
    u.email
FROM campaign_members cm
INNER JOIN auth.users u ON cm.user_id = u.id
WHERE cm.campaign_id = $1
ORDER BY cm.role DESC, cm.joined_at ASC;

-- name: RemoveCampaignMember :exec
DELETE FROM campaign_members
WHERE campaign_id = $1 AND user_id = $2;

-- name: UpdateCampaignOwner :one
UPDATE campaigns
SET
    owner_id = $2,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateGmActivity :exec
UPDATE campaigns
SET last_gm_activity_at = now()
WHERE id = $1;

-- name: PauseCampaign :one
UPDATE campaigns
SET
    is_paused = true,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ResumeCampaign :one
UPDATE campaigns
SET
    is_paused = false,
    updated_at = now()
WHERE id = $1
RETURNING *;
```

### Service Layer

Create `/backend/internal/service/campaign.go`:

```go
package service

import (
    "context"
    "database/sql"
    "encoding/json"
    "errors"
    "time"

    "github.com/google/uuid"
    "vanguard-pbp/internal/db/generated"
)

var (
    ErrCampaignLimitReached = errors.New("user has reached maximum campaign limit (5)")
    ErrNotGM                = errors.New("only the GM can perform this action")
    ErrCampaignNotFound     = errors.New("campaign not found")
    ErrInvalidSettings      = errors.New("invalid campaign settings")
)

type CampaignService struct {
    queries *generated.Queries
}

func NewCampaignService(queries *generated.Queries) *CampaignService {
    return &CampaignService{queries: queries}
}

type CreateCampaignRequest struct {
    Title       string                 `json:"title"`
    Description string                 `json:"description"`
    Settings    map[string]interface{} `json:"settings,omitempty"`
}

func (s *CampaignService) CreateCampaign(ctx context.Context, userID uuid.UUID, req CreateCampaignRequest) (*generated.Campaign, error) {
    // Check campaign limit
    count, err := s.queries.CountUserOwnedCampaigns(ctx, uuid.NullUUID{UUID: userID, Valid: true})
    if err != nil {
        return nil, err
    }
    if count >= 5 {
        return nil, ErrCampaignLimitReached
    }

    // Validate settings (use defaults if not provided)
    settings := defaultCampaignSettings()
    if req.Settings != nil {
        if err := validateSettings(req.Settings); err != nil {
            return nil, err
        }
        settings = req.Settings
    }

    settingsJSON, err := json.Marshal(settings)
    if err != nil {
        return nil, err
    }

    // Create campaign
    campaign, err := s.queries.CreateCampaign(ctx, generated.CreateCampaignParams{
        Title:       req.Title,
        Description: req.Description,
        OwnerID:     uuid.NullUUID{UUID: userID, Valid: true},
        Settings:    settingsJSON,
    })
    if err != nil {
        return nil, err
    }

    // Add creator as GM member
    _, err = s.queries.AddCampaignMember(ctx, generated.AddCampaignMemberParams{
        CampaignID: campaign.ID,
        UserID:     userID,
        Role:       "gm",
    })
    if err != nil {
        return nil, err
    }

    return &campaign, nil
}

func (s *CampaignService) GetCampaign(ctx context.Context, campaignID, userID uuid.UUID) (*generated.Campaign, error) {
    campaign, err := s.queries.GetCampaignWithMembership(ctx, generated.GetCampaignWithMembershipParams{
        ID:     campaignID,
        UserID: userID,
    })
    if err != nil {
        if errors.Is(err, sql.ErrNoRows) {
            return nil, ErrCampaignNotFound
        }
        return nil, err
    }
    return &campaign, nil
}

func (s *CampaignService) ListUserCampaigns(ctx context.Context, userID uuid.UUID) ([]generated.Campaign, error) {
    return s.queries.ListUserCampaigns(ctx, userID)
}

type UpdateCampaignRequest struct {
    Title       *string                 `json:"title,omitempty"`
    Description *string                 `json:"description,omitempty"`
    Settings    *map[string]interface{} `json:"settings,omitempty"`
}

func (s *CampaignService) UpdateCampaign(ctx context.Context, campaignID, userID uuid.UUID, req UpdateCampaignRequest) (*generated.Campaign, error) {
    // Verify user is GM
    campaign, err := s.GetCampaign(ctx, campaignID, userID)
    if err != nil {
        return nil, err
    }
    if !campaign.OwnerID.Valid || campaign.OwnerID.UUID != userID {
        return nil, ErrNotGM
    }

    var settingsJSON []byte
    if req.Settings != nil {
        if err := validateSettings(*req.Settings); err != nil {
            return nil, err
        }
        settingsJSON, err = json.Marshal(*req.Settings)
        if err != nil {
            return nil, err
        }
    }

    updated, err := s.queries.UpdateCampaign(ctx, generated.UpdateCampaignParams{
        ID:          campaignID,
        Title:       sql.NullString{String: *req.Title, Valid: req.Title != nil},
        Description: sql.NullString{String: *req.Description, Valid: req.Description != nil},
        Settings:    settingsJSON,
    })
    if err != nil {
        return nil, err
    }

    return &updated, nil
}

func (s *CampaignService) DeleteCampaign(ctx context.Context, campaignID, userID uuid.UUID) error {
    // Verify user is GM
    campaign, err := s.GetCampaign(ctx, campaignID, userID)
    if err != nil {
        return err
    }
    if !campaign.OwnerID.Valid || campaign.OwnerID.UUID != userID {
        return ErrNotGM
    }

    return s.queries.DeleteCampaign(ctx, campaignID)
}

func (s *CampaignService) PauseCampaign(ctx context.Context, campaignID, userID uuid.UUID) (*generated.Campaign, error) {
    // Verify user is GM
    campaign, err := s.GetCampaign(ctx, campaignID, userID)
    if err != nil {
        return nil, err
    }
    if !campaign.OwnerID.Valid || campaign.OwnerID.UUID != userID {
        return nil, ErrNotGM
    }

    paused, err := s.queries.PauseCampaign(ctx, campaignID)
    if err != nil {
        return nil, err
    }
    return &paused, nil
}

func (s *CampaignService) ResumeCampaign(ctx context.Context, campaignID, userID uuid.UUID) (*generated.Campaign, error) {
    // Verify user is GM
    campaign, err := s.GetCampaign(ctx, campaignID, userID)
    if err != nil {
        return nil, err
    }
    if !campaign.OwnerID.Valid || campaign.OwnerID.UUID != userID {
        return nil, ErrNotGM
    }

    resumed, err := s.queries.ResumeCampaign(ctx, campaignID)
    if err != nil {
        return nil, err
    }
    return &resumed, nil
}

// Helper functions

func defaultCampaignSettings() map[string]interface{} {
    return map[string]interface{}{
        "timeGatePreset":           "24h",
        "fogOfWar":                 true,
        "hiddenPosts":              true,
        "oocVisibility":            "gm_only",
        "characterLimit":           3000,
        "rollRequestTimeoutHours":  24,
        "systemPreset": map[string]interface{}{
            "name":     "D&D 5e",
            "intentions": []string{
                "Stealth", "Persuasion", "Intimidation", "Perception",
                "Investigation", "Athletics", "Acrobatics", "Arcana",
                "History", "Nature", "Religion", "Animal Handling",
                "Insight", "Medicine", "Survival", "Deception",
                "Performance", "Sleight of Hand",
            },
            "diceType": "d20",
        },
    }
}

func validateSettings(settings map[string]interface{}) error {
    // Validate time gate preset
    timeGate, ok := settings["timeGatePreset"].(string)
    if ok {
        validPresets := map[string]bool{"24h": true, "2d": true, "3d": true, "4d": true, "5d": true}
        if !validPresets[timeGate] {
            return ErrInvalidSettings
        }
    }

    // Validate character limit
    charLimit, ok := settings["characterLimit"].(float64)
    if ok {
        validLimits := map[int]bool{1000: true, 3000: true, 6000: true, 10000: true}
        if !validLimits[int(charLimit)] {
            return ErrInvalidSettings
        }
    }

    // Validate OOC visibility
    oocVis, ok := settings["oocVisibility"].(string)
    if ok {
        if oocVis != "all" && oocVis != "gm_only" {
            return ErrInvalidSettings
        }
    }

    return nil
}
```

### HTTP Handlers

Create `/backend/internal/api/handlers/campaigns.go`:

```go
package handlers

import (
    "net/http"

    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
    "vanguard-pbp/internal/service"
)

type CampaignHandler struct {
    service *service.CampaignService
}

func NewCampaignHandler(service *service.CampaignService) *CampaignHandler {
    return &CampaignHandler{service: service}
}

// POST /api/campaigns
func (h *CampaignHandler) CreateCampaign(c *gin.Context) {
    userID := c.MustGet("userID").(uuid.UUID)

    var req service.CreateCampaignRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "error": map[string]interface{}{
                "code":      "INVALID_REQUEST",
                "message":   "Invalid request format. Please check your input.",
                "timestamp": time.Now(),
            },
        })
        return
    }

    campaign, err := h.service.CreateCampaign(c.Request.Context(), userID, req)
    if err != nil {
        if errors.Is(err, service.ErrCampaignLimitReached) {
            c.JSON(http.StatusForbidden, gin.H{
                "error": map[string]interface{}{
                    "code":      "CAMPAIGN_LIMIT_REACHED",
                    "message":   "You've reached your campaign limit (5). Delete an existing campaign to create a new one.",
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

    c.JSON(http.StatusCreated, campaign)
}

// GET /api/campaigns
func (h *CampaignHandler) ListCampaigns(c *gin.Context) {
    userID := c.MustGet("userID").(uuid.UUID)

    campaigns, err := h.service.ListUserCampaigns(c.Request.Context(), userID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": map[string]interface{}{
                "code":      "INTERNAL_ERROR",
                "message":   "Something went wrong. Please try again.",
                "timestamp": time.Now(),
            },
        })
        return
    }

    c.JSON(http.StatusOK, campaigns)
}

// GET /api/campaigns/:id
func (h *CampaignHandler) GetCampaign(c *gin.Context) {
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

    campaign, err := h.service.GetCampaign(c.Request.Context(), campaignID, userID)
    if err != nil {
        if errors.Is(err, service.ErrCampaignNotFound) {
            c.JSON(http.StatusNotFound, gin.H{
                "error": map[string]interface{}{
                    "code":      "CAMPAIGN_NOT_FOUND",
                    "message":   "Campaign not found or you don't have access.",
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

// PATCH /api/campaigns/:id
func (h *CampaignHandler) UpdateCampaign(c *gin.Context) {
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

    var req service.UpdateCampaignRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "error": map[string]interface{}{
                "code":      "INVALID_REQUEST",
                "message":   "Invalid request format. Please check your input.",
                "timestamp": time.Now(),
            },
        })
        return
    }

    campaign, err := h.service.UpdateCampaign(c.Request.Context(), campaignID, userID, req)
    if err != nil {
        if errors.Is(err, service.ErrNotGM) {
            c.JSON(http.StatusForbidden, gin.H{
                "error": map[string]interface{}{
                    "code":      "FORBIDDEN",
                    "message":   "Only the GM can update campaign settings.",
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

// DELETE /api/campaigns/:id
func (h *CampaignHandler) DeleteCampaign(c *gin.Context) {
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

    var req struct {
        Confirmation string `json:"confirmation"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "error": map[string]interface{}{
                "code":      "INVALID_REQUEST",
                "message":   "Invalid request format. Please provide confirmation.",
                "timestamp": time.Now(),
            },
        })
        return
    }

    // Get campaign to verify title matches
    campaign, err := h.service.GetCampaign(c.Request.Context(), campaignID, userID)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{
            "error": map[string]interface{}{
                "code":      "CAMPAIGN_NOT_FOUND",
                "message":   "Campaign not found or you don't have access.",
                "timestamp": time.Now(),
            },
        })
        return
    }

    if req.Confirmation != campaign.Title {
        c.JSON(http.StatusBadRequest, gin.H{
            "error": map[string]interface{}{
                "code":      "CONFIRMATION_MISMATCH",
                "message":   "Campaign title doesn't match. Please type the exact campaign title to confirm deletion.",
                "timestamp": time.Now(),
            },
        })
        return
    }

    err = h.service.DeleteCampaign(c.Request.Context(), campaignID, userID)
    if err != nil {
        if errors.Is(err, service.ErrNotGM) {
            c.JSON(http.StatusForbidden, gin.H{
                "error": map[string]interface{}{
                    "code":      "FORBIDDEN",
                    "message":   "Only the GM can delete the campaign.",
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

    c.JSON(http.StatusOK, gin.H{"message": "Campaign deleted successfully"})
}

// POST /api/campaigns/:id/pause
func (h *CampaignHandler) PauseCampaign(c *gin.Context) {
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

    campaign, err := h.service.PauseCampaign(c.Request.Context(), campaignID, userID)
    if err != nil {
        if errors.Is(err, service.ErrNotGM) {
            c.JSON(http.StatusForbidden, gin.H{
                "error": map[string]interface{}{
                    "code":      "FORBIDDEN",
                    "message":   "Only the GM can pause the campaign.",
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

// POST /api/campaigns/:id/resume
func (h *CampaignHandler) ResumeCampaign(c *gin.Context) {
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

    campaign, err := h.service.ResumeCampaign(c.Request.Context(), campaignID, userID)
    if err != nil {
        if errors.Is(err, service.ErrNotGM) {
            c.JSON(http.StatusForbidden, gin.H{
                "error": map[string]interface{}{
                    "code":      "FORBIDDEN",
                    "message":   "Only the GM can resume the campaign.",
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
```

---

## Frontend Implementation

### Campaign List Component

Create `/frontend/src/components/campaign/CampaignList.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, Pause, Play } from 'lucide-react';
import { api } from '@/lib/api';
import { Campaign } from '@/types/generated';

export function CampaignList() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      const data = await api.get('/api/campaigns');
      setCampaigns(data);
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const userOwnedCount = campaigns.filter(c => c.user_role === 'gm').length;
  const canCreateCampaign = userOwnedCount < 5;

  if (loading) {
    return <div>Loading campaigns...</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Your Campaigns</h1>
        <Button
          onClick={() => navigate('/campaigns/new')}
          disabled={!canCreateCampaign}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          New Campaign
          {!canCreateCampaign && ' (Limit Reached)'}
        </Button>
      </div>

      {!canCreateCampaign && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800">
            You've reached your campaign limit (5). Delete an existing campaign to create a new one.
          </p>
        </div>
      )}

      <div className="grid gap-4">
        {campaigns.map((campaign) => (
          <Card
            key={campaign.id}
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => navigate(`/campaigns/${campaign.id}`)}
          >
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    {campaign.title}
                    {campaign.is_paused && (
                      <span className="text-sm font-normal text-muted-foreground flex items-center gap-1">
                        <Pause className="h-3 w-3" />
                        Paused
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>{campaign.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium px-2 py-1 rounded bg-secondary">
                    {campaign.user_role === 'gm' ? 'GM' : 'Player'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {campaign.current_phase === 'pc_phase' ? 'PC Phase' : 'GM Phase'}
                  </span>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}

        {campaigns.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No campaigns yet. Create your first campaign to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Create Campaign Form

Create `/frontend/src/components/campaign/CreateCampaignForm.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';

const createCampaignSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  description: z.string(),
});

type CreateCampaignForm = z.infer<typeof createCampaignSchema>;

export function CreateCampaignForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateCampaignForm>({
    resolver: zodResolver(createCampaignSchema),
    defaultValues: {
      title: '',
      description: '',
    },
  });

  const onSubmit = async (data: CreateCampaignForm) => {
    setIsSubmitting(true);
    try {
      const campaign = await api.post('/api/campaigns', data);
      toast({
        title: 'Campaign created',
        description: 'Your campaign has been created successfully.',
      });
      navigate(`/campaigns/${campaign.id}`);
    } catch (error: any) {
      if (error.response?.data?.error?.code === 'CAMPAIGN_LIMIT_REACHED') {
        toast({
          title: 'Campaign limit reached',
          description: error.response.data.error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to create campaign. Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <h1 className="text-3xl font-bold mb-6">Create Campaign</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Campaign Title</FormLabel>
                <FormControl>
                  <Input placeholder="Enter campaign title" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter campaign description (optional)"
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Campaign'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/campaigns')}>
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
```

---

## Edge Cases

### Campaign Limit
- **Scenario**: User attempts to create 6th campaign
- **Handling**: API returns 403 with clear message, UI shows disabled button with explanation
- **Test**: Create 5 campaigns, verify 6th is blocked

### Concurrent Creation
- **Scenario**: User opens multiple tabs and attempts to create campaigns simultaneously near limit
- **Handling**: Database transaction ensures atomic check-and-create, second request fails gracefully
- **Test**: Simulate concurrent requests at limit

### GM Deletion
- **Scenario**: GM deletes account while campaign is active
- **Handling**: `owner_id` becomes NULL, campaign enters paused state, first player can claim GM role
- **Test**: Delete GM account, verify campaign state, verify claimability

### Campaign Deletion
- **Scenario**: User types incorrect campaign title
- **Handling**: API rejects deletion, clear error message shown
- **Test**: Attempt deletion with wrong title, verify rejection

### Pause/Resume
- **Scenario**: Campaign paused during PC Phase
- **Handling**: Time gate freezes, timer pauses, players see "Paused" indicator
- **Test**: Pause during PC Phase, verify timer stops, resume and verify timer continues

---

## Testing Checklist

### Backend
- [ ] Create campaign with valid data
- [ ] Create campaign with invalid settings (wrong preset values)
- [ ] Create 5th campaign successfully
- [ ] Block 6th campaign creation
- [ ] Get campaign details as member
- [ ] Block campaign access for non-members
- [ ] Update campaign as GM
- [ ] Block update as non-GM
- [ ] Delete campaign with correct confirmation
- [ ] Block deletion with incorrect confirmation
- [ ] Block deletion as non-GM
- [ ] List user's campaigns (GM and player roles)
- [ ] Pause campaign as GM
- [ ] Resume campaign as GM
- [ ] Block pause/resume as non-GM

### Frontend
- [ ] Campaign list displays correctly
- [ ] Create button disabled at limit
- [ ] Warning shown at campaign limit
- [ ] Create form validation works
- [ ] Campaign created successfully
- [ ] Navigation to campaign after creation
- [ ] Error handling for API failures
- [ ] Paused campaigns show indicator
- [ ] Role badges display correctly (GM/Player)
- [ ] Phase state displays correctly

### Integration
- [ ] Campaign CRUD round-trip (create → read → update → delete)
- [ ] Campaign limit enforced across tabs
- [ ] Pause persists across page refresh
- [ ] Deleted campaigns removed from list immediately

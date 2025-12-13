# System Preset Configuration

## Overview

System presets define the list of available intentions and dice configuration for a campaign. Vanguard PBP supports D&D 5e, Pathfinder 2e, and custom presets with user-defined intentions.

## PRD References

- **Dice Rolling**: "D&D 5e preset, Pathfinder 2e preset, custom preset"
- **Technical**: "Intention list per preset, dice type per preset"

## Skill Reference

**dice-roller** - System preset configuration, intention management, dice type selection

## Database Schema

```sql
-- Campaigns table with dice system configuration
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gm_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,

  -- Dice system configuration
  dice_system_preset TEXT NOT NULL DEFAULT 'dnd5e'
    CHECK (dice_system_preset IN ('dnd5e', 'pf2e', 'custom')),

  dice_type TEXT NOT NULL DEFAULT 'd20'
    CHECK (dice_type IN ('d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100')),

  custom_intentions JSONB,  -- Array of intention strings for custom preset

  -- ... other fields ...
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Preset Definitions

### D&D 5e Preset

```go
// internal/dice/presets.go
package dice

var DND5eIntentions = []string{
    "Attack",
    "Damage",
    "Saving Throw",
    "Ability Check",
    "Initiative",
    "Death Save",
    "Skill Check",
    "Spell Attack",
}

var DND5eDiceType = "d20"
```

### Pathfinder 2e Preset

```go
var PF2eIntentions = []string{
    "Strike",
    "Damage",
    "Saving Throw",
    "Skill Check",
    "Perception Check",
    "Initiative",
    "Flat Check",
    "Spell Attack",
}

var PF2eDiceType = "d20"
```

### Custom Preset

```go
// Custom preset uses user-defined intentions from JSONB column
// Example custom_intentions:
// ["Investigate", "Fight", "Talk", "Sneak", "Magic"]
```

## Preset Service

```go
// internal/service/preset_service.go
package service

import (
    "context"
    "encoding/json"
    "errors"
    "github.com/google/uuid"
    "vanguard-pbp/internal/db"
    "vanguard-pbp/internal/dice"
)

type PresetService struct {
    queries *db.Queries
}

type SystemPreset struct {
    Name        string   `json:"name"`
    Intentions  []string `json:"intentions"`
    DiceType    string   `json:"dice_type"`
}

func (s *PresetService) GetAvailablePresets() []SystemPreset {
    return []SystemPreset{
        {
            Name:       "dnd5e",
            Intentions: dice.DND5eIntentions,
            DiceType:   dice.DND5eDiceType,
        },
        {
            Name:       "pf2e",
            Intentions: dice.PF2eIntentions,
            DiceType:   dice.PF2eDiceType,
        },
        {
            Name:       "custom",
            Intentions: []string{},  // User-defined
            DiceType:   "d20",       // User-configurable
        },
    }
}

func (s *PresetService) GetCampaignPreset(ctx context.Context, campaignID uuid.UUID) (*SystemPreset, error) {
    campaign, err := s.queries.GetCampaign(ctx, campaignID)
    if err != nil {
        return nil, err
    }

    var intentions []string

    switch campaign.DiceSystemPreset {
    case "dnd5e":
        intentions = dice.DND5eIntentions
    case "pf2e":
        intentions = dice.PF2eIntentions
    case "custom":
        if campaign.CustomIntentions != nil {
            err := json.Unmarshal(campaign.CustomIntentions, &intentions)
            if err != nil {
                return nil, err
            }
        } else {
            intentions = []string{}
        }
    default:
        return nil, errors.New("invalid dice system preset")
    }

    return &SystemPreset{
        Name:       campaign.DiceSystemPreset,
        Intentions: intentions,
        DiceType:   campaign.DiceType,
    }, nil
}

type SetPresetRequest struct {
    CampaignID        uuid.UUID `json:"campaign_id"`
    Preset            string    `json:"preset"`          // "dnd5e", "pf2e", "custom"
    CustomIntentions  []string  `json:"custom_intentions,omitempty"`
    DiceType          string    `json:"dice_type"`       // "d4", "d6", ..., "d20", "d100"
}

func (s *PresetService) SetCampaignPreset(ctx context.Context, req SetPresetRequest) error {
    // Verify user is GM
    userID := getUserIDFromContext(ctx)
    isGM, err := s.queries.IsUserGMOfCampaign(ctx, userID, req.CampaignID)
    if err != nil || !isGM {
        return errors.New("unauthorized: only GM can configure dice system")
    }

    // Validate preset
    if req.Preset != "dnd5e" && req.Preset != "pf2e" && req.Preset != "custom" {
        return errors.New("invalid preset")
    }

    // Validate dice type
    validDice := map[string]bool{
        "d4": true, "d6": true, "d8": true, "d10": true,
        "d12": true, "d20": true, "d100": true,
    }
    if !validDice[req.DiceType] {
        return errors.New("invalid dice type")
    }

    // Prepare custom intentions
    var customIntentionsJSON []byte
    if req.Preset == "custom" {
        if len(req.CustomIntentions) == 0 {
            return errors.New("custom preset requires at least one intention")
        }

        // Validate custom intentions
        for _, intention := range req.CustomIntentions {
            if len(intention) == 0 || len(intention) > 100 {
                return errors.New("intentions must be 1-100 characters")
            }
        }

        customIntentionsJSON, err = json.Marshal(req.CustomIntentions)
        if err != nil {
            return err
        }
    }

    // Update campaign
    err = s.queries.SetCampaignDiceSystem(ctx, db.SetCampaignDiceSystemParams{
        ID:                req.CampaignID,
        DiceSystemPreset:  req.Preset,
        DiceType:          req.DiceType,
        CustomIntentions:  customIntentionsJSON,
    })
    if err != nil {
        return err
    }

    return nil
}
```

## SQL Queries

```sql
-- name: SetCampaignDiceSystem :exec
UPDATE campaigns
SET
  dice_system_preset = $2,
  dice_type = $3,
  custom_intentions = $4,
  updated_at = now()
WHERE id = $1;

-- name: GetCampaignDiceSystem :one
SELECT
  dice_system_preset,
  dice_type,
  custom_intentions
FROM campaigns
WHERE id = $1;
```

## API Handlers

```go
// internal/handler/preset_handler.go
package handler

import (
    "net/http"
    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
    "vanguard-pbp/internal/service"
)

type PresetHandler struct {
    presetService *service.PresetService
}

func (h *PresetHandler) GetAvailablePresets(c *gin.Context) {
    presets := h.presetService.GetAvailablePresets()
    c.JSON(http.StatusOK, gin.H{"presets": presets})
}

func (h *PresetHandler) GetCampaignPreset(c *gin.Context) {
    campaignID, err := uuid.Parse(c.Param("campaign_id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid campaign ID"})
        return
    }

    preset, err := h.presetService.GetCampaignPreset(c.Request.Context(), campaignID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, preset)
}

func (h *PresetHandler) SetCampaignPreset(c *gin.Context) {
    var req service.SetPresetRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    err := h.presetService.SetCampaignPreset(c.Request.Context(), req)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "dice system updated"})
}
```

## React UI Components

### Preset Configuration (GM Settings)

```tsx
// src/components/DiceSystemConfig.tsx
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X } from 'lucide-react';

interface DiceSystemConfigProps {
  campaignId: string;
}

export function DiceSystemConfig({ campaignId }: DiceSystemConfigProps) {
  const queryClient = useQueryClient();

  // Get available presets
  const { data: availablePresets } = useQuery({
    queryKey: ['dice-presets'],
    queryFn: fetchAvailablePresets,
  });

  // Get current campaign preset
  const { data: currentPreset } = useQuery({
    queryKey: ['campaign-preset', campaignId],
    queryFn: () => fetchCampaignPreset(campaignId),
  });

  const [preset, setPreset] = useState('dnd5e');
  const [diceType, setDiceType] = useState('d20');
  const [customIntentions, setCustomIntentions] = useState<string[]>([]);

  useEffect(() => {
    if (currentPreset) {
      setPreset(currentPreset.name);
      setDiceType(currentPreset.dice_type);
      if (currentPreset.name === 'custom') {
        setCustomIntentions(currentPreset.intentions || []);
      }
    }
  }, [currentPreset]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/dice-system`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          campaign_id: campaignId,
          preset,
          dice_type: diceType,
          custom_intentions: preset === 'custom' ? customIntentions : undefined,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-preset', campaignId] });
    },
  });

  const handleAddIntention = () => {
    setCustomIntentions([...customIntentions, '']);
  };

  const handleRemoveIntention = (index: number) => {
    setCustomIntentions(customIntentions.filter((_, i) => i !== index));
  };

  const handleUpdateIntention = (index: number, value: string) => {
    const updated = [...customIntentions];
    updated[index] = value;
    setCustomIntentions(updated);
  };

  const selectedPresetData = availablePresets?.presets?.find(
    (p: any) => p.name === preset
  );

  return (
    <div className="space-y-6">
      <div>
        <Label>Game System</Label>
        <Select value={preset} onValueChange={setPreset}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dnd5e">D&D 5th Edition</SelectItem>
            <SelectItem value="pf2e">Pathfinder 2nd Edition</SelectItem>
            <SelectItem value="custom">Custom System</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Dice Type</Label>
        <Select value={diceType} onValueChange={setDiceType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="d4">d4</SelectItem>
            <SelectItem value="d6">d6</SelectItem>
            <SelectItem value="d8">d8</SelectItem>
            <SelectItem value="d10">d10</SelectItem>
            <SelectItem value="d12">d12</SelectItem>
            <SelectItem value="d20">d20</SelectItem>
            <SelectItem value="d100">d100</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Show preset intentions or custom editor */}
      {preset !== 'custom' ? (
        <div>
          <Label>Available Intentions</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedPresetData?.intentions?.map((intention: string) => (
              <div
                key={intention}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
              >
                {intention}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <Label>Custom Intentions</Label>
          <div className="mt-2 space-y-2">
            {customIntentions.map((intention, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={intention}
                  onChange={(e) => handleUpdateIntention(index, e.target.value)}
                  placeholder="Intention name"
                  maxLength={100}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveIntention(index)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={handleAddIntention}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Intention
            </Button>
          </div>
        </div>
      )}

      <Button
        onClick={() => updateMutation.mutate()}
        disabled={updateMutation.isPending}
      >
        {updateMutation.isPending ? 'Saving...' : 'Save Dice System'}
      </Button>
    </div>
  );
}

async function fetchAvailablePresets() {
  const res = await fetch('/api/dice-systems/presets');
  if (!res.ok) throw new Error('Failed to fetch presets');
  return res.json();
}

async function fetchCampaignPreset(campaignId: string) {
  const res = await fetch(`/api/campaigns/${campaignId}/dice-system`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Failed to fetch campaign preset');
  return res.json();
}

function getToken(): string {
  return localStorage.getItem('auth_token') || '';
}
```

### Intention Selector (Player Use)

```tsx
// src/components/IntentionSelector.tsx
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface IntentionSelectorProps {
  campaignId: string;
  value: string;
  onChange: (value: string) => void;
}

export function IntentionSelector({ campaignId, value, onChange }: IntentionSelectorProps) {
  const { data: preset } = useQuery({
    queryKey: ['campaign-preset', campaignId],
    queryFn: () => fetchCampaignPreset(campaignId),
  });

  if (!preset || !preset.intentions || preset.intentions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">What are you trying to do?</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select intention..." />
        </SelectTrigger>
        <SelectContent>
          {preset.intentions.map((intention: string) => (
            <SelectItem key={intention} value={intention}>
              {intention}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

async function fetchCampaignPreset(campaignId: string) {
  const res = await fetch(`/api/campaigns/${campaignId}/dice-system`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Failed to fetch campaign preset');
  return res.json();
}

function getToken(): string {
  return localStorage.getItem('auth_token') || '';
}
```

## Edge Cases

### 1. Changing Preset Mid-Campaign

**Scenario**: Campaign switches from D&D 5e to Custom mid-game.

**Handling**: Existing rolls preserve their intentions. New rolls use new preset.

```go
// Rolls store intention as TEXT, not foreign key
// Changing preset doesn't invalidate existing rolls
```

### 2. Empty Custom Intentions

**Scenario**: GM creates custom preset with no intentions.

**Handling**: Validation rejects empty custom intention list.

```go
if req.Preset == "custom" && len(req.CustomIntentions) == 0 {
    return errors.New("custom preset requires at least one intention")
}
```

### 3. Duplicate Intentions

**Scenario**: Custom preset has duplicate intention names.

**Handling**: Allow duplicates (GM might have use case).

```go
// No deduplication - allow duplicates
// GM can create "Attack (melee)" and "Attack (ranged)" if desired
```

### 4. Very Long Intention Names

**Scenario**: Custom intention is 500 characters long.

**Handling**: Validate max length 100 characters.

```go
for _, intention := range req.CustomIntentions {
    if len(intention) > 100 {
        return errors.New("intentions must be 1-100 characters")
    }
}
```

### 5. Invalid Dice Type

**Scenario**: Request specifies "d7" or invalid dice type.

**Handling**: Validation rejects invalid dice types.

```go
validDice := map[string]bool{
    "d4": true, "d6": true, "d8": true, "d10": true,
    "d12": true, "d20": true, "d100": true,
}
if !validDice[req.DiceType] {
    return errors.New("invalid dice type")
}
```

### 6. Preset Change During Pending Roll

**Scenario**: Player has pending roll with "Attack", GM changes preset removing "Attack".

**Handling**: Pending roll preserves original intention (stored as TEXT).

```sql
-- Roll stores intention directly, not reference to preset
CREATE TABLE rolls (
  intention TEXT NOT NULL,  -- Preserves value even if preset changes
  -- ...
);
```

## Testing Checklist

### Unit Tests

- [ ] Preset retrieval
  - [ ] D&D 5e returns correct intentions
  - [ ] PF2e returns correct intentions
  - [ ] Custom returns user-defined intentions

- [ ] Preset configuration
  - [ ] GM can set preset
  - [ ] Non-GM cannot set preset
  - [ ] Invalid preset rejected
  - [ ] Invalid dice type rejected
  - [ ] Empty custom intentions rejected

- [ ] Intention validation
  - [ ] Max length enforced (100 chars)
  - [ ] Empty string rejected
  - [ ] Special characters allowed

### Integration Tests

- [ ] Campaign creation sets default preset (D&D 5e)
- [ ] Changing preset updates campaign
- [ ] Custom intentions persist correctly
- [ ] Preset change doesn't affect existing rolls

### E2E Tests

- [ ] GM opens settings → sees current preset
- [ ] GM selects PF2e → intentions update
- [ ] GM selects Custom → can add intentions
- [ ] Player sees intention dropdown with campaign presets
- [ ] Player creates roll → intention saved

## Verification Steps

1. **Create campaign** → verify default D&D 5e preset
2. **Open GM settings** → verify intentions list shown
3. **Change to PF2e** → verify intentions updated
4. **Change to Custom** → verify can add intentions
5. **Add custom intentions** ("Investigate", "Fight", "Talk")
6. **Save custom preset** → verify persisted
7. **Player opens post composer** → verify sees custom intentions
8. **Change dice type to d10** → verify saved
9. **Switch back to D&D 5e** → verify custom intentions cleared

## API Documentation

### GET /api/dice-systems/presets

Get all available preset configurations.

**Response**:
```json
{
  "presets": [
    {
      "name": "dnd5e",
      "intentions": ["Attack", "Damage", "Saving Throw", ...],
      "dice_type": "d20"
    },
    {
      "name": "pf2e",
      "intentions": ["Strike", "Damage", "Saving Throw", ...],
      "dice_type": "d20"
    },
    {
      "name": "custom",
      "intentions": [],
      "dice_type": "d20"
    }
  ]
}
```

### GET /api/campaigns/:campaign_id/dice-system

Get campaign's current dice system configuration.

**Response**:
```json
{
  "name": "dnd5e",
  "intentions": ["Attack", "Damage", "Saving Throw", ...],
  "dice_type": "d20"
}
```

**Response (Custom)**:
```json
{
  "name": "custom",
  "intentions": ["Investigate", "Fight", "Talk", "Sneak"],
  "dice_type": "d20"
}
```

### PUT /api/campaigns/:campaign_id/dice-system

Update campaign dice system configuration (GM only).

**Request**:
```json
{
  "campaign_id": "uuid",
  "preset": "custom",
  "dice_type": "d20",
  "custom_intentions": ["Investigate", "Fight", "Talk", "Sneak"]
}
```

**Response**:
```json
{
  "message": "dice system updated"
}
```

## Performance Considerations

### Caching Presets

```go
// Cache static presets (D&D 5e, PF2e) aggressively
var presetCache = map[string]SystemPreset{
    "dnd5e": {
        Name:       "dnd5e",
        Intentions: dice.DND5eIntentions,
        DiceType:   "d20",
    },
    "pf2e": {
        Name:       "pf2e",
        Intentions: dice.PF2eIntentions,
        DiceType:   "d20",
    },
}

// Only query database for custom presets
```

### JSONB Indexing

```sql
-- GIN index for custom intentions queries (if needed)
CREATE INDEX idx_campaigns_custom_intentions
ON campaigns USING GIN(custom_intentions);
```

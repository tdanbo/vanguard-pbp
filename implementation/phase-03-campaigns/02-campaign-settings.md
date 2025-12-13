# Campaign Settings Management

## Overview

Campaign settings control gameplay behavior including time gates, visibility rules, character limits, and system presets. Settings are configured at campaign creation and can be updated by the GM.

## PRD References

- [Settings](/home/tobiasd/github/vanguard-pbp/prd/settings.md) - All campaign settings, defaults, validation rules
- [Technical](/home/tobiasd/github/vanguard-pbp/prd/technical.md) - Settings data model, validation

## Skills

- **go-api-server**: Settings validation, update handlers
- **supabase-integration**: JSONB settings storage
- **shadcn-react**: Settings form with validation

---

## Settings Structure

### Campaign Settings JSONB

```typescript
interface CampaignSettings {
  timeGatePreset: '24h' | '2d' | '3d' | '4d' | '5d';  // Default: '24h'
  fogOfWar: boolean;                                   // Default: true
  hiddenPosts: boolean;                                // Default: true
  oocVisibility: 'all' | 'gm_only';                    // Default: 'gm_only'
  characterLimit: 1000 | 3000 | 6000 | 10000;          // Default: 3000
  rollRequestTimeoutHours: number;                     // Default: 24
  systemPreset: SystemPreset;
}

interface SystemPreset {
  name: string;              // e.g., "D&D 5e", "Pathfinder 2e", "Custom"
  intentions: string[];      // Available skill/action list
  diceType: 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';
}
```

### Default System Presets

```go
// backend/internal/service/presets.go
package service

type SystemPreset struct {
    Name       string   `json:"name"`
    Intentions []string `json:"intentions"`
    DiceType   string   `json:"diceType"`
}

var DefaultSystemPresets = map[string]SystemPreset{
    "dnd5e": {
        Name:     "D&D 5e",
        DiceType: "d20",
        Intentions: []string{
            "Acrobatics", "Animal Handling", "Arcana", "Athletics",
            "Deception", "History", "Insight", "Intimidation",
            "Investigation", "Medicine", "Nature", "Perception",
            "Performance", "Persuasion", "Religion", "Sleight of Hand",
            "Stealth", "Survival",
        },
    },
    "pathfinder2e": {
        Name:     "Pathfinder 2e",
        DiceType: "d20",
        Intentions: []string{
            "Acrobatics", "Arcana", "Athletics", "Crafting",
            "Deception", "Diplomacy", "Intimidation", "Lore",
            "Medicine", "Nature", "Occultism", "Performance",
            "Religion", "Society", "Stealth", "Survival",
            "Thievery",
        },
    },
    "custom": {
        Name:       "Custom",
        DiceType:   "d20",
        Intentions: []string{},
    },
}
```

---

## Backend Implementation

### Settings Validation

Extend `/backend/internal/service/campaign.go`:

```go
package service

import (
    "encoding/json"
    "errors"
)

var ErrInvalidSettings = errors.New("invalid campaign settings")

// Validate campaign settings
func validateSettings(settings map[string]interface{}) error {
    // Time gate preset
    timeGate, ok := settings["timeGatePreset"].(string)
    if ok {
        validPresets := map[string]bool{
            "24h": true,
            "2d":  true,
            "3d":  true,
            "4d":  true,
            "5d":  true,
        }
        if !validPresets[timeGate] {
            return errors.New("invalid timeGatePreset: must be one of 24h, 2d, 3d, 4d, 5d")
        }
    }

    // Character limit
    charLimit, ok := settings["characterLimit"].(float64)
    if ok {
        validLimits := map[int]bool{
            1000:  true,
            3000:  true,
            6000:  true,
            10000: true,
        }
        if !validLimits[int(charLimit)] {
            return errors.New("invalid characterLimit: must be one of 1000, 3000, 6000, 10000")
        }
    }

    // OOC visibility
    oocVis, ok := settings["oocVisibility"].(string)
    if ok && oocVis != "all" && oocVis != "gm_only" {
        return errors.New("invalid oocVisibility: must be 'all' or 'gm_only'")
    }

    // Fog of war (boolean check)
    if fog, ok := settings["fogOfWar"]; ok {
        if _, isBool := fog.(bool); !isBool {
            return errors.New("fogOfWar must be a boolean")
        }
    }

    // Hidden posts (boolean check)
    if hidden, ok := settings["hiddenPosts"]; ok {
        if _, isBool := hidden.(bool); !isBool {
            return errors.New("hiddenPosts must be a boolean")
        }
    }

    // System preset
    if preset, ok := settings["systemPreset"].(map[string]interface{}); ok {
        if err := validateSystemPreset(preset); err != nil {
            return err
        }
    }

    return nil
}

func validateSystemPreset(preset map[string]interface{}) error {
    // Name is required
    name, ok := preset["name"].(string)
    if !ok || name == "" {
        return errors.New("systemPreset.name is required")
    }

    // Dice type validation
    diceType, ok := preset["diceType"].(string)
    if ok {
        validDice := map[string]bool{
            "d4": true, "d6": true, "d8": true, "d10": true,
            "d12": true, "d20": true, "d100": true,
        }
        if !validDice[diceType] {
            return errors.New("invalid diceType: must be one of d4, d6, d8, d10, d12, d20, d100")
        }
    }

    // Intentions must be string array
    if intentions, ok := preset["intentions"]; ok {
        intentSlice, ok := intentions.([]interface{})
        if !ok {
            return errors.New("systemPreset.intentions must be an array")
        }
        for i, intent := range intentSlice {
            if _, ok := intent.(string); !ok {
                return errors.New("systemPreset.intentions[" + string(rune(i)) + "] must be a string")
            }
        }
    }

    return nil
}

// Get time gate duration in hours
func getTimeGateDuration(preset string) int {
    durations := map[string]int{
        "24h": 24,
        "2d":  48,
        "3d":  72,
        "4d":  96,
        "5d":  120,
    }
    return durations[preset]
}
```

### Settings Update Handler

Add to `/backend/internal/api/handlers/campaigns.go`:

```go
// PATCH /api/campaigns/:id/settings
func (h *CampaignHandler) UpdateSettings(c *gin.Context) {
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

    var settings map[string]interface{}
    if err := c.ShouldBindJSON(&settings); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "error": map[string]interface{}{
                "code":      "INVALID_REQUEST",
                "message":   "Invalid settings format. Please check your input.",
                "timestamp": time.Now(),
            },
        })
        return
    }

    // Validate settings
    if err := validateSettings(settings); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "error": map[string]interface{}{
                "code":      "INVALID_SETTINGS",
                "message":   err.Error(),
                "timestamp": time.Now(),
            },
        })
        return
    }

    // Update campaign
    req := service.UpdateCampaignRequest{
        Settings: &settings,
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
```

---

## Frontend Implementation

### Settings Form Component

Create `/frontend/src/components/campaign/SettingsForm.tsx`:

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import { Campaign, CampaignSettings } from '@/types/generated';

const settingsSchema = z.object({
  timeGatePreset: z.enum(['24h', '2d', '3d', '4d', '5d']),
  fogOfWar: z.boolean(),
  hiddenPosts: z.boolean(),
  oocVisibility: z.enum(['all', 'gm_only']),
  characterLimit: z.enum(['1000', '3000', '6000', '10000']).transform(Number),
  systemPreset: z.object({
    name: z.string(),
    intentions: z.array(z.string()),
    diceType: z.enum(['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']),
  }),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

interface SettingsFormProps {
  campaign: Campaign;
  onUpdate: (campaign: Campaign) => void;
}

export function SettingsForm({ campaign, onUpdate }: SettingsFormProps) {
  const { toast } = useToast();
  const settings = campaign.settings as CampaignSettings;

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      timeGatePreset: settings.timeGatePreset,
      fogOfWar: settings.fogOfWar,
      hiddenPosts: settings.hiddenPosts,
      oocVisibility: settings.oocVisibility,
      characterLimit: settings.characterLimit,
      systemPreset: settings.systemPreset,
    },
  });

  const onSubmit = async (data: SettingsFormData) => {
    try {
      const updated = await api.patch(`/api/campaigns/${campaign.id}/settings`, data);
      onUpdate(updated);
      toast({
        title: 'Settings updated',
        description: 'Campaign settings have been saved successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error?.message || 'Failed to update settings.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Time Gate Preset */}
        <FormField
          control={form.control}
          name="timeGatePreset"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Time Gate Duration</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="24h">24 hours (Committed pace)</SelectItem>
                  <SelectItem value="2d">2 days (Active game)</SelectItem>
                  <SelectItem value="3d">3 days (Standard pace)</SelectItem>
                  <SelectItem value="4d">4 days (Relaxed pace)</SelectItem>
                  <SelectItem value="5d">5 days (Casual pace)</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                How long players have to post before auto-pass triggers
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Fog of War */}
        <FormField
          control={form.control}
          name="fogOfWar"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Fog of War</FormLabel>
                <FormDescription>
                  Characters only see scenes where they've witnessed at least one post
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Hidden Posts */}
        <FormField
          control={form.control}
          name="hiddenPosts"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Hidden Posts</FormLabel>
                <FormDescription>
                  Allow players to make secret posts only visible to GM
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        {/* OOC Visibility */}
        <FormField
          control={form.control}
          name="oocVisibility"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Out-of-Character (OOC) Visibility</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="gm_only">GM Only</SelectItem>
                  <SelectItem value="all">All Players</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Who can see OOC text on posts
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Character Limit */}
        <FormField
          control={form.control}
          name="characterLimit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Character Limit (per post)</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value.toString()}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select limit" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="1000">1,000 characters (Brief)</SelectItem>
                  <SelectItem value="3000">3,000 characters (Standard)</SelectItem>
                  <SelectItem value="6000">6,000 characters (Detailed)</SelectItem>
                  <SelectItem value="10000">10,000 characters (Epic)</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Maximum characters allowed in each post
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* System Preset */}
        <FormField
          control={form.control}
          name="systemPreset.name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Game System</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select system" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="D&D 5e">D&D 5e</SelectItem>
                  <SelectItem value="Pathfinder 2e">Pathfinder 2e</SelectItem>
                  <SelectItem value="Custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Game system for intent-based dice rolling
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit">Save Settings</Button>
      </form>
    </Form>
  );
}
```

### Settings Display Component

Create `/frontend/src/components/campaign/SettingsDisplay.tsx`:

```tsx
import { Campaign, CampaignSettings } from '@/types/generated';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';

interface SettingsDisplayProps {
  campaign: Campaign;
}

export function SettingsDisplay({ campaign }: SettingsDisplayProps) {
  const settings = campaign.settings as CampaignSettings;

  const timeGateLabels = {
    '24h': '24 hours',
    '2d': '2 days',
    '3d': '3 days',
    '4d': '4 days',
    '5d': '5 days',
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Timing</CardTitle>
          <CardDescription>Phase and turn timing settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium">Time Gate:</span>
              <span className="text-sm">{timeGateLabels[settings.timeGatePreset]}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Visibility</CardTitle>
          <CardDescription>Information visibility rules</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Fog of War:</span>
              {settings.fogOfWar ? (
                <Badge variant="default"><Check className="h-3 w-3 mr-1" />Enabled</Badge>
              ) : (
                <Badge variant="secondary"><X className="h-3 w-3 mr-1" />Disabled</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Hidden Posts:</span>
              {settings.hiddenPosts ? (
                <Badge variant="default"><Check className="h-3 w-3 mr-1" />Enabled</Badge>
              ) : (
                <Badge variant="secondary"><X className="h-3 w-3 mr-1" />Disabled</Badge>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">OOC Visibility:</span>
              <span className="text-sm">
                {settings.oocVisibility === 'all' ? 'All Players' : 'GM Only'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Content</CardTitle>
          <CardDescription>Post and content limits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium">Character Limit:</span>
              <span className="text-sm">{settings.characterLimit.toLocaleString()} chars</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System</CardTitle>
          <CardDescription>Game system configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium">Game System:</span>
              <span className="text-sm">{settings.systemPreset.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Dice Type:</span>
              <span className="text-sm">{settings.systemPreset.diceType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Intentions:</span>
              <span className="text-sm">{settings.systemPreset.intentions.length} skills</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Edge Cases

### Mid-Campaign Setting Changes
- **Scenario**: GM changes time gate from 24h to 5d mid-phase
- **Handling**: New setting applies to next phase, current phase uses old duration
- **Test**: Change setting during PC Phase, verify current phase unaffected

### Character Limit Reduction
- **Scenario**: GM reduces character limit from 6000 to 1000, existing posts exceed limit
- **Handling**: Existing posts grandfathered (no retroactive enforcement), new posts use new limit
- **Test**: Create long post, reduce limit, verify old post visible, new post enforced

### System Preset Change
- **Scenario**: GM changes from D&D 5e to Pathfinder 2e
- **Handling**: New intent list available immediately, old posts retain their intent tags
- **Test**: Change system, verify new intents available, old posts unchanged

### Fog of War Toggle Mid-Game
- **Scenario**: GM disables Fog of War after 10 scenes created
- **Handling**: All scenes immediately visible to all players, witness history preserved
- **Test**: Toggle fog of war, verify visibility changes immediately

---

## Testing Checklist

### Backend
- [ ] Validate time gate presets (accept valid, reject invalid)
- [ ] Validate character limits (accept 1000/3000/6000/10000, reject others)
- [ ] Validate OOC visibility (accept all/gm_only, reject others)
- [ ] Validate boolean fields (fogOfWar, hiddenPosts)
- [ ] Validate system preset structure
- [ ] Validate dice type (accept d4-d100, reject others)
- [ ] Update settings as GM successfully
- [ ] Block settings update as non-GM
- [ ] Reject malformed JSONB
- [ ] Preserve unmodified settings fields

### Frontend
- [ ] Settings form populates with current values
- [ ] All dropdown options display correctly
- [ ] Toggle switches work correctly
- [ ] Form validation prevents invalid input
- [ ] Success toast on save
- [ ] Error toast on failure
- [ ] Settings display shows all current values
- [ ] Settings update reflects immediately in UI

### Integration
- [ ] Settings persist across page refresh
- [ ] Settings changes visible to all campaign members
- [ ] Time gate change affects next phase correctly
- [ ] Character limit enforced on new posts
- [ ] System preset change updates intent dropdown

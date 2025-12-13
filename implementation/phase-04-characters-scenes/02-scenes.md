# Scene Management

## Overview

Scenes are narrative containers limited to 25 per campaign. GM can add/remove characters during GM Phase. Characters can only be in one scene at a time.

## PRD References

- [Settings](/home/tobiasd/github/vanguard-pbp/prd/settings.md) - Scene limits, auto-deletion
- [Turn Structure](/home/tobiasd/github/vanguard-pbp/prd/turn-structure.md) - GM Phase character movement

## Database Schema

```sql
CREATE TABLE scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (length(title) >= 1 AND length(title) <= 200),
    description TEXT NOT NULL DEFAULT '',
    header_image_url TEXT,
    characters JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Character IDs currently in scene
    pass_states JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Per-character pass state
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scenes_campaign ON scenes(campaign_id);
CREATE INDEX idx_scenes_status ON scenes(campaign_id, status);
```

## Backend Service

```go
// internal/service/scene.go
func (s *SceneService) CreateScene(ctx context.Context, campaignID, gmUserID uuid.UUID, req CreateSceneRequest) (*generated.Scene, error) {
    // Verify GM
    campaign, err := s.queries.GetCampaign(ctx, campaignID)
    if err != nil {
        return nil, err
    }
    if !campaign.OwnerID.Valid || campaign.OwnerID.UUID != gmUserID {
        return nil, ErrNotGM
    }

    // Check scene count
    count, err := s.queries.CountCampaignScenes(ctx, campaignID)
    if err != nil {
        return nil, err
    }

    // Warn at thresholds
    if count >= 20 && count < 25 {
        // Send warning notification
    }

    // Handle auto-deletion at 26th scene
    if count >= 25 {
        // Find oldest archived scene
        oldest, err := s.queries.GetOldestArchivedScene(ctx, campaignID)
        if err != nil && !errors.Is(err, sql.ErrNoRows) {
            return nil, err
        }
        if oldest != nil {
            // Delete oldest archived
            err = s.queries.DeleteScene(ctx, oldest.ID)
            if err != nil {
                return nil, err
            }
        } else {
            return nil, errors.New("scene limit reached (25 max), no archived scenes to delete")
        }
    }

    // Create scene
    scene, err := s.queries.CreateScene(ctx, generated.CreateSceneParams{
        CampaignID:  campaignID,
        Title:       req.Title,
        Description: req.Description,
    })
    if err != nil {
        return nil, err
    }

    // Increment campaign scene count
    err = s.queries.IncrementSceneCount(ctx, campaignID)
    if err != nil {
        return nil, err
    }

    return &scene, nil
}

func (s *SceneService) AddCharacterToScene(ctx context.Context, sceneID, characterID, gmUserID uuid.UUID) error {
    // Verify GM Phase
    scene, err := s.queries.GetScene(ctx, sceneID)
    if err != nil {
        return err
    }

    campaign, err := s.queries.GetCampaign(ctx, scene.CampaignID)
    if err != nil {
        return err
    }

    if campaign.CurrentPhase != "gm_phase" {
        return errors.New("characters can only be moved during GM Phase")
    }

    // Remove character from other scenes (single-scene constraint)
    err = s.queries.RemoveCharacterFromAllScenes(ctx, generated.RemoveCharacterFromAllScenesParams{
        CampaignID:  scene.CampaignID,
        CharacterID: characterID,
    })
    if err != nil {
        return err
    }

    // Add to this scene
    return s.queries.AddCharacterToScene(ctx, generated.AddCharacterToSceneParams{
        SceneID:     sceneID,
        CharacterID: characterID,
    })
}
```

## Frontend Component

```tsx
// components/scene/SceneManager.tsx
export function SceneManager({ campaignId, isGm, currentPhase }: SceneManagerProps) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const sceneCount = scenes.length;

  const getWarningMessage = () => {
    if (sceneCount === 20) return 'You have 20 of 25 scenes';
    if (sceneCount === 23) return 'Approaching scene limit (23/25)';
    if (sceneCount === 24) return 'Nearly at scene limit (24/25)';
    if (sceneCount === 25) return 'At scene limit. Next scene will delete oldest archived.';
    return null;
  };

  return (
    <div className="space-y-4">
      {getWarningMessage() && (
        <Alert variant={sceneCount === 25 ? 'destructive' : 'warning'}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Scene Limit</AlertTitle>
          <AlertDescription>{getWarningMessage()}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4">
        {scenes.map(scene => (
          <SceneCard
            key={scene.id}
            scene={scene}
            isGm={isGm}
            canMoveCharacters={currentPhase === 'gm_phase'}
          />
        ))}
      </div>
    </div>
  );
}
```

## Edge Cases

- **26th Scene Creation**: Oldest archived scene auto-deleted, GM notified which scene was removed
- **No Archived Scenes**: If creating 26th scene with no archived scenes, creation fails with error
- **Character Movement**: Only during GM Phase. Blocked during PC Phase.
- **Single Scene Constraint**: Adding character to scene B auto-removes from scene A

## Testing

- [ ] Create scene as GM
- [ ] Block create as player
- [ ] Create 25 scenes successfully
- [ ] Warning displayed at 20, 23, 24
- [ ] 26th scene auto-deletes oldest archived
- [ ] Block 26th if no archived scenes
- [ ] Add character to scene (GM Phase)
- [ ] Block add during PC Phase
- [ ] Character removed from old scene when added to new
- [ ] Archive scene
- [ ] Delete scene (frees storage)

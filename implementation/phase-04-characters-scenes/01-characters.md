# Character Management

## Overview

Characters are campaign-owned entities created by the GM and assigned to users. Characters can be PCs or NPCs, archived (but never deleted), and reassigned between users.

## PRD References

- [Technical](/home/tobiasd/github/vanguard-pbp/prd/technical.md) - Character model, assignment model
- [Scope](/home/tobiasd/github/vanguard-pbp/prd/scope.md) - Multi-character support

## Database Schema

```sql
CREATE TABLE characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL CHECK (length(display_name) >= 1 AND length(display_name) <= 100),
    description TEXT NOT NULL DEFAULT '',
    avatar_url TEXT,
    character_type TEXT NOT NULL CHECK (character_type IN ('pc', 'npc')),
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE character_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(character_id)  -- One user per character at a time
);

CREATE INDEX idx_characters_campaign ON characters(campaign_id);
CREATE INDEX idx_character_assignments_character ON character_assignments(character_id);
CREATE INDEX idx_character_assignments_user ON character_assignments(user_id);
```

## Backend Service

```go
// internal/service/character.go
func (s *CharacterService) CreateCharacter(ctx context.Context, campaignID, gmUserID uuid.UUID, req CreateCharacterRequest) (*generated.Character, error) {
    // Verify GM
    campaign, err := s.queries.GetCampaign(ctx, campaignID)
    if err != nil {
        return nil, err
    }
    if !campaign.OwnerID.Valid || campaign.OwnerID.UUID != gmUserID {
        return nil, ErrNotGM
    }

    // Create character
    char, err := s.queries.CreateCharacter(ctx, generated.CreateCharacterParams{
        CampaignID:    campaignID,
        DisplayName:   req.DisplayName,
        Description:   req.Description,
        CharacterType: req.CharacterType,
    })
    if err != nil {
        return nil, err
    }

    // Assign to user if provided
    if req.AssignToUserID != nil {
        _, err = s.queries.AssignCharacter(ctx, generated.AssignCharacterParams{
            CharacterID: char.ID,
            UserID:      *req.AssignToUserID,
        })
        if err != nil {
            return nil, err
        }
    }

    return &char, nil
}

func (s *CharacterService) ReassignCharacter(ctx context.Context, characterID, gmUserID, newUserID uuid.UUID) error {
    // Verify GM
    char, err := s.queries.GetCharacter(ctx, characterID)
    if err != nil {
        return err
    }

    campaign, err := s.queries.GetCampaign(ctx, char.CampaignID)
    if err != nil {
        return err
    }

    if !campaign.OwnerID.Valid || campaign.OwnerID.UUID != gmUserID {
        return ErrNotGM
    }

    // Remove old assignment
    err = s.queries.UnassignCharacter(ctx, characterID)
    if err != nil && !errors.Is(err, sql.ErrNoRows) {
        return err
    }

    // Create new assignment
    _, err = s.queries.AssignCharacter(ctx, generated.AssignCharacterParams{
        CharacterID: characterID,
        UserID:      newUserID,
    })
    return err
}
```

## Frontend Component

```tsx
// components/character/CharacterManager.tsx
export function CharacterManager({ campaignId, isGm }: CharacterManagerProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  const visibleCharacters = characters.filter(c =>
    showArchived || !c.is_archived
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Characters</h2>
        {isGm && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Character
          </Button>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          checked={showArchived}
          onCheckedChange={setShowArchived}
        />
        <Label>Show archived characters</Label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visibleCharacters.map(character => (
          <CharacterCard
            key={character.id}
            character={character}
            isGm={isGm}
            onEdit={() => editCharacter(character)}
            onArchive={() => archiveCharacter(character.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

## Edge Cases

- **Delete vs Archive**: Characters CANNOT be deleted (preserve post relationships). Only archivable.
- **Orphaned Characters**: When player leaves, characters become orphaned (no assignment). GM can reassign.
- **Multi-Character**: One user can control multiple characters. Each has separate pass state.
- **Archived Visibility**: Archived characters hidden from players, visible (greyed out) to GM.

## Testing

- [ ] Create character as GM
- [ ] Block create as player
- [ ] Assign character to user
- [ ] Reassign orphaned character
- [ ] Archive character
- [ ] Verify archived character in old posts still visible
- [ ] Multi-character assignment works
- [ ] Character type (PC/NPC) can be changed

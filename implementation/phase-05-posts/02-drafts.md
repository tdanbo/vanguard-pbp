# Draft Persistence

## Overview

Server-side draft storage ensures cross-device sync and preserves work during timeouts. Drafts auto-save on typing with debouncing.

## PRD References

- [Turn Structure](/home/tobiasd/github/vanguard-pbp/prd/turn-structure.md) - Draft lifecycle
- [Technical](/home/tobiasd/github/vanguard-pbp/prd/technical.md) - Post model (submitted: false = draft)

## Draft Storage

Drafts are posts with `submitted: false`:

```sql
-- Draft is a regular post row with submitted=false
SELECT * FROM posts
WHERE scene_id = $1
  AND character_id = $2
  AND submitted = false
  AND user_id = $3
LIMIT 1;
```

## Backend Service

```go
// internal/service/draft.go
func (s *DraftService) SaveDraft(ctx context.Context, sceneID, characterID, userID uuid.UUID, content DraftContent) (*generated.Post, error) {
    // Verify compose lock held
    session, err := s.queries.GetComposeLock(ctx, generated.GetComposeLockParams{
        SceneID:     sceneID,
        CharacterID: characterID,
    })
    if err != nil {
        return nil, errors.New("you must hold the compose lock to save drafts")
    }
    if session.UserID != userID {
        return nil, errors.New("not your lock")
    }

    // Get existing draft
    existing, err := s.queries.GetDraft(ctx, generated.GetDraftParams{
        SceneID:     sceneID,
        CharacterID: characterID,
        UserID:      userID,
    })

    blocksJSON, _ := json.Marshal(content.Blocks)

    if err != nil {
        // Create new draft
        draft, err := s.queries.CreatePost(ctx, generated.CreatePostParams{
            SceneID:     sceneID,
            CharacterID: uuid.NullUUID{UUID: characterID, Valid: true},
            UserID:      userID,
            Blocks:      blocksJSON,
            OocText:     sql.NullString{String: content.OocText, Valid: content.OocText != ""},
            Submitted:   false,  // Draft flag
        })
        return &draft, err
    }

    // Update existing draft
    updated, err := s.queries.UpdateDraft(ctx, generated.UpdateDraftParams{
        ID:      existing.ID,
        Blocks:  blocksJSON,
        OocText: sql.NullString{String: content.OocText, Valid: content.OocText != ""},
    })
    return &updated, err
}

func (s *DraftService) GetDraft(ctx context.Context, sceneID, characterID, userID uuid.UUID) (*generated.Post, error) {
    draft, err := s.queries.GetDraft(ctx, generated.GetDraftParams{
        SceneID:     sceneID,
        CharacterID: characterID,
        UserID:      userID,
    })
    if err != nil && errors.Is(err, sql.ErrNoRows) {
        return nil, nil  // No draft exists
    }
    return &draft, err
}

func (s *DraftService) DeleteDraft(ctx context.Context, draftID, userID uuid.UUID) error {
    draft, err := s.queries.GetPost(ctx, draftID)
    if err != nil {
        return err
    }

    if draft.UserID != userID {
        return errors.New("not your draft")
    }

    return s.queries.DeletePost(ctx, draftID)
}
```

## Frontend Hook

```tsx
// hooks/use-draft.ts
export function useDraft(sceneId: string, characterId: string) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load draft on mount
  useEffect(() => {
    loadDraft();
  }, [sceneId, characterId]);

  const loadDraft = async () => {
    try {
      const data = await api.get(`/api/scenes/${sceneId}/drafts/${characterId}`);
      setDraft(data);
    } catch (error) {
      // No draft exists
      setDraft(null);
    }
  };

  const saveDraft = useDebouncedCallback(async (content: DraftContent) => {
    setSaving(true);
    try {
      const saved = await api.post(`/api/scenes/${sceneId}/drafts`, {
        characterId,
        ...content,
      });
      setDraft(saved);
    } catch (error) {
      console.error('Failed to save draft:', error);
      toast({
        title: 'Draft save failed',
        description: 'Your changes may not be saved.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, 2000); // 2-second debounce

  const deleteDraft = async () => {
    if (!draft) return;

    try {
      await api.delete(`/api/posts/${draft.id}`);
      setDraft(null);
    } catch (error) {
      console.error('Failed to delete draft:', error);
    }
  };

  return {
    draft,
    saving,
    saveDraft,
    deleteDraft,
    loadDraft,
  };
}
```

## Auto-Save Component

```tsx
// components/post/PostComposer.tsx
export function PostComposer({ sceneId, characterId }: PostComposerProps) {
  const { session, hasLock } = useComposeLock(sceneId, characterId);
  const { draft, saving, saveDraft, deleteDraft } = useDraft(sceneId, characterId);
  const [blocks, setBlocks] = useState<PostBlock[]>(draft?.blocks || []);
  const [oocText, setOocText] = useState(draft?.ooc_text || '');

  // Auto-save on content change
  useEffect(() => {
    if (hasLock) {
      saveDraft({ blocks, oocText });
    }
  }, [blocks, oocText, hasLock]);

  return (
    <div className="space-y-4">
      {saving && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving draft...
        </div>
      )}

      <BlockEditor
        blocks={blocks}
        onChange={setBlocks}
        disabled={!hasLock}
      />

      <Textarea
        placeholder="Out-of-character notes (optional)"
        value={oocText}
        onChange={(e) => setOocText(e.target.value)}
        disabled={!hasLock}
      />

      <Button onClick={submitPost} disabled={!hasLock || blocks.length === 0}>
        Submit Post
      </Button>
    </div>
  );
}
```

## Cross-Device Sync

Drafts sync automatically via real-time subscriptions:

```typescript
// Subscribe to draft changes
supabase
  .channel(`draft:${sceneId}:${characterId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'posts',
    filter: `scene_id=eq.${sceneId} AND character_id=eq.${characterId} AND submitted=eq.false`,
  }, (payload) => {
    setDraft(payload.new);
  })
  .subscribe();
```

## Edge Cases

- **Lock Timeout**: Draft persists even if lock expires. Player can re-acquire and continue.
- **Multiple Tabs**: Same draft syncs across tabs via real-time subscription.
- **Network Disconnection**: Draft saves queued, retried on reconnect.
- **Draft Cleanup**: Draft deleted when post submitted successfully.

## Testing

- [ ] Draft auto-saves on typing (2s debounce)
- [ ] Draft persists after lock timeout
- [ ] Draft loads on page refresh
- [ ] Draft syncs across tabs
- [ ] Draft deleted on post submission
- [ ] Saving indicator displays correctly
- [ ] Cannot save draft without lock
- [ ] Draft content updates in real-time

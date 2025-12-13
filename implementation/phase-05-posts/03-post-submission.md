# Post Submission

## Overview

Post submission validates content, assigns witnesses, locks previous post, and handles both regular and hidden posts.

## PRD References

- [Turn Structure](/home/tobiasd/github/vanguard-pbp/prd/turn-structure.md) - Posting rules, post locking
- [Settings](/home/tobiasd/github/vanguard-pbp/prd/settings.md) - Character limits, hidden posts, OOC visibility
- [Technical](/home/tobiasd/github/vanguard-pbp/prd/technical.md) - Post model, witness selection

## Backend Service

```go
// internal/service/post.go
func (s *PostService) SubmitPost(ctx context.Context, req SubmitPostRequest) (*generated.Post, error) {
    // Get draft
    draft, err := s.queries.GetPost(ctx, req.DraftID)
    if err != nil {
        return nil, err
    }

    // Verify ownership
    if draft.UserID != req.UserID {
        return nil, errors.New("not your post")
    }

    // Verify compose lock held
    session, err := s.queries.GetComposeLock(ctx, generated.GetComposeLockParams{
        SceneID:     draft.SceneID,
        CharacterID: draft.CharacterID.UUID,
    })
    if err != nil {
        return nil, errors.New("you must hold the compose lock to submit posts")
    }
    if session.UserID != req.UserID {
        return nil, errors.New("not your lock")
    }

    // Validate blocks
    var blocks []PostBlock
    if err := json.Unmarshal(draft.Blocks, &blocks); err != nil {
        return nil, err
    }
    if len(blocks) == 0 {
        return nil, errors.New("post must have at least one block (action or dialog)")
    }

    // Validate character limit
    totalChars := 0
    for _, block := range blocks {
        totalChars += len(block.Content)
    }

    scene, err := s.queries.GetScene(ctx, draft.SceneID)
    if err != nil {
        return nil, err
    }
    campaign, err := s.queries.GetCampaign(ctx, scene.CampaignID)
    if err != nil {
        return nil, err
    }

    settings := campaign.Settings.(map[string]interface{})
    charLimit := int(settings["characterLimit"].(float64))
    if totalChars > charLimit {
        return nil, fmt.Errorf("post exceeds character limit (%d / %d)", totalChars, charLimit)
    }

    // Calculate witnesses
    witnesses := []uuid.UUID{}
    if !req.IsHidden {
        // Add all characters currently in scene
        witnesses = scene.Characters
    }
    // If hidden: empty witnesses array

    witnessesJSON, _ := json.Marshal(witnesses)

    // Lock previous post (if exists)
    prevPost, err := s.queries.GetLastScenePost(ctx, draft.SceneID)
    if err == nil && prevPost != nil {
        err = s.queries.LockPost(ctx, generated.LockPostParams{
            ID:       prevPost.ID,
            LockedAt: sql.NullTime{Time: time.Now(), Valid: true},
        })
        if err != nil {
            return nil, err
        }
    }

    // Mark post as submitted
    submitted, err := s.queries.SubmitPost(ctx, generated.SubmitPostParams{
        ID:        draft.ID,
        Submitted: true,
        Witnesses: witnessesJSON,
    })
    if err != nil {
        return nil, err
    }

    // Release compose lock
    err = s.queries.DeleteComposeLock(ctx, session.ID)
    if err != nil {
        return nil, err
    }

    // Clear character's pass state (auto-clear on post)
    err = s.queries.UpdateCharacterPassState(ctx, generated.UpdateCharacterPassStateParams{
        SceneID:     draft.SceneID,
        CharacterID: draft.CharacterID.UUID,
        PassState:   "none",
    })
    if err != nil {
        return nil, err
    }

    return &submitted, nil
}

func (s *PostService) EditPost(ctx context.Context, postID, userID uuid.UUID, req EditPostRequest) (*generated.Post, error) {
    post, err := s.queries.GetPost(ctx, postID)
    if err != nil {
        return nil, err
    }

    // Check if locked
    if post.IsLocked {
        // Only GM can edit locked posts
        scene, err := s.queries.GetScene(ctx, post.SceneID)
        if err != nil {
            return nil, err
        }
        campaign, err := s.queries.GetCampaign(ctx, scene.CampaignID)
        if err != nil {
            return nil, err
        }

        isGM := campaign.OwnerID.Valid && campaign.OwnerID.UUID == userID
        if !isGM {
            return nil, errors.New("post is locked (only GM can edit)")
        }

        // Mark as edited by GM
        req.EditedByGM = true
    } else {
        // Unlocked post: only owner can edit
        if post.UserID != userID {
            return nil, errors.New("not your post")
        }
    }

    blocksJSON, _ := json.Marshal(req.Blocks)

    updated, err := s.queries.UpdatePost(ctx, generated.UpdatePostParams{
        ID:         postID,
        Blocks:     blocksJSON,
        OocText:    sql.NullString{String: req.OocText, Valid: req.OocText != ""},
        EditedByGM: req.EditedByGM,
    })
    if err != nil {
        return nil, err
    }

    return &updated, nil
}
```

## Frontend Component

```tsx
// components/post/SubmitButton.tsx
export function SubmitButton({ draft, onSubmit }: SubmitButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit({ draftId: draft.id, isHidden });
      toast({ title: 'Post submitted!', description: 'Your post is now visible.' });
    } catch (error: any) {
      if (error.response?.data?.error?.code === 'CHARACTER_LIMIT_EXCEEDED') {
        toast({
          title: 'Too long',
          description: error.response.data.error.message,
          variant: 'destructive',
        });
      } else if (error.response?.data?.error?.code === 'EMPTY_POST') {
        toast({
          title: 'Empty post',
          description: 'Add at least one action or dialog block.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      {/* Hidden post toggle (if enabled in campaign) */}
      <div className="flex items-center space-x-2">
        <Switch
          id="hidden"
          checked={isHidden}
          onCheckedChange={setIsHidden}
        />
        <Label htmlFor="hidden">Hidden post (GM only)</Label>
      </div>

      <Button onClick={handleSubmit} disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Submit Post'}
      </Button>
    </div>
  );
}
```

## Post Block Editor

```tsx
// components/post/BlockEditor.tsx
export function BlockEditor({ blocks, onChange, characterLimit }: BlockEditorProps) {
  const addBlock = (type: 'action' | 'dialog') => {
    onChange([...blocks, { type, content: '', order: blocks.length }]);
  };

  const updateBlock = (index: number, content: string) => {
    const updated = [...blocks];
    updated[index].content = content;
    onChange(updated);
  };

  const removeBlock = (index: number) => {
    onChange(blocks.filter((_, i) => i !== index));
  };

  const totalChars = blocks.reduce((sum, b) => sum + b.content.length, 0);
  const isOverLimit = totalChars > characterLimit;

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => (
        <div key={index} className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={block.type === 'action' ? 'default' : 'secondary'}>
              {block.type === 'action' ? 'Action' : 'Dialog'}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeBlock(index)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          <Textarea
            value={block.content}
            onChange={(e) => updateBlock(index, e.target.value)}
            placeholder={
              block.type === 'action'
                ? 'Describe what your character does...'
                : 'What does your character say?'
            }
            rows={4}
          />
        </div>
      ))}

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => addBlock('action')}>
            + Action
          </Button>
          <Button variant="outline" size="sm" onClick={() => addBlock('dialog')}>
            + Dialog
          </Button>
        </div>

        <p className={cn(
          'text-sm',
          isOverLimit ? 'text-destructive font-medium' : 'text-muted-foreground'
        )}>
          {totalChars.toLocaleString()} / {characterLimit.toLocaleString()}
        </p>
      </div>

      {isOverLimit && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Post exceeds character limit. Remove some content to submit.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
```

## Edge Cases

- **Empty Post**: Submission blocked if no blocks exist
- **Character Limit**: Enforced server-side, UI shows real-time count
- **Hidden Post Indicator**: Generic "Another player is posting" during lock hold
- **Post Locking**: Previous post locks when new post submitted
- **GM Edit Badge**: Shows "Edited by GM" if GM modifies locked post
- **OOC Visibility**: Controlled by campaign setting (all/gm_only)

## Testing

- [ ] Submit post with action block
- [ ] Submit post with dialog block
- [ ] Block empty post submission
- [ ] Character limit enforced
- [ ] Hidden post creates empty witnesses
- [ ] Previous post locks on submission
- [ ] Pass state clears on post
- [ ] Compose lock releases on submission
- [ ] Edit own unlocked post
- [ ] Block edit locked post (non-GM)
- [ ] GM edit any post
- [ ] GM edit badge displays
- [ ] OOC text visibility based on setting

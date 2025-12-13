# GM Moderation Tools

## Overview

Implement GM moderation capabilities that allow Game Masters to edit and delete posts, force-release compose locks, and manage character types. These tools maintain game integrity while respecting certain immutability constraints.

## PRD References

- **prd/core-concepts.md**: GM moderation powers, identity protection
- **prd/turn-structure.md**: Phase constraints, compose locks
- **prd/scope.md**: GM capabilities and limitations

## Skills

- **go-api-server**: GM-only API endpoints
- **shadcn-react**: GM moderation UI components
- **compose-lock**: Lock override functionality
- **visibility-filter**: Post visibility in GM context

## Database Schema

### Audit Log for GM Actions

```sql
CREATE TABLE gm_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    gm_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL, -- 'edit_post', 'delete_post', 'force_unlock', 'promote_character', 'demote_character'
    target_type TEXT NOT NULL, -- 'post', 'compose_lock', 'character'
    target_id UUID NOT NULL,
    before_state JSONB,
    after_state JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gm_audit_log_campaign ON gm_audit_log(campaign_id, created_at DESC);
CREATE INDEX idx_gm_audit_log_gm ON gm_audit_log(gm_user_id, created_at DESC);
CREATE INDEX idx_gm_audit_log_target ON gm_audit_log(target_type, target_id);

-- Add GM edit tracking to posts
ALTER TABLE posts ADD COLUMN edited_by_gm BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE posts ADD COLUMN gm_edit_reason TEXT;
ALTER TABLE posts ADD COLUMN gm_edited_at TIMESTAMPTZ;
```

## GM Post Editing

### Backend Service

```go
// services/gm_moderation_service.go
type GMModerationService struct {
    db           *sqlc.Queries
    postService  *PostService
    auditService *AuditLogService
}

type EditPostAsGMParams struct {
    PostID      uuid.UUID
    Content     string
    Reason      string
    GMID        uuid.UUID
}

func (s *GMModerationService) EditPostAsGM(
    ctx context.Context,
    params EditPostAsGMParams,
) (*models.Post, error) {
    // Get original post
    original, err := s.db.GetPost(ctx, params.PostID)
    if err != nil {
        return nil, fmt.Errorf("post not found: %w", err)
    }

    // Verify GM is campaign GM
    campaign, err := s.db.GetCampaign(ctx, original.CampaignID)
    if err != nil {
        return nil, err
    }

    if campaign.GMID != params.GMID {
        return nil, fmt.Errorf("only campaign GM can edit posts")
    }

    // Store original state for audit
    beforeState := map[string]interface{}{
        "content":       original.Content,
        "edited_by_gm":  original.EditedByGM,
        "gm_edit_reason": original.GMEditReason,
    }

    // Update post
    updated, err := s.db.UpdatePostAsGM(ctx, sqlc.UpdatePostAsGMParams{
        ID:            params.PostID,
        Content:       params.Content,
        EditedByGM:    true,
        GMEditReason:  &params.Reason,
        GMEditedAt:    timePtr(time.Now()),
    })
    if err != nil {
        return nil, fmt.Errorf("failed to update post: %w", err)
    }

    // Create audit log entry
    afterState := map[string]interface{}{
        "content":       updated.Content,
        "edited_by_gm":  true,
        "gm_edit_reason": params.Reason,
    }

    err = s.auditService.LogGMAction(ctx, services.GMActionParams{
        CampaignID:  original.CampaignID,
        GMUserID:    params.GMID,
        ActionType:  "edit_post",
        TargetType:  "post",
        TargetID:    params.PostID,
        BeforeState: beforeState,
        AfterState:  afterState,
        Reason:      params.Reason,
    })
    if err != nil {
        log.Printf("failed to create audit log: %v", err)
    }

    // Broadcast update
    go s.postService.BroadcastPostUpdated(ctx, updated)

    return updated, nil
}
```

### API Endpoint

```go
// handlers/gm_moderation_handler.go
type EditPostAsGMRequest struct {
    Content string `json:"content" binding:"required,min=1,max=10000"`
    Reason  string `json:"reason" binding:"required,min=1,max=500"`
}

func (h *GMModerationHandler) EditPostAsGM(c *gin.Context) {
    userID := getUserID(c)
    postID := c.Param("post_id")

    var req EditPostAsGMRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
        return
    }

    postUUID, err := uuid.Parse(postID)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid post_id"})
        return
    }

    post, err := h.service.EditPostAsGM(c.Request.Context(), services.EditPostAsGMParams{
        PostID:  postUUID,
        Content: req.Content,
        Reason:  req.Reason,
        GMID:    userID,
    })
    if err != nil {
        c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, post)
}
```

### Frontend Component

```typescript
// components/gm/EditPostDialog.tsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface EditPostDialogProps {
  post: Post;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditPostDialog({ post, open, onOpenChange }: EditPostDialogProps) {
  const [content, setContent] = useState(post.content);
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  const editMutation = useMutation({
    mutationFn: (data: { content: string; reason: string }) =>
      editPostAsGM(post.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['post', post.id]);
      queryClient.invalidateQueries(['scene-posts', post.scene_id]);
      toast.success('Post updated');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update post');
    },
  });

  const handleSubmit = () => {
    if (!content.trim() || !reason.trim()) {
      toast.error('Content and reason are required');
      return;
    }

    editMutation.mutate({ content, reason });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Post as GM</DialogTitle>
          <DialogDescription>
            Edit this post. An "Edited by GM" badge will be visible to all players.
            This action will be logged in the audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="content">Post Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              className="mt-2"
            />
            <p className="text-sm text-muted-foreground mt-1">
              {content.length} / 10,000 characters
            </p>
          </div>

          <div>
            <Label htmlFor="reason">Reason for Edit</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-2"
              placeholder="Explain why you're editing this post..."
            />
            <p className="text-sm text-muted-foreground mt-1">
              Visible in audit log only
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={editMutation.isPending}
          >
            {editMutation.isPending ? 'Updating...' : 'Update Post'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### GM Edit Badge

```typescript
// components/posts/PostHeader.tsx
export function PostHeader({ post }: { post: Post }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar>
        <AvatarImage src={post.character.avatar_url} />
        <AvatarFallback>{post.character.name[0]}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <p className="font-semibold">{post.character.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatRelativeTime(post.created_at)}
        </p>
      </div>
      {post.edited_by_gm && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="text-orange-600 border-orange-600">
                Edited by GM
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>This post was edited by the Game Master</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(post.gm_edited_at)}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
```

## GM Post Deletion

### Backend Service

```go
func (s *GMModerationService) DeletePostAsGM(
    ctx context.Context,
    postID uuid.UUID,
    gmID uuid.UUID,
    reason string,
) error {
    // Get post
    post, err := s.db.GetPost(ctx, postID)
    if err != nil {
        return fmt.Errorf("post not found: %w", err)
    }

    // Verify GM
    campaign, err := s.db.GetCampaign(ctx, post.CampaignID)
    if err != nil {
        return err
    }

    if campaign.GMID != gmID {
        return fmt.Errorf("only campaign GM can delete posts")
    }

    // Get scene
    scene, err := s.db.GetScene(ctx, post.SceneID)
    if err != nil {
        return err
    }

    // Store state for audit
    beforeState := map[string]interface{}{
        "content":       post.Content,
        "character_id":  post.CharacterID,
        "scene_id":      post.SceneID,
        "is_hidden":     post.IsHidden,
        "witness_list":  post.WitnessList,
    }

    // Check if this is the locked post
    if scene.LockedPostID != nil && *scene.LockedPostID == postID {
        // Find previous post to unlock
        previousPost, err := s.db.GetPreviousPost(ctx, sqlc.GetPreviousPostParams{
            SceneID:   post.SceneID,
            CreatedAt: post.CreatedAt,
        })

        if err == nil && previousPost != nil {
            // Unlock previous post
            _, err = s.db.UpdateSceneLockedPost(ctx, sqlc.UpdateSceneLockedPostParams{
                ID:           scene.ID,
                LockedPostID: &previousPost.ID,
            })
            if err != nil {
                log.Printf("failed to unlock previous post: %v", err)
            }
        } else {
            // No previous post, clear lock
            _, err = s.db.UpdateSceneLockedPost(ctx, sqlc.UpdateSceneLockedPostParams{
                ID:           scene.ID,
                LockedPostID: nil,
            })
            if err != nil {
                log.Printf("failed to clear locked post: %v", err)
            }
        }
    }

    // Delete post
    err = s.db.DeletePost(ctx, postID)
    if err != nil {
        return fmt.Errorf("failed to delete post: %w", err)
    }

    // Audit log
    err = s.auditService.LogGMAction(ctx, services.GMActionParams{
        CampaignID:  post.CampaignID,
        GMUserID:    gmID,
        ActionType:  "delete_post",
        TargetType:  "post",
        TargetID:    postID,
        BeforeState: beforeState,
        AfterState:  map[string]interface{}{"deleted": true},
        Reason:      reason,
    })
    if err != nil {
        log.Printf("failed to create audit log: %v", err)
    }

    // Broadcast deletion
    go s.postService.BroadcastPostDeleted(ctx, post)

    return nil
}
```

### API Endpoint

```go
func (h *GMModerationHandler) DeletePostAsGM(c *gin.Context) {
    userID := getUserID(c)
    postID := c.Param("post_id")

    var req struct {
        Reason string `json:"reason" binding:"required,min=1,max=500"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "reason required"})
        return
    }

    postUUID, err := uuid.Parse(postID)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid post_id"})
        return
    }

    err = h.service.DeletePostAsGM(c.Request.Context(), postUUID, userID, req.Reason)
    if err != nil {
        c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, gin.H{"success": true})
}
```

## Force Release Compose Lock

### Backend Service

```go
func (s *GMModerationService) ForceReleaseComposeLock(
    ctx context.Context,
    sceneID uuid.UUID,
    gmID uuid.UUID,
    reason string,
) error {
    // Get scene
    scene, err := s.db.GetScene(ctx, sceneID)
    if err != nil {
        return fmt.Errorf("scene not found: %w", err)
    }

    // Verify GM
    campaign, err := s.db.GetCampaign(ctx, scene.CampaignID)
    if err != nil {
        return err
    }

    if campaign.GMID != gmID {
        return fmt.Errorf("only campaign GM can force-release locks")
    }

    // Get current lock
    lock, err := s.db.GetComposeLock(ctx, sceneID)
    if err != nil {
        return fmt.Errorf("no active lock: %w", err)
    }

    // Store state for audit
    beforeState := map[string]interface{}{
        "character_id": lock.CharacterID,
        "acquired_at":  lock.AcquiredAt,
    }

    // Release lock
    err = s.db.DeleteComposeLock(ctx, sceneID)
    if err != nil {
        return fmt.Errorf("failed to release lock: %w", err)
    }

    // Audit log
    err = s.auditService.LogGMAction(ctx, services.GMActionParams{
        CampaignID:  scene.CampaignID,
        GMUserID:    gmID,
        ActionType:  "force_unlock",
        TargetType:  "compose_lock",
        TargetID:    sceneID,
        BeforeState: beforeState,
        AfterState:  map[string]interface{}{"released": true},
        Reason:      reason,
    })
    if err != nil {
        log.Printf("failed to create audit log: %v", err)
    }

    // Broadcast lock release
    go s.broadcastComposeLockReleased(ctx, scene)

    // Notify lock holder
    go s.notifyLockForceReleased(ctx, lock, reason)

    return nil
}
```

### Frontend Component

```typescript
// components/gm/ForceReleaseLockButton.tsx
export function ForceReleaseLockButton({ scene }: { scene: Scene }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  const releaseMutation = useMutation({
    mutationFn: (reason: string) => forceReleaseComposeLock(scene.id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries(['compose-lock', scene.id]);
      toast.success('Compose lock released');
      setDialogOpen(false);
      setReason('');
    },
  });

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setDialogOpen(true)}
      >
        Force Release Lock
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Force Release Compose Lock</DialogTitle>
            <DialogDescription>
              This will immediately release the compose lock, allowing another
              player to compose. The current lock holder will be notified.
            </DialogDescription>
          </DialogHeader>

          <div>
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Why are you releasing this lock?"
              className="mt-2"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => releaseMutation.mutate(reason)}
              disabled={!reason.trim() || releaseMutation.isPending}
            >
              Release Lock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

## Character Type Promotion/Demotion

### Backend Service

```go
func (s *GMModerationService) ChangeCharacterType(
    ctx context.Context,
    characterID uuid.UUID,
    newType string, // 'pc' or 'npc'
    gmID uuid.UUID,
    reason string,
) (*models.Character, error) {
    // Validate character type
    if newType != "pc" && newType != "npc" {
        return nil, fmt.Errorf("invalid character type: %s", newType)
    }

    // Get character
    char, err := s.db.GetCharacter(ctx, characterID)
    if err != nil {
        return nil, fmt.Errorf("character not found: %w", err)
    }

    // Verify GM
    campaign, err := s.db.GetCampaign(ctx, char.CampaignID)
    if err != nil {
        return nil, err
    }

    if campaign.GMID != gmID {
        return nil, fmt.Errorf("only campaign GM can change character types")
    }

    // Can only change during GM Phase
    if campaign.CurrentPhase != "gm_phase" {
        return nil, fmt.Errorf("can only change character types during GM Phase")
    }

    // Store state for audit
    beforeState := map[string]interface{}{
        "character_type": char.CharacterType,
    }

    // Update character type
    updated, err := s.db.UpdateCharacterType(ctx, sqlc.UpdateCharacterTypeParams{
        ID:            characterID,
        CharacterType: newType,
    })
    if err != nil {
        return nil, fmt.Errorf("failed to update character type: %w", err)
    }

    // Audit log
    actionType := "promote_character"
    if newType == "npc" {
        actionType = "demote_character"
    }

    err = s.auditService.LogGMAction(ctx, services.GMActionParams{
        CampaignID:  char.CampaignID,
        GMUserID:    gmID,
        ActionType:  actionType,
        TargetType:  "character",
        TargetID:    characterID,
        BeforeState: beforeState,
        AfterState:  map[string]interface{}{"character_type": newType},
        Reason:      reason,
    })
    if err != nil {
        log.Printf("failed to create audit log: %v", err)
    }

    // Notify character owner
    go s.notifyCharacterTypeChanged(ctx, updated, char.CharacterType, reason)

    return updated, nil
}
```

## Immutability Constraints

### Cannot Edit Roll Results

```go
func (s *GMModerationService) EditPostAsGM(
    ctx context.Context,
    params EditPostAsGMParams,
) (*models.Post, error) {
    // Get original post
    original, err := s.db.GetPost(ctx, params.PostID)
    if err != nil {
        return nil, fmt.Errorf("post not found: %w", err)
    }

    // Check if post has executed rolls
    rolls, err := s.db.GetPostRolls(ctx, params.PostID)
    if err != nil {
        return nil, err
    }

    for _, roll := range rolls {
        if roll.Status == "executed" {
            return nil, fmt.Errorf("cannot edit posts with executed rolls")
        }
    }

    // Continue with edit...
}
```

### Cannot Change Witness Lists Retroactively

```go
// GMs cannot change witness_list after post creation
// Exception: Can unhide posts (make witness_list empty)

func (s *GMModerationService) UnhidePost(
    ctx context.Context,
    postID uuid.UUID,
    gmID uuid.UUID,
    reason string,
) (*models.Post, error) {
    post, err := s.db.GetPost(ctx, postID)
    if err != nil {
        return nil, err
    }

    if !post.IsHidden {
        return nil, fmt.Errorf("post is not hidden")
    }

    // Verify GM
    campaign, err := s.db.GetCampaign(ctx, post.CampaignID)
    if err != nil {
        return nil, err
    }

    if campaign.GMID != gmID {
        return nil, fmt.Errorf("only campaign GM can unhide posts")
    }

    // Unhide post
    updated, err := s.db.UnhidePost(ctx, postID)
    if err != nil {
        return nil, err
    }

    // Audit log
    err = s.auditService.LogGMAction(ctx, services.GMActionParams{
        CampaignID:  post.CampaignID,
        GMUserID:    gmID,
        ActionType:  "unhide_post",
        TargetType:  "post",
        TargetID:    postID,
        BeforeState: map[string]interface{}{"is_hidden": true, "witness_list": post.WitnessList},
        AfterState:  map[string]interface{}{"is_hidden": false, "witness_list": []uuid.UUID{}},
        Reason:      reason,
    })

    return updated, err
}
```

## GM Audit Log Viewer

### Frontend Component

```typescript
// components/gm/AuditLogViewer.tsx
export function AuditLogViewer({ campaignId }: { campaignId: string }) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['gm-audit-log', campaignId],
    queryFn: () => fetchAuditLog(campaignId),
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">GM Audit Log</h2>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Action</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Timestamp</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs?.map((log) => (
            <TableRow key={log.id}>
              <TableCell>
                <Badge variant={getActionVariant(log.action_type)}>
                  {formatActionType(log.action_type)}
                </Badge>
              </TableCell>
              <TableCell>
                {formatTargetInfo(log.target_type, log.target_id)}
              </TableCell>
              <TableCell className="max-w-md truncate">
                {log.reason}
              </TableCell>
              <TableCell>
                {formatDate(log.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function getActionVariant(actionType: string) {
  switch (actionType) {
    case 'delete_post':
    case 'force_unlock':
      return 'destructive';
    case 'edit_post':
      return 'default';
    case 'promote_character':
      return 'success';
    case 'demote_character':
      return 'secondary';
    default:
      return 'outline';
  }
}

function formatActionType(actionType: string): string {
  return actionType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
```

## Edge Cases

### 1. GM Edits Post With Pending Rolls

**Issue**: Post has rolls in "pending" state

**Solution**: Allow edit but warn GM
```typescript
if (post.rolls.some(r => r.status === 'pending')) {
  const confirmed = await confirm(
    'This post has pending dice rolls. Editing may confuse players. Continue?'
  );
  if (!confirmed) return;
}
```

### 2. Deleting Last Post in Scene

**Issue**: No previous post to unlock

**Solution**: Clear scene lock entirely
```go
if previousPost == nil {
    _, err = s.db.UpdateSceneLockedPost(ctx, sqlc.UpdateSceneLockedPostParams{
        ID:           scene.ID,
        LockedPostID: nil,
    })
}
```

### 3. Character Type Change During Active Compose

**Issue**: Player is mid-compose when demoted

**Solution**: Force-release lock first
```go
lock, err := s.db.GetComposeLockByCharacter(ctx, characterID)
if err == nil && lock != nil {
    err = s.ForceReleaseComposeLock(ctx, lock.SceneID, gmID, "character type change")
    if err != nil {
        return nil, fmt.Errorf("failed to release compose lock: %w", err)
    }
}
```

### 4. GM Deletes Their Own GM Post

**Issue**: GM character posts should also be editable

**Solution**: Allow GM to edit any post, including their own
```go
// No special handling needed - GM can edit any post
```

## Testing Checklist

- [ ] GM can edit any post in their campaign
- [ ] "Edited by GM" badge appears after edit
- [ ] GM edit reason stored in audit log
- [ ] GM can delete posts
- [ ] Deleting locked post unlocks previous post
- [ ] Deleting last post clears scene lock
- [ ] GM can force-release compose lock
- [ ] Lock holder notified of force release
- [ ] GM can promote NPC to PC (GM Phase only)
- [ ] GM can demote PC to NPC (GM Phase only)
- [ ] Character type change prevented during PC Phase
- [ ] Cannot edit posts with executed rolls
- [ ] Cannot change witness lists (except unhide)
- [ ] GM can unhide hidden posts
- [ ] All GM actions logged in audit log
- [ ] Non-GM users cannot access GM endpoints
- [ ] Audit log queryable and filterable

## Verification Steps

1. **Edit Post Test**:
   ```bash
   # As GM, edit a post
   # Verify "Edited by GM" badge appears
   # Check audit log for edit entry
   # Verify reason is stored
   ```

2. **Delete Post Test**:
   ```bash
   # Create 3 posts in scene
   # Lock post 3
   # Delete post 3 as GM
   # Verify post 2 is now locked
   ```

3. **Force Release Test**:
   ```bash
   # Player acquires compose lock
   # GM force-releases lock
   # Verify player can no longer submit
   # Verify notification sent to player
   ```

4. **Character Type Test**:
   ```bash
   # Transition to GM Phase
   # Promote NPC to PC
   # Verify character type updated
   # Verify audit log entry
   # Attempt during PC Phase (should fail)
   ```

5. **Immutability Test**:
   ```bash
   # Create post with executed roll
   # Attempt to edit as GM
   # Verify rejection
   ```

## Performance Considerations

- Index on gm_audit_log for fast queries
- Limit audit log to recent entries (90 days)
- Cache GM verification (campaign.gm_id)
- Batch audit log inserts if multiple actions
- Optimize previous post lookup query

## Security Considerations

- RLS policies enforce GM-only access
- Audit log immutable (no updates/deletes)
- Reason field required for all GM actions
- Rate limit GM moderation endpoints
- Alert on excessive GM actions (abuse detection)
- Verify GM owns campaign for every action

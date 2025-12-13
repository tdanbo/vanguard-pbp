# Phase 4: Characters & Scenes

## Overview

Phase 4 implements character management, scene creation, and image upload systems. Characters are campaign-owned entities assigned to users, and scenes are containers for narrative action.

## Skills Required

- **go-api-server**: Character/scene CRUD, assignment logic
- **supabase-integration**: Character assignments, scene management, storage integration
- **shadcn-react**: Character/scene UI components
- **image-upload**: Avatar and scene header upload workflows

## Deliverables

### Character Management
- Create characters (GM-created, assigned to players)
- Character types (PC/NPC)
- Edit character (display name, description, avatar)
- Archive characters (GM only)
- Orphan handling (when player leaves)
- Reassign orphaned characters
- Multi-character support per user

### Scene Management
- Create scenes (GM only, max 25 per campaign)
- Edit scenes (title, description, header image)
- Archive scenes
- Add/remove characters from scenes (GM Phase only)
- Character single-scene constraint
- Scene limit warnings (20, 23, 24)
- Auto-delete oldest archived when creating 26th

### Image Upload
- Avatar uploads (square, GM-initiated)
- Scene header uploads (16:9)
- Storage bucket organization
- File validation (20MB max, 4000x4000px max)
- Supported formats (PNG, JPG, WebP)
- Campaign storage tracking (500MB limit)
- Storage quota warnings (80%, 90%, 95%)

## PRD References

- [Scope](/home/tobiasd/github/vanguard-pbp/prd/scope.md) - Scene limits, multi-character support
- [Settings](/home/tobiasd/github/vanguard-pbp/prd/settings.md) - Image constraints, scene deletion
- [Technical](/home/tobiasd/github/vanguard-pbp/prd/technical.md) - Character/Scene models, assignments

## Implementation Files

1. [01-characters.md](./01-characters.md) - Character management
2. [02-scenes.md](./02-scenes.md) - Scene management
3. [03-image-upload.md](./03-image-upload.md) - Image upload system

## Success Criteria

- [ ] GM can create characters (PC/NPC)
- [ ] GM can assign characters to users
- [ ] Users can control multiple characters
- [ ] Characters can be archived (not deleted)
- [ ] Orphaned characters can be reassigned
- [ ] Scenes limited to 25 per campaign
- [ ] Scene warnings display at thresholds
- [ ] Oldest archived scene auto-deleted at 26th
- [ ] Characters can only be in one scene at a time
- [ ] GM can move characters during GM Phase
- [ ] Avatars uploaded as square images
- [ ] Scene headers uploaded as 16:9 images
- [ ] Storage quota tracked and enforced
- [ ] Storage warnings at 80%, 90%, 95%

## Testing Checklist

- [ ] Create character as GM
- [ ] Block character creation as player
- [ ] Assign character to user
- [ ] Reassign orphaned character
- [ ] Archive character (still visible in posts)
- [ ] Multi-character control works correctly
- [ ] Create 25 scenes successfully
- [ ] Warning at 20 scenes
- [ ] Auto-delete at 26th scene creation
- [ ] Character can only join one scene
- [ ] Upload avatar (square crop)
- [ ] Upload scene header (16:9 crop)
- [ ] Storage quota enforced at 500MB
- [ ] Storage warnings display correctly

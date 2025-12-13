# Phase 6: Visibility & Witness System

## Overview

The Visibility & Witness System implements character-based, immutable visibility filtering for posts, rolls, and scenes. This is the foundation for hidden posts, late arrival mechanics, and multi-character separation.

## Core Concept

Visibility in Vanguard PBP is **character-centric**, not user-centric. When a post is created, the system captures a snapshot of all present characters as "witnesses" to that post. This witness list is immutable (except for GM unhide operations), ensuring consistent narrative continuity.

## PRD References

- **Core Concepts**: Witness-based visibility, character-centric design
- **Turn Structure**: Phase transitions, pass mechanics, scene state
- **Technical**: Row-Level Security (RLS), Supabase integration, performance requirements

## Key Skills

- **visibility-filter** - Witness-based filtering, RLS policies, late arrival handling
- **supabase-integration** - JWT authentication, RLS implementation, real-time filtering

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Visibility Layer                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Post Creation → Witness Capture → Immutable List           │
│                                                              │
│  Query → RLS Policy → Witness Filter → Visible Posts        │
│                                                              │
│  GM Unhide → Witness Update → Retroactive Visibility        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Sequence

1. **Witness System** (`01-witness-system.md`)
   - Witness list management
   - Late arrival handling
   - Multi-character view separation

2. **RLS Policies** (`02-rls-policies.md`)
   - Database-level security
   - Performance optimization
   - Policy testing

3. **Hidden Posts** (`03-hidden-posts.md`)
   - GM-only visibility
   - Unhide mechanics
   - Compose lock integration

## Database Schema

```sql
-- Posts table with witness list
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  witnesses UUID[] NOT NULL DEFAULT '{}', -- Array of character IDs
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for witness queries
CREATE INDEX idx_posts_witnesses ON posts USING GIN(witnesses);

-- Index for scene queries
CREATE INDEX idx_posts_scene_created ON posts(scene_id, created_at DESC);
```

## Success Criteria

- ✅ Character-based visibility enforced at database level
- ✅ Witness lists captured atomically on post creation
- ✅ Late-arriving characters only see subsequent posts
- ✅ Multi-character players see different content per character
- ✅ Hidden posts invisible to all except GM
- ✅ GM unhide operation adds witnesses retroactively
- ✅ RLS policies perform efficiently (< 100ms queries)
- ✅ Real-time updates filtered by witness status

## Testing Strategy

### Unit Tests
- Witness list capture on post creation
- Late arrival filtering logic
- Multi-character view separation
- GM unhide witness assignment

### Integration Tests
- RLS policy enforcement
- Real-time subscription filtering
- Cross-scene visibility isolation
- Performance benchmarks

### E2E Tests
- Player creates post → witnesses captured
- Late arrival → only sees new posts
- GM unhides → post becomes visible
- Multi-character → separate feeds

## Edge Cases Covered

1. **Orphaned characters** - Posts from deleted characters remain visible to witnesses
2. **Empty scenes** - GM-only posts when no characters present
3. **Simultaneous posts** - Witness lists may differ based on exact timing
4. **Character deletion** - Witness lists preserve deleted character IDs
5. **Scene transfers** - Witness lists remain scene-specific
6. **GM characters** - Treated identically to player characters for visibility

## Performance Requirements

- Witness list capture: < 50ms
- Visibility queries: < 100ms for 1000+ posts
- RLS policy overhead: < 10ms per query
- Real-time filtering: < 50ms latency

## Dependencies

- **Phase 3**: Scenes and scene membership
- **Phase 4**: Characters with scene presence
- **Phase 5**: Post composition and persistence

## Enables

- **Phase 7**: Phase transitions (atomic witness transactions)
- **Phase 8**: Dice rolls (visibility follows post)
- **Future**: Private messaging, GM notes, secret checks

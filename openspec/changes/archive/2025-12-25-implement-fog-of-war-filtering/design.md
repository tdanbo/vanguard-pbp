## Context

Fog of war is a core anti-metagaming feature that restricts scene visibility based on character witness history. The setting exists and can be toggled, but no actual filtering occurs. This change implements the filtering logic.

## Goals / Non-Goals

**Goals:**
- Implement scene visibility filtering when fog of war is enabled
- GM always sees all scenes
- Players see scenes where any of their assigned characters have witnessed posts
- Maintain existing behavior when fog of war is disabled

**Non-Goals:**
- Per-scene fog of war settings (it's campaign-wide)
- Character-specific scene views (we aggregate across all user's characters)
- Game log filtering (separate concern, already handled by witness filtering on posts)

## Decisions

### Decision 1: Aggregate visibility across all user's characters

**Rationale:** A user may control multiple characters. Rather than requiring them to select which character's view to use, we show scenes visible to ANY of their characters. This prevents information hiding bugs and matches the multi-character UX pattern used elsewhere.

**Implementation:**
```sql
SELECT DISTINCT s.*
FROM scenes s
INNER JOIN posts p ON p.scene_id = s.id
INNER JOIN character_assignments ca ON ca.character_id = ANY(p.witnesses)
WHERE s.campaign_id = $1
  AND ca.user_id = $2
  AND s.is_archived = false
ORDER BY s.created_at DESC;
```

### Decision 2: Backend-only filtering

**Rationale:** The frontend doesn't need to know which specific character provided visibility - it just needs the filtered scene list. This keeps the API simple and avoids leaking information about character witness status.

### Decision 3: GM bypass

**Rationale:** Per PRD, GMs see everything always. This is a simple role check before applying any filtering.

## Risks / Trade-offs

- **Risk:** Performance with many characters/posts
  - **Mitigation:** The query joins through indexes on `posts.witnesses` (GIN) and `character_assignments.user_id`. For reasonable campaign sizes (<50 players, <25 scenes), this should perform well.

- **Trade-off:** All-or-nothing visibility per user
  - A user with multiple characters sees scenes from all of them. This could be seen as minor information leakage (knowing a scene exists), but it matches how the rest of the multi-character UX works.

## Migration Plan

No migration needed. The witness data already exists on posts. This is a behavior change controlled by the existing `fogOfWar` setting.

## Open Questions

None - requirements are clear from PRD.

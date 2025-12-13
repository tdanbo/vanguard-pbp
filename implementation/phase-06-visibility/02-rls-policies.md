# Row-Level Security (RLS) Policies

## Overview

Row-Level Security (RLS) policies enforce visibility rules at the database level, ensuring that even direct database queries respect witness-based filtering. This is critical for security and consistency across the application.

## PRD References

- **Technical**: "Row-Level Security enforces visibility at database level"
- **Security**: "Multi-tenant isolation via RLS policies"
- **Performance**: "RLS policies must perform efficiently at scale"

## Skill Reference

**supabase-integration** - JWT authentication, RLS policy implementation, performance optimization

## RLS Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Application Query                      │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│                  Supabase/Postgres                       │
│                                                          │
│  1. Extract JWT claims (user_id, role)                  │
│  2. Apply RLS policy for table                          │
│  3. Filter rows based on policy                         │
│  4. Return visible rows only                            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## JWT Claims Structure

Supabase provides JWT claims in `auth.jwt()`:

```json
{
  "sub": "user-uuid",
  "role": "authenticated",
  "email": "user@example.com",
  "user_metadata": {
    "is_gm": false
  }
}
```

We extend this with custom claims:

```sql
-- Helper function to get current user ID
CREATE OR REPLACE FUNCTION auth.user_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    NULL
  )::UUID;
$$ LANGUAGE SQL STABLE;

-- Helper function to check if user is GM
CREATE OR REPLACE FUNCTION auth.is_gm()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::json->'user_metadata'->>'is_gm')::boolean,
    false
  );
$$ LANGUAGE SQL STABLE;

-- Helper function to get user's characters
CREATE OR REPLACE FUNCTION auth.user_characters()
RETURNS SETOF UUID AS $$
  SELECT id FROM characters
  WHERE user_id = auth.user_id()
    AND deleted_at IS NULL;
$$ LANGUAGE SQL STABLE;
```

## RLS Policies for Posts

### Enable RLS

```sql
-- Enable RLS on posts table
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
```

### SELECT Policy (Witness-Based)

```sql
-- Policy: Users can SELECT posts where they have a witnessing character
CREATE POLICY posts_select_policy ON posts
FOR SELECT
USING (
  -- GM sees all posts
  auth.is_gm()
  OR
  -- User has a character in the witness list
  EXISTS (
    SELECT 1
    FROM characters c
    WHERE c.user_id = auth.user_id()
      AND c.deleted_at IS NULL
      AND c.id = ANY(posts.witnesses)
  )
);
```

### INSERT Policy

```sql
-- Policy: Users can INSERT posts for their own characters
CREATE POLICY posts_insert_policy ON posts
FOR INSERT
WITH CHECK (
  -- Character belongs to user
  character_id IN (SELECT auth.user_characters())
  AND
  -- Character is in the scene
  EXISTS (
    SELECT 1
    FROM characters c
    WHERE c.id = posts.character_id
      AND c.scene_id = posts.scene_id
      AND c.is_present = true
  )
);
```

### UPDATE Policy

```sql
-- Policy: Users can UPDATE their own posts (content only, not witnesses)
CREATE POLICY posts_update_policy ON posts
FOR UPDATE
USING (
  character_id IN (SELECT auth.user_characters())
)
WITH CHECK (
  character_id IN (SELECT auth.user_characters())
);

-- Note: Witness immutability enforced by trigger, not RLS
```

### DELETE Policy

```sql
-- Policy: Only GM can DELETE posts (for moderation)
CREATE POLICY posts_delete_policy ON posts
FOR DELETE
USING (auth.is_gm());
```

## RLS Policies for Rolls

Rolls inherit visibility from their associated post.

```sql
-- Enable RLS on rolls table
ALTER TABLE rolls ENABLE ROW LEVEL SECURITY;

-- SELECT: Visibility follows post
CREATE POLICY rolls_select_policy ON rolls
FOR SELECT
USING (
  -- GM sees all rolls
  auth.is_gm()
  OR
  -- User can see the associated post
  EXISTS (
    SELECT 1
    FROM posts p
    WHERE p.id = rolls.post_id
      AND (
        auth.is_gm()
        OR
        EXISTS (
          SELECT 1
          FROM characters c
          WHERE c.user_id = auth.user_id()
            AND c.deleted_at IS NULL
            AND c.id = ANY(p.witnesses)
        )
      )
  )
);

-- INSERT: User owns the character making the roll
CREATE POLICY rolls_insert_policy ON rolls
FOR INSERT
WITH CHECK (
  character_id IN (SELECT auth.user_characters())
);

-- UPDATE: Only GM can update rolls (for overrides)
CREATE POLICY rolls_update_policy ON rolls
FOR UPDATE
USING (auth.is_gm())
WITH CHECK (auth.is_gm());

-- DELETE: No deletion allowed (audit trail)
-- No DELETE policy = no one can delete
```

## RLS Policies for Scenes

Scenes are visible based on campaign membership, not witness lists.

```sql
-- Enable RLS on scenes table
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;

-- SELECT: User is in the campaign
CREATE POLICY scenes_select_policy ON scenes
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM campaign_members cm
    WHERE cm.campaign_id = scenes.campaign_id
      AND cm.user_id = auth.user_id()
  )
);

-- INSERT: Only GM can create scenes
CREATE POLICY scenes_insert_policy ON scenes
FOR INSERT
WITH CHECK (auth.is_gm());

-- UPDATE: Only GM can update scenes
CREATE POLICY scenes_update_policy ON scenes
FOR UPDATE
USING (auth.is_gm())
WITH CHECK (auth.is_gm());

-- DELETE: Only GM can delete scenes
CREATE POLICY scenes_delete_policy ON scenes
FOR DELETE
USING (auth.is_gm());
```

## RLS Policies for Characters

```sql
-- Enable RLS on characters table
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

-- SELECT: User is in the campaign (can see all characters in their campaigns)
CREATE POLICY characters_select_policy ON characters
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM campaigns c
    JOIN campaign_members cm ON cm.campaign_id = c.id
    WHERE c.id = characters.campaign_id
      AND cm.user_id = auth.user_id()
  )
);

-- INSERT: User creates character for themselves in their campaigns
CREATE POLICY characters_insert_policy ON characters
FOR INSERT
WITH CHECK (
  user_id = auth.user_id()
  AND
  EXISTS (
    SELECT 1
    FROM campaign_members cm
    WHERE cm.campaign_id = characters.campaign_id
      AND cm.user_id = auth.user_id()
  )
);

-- UPDATE: User updates their own characters, GM updates any
CREATE POLICY characters_update_policy ON characters
FOR UPDATE
USING (
  user_id = auth.user_id()
  OR
  auth.is_gm()
)
WITH CHECK (
  user_id = auth.user_id()
  OR
  auth.is_gm()
);

-- DELETE: Soft delete only (set deleted_at)
-- Hard delete only via GM moderation tools
CREATE POLICY characters_delete_policy ON characters
FOR DELETE
USING (auth.is_gm());
```

## RLS Policies for Campaigns

```sql
-- Enable RLS on campaigns table
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- SELECT: User is a member
CREATE POLICY campaigns_select_policy ON campaigns
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM campaign_members cm
    WHERE cm.campaign_id = campaigns.id
      AND cm.user_id = auth.user_id()
  )
);

-- INSERT: Any authenticated user can create campaigns
CREATE POLICY campaigns_insert_policy ON campaigns
FOR INSERT
WITH CHECK (
  gm_id = auth.user_id()
);

-- UPDATE: Only GM can update
CREATE POLICY campaigns_update_policy ON campaigns
FOR UPDATE
USING (gm_id = auth.user_id())
WITH CHECK (gm_id = auth.user_id());

-- DELETE: Only GM can delete
CREATE POLICY campaigns_delete_policy ON campaigns
FOR DELETE
USING (gm_id = auth.user_id());
```

## Performance Optimization

### 1. Index Strategy

```sql
-- Indexes to support RLS policy lookups

-- Characters by user (for auth.user_characters())
CREATE INDEX idx_characters_user_id ON characters(user_id)
WHERE deleted_at IS NULL;

-- Campaign members by user
CREATE INDEX idx_campaign_members_user ON campaign_members(user_id);

-- Campaign members by campaign
CREATE INDEX idx_campaign_members_campaign ON campaign_members(campaign_id);

-- Posts witness array (GIN index for ANY queries)
CREATE INDEX idx_posts_witnesses ON posts USING GIN(witnesses);

-- Rolls by post (for visibility checks)
CREATE INDEX idx_rolls_post_id ON rolls(post_id);

-- Characters by campaign
CREATE INDEX idx_characters_campaign ON characters(campaign_id)
WHERE deleted_at IS NULL;
```

### 2. Policy Optimization Techniques

#### Use SECURITY INVOKER Functions

```sql
-- When RLS policy calls a function, mark it SECURITY INVOKER
-- This allows the function to see the same rows as the calling user
CREATE OR REPLACE FUNCTION get_user_witness_characters(user_uuid UUID)
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY INVOKER  -- Run with caller's permissions
AS $$
  SELECT id FROM characters
  WHERE user_id = user_uuid
    AND deleted_at IS NULL;
$$;
```

#### Avoid Nested Subqueries

```sql
-- Bad: Nested subquery in policy
CREATE POLICY posts_select_policy_slow ON posts
FOR SELECT
USING (
  character_id IN (
    SELECT c.id FROM characters c
    WHERE c.user_id IN (
      SELECT u.id FROM users u WHERE u.id = auth.user_id()
    )
  )
);

-- Good: Direct join
CREATE POLICY posts_select_policy_fast ON posts
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM characters c
    WHERE c.user_id = auth.user_id()
      AND c.id = ANY(posts.witnesses)
  )
);
```

#### Use EXISTS Instead of IN

```sql
-- Bad: IN clause (materializes subquery)
CREATE POLICY slow_policy ON posts
FOR SELECT
USING (
  character_id IN (SELECT id FROM characters WHERE user_id = auth.user_id())
);

-- Good: EXISTS (short-circuits)
CREATE POLICY fast_policy ON posts
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM characters c
    WHERE c.id = posts.character_id
      AND c.user_id = auth.user_id()
  )
);
```

### 3. Query Plan Analysis

```sql
-- Test RLS policy performance
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "user-uuid", "role": "authenticated"}';

EXPLAIN ANALYZE
SELECT * FROM posts
WHERE scene_id = 'scene-uuid'
ORDER BY created_at DESC
LIMIT 50;

-- Look for:
-- - Index scans (not sequential scans)
-- - Bitmap heap scans on witness array
-- - Execution time < 100ms
```

### 4. Bypass RLS for Internal Operations

```sql
-- Service role bypasses RLS for internal operations
-- Use sparingly and carefully!

-- Example: Admin dashboard query
-- Use service role, not user JWT
SELECT COUNT(*) FROM posts WHERE is_hidden = true;
```

## Testing RLS Policies

### Unit Tests (pgTAP)

```sql
-- Install pgTAP: https://pgtap.org/

BEGIN;
SELECT plan(10);

-- Test: User can see posts they witnessed
PREPARE test_witness_visibility AS
  SELECT * FROM posts
  WHERE id = 'test-post-uuid';

SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "user-uuid"}';

SELECT results_eq(
  'test_witness_visibility',
  $$VALUES ('test-post-uuid'::uuid)$$,
  'User sees post where their character is a witness'
);

-- Test: User cannot see posts they didn't witness
SET request.jwt.claims = '{"sub": "other-user-uuid"}';

SELECT is_empty(
  'test_witness_visibility',
  'User does not see post where no character is a witness'
);

-- Test: GM sees all posts
SET request.jwt.claims = '{"sub": "gm-uuid", "user_metadata": {"is_gm": true}}';

SELECT results_eq(
  'test_witness_visibility',
  $$VALUES ('test-post-uuid'::uuid)$$,
  'GM sees all posts'
);

SELECT * FROM finish();
ROLLBACK;
```

### Integration Tests (Go)

```go
// internal/db/rls_test.go
package db_test

import (
    "context"
    "testing"
    "github.com/stretchr/testify/assert"
    "vanguard-pbp/internal/db"
)

func TestRLSPostVisibility(t *testing.T) {
    // Setup: Create test campaign, scene, characters, posts
    campaign := createTestCampaign(t)
    scene := createTestScene(t, campaign.ID)
    char1 := createTestCharacter(t, campaign.ID, user1.ID)
    char2 := createTestCharacter(t, campaign.ID, user2.ID)

    // Create post witnessed by char1 only
    post := createTestPost(t, scene.ID, char1.ID, []uuid.UUID{char1.ID})

    // Test: User1 can see post
    ctx1 := contextWithUser(context.Background(), user1.ID)
    posts1, err := queries.GetVisiblePostsForCharacter(ctx1, scene.ID, char1.ID)
    assert.NoError(t, err)
    assert.Len(t, posts1, 1)
    assert.Equal(t, post.ID, posts1[0].ID)

    // Test: User2 cannot see post
    ctx2 := contextWithUser(context.Background(), user2.ID)
    posts2, err := queries.GetVisiblePostsForCharacter(ctx2, scene.ID, char2.ID)
    assert.NoError(t, err)
    assert.Len(t, posts2, 0)

    // Test: GM can see post
    ctxGM := contextWithGM(context.Background(), gm.ID)
    postsGM, err := queries.GetHiddenPostsForGM(ctxGM, scene.ID)
    assert.NoError(t, err)
    assert.Len(t, postsGM, 1)
}

func contextWithUser(ctx context.Context, userID uuid.UUID) context.Context {
    // Set JWT claims in context
    claims := map[string]interface{}{
        "sub": userID.String(),
        "role": "authenticated",
    }
    return context.WithValue(ctx, "jwt_claims", claims)
}
```

### E2E Tests (Playwright)

```typescript
// e2e/rls-policies.spec.ts
import { test, expect } from '@playwright/test';

test('RLS enforces witness-based visibility', async ({ page, context }) => {
  // Login as User1
  await page.goto('/login');
  await page.fill('[name="email"]', 'user1@test.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');

  // Navigate to scene
  await page.goto('/campaigns/test-campaign/scenes/test-scene');

  // Create post
  await page.fill('[name="content"]', 'Test post from User1');
  await page.click('button:has-text("Post")');

  // Verify post visible
  await expect(page.locator('text=Test post from User1')).toBeVisible();

  // Open new context as User2 (different browser session)
  const page2 = await context.newPage();
  await page2.goto('/login');
  await page2.fill('[name="email"]', 'user2@test.com');
  await page2.fill('[name="password"]', 'password');
  await page2.click('button[type="submit"]');

  // User2's character not in scene
  await page2.goto('/campaigns/test-campaign/scenes/test-scene');

  // Verify post NOT visible
  await expect(page2.locator('text=Test post from User1')).not.toBeVisible();

  // User2 joins scene
  await page2.click('button:has-text("Enter Scene")');

  // Verify still doesn't see old post (late arrival)
  await expect(page2.locator('text=Test post from User1')).not.toBeVisible();

  // User1 creates new post
  await page.fill('[name="content"]', 'Second post from User1');
  await page.click('button:has-text("Post")');

  // User2 now sees second post
  await expect(page2.locator('text=Second post from User1')).toBeVisible();
  await expect(page2.locator('text=Test post from User1')).not.toBeVisible();
});
```

## Monitoring and Debugging

### Enable RLS Logging

```sql
-- Log RLS policy evaluations (development only!)
SET log_statement = 'all';
SET client_min_messages = 'log';

-- Check which policies are applied
SELECT * FROM pg_policies WHERE tablename = 'posts';
```

### Performance Monitoring

```sql
-- Track slow RLS queries
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%posts%'
  AND mean_exec_time > 100  -- queries slower than 100ms
ORDER BY mean_exec_time DESC;
```

### Debugging RLS Denials

```go
// Log RLS policy violations
func (h *PostHandler) GetPosts(c *gin.Context) {
    posts, err := h.postService.GetPostsForCharacter(c, sceneID, charID, isGM)
    if err != nil {
        // Log for debugging
        log.WithFields(log.Fields{
            "user_id": c.GetString("user_id"),
            "scene_id": sceneID,
            "character_id": charID,
            "error": err,
        }).Warn("RLS policy denied access or query failed")

        c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
        return
    }
    // ...
}
```

## Edge Cases

### 1. Service Account Operations

**Scenario**: Background jobs need to access data without user context.

**Solution**: Use service role key (bypasses RLS).

```go
// Use service role for admin operations
serviceClient := supabase.CreateClient(
    supabaseURL,
    supabaseServiceRoleKey,  // Bypasses RLS
)

// Example: Cleanup job
posts, err := serviceClient.From("posts").
    Select("*").
    Lt("created_at", cutoffDate).
    Execute()
```

### 2. GM Impersonation (Testing)

**Scenario**: GM wants to see scene as a player would.

**Solution**: UI toggle to disable GM privileges temporarily.

```typescript
// Frontend: GM impersonation mode
const [impersonatePlayer, setImpersonatePlayer] = useState(false);

const { data: posts } = useQuery({
  queryKey: ['posts', sceneId, characterId, !impersonatePlayer],
  queryFn: () => fetchPosts(sceneId, characterId, !impersonatePlayer),
});

// Backend: Override JWT claim
if (req.ImpersonatePlayer && userIsGM) {
    ctx = context.WithValue(ctx, "override_is_gm", false)
}
```

### 3. Deleted Characters in Witness Lists

**Scenario**: Character deleted, but UUID remains in witness arrays.

**Handling**: RLS policy checks `deleted_at IS NULL`, so deleted characters' owners can't see posts.

```sql
-- Policy already handles this:
EXISTS (
  SELECT 1
  FROM characters c
  WHERE c.user_id = auth.user_id()
    AND c.deleted_at IS NULL  -- Deleted characters excluded
    AND c.id = ANY(posts.witnesses)
)
```

### 4. Cross-Campaign Data Leaks

**Scenario**: User in Campaign A tries to access Campaign B data.

**Prevention**: All policies check campaign membership.

```sql
-- Example: Character policy
CREATE POLICY characters_select_policy ON characters
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM campaigns c
    JOIN campaign_members cm ON cm.campaign_id = c.id
    WHERE c.id = characters.campaign_id
      AND cm.user_id = auth.user_id()  -- Must be member
  )
);
```

### 5. Supabase Real-time RLS

**Important**: Supabase real-time subscriptions also respect RLS policies.

```typescript
// Real-time subscription automatically filtered by RLS
const subscription = supabase
  .from('posts')
  .on('INSERT', (payload) => {
    // Only receives posts user can see via RLS
    console.log('New post:', payload.new);
  })
  .subscribe();
```

## Testing Checklist

### RLS Policy Coverage

- [ ] Posts
  - [ ] SELECT: Witness-based filtering
  - [ ] INSERT: Character ownership verified
  - [ ] UPDATE: Owner only
  - [ ] DELETE: GM only

- [ ] Rolls
  - [ ] SELECT: Follows post visibility
  - [ ] INSERT: Character ownership verified
  - [ ] UPDATE: GM only (for overrides)
  - [ ] DELETE: Disabled

- [ ] Scenes
  - [ ] SELECT: Campaign membership
  - [ ] INSERT: GM only
  - [ ] UPDATE: GM only
  - [ ] DELETE: GM only

- [ ] Characters
  - [ ] SELECT: Campaign membership
  - [ ] INSERT: User owns character
  - [ ] UPDATE: Owner or GM
  - [ ] DELETE: GM only

- [ ] Campaigns
  - [ ] SELECT: Campaign membership
  - [ ] INSERT: User is GM
  - [ ] UPDATE: GM only
  - [ ] DELETE: GM only

### Performance Tests

- [ ] Post query < 100ms for 1000 posts
- [ ] RLS overhead < 10ms per query
- [ ] Index usage verified (EXPLAIN ANALYZE)
- [ ] No sequential scans on large tables

### Security Tests

- [ ] User cannot see non-witnessed posts
- [ ] User cannot modify others' data
- [ ] Cross-campaign data isolation
- [ ] Service role bypasses RLS correctly
- [ ] JWT claim validation

### Integration Tests

- [ ] RLS enforced in Go queries
- [ ] RLS enforced in Supabase client queries
- [ ] Real-time subscriptions filtered correctly
- [ ] Multi-character queries return correct data

## Verification Steps

1. **Create test database** with RLS enabled
2. **Create test users** (User1, User2, GM)
3. **Create test campaign** with all users as members
4. **Create test scene** in campaign
5. **Create characters** (Char1 for User1, Char2 for User2)
6. **Create post** witnessed by Char1 only
7. **Query as User1** → verify post visible
8. **Query as User2** → verify post NOT visible
9. **Query as GM** → verify post visible
10. **Attempt UPDATE as User2** → verify rejected
11. **Attempt DELETE as User1** → verify rejected
12. **Attempt DELETE as GM** → verify succeeds
13. **Check query performance** → verify < 100ms
14. **Test real-time subscription** → verify filtered correctly

## Migration Strategy

### 1. Enable RLS Incrementally

```sql
-- Enable on posts first (most critical)
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY posts_select_policy ON posts FOR SELECT USING (...);

-- Test thoroughly

-- Enable on other tables
ALTER TABLE rolls ENABLE ROW LEVEL SECURITY;
-- etc.
```

### 2. Gradual Rollout

```go
// Feature flag for RLS enforcement
const (
    RLSEnabled = true  // Set to false to disable RLS temporarily
)

func (h *PostHandler) GetPosts(c *gin.Context) {
    if RLSEnabled {
        // Use RLS-protected query
        posts, err := h.supabaseClient.GetPosts(...)
    } else {
        // Use manual filtering (fallback)
        posts, err := h.postService.GetPostsManual(...)
    }
}
```

### 3. Monitoring

```sql
-- Monitor RLS impact
SELECT
    tablename,
    schemaname,
    COUNT(*) as policy_count
FROM pg_policies
GROUP BY tablename, schemaname;

-- Check for denied queries (increase log level temporarily)
SET log_min_duration_statement = 0;
```

## Documentation

### Developer Guide

```markdown
# Working with RLS Policies

When querying data in Vanguard PBP, all queries automatically respect Row-Level Security policies. This ensures users only see data they're authorized to view.

## Setting User Context

Always set the authenticated user's JWT in the request:

\`\`\`go
// Middleware sets user context from JWT
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := extractToken(c)
        claims := validateToken(token)
        c.Set("user_id", claims.UserID)
        c.Set("is_gm", claims.IsGM)
        c.Next()
    }
}
\`\`\`

## Bypassing RLS (Service Role)

For background jobs or admin operations, use the service role:

\`\`\`go
// CAUTION: Bypasses all RLS policies!
serviceDB := connectAsServiceRole()
posts, err := serviceDB.GetAllPosts()  // No filtering
\`\`\`

## Testing RLS Locally

Set user context manually:

\`\`\`sql
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "user-uuid"}';
SELECT * FROM posts;  -- Filtered by RLS
\`\`\`
```

## API Documentation

All API endpoints automatically enforce RLS policies. No special handling required in application code.

**Example**:

```bash
# User's JWT token automatically filters results
curl -H "Authorization: Bearer $JWT_TOKEN" \
     https://api.vanguard-pbp.com/posts?scene_id=scene-uuid

# Returns only posts user's characters witnessed
```

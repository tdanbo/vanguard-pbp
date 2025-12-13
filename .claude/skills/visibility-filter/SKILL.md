---
name: visibility-filter
description: Witness-based visibility filtering for the Vanguard PBP system. Use this skill when implementing or debugging post visibility, character-scoped queries, witness list management, hidden posts, late arrival handling, multi-character player views, RLS policies for witness filtering, and witness transactions during phase transitions.
---

# Visibility Filter

## Overview

This skill provides patterns and implementation guidance for the Vanguard PBP witness system, which controls what posts each character can see. Visibility is character-based and post-based: every post carries a witnesses array containing character IDs, and only those characters can see that post. This creates emergent scene visibility, supports secret information, and enables complex narrative situations like split parties and late arrivals.

## Witness Filtering Decision Tree

Use this workflow to determine the correct visibility logic for any feature:

```
Is this a query for posts?
├─ YES → Does it need character-scoped visibility?
│   ├─ YES → Filter by witnesses array
│   │   └─ Apply RLS: WHERE characterId = ANY(posts.witnesses)
│   └─ NO → GM view or system operation
│       └─ Return all posts (no witness filter)
└─ NO → Is this creating/updating a post?
    ├─ Creating → Determine witness list
    │   ├─ Player posting → witnesses = all characters in scene (or [] if hidden)
    │   └─ GM posting → witnesses = GM-selected characters (or all, or [])
    └─ Updating → Is this unhiding a post?
        ├─ YES → Set witnesses to all currently present characters
        └─ NO → Preserve existing witness list
```

## Core Witness Principles

### 1. Posts Carry Witnesses

Every post has a `witnesses` array containing character IDs:

```typescript
interface Post {
  id: string;
  sceneId: string;
  characterId: string | null;  // null for Narrator
  userId: string;
  content: PostBlock[];
  witnesses: string[];          // Character IDs who can see this post
  hidden: boolean;              // If true, witnesses = [] until unhidden
  // ... other fields
}
```

**Key Rules:**
- Witnesses are captured at post creation time from `Scene.characters`
- Witness lists are immutable (except GM unhiding operations)
- No retroactive access: characters not in the list never see the post
- Character-based, not user-based: each character has independent visibility

### 2. Character-Scoped Visibility

Visibility is per-character, not per-user. If a user controls multiple characters:

```
User owns: [Garrett, Thorne]

Scene "Upstairs Room":
  Post 1: Witnesses [Garrett]
  Post 2: Witnesses [Garrett]
  Post 3: Witnesses [Garrett, Thorne]
  Post 4: Witnesses [Garrett, Thorne]

When viewing as Garrett: sees posts 1, 2, 3, 4
When viewing as Thorne: sees posts 3, 4 only
```

**Implementation:**
- UI must track "active character" selection
- All queries filter by `characterId IN witnesses`
- Never merge visibility across characters owned by same user

### 3. Default Witnesses

When a post is created, the default witness list is captured from the scene's current character roster:

```typescript
// Default witness calculation
const defaultWitnesses = scene.characters;  // All PCs + NPCs in scene
```

**Player Posting:**
- Regular post: `witnesses = scene.characters`
- Hidden post: `witnesses = []` (GM only until unhidden)

**GM Posting:**
- Default: `witnesses = scene.characters`
- Custom selection: `witnesses = [selected character IDs]`
- Hidden: `witnesses = []`

### 4. Hidden Posts

Players can create "hidden posts" for secret actions. GMs can hide any post.

```typescript
// Creating a hidden post
POST /api/scenes/:sceneId/posts
{
  characterId: "char-123",
  content: [...],
  hidden: true  // Results in witnesses: []
}
```

**Unhiding:**
```typescript
// GM unhides a post
PATCH /api/posts/:postId
{
  witnesses: scene.characters  // Add all currently present characters
}
```

**Behavior:**
- Hidden posts have `witnesses: []`
- Only GM and author can see hidden posts
- When unhidden, witnesses = all characters currently in scene (not historical)
- Unhiding is one-way (cannot re-hide)

## Late Arrival Handling

Characters only witness posts created after they enter a scene.

### Example Flow

```
Scene: "Forest Path"
Initial characters: [Alice]

Post 1 (GM): "You find a hidden note"
  witnesses: [Alice]

-- GM moves Bob into scene during GM Phase --
Scene characters: [Alice, Bob]

Post 2 (GM): "Bob arrives from the south"
  witnesses: [Alice, Bob]

Post 3 (Alice): "Welcome! Let's explore together"
  witnesses: [Alice, Bob]
```

**Bob's View:**
- Cannot see Post 1 (not a witness)
- Sees Post 2 and Post 3
- Must ask Alice in-character about the note

### GM Entry Description

When a character enters a scene:
1. GM adds character to `Scene.characters` during GM Phase
2. GM posts entry description (Narrator or NPC)
3. Entry post witnesses = all characters now in scene (including new arrival)
4. New character's first visible post is the entry description

## Multi-Character Player Handling

Users can control multiple characters. Each character has independent visibility.

### UI Pattern

```typescript
// User has multiple characters in scene
const userCharacters = scene.characters.filter(
  char => char.userId === currentUser.id
);

if (userCharacters.length > 1) {
  // Show character selector dropdown
  // On change, re-fetch posts with new character filter
}

// Fetch posts for selected character
const posts = await fetchPosts({
  sceneId,
  characterId: selectedCharacter.id  // Filter witness list by this ID
});
```

**Critical Rules:**
- Never merge visibility across characters
- UI must clearly indicate which character's view is active
- Switching characters triggers new query with different witness filter
- Post composition uses selected character as author

### Database Query

```sql
-- Fetch posts visible to specific character
SELECT * FROM posts
WHERE scene_id = $1
  AND $2 = ANY(witnesses)  -- $2 = character ID
ORDER BY created_at;
```

## RLS Policy Integration

Row-Level Security policies enforce witness filtering at the database layer.

### Post Visibility Policy

```sql
-- RLS policy for post reads
CREATE POLICY "Characters see witnessed posts"
ON posts FOR SELECT
USING (
  -- GM sees everything
  auth.uid() IN (
    SELECT user_id FROM campaign_members
    WHERE campaign_id = posts.campaign_id
      AND role = 'gm'
  )
  OR
  -- Players see posts their characters witnessed
  EXISTS (
    SELECT 1 FROM character_assignments
    WHERE character_assignments.user_id = auth.uid()
      AND character_assignments.character_id = ANY(posts.witnesses)
  )
);
```

**Key Points:**
- GM bypasses witness filtering (sees all posts)
- Players see posts if ANY of their characters witnessed it
- Application layer must still filter by specific character for correct scoped view
- RLS provides security boundary; application layer provides UX

### Hidden Post Policy

```sql
-- Additional policy for hidden posts
CREATE POLICY "Hidden posts visible to author and GM"
ON posts FOR SELECT
USING (
  hidden = false
  OR user_id = auth.uid()  -- Author sees own hidden posts
  OR auth.uid() IN (SELECT user_id FROM campaign_members WHERE role = 'gm')
);
```

## Witness Transaction During Phase Transition

When transitioning from GM Phase to PC Phase, witness lists must be validated.

### Validation Requirements

```typescript
// Before GM → PC transition
async function validateWitnessesBeforeTransition(campaignId: string) {
  const scenes = await getActiveScenes(campaignId);

  for (const scene of scenes) {
    const recentPosts = await getPostsSinceLastTransition(scene.id);

    for (const post of recentPosts) {
      // Verify all witnesses are valid character IDs
      const invalidWitnesses = post.witnesses.filter(
        charId => !isValidCharacter(charId)
      );

      if (invalidWitnesses.length > 0) {
        throw new Error(
          `Post ${post.id} has invalid witnesses: ${invalidWitnesses}`
        );
      }

      // Verify witnesses are not deleted/archived
      const activeWitnesses = post.witnesses.filter(
        charId => isActiveCharacter(charId)
      );

      if (activeWitnesses.length !== post.witnesses.length) {
        // Clean up witness list (remove deleted characters)
        await updatePostWitnesses(post.id, activeWitnesses);
      }
    }
  }
}
```

### Character Movement During GM Phase

When GM moves characters between scenes:

```typescript
// Character leaves scene
async function removeCharacterFromScene(sceneId: string, characterId: string) {
  // Update scene roster
  await updateScene(sceneId, {
    characters: scene.characters.filter(id => id !== characterId)
  });

  // Witness lists are NOT retroactively updated
  // Character retains access to posts they witnessed before leaving
}

// Character enters scene
async function addCharacterToScene(sceneId: string, characterId: string) {
  // Update scene roster
  await updateScene(sceneId, {
    characters: [...scene.characters, characterId]
  });

  // Character does NOT gain access to previous posts
  // Only new posts will include them as witnesses
}
```

**Critical Behavior:**
- Leaving a scene does not revoke witness access to past posts
- Entering a scene does not grant access to past posts
- Witness lists are historical records (immutable except unhiding)

## Implementation Examples

### Fetching Character-Scoped Posts

```typescript
// Application layer query
async function getPostsForCharacter(
  sceneId: string,
  characterId: string
): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('scene_id', sceneId)
    .contains('witnesses', [characterId])  // Array contains check
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}
```

### Creating a Post with Witnesses

```typescript
// Player creates regular post
async function createPlayerPost(
  sceneId: string,
  characterId: string,
  content: PostBlock[],
  hidden: boolean = false
): Promise<Post> {
  const scene = await getScene(sceneId);

  const post = {
    scene_id: sceneId,
    character_id: characterId,
    user_id: currentUser.id,
    content,
    witnesses: hidden ? [] : scene.characters,  // All or none
    hidden,
  };

  const { data, error } = await supabase
    .from('posts')
    .insert(post)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// GM creates post with custom witnesses
async function createGMPost(
  sceneId: string,
  characterId: string | null,  // null for Narrator
  content: PostBlock[],
  selectedWitnesses: string[]  // GM-selected
): Promise<Post> {
  const post = {
    scene_id: sceneId,
    character_id: characterId,
    user_id: currentUser.id,
    content,
    witnesses: selectedWitnesses,
    hidden: selectedWitnesses.length === 0,
  };

  const { data, error } = await supabase
    .from('posts')
    .insert(post)
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

### Unhiding a Post

```typescript
// GM unhides a post
async function unhidePost(postId: string): Promise<Post> {
  const post = await getPost(postId);
  const scene = await getScene(post.scene_id);

  // Add all currently present characters as witnesses
  const { data, error } = await supabase
    .from('posts')
    .update({
      witnesses: scene.characters,  // Current roster, not historical
      hidden: false
    })
    .eq('id', postId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

### Character Selector UI

```typescript
// Component for selecting active character
function CharacterSelector({ sceneId, onCharacterChange }) {
  const user = useCurrentUser();
  const scene = useScene(sceneId);

  // Get user's characters in this scene
  const userCharacters = scene.characters.filter(
    char => char.user_id === user.id
  );

  const [activeCharacterId, setActiveCharacterId] = useState(
    userCharacters[0]?.id
  );

  useEffect(() => {
    onCharacterChange(activeCharacterId);
  }, [activeCharacterId]);

  if (userCharacters.length <= 1) {
    return null;  // No selector needed
  }

  return (
    <select
      value={activeCharacterId}
      onChange={(e) => setActiveCharacterId(e.target.value)}
    >
      {userCharacters.map(char => (
        <option key={char.id} value={char.id}>
          {char.display_name}
        </option>
      ))}
    </select>
  );
}
```

## Common Patterns

### Scene Visibility Emerges from Post Witnesses

A scene is visible to a character if they've witnessed at least one post:

```typescript
// Check if character has access to scene
async function characterCanSeeScene(
  sceneId: string,
  characterId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('scene_id', sceneId)
    .contains('witnesses', [characterId])
    .limit(1);

  if (error) throw error;
  return count > 0;
}

// Get all scenes visible to character
async function getScenesForCharacter(
  campaignId: string,
  characterId: string
): Promise<Scene[]> {
  // Fetch all scenes in campaign
  const scenes = await getActiveScenes(campaignId);

  // Filter by witness access
  const visibleScenes = await Promise.all(
    scenes.map(async scene => {
      const canSee = await characterCanSeeScene(scene.id, characterId);
      return canSee ? scene : null;
    })
  );

  return visibleScenes.filter(Boolean);
}
```

### Orphaned Characters and Witness Lists

When a character is reassigned or a player leaves:

```typescript
// Character is reassigned to new player
async function reassignCharacter(
  characterId: string,
  newUserId: string
) {
  // Update character assignment
  await updateCharacterAssignment(characterId, newUserId);

  // Witness lists are NOT updated
  // New player sees all posts the character historically witnessed
  // This preserves narrative continuity
}

// Player leaves campaign
async function removePlayer(campaignId: string, userId: string) {
  // Delete character assignments
  await deleteCharacterAssignments(userId, campaignId);

  // Witness lists are NOT updated
  // Posts retain character IDs in witnesses array
  // If character is reassigned, new player sees historical posts
}
```

### GM Moderation and Visibility

GM has special visibility powers:

```typescript
// GM can see all posts regardless of witnesses
function isGM(userId: string, campaignId: string): Promise<boolean> {
  return supabase
    .from('campaign_members')
    .select('role')
    .eq('user_id', userId)
    .eq('campaign_id', campaignId)
    .single()
    .then(({ data }) => data?.role === 'gm');
}

// Fetch posts with GM bypass
async function getPostsForUser(
  sceneId: string,
  userId: string,
  characterId?: string
): Promise<Post[]> {
  const scene = await getScene(sceneId);
  const userIsGM = await isGM(userId, scene.campaign_id);

  if (userIsGM) {
    // GM sees all posts
    return getAllPosts(sceneId);
  } else {
    // Player sees character-scoped posts
    return getPostsForCharacter(sceneId, characterId);
  }
}
```

## Edge Cases and Validation

### Character Deleted/Archived

```typescript
// Before displaying posts, validate witnesses
async function validatePostWitnesses(post: Post): Promise<string[]> {
  const validWitnesses = [];

  for (const characterId of post.witnesses) {
    const character = await getCharacter(characterId);

    if (character && !character.deleted) {
      validWitnesses.push(characterId);
    }
  }

  return validWitnesses;
}
```

### Scene Archived with Active Posts

```typescript
// Archiving a scene does not affect witness access
async function archiveScene(sceneId: string) {
  await updateScene(sceneId, { archived: true });

  // Posts remain accessible to witnesses
  // Witness lists are unchanged
  // Characters can still view their witnessed posts via scene history
}
```

### Character in Multiple Scenes Simultaneously

```typescript
// This is prevented at the application layer
async function addCharacterToScene(sceneId: string, characterId: string) {
  // Check if character is in another scene
  const currentScene = await getCharacterCurrentScene(characterId);

  if (currentScene && currentScene.id !== sceneId) {
    throw new Error(
      `Character ${characterId} is already in scene ${currentScene.id}`
    );
  }

  // Proceed with adding to scene
  await updateScene(sceneId, {
    characters: [...scene.characters, characterId]
  });
}
```

## Testing Visibility Logic

### Test Cases

```typescript
describe('Witness Filtering', () => {
  test('character sees only witnessed posts', async () => {
    const scene = await createScene();
    const [char1, char2] = await createCharacters(2);

    // Post with char1 as witness
    const post1 = await createPost(scene.id, {
      witnesses: [char1.id]
    });

    // Post with both as witnesses
    const post2 = await createPost(scene.id, {
      witnesses: [char1.id, char2.id]
    });

    const char1Posts = await getPostsForCharacter(scene.id, char1.id);
    const char2Posts = await getPostsForCharacter(scene.id, char2.id);

    expect(char1Posts).toHaveLength(2);
    expect(char2Posts).toHaveLength(1);
    expect(char2Posts[0].id).toBe(post2.id);
  });

  test('late arrival sees no previous posts', async () => {
    const scene = await createScene();
    const [char1, char2] = await createCharacters(2);

    // Add char1 to scene
    await addCharacterToScene(scene.id, char1.id);

    // Create posts with char1
    await createPost(scene.id, { witnesses: [char1.id] });
    await createPost(scene.id, { witnesses: [char1.id] });

    // Add char2 to scene
    await addCharacterToScene(scene.id, char2.id);

    // Char2 sees nothing
    const char2Posts = await getPostsForCharacter(scene.id, char2.id);
    expect(char2Posts).toHaveLength(0);
  });

  test('multi-character player sees different views', async () => {
    const user = await createUser();
    const scene = await createScene();
    const [char1, char2] = await createCharacters(2, { userId: user.id });

    const post1 = await createPost(scene.id, { witnesses: [char1.id] });
    const post2 = await createPost(scene.id, { witnesses: [char2.id] });
    const post3 = await createPost(scene.id, { witnesses: [char1.id, char2.id] });

    const char1View = await getPostsForCharacter(scene.id, char1.id);
    const char2View = await getPostsForCharacter(scene.id, char2.id);

    expect(char1View.map(p => p.id)).toEqual([post1.id, post3.id]);
    expect(char2View.map(p => p.id)).toEqual([post2.id, post3.id]);
  });

  test('unhiding adds current scene characters', async () => {
    const scene = await createScene();
    const [char1, char2, char3] = await createCharacters(3);

    // Initially only char1 in scene
    await addCharacterToScene(scene.id, char1.id);

    // Create hidden post
    const post = await createPost(scene.id, { witnesses: [], hidden: true });

    // Add char2 to scene
    await addCharacterToScene(scene.id, char2.id);

    // Unhide post (char3 never added to scene)
    await unhidePost(post.id);

    const updatedPost = await getPost(post.id);
    expect(updatedPost.witnesses).toEqual([char1.id, char2.id]);
    expect(updatedPost.witnesses).not.toContain(char3.id);
  });
});
```

## Summary

The witness system provides fine-grained visibility control through character-scoped post filtering:

1. **Posts carry witnesses**: Every post has a witnesses array of character IDs
2. **Character-scoped**: Visibility is per-character, not per-user
3. **Immutable history**: Witness lists are captured at creation and rarely change
4. **Late arrivals**: Characters only see posts created after they enter
5. **Hidden posts**: Start with no witnesses until GM unhides
6. **Multi-character players**: Each character has independent visibility
7. **RLS policies**: Database-level security enforces witness filtering
8. **Phase transitions**: Validate witnesses before GM → PC transition

This system enables complex narrative situations while maintaining data consistency and player information boundaries.

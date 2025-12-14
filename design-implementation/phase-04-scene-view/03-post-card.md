# 4.3 Post Card

**Skill**: `shadcn-react`, `visibility-filter`

## Goal

Create post cards with full-height portrait sidebar and gradient fade.

---

## Design References

- [05-scene-view.md](../../product-design-system/05-scene-view.md) - Lines 148-278 for post card specs

---

## Overview

Post cards are the heart of scene view. Each post has:
- Full-height portrait sidebar with gradient fade
- Character name in gold serif
- Post content (blocks: action, dialog)
- Roll badge in upper-right
- OOC indicator
- Timestamp

---

## Implementation

### PostCard Component

Create or update `src/components/posts/PostCard.tsx`:

```tsx
import { CharacterPortrait } from "@/components/character/CharacterPortrait"
import { RollBadge } from "@/components/ui/game-badges"
import { MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/utils"

interface PostCardProps {
  post: {
    id: string
    content: string
    oocContent?: string
    createdAt: string
    character: {
      id: string
      displayName: string
      avatarUrl?: string | null
    }
    roll?: {
      state: "pending" | "completed" | "invalidated"
      result?: number
    }
    blocks?: Array<{
      type: "action" | "dialog"
      content: string
    }>
  }
  showOOC?: boolean
}

export function PostCard({ post, showOOC = true }: PostCardProps) {
  const hasOOC = Boolean(post.oocContent)

  return (
    <div className="bg-panel backdrop-blur-md rounded-lg border border-border/50 overflow-hidden">
      <div className="grid grid-cols-[80px_1fr] md:grid-cols-[120px_1fr]">
        {/* Portrait column */}
        <div className="relative">
          <CharacterPortrait
            src={post.character.avatarUrl}
            name={post.character.displayName}
            size="lg"
            className="w-full h-full rounded-none border-0"
          />
          {/* Gradient fade into content */}
          <div className="absolute inset-y-0 right-0 w-8 gradient-fade-right" />
        </div>

        {/* Content column */}
        <div className="p-4 relative">
          {/* Roll badge in upper right */}
          {post.roll && (
            <div className="absolute top-3 right-3">
              <RollBadge
                state={post.roll.state}
                result={post.roll.result}
                size="sm"
              />
            </div>
          )}

          {/* Character name */}
          <h3 className="character-name mb-2">{post.character.displayName}</h3>

          {/* Post content */}
          <div className="prose prose-invert prose-sm max-w-none">
            {post.blocks ? (
              <PostBlocks blocks={post.blocks} />
            ) : (
              <p>{post.content}</p>
            )}
          </div>

          {/* Footer: OOC and timestamp */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
            <div className="flex items-center gap-2">
              {hasOOC && showOOC && (
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <MessageSquare className="h-3 w-3" />
                  OOC
                </button>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(post.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {/* OOC content (expandable) */}
      {hasOOC && showOOC && (
        <div className="px-4 pb-4 ml-[80px] md:ml-[120px]">
          <div className="bg-secondary/50 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">OOC:</span> {post.oocContent}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
```

### PostBlocks Component

```tsx
interface PostBlocksProps {
  blocks: Array<{
    type: "action" | "dialog"
    content: string
  }>
}

function PostBlocks({ blocks }: PostBlocksProps) {
  return (
    <div className="space-y-2">
      {blocks.map((block, index) => (
        <div key={index}>
          {block.type === "action" ? (
            <p className="text-foreground">{block.content}</p>
          ) : (
            <p className="text-gold italic">"{block.content}"</p>
          )}
        </div>
      ))}
    </div>
  )
}
```

---

## Post Stream

```tsx
interface PostStreamProps {
  posts: Post[]
}

export function PostStream({ posts }: PostStreamProps) {
  if (posts.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="The story has not yet begun"
        description="Be the first to write. Your words will set the tale in motion."
        className="py-16"
      />
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
```

---

## Styling Details

### Portrait Gradient Fade

```css
.gradient-fade-right {
  background: linear-gradient(to right, transparent, hsl(var(--card)));
}
```

### Character Name

```css
.character-name {
  @apply font-display text-xl font-semibold;
  color: hsl(var(--gold));
}
```

### Dialog Styling

Dialog blocks use gold italic text:

```tsx
<p className="text-gold italic">"{content}"</p>
```

---

## Hidden Post Indicator

For posts with limited visibility:

```tsx
{post.isHidden && (
  <div className="absolute top-0 left-0 right-0 bg-destructive/10 px-3 py-1 text-xs text-destructive flex items-center gap-1">
    <EyeOff className="h-3 w-3" />
    Hidden from some players
  </div>
)}
```

---

## Success Criteria

- [ ] Portrait displays full-height with gradient fade
- [ ] Character name uses gold serif font
- [ ] Action and dialog blocks styled differently
- [ ] Roll badge positioned in upper-right
- [ ] OOC content expandable below post
- [ ] Timestamp displays relative time
- [ ] Cards use transparent panel styling

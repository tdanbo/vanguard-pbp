# Change: Unify Hidden Post and Witness Indicators

## Why

The current post display shows two separate indicators for hidden posts:
1. A "Hidden" badge with EyeOff icon showing the post is hidden
2. A separate Eye button for viewing witnesses

For hidden posts, these provide redundant/confusing information. The "Hidden" badge takes up visual space with text that's already communicated by the EyeOff icon. Since hidden posts have the poster as the only witness, combining these into a single control improves clarity and reduces UI clutter.

Additionally, the edit/lock indicators are currently hidden for the author's own hidden posts, and GM edit controls are inconsistent. Both should be consistently visible.

## What Changes

### Hidden Post Indicator
- Remove the "Hidden" text label - display only the EyeOff icon
- Make the EyeOff icon clickable to open the witness popover
- When clicked, show that the posting character is the only witness (or "No witnesses" if truly empty)
- GM can "reveal" a hidden post by simply adding witnesses through the existing witness editing UI

### Edit/Lock Visibility for Players (Authors)
- Show edit/lock indicator on ALL their posts, including hidden ones
  - Last post, not locked: show Pencil (edit)
  - Otherwise: show Lock indicator

### GM Edit Access
- GM always sees the Edit button on every post (no lock state for GM)
- Posts are never locked for GM - they can always edit any post
- No separate delete button needed - GM accesses delete through the edit flow
- No separate "Reveal" button needed - GM reveals posts by editing witnesses in the popover

### Icon Consolidation
- Non-hidden posts: Eye icon opens witness popover (unchanged)
- Hidden posts: EyeOff icon opens witness popover (replaces the static badge)

## Impact

- Affected specs: `post-display` (new capability - delta spec created)
- Affected code:
  - `services/frontend/src/components/posts/ImmersivePostCard.tsx`
  - `services/frontend/src/components/posts/PostCard.tsx`
  - `services/frontend/src/components/posts/WitnessPopover.tsx` (minor: accept isHidden prop for icon swap)
- No backend changes required
- No breaking changes

## Non-Goals

- Changing the composer's hidden post toggle (HiddenPostToggle.tsx)
- Modifying witness editing functionality (already works for GM)
- Changing how hidden posts are displayed to non-owners/non-GMs

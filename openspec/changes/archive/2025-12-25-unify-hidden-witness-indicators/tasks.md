# Tasks: Unify Hidden Post and Witness Indicators

## 1. Update WitnessPopover Component

- [x] 1.1 Add `isHidden` prop to WitnessPopover
- [x] 1.2 Swap trigger icon from Eye to EyeOff when `isHidden=true`

## 2. Update ImmersivePostCard Component

- [x] 2.1 Remove the separate "Hidden" badge element
- [x] 2.2 Pass `isHidden={post.isHidden}` to WitnessPopover
- [x] 2.3 Show edit/lock indicator for post owners on hidden posts (currently skipped)
- [x] 2.4 Show Edit button for GM on all posts (never show lock for GM)

## 3. Update PostCard Component

- [x] 3.1 Remove the "Hidden" Badge component
- [x] 3.2 Pass `isHidden={post.isHidden}` to WitnessPopover
- [x] 3.3 Show Edit button for GM on all posts (never show lock for GM)
- [x] 3.4 Remove separate dropdown menu for GM (edit/delete accessed via edit flow)

## 4. Testing

- [x] 4.1 Verify hidden posts show only EyeOff icon (no "Hidden" text)
- [x] 4.2 Verify clicking EyeOff opens witness popover
- [x] 4.3 Verify player sees edit/lock on their own hidden posts
- [x] 4.4 Verify GM sees Edit button on all posts (never locked)
- [x] 4.5 Verify regular Eye icon still works for non-hidden posts

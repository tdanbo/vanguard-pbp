# Scene View

> **Theme Reference**: This view uses immersive utilities from [01-shadcn-theme-reference.md](./01-shadcn-theme-reference.md) including `scene-title`, `character-name`, `bg-panel`, `portrait-md`, `scene-gradient`, and `scene-atmosphere`.

The Scene View is the heart of Vanguard. This is where players experience the narrative. Every design decision here should serve immersion.

## Design Mantra

> "The scene is the world. The posts are the story. The composer is your voice. Everything else should disappear."

---

## Visual Hierarchy (Strict Priority)

```
1. SCENE ATMOSPHERE     — The world you're in (background, header)
2. POSTS                — What's happening (the narrative stream)
3. COMPOSER             — Your contribution (always accessible, messenger-style)
────────────────────────────────────────────────────────────────
4. Everything else      — Recedes, hides, or disappears
```

This hierarchy is inviolable. No UI element should compete with these three.

---

## Layout Structure

The scene view follows a messenger-style layout: header at top, posts in the middle (scrollable), and a fixed composer at the bottom.

```
┌──────────────────────────────────────────────────────────────────┐
│ [←]                                                    [⚙] [...] │  ← Minimal header (near-invisible)
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    ░░░░░░░░░░░░░░░░░░░░░░░                       │
│                    ░░  SCENE IMAGE/ART  ░░                       │
│                    ░░░░░░░░░░░░░░░░░░░░░░░                       │
│                                                                  │
│                    ════════════════════════                      │
│                       THE FAINTED ROSE INN                       │  ← Scene title (display font, large)
│                      A dusty inn at the crossroads               │  ← Scene description (subtle)
│                    ════════════════════════                      │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                     POST STREAM (scrollable)                     │
│                                                                  │
│     ┌──────────────────────────────────────────────────────┐     │
│     │  ┌────────┐                                          │     │
│     │  │PORTRAIT│  CHARACTER NAME                          │     │
│     │  │        │  ─────────────────────────────────────   │     │
│     │  └────────┘  Post content flows here. The narrative  │     │
│     │              text of what the character does, says,  │     │
│     │              or experiences in the scene...          │     │
│     │                                           12:34 PM   │     │
│     └──────────────────────────────────────────────────────┘     │
│                                                                  │
│     ┌──────────────────────────────────────────────────────┐     │
│     │  ┌────────┐                                          │     │
│     │  │PORTRAIT│  ANOTHER CHARACTER                       │     │
│     │  │        │  ─────────────────────────────────────   │     │
│     │  └────────┘  Their response to the scene...          │     │
│     │                                           12:45 PM   │     │
│     └──────────────────────────────────────────────────────┘     │
│                                                                  │
│                          (padding for composer)                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌────────────────────────────────────────────────────────────┐ │
│   │  Write your narrative here...                              │ │
│   │                                                            │ │
│   │  [⚔][💬][👁]                        [🔒] ████░░░ [➤]       │ │
│   └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Key Layout Principles:**
- Scene header stays at top, can scroll away or remain sticky
- Posts scroll in the middle with adequate bottom padding
- Composer is **fixed to bottom** like a messenger app
- Composer is always visible, not hidden behind a modal

---

## Scene Header

The scene header establishes place and mood before any narrative.

### With Scene Image

```tsx
function SceneHeader({ scene }: { scene: Scene }) {
  return (
    <div className="relative w-full min-h-[40vh]">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${scene.headerImageUrl})` }}
      />

      {/* Gradient fade into content area */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 scene-gradient" />

      {/* Title overlay */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
        <h1 className="scene-title">{scene.title}</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          {scene.description}
        </p>
      </div>
    </div>
  )
}
```

### Without Scene Image

If no image is set, use the atmospheric gradient fallback:

```tsx
function SceneHeaderNoImage({ scene }: { scene: Scene }) {
  return (
    <div className="min-h-[25vh] scene-atmosphere flex items-center justify-center">
      <div className="text-center">
        <h1 className="scene-title">{scene.title}</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          {scene.description}
        </p>
      </div>
    </div>
  )
}
```

### Utility Classes Used

| Class | Purpose |
|-------|---------|
| `scene-title` | Display font, 4xl, semibold, tight tracking, text-shadow |
| `scene-gradient` | Linear gradient from transparent to background |
| `scene-atmosphere` | Radial gradient for imageless scenes |

---

## Post Cards

Posts are the narrative content. They should feel like reading, not like scanning a feed. The post card creates an immersive RPG dialog feel with a full-height portrait sidebar that fades into the content area.

### Post Layout

```
┌─────────────────────────────────────────────────────┐
│ ┌──────────┐                          [Stealth: 18] │  ← Roll badge (upper right)
│ │          │  CHARACTER NAME                        │
│ │ PORTRAIT │  ─────────────────────────────────     │
│ │ (full    │  Post content flows here. The         │
│ │  height) │  narrative text of what the           │
│ │    ↓     │  character does, says...              │
│ │ gradient │                                   [💬] │  ← OOC toggle (if has OOC)
│ │   fade → │                          12:34 PM     │
│ └──────────┘                                        │
└─────────────────────────────────────────────────────┘
```

The post card uses a two-column grid layout where the portrait spans the full height and fades into the content area with a gradient overlay.

```tsx
function PostCard({ post }: { post: Post }) {
  const [showOOC, setShowOOC] = useState(false)
  const hasOOC = post.oocText && (settings.oocVisibility === 'all' || isGM)

  return (
    <div className="grid grid-cols-[80px_1fr] md:grid-cols-[120px_1fr] rounded-xl border border-border overflow-hidden bg-card">
      {/* Portrait Sidebar - full height with gradient fade */}
      <div className="relative min-h-[120px]">
        <img
          src={post.characterAvatar}
          alt={post.characterName}
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Gradient fade into content area */}
        <div
          className="absolute inset-y-0 right-0 w-1/2"
          style={{ background: 'linear-gradient(to right, transparent, hsl(var(--card)))' }}
        />
      </div>

      {/* Content Area */}
      <div className="relative p-4">
        {/* Roll Badge - positioned upper right */}
        <RollBadge
          intention={post.intention}
          roll={post.roll}
          onClick={() => setRollModalOpen(true)}
          className="absolute top-4 right-4"
        />

        {/* Character name in gold */}
        <h3 className="character-name mb-2">
          {post.characterName}
        </h3>

        {/* Post content - either narrative blocks or OOC text */}
        {showOOC ? (
          <p className="text-sm text-muted-foreground italic">{post.oocText}</p>
        ) : (
          <div className="text-base leading-relaxed text-foreground">
            {post.blocks.map((block, i) => (
              <PostBlockDisplay key={i} block={block} />
            ))}
          </div>
        )}

        {/* OOC Toggle Icon - bottom right if post has OOC */}
        {hasOOC && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowOOC(!showOOC)}
            className={cn(
              "absolute bottom-4 right-4 h-6 w-6",
              showOOC && "text-primary"
            )}
            title={showOOC ? "Show narrative" : "Show OOC"}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        )}

        {/* Timestamp */}
        <div className="text-xs text-muted-foreground mt-3 text-right">
          {formatDate(post.createdAt)}
        </div>
      </div>
    </div>
  )
}
```

### Roll Badge

The roll badge appears in the upper-right corner of post cards. It shows the roll/intention state and opens a modal when clicked.

| State | Display | Styling | Click Action |
|-------|---------|---------|--------------|
| No intent | Hidden or subtle `+` | Ghost button, low opacity | Opens roll modal |
| Intent selected | Badge: "Stealth" | Outline badge | Opens roll modal |
| GM requested | Badge: "Stealth" + `!` indicator | Yellow badge | Opens roll modal |
| Roll pending | Badge: "Stealth" | Yellow badge | Opens roll modal |
| Roll completed | Badge: "Stealth: 18" | Green badge with result | Opens roll modal |

```tsx
function RollBadge({ intention, roll, onClick, className }: RollBadgeProps) {
  if (!intention && !roll) return null

  const statusStyles = {
    pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    completed: 'bg-green-500/10 text-green-600 border-green-500/20',
    invalidated: 'bg-red-500/10 text-red-600 border-red-500/20',
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn('gap-1', roll && statusStyles[roll.status], className)}
    >
      <Dices className="h-3 w-3" />
      {intention || roll?.intention}
      {roll?.status === 'completed' && roll.total !== null && (
        <span className="font-bold">: {roll.total}</span>
      )}
    </Button>
  )
}
```

### OOC Toggle

Posts with OOC content show a small toggle icon in the bottom-right corner. Clicking swaps the view between narrative content and OOC text.

- **Default view**: Narrative blocks
- **Toggle active**: OOC text (muted, italic)
- **Icon**: `MessageSquare` from lucide-react
- **Visual feedback**: Icon becomes `text-primary` when showing OOC

### Portrait Sizing

The portrait sidebar spans the full height of the post content. Use these base dimensions:

| Size | Class | Dimensions | Usage |
|------|-------|------------|-------|
| Small | `portrait-sm` | 48px × 60px | Compact mobile views |
| Medium | `portrait-md` | 80px × 100px | Default mobile |
| Large | `portrait-lg` | 120px × 150px | Desktop default |

The grid column width controls portrait width: `grid-cols-[80px_1fr] md:grid-cols-[120px_1fr]`

### Portrait Gradient Fade

The gradient overlay creates a smooth transition from portrait to content:

```css
/* Gradient fade on portrait right edge */
.portrait-fade {
  background: linear-gradient(to right, transparent, hsl(var(--card)));
}
```

### Posts Container

```tsx
<div className="flex flex-col gap-6 p-6 max-w-[800px] mx-auto">
  {posts.map(post => (
    <PostCard key={post.id} post={post} />
  ))}
</div>
```

---

## Composer

The composer is the player's voice. It sits at the bottom of the scene view like a modern messenger app — always visible, minimal, and ready.

**Design Inspiration:** Claude's text input — a sleek rounded rectangle with icons on the left, controls on the right, and a clean text area.

### Composer Design Principles

- **Fixed position**: Always visible at the bottom, never a modal
- **Rounded rectangle**: Modern, clean appearance with `rounded-2xl`
- **Semi-transparent**: `bg-panel backdrop-blur-md` lets the scene show through
- **Inline flowing blocks**: Action and dialog blocks flow as prose, not vertical stack
- **Mode toggle**: Switch between Narrative and OOC editing modes
- **Expandable input**: Grows with content, max height before scrolling

### Composer Layout

```
┌────────────────────────────────────────────────────────────────────┐
│  [Narrative] [OOC]                                                 │  ← Mode toggle tabs
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Kira steps forward cautiously. "I don't trust this place," she   │  ← Inline flowing blocks
│  whispers. She draws her blade.                                   │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│  [⚔️ Action] [💬 Dialog] [👁️]              [🔒] ████░░░░░ [➤]    │
└────────────────────────────────────────────────────────────────────┘
```

### Mode Toggle

The composer has two modes that swap the entire editing view:

| Mode | Description | Content Area |
|------|-------------|--------------|
| **Narrative** | Writing the story | Inline flowing action/dialog blocks |
| **OOC** | Out-of-character notes | Simple textarea for OOC text |

Both narrative blocks and OOC text are stored together on the post, but only one is edited at a time.

```tsx
<Tabs value={mode} onValueChange={setMode} className="mb-2">
  <TabsList className="h-8">
    <TabsTrigger value="narrative" className="text-xs px-3">
      <Swords className="h-3 w-3 mr-1" />
      Narrative
    </TabsTrigger>
    <TabsTrigger value="ooc" className="text-xs px-3">
      <MessageSquare className="h-3 w-3 mr-1" />
      OOC
    </TabsTrigger>
  </TabsList>
</Tabs>
```

### Inline Flowing Blocks

Action and dialog blocks flow together as prose instead of vertical cards. This creates a more natural writing experience:

**Example output:**
> Kira steps forward cautiously. *"I don't trust this place,"* she whispers. She draws her blade.

**Visual treatment:**
- **Action blocks**: Normal text, flows inline
- **Dialog blocks**: Italic with quotes, subtle left border indicator

```tsx
function InlineBlockEditor({ blocks, onChange }: InlineBlockEditorProps) {
  return (
    <div className="min-h-[60px] p-2">
      <div className="inline">
        {blocks.map((block, index) => (
          <InlineBlock
            key={index}
            block={block}
            onChange={(content) => handleBlockChange(index, content)}
            onDelete={() => handleBlockDelete(index)}
          />
        ))}
      </div>
      {blocks.length === 0 && (
        <span className="text-muted-foreground">
          Click Action or Dialog to begin writing...
        </span>
      )}
    </div>
  )
}

function InlineBlock({ block, onChange, onDelete }: InlineBlockProps) {
  const isDialog = block.type === 'dialog'

  return (
    <span
      className={cn(
        'inline relative group px-1 rounded hover:bg-muted/50',
        isDialog && 'italic border-l-2 border-primary/30 pl-2'
      )}
    >
      {isDialog && '"'}
      <span
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => onChange(e.currentTarget.textContent || '')}
        className="outline-none"
      >
        {block.content}
      </span>
      {isDialog && '"'}

      {/* Delete button on hover */}
      <button
        onClick={onDelete}
        className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100
                   h-4 w-4 rounded-full bg-destructive text-destructive-foreground
                   flex items-center justify-center text-xs"
      >
        ×
      </button>
    </span>
  )
}
```

### Toolbar Elements

| Position | Icon | Name | Behavior | Mode |
|----------|------|------|----------|------|
| Left | `Swords` | Add Action | Adds action block at cursor | Narrative only |
| Left | `MessageSquare` | Add Dialog | Adds dialog block at cursor | Narrative only |
| Left | `EyeOff` | Hidden Toggle | Toggle "attempt hidden action" | Both modes |
| Right | `Lock`/`Unlock` | Lock Btn | Acquire or release compose lock | Both modes |
| Right | Progress bar | Timer Bar | Shows remaining lock time | Both modes |
| Right | `Send` | Send Btn | Submit the post | Both modes |

**Note**: Action and Dialog buttons are only visible/enabled in Narrative mode.

### Composer Component

```tsx
function PostComposer({
  sceneId,
  character,
  settings,
}: PostComposerProps) {
  const { hasLock, remainingSeconds, acquireLock, releaseLock } = useComposeLock(sceneId, character.id)

  const [mode, setMode] = useState<'narrative' | 'ooc'>('narrative')
  const [blocks, setBlocks] = useState<PostBlock[]>([])
  const [oocText, setOocText] = useState('')
  const [isHidden, setIsHidden] = useState(false)

  const hasContent = blocks.some(b => b.content.trim().length > 0) || oocText.trim().length > 0

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 pointer-events-none">
      <div className="mx-auto max-w-[800px] pointer-events-auto">
        <div className="rounded-2xl bg-panel backdrop-blur-md border border-border p-3">
          {/* Mode Toggle */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'narrative' | 'ooc')} className="mb-2">
            <TabsList className="h-8">
              <TabsTrigger value="narrative" className="text-xs px-3">
                <Swords className="h-3 w-3 mr-1" />
                Narrative
              </TabsTrigger>
              <TabsTrigger value="ooc" className="text-xs px-3">
                <MessageSquare className="h-3 w-3 mr-1" />
                OOC
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Content Area - swaps based on mode */}
          <div className="min-h-[60px] max-h-[200px] overflow-y-auto mb-2">
            {mode === 'narrative' ? (
              <InlineBlockEditor blocks={blocks} onChange={setBlocks} />
            ) : (
              <Textarea
                value={oocText}
                onChange={(e) => setOocText(e.target.value)}
                placeholder="Write out-of-character notes..."
                className="min-h-[60px] bg-transparent border-none resize-none"
              />
            )}
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between border-t border-border/50 pt-2">
            {/* Left: Block controls (only in narrative mode) */}
            <div className="flex items-center gap-1">
              {mode === 'narrative' && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => addBlock('action')}>
                    <Swords className="h-4 w-4 mr-1" />
                    Action
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => addBlock('dialog')}>
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Dialog
                  </Button>
                </>
              )}
              {settings.hiddenPosts && (
                <Button
                  variant="ghost"
                  size="icon"
                  title="Attempt hidden action"
                  onClick={() => setIsHidden(!isHidden)}
                  className={isHidden ? 'text-amber-500' : ''}
                >
                  <EyeOff className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Right: Lock and send */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={hasLock ? releaseLock : acquireLock}
                title={hasLock ? 'Release lock' : 'Acquire lock'}
              >
                {hasLock ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </Button>
              {hasLock && <LockTimerBar remainingSeconds={remainingSeconds} />}
              <Button
                size="icon"
                disabled={!hasLock || !hasContent}
                className="bg-primary hover:bg-primary/90"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

### Lock Timer Bar

A slim progress bar showing remaining lock time. Fills from left to right, turns red when time is running out.

```tsx
function LockTimerBar({ remainingSeconds }: { remainingSeconds: number }) {
  const maxSeconds = 600 // 10 minutes
  const percentage = (remainingSeconds / maxSeconds) * 100
  const isWarning = remainingSeconds < 120 // < 2 minutes

  return (
    <div
      className="w-20 h-1 bg-muted rounded-full overflow-hidden"
      title={`${Math.floor(remainingSeconds / 60)}:${(remainingSeconds % 60).toString().padStart(2, '0')} remaining`}
    >
      <div
        className={`h-full transition-all duration-1000 ${
          isWarning ? 'bg-destructive' : 'bg-primary'
        }`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}
```

#### Timer Bar States

| State | Condition | Color | Behavior |
|-------|-----------|-------|----------|
| Normal | >= 2 minutes | `bg-primary` | Slowly draining |
| Warning | < 2 minutes | `bg-destructive` | Red, draining faster |
| Expired | 0 seconds | - | Lock lost, toast shown |
| No Lock | Not holding | Hidden | Bar not rendered |

### Position and Padding

The composer is fixed to the bottom. Ensure posts have enough bottom padding:

```tsx
// Posts container
<div className="flex flex-col gap-6 p-6 max-w-[800px] mx-auto pb-32">
  {posts.map(post => <PostCard key={post.id} post={post} />)}
</div>

// Composer (fixed)
<PostComposer sceneId={sceneId} character={character} settings={settings} />
```

### Mobile Considerations

On mobile, the composer takes full width with smaller padding:

```tsx
<div className="fixed bottom-0 left-0 right-0 p-2 md:p-4">
  <div className="mx-auto max-w-[800px]">
    <div className="rounded-xl md:rounded-2xl bg-panel backdrop-blur-md border border-border p-2 md:p-3">
      {/* ... */}
    </div>
  </div>
</div>
```

---

## Minimal UI Chrome

### Back Button

Tiny, unobtrusive, but accessible:

```tsx
<Button
  variant="ghost"
  size="icon"
  className="fixed top-4 left-4 w-10 h-10 rounded-full bg-panel border border-border z-20"
  onClick={() => navigate(-1)}
>
  <ChevronLeft className="h-5 w-5" />
</Button>
```

### Overflow Menu

For scene settings, sharing, etc. — hidden behind icon:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button
      variant="ghost"
      size="icon"
      className="fixed top-4 right-4 w-10 h-10 rounded-full bg-panel border border-border z-20"
    >
      <MoreHorizontal className="h-5 w-5" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem>Scene Settings</DropdownMenuItem>
    <DropdownMenuItem>Share Scene</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

## Scene Roster

The Scene Roster is a collapsible side panel that shows characters present in the scene, the current phase, and pass status. It provides an immersive, RPG-style interface for scene participation — like a party panel from classic RPGs.

### Design Principles

- **Immersive** - Styled like a party panel, fits the scene's aesthetic
- **Informative** - At-a-glance view of who's present and their status
- **Interactive** - Players can set pass status, GMs can manage roster
- **Unobtrusive** - Collapsible to preserve scene immersion

### Roster Layout

```
┌────────────────────────────────────┐
│  ═══════ PC PHASE ═══════         │  ← Phase banner
├────────────────────────────────────┤
│                                    │
│  ┌────┐  Kira Shadowmend          │  ← Character row
│  │    │  Ranger           [✓ Pass] │
│  │port│                            │
│  └────┘                            │
│                                    │
│  ┌────┐  Theron Brightweave       │
│  │    │  Mage             [Waiting]│
│  │port│                            │
│  └────┘                            │
│                                    │
│  ┌────┐  Vex the Quick            │
│  │    │  Rogue            [🔒Hard] │
│  │port│                            │
│  └────┘                            │
│                                    │
├────────────────────────────────────┤
│  [+ Add Character]         (GM)    │  ← GM controls
└────────────────────────────────────┘
```

### Phase Banner

The phase banner sits at the top of the roster, providing constant visibility of the current game phase. Uses decorative separators for an RPG aesthetic.

```tsx
function PhaseBanner({ phase, isPaused }: PhaseBannerProps) {
  const isGMPhase = phase === 'gm_phase'

  if (isPaused) {
    return (
      <div className="text-center py-3 bg-muted border-b border-border">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Pause className="h-4 w-4" />
          <span className="text-sm font-medium tracking-wider uppercase">Paused</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'text-center py-3 border-b',
        isGMPhase
          ? 'bg-gm-phase/10 border-gm-phase/30 text-gm-phase'
          : 'bg-pc-phase/10 border-pc-phase/30 text-pc-phase'
      )}
    >
      <div className="flex items-center justify-center gap-2">
        {isGMPhase ? (
          <Crown className="h-4 w-4" />
        ) : (
          <Users className="h-4 w-4" />
        )}
        <span className="text-sm font-bold tracking-widest uppercase">
          {isGMPhase ? 'GM Phase' : 'PC Phase'}
        </span>
      </div>
    </div>
  )
}
```

**Phase Banner States:**

| Phase | Background | Text Color | Icon |
|-------|------------|------------|------|
| GM Phase | `bg-gm-phase/10` | `text-gm-phase` | `Crown` |
| PC Phase | `bg-pc-phase/10` | `text-pc-phase` | `Users` |
| Paused | `bg-muted` | `text-muted-foreground` | `Pause` |

### Character Roster Row

Each character in the roster displays as an immersive row with portrait, name, class, and pass status.

```tsx
function RosterCharacter({
  character,
  passState,
  isCurrentUser,
  isGM,
  onPassChange,
  onRemove,
}: RosterCharacterProps) {
  return (
    <div className="group relative flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
      {/* Portrait with pass indicator overlay */}
      <div className="relative shrink-0">
        <img
          src={character.avatarUrl}
          alt={character.name}
          className="w-12 h-14 object-cover rounded border border-border"
        />
        {/* Pass indicator badge on portrait corner */}
        {passState !== 'none' && (
          <div
            className={cn(
              'absolute -bottom-1 -right-1 w-5 h-5 rounded-full',
              'flex items-center justify-center border-2 border-card',
              passState === 'hard_passed'
                ? 'bg-amber-500 text-white'
                : 'bg-green-500 text-white'
            )}
          >
            {passState === 'hard_passed' ? (
              <Lock className="h-3 w-3" />
            ) : (
              <Check className="h-3 w-3" />
            )}
          </div>
        )}
      </div>

      {/* Character Info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate character-name">
          {character.name}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {character.class || character.type}
        </div>
      </div>

      {/* Pass Controls - only for current user's character */}
      {isCurrentUser && (
        <PassButton
          currentState={passState}
          onChange={onPassChange}
          size="sm"
        />
      )}

      {/* Read-only pass status for other characters */}
      {!isCurrentUser && passState !== 'none' && (
        <PassStatusBadge state={passState} />
      )}

      {/* Remove button - GM only, visible on hover */}
      {isGM && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-1 right-1"
          onClick={onRemove}
          title="Remove from scene"
        >
          <X className="h-3 w-3 text-destructive" />
        </Button>
      )}
    </div>
  )
}
```

### Pass Status Display

Pass status appears as a badge or indicator on each character:

| State | Display | Visual |
|-------|---------|--------|
| `none` | "Waiting" (muted text) | No badge, just text |
| `passed` | Green badge with Check | `bg-green-100 text-green-800` |
| `hard_passed` | Amber badge with Lock | `bg-amber-100 text-amber-800` |

**Read-only Pass Badge** (for other characters):

```tsx
function PassStatusBadge({ state }: { state: PassState }) {
  if (state === 'none') {
    return <span className="text-xs text-muted-foreground">Waiting</span>
  }

  return (
    <Badge
      variant="secondary"
      className={cn(
        'text-xs gap-1',
        state === 'hard_passed'
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      )}
    >
      {state === 'hard_passed' ? (
        <Lock className="h-3 w-3" />
      ) : (
        <Check className="h-3 w-3" />
      )}
      {state === 'hard_passed' ? 'Hard' : 'Pass'}
    </Badge>
  )
}
```

### Player Pass Controls

For the current user's character, show the interactive PassButton dropdown:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="sm" className="gap-1 h-7">
      <PassStateIcon state={currentState} />
      <ChevronDown className="h-3 w-3" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => onPassChange('none')}>
      <X className="mr-2 h-4 w-4" />
      Not Passing
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => onPassChange('passed')}>
      <Check className="mr-2 h-4 w-4" />
      Pass
      <span className="ml-2 text-xs text-muted-foreground">(cleared on post)</span>
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => onPassChange('hard_passed')}>
      <Lock className="mr-2 h-4 w-4" />
      Hard Pass
      <span className="ml-2 text-xs text-muted-foreground">(until phase ends)</span>
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### GM Controls: Add Character

GMs can add characters to the scene via a dialog:

```tsx
function AddCharacterButton({ campaignId, sceneId, onAdd }: AddCharacterButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
        >
          <UserPlus className="h-4 w-4" />
          Add Character
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Character to Scene</DialogTitle>
          <DialogDescription>
            Select a character to add to this scene.
          </DialogDescription>
        </DialogHeader>
        <CharacterSelector
          campaignId={campaignId}
          excludeSceneId={sceneId}
          onSelect={(char) => {
            onAdd(char.id)
            setOpen(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
```

### GM Controls: Remove Character

GMs can remove characters via hover action with confirmation:

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="ghost" size="icon" className="h-6 w-6">
      <X className="h-3 w-3 text-destructive" />
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Remove from Scene?</AlertDialogTitle>
      <AlertDialogDescription>
        Remove {character.name} from this scene? They can be added back later.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleRemove}>
        Remove
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Complete Scene Roster Component

```tsx
function SceneRoster({
  scene,
  characters,
  passStates,
  currentUserId,
  phase,
  isPaused,
  isGM,
  onPassChange,
  onAddCharacter,
  onRemoveCharacter,
}: SceneRosterProps) {
  return (
    <div className="w-64 bg-card border-l border-border flex flex-col h-full">
      {/* Phase Banner */}
      <PhaseBanner phase={phase} isPaused={isPaused} />

      {/* Character List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {characters.length === 0 ? (
          <div className="text-center py-8 px-4">
            <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground italic">
              No characters in this scene yet.
            </p>
            {isGM && (
              <p className="text-xs text-muted-foreground mt-1">
                Add characters to begin the narrative.
              </p>
            )}
          </div>
        ) : (
          characters.map((char) => (
            <RosterCharacter
              key={char.id}
              character={char}
              passState={passStates[char.id] || 'none'}
              isCurrentUser={char.playerId === currentUserId}
              isGM={isGM}
              onPassChange={(state) => onPassChange(char.id, state)}
              onRemove={() => onRemoveCharacter(char.id)}
            />
          ))
        )}
      </div>

      {/* GM Controls */}
      {isGM && (
        <div className="border-t border-border p-2">
          <AddCharacterButton
            campaignId={scene.campaignId}
            sceneId={scene.id}
            onAdd={onAddCharacter}
          />
        </div>
      )}
    </div>
  )
}
```

### Roster Toggle Button

The roster can be collapsed to maximize scene immersion:

```tsx
function RosterToggle({ isOpen, onToggle }: RosterToggleProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onToggle}
      className="fixed top-4 right-16 w-10 h-10 rounded-full bg-panel border border-border z-20"
      title={isOpen ? 'Hide roster' : 'Show roster'}
    >
      {isOpen ? (
        <PanelRightClose className="h-5 w-5" />
      ) : (
        <Users className="h-5 w-5" />
      )}
    </Button>
  )
}
```

### Layout Integration

The roster integrates as a sidebar in the scene view:

```tsx
function SceneView({ scene }: SceneViewProps) {
  const [rosterOpen, setRosterOpen] = useState(true)

  return (
    <div className="flex h-screen">
      {/* Main Scene Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <SceneHeader scene={scene} />
        <div className="flex-1 overflow-y-auto pb-32">
          <PostStream posts={posts} />
        </div>
        <PostComposer sceneId={scene.id} />
      </div>

      {/* Roster Sidebar */}
      {rosterOpen && (
        <SceneRoster
          scene={scene}
          characters={sceneCharacters}
          passStates={passStates}
          currentUserId={userId}
          phase={phase}
          isPaused={isPaused}
          isGM={isGM}
          onPassChange={handlePassChange}
          onAddCharacter={handleAddCharacter}
          onRemoveCharacter={handleRemoveCharacter}
        />
      )}

      {/* Roster Toggle */}
      <RosterToggle isOpen={rosterOpen} onToggle={() => setRosterOpen(!rosterOpen)} />
    </div>
  )
}
```

### Mobile Behavior

On mobile, the roster becomes a slide-out drawer using the Sheet component:

```tsx
// Desktop: inline sidebar (shown above)

// Mobile: Sheet drawer
<Sheet open={rosterOpen} onOpenChange={setRosterOpen}>
  <SheetTrigger asChild>
    <Button
      variant="ghost"
      size="icon"
      className="fixed top-4 right-4 w-10 h-10 rounded-full bg-panel border border-border z-20 md:hidden"
    >
      <Users className="h-5 w-5" />
    </Button>
  </SheetTrigger>
  <SheetContent side="right" className="w-72 p-0">
    <SceneRoster {...rosterProps} />
  </SheetContent>
</Sheet>
```

**Responsive Pattern:**
- Desktop (md+): Inline sidebar, always visible or toggled
- Mobile: Hidden by default, accessible via Sheet drawer

### Roster Icons Reference

| Icon | Usage |
|------|-------|
| `Crown` | GM Phase indicator |
| `Users` | PC Phase indicator, roster toggle, empty state |
| `Pause` | Paused phase |
| `Check` | Passed status |
| `Lock` | Hard passed status |
| `X` | Remove character, not passing option |
| `UserPlus` | Add character button |
| `PanelRightClose` | Close roster toggle |
| `ChevronDown` | Pass dropdown trigger |

---

## Post Blocks (Action vs Dialog)

Posts in Vanguard PBP are composed of blocks. Each block can be either an **action** (narrative description) or **dialog** (spoken words).

### Block Types

| Type | Description | Visual Treatment |
|------|-------------|------------------|
| Action | Narrative description of what character does | Normal text |
| Dialog | Character's spoken words | Italic text with left border, wrapped in quotes |

### Block Editor (Composer)

```tsx
<div className="group relative rounded-lg border p-3">
  <div className="mb-2 flex items-center gap-2">
    <div className="cursor-move text-muted-foreground">
      <GripVertical className="h-4 w-4" />
    </div>
    <Select value={block.type} onValueChange={handleTypeChange}>
      <SelectTrigger className="w-[120px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="action">
          <div className="flex items-center gap-2">
            <Swords className="h-3 w-3" />
            Action
          </div>
        </SelectItem>
        <SelectItem value="dialog">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-3 w-3" />
            Dialog
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
    <div className="flex-1" />
    <Button
      variant="ghost"
      size="sm"
      onClick={onRemove}
      className="opacity-0 group-hover:opacity-100 transition-opacity"
    >
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  </div>
  <Textarea
    value={block.content}
    placeholder={block.type === 'action' ? 'Describe the action...' : 'Write dialogue...'}
    className={block.type === 'dialog' ? 'italic' : ''}
  />
</div>
```

### Block Display (Reading)

```tsx
// Action block
<p className="text-foreground">{block.content}</p>

// Dialog block
<p className="text-foreground italic pl-4 border-l-2 border-primary/30">
  "{block.content}"
</p>
```

---

## Hidden Posts

When fog of war is enabled, players can submit hidden posts visible only to the GM until revealed.

### Hidden Post Indicator

```tsx
// In post card header
{post.isHidden && (
  <Badge variant="secondary" className="gap-1 text-xs">
    <EyeOff className="h-3 w-3" />
    Hidden
  </Badge>
)}
```

### Hidden Post Visual Treatment

```tsx
// Hidden post card styling
<div className={`rounded-lg border p-4 ${
  post.isHidden ? 'border-dashed bg-muted/30' : ''
}`}>
```

### Hidden Post Placeholder (for non-GM, non-owner)

```tsx
<div className="rounded-lg border border-dashed p-4 opacity-50">
  <div className="flex items-center gap-2 text-muted-foreground">
    <EyeOff className="h-4 w-4" />
    <span className="text-sm italic">Hidden post</span>
  </div>
</div>
```

### Hidden Post Toggle (Composer)

```tsx
{settings.hiddenPosts && (
  <div className="flex items-center justify-between rounded-lg border p-3">
    <div className="flex items-center gap-2">
      <EyeOff className="h-4 w-4 text-muted-foreground" />
      <div>
        <Label htmlFor="isHidden">Hidden Post</Label>
        <p className="text-xs text-muted-foreground">
          Only visible to GM until revealed
        </p>
      </div>
    </div>
    <Switch
      id="isHidden"
      checked={isHidden}
      onCheckedChange={setIsHidden}
    />
  </div>
)}
```

---

## Compose Lock

When a player opens the composer, they acquire a "compose lock" that prevents others from posting simultaneously. This ensures proper post ordering.

### Lock Timer Display

```tsx
<Badge variant={remainingSeconds < 120 ? 'destructive' : 'secondary'} className="gap-1">
  <Clock className="h-3 w-3" />
  {formatTime(remainingSeconds)}
</Badge>
```

### Lock Acquisition Loading State

```tsx
<Card>
  <CardContent className="flex items-center justify-center py-12">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    <span className="ml-2 text-muted-foreground">Acquiring compose lock...</span>
  </CardContent>
</Card>
```

### Lock Blocked State

```tsx
<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertDescription>
    Another player is currently composing a post. Please wait and try again.
  </AlertDescription>
</Alert>
```

### Auto-Save Indicator

```tsx
{isSaving && (
  <Badge variant="secondary" className="gap-1">
    <Save className="h-3 w-3" />
    Saving...
  </Badge>
)}
```

---

## OOC (Out of Character) Text

Players can add out-of-character notes to their posts. OOC content uses a toggle-based display pattern.

### OOC in Post Cards

Posts with OOC content show a toggle icon (`MessageSquare`) in the bottom-right corner. Clicking the icon swaps the view between narrative content and OOC text.

**Behavior:**
- Default view shows narrative blocks
- Clicking OOC icon shows OOC text instead of narrative
- Icon becomes `text-primary` when OOC is visible
- OOC text displays in muted, italic style

```tsx
// OOC Toggle Button in PostCard
{hasOOC && (
  <Button
    variant="ghost"
    size="icon"
    onClick={() => setShowOOC(!showOOC)}
    className={cn(
      "absolute bottom-4 right-4 h-6 w-6",
      showOOC && "text-primary"
    )}
    title={showOOC ? "Show narrative" : "Show OOC"}
  >
    <MessageSquare className="h-4 w-4" />
  </Button>
)}

// OOC Content Display (when toggled)
{showOOC && (
  <p className="text-sm text-muted-foreground italic">{post.oocText}</p>
)}
```

### OOC Input (Composer Mode Toggle)

The composer has a **mode toggle** that swaps between Narrative and OOC editing. This is a full view swap — you're either editing narrative blocks OR OOC text, never both simultaneously.

```tsx
<Tabs value={mode} onValueChange={setMode}>
  <TabsList className="h-8">
    <TabsTrigger value="narrative" className="text-xs px-3">
      <Swords className="h-3 w-3 mr-1" />
      Narrative
    </TabsTrigger>
    <TabsTrigger value="ooc" className="text-xs px-3">
      <MessageSquare className="h-3 w-3 mr-1" />
      OOC
    </TabsTrigger>
  </TabsList>
</Tabs>

{/* In OOC mode */}
{mode === 'ooc' && (
  <Textarea
    value={oocText}
    onChange={(e) => setOocText(e.target.value)}
    placeholder="Write out-of-character notes..."
    className="min-h-[60px] bg-transparent border-none resize-none"
  />
)}
```

**Key Points:**
- Both narrative and OOC are stored together on the post
- Mode toggle swaps the entire editing area
- OOC text is tied to that specific post
- Action/Dialog toolbar buttons are disabled in OOC mode

---

## Post Actions (GM)

GMs have additional actions available on posts.

### Post Dropdown Menu

```tsx
{(canDelete || canUnhide) && (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm">
        <MoreVertical className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      {canUnhide && (
        <DropdownMenuItem onClick={handleUnhideClick}>
          <Eye className="mr-2 h-4 w-4" />
          Reveal Post
        </DropdownMenuItem>
      )}
      {canDelete && (
        <DropdownMenuItem
          onClick={() => setShowDeleteDialog(true)}
          className="text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Post
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
)}
```

### Delete Confirmation Dialog

```tsx
<AlertDialog>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete Post</AlertDialogTitle>
      <AlertDialogDescription>
        Are you sure you want to delete this post? This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete} className="bg-destructive">
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## Post Card Header Structure

Complete post card header with all badges:

```tsx
<div className="flex items-start justify-between mb-3">
  <div className="flex items-center gap-3">
    <Avatar className="h-10 w-10">
      <AvatarImage src={post.characterAvatar || undefined} />
      <AvatarFallback>{getInitials(post.characterName)}</AvatarFallback>
    </Avatar>
    <div>
      <div className="flex items-center gap-2">
        <span className="font-semibold">{post.characterName}</span>
        <Badge variant="outline" className="text-xs">
          {post.characterType.toUpperCase()}
        </Badge>
        {post.isHidden && (
          <Badge variant="secondary" className="gap-1 text-xs">
            <EyeOff className="h-3 w-3" />
            Hidden
          </Badge>
        )}
        {post.isLocked && (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Lock className="h-3 w-3" />
            Locked
          </Badge>
        )}
      </div>
      <span className="text-xs text-muted-foreground">
        {formatDate(post.createdAt)}
      </span>
    </div>
  </div>
  {/* GM actions dropdown */}
</div>
```

---

## Roll Results in Posts

Rolls are displayed as a **badge in the upper-right corner** of post cards. The badge shows the intention and, when completed, the roll result. Clicking the badge opens a modal with full roll details.

### Roll Badge Positioning

```tsx
// In PostCard content area
<RollBadge
  intention={post.intention}
  roll={post.roll}
  onClick={() => setRollModalOpen(true)}
  className="absolute top-4 right-4"
/>
```

### Roll Badge States

| State | Display | Styling |
|-------|---------|---------|
| No intent | Hidden or subtle `+` icon | Ghost button, low opacity |
| Intent selected (no roll) | Badge: "Stealth" | Outline badge |
| GM requested roll | Badge: "Stealth" + `!` indicator | Yellow badge with indicator |
| Roll pending | Badge: "Stealth" | `bg-yellow-500/10 text-yellow-600` |
| Roll completed | Badge: "Stealth: 18" | `bg-green-500/10 text-green-600` + bold result |

### Roll Badge Component

```tsx
function RollBadge({ intention, roll, onClick, className }: RollBadgeProps) {
  if (!intention && !roll) return null

  const statusStyles = {
    pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    completed: 'bg-green-500/10 text-green-600 border-green-500/20',
    invalidated: 'bg-red-500/10 text-red-600 border-red-500/20',
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn('gap-1', roll && statusStyles[roll.status], className)}
    >
      <Dices className="h-3 w-3" />
      {intention || roll?.intention}
      {roll?.status === 'completed' && roll.total !== null && (
        <span className="font-bold">: {roll.total}</span>
      )}
    </Button>
  )
}
```

### Roll Modal

Clicking the roll badge opens a modal dialog. The modal shows either:
- **Existing roll**: Full roll details via `RollDisplay` component
- **No roll yet**: Roll creation form via `RollForm` component

```tsx
<Dialog open={rollModalOpen} onOpenChange={setRollModalOpen}>
  <DialogContent className="sm:max-w-[500px]">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <Dices className="h-5 w-5" />
        {roll ? 'Roll Details' : 'Create Roll'}
      </DialogTitle>
    </DialogHeader>
    {roll ? (
      <RollDisplay roll={roll} />
    ) : (
      <RollForm
        postId={post.id}
        systemPreset={systemPreset}
        onRollCreated={() => setRollModalOpen(false)}
      />
    )}
  </DialogContent>
</Dialog>
```

---

## Full Composer Layout

The messenger-style composer sits at the bottom of the scene view:

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ [≡] [Action ▼]                                          [🗑] │  │
│  │ Describe the action...                                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ [≡] [Dialog ▼]                                          [🗑] │  │
│  │ "Write dialogue here..." (italic)                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                    │
│  [⚔️ Action] [💬 Dialog] [👁️]              [🔒] ████░░░░░ [➤]    │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Expanded Composer (with optional fields visible)

When intention or OOC fields need to be shown, expand above the toolbar:

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│  [Block content area...]                                           │
│                                                                    │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                    │
│  Intention: [Select intention (optional)              ▼]           │
│  OOC:       [Add any OOC notes...                      ]           │
│                                                                    │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                    │
│  [⚔️][💬][👁️]                              [🔒] ████░░░░░ [➤]     │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Composer States

| State | Description | UI Treatment |
|-------|-------------|--------------|
| **Idle** | No lock, empty | Placeholder text, lock icon unlocked |
| **Acquiring** | Getting lock | Lock icon loading spinner |
| **Composing** | Has lock, writing | Timer bar visible, send enabled when content exists |
| **Hidden Mode** | Hidden toggle on | Eye icon highlighted (amber), subtle indicator |
| **Warning** | < 2 min left | Timer bar turns red |
| **Submitting** | Sending post | Send button shows spinner, inputs disabled |

---

## Icons Reference

### Composer Toolbar Icons

| Icon | Usage | Position |
|------|-------|----------|
| `Swords` | Add action block | Left toolbar |
| `MessageSquare` | Add dialog block | Left toolbar |
| `EyeOff` | Hidden action toggle | Left toolbar |
| `Lock` | Acquire compose lock (no lock held) | Right toolbar |
| `Unlock` | Release compose lock (lock held) | Right toolbar |
| `Send` | Submit post | Right toolbar |

### Post & Block Icons

| Icon | Usage |
|------|-------|
| `Swords` | Action block type indicator |
| `MessageSquare` | Dialog block type, OOC indicator |
| `EyeOff` | Hidden post badge |
| `Eye` | Reveal post action (GM) |
| `Lock` | Locked post indicator |
| `Trash2` | Delete/remove block or post |
| `MoreVertical` | Post actions menu |
| `GripVertical` | Block reorder handle |

### Status & Feedback Icons

| Icon | Usage |
|------|-------|
| `Save` | Auto-save indicator |
| `Clock` | Timer display (legacy) |
| `AlertCircle` | Error states |
| `Loader2` | Loading states (with `animate-spin`) |

---

## Empty States

### No Posts Yet

```tsx
<div className="text-center py-12">
  <p className="text-lg text-muted-foreground italic">
    The scene awaits its first moment...
  </p>
  <p className="text-sm text-muted-foreground mt-2">
    Begin the narrative below.
  </p>
</div>
```

Style should be subtle, centered, and **thematic** — not a stark "No data" message.

---

## Loading States

When posts are loading:

```tsx
function PostSkeleton() {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-4 p-6 bg-panel rounded-xl border border-border">
      <Skeleton className="w-20 h-[100px] rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  )
}
```

---

## Scroll Behavior

- Scene header can scroll away (or stay sticky with parallax)
- Posts scroll naturally
- If composer is fixed, ensure last post isn't hidden behind it (add `pb-32` to posts container)
- Consider "scroll to bottom" affordance for new posts

---

## Performance Considerations

- Lazy-load portrait images below the fold
- Virtualize long post lists (if scenes have 100+ posts)
- Scene background image: provide multiple resolutions, use `srcset`
- Consider reduced motion: `prefers-reduced-motion: reduce`

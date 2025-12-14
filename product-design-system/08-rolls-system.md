# Rolls System

This document defines the UI patterns for the dice rolling system in Vanguard PBP.

**Related Components**:
- `src/components/rolls/RollCard.tsx` - Pending roll card with GM actions
- `src/components/rolls/RollForm.tsx` - Roll creation form
- `src/components/rolls/RollDisplay.tsx` - Resolved roll display
- `src/components/rolls/IntentionSelector.tsx` - Intention dropdown
- `src/components/rolls/UnresolvedRollsDashboard.tsx` - GM dashboard
- `src/components/rolls/PendingRollsBadge.tsx` - Badge with count

---

## Design Principles

1. **Intention-First** - Rolls are always associated with a narrative intention
2. **GM Authority** - GMs can override intentions and manually resolve rolls
3. **Transparency** - Override history is visible to maintain trust
4. **Non-Blocking** - Rolls don't block post composition; they resolve during phase transitions

---

## Roll States

| State | Description | Color Treatment |
|-------|-------------|-----------------|
| Pending | Roll created, awaiting resolution | Yellow/amber |
| Completed | Roll resolved with result | Green |
| Invalidated | Roll canceled by GM | Red/muted |

### Color Tokens

The current implementation uses inline Tailwind colors. Use these patterns:

```tsx
// Pending state
className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"

// Completed state
className="bg-green-500/10 text-green-600 border-green-500/20"

// Invalidated state
className="bg-red-500/10 text-red-600 border-red-500/20"

// Override warning
className="text-amber-500"
```

**Future tokens** (aspirational):
```css
--roll-pending: 48 96% 53%;      /* Yellow */
--roll-success: 142 76% 36%;     /* Green */
--roll-failure: 0 84% 60%;       /* Red */
--roll-override: 38 92% 50%;     /* Amber */
```

---

## Components

### RollCard (Pending Rolls)

Used in the GM dashboard to display unresolved rolls with action buttons.

**Layout**:
```
┌─────────────────────────────────────────────┐
│ [Dice Icon] Character Name        [Pending] │
├─────────────────────────────────────────────┤
│ Intention Name                      2d20+5  │
│ Scene Title                                 │
│                                             │
│ [⚠ Override warning if applicable]         │
├─────────────────────────────────────────────┤
│              [Override] [Resolve] [Invalid] │  ← GM only
└─────────────────────────────────────────────┘
```

**Code Pattern**:
```tsx
<Card>
  <CardHeader className="pb-2">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Dices className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{roll.characterName}</span>
      </div>
      <Badge
        variant="outline"
        className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
      >
        Pending
      </Badge>
    </div>
  </CardHeader>

  <CardContent className="space-y-2">
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium">{roll.intention}</p>
        <p className="text-sm text-muted-foreground">{roll.sceneTitle}</p>
      </div>
      <div className="text-right text-sm text-muted-foreground">
        {roll.diceCount}{roll.diceType}
        {roll.modifier !== 0 && (
          <span className={roll.modifier > 0 ? 'text-green-600' : 'text-red-600'}>
            {roll.modifier > 0 ? '+' : ''}{roll.modifier}
          </span>
        )}
      </div>
    </div>

    {roll.wasOverridden && (
      <div className="flex items-center gap-2 text-xs text-amber-500">
        <AlertTriangle className="h-3 w-3" />
        Intention was overridden (original: {roll.originalIntention})
      </div>
    )}
  </CardContent>

  {isGM && (
    <CardFooter className="flex justify-end gap-2">
      <Button variant="outline" size="sm">
        <Edit className="h-4 w-4 mr-1" />
        Override
      </Button>
      <Button variant="outline" size="sm">
        <Check className="h-4 w-4 mr-1" />
        Resolve
      </Button>
      <Button variant="destructive" size="sm">
        <X className="h-4 w-4 mr-1" />
        Invalidate
      </Button>
    </CardFooter>
  )}
</Card>
```

### RollForm

Form for creating a new dice roll.

**Layout**:
```
┌─────────────────────────────────────────────┐
│ [Dice Icon] Create Dice Roll                │
├─────────────────────────────────────────────┤
│ Intention                                   │
│ [Dropdown with intentions        ▼]        │
│                                             │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│ │Dice Count│ │Dice Type │ │ Modifier │     │
│ │    1     │ │   d20  ▼│ │    0     │     │
│ └──────────┘ └──────────┘ └──────────┘     │
│                                             │
│              Rolling: 1d20                  │
├─────────────────────────────────────────────┤
│ [Cancel]                      [Roll Dice]   │
└─────────────────────────────────────────────┘
```

**Code Pattern**:
```tsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Dices className="h-5 w-5" />
      Create Dice Roll
    </CardTitle>
  </CardHeader>

  <CardContent className="space-y-4">
    <IntentionSelector
      intentions={systemPreset.intentions}
      value={intention}
      onChange={setIntention}
    />

    <div className="grid grid-cols-3 gap-4">
      <div className="space-y-2">
        <Label>Dice Count</Label>
        <Input type="number" min={1} max={100} value={diceCount} />
      </div>
      <div className="space-y-2">
        <Label>Dice Type</Label>
        <Select value={diceType} onValueChange={setDiceType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'].map(type => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Modifier</Label>
        <Input type="number" min={-100} max={100} value={modifier} />
      </div>
    </div>

    <div className="text-center text-sm text-muted-foreground">
      Rolling: {diceCount}{diceType}
      {modifier !== 0 && (
        <span className={modifier > 0 ? 'text-green-600' : 'text-red-600'}>
          {modifier > 0 ? '+' : ''}{modifier}
        </span>
      )}
    </div>
  </CardContent>

  <CardFooter className="flex justify-between">
    <Button variant="outline" onClick={onCancel}>Cancel</Button>
    <Button onClick={handleSubmit} disabled={!intention}>
      <Dices className="mr-2 h-4 w-4" />
      Roll Dice
    </Button>
  </CardFooter>
</Card>
```

### RollDisplay

Displays a resolved roll result. Supports compact and full modes.

**Compact Mode** (inline in posts):
```tsx
<Badge variant="outline" className={cn('gap-1', statusColor[roll.status])}>
  {statusIcon[roll.status]}
  {roll.intention}
  {roll.status === 'completed' && roll.total !== null && (
    <span className="font-bold">: {roll.total}</span>
  )}
</Badge>
```

**Full Mode** (standalone):
```
┌─────────────────────────────────────────────┐
│ [Completed]  Character Name       2d20+5   │
├─────────────────────────────────────────────┤
│ Attack [Overridden]                    17   │
│ Original: Defend                   [4, 13]  │
│                                    [Manual] │
│ Override reason: Changed to match action... │
└─────────────────────────────────────────────┘
```

**Code Pattern**:
```tsx
<div className="rounded-lg border bg-card p-3 space-y-2">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <Badge variant="outline" className={cn('gap-1', statusColor[roll.status])}>
        {statusIcon[roll.status]}
        {roll.status}
      </Badge>
      {showCharacter && (
        <span className="text-sm font-medium">{roll.characterName}</span>
      )}
    </div>
    <span className="text-xs text-muted-foreground">
      {roll.diceCount}{roll.diceType}
      {roll.modifier !== 0 && (
        <span className={roll.modifier > 0 ? 'text-green-600' : 'text-red-600'}>
          {roll.modifier > 0 ? '+' : ''}{roll.modifier}
        </span>
      )}
    </span>
  </div>

  <div className="flex items-center justify-between">
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="font-medium">{roll.intention}</span>
        {roll.wasOverridden && (
          <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/20">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Overridden
          </Badge>
        )}
      </div>
    </div>

    {roll.status === 'completed' && roll.total !== null && (
      <div className="text-right">
        <div className="text-2xl font-bold">{roll.total}</div>
        {roll.result && roll.result.length > 1 && (
          <div className="text-xs text-muted-foreground">
            [{roll.result.join(', ')}]
          </div>
        )}
      </div>
    )}
  </div>
</div>
```

### RollBadge (Post Cards)

A compact clickable badge that appears in the **upper-right corner of post cards**. Shows the intention and roll result, and opens a modal when clicked.

**Usage:** This component is positioned absolutely within the post card content area.

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ ┌──────────┐                          [Stealth: 18] │  ← RollBadge here
│ │ PORTRAIT │  CHARACTER NAME                        │
│ │          │  Post content...                       │
│ └──────────┘                                        │
└─────────────────────────────────────────────────────┘
```

**States:**

| State | Display | Styling | Click Action |
|-------|---------|---------|--------------|
| No intent | Hidden or subtle `+` | Ghost button, `opacity-30` | Opens roll modal |
| Intent selected | Badge: "Stealth" | Outline badge | Opens roll modal |
| GM requested | Badge: "Stealth" + `!` | Yellow badge + indicator | Opens roll modal |
| Roll pending | Badge: "Stealth" | `bg-yellow-500/10 text-yellow-600` | Opens roll modal |
| Roll completed | Badge: "Stealth: 18" | `bg-green-500/10 text-green-600` + bold result | Opens roll modal |

**Component:**

```tsx
interface RollBadgeProps {
  intention: string | null
  roll: Roll | null
  onClick: () => void
  className?: string
}

function RollBadge({ intention, roll, onClick, className }: RollBadgeProps) {
  // No intention and no roll - optionally show subtle add button
  if (!intention && !roll) {
    return null // Or subtle "+" button for creating roll
  }

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

**Integration with PostCard:**

```tsx
// In PostCard component
const [rollModalOpen, setRollModalOpen] = useState(false)

<div className="relative p-4">
  {/* Roll Badge - positioned upper right */}
  <RollBadge
    intention={post.intention}
    roll={post.roll}
    onClick={() => setRollModalOpen(true)}
    className="absolute top-4 right-4"
  />

  {/* ... rest of post content */}
</div>

<RollModal
  open={rollModalOpen}
  onOpenChange={setRollModalOpen}
  post={post}
  roll={post.roll}
/>
```

**RollModal:**

A dialog that shows either roll details (if roll exists) or a roll creation form.

```tsx
function RollModal({ open, onOpenChange, post, roll }: RollModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            onRollCreated={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
```

---

### IntentionSelector

Dropdown for selecting roll intention.

```tsx
<div className="space-y-2">
  <Label>{label}</Label>
  <Select
    value={value || 'none'}
    onValueChange={(v) => onChange(v === 'none' ? null : v)}
    disabled={disabled}
  >
    <SelectTrigger>
      <SelectValue placeholder="Select intention" />
    </SelectTrigger>
    <SelectContent>
      {showNoRoll && <SelectItem value="none">No roll</SelectItem>}
      {intentions.map((intention) => (
        <SelectItem key={intention} value={intention}>
          {intention}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

### UnresolvedRollsDashboard

GM dashboard showing all pending rolls in a campaign.

**Layout**:
```
┌─────────────────────────────────────────────┐
│ [Dice] Pending Rolls                    [3] │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ [RollCard 1]                            │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ [RollCard 2]                            │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ [RollCard 3]                            │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Code Pattern**:
```tsx
<Card>
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle className="flex items-center gap-2">
        <Dices className="h-5 w-5" />
        Pending Rolls
      </CardTitle>
      {unresolvedRolls.length > 0 && (
        <Badge variant="secondary">{unresolvedRolls.length}</Badge>
      )}
    </div>
  </CardHeader>
  <CardContent>
    {unresolvedRolls.length === 0 ? (
      <p className="text-sm text-muted-foreground text-center py-4">
        No pending rolls
      </p>
    ) : (
      <div className="space-y-4">
        {unresolvedRolls.map((roll) => (
          <RollCard
            key={roll.id}
            roll={roll}
            intentions={systemPreset.intentions}
            isGM={isGM}
          />
        ))}
      </div>
    )}
  </CardContent>
</Card>
```

### PendingRollsBadge

Shows count of pending rolls in navigation/headers.

```tsx
<Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">
  {count}
</Badge>
```

---

## GM Actions

### Override Intention

When a player selects an inappropriate intention, the GM can override it.

**Dialog Pattern**:
```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button variant="outline" size="sm">
      <Edit className="h-4 w-4 mr-1" />
      Override
    </Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Override Roll Intention</DialogTitle>
      <DialogDescription>
        Change the intention for this roll. The original intention will be preserved for reference.
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>New Intention</Label>
        <Select value={newIntention} onValueChange={setNewIntention}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {intentions.map((intention) => (
              <SelectItem key={intention} value={intention}>{intention}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Reason</Label>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain why you're overriding this intention..."
        />
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      <Button onClick={handleOverride}>Override</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Manual Resolve

GM can set a specific result instead of letting dice roll.

**Dialog Pattern**:
```tsx
<Dialog>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Manually Resolve Roll</DialogTitle>
      <DialogDescription>
        Set a specific result for this roll instead of letting it roll automatically.
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Result Value</Label>
        <Input
          type="number"
          value={result}
          onChange={(e) => setResult(parseInt(e.target.value) || 0)}
        />
      </div>
      <div className="space-y-2">
        <Label>Reason</Label>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain why you're manually resolving this roll..."
        />
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      <Button onClick={handleResolve}>Resolve</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Invalidate

Cancel a roll entirely.

```tsx
<Button
  variant="destructive"
  size="sm"
  onClick={handleInvalidate}
>
  <X className="h-4 w-4 mr-1" />
  Invalidate
</Button>
```

---

## Icons

Use these Lucide icons consistently:

| Icon | Usage |
|------|-------|
| `Dices` | Roll icon, form headers |
| `Check` | Completed status, resolve action |
| `X` | Invalidated status, invalidate action |
| `Edit` | Override action |
| `AlertTriangle` | Override warning indicator |
| `AlertCircle` | Error states |
| `Loader2` | Loading states (with `animate-spin`) |

---

## Loading States

### Form Submission
```tsx
<Button disabled={isLoading}>
  {isLoading ? (
    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  ) : (
    <Dices className="mr-2 h-4 w-4" />
  )}
  {isLoading ? 'Rolling...' : 'Roll Dice'}
</Button>
```

### Dashboard Loading
```tsx
<Card>
  <CardHeader>
    <CardTitle>Pending Rolls</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <Skeleton className="h-24 w-full" />
    <Skeleton className="h-24 w-full" />
  </CardContent>
</Card>
```

---

## Empty States

### No Pending Rolls
```tsx
<p className="text-sm text-muted-foreground text-center py-4">
  No pending rolls
</p>
```

### No Intentions Configured
```tsx
// IntentionSelector returns null if no intentions
if (!intentions || intentions.length === 0) {
  return null
}
```

---

## Error States

### Failed to Load
```tsx
<div className="flex items-center gap-2 text-destructive">
  <AlertCircle className="h-4 w-4" />
  <span>Failed to load pending rolls</span>
</div>
```

### Validation Error (Toast)
```tsx
toast({
  variant: 'destructive',
  title: 'Intention required',
  description: 'Please select an intention for your roll.',
})
```

---

## Modifier Display

Always show modifier with appropriate color:

```tsx
{modifier !== 0 && (
  <span className={modifier > 0 ? 'text-green-600' : 'text-red-600'}>
    {modifier > 0 ? '+' : ''}{modifier}
  </span>
)}
```

---

## Accessibility

- Use `aria-label` on icon-only buttons
- Include screen reader text for status indicators
- Ensure dialogs trap focus properly (handled by Radix Dialog)

```tsx
// Override warning with accessible label
<span className="cursor-help" aria-label="Intention was overridden by GM">
  <AlertTriangle className="h-3 w-3 text-amber-500" />
</span>
```

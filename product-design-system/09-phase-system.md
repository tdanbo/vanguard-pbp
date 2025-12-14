# Phase System

This document defines the UI patterns for the game phase management system in Vanguard PBP.

**Related Components**:
- `src/components/phase/PhaseIndicator.tsx` - Phase badge display
- `src/components/phase/PhaseTransitionButton.tsx` - GM transition controls
- `src/components/phase/TimeGateCountdown.tsx` - Time remaining display
- `src/components/phase/PassButton.tsx` - Player pass controls
- `src/components/phase/CampaignPassOverview.tsx` - Pass status dashboard

---

## Design Principles

1. **Phase Prominence** - Current phase should be immediately visible
2. **Time Awareness** - Players need clear countdown visibility
3. **Pass Transparency** - All participants can see pass status
4. **GM Authority** - Only GMs can transition phases

---

## Phase States

| Phase | Description | Visual Treatment |
|-------|-------------|------------------|
| GM Phase | GM is setting the scene, players wait | Purple badge with Crown icon |
| PC Phase | Players can post and roll | Green badge with Users icon |
| Paused | Campaign is on hold | Gray badge with Pause icon |

### Color Tokens

Use the implemented phase tokens:

```css
/* CSS Variables (implemented) */
--gm-phase: 280 60% 50%;     /* Purple */
--pc-phase: 142 76% 36%;     /* Green */
--passed: 210 40% 60%;       /* Blue */
--hard-passed: 215 20% 50%;  /* Muted blue */
```

```tsx
/* Tailwind usage */
bg-gm-phase text-gm-phase
bg-pc-phase text-pc-phase
bg-passed text-passed
bg-hard-passed text-hard-passed
```

---

## Components

### PhaseIndicator

Displays the current phase with optional details.

**Sizes**:
| Size | Class | Icon Size | Text |
|------|-------|-----------|------|
| sm | `text-xs px-2 py-0.5` | `h-3 w-3` | 12px |
| md | `text-sm px-2.5 py-1` | `h-4 w-4` | 14px |
| lg | `text-base px-3 py-1.5` | `h-5 w-5` | 16px |

**Basic Usage**:
```tsx
<PhaseIndicator phase="gm_phase" />
<PhaseIndicator phase="pc_phase" />
<PhaseIndicator phase="pc_phase" isPaused />
```

**With Details** (shows pass count and blockers):
```tsx
<PhaseIndicator
  phase="pc_phase"
  phaseStatus={phaseStatus}
  showDetails={true}
/>
```

**Layout**:
```
┌───────────────────────────────────────────────┐
│ [Crown] GM Phase                              │  ← GM Phase
└───────────────────────────────────────────────┘

┌───────────────────────────────────────────────┐
│ [Users] PC Phase   2/5 passed  [!] Blocked    │  ← PC Phase with details
└───────────────────────────────────────────────┘

┌───────────────────────────────────────────────┐
│ [Pause] Paused                                │  ← Paused state
└───────────────────────────────────────────────┘
```

**Code Pattern**:
```tsx
const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
}

const iconSizes = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
}

// Paused state
if (isPaused) {
  return (
    <Badge variant="secondary" className={cn(sizeClasses[size], 'gap-1.5')}>
      <Pause className={iconSizes[size]} />
      Paused
    </Badge>
  )
}

// Active phase
const PhaseIcon = isGMPhase ? Crown : Users
return (
  <Badge
    variant={isGMPhase ? 'secondary' : 'default'}
    className={cn(sizeClasses[size], 'gap-1.5')}
  >
    <PhaseIcon className={iconSizes[size]} />
    {isGMPhase ? 'GM Phase' : 'PC Phase'}
  </Badge>
)
```

### PhaseTransitionButton

GM control for transitioning between phases.

**States**:
1. **Normal** - Button enabled for transition
2. **Blocked** - Transition blocked with reason, shows force option
3. **Loading** - Transition in progress

**Normal Layout**:
```
┌─────────────────────────────┐
│ [→] Go to PC Phase          │
└─────────────────────────────┘
```

**Blocked Layout**:
```
┌─────────────────────────────┐
│ [→] Go to PC Phase          │  ← disabled
└─────────────────────────────┘
Blocked: Player is composing
┌─────────────────────────────┐
│ [!] Force Transition        │  ← amber warning style
└─────────────────────────────┘
```

**Code Pattern**:
```tsx
// Normal transition button
<Button onClick={handleTransition} className="gap-2">
  {isTransitioning ? (
    <>
      <Loader2 className="h-4 w-4 animate-spin" />
      Transitioning...
    </>
  ) : (
    <>
      <ArrowRight className="h-4 w-4" />
      Go to {targetLabel}
    </>
  )}
</Button>

// Blocked state with force option
<div className="flex flex-col gap-2">
  <Button variant="outline" disabled className="gap-2">
    <ArrowRight className="h-4 w-4" />
    Go to {targetLabel}
  </Button>
  <p className="text-xs text-muted-foreground">
    Blocked: {phaseStatus.transitionBlock}
  </p>
  <Button variant="ghost" size="sm" className="gap-1 text-amber-600">
    <AlertTriangle className="h-3 w-3" />
    Force Transition
  </Button>
</div>
```

**Force Transition Dialog**:
```tsx
<AlertDialog>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Force Phase Transition?</AlertDialogTitle>
      <AlertDialogDescription className="space-y-2">
        <p>You are about to force a phase transition while the following condition is active:</p>
        <p className="font-medium text-amber-600">{transitionBlock}</p>
        <p>This may interrupt players who are currently composing posts...</p>
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction className="bg-amber-600 hover:bg-amber-700">
        Force Transition
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### TimeGateCountdown

Displays remaining time in the current phase.

**States**:
| State | Condition | Visual |
|-------|-----------|--------|
| Normal | > 6 hours remaining | Gray pill, Clock icon |
| Urgent | < 6 hours remaining | Amber pill, Clock icon |
| Expired | Time passed | Red pill, AlertTriangle icon |

**Layout**:
```
[Clock] 2d 14h     ← Normal
[Clock] 5h 30m     ← Normal
[Clock] 45m        ← Urgent (amber)
[!] Expired        ← Expired (red)
```

**Code Pattern**:
```tsx
<div
  className={cn(
    'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
    isExpired
      ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
      : isUrgent
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200'
        : 'bg-muted text-muted-foreground'
  )}
>
  {isExpired ? (
    <AlertTriangle className="h-3 w-3" />
  ) : (
    <Clock className="h-3 w-3" />
  )}
  <span>{timeLeft}</span>
</div>
```

**Time Formatting**:
```tsx
function formatTimeLeft(diff: number): string {
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}
```

**TimeGateInfo** (combined preset + countdown):
```tsx
<div className="flex items-center gap-3">
  <span className="text-xs text-muted-foreground">
    Time gate: 24 hours
  </span>
  <TimeGateCountdown expiresAt={expiresAt} />
</div>
```

### PassButton

Dropdown for players to set their pass state.

**Pass States**:
| State | Description | Visual |
|-------|-------------|--------|
| none | Not passing, will post | No badge |
| passed | Soft pass, cleared on post | Green badge with Check |
| hard_passed | Hard pass, until phase ends | Amber badge with Lock |

**Layout**:
```
┌──────────────────────┐
│ [Check] Passed  [▼]  │
└──────────────────────┘
        │
        ▼
┌──────────────────────────────────────────┐
│ [X] Not Passing                          │
│ [Check] Pass      (cleared on post)      │
│ [Lock] Hard Pass  (stays until phase end)│
└──────────────────────────────────────────┘
```

**Code Pattern**:
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button
      variant={currentState === 'none' ? 'outline' : 'secondary'}
      size="sm"
      className="gap-1"
    >
      <PassStateIcon state={currentState} />
      <span className="text-xs">
        {currentState === 'none' ? 'Pass' : currentState === 'hard_passed' ? 'Hard Pass' : 'Passed'}
      </span>
      <ChevronDown className="h-3 w-3" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => handleSetPass('none')}>
      <X className="mr-2 h-4 w-4" />
      Not Passing
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => handleSetPass('passed')}>
      <Check className="mr-2 h-4 w-4" />
      Pass
      <span className="ml-2 text-xs text-muted-foreground">(cleared on post)</span>
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => handleSetPass('hard_passed')}>
      <Lock className="mr-2 h-4 w-4" />
      Hard Pass
      <span className="ml-2 text-xs text-muted-foreground">(stays until phase end)</span>
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Read-Only Display** (when user can't modify):
```tsx
<div
  className={cn(
    'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
    state === 'hard_passed'
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
      : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  )}
>
  <PassStateIcon state={state} />
  <span>{state === 'hard_passed' ? 'Hard Pass' : 'Passed'}</span>
</div>
```

### CampaignPassOverview

Dashboard showing pass status of all characters.

**Layout**:
```
┌───────────────────────────────────────────────────┐
│ [Users] Pass Status                 [All Passed]  │
│ 3 of 5 characters have passed                     │
├───────────────────────────────────────────────────┤
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░  60%             │
│                                                   │
│ ┌───────────────────────────────────────────────┐ │
│ │ Character Name                        [Passed]│ │
│ │ Scene Title                                   │ │
│ └───────────────────────────────────────────────┘ │
│ ┌───────────────────────────────────────────────┐ │
│ │ Another Character              [Hard Pass]    │ │
│ │ Different Scene                               │ │
│ └───────────────────────────────────────────────┘ │
│ ┌───────────────────────────────────────────────┐ │
│ │ Third Character                    [Waiting]  │ │
│ │ Some Scene                                    │ │
│ └───────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

**Code Pattern**:
```tsx
<Card>
  <CardHeader className="pb-3">
    <div className="flex items-center justify-between">
      <CardTitle className="flex items-center gap-2 text-base">
        <Users className="h-4 w-4" />
        Pass Status
      </CardTitle>
      {allPassed && (
        <Badge variant="default" className="gap-1 bg-green-600">
          <CheckCircle2 className="h-3 w-3" />
          All Passed
        </Badge>
      )}
    </div>
    <CardDescription>
      {passedCount} of {totalCount} characters have passed
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <Progress value={progressPercent} className="h-2" />
    <div className="space-y-2">
      {characters.map((char) => (
        <CharacterPassRow key={char.characterId} {...char} />
      ))}
    </div>
  </CardContent>
</Card>
```

**Character Row**:
```tsx
<div
  className={cn(
    'flex items-center justify-between rounded-lg border p-2',
    isPassed ? 'bg-muted/50' : 'bg-background'
  )}
>
  <div className="flex flex-col">
    <span className="text-sm font-medium">{characterName}</span>
    <span className="text-xs text-muted-foreground">{sceneTitle}</span>
  </div>
  <PassStateBadge state={passState} />
</div>
```

**Pass State Badges**:
```tsx
// Hard Passed
<Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
  <Lock className="h-3 w-3" />
  Hard Pass
</Badge>

// Passed
<Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
  <Check className="h-3 w-3" />
  Passed
</Badge>

// Waiting
<Badge variant="outline" className="gap-1 text-muted-foreground">
  Waiting
</Badge>
```

---

## Icons

| Icon | Usage |
|------|-------|
| `Crown` | GM phase indicator |
| `Users` | PC phase indicator, pass overview |
| `Pause` | Paused state |
| `Clock` | Time gate countdown |
| `AlertTriangle` | Expired time gate, warnings |
| `ArrowRight` | Phase transition action |
| `Check` | Passed state |
| `Lock` | Hard passed state |
| `X` | Not passing option |
| `ChevronDown` | Dropdown trigger |
| `CheckCircle2` | All passed indicator |
| `Loader2` | Loading states |

---

## Toast Messages

```tsx
// Phase transition success
toast({
  title: 'Phase transitioned',
  description: 'Campaign is now in PC Phase',
})

// Phase transition blocked
toast({
  title: 'Transition failed',
  description: error.message,
  variant: 'destructive',
})

// Pass set
toast({
  title: 'Pass set',
  description: 'Character Name is now passing',
})

// Hard pass set
toast({
  title: 'Hard pass set',
  description: 'Character Name is now hard passing',
})

// Pass cleared
toast({
  title: 'Pass cleared',
  description: 'Character Name is no longer passing',
})
```

---

## Empty States

### No Characters in Scene
```tsx
<p className="text-sm text-muted-foreground">
  No characters assigned to scenes yet.
</p>
```

### No Time Gate
```tsx
// TimeGateCountdown returns null if no expiresAt
if (!expiresAt) return null
```

---

## Accessibility

- Phase badges use semantic colors with sufficient contrast
- Dropdown menus support keyboard navigation
- Alert dialogs trap focus properly
- Icons have accompanying text labels
- Loading states include "Transitioning..." text for screen readers

```tsx
// Button with loading state is self-labeling
<Button disabled={isLoading}>
  {isLoading ? (
    <>
      <Loader2 className="h-4 w-4 animate-spin" />
      Transitioning...
    </>
  ) : (
    <>
      <ArrowRight className="h-4 w-4" />
      Go to PC Phase
    </>
  )}
</Button>
```

---

## Color Reference

| Element | Light Mode | Dark Mode |
|---------|------------|-----------|
| GM Phase badge | `bg-secondary` | `bg-secondary` |
| PC Phase badge | `bg-default` | `bg-default` |
| Pass (soft) | `bg-green-100 text-green-800` | `bg-green-900 text-green-200` |
| Pass (hard) | `bg-amber-100 text-amber-800` | `bg-amber-900 text-amber-200` |
| Time gate normal | `bg-muted text-muted-foreground` | Same |
| Time gate urgent | `bg-amber-100 text-amber-700` | `bg-amber-900 text-amber-200` |
| Time gate expired | `bg-red-100 text-red-700` | `bg-red-900 text-red-200` |
| Force button | `text-amber-600` | Same |
| All passed badge | `bg-green-600` | Same |

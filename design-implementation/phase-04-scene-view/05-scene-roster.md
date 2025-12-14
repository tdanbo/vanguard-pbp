# 4.5 Scene Roster

**Skill**: `shadcn-react`, `state-machine`

## Goal

Create the scene roster sidebar with phase banner, character list, and pass controls.

---

## Design References

- [05-scene-view.md](../../product-design-system/05-scene-view.md) - Lines 673-1155 for roster specs
- [09-phase-system.md](../../product-design-system/09-phase-system.md) - Phase and pass states

---

## Overview

The scene roster shows:
- Phase banner (GM Phase / PC Phase / Paused)
- List of characters in scene
- Pass state indicators on each character
- Pass controls for current user's characters
- GM controls for adding/removing characters

---

## Implementation

### SceneRoster Component

Create `src/components/scene/SceneRoster.tsx`:

```tsx
import { CharacterPortrait } from "@/components/character/CharacterPortrait"
import { PassBadge, PhaseBadge } from "@/components/ui/game-badges"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown, Plus, UserMinus } from "lucide-react"
import { cn } from "@/lib/utils"

interface SceneRosterProps {
  scene: {
    id: string
    currentPhase: "gm_phase" | "pc_phase" | "paused"
  }
  characters: Array<{
    id: string
    displayName: string
    avatarUrl?: string | null
    passState: "none" | "passed" | "hard_passed"
    isOwnedByUser: boolean
  }>
  isGM: boolean
  onPass: (characterId: string, state: "passed" | "hard_passed") => void
  onClearPass: (characterId: string) => void
}

export function SceneRoster({
  scene,
  characters,
  isGM,
  onPass,
  onClearPass,
}: SceneRosterProps) {
  return (
    <div className="bg-panel backdrop-blur-md rounded-lg border border-border/50 overflow-hidden">
      {/* Phase banner */}
      <PhaseBanner phase={scene.currentPhase} />

      {/* Character list */}
      <div className="p-2 space-y-1">
        {characters.map((character) => (
          <CharacterRow
            key={character.id}
            character={character}
            isGM={isGM}
            onPass={onPass}
            onClearPass={onClearPass}
          />
        ))}
      </div>

      {/* GM controls */}
      {isGM && (
        <div className="p-2 border-t border-border/30">
          <Button variant="ghost" size="sm" className="w-full justify-start">
            <Plus className="h-4 w-4 mr-2" />
            Add Character
          </Button>
        </div>
      )}
    </div>
  )
}
```

### PhaseBanner Component

```tsx
interface PhaseBannerProps {
  phase: "gm_phase" | "pc_phase" | "paused"
}

function PhaseBanner({ phase }: PhaseBannerProps) {
  const config = {
    gm_phase: {
      label: "GM Phase",
      className: "bg-gm-phase text-white",
    },
    pc_phase: {
      label: "PC Phase",
      className: "bg-pc-phase text-white",
    },
    paused: {
      label: "Paused",
      className: "bg-muted text-muted-foreground",
    },
  }[phase]

  return (
    <div className={cn("px-4 py-2 text-center font-medium", config.className)}>
      {config.label}
    </div>
  )
}
```

### CharacterRow Component

```tsx
interface CharacterRowProps {
  character: {
    id: string
    displayName: string
    avatarUrl?: string | null
    passState: "none" | "passed" | "hard_passed"
    isOwnedByUser: boolean
  }
  isGM: boolean
  onPass: (characterId: string, state: "passed" | "hard_passed") => void
  onClearPass: (characterId: string) => void
}

function CharacterRow({
  character,
  isGM,
  onPass,
  onClearPass,
}: CharacterRowProps) {
  const canControl = character.isOwnedByUser || isGM

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50">
      {/* Portrait with pass overlay */}
      <div className="relative">
        <CharacterPortrait
          src={character.avatarUrl}
          name={character.displayName}
          size="sm"
        />
        {character.passState !== "none" && (
          <div className="absolute -bottom-1 -right-1">
            <PassBadge state={character.passState} size="sm" />
          </div>
        )}
      </div>

      {/* Name */}
      <span className="flex-1 font-medium truncate">
        {character.displayName}
      </span>

      {/* Pass controls */}
      {canControl && (
        <PassDropdown
          passState={character.passState}
          onPass={(state) => onPass(character.id, state)}
          onClear={() => onClearPass(character.id)}
        />
      )}
    </div>
  )
}
```

### PassDropdown Component

```tsx
interface PassDropdownProps {
  passState: "none" | "passed" | "hard_passed"
  onPass: (state: "passed" | "hard_passed") => void
  onClear: () => void
}

function PassDropdown({ passState, onPass, onClear }: PassDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2">
          {passState === "none" ? "Pass" : "Change"}
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onPass("passed")}>
          Pass (soft)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPass("hard_passed")}>
          Hard Pass
        </DropdownMenuItem>
        {passState !== "none" && (
          <DropdownMenuItem onClick={onClear}>
            Clear Pass
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

---

## Desktop Sidebar

On desktop, roster is a sidebar:

```tsx
function SceneViewDesktop() {
  return (
    <div className="flex">
      <div className="flex-1">
        {/* Posts */}
      </div>
      <div className="w-64 shrink-0 p-4">
        <SceneRoster ... />
      </div>
    </div>
  )
}
```

## Mobile Sheet

On mobile, roster is a bottom sheet:

```tsx
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

function SceneViewMobile() {
  return (
    <>
      {/* ... posts ... */}

      <Sheet>
        <SheetTrigger asChild>
          <Button className="fixed bottom-20 right-4">
            <Users className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[60vh]">
          <SceneRoster ... />
        </SheetContent>
      </Sheet>
    </>
  )
}
```

---

## Success Criteria

- [ ] Phase banner shows correct state with color
- [ ] Characters listed with portraits
- [ ] Pass state shown as overlay badge
- [ ] Pass dropdown allows soft/hard pass
- [ ] GM can add/remove characters
- [ ] Desktop shows as sidebar
- [ ] Mobile shows as bottom sheet

# 2.3 Portrait & Avatar

**Skill**: `shadcn-react`

## Goal

Create the CharacterPortrait component with fallback system, and clarify portrait vs avatar usage.

---

## Design References

- [07-components.md](../../product-design-system/07-components.md) - Lines 289-416 for portrait patterns

---

## Overview

Vanguard differentiates between:

| Type | Shape | Usage |
|------|-------|-------|
| **Portrait** | Rectangular (4:5 ratio) | Character art in posts, rosters |
| **Avatar** | Circular | User avatars, small indicators |

---

## CharacterPortrait Component

### Create Component File

Create `src/components/character/CharacterPortrait.tsx`:

```tsx
import { cn } from "@/lib/utils"

interface CharacterPortraitProps {
  src?: string | null
  name: string
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeClasses = {
  sm: "w-12 h-15 text-sm",      // 48×60
  md: "w-20 h-[100px] text-lg",  // 80×100
  lg: "w-30 h-[150px] text-2xl", // 120×150
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase()
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

function getGradient(name: string): string {
  // Generate consistent gradient based on name
  const gradients = [
    "from-amber-900 to-amber-700",
    "from-emerald-900 to-emerald-700",
    "from-blue-900 to-blue-700",
    "from-purple-900 to-purple-700",
    "from-rose-900 to-rose-700",
    "from-cyan-900 to-cyan-700",
    "from-orange-900 to-orange-700",
    "from-indigo-900 to-indigo-700",
  ]
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return gradients[hash % gradients.length]
}

export function CharacterPortrait({
  src,
  name,
  size = "md",
  className,
}: CharacterPortraitProps) {
  const initials = getInitials(name)
  const gradient = getGradient(name)

  return (
    <div
      className={cn(
        "relative rounded-lg overflow-hidden border-2 border-border flex-shrink-0",
        sizeClasses[size],
        className
      )}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className={cn(
            "w-full h-full bg-gradient-to-br flex items-center justify-center font-display font-semibold text-white/90",
            gradient
          )}
        >
          {initials}
        </div>
      )}
    </div>
  )
}
```

### Usage Examples

```tsx
import { CharacterPortrait } from "@/components/character/CharacterPortrait"

// With image
<CharacterPortrait
  src="/avatars/aldric.jpg"
  name="Sir Aldric"
  size="md"
/>

// Fallback (no image)
<CharacterPortrait
  name="Doravar Redbraid"
  size="lg"
/>

// In a post card
<div className="flex gap-4">
  <CharacterPortrait src={character.avatar} name={character.name} size="md" />
  <div>
    <span className="character-name">{character.name}</span>
    <p>{post.content}</p>
  </div>
</div>
```

---

## Portrait Sizes

| Size | Dimensions | Use Case |
|------|------------|----------|
| `sm` | 48×60px | Roster lists, compact views |
| `md` | 80×100px | Post cards, default |
| `lg` | 120×150px | Scene roster expanded, character sheets |

---

## Avatar Component (User Avatars)

For user avatars (circular), use shadcn's Avatar:

```tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

<Avatar>
  <AvatarImage src={user.avatarUrl} alt={user.name} />
  <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
</Avatar>

// Sizes
<Avatar className="h-8 w-8">...</Avatar>   // Small
<Avatar className="h-10 w-10">...</Avatar> // Default
<Avatar className="h-12 w-12">...</Avatar> // Large
```

---

## Portrait with Full-Height Sidebar

For post cards with portrait extending full height:

```tsx
<div className="grid grid-cols-[80px_1fr] md:grid-cols-[120px_1fr] gap-0">
  {/* Portrait column with gradient fade */}
  <div className="relative">
    <CharacterPortrait
      src={character.avatar}
      name={character.name}
      size="lg"
      className="w-full h-full rounded-none"
    />
    {/* Gradient fade into content */}
    <div className="absolute inset-y-0 right-0 w-8 gradient-fade-right" />
  </div>

  {/* Content column */}
  <div className="p-4">
    <span className="character-name">{character.name}</span>
    <p>{post.content}</p>
  </div>
</div>
```

---

## Implementation Steps

### Step 1: Create Component

Create the file at `src/components/character/CharacterPortrait.tsx` with the code above.

### Step 2: Create Index Export

Create `src/components/character/index.ts`:

```tsx
export { CharacterPortrait } from "./CharacterPortrait"
```

### Step 3: Test Fallback System

Verify fallback displays:
- Correct initials (first + last initial)
- Consistent gradient per character name
- Readable text over gradient

### Step 4: Integrate in Existing Components

Replace any existing avatar usage in character contexts with CharacterPortrait:

- Post cards
- Scene roster
- Character management

---

## Success Criteria

- [ ] CharacterPortrait component created
- [ ] Three sizes (sm, md, lg) display correctly
- [ ] Fallback shows initials on gradient
- [ ] Gradient is consistent for same name
- [ ] Component integrates with existing post cards
- [ ] Full-height portrait with gradient fade works

# 5.1 Rolls Components

**Skill**: `dice-roller`

## Goal

Create the complete dice rolling UI including badges, cards, forms, and GM actions.

---

## Design References

- [08-rolls-system.md](../../product-design-system/08-rolls-system.md) - Complete rolls system specs

---

## Overview

The rolls system includes:
- **RollBadge** - Compact state indicator on posts
- **RollCard** - Full card for GM dashboard
- **RollForm** - Dice configuration form
- **IntentionSelector** - Dropdown for selecting intentions
- **RollModal** - Detail view when clicking badge

---

## RollBadge Component

Already created in Phase 2. Ensure it supports all states:

```tsx
<RollBadge state="pending" />           // Yellow, clock icon
<RollBadge state="completed" result={18} /> // Green, dice icon, shows result
<RollBadge state="invalidated" />       // Red, X icon
```

---

## RollCard Component

For GM dashboard showing unresolved rolls:

```tsx
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CharacterPortrait } from "@/components/character/CharacterPortrait"
import { RollBadge } from "@/components/ui/game-badges"
import { Clock, Edit2, Check, X } from "lucide-react"

interface RollCardProps {
  roll: {
    id: string
    intention: string
    modifier: number
    state: "pending" | "completed" | "invalidated"
    result?: number
    character: {
      displayName: string
      avatarUrl?: string | null
    }
    createdAt: string
  }
  onOverride: (rollId: string) => void
  onResolve: (rollId: string) => void
  onInvalidate: (rollId: string) => void
}

export function RollCard({
  roll,
  onOverride,
  onResolve,
  onInvalidate,
}: RollCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-4">
          <CharacterPortrait
            src={roll.character.avatarUrl}
            name={roll.character.displayName}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium truncate">
                {roll.character.displayName}
              </span>
              <RollBadge state={roll.state} result={roll.result} size="sm" />
            </div>
            <p className="text-sm text-muted-foreground">
              {roll.intention}
              {roll.modifier !== 0 && (
                <span className="ml-2">
                  ({roll.modifier >= 0 ? "+" : ""}{roll.modifier})
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              <Clock className="h-3 w-3 inline mr-1" />
              {formatRelativeTime(roll.createdAt)}
            </p>
          </div>
        </div>
      </CardContent>

      {roll.state === "pending" && (
        <CardFooter className="px-4 py-3 border-t flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onOverride(roll.id)}
          >
            <Edit2 className="h-4 w-4 mr-1" />
            Override
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onResolve(roll.id)}
          >
            <Check className="h-4 w-4 mr-1" />
            Resolve
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => onInvalidate(roll.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
```

---

## IntentionSelector Component

Dropdown for selecting roll intentions:

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface IntentionSelectorProps {
  intentions: Array<{ value: string; label: string }>
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function IntentionSelector({
  intentions,
  value,
  onChange,
  disabled,
}: IntentionSelectorProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select intention..." />
      </SelectTrigger>
      <SelectContent>
        {intentions.map((intention) => (
          <SelectItem key={intention.value} value={intention.value}>
            {intention.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// Default intentions (D&D 5e style)
export const DEFAULT_INTENTIONS = [
  { value: "attack", label: "Attack Roll" },
  { value: "ability", label: "Ability Check" },
  { value: "save", label: "Saving Throw" },
  { value: "damage", label: "Damage Roll" },
  { value: "skill", label: "Skill Check" },
  { value: "initiative", label: "Initiative" },
  { value: "other", label: "Other" },
]
```

---

## RollForm Component

Form for configuring a roll:

```tsx
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dice5 } from "lucide-react"

const rollSchema = z.object({
  intention: z.string().min(1, "Select an intention"),
  modifier: z.number().int().min(-100).max(100),
  diceCount: z.number().int().min(1).max(100).default(1),
})

type RollFormValues = z.infer<typeof rollSchema>

interface RollFormProps {
  intentions: Array<{ value: string; label: string }>
  onSubmit: (values: RollFormValues) => Promise<void>
}

export function RollForm({ intentions, onSubmit }: RollFormProps) {
  const form = useForm<RollFormValues>({
    resolver: zodResolver(rollSchema),
    defaultValues: {
      intention: "",
      modifier: 0,
      diceCount: 1,
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="intention"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Intention</FormLabel>
              <FormControl>
                <IntentionSelector
                  intentions={intentions}
                  value={field.value}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="modifier"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Modifier</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">
          <Dice5 className="h-4 w-4 mr-2" />
          Roll
        </Button>
      </form>
    </Form>
  )
}
```

---

## GM Dashboard - Unresolved Rolls

```tsx
export function UnresolvedRollsDashboard() {
  const { rolls, isLoading } = useUnresolvedRolls()

  if (isLoading) {
    return <Skeleton className="h-48" />
  }

  if (rolls.length === 0) {
    return (
      <EmptyState
        icon={Dice5}
        title="No pending rolls"
        description="All dice have been settled."
        variant="compact"
      />
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg font-semibold">
        Unresolved Rolls ({rolls.length})
      </h3>
      <div className="space-y-2">
        {rolls.map((roll) => (
          <RollCard
            key={roll.id}
            roll={roll}
            onOverride={handleOverride}
            onResolve={handleResolve}
            onInvalidate={handleInvalidate}
          />
        ))}
      </div>
    </div>
  )
}
```

---

## Success Criteria

- [ ] RollBadge displays all three states
- [ ] RollCard shows roll details with GM actions
- [ ] IntentionSelector populates with options
- [ ] RollForm validates and submits
- [ ] Unresolved rolls dashboard works
- [ ] Override dialog allows intention change

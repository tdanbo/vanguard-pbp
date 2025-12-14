---
name: shadcn-react
description: React component development with shadcn/ui, Tailwind CSS, and modern patterns. Use this skill when creating UI components, building forms with react-hook-form + zod validation, implementing dialogs/modals, adding toast notifications, styling with Tailwind utilities, or composing accessible component patterns. Critical for all frontend development in the Vanguard PBP system.
---

# shadcn/ui + React Development

## Overview

This skill provides guidance for building the Vanguard PBP frontend using React, shadcn/ui components, Tailwind CSS, and TypeScript. shadcn/ui is a collection of accessible, customizable components built on Radix UI primitives that live in your codebase (not installed as dependencies). All components are copy-pasted into `src/components/ui/` and fully customizable with Tailwind.

## Quick Start

### Installing shadcn/ui Components

Components are added individually as needed:

```bash
# Add a component to your project
npx shadcn@latest add button
npx shadcn@latest add dialog
npx shadcn@latest add form
npx shadcn@latest add toast

# Components are copied to src/components/ui/
# Fully customizable - they live in your codebase
```

### Basic Component Usage

```tsx
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export function MyComponent() {
  return (
    <div className="flex gap-2">
      <Button variant="default">Primary Action</Button>
      <Button variant="outline">Secondary</Button>
      <Button variant="ghost">Tertiary</Button>
    </div>
  )
}
```

## Forms with react-hook-form + zod

### Form Pattern

All forms in Vanguard PBP use react-hook-form for state management and zod for validation. This pattern provides type-safe forms with excellent error handling.

```tsx
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

// Define validation schema
const campaignSchema = z.object({
  title: z.string().min(1, "Campaign title is required").max(100),
  description: z.string().max(1000).optional(),
  timeGatePreset: z.enum(['24h', '2d', '3d', '4d', '5d']),
})

type CampaignFormValues = z.infer<typeof campaignSchema>

export function CreateCampaignForm() {
  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      title: "",
      description: "",
      timeGatePreset: '24h',
    },
  })

  async function onSubmit(values: CampaignFormValues) {
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!response.ok) throw new Error('Failed to create campaign')

      // Handle success (navigation, toast, etc.)
    } catch (error) {
      // Handle error
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Campaign Title</FormLabel>
              <FormControl>
                <Input placeholder="Enter campaign title" {...field} />
              </FormControl>
              <FormDescription>
                This is the name players will see.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe your campaign..."
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Creating..." : "Create Campaign"}
        </Button>
      </form>
    </Form>
  )
}
```

### Complex Validation Examples

```typescript
// Character creation with conditional validation
const characterSchema = z.object({
  displayName: z.string().min(1, "Name is required").max(100),
  description: z.string().max(1000),
  characterType: z.enum(['pc', 'npc']),
  avatarUrl: z.string().url().optional().or(z.literal('')),
})

// Settings form with dependent fields
const settingsSchema = z.object({
  fogOfWar: z.boolean(),
  hiddenPosts: z.boolean(),
  oocVisibility: z.enum(['all', 'gm_only']),
  timeGatePreset: z.enum(['24h', '2d', '3d', '4d', '5d']),
  characterLimit: z.enum([1000, 3000, 6000, 10000]),
}).refine(
  (data) => {
    // Hidden posts require fog of war to be enabled
    if (data.hiddenPosts && !data.fogOfWar) {
      return false
    }
    return true
  },
  {
    message: "Hidden posts require fog of war to be enabled",
    path: ["hiddenPosts"],
  }
)

// Roll submission with modifiers
const rollSchema = z.object({
  intention: z.string().min(1, "Select an intention"),
  modifier: z.number().int().min(-100).max(100),
  diceCount: z.number().int().min(1).max(100),
})
```

## Dialogs and Modals

### Basic Dialog Pattern

```tsx
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function DeleteConfirmationDialog({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">Delete Campaign</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you absolutely sure?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete your
            campaign and remove all data from our servers.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm()
              setOpen(false)
            }}
          >
            Delete Campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### Form in Dialog Pattern

```tsx
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const editCharacterSchema = z.object({
  displayName: z.string().min(1).max(100),
  description: z.string().max(1000),
})

type EditCharacterValues = z.infer<typeof editCharacterSchema>

export function EditCharacterDialog({ character }: { character: Character }) {
  const [open, setOpen] = useState(false)
  const form = useForm<EditCharacterValues>({
    resolver: zodResolver(editCharacterSchema),
    defaultValues: {
      displayName: character.displayName,
      description: character.description,
    },
  })

  async function onSubmit(values: EditCharacterValues) {
    try {
      const response = await fetch(`/api/characters/${character.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!response.ok) throw new Error('Failed to update character')

      setOpen(false)
      form.reset()
      // Refresh data, show toast, etc.
    } catch (error) {
      // Handle error
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Edit Character</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Character</DialogTitle>
          <DialogDescription>
            Update character details. Changes are visible immediately.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Character Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} className="resize-none" rows={4} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

## Toast Notifications

### Setup

```tsx
// In your root layout or main App component
import { Toaster } from "@/components/ui/toaster"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
```

### Usage Patterns

```tsx
import { useToast } from "@/components/ui/use-toast"

export function MyComponent() {
  const { toast } = useToast()

  // Success notification
  function handleSuccess() {
    toast({
      title: "Campaign created",
      description: "Your campaign is ready. Invite players to get started.",
    })
  }

  // Error notification
  function handleError() {
    toast({
      variant: "destructive",
      title: "Something went wrong",
      description: "Failed to create campaign. Please try again.",
    })
  }

  // Warning notification
  function handleWarning() {
    toast({
      title: "Scene limit warning",
      description: "You have 20 out of 25 scenes. Consider archiving old scenes.",
    })
  }

  // With action button
  function handleWithAction() {
    toast({
      title: "Post locked",
      description: "The next post has been created. Your post is now locked.",
      action: (
        <Button variant="outline" size="sm" onClick={() => console.log("Action clicked")}>
          View Post
        </Button>
      ),
    })
  }

  return <div>...</div>
}
```

### Common Toast Patterns for Vanguard PBP

```tsx
// Phase transition notification
toast({
  title: "Entering PC Phase",
  description: "All players can now submit actions. Time gate: 24 hours.",
})

// Time gate warning
toast({
  title: "Time gate expiring soon",
  description: "PC Phase ends in 30 minutes.",
})

// Roll result
toast({
  title: "Roll complete",
  description: `Rolled ${total} (${diceType} + ${modifier})`,
})

// Compose lock notification
toast({
  title: "Another player is posting",
  description: "Please wait for them to finish or their lock to expire.",
})

// GM override notification
toast({
  variant: "destructive",
  title: "Intention changed by GM",
  description: `Your intention was changed from "${originalIntention}" to "${newIntention}".`,
})
```

## Icons with Lucide React

Lucide React is the default icon library for shadcn/ui. All icons in the project must use Lucide.

### Installation

```bash
bun add lucide-react
```

### Basic Usage

```tsx
import { User, Settings, ChevronRight, AlertCircle, Check, X } from "lucide-react"

export function IconExamples() {
  return (
    <div className="flex items-center gap-4">
      {/* Basic icon */}
      <User className="h-5 w-5" />

      {/* Colored icon */}
      <AlertCircle className="h-5 w-5 text-destructive" />

      {/* Icon in button */}
      <Button variant="outline" size="icon">
        <Settings className="h-4 w-4" />
      </Button>

      {/* Icon with text */}
      <Button>
        <Check className="mr-2 h-4 w-4" />
        Confirm
      </Button>
    </div>
  )
}
```

### Icon Sizing Convention

Use consistent Tailwind classes for icon sizes:
- **Small (in buttons, badges)**: `h-3 w-3` or `h-4 w-4`
- **Medium (standalone)**: `h-5 w-5`
- **Large (headers, empty states)**: `h-8 w-8` or `h-12 w-12`

### Common Icons for Vanguard PBP

```tsx
// Navigation & Actions
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Plus,
  X,
  Check,
  Trash2,
  Pencil,
  Copy,
  ExternalLink,
} from "lucide-react"

// Status & Feedback
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  Loader2,     // Use with animate-spin for loading
  Clock,
} from "lucide-react"

// Game-specific
import {
  Users,       // Characters/players
  Dice1,       // Dice rolling (or Dice5, Dices)
  Eye,         // Visibility/witness
  EyeOff,      // Hidden
  MessageSquare, // Posts/dialogue
  Swords,      // Actions/combat
  Crown,       // GM
  User,        // Player
  BookOpen,    // Scene/narrative
  Bookmark,    // Bookmarks
  Bell,        // Notifications
  Settings,    // Settings
  LogOut,      // Logout
} from "lucide-react"
```

### Loading Spinner Pattern

```tsx
import { Loader2 } from "lucide-react"

// In a button
<Button disabled={isLoading}>
  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {isLoading ? "Saving..." : "Save"}
</Button>

// Standalone
<div className="flex items-center justify-center">
  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
</div>
```

### Icon Buttons (Accessibility)

Always add `aria-label` for icon-only buttons:

```tsx
<Button variant="ghost" size="icon" aria-label="Delete post">
  <Trash2 className="h-4 w-4" />
</Button>

<Button variant="ghost" size="icon" aria-label="Edit character">
  <Pencil className="h-4 w-4" />
</Button>
```

---

## Tailwind Styling Conventions

### Core Principles

1. **Utility-first**: Style directly in JSX with Tailwind classes
2. **Responsive design**: Use responsive modifiers (`sm:`, `md:`, `lg:`)
3. **Dark mode support**: Use `dark:` modifier for dark theme variants
4. **Composition**: Build complex layouts from simple utilities

### Common Patterns

```tsx
// Card layout
<div className="rounded-lg border bg-card p-6 shadow-sm">
  <h3 className="text-lg font-semibold">Card Title</h3>
  <p className="text-sm text-muted-foreground">Card description</p>
</div>

// Flexbox layouts
<div className="flex items-center justify-between gap-4">
  <span className="text-sm font-medium">Label</span>
  <Button size="sm">Action</Button>
</div>

// Grid layouts
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
  {items.map(item => (
    <Card key={item.id}>...</Card>
  ))}
</div>

// Responsive text
<h1 className="text-2xl font-bold md:text-3xl lg:text-4xl">
  Responsive Heading
</h1>

// Conditional styling
<div className={cn(
  "rounded-md p-4",
  isActive && "bg-primary text-primary-foreground",
  isDisabled && "opacity-50 cursor-not-allowed"
)}>
  Content
</div>
```

### Design Tokens

Use semantic color tokens instead of raw colors:

```tsx
// Good - semantic tokens
<div className="bg-background text-foreground">
  <p className="text-muted-foreground">Muted text</p>
  <Button variant="destructive">Delete</Button>
</div>

// Avoid - raw colors
<div className="bg-white text-black dark:bg-black dark:text-white">
  <p className="text-gray-500">Muted text</p>
  <Button className="bg-red-500">Delete</Button>
</div>
```

Common tokens:
- `background` / `foreground` - Main background and text
- `card` / `card-foreground` - Card backgrounds
- `primary` / `primary-foreground` - Primary actions
- `secondary` / `secondary-foreground` - Secondary actions
- `muted` / `muted-foreground` - Muted backgrounds and text
- `accent` / `accent-foreground` - Accent elements
- `destructive` / `destructive-foreground` - Destructive actions
- `border` - Border colors

### Layout Utilities

```tsx
// Container with max width
<div className="container mx-auto max-w-6xl px-4">
  Content
</div>

// Sticky header
<header className="sticky top-0 z-50 border-b bg-background">
  Navigation
</header>

// Full-height layout
<div className="flex min-h-screen flex-col">
  <header>...</header>
  <main className="flex-1">...</main>
  <footer>...</footer>
</div>

// Centered content
<div className="flex min-h-screen items-center justify-center">
  <Card className="w-full max-w-md">Login form</Card>
</div>
```

## Component Composition Patterns

### Compound Components

```tsx
// Scene header composition
export function SceneHeader({ scene }: { scene: Scene }) {
  return (
    <div className="space-y-4">
      {scene.headerImageUrl && (
        <div className="aspect-video overflow-hidden rounded-lg">
          <img
            src={scene.headerImageUrl}
            alt={scene.title}
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{scene.title}</h1>
        <p className="text-muted-foreground">{scene.description}</p>
      </div>
      <SceneHeaderActions scene={scene} />
    </div>
  )
}

function SceneHeaderActions({ scene }: { scene: Scene }) {
  const isGM = useIsGM()

  if (!isGM) return null

  return (
    <div className="flex gap-2">
      <EditSceneDialog scene={scene} />
      <AddCharacterDialog sceneId={scene.id} />
      <Button variant="outline" size="sm">Archive Scene</Button>
    </div>
  )
}
```

### Slot Pattern for Flexible Layouts

```tsx
interface PageLayoutProps {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
}

export function PageLayout({ title, description, actions, children }: PageLayoutProps) {
  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">{title}</h1>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}

// Usage
<PageLayout
  title="Campaign Settings"
  description="Configure campaign rules and preferences"
  actions={
    <>
      <Button variant="outline">Cancel</Button>
      <Button>Save Changes</Button>
    </>
  }
>
  <SettingsForm />
</PageLayout>
```

### Render Props for Data Fetching

```tsx
interface DataLoaderProps<T> {
  url: string
  children: (data: T) => React.ReactNode
  fallback?: React.ReactNode
}

export function DataLoader<T>({ url, children, fallback }: DataLoaderProps<T>) {
  const { data, isLoading, error } = useFetch<T>(url)

  if (isLoading) return fallback || <Skeleton />
  if (error) return <ErrorMessage error={error} />
  if (!data) return null

  return <>{children(data)}</>
}

// Usage
<DataLoader<Campaign> url={`/api/campaigns/${id}`}>
  {(campaign) => (
    <div>
      <h1>{campaign.title}</h1>
      <p>{campaign.description}</p>
    </div>
  )}
</DataLoader>
```

## Accessibility Patterns

### Keyboard Navigation

shadcn/ui components handle keyboard navigation by default, but ensure your custom components follow these patterns:

```tsx
// Keyboard-accessible custom button
export function CustomButton({ onClick, children }: { onClick: () => void, children: React.ReactNode }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className="cursor-pointer rounded-md p-2 hover:bg-accent"
    >
      {children}
    </div>
  )
}
```

### Focus Management

```tsx
import { useRef, useEffect } from "react"

export function AutoFocusInput() {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return <Input ref={inputRef} placeholder="Auto-focused input" />
}

// Focus trap in dialogs (handled by shadcn/ui Dialog automatically)
<Dialog>
  <DialogContent>
    {/* Focus is automatically trapped within this dialog */}
  </DialogContent>
</Dialog>
```

### ARIA Labels

```tsx
// Icon-only buttons need labels
<Button variant="ghost" size="icon" aria-label="Delete post">
  <TrashIcon className="h-4 w-4" />
</Button>

// Status indicators
<div role="status" aria-live="polite">
  {isLoading ? "Loading..." : "Content loaded"}
</div>

// Screen reader only text
<span className="sr-only">Loading content</span>
```

## Loading States and Skeletons

```tsx
import { Skeleton } from "@/components/ui/skeleton"

// Card skeleton
export function CampaignCardSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border p-6">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  )
}

// List skeleton
export function CampaignListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <CampaignCardSkeleton key={i} />
      ))}
    </div>
  )
}

// Inline loading state
export function SaveButton({ isSaving }: { isSaving: boolean }) {
  return (
    <Button disabled={isSaving}>
      {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {isSaving ? "Saving..." : "Save Changes"}
    </Button>
  )
}
```

## Error Handling UI

```tsx
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// Inline error display
export function FormError({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

// Full page error state
export function ErrorPage({ error, reset }: { error: Error, reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="max-w-md space-y-4 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-muted-foreground">{error.message}</p>
        <Button onClick={reset}>Try Again</Button>
      </div>
    </div>
  )
}

// Conditional error in component
export function CampaignView({ campaignId }: { campaignId: string }) {
  const { data, error, isLoading } = useCampaign(campaignId)

  if (isLoading) return <CampaignSkeleton />
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load campaign. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    )
  }

  return <Campaign data={data} />
}
```

## Vanguard PBP Specific Components

### Phase Indicator

```tsx
export function PhaseIndicator({ campaign }: { campaign: Campaign }) {
  const isGMPhase = campaign.currentPhase === 'gm_phase'
  const isPCPhase = campaign.currentPhase === 'pc_phase'

  return (
    <div className={cn(
      "rounded-full px-3 py-1 text-sm font-medium",
      isGMPhase && "bg-purple-100 text-purple-900 dark:bg-purple-900 dark:text-purple-100",
      isPCPhase && "bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100"
    )}>
      {isGMPhase ? "GM Phase" : "PC Phase"}
    </div>
  )
}
```

### Time Gate Display

```tsx
import { formatDistanceToNow } from "date-fns"

export function TimeGateDisplay({ campaign }: { campaign: Campaign }) {
  if (campaign.currentPhase !== 'pc_phase' || !campaign.currentPhaseExpiresAt) {
    return null
  }

  const expiresAt = new Date(campaign.currentPhaseExpiresAt)
  const hasExpired = expiresAt < new Date()

  return (
    <div className={cn(
      "flex items-center gap-2 rounded-md border p-2 text-sm",
      hasExpired && "border-destructive bg-destructive/10"
    )}>
      <Clock className="h-4 w-4" />
      <span>
        {hasExpired
          ? "Time gate expired"
          : `Expires ${formatDistanceToNow(expiresAt, { addSuffix: true })}`
        }
      </span>
    </div>
  )
}
```

### Pass State Indicator

```tsx
export function PassStateIndicator({ passState }: { passState: 'none' | 'passed' | 'hard_passed' }) {
  if (passState === 'none') return null

  return (
    <div className={cn(
      "rounded-full px-2 py-0.5 text-xs font-medium",
      passState === 'passed' && "bg-yellow-100 text-yellow-900",
      passState === 'hard_passed' && "bg-red-100 text-red-900"
    )}>
      {passState === 'passed' ? 'Passed' : 'Hard Passed'}
    </div>
  )
}
```

### Witness Badge

```tsx
export function WitnessBadge({ witnesses, totalCharacters }: {
  witnesses: string[],
  totalCharacters: number
}) {
  const isHidden = witnesses.length === 0
  const isVisible = witnesses.length === totalCharacters

  if (isVisible) return null // Don't show badge for fully visible posts

  return (
    <div className={cn(
      "flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs",
      isHidden && "border-destructive bg-destructive/10 text-destructive"
    )}>
      <Eye className="h-3 w-3" />
      <span>
        {isHidden ? 'Hidden' : `Visible to ${witnesses.length}`}
      </span>
    </div>
  )
}
```

## Best Practices

### Do's

- **Use semantic HTML**: Prefer `<button>` over `<div onClick={...}>`
- **Leverage TypeScript**: Define proper types for props and forms
- **Compose components**: Build complex UIs from simple, reusable pieces
- **Use form validation**: Always validate with zod schemas
- **Handle loading states**: Show skeletons/spinners during async operations
- **Provide feedback**: Use toasts for user actions
- **Follow Tailwind conventions**: Use utility classes, avoid custom CSS
- **Ensure accessibility**: Test keyboard navigation and screen readers

### Don'ts

- **Don't bypass form validation**: Always use react-hook-form + zod
- **Don't inline large components**: Extract to separate files for readability
- **Don't ignore error states**: Always handle and display errors
- **Don't use raw colors**: Use semantic tokens for theming
- **Don't skip loading states**: Users need feedback during async operations
- **Don't forget mobile**: Test responsive layouts on small screens
- **Don't reinvent components**: Use shadcn/ui components when available
- **Don't ignore TypeScript errors**: Fix type issues, don't use `any`

## Common shadcn/ui Components

Essential components to add for Vanguard PBP:

```bash
# Forms
npx shadcn@latest add form
npx shadcn@latest add input
npx shadcn@latest add textarea
npx shadcn@latest add select
npx shadcn@latest add checkbox
npx shadcn@latest add radio-group
npx shadcn@latest add switch

# Layout
npx shadcn@latest add card
npx shadcn@latest add separator
npx shadcn@latest add tabs
npx shadcn@latest add accordion

# Feedback
npx shadcn@latest add toast
npx shadcn@latest add alert
npx shadcn@latest add skeleton

# Overlays
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
npx shadcn@latest add popover
npx shadcn@latest add tooltip

# Interaction
npx shadcn@latest add button
npx shadcn@latest add badge
npx shadcn@latest add avatar

# Navigation
npx shadcn@latest add navigation-menu
npx shadcn@latest add breadcrumb
```

## Utilities

### cn() helper

The `cn()` utility (from `lib/utils.ts`) merges Tailwind classes correctly:

```tsx
import { cn } from "@/lib/utils"

// Conditional classes
<div className={cn(
  "base-class",
  condition && "conditional-class",
  variant === 'primary' && "primary-variant"
)} />

// Override classes
<Button className={cn("default-padding", customPadding)} />
```

### Type-safe API calls

```typescript
// lib/api.ts
export async function apiCall<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'API call failed')
  }

  return response.json()
}

// Usage
const campaign = await apiCall<Campaign>(`/api/campaigns/${id}`)
```

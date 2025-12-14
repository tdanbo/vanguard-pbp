# 3.5 Settings Tab

**Skill**: `shadcn-react`

## Goal

Implement the campaign settings page with forms, validation, and danger zone.

---

## Design References

- [06-campaign-view.md](../../product-design-system/06-campaign-view.md) - Lines 286-330, 706-802 for settings specs

---

## Overview

The settings tab includes:
- Campaign details (title, description)
- Game settings (time gate, character limits)
- Visibility settings (fog of war, hidden posts)
- Danger zone (pause, transfer, delete)

---

## Implementation

### Settings Layout

```tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export function SettingsTab({ campaign }: { campaign: Campaign }) {
  return (
    <div className="space-y-8 max-w-2xl">
      {/* Campaign Details */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Campaign Details</CardTitle>
        </CardHeader>
        <CardContent>
          <CampaignDetailsForm campaign={campaign} />
        </CardContent>
      </Card>

      {/* Game Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Game Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <GameSettingsForm campaign={campaign} />
        </CardContent>
      </Card>

      {/* Visibility Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Visibility</CardTitle>
        </CardHeader>
        <CardContent>
          <VisibilitySettingsForm campaign={campaign} />
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="font-display text-destructive">
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DangerZone campaign={campaign} />
        </CardContent>
      </Card>
    </div>
  )
}
```

### Campaign Details Form

```tsx
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
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
import { Button } from "@/components/ui/button"

const detailsSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  description: z.string().max(1000).optional(),
})

function CampaignDetailsForm({ campaign }: { campaign: Campaign }) {
  const form = useForm<z.infer<typeof detailsSchema>>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      title: campaign.title,
      description: campaign.description || "",
    },
  })

  async function onSubmit(values: z.infer<typeof detailsSchema>) {
    // Update campaign
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
                <Textarea {...field} rows={4} />
              </FormControl>
              <FormDescription>
                A brief description of your campaign for players.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          Save Changes
        </Button>
      </form>
    </Form>
  )
}
```

### Game Settings Form

```tsx
function GameSettingsForm({ campaign }: { campaign: Campaign }) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Time Gate Preset */}
        <FormField
          control={form.control}
          name="timeGatePreset"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Time Gate Duration</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="24h">24 hours</SelectItem>
                  <SelectItem value="2d">2 days</SelectItem>
                  <SelectItem value="3d">3 days</SelectItem>
                  <SelectItem value="4d">4 days</SelectItem>
                  <SelectItem value="5d">5 days</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Time limit for PC phase before auto-advance.
              </FormDescription>
            </FormItem>
          )}
        />

        {/* Character Limit */}
        <FormField
          control={form.control}
          name="characterLimit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Character Limit per Post</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="1000">1,000 characters</SelectItem>
                  <SelectItem value="3000">3,000 characters</SelectItem>
                  <SelectItem value="6000">6,000 characters</SelectItem>
                  <SelectItem value="10000">10,000 characters</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <Button type="submit">Save Settings</Button>
      </form>
    </Form>
  )
}
```

### Danger Zone

```tsx
function DangerZone({ campaign }: { campaign: Campaign }) {
  const [confirmDelete, setConfirmDelete] = useState("")

  return (
    <div className="space-y-6">
      {/* Pause Campaign */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">Pause Campaign</h4>
          <p className="text-sm text-muted-foreground">
            Temporarily disable all posting and phase transitions.
          </p>
        </div>
        <Button
          variant="outline"
          className="border-destructive text-destructive hover:bg-destructive hover:text-foreground"
        >
          {campaign.isPaused ? "Resume" : "Pause"}
        </Button>
      </div>

      <Separator />

      {/* Transfer Ownership */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">Transfer GM Role</h4>
          <p className="text-sm text-muted-foreground">
            Transfer ownership to another player.
          </p>
        </div>
        <Button
          variant="outline"
          className="border-destructive text-destructive hover:bg-destructive hover:text-foreground"
        >
          Transfer
        </Button>
      </div>

      <Separator />

      {/* Delete Campaign */}
      <div className="space-y-4">
        <div>
          <h4 className="font-medium text-destructive">Delete Campaign</h4>
          <p className="text-sm text-muted-foreground">
            Permanently delete this campaign and all its data. This cannot be undone.
          </p>
        </div>
        <div className="flex gap-4">
          <Input
            placeholder={`Type "${campaign.title}" to confirm`}
            value={confirmDelete}
            onChange={(e) => setConfirmDelete(e.target.value)}
            className="max-w-xs"
          />
          <Button
            variant="destructive"
            disabled={confirmDelete !== campaign.title}
          >
            Delete Campaign
          </Button>
        </div>
      </div>
    </div>
  )
}
```

---

## Section Dividers

Use the flourish class for thematic dividers:

```tsx
<div className="flourish my-8">
  <span className="text-gold-dim text-sm">Game Settings</span>
</div>
```

Or simple separators:

```tsx
<Separator className="my-6" />
```

---

## Success Criteria

- [ ] Campaign details form validates and saves
- [ ] Game settings form with select dropdowns
- [ ] Danger zone has destructive styling
- [ ] Delete requires typing campaign name
- [ ] Forms show loading state during submit
- [ ] Toast feedback on save success/error

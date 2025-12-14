# Campaign View

This document defines the UI patterns for campaign management in Vanguard PBP.

**Related Components**:
- `src/pages/campaigns/CampaignDashboard.tsx` - Main campaign view
- `src/pages/campaigns/CampaignSettings.tsx` - Settings page
- `src/components/campaign/CreateCampaignDialog.tsx` - Campaign creation
- `src/components/campaign/JoinCampaignDialog.tsx` - Join via invite code

---

The Campaign View is a management interface. Players are looking AT their campaign, not IN it. Design for clarity and efficiency while maintaining the warm, premium aesthetic.

## Design Principles

| Problem | Solution |
|---------|----------|
| Information overload | Separate concerns into clear tabs/sections |
| Scenes as admin items | Scenes should feel like destinations, show imagery |
| Posts buried in accordions | Posts belong in Scene View, not here |
| No atmosphere | Dark theme, premium feel, still functional |
| Wasted space | Use available space for scene cards in grid |

---

## Architecture

```
Campaign Dashboard
├── Header (Campaign name, GM badge, status, actions)
├── Tab Navigation
│   ├── Scenes (default)
│   ├── Characters
│   ├── Members
│   └── Settings
└── Tab Content Area
```

**Key principle:** Each tab is one concern. No mixing.

---

## Campaign Header

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  ← Back to Campaigns                                             │
│                                                                  │
│  ╔══════════════════════════════════════════════════════════╗   │
│  ║  THE SHADOW OVER ARKHAM                        [GM] ●    ║   │
│  ║  A Lovecraftian mystery campaign                         ║   │
│  ╚══════════════════════════════════════════════════════════╝   │
│                                                                  │
│  [GM Phase: 3 days] [5 scenes] [4 players]      [Pause] [⚙]     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Header Component

```tsx
function CampaignHeader({ campaign }: { campaign: Campaign }) {
  const isGM = campaign.user_role === 'gm'

  return (
    <div className="p-8 bg-card border-b border-border">
      {/* Back link */}
      <Link
        to="/"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to campaigns
      </Link>

      {/* Title row */}
      <div className="flex items-center gap-3">
        <h1 className="font-display text-3xl font-semibold text-foreground">
          {campaign.title}
        </h1>
        {isGM && (
          <Badge className="bg-gold text-primary-foreground">
            <Crown className="h-3 w-3 mr-1" />
            GM
          </Badge>
        )}
      </div>

      {/* Description */}
      <p className="text-muted-foreground mt-1">
        {campaign.description || 'No description'}
      </p>

      {/* Meta row */}
      <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
        <PhaseIndicator phase={campaign.current_phase} />
        <span>{campaign.scene_count} scenes</span>
        <span>{campaign.member_count} players</span>
      </div>
    </div>
  )
}
```

---

## Tab Navigation

Simple, horizontal tabs with gold active indicator:

```tsx
<Tabs defaultValue="scenes">
  <TabsList className="border-b border-border bg-transparent">
    <TabsTrigger
      value="scenes"
      className="data-[state=active]:text-gold data-[state=active]:border-b-2 data-[state=active]:border-gold"
    >
      <BookOpen className="h-4 w-4 mr-2" />
      Scenes
    </TabsTrigger>
    <TabsTrigger value="characters">
      <User className="h-4 w-4 mr-2" />
      Characters
    </TabsTrigger>
    <TabsTrigger value="members">
      <Users className="h-4 w-4 mr-2" />
      Members
    </TabsTrigger>
    <TabsTrigger value="settings">
      <Settings className="h-4 w-4 mr-2" />
      Settings
    </TabsTrigger>
  </TabsList>
</Tabs>
```

---

## Scenes Tab

Scenes should feel like places you can go, not items to manage.

### Scene Cards Grid

```tsx
function ScenesGrid({ scenes }: { scenes: Scene[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
      {scenes.map(scene => (
        <SceneCard key={scene.id} scene={scene} />
      ))}
    </div>
  )
}
```

### Scene Card Component

```tsx
function SceneCard({ scene }: { scene: Scene }) {
  return (
    <Card className="card-interactive overflow-hidden cursor-pointer">
      {/* Scene image or placeholder */}
      {scene.headerImageUrl ? (
        <img
          src={scene.headerImageUrl}
          alt={scene.title}
          className="w-full h-40 object-cover"
        />
      ) : (
        <div className="w-full h-40 bg-gradient-to-br from-secondary to-muted flex items-center justify-center">
          <BookOpen className="h-8 w-8 text-muted-foreground" />
        </div>
      )}

      <div className="p-4">
        {/* Title */}
        <h3 className="font-display text-lg text-foreground mb-2">
          {scene.title}
        </h3>

        {/* Meta */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{scene.postCount} posts</span>
          <span>·</span>
          <span>{scene.characterCount} characters</span>

          {/* Status badges */}
          {scene.hasNewPosts && (
            <Badge className="bg-gold-dim text-foreground text-xs">NEW</Badge>
          )}
          {scene.isDraft && (
            <Badge variant="outline" className="text-xs">Draft</Badge>
          )}
        </div>
      </div>

      {/* Hover actions (GM only) */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8 bg-background/80">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 bg-background/80">
          <Archive className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  )
}
```

The `card-interactive` utility class provides:
- `transition-all duration-200`
- On hover: `-translate-y-0.5`, `border-gold-dim`, `shadow-lg`

---

## Characters Tab

Show characters with their portraits — substantial, not tiny avatars:

```tsx
function CharacterRow({ character }: { character: Character }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        {/* Portrait - use portrait-md, not tiny avatar */}
        <img
          src={character.avatarUrl}
          alt={character.displayName}
          className="portrait-md"
        />

        <div className="flex-1">
          <h4 className="character-name">{character.displayName}</h4>
          <p className="text-sm text-muted-foreground">
            {character.description || 'No description'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Played by @{character.playerUsername}
          </p>
        </div>

        <Button variant="outline" size="sm">View</Button>
      </div>
    </Card>
  )
}
```

---

## Members Tab

```tsx
function MembersList({ members }: { members: Member[] }) {
  const gm = members.find(m => m.role === 'gm')
  const players = members.filter(m => m.role === 'player')

  return (
    <div className="space-y-6 p-6">
      {/* GM Section */}
      <div>
        <h3 className="label-caps mb-3">Game Master</h3>
        <MemberRow member={gm} />
      </div>

      {/* Players Section */}
      <div>
        <h3 className="label-caps mb-3">Players</h3>
        <div className="space-y-2">
          {players.map(player => (
            <MemberRow key={player.id} member={player} />
          ))}
        </div>
      </div>
    </div>
  )
}
```

---

## Settings Tab

Grouped settings with clear sections. Danger Zone at very bottom.

### Section Labels

Use the `flourish` class for decorative section dividers:

```tsx
<h3 className="flourish label-caps">
  <span>General Settings</span>
</h3>
```

This creates:
```
────────────── GENERAL SETTINGS ──────────────
```

### Danger Zone

```tsx
function DangerZone({ campaign }: { campaign: Campaign }) {
  return (
    <Card className="mt-12 border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Danger Zone
        </CardTitle>
        <CardDescription>Irreversible actions</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-foreground">
          Transfer GM Role
        </Button>
        <Button variant="destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Campaign
        </Button>
      </CardContent>
    </Card>
  )
}
```

---

## Phase Indicator

Use the game-specific phase colors:

```tsx
function PhaseIndicator({ phase }: { phase: 'gm_phase' | 'pc_phase' }) {
  const isGMPhase = phase === 'gm_phase'

  return (
    <Badge className={cn(
      "gap-1.5",
      isGMPhase ? "bg-gm-phase text-foreground" : "bg-pc-phase text-foreground"
    )}>
      {isGMPhase ? <Crown className="h-3 w-3" /> : <Users className="h-3 w-3" />}
      {isGMPhase ? "GM Phase" : "PC Phase"}
    </Badge>
  )
}
```

---

## Create Campaign Dialog

Dialog for creating a new campaign.

### Layout

```
┌──────────────────────────────────────────────┐
│ Create New Campaign                          │
│ Start a new play-by-post campaign. You'll    │
│ be the Game Master.                          │
├──────────────────────────────────────────────┤
│ Campaign Title                               │
│ ┌──────────────────────────────────────────┐ │
│ │ Enter campaign title                     │ │
│ └──────────────────────────────────────────┘ │
│ This is the name players will see.           │
│                                              │
│ Description                                  │
│ ┌──────────────────────────────────────────┐ │
│ │ Describe your campaign...                │ │
│ │                                          │ │
│ └──────────────────────────────────────────┘ │
│ A brief description to help players.         │
│                                              │
│                      [Cancel] [Create]       │
└──────────────────────────────────────────────┘
```

### Component Structure

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button disabled={gmCampaignsCount >= 5}>
      <Plus className="mr-2 h-4 w-4" />
      Create Campaign
    </Button>
  </DialogTrigger>
  <DialogContent className="sm:max-w-[500px]">
    <DialogHeader>
      <DialogTitle>Create New Campaign</DialogTitle>
      <DialogDescription>
        Start a new play-by-post campaign. You'll be the Game Master.
      </DialogDescription>
    </DialogHeader>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Title field */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Campaign Title</FormLabel>
              <FormControl>
                <Input placeholder="Enter campaign title" {...field} />
              </FormControl>
              <FormDescription>This is the name players will see.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Description field */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe your campaign..."
                  className="min-h-[100px] resize-none"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                A brief description to help players understand the campaign.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Campaign
          </Button>
        </div>
      </form>
    </Form>
  </DialogContent>
</Dialog>
```

### Validation

| Field | Rules |
|-------|-------|
| Title | Required, max 255 characters |
| Description | Optional, max 2000 characters |

### GM Campaign Limit

GMs can create up to 5 campaigns. Disable button when limit reached:

```tsx
<Button disabled={gmCampaignsCount >= 5}>
  Create Campaign
</Button>
```

---

## Join Campaign Dialog

Dialog for joining a campaign via invite code.

### Layout

```
┌──────────────────────────────────────────────┐
│ Join Campaign                                │
│ Enter the invite code from the Game Master.  │
├──────────────────────────────────────────────┤
│ Invite Code                                  │
│ ┌──────────────────────────────────────────┐ │
│ │ Enter invite code                        │ │
│ └──────────────────────────────────────────┘ │
│ The code from your invite link.              │
│                                              │
│                         [Cancel] [Join]      │
└──────────────────────────────────────────────┘
```

### Component Structure

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button variant="outline">
      <UserPlus className="mr-2 h-4 w-4" />
      Join Campaign
    </Button>
  </DialogTrigger>
  <DialogContent className="sm:max-w-[400px]">
    <DialogHeader>
      <DialogTitle>Join Campaign</DialogTitle>
      <DialogDescription>
        Enter the invite code from the Game Master to join a campaign.
      </DialogDescription>
    </DialogHeader>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Invite Code</FormLabel>
              <FormControl>
                <Input placeholder="Enter invite code" {...field} />
              </FormControl>
              <FormDescription>The code from your invite link.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Join
          </Button>
        </div>
      </form>
    </Form>
  </DialogContent>
</Dialog>
```

---

## Invites Tab (GM Only)

Manage invite links for players.

### Layout

```
┌──────────────────────────────────────────────────┐
│ Invite Links                                     │
│ Create and manage invite links    [Create Invite]│
├──────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────┐ │
│ │ abc123              [Active]     [📋] [🗑]   │ │
│ │ Expires in 5 days                            │ │
│ └──────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────┐ │
│ │ def456              [Used]                   │ │
│ │ Created 2 days ago                           │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### Invite Row States

| State | Badge | Description |
|-------|-------|-------------|
| Active | `variant="default"` | Valid, not used |
| Used | `variant="secondary"` | Already claimed |
| Revoked | `variant="outline"` | Manually revoked |
| Expired | `variant="destructive"` | Past expiry date |

### Invite Row Component

```tsx
function InviteRow({ invite, onCopy, onRevoke }: InviteRowProps) {
  const isUsed = !!invite.used_at
  const isRevoked = !!invite.revoked_at
  const isExpired = new Date(invite.expires_at) < new Date()
  const isActive = !isUsed && !isRevoked && !isExpired

  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div>
        <div className="flex items-center gap-2">
          <code className="text-sm">{invite.code}</code>
          {isUsed && <Badge variant="secondary">Used</Badge>}
          {isRevoked && <Badge variant="outline">Revoked</Badge>}
          {isExpired && !isUsed && !isRevoked && <Badge variant="destructive">Expired</Badge>}
          {isActive && <Badge variant="default">Active</Badge>}
        </div>
        <div className="text-xs text-muted-foreground">
          {isActive
            ? `Expires ${formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true })}`
            : `Created ${formatDistanceToNow(new Date(invite.created_at), { addSuffix: true })}`}
        </div>
      </div>
      {isActive && (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onCopy}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onRevoke}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
```

### Empty State

```tsx
<p className="py-4 text-center text-muted-foreground">
  No invite links created yet.
</p>
```

---

## Member Row with Actions

### Layout

```
┌──────────────────────────────────────────────────┐
│ [👑]  Game Master         [GM]                   │
│       Joined 3 days ago                          │
├──────────────────────────────────────────────────┤
│ [👥]  Player             [PLAYER]    [👑] [❌]   │
│       Joined 2 days ago                          │
└──────────────────────────────────────────────────┘
```

### Component Structure

```tsx
function MemberRow({
  member,
  isCurrentUserGM,
  currentCampaign,
  onRemove,
  onTransfer,
}: MemberRowProps) {
  const isGM = member.role === 'gm'
  const isOwner = currentCampaign.owner_id === member.user_id

  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm">
          {isGM ? <Crown className="h-4 w-4" /> : <Users className="h-4 w-4" />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {isGM ? 'Game Master' : 'Player'}
            </span>
            <Badge variant={isGM ? 'default' : 'secondary'} className="text-xs">
              {member.role.toUpperCase()}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Joined {formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}
          </div>
        </div>
      </div>
      {isCurrentUserGM && !isOwner && (
        <div className="flex gap-1">
          {member.role === 'player' && (
            <Button variant="ghost" size="sm" onClick={onTransfer}>
              <Crown className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <UserMinus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
```

### Leave Campaign Button (Players Only)

```tsx
{!isGM && (
  <Button
    variant="outline"
    className="mt-4 w-full"
    onClick={() => setLeaveDialogOpen(true)}
  >
    <LogOut className="mr-2 h-4 w-4" />
    Leave Campaign
  </Button>
)}
```

---

## Confirmation Dialogs

### Delete Campaign Dialog

Requires typing campaign title to confirm:

```tsx
<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone. All scenes, posts, and data will be permanently deleted.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <div className="py-4">
      <label className="text-sm font-medium">
        Type "{currentCampaign.title}" to confirm:
      </label>
      <Input
        className="mt-2"
        value={deleteConfirmTitle}
        onChange={(e) => setDeleteConfirmTitle(e.target.value)}
        placeholder="Campaign title"
      />
    </div>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        onClick={handleDelete}
        disabled={deleteConfirmTitle !== currentCampaign.title}
      >
        Delete Campaign
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Leave Campaign Dialog

```tsx
<AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Leave Campaign?</AlertDialogTitle>
      <AlertDialogDescription>
        You will lose access to this campaign. Your characters will become unassigned.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleLeave}>Leave Campaign</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Transfer GM Dialog

```tsx
<AlertDialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Transfer GM Role?</AlertDialogTitle>
      <AlertDialogDescription>
        You will become a player and lose GM permissions.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <div className="py-4">
      <label className="mb-2 block text-sm font-medium">Select new GM:</label>
      <div className="space-y-2">
        {members
          .filter((m) => m.role === 'player')
          .map((member) => (
            <Button
              key={member.id}
              variant={selectedMemberForTransfer === member.user_id ? 'default' : 'outline'}
              className="w-full justify-start"
              onClick={() => setSelectedMemberForTransfer(member.user_id)}
            >
              Player {member.user_id.slice(0, 8)}...
            </Button>
          ))}
      </div>
    </div>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleTransferGm} disabled={!selectedMemberForTransfer}>
        Transfer Role
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## Campaign Settings Page

Dedicated page for campaign configuration (GM only).

### Layout

```
┌──────────────────────────────────────────────────┐
│ ← Back to campaign                               │
│                                                  │
│ Campaign Settings                                │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ Basic Information                            │ │
│ │ Update your campaign's name and description  │ │
│ │ ────────────────────────────────────────     │ │
│ │ Campaign Title                               │ │
│ │ [                                  ]         │ │
│ │                                              │ │
│ │ Description                                  │ │
│ │ [                                  ]         │ │
│ │ [                                  ]         │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ Game Settings                                │ │
│ │ Configure game rules and time limits         │ │
│ │ ────────────────────────────────────────     │ │
│ │ Time Gate Duration                           │ │
│ │ [3 days                              ▼]      │ │
│ │ How long players have to post                │ │
│ │                                              │ │
│ │ Character Limit per Post                     │ │
│ │ [3,000 characters                    ▼]      │ │
│ │                                              │ │
│ │ OOC Comment Visibility                       │ │
│ │ [GM only                             ▼]      │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│                      [Cancel] [Save Settings]    │
└──────────────────────────────────────────────────┘
```

### Settings Options

**Time Gate Duration**:
| Value | Label |
|-------|-------|
| `24h` | 24 hours |
| `2d` | 2 days |
| `3d` | 3 days |
| `4d` | 4 days |
| `5d` | 5 days |

**Character Limit**:
| Value | Label |
|-------|-------|
| `1000` | 1,000 characters |
| `3000` | 3,000 characters |
| `6000` | 6,000 characters |
| `10000` | 10,000 characters |

**OOC Visibility**:
| Value | Label |
|-------|-------|
| `all` | Visible to all players |
| `gm_only` | GM only |

### Access Denied State

Non-GMs cannot access settings:

```tsx
if (currentCampaign.user_role !== 'gm') {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-2xl px-4 py-8 text-center">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">Only the GM can access campaign settings.</p>
        <Button className="mt-4" asChild>
          <Link to={`/campaigns/${id}`}>Back to Campaign</Link>
        </Button>
      </div>
    </div>
  )
}
```

---

## Loading States

### Campaign Loading

```tsx
<div className="min-h-screen bg-background">
  <div className="container mx-auto max-w-4xl px-4 py-8">
    <Skeleton className="mb-4 h-8 w-32" />
    <Skeleton className="mb-2 h-10 w-3/4" />
    <Skeleton className="h-6 w-1/2" />
  </div>
</div>
```

### Settings Page Loading

```tsx
<div className="container mx-auto max-w-2xl px-4 py-8">
  <Skeleton className="mb-4 h-8 w-32" />
  <Skeleton className="mb-8 h-10 w-3/4" />
  <Skeleton className="h-96 w-full" />
</div>
```

---

## Toast Messages

### Success Messages

```tsx
// Campaign created
toast({
  title: 'Campaign created',
  description: 'Your campaign is ready. Invite players to get started.',
})

// Joined campaign
toast({
  title: 'Joined campaign',
  description: `You've joined "${campaign.title}".`,
})

// Invite created
toast({
  title: 'Invite link created',
  description: 'The link has been copied to your clipboard.',
})

// Settings saved
toast({
  title: 'Settings saved',
  description: 'Campaign settings have been updated.',
})

// Campaign paused/resumed
toast({ title: 'Campaign paused', description: 'Time gates are now frozen.' })
toast({ title: 'Campaign resumed', description: 'The campaign is now active again.' })
```

### Error Messages

```tsx
toast({
  variant: 'destructive',
  title: 'Failed to create campaign',
  description: error.message,
})
```

---

## Icons

| Icon | Usage |
|------|-------|
| `Crown` | GM badge, GM role indicator |
| `Users` | Player role, Members tab |
| `BookOpen` | Scenes tab |
| `User` | Characters tab |
| `Settings` | Settings button/tab |
| `LinkIcon` | Invites tab |
| `Plus` | Create campaign |
| `UserPlus` | Join campaign |
| `Pause` / `Play` | Pause/resume campaign |
| `Trash2` | Delete, revoke invite |
| `Copy` | Copy invite link |
| `UserMinus` | Remove member |
| `LogOut` | Leave campaign |
| `ArrowLeft` | Back navigation |

---

## What Does NOT Belong Here

- **Posts**: Never show posts in Campaign View. Posts are Scene View content.
- **Post composer**: Composing happens in scenes, not in campaign management.
- **Inline scene editing**: Scene details are edited in a modal or dedicated edit page, not inline in a list.
- **Everything at once**: Each tab should be focused on one concern.

# 3.3 Tab Navigation

**Skill**: `shadcn-react`

## Goal

Implement tabbed navigation with gold active indicator for campaign sections.

---

## Design References

- [06-campaign-view.md](../../product-design-system/06-campaign-view.md) - Lines 109-137 for tab patterns

---

## Overview

Campaign dashboard uses tabs for:
- **Scenes** - Scene cards grid
- **Characters** - Character management
- **Members** - Player list and invites
- **Settings** - Campaign configuration (GM only)

---

## Implementation

### CampaignTabs Component

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BookOpen, Users, UserPlus, Settings } from "lucide-react"

interface CampaignTabsProps {
  campaign: Campaign
  isGM: boolean
  defaultTab?: string
}

export function CampaignTabs({
  campaign,
  isGM,
  defaultTab = "scenes",
}: CampaignTabsProps) {
  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0 h-auto">
        <TabsTrigger
          value="scenes"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-gold data-[state=active]:text-gold px-4 py-3 font-medium"
        >
          <BookOpen className="h-4 w-4 mr-2" />
          Scenes
        </TabsTrigger>
        <TabsTrigger
          value="characters"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-gold data-[state=active]:text-gold px-4 py-3 font-medium"
        >
          <Users className="h-4 w-4 mr-2" />
          Characters
        </TabsTrigger>
        <TabsTrigger
          value="members"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-gold data-[state=active]:text-gold px-4 py-3 font-medium"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Members
        </TabsTrigger>
        {isGM && (
          <TabsTrigger
            value="settings"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-gold data-[state=active]:text-gold px-4 py-3 font-medium"
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="scenes" className="mt-6">
        <ScenesTab campaign={campaign} isGM={isGM} />
      </TabsContent>

      <TabsContent value="characters" className="mt-6">
        <CharactersTab campaign={campaign} isGM={isGM} />
      </TabsContent>

      <TabsContent value="members" className="mt-6">
        <MembersTab campaign={campaign} isGM={isGM} />
      </TabsContent>

      {isGM && (
        <TabsContent value="settings" className="mt-6">
          <SettingsTab campaign={campaign} />
        </TabsContent>
      )}
    </Tabs>
  )
}
```

### Custom Tab Styling

For the gold underline effect, override shadcn defaults:

```tsx
// Custom tab trigger class
const tabTriggerClass = `
  rounded-none
  border-b-2
  border-transparent
  bg-transparent
  px-4
  py-3
  font-medium
  text-muted-foreground
  hover:text-foreground
  data-[state=active]:border-gold
  data-[state=active]:text-gold
  data-[state=active]:shadow-none
  transition-colors
`
```

---

## Tab Content Sections

### Scenes Tab

```tsx
function ScenesTab({ campaign, isGM }: TabProps) {
  const scenes = useScenes(campaign.id)

  return (
    <div className="space-y-6">
      {/* Header with action */}
      <div className="flex justify-between items-center">
        <h2 className="font-display text-xl font-semibold">Scenes</h2>
        {isGM && (
          <Button onClick={() => setCreateSceneOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Scene
          </Button>
        )}
      </div>

      {/* Grid or empty state */}
      {scenes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenes.map((scene) => (
            <SceneCard key={scene.id} scene={scene} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="The stage is empty"
          description="Create your first scene to begin the adventure."
          action={isGM ? {
            label: "Create Scene",
            onClick: () => setCreateSceneOpen(true),
          } : undefined}
        />
      )}
    </div>
  )
}
```

### Characters Tab

```tsx
function CharactersTab({ campaign, isGM }: TabProps) {
  // Group characters by type
  const pcs = characters.filter((c) => c.type === "pc")
  const npcs = characters.filter((c) => c.type === "npc")

  return (
    <div className="space-y-8">
      {/* PCs section */}
      <div>
        <h3 className="font-display text-lg font-semibold mb-4">
          Player Characters
        </h3>
        <CharacterList characters={pcs} isGM={isGM} />
      </div>

      {/* NPCs section (GM only) */}
      {isGM && (
        <div>
          <h3 className="font-display text-lg font-semibold mb-4">
            Non-Player Characters
          </h3>
          <CharacterList characters={npcs} isGM={isGM} />
        </div>
      )}
    </div>
  )
}
```

---

## Mobile Considerations

On mobile, tabs may need horizontal scrolling:

```tsx
<TabsList className="w-full overflow-x-auto flex-nowrap justify-start ...">
  {/* Tabs scroll horizontally on small screens */}
</TabsList>
```

Or use a dropdown on mobile:

```tsx
{isMobile ? (
  <Select value={activeTab} onValueChange={setActiveTab}>
    <SelectTrigger>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="scenes">Scenes</SelectItem>
      <SelectItem value="characters">Characters</SelectItem>
      {/* ... */}
    </SelectContent>
  </Select>
) : (
  <TabsList>...</TabsList>
)}
```

---

## Success Criteria

- [ ] Tabs display with icons
- [ ] Active tab has gold underline
- [ ] Tab content loads correctly
- [ ] Settings tab only visible to GM
- [ ] Mobile-friendly (scroll or dropdown)
- [ ] Tab sections have section headers with actions

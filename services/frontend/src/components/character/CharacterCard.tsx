import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  MoreVertical,
  Pencil,
  Archive,
  ArchiveRestore,
  User,
  UserX,
  Crown,
  BookOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Character, CampaignMember, Scene } from "@/types"

// Gradient colors for avatar fallback (same as CharacterPortrait)
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

function getInitials(name: string | null | undefined): string {
  if (!name) return "?"
  const words = name.trim().split(/\s+/)
  if (words.length === 0 || words[0].length === 0) return "?"
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

function getGradient(name: string | null | undefined): string {
  const effectiveName = name || "Character"
  const hash = effectiveName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return gradients[hash % gradients.length]
}

interface CharacterCardProps {
  character: Character
  isGM: boolean
  members: CampaignMember[]
  sceneName?: string | null
  onEdit: () => void
  onArchive: () => void
  onAssign: () => void
  onUnassign: () => void
  isSelected?: boolean
  onSelect?: () => void
  className?: string
}

export function CharacterCard({
  character,
  isGM,
  members,
  sceneName,
  onEdit,
  onArchive,
  onAssign,
  onUnassign,
  isSelected,
  onSelect,
  className,
}: CharacterCardProps) {
  const assignedMember = members.find((m) => m.user_id === character.assigned_user_id)
  const isOrphaned = !character.assigned_user_id && character.character_type === "pc"
  const isArchived = character.is_archived
  const initials = getInitials(character.display_name)
  const gradient = getGradient(character.display_name)

  const handleCardClick = () => {
    if (onSelect && !isArchived) {
      onSelect()
    }
  }

  return (
    <Card
      className={cn(
        "bg-card/50 rounded-sm overflow-hidden p-1",
        onSelect && !isArchived && "cursor-pointer",
        isSelected && "ring-2 ring-gold ring-offset-2 ring-offset-background",
        className
      )}
      onClick={handleCardClick}
    >
      <div className={cn(
        "bg-card rounded-sm overflow-hidden",
        isArchived ? "opacity-60" : "card-interactive",
      )}>
      {/* Portrait header - compact square aspect ratio */}
      <div className="aspect-square relative">
        {character.avatar_url ? (
          <img
            src={character.avatar_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className={cn(
              "w-full h-full bg-gradient-to-br flex items-center justify-center",
              gradient
            )}
          >
            <span className="font-display text-3xl font-semibold text-white/90">
              {initials}
            </span>
          </div>
        )}

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 scene-gradient" />

        {/* Badges - top right */}
        <div className="absolute top-3 right-3 flex gap-2">
          <Badge
            variant={character.character_type === "pc" ? "default" : "secondary"}
            className="text-xs"
          >
            {character.character_type.toUpperCase()}
          </Badge>
          {isArchived && (
            <Badge variant="outline" className="gap-1 bg-background/80 backdrop-blur-sm">
              <Archive className="h-3 w-3" />
              Archived
            </Badge>
          )}
          {isOrphaned && (
            <Badge variant="destructive" className="text-xs">
              Orphaned
            </Badge>
          )}
        </div>

        {/* GM Controls - top left (kebab menu) */}
        {isGM && (
          <div className="absolute top-3 left-3" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                >
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Character actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {character.assigned_user_id ? (
                  <DropdownMenuItem onClick={onUnassign}>
                    <UserX className="mr-2 h-4 w-4" />
                    Unassign
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={onAssign}>
                    <User className="mr-2 h-4 w-4" />
                    Assign
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onArchive}>
                  {isArchived ? (
                    <>
                      <ArchiveRestore className="mr-2 h-4 w-4" />
                      Restore
                    </>
                  ) : (
                    <>
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Content */}
      <CardContent className="p-3">
        <h3 className="font-medium text-sm line-clamp-1 mb-1">{character.display_name}</h3>

        {/* Scene info */}
        {sceneName && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
            <BookOpen className="h-3 w-3 shrink-0" />
            <span className="truncate">{sceneName}</span>
          </div>
        )}

        {/* Assignment info */}
        {assignedMember && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {assignedMember.role === "gm" ? (
              <Crown className="h-3 w-3" />
            ) : (
              <User className="h-3 w-3" />
            )}
            <span>
              {assignedMember.role === "gm"
                ? "GM"
                : `Player ${assignedMember.user_id.slice(0, 8)}...`}
            </span>
          </div>
        )}
        </CardContent>
        </div>
        </Card>
        )
        }

interface CharacterCardsGridProps {
  characters: Character[]
  isGM: boolean
  members: CampaignMember[]
  scenes?: Scene[]
  onEdit: (character: Character) => void
  onArchive: (character: Character) => void
  onAssign: (character: Character) => void
  onUnassign: (character: Character) => void
  selectedCharacterId?: string | null
  onSelectCharacter?: (character: Character) => void
  className?: string
}

export function CharacterCardsGrid({
  characters,
  isGM,
  members,
  scenes = [],
  onEdit,
  onArchive,
  onAssign,
  onUnassign,
  selectedCharacterId,
  onSelectCharacter,
  className,
}: CharacterCardsGridProps) {
  // Build character-to-scene mapping
  const characterSceneMap = new Map<string, string>()
  scenes.forEach((scene) => {
    if (!scene.is_archived) {
      scene.character_ids.forEach((charId) => {
        characterSceneMap.set(charId, scene.title)
      })
    }
  })

  return (
    <div
      className={cn(
        "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3",
        className
      )}
    >
      {characters.map((character) => (
        <CharacterCard
          key={character.id}
          character={character}
          isGM={isGM}
          members={members}
          sceneName={characterSceneMap.get(character.id)}
          onEdit={() => onEdit(character)}
          onArchive={() => onArchive(character)}
          onAssign={() => onAssign(character)}
          onUnassign={() => onUnassign(character)}
          isSelected={selectedCharacterId === character.id}
          onSelect={onSelectCharacter ? () => onSelectCharacter(character) : undefined}
        />
      ))}
    </div>
  )
}

export default CharacterCard

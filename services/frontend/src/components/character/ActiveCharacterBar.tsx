import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CharacterPortrait } from "./CharacterPortrait"
import { cn } from "@/lib/utils"
import type { Character } from "@/types"

interface ActiveCharacterBarProps {
  character: Character | null
  onClear?: () => void
  actions?: React.ReactNode
  className?: string
}

export function ActiveCharacterBar({
  character,
  onClear,
  actions,
  className,
}: ActiveCharacterBarProps) {
  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 lg:left-1/4 lg:right-1/4 p-4 z-40",
        className
      )}
    >
      <div className="w-full">
        <div className="bg-card rounded-sm overflow-hidden">
          {!character ? (
            // No character selected - show prompt
            <div className="px-4 py-3 text-center">
              <span className="text-sm text-muted-foreground">
                Select a character from My Characters
              </span>
            </div>
          ) : (
            // Character selected - show character info
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CharacterPortrait
                  src={character.avatar_url}
                  name={character.display_name}
                  size="sm"
                  variant="circle"
                />
                <span className="text-sm font-medium">
                  {character.display_name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {actions}
                {onClear && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onClear}
                    aria-label="Clear character selection"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ActiveCharacterBar

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Settings, Users, Archive, Crown } from 'lucide-react'
import type { CampaignPhase } from '@/types'

interface SceneMenuProps {
  isGM: boolean
  currentPhase?: CampaignPhase
  onForceGMPhase?: () => void
  onViewRoster?: () => void
  onSettings?: () => void
  onArchive?: () => void
}

export function SceneMenu({
  isGM,
  currentPhase,
  onForceGMPhase,
  onViewRoster,
  onSettings,
  onArchive,
}: SceneMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full bg-background/40 backdrop-blur-md border border-border/30"
        >
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onViewRoster}>
          <Users className="h-4 w-4 mr-2" />
          View Roster
        </DropdownMenuItem>
        {isGM && (
          <>
            <DropdownMenuSeparator />
            {currentPhase === 'pc_phase' && onForceGMPhase && (
              <DropdownMenuItem onClick={onForceGMPhase}>
                <Crown className="h-4 w-4 mr-2" />
                Force GM Phase
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onSettings}>
              <Settings className="h-4 w-4 mr-2" />
              Scene Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive}>
              <Archive className="h-4 w-4 mr-2" />
              Archive Scene
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

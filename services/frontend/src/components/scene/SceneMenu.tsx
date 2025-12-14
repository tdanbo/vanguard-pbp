import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Settings, Users, Archive } from 'lucide-react'

interface SceneMenuProps {
  isGM: boolean
  onViewRoster?: () => void
  onSettings?: () => void
  onArchive?: () => void
}

export function SceneMenu({
  isGM,
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
          className="rounded-full bg-panel backdrop-blur-sm border border-border/50"
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

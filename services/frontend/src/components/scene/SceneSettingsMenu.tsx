import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoreVertical, Settings, Archive, ArchiveRestore, Trash2 } from 'lucide-react'
import { useCampaignStore } from '@/stores/campaignStore'
import { useToast } from '@/hooks/use-toast'

interface SceneSettingsMenuProps {
  campaignId: string
  sceneId: string
  sceneTitle: string
  isArchived: boolean
}

export function SceneSettingsMenu({
  campaignId,
  sceneId,
  sceneTitle,
  isArchived,
}: SceneSettingsMenuProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { archiveScene, unarchiveScene, deleteScene } = useCampaignStore()

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [confirmTitle, setConfirmTitle] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigate(`/campaigns/${campaignId}/scenes/${sceneId}/settings`)
  }

  const handleArchiveToggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsArchiving(true)
    try {
      if (isArchived) {
        await unarchiveScene(campaignId, sceneId)
        toast({
          title: 'Scene unarchived',
          description: 'The scene is now active.',
        })
      } else {
        await archiveScene(campaignId, sceneId)
        toast({
          title: 'Scene archived',
          description: 'The scene has been archived.',
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: `Failed to ${isArchived ? 'unarchive' : 'archive'} scene.`,
        variant: 'destructive',
      })
    } finally {
      setIsArchiving(false)
    }
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (confirmTitle !== sceneTitle) return

    setIsDeleting(true)
    try {
      await deleteScene(campaignId, sceneId)
      toast({
        title: 'Scene deleted',
        description: 'The scene has been permanently deleted.',
      })
      setIsDeleteDialogOpen(false)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete scene.',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const isConfirmValid = confirmTitle === sceneTitle

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full hover:bg-muted"
          >
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Scene settings</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onClick={(e) => e.stopPropagation()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DropdownMenuItem onClick={handleEdit}>
            <Settings className="h-4 w-4 mr-2" />
            Edit Scene
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleArchiveToggle} disabled={isArchiving}>
            {isArchived ? (
              <>
                <ArchiveRestore className="h-4 w-4 mr-2" />
                {isArchiving ? 'Unarchiving...' : 'Unarchive Scene'}
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 mr-2" />
                {isArchiving ? 'Archiving...' : 'Archive Scene'}
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleDeleteClick}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Scene
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent
          onClick={(e) => e.stopPropagation()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scene</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                This action cannot be undone. This will permanently delete the scene
                <span className="font-semibold"> "{sceneTitle}"</span> and all its
                posts.
              </span>
              <span className="block text-destructive font-medium">
                Type the scene title to confirm deletion:
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="confirm-title" className="sr-only">
              Scene title
            </Label>
            <Input
              id="confirm-title"
              value={confirmTitle}
              onChange={(e) => setConfirmTitle(e.target.value)}
              placeholder={sceneTitle}
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDeleting}
              onClick={() => setConfirmTitle('')}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!isConfirmValid || isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

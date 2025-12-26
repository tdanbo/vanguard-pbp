import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import {
  MoreVertical,
  EyeOff,
  Trash2,
  Lock,
  MessageSquare,
  Pencil,
} from 'lucide-react'
import { PostBlockDisplay } from './PostBlock'
import { WitnessPopover } from './WitnessPopover'
import { useCampaignStore } from '@/stores/campaignStore'
import { useToast } from '@/hooks/use-toast'
import type { Post, CampaignSettings, Character } from '@/types'

interface PostCardProps {
  post: Post
  isGM: boolean
  currentUserId: string
  settings: CampaignSettings
  sceneCharacters?: Character[]
  isLastPost?: boolean
  onEdit?: (post: Post) => void
}

export function PostCard({ post, isGM, currentUserId, settings, sceneCharacters = [], isLastPost = false, onEdit }: PostCardProps) {
  const { toast } = useToast()
  const { deletePost } = useCampaignStore()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const isOwner = post.userId === currentUserId

  // Determine if user can edit this post
  // GM can always edit any post (locked or not), owner can only edit their unlocked last post
  const canEdit = isGM || (!post.isLocked && isOwner && isLastPost)

  // Determine if user can delete this post
  // GM can always delete any post (locked or not), owner can only delete their unlocked last post
  const canDelete = isGM || (!post.isLocked && isOwner && isLastPost)

  // Show action menu if user can do anything
  const showActionMenu = canEdit || canDelete

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deletePost(post.id)
      toast({ title: 'Post deleted' })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to delete post',
        description: (error as Error).message,
      })
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  // For hidden posts that user can't see
  if (post.isHidden && !isGM && !isOwner) {
    return (
      <div className="rounded-lg border border-dashed p-4 opacity-50">
        <div className="flex items-center gap-2 text-muted-foreground">
          <EyeOff className="h-4 w-4" />
          <span className="text-sm italic">Hidden post</span>
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className={`rounded-lg border p-4 ${
          post.isHidden ? 'border-dashed bg-muted/30' : ''
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={post.characterAvatar || undefined} />
              <AvatarFallback>{getInitials(post.characterName)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{post.characterName}</span>
                <Badge variant="outline" className="text-xs">
                  {post.characterType.toUpperCase()}
                </Badge>
                {post.isLocked && !isGM && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Lock className="h-3 w-3" />
                    Locked
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDate(post.createdAt)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Witness viewer button (shows EyeOff for hidden posts) */}
            <WitnessPopover
              witnessIds={post.witnesses || []}
              characters={sceneCharacters}
              isGM={isGM}
              postId={post.id}
              isHidden={post.isHidden}
            />

            {/* Lock icon for locked posts (only shown to players, not GMs) */}
            {post.isLocked && !isGM && (
              <div
                className="text-muted-foreground/30 p-2"
                title="Post is locked (newer posts exist)"
              >
                <Lock className="h-4 w-4" />
              </div>
            )}

            {/* Action menu (GM can always see; players only on unlocked posts) */}
            {showActionMenu && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canEdit && (
                    <DropdownMenuItem onClick={() => onEdit?.(post)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit Post
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Post
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Post content blocks */}
        <div className="space-y-3">
          {post.blocks.map((block, index) => (
            <PostBlockDisplay key={index} block={block} />
          ))}
        </div>

        {/* Dice roll result (if applicable) */}
        {post.intention && (
          <div className="mt-3 flex items-center gap-2 rounded bg-muted px-3 py-2 text-sm">
            <span className="font-medium">{post.intention}</span>
            {post.modifier !== null && (
              <span className="text-muted-foreground">
                ({post.modifier >= 0 ? '+' : ''}{post.modifier})
              </span>
            )}
          </div>
        )}

        {/* OOC text */}
        {post.oocText && (settings.oocVisibility === 'all' || isGM) && (
          <div className="mt-3 rounded border-l-2 border-muted-foreground/30 bg-muted/50 px-3 py-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <MessageSquare className="h-3 w-3" />
              OOC
            </div>
            <p className="text-sm text-muted-foreground">{post.oocText}</p>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
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

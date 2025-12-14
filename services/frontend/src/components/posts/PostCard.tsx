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
  Eye,
  EyeOff,
  Trash2,
  Lock,
  MessageSquare,
} from 'lucide-react'
import { PostBlockDisplay } from './PostBlock'
import { UnhidePostDialog } from './UnhidePostDialog'
import { useCampaignStore } from '@/stores/campaignStore'
import { useToast } from '@/hooks/use-toast'
import type { Post, CampaignSettings, Character } from '@/types'

interface PostCardProps {
  post: Post
  isGM: boolean
  currentUserId: string
  settings: CampaignSettings
  sceneCharacters?: Character[]
}

export function PostCard({ post, isGM, currentUserId, settings, sceneCharacters = [] }: PostCardProps) {
  const { toast } = useToast()
  const { deletePost } = useCampaignStore()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showUnhideDialog, setShowUnhideDialog] = useState(false)
  const [currentPost, setCurrentPost] = useState(post)

  const isOwner = post.userId === currentUserId
  const canDelete = isGM
  const canUnhide = isGM && post.isHidden

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
    try {
      await deletePost(post.id)
      toast({ title: 'Post deleted' })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to delete post',
        description: (error as Error).message,
      })
    }
    setShowDeleteDialog(false)
  }

  const handleUnhideClick = () => {
    if (sceneCharacters.length > 0) {
      // Show dialog for custom witness selection
      setShowUnhideDialog(true)
    } else {
      // No scene characters - shouldn't happen, but handle gracefully
      toast({
        variant: 'destructive',
        title: 'Cannot reveal post',
        description: 'No characters in scene',
      })
    }
  }

  const handlePostUnhidden = (updatedPost: Post) => {
    setCurrentPost(updatedPost)
    toast({ title: 'Post revealed' })
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
                {post.isHidden && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <EyeOff className="h-3 w-3" />
                    Hidden
                  </Badge>
                )}
                {post.isLocked && (
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

          {(canDelete || canUnhide) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canUnhide && (
                  <DropdownMenuItem onClick={handleUnhideClick}>
                    <Eye className="mr-2 h-4 w-4" />
                    Reveal Post
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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unhide post dialog */}
      <UnhidePostDialog
        open={showUnhideDialog}
        onOpenChange={setShowUnhideDialog}
        post={currentPost}
        sceneCharacters={sceneCharacters}
        onUnhidden={handlePostUnhidden}
      />
    </>
  )
}

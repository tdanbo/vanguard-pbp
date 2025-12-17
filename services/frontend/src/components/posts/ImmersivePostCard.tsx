import { useState } from 'react'
import { CharacterPortrait } from '@/components/character/CharacterPortrait'
import { RollBadge } from '@/components/ui/game-badges'
import { MessageSquare, EyeOff, ChevronDown, ChevronUp, Pencil, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils'
import type { Post, PostBlock, CampaignSettings, RollStatus } from '@/types'

interface ImmersivePostCardProps {
  post: Post
  settings: CampaignSettings
  isGM?: boolean
  currentUserId?: string
  isLastPost?: boolean
  onEdit?: (post: Post) => void
}

export function ImmersivePostCard({
  post,
  settings,
  isGM = false,
  currentUserId,
  isLastPost = false,
  onEdit,
}: ImmersivePostCardProps) {
  const [showOOC, setShowOOC] = useState(false)
  const hasOOC = Boolean(post.oocText)
  const canSeeOOC = settings.oocVisibility === 'all' || isGM
  const isOwner = post.userId === currentUserId

  // Map roll status from post
  const rollState = post.intention ? 'pending' as RollStatus : undefined

  // For hidden posts that user can't see
  if (post.isHidden && !isGM && !isOwner) {
    return (
      <div className="bg-card rounded-sm border border-dashed border-border/30 p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <EyeOff className="h-4 w-4" />
          <span className="text-sm italic">Hidden post</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'bg-card rounded-sm overflow-hidden',
        post.isHidden && 'border border-dashed border-border/30'
      )}
    >
      <div className="grid grid-cols-[100px_1fr] md:grid-cols-[128px_1fr]">
        {/* Portrait column - square */}
        <div className="relative">
          <CharacterPortrait
            src={post.characterAvatar}
            name={post.characterName}
            size="lg"
            variant="square"
            className="w-full h-full rounded-none border-0"
          />
        </div>

        {/* Content column */}
        <div className="p-4 relative">
          {/* Upper right icons: Roll badge, Edit/Lock, Hidden indicator */}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            {/* Edit/Lock icon for post owner (not shown for hidden posts) */}
            {isOwner && !post.isHidden && (
              <>
                {isLastPost && !post.isLocked ? (
                  <button
                    onClick={() => onEdit?.(post)}
                    className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                    title="Edit post"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                ) : (
                  <div
                    className="text-muted-foreground/30"
                    title="Post is locked (newer posts exist)"
                  >
                    <Lock className="h-3.5 w-3.5" />
                  </div>
                )}
              </>
            )}

            {/* Roll badge */}
            {rollState && <RollBadge state={rollState} size="sm" />}

            {/* Hidden indicator */}
            {post.isHidden && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded">
                <EyeOff className="h-3 w-3" />
                Hidden
              </div>
            )}
          </div>

          {/* Character name */}
          <h3 className="character-name mb-2">{post.characterName || 'Narrator'}</h3>

          {/* Post content */}
          <div className="prose prose-invert prose-sm max-w-none">
            <PostBlocks blocks={post.blocks} />
          </div>

          {/* Footer: OOC toggle and timestamp */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/20">
            <div className="flex items-center gap-2">
              {hasOOC && canSeeOOC && (
                <button
                  onClick={() => setShowOOC(!showOOC)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <MessageSquare className="h-3 w-3" />
                  OOC
                  {showOOC ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(post.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {/* OOC content (expandable) */}
      {hasOOC && canSeeOOC && showOOC && (
        <div className="px-4 pb-4 ml-[100px] md:ml-[128px]">
          <div className="bg-secondary/30 rounded p-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">OOC:</span> {post.oocText}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

interface PostBlocksProps {
  blocks: PostBlock[]
}

function PostBlocks({ blocks }: PostBlocksProps) {
  return (
    <div className="space-y-2">
      {blocks.map((block, index) => (
        <div key={index}>
          {block.type === 'action' ? (
            <p className="text-foreground">{block.content}</p>
          ) : (
            <p className="text-gold italic">"{block.content}"</p>
          )}
        </div>
      ))}
    </div>
  )
}

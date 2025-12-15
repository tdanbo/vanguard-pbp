import { useState } from 'react'
import { CharacterPortrait } from '@/components/character/CharacterPortrait'
import { RollBadge } from '@/components/ui/game-badges'
import { MessageSquare, EyeOff, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils'
import type { Post, PostBlock, CampaignSettings, RollStatus } from '@/types'

interface ImmersivePostCardProps {
  post: Post
  settings: CampaignSettings
  isGM?: boolean
  currentUserId?: string
}

export function ImmersivePostCard({
  post,
  settings,
  isGM = false,
  currentUserId,
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
      <div className="bg-panel backdrop-blur-md rounded-lg border border-dashed border-border/50 p-4">
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
        'bg-panel backdrop-blur-md rounded-lg border border-border/50 overflow-hidden',
        post.isHidden && 'border-dashed'
      )}
    >
      <div className="grid grid-cols-[80px_1fr] md:grid-cols-[120px_1fr]">
        {/* Portrait column */}
        <div className="relative min-h-[120px]">
          <CharacterPortrait
            src={post.characterAvatar}
            name={post.characterName}
            size="lg"
            className="w-full h-full rounded-none border-0"
          />
          {/* Gradient fade into content */}
          <div className="absolute inset-y-0 right-0 w-8 gradient-fade-right" />
        </div>

        {/* Content column */}
        <div className="p-4 relative">
          {/* Roll badge in upper right */}
          {rollState && (
            <div className="absolute top-3 right-3">
              <RollBadge state={rollState} size="sm" />
            </div>
          )}

          {/* Hidden indicator */}
          {post.isHidden && (
            <div className="absolute top-3 right-3 flex items-center gap-1 text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded">
              <EyeOff className="h-3 w-3" />
              Hidden
            </div>
          )}

          {/* Character name */}
          <h3 className="character-name mb-2">{post.characterName || 'Narrator'}</h3>

          {/* Post content */}
          <div className="prose prose-invert prose-sm max-w-none">
            <PostBlocks blocks={post.blocks} />
          </div>

          {/* Footer: OOC toggle and timestamp */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
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
        <div className="px-4 pb-4 ml-[80px] md:ml-[120px]">
          <div className="bg-secondary/50 rounded-lg p-3">
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

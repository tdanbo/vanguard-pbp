import { useMemo } from 'react'
import { ImmersivePostCard } from './ImmersivePostCard'
import { EmptyPosts } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import type { Post, CampaignSettings, Roll } from '@/types'

interface PostStreamProps {
  posts: Post[]
  settings: CampaignSettings
  rolls?: Roll[]
  isGM?: boolean
  currentUserId?: string
  isLoading?: boolean
  onEditPost?: (post: Post) => void
  onRollUpdated?: () => void
}

export function PostStream({
  posts,
  settings,
  rolls = [],
  isGM = false,
  currentUserId,
  isLoading = false,
  onEditPost,
  onRollUpdated,
}: PostStreamProps) {
  // Calculate the last post ID for edit icon logic
  const lastPostId = posts.length > 0 ? posts[posts.length - 1].id : null

  // Map rolls to posts by postId for efficient lookup
  const postRollMap = useMemo(() => {
    const map: Record<string, Roll | undefined> = {}
    rolls.forEach((roll) => {
      if (roll.postId) {
        map[roll.postId] = roll
      }
    })
    return map
  }, [rolls])
  if (isLoading) {
    return (
      <div className="w-full px-4 py-6 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <PostStreamSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="w-full px-4 py-6">
        <div className="bg-card rounded-sm p-8">
          <EmptyPosts variant="compact" />
        </div>
      </div>
    )
  }

  return (
    <div className="w-full px-4 py-6 space-y-2">
      {posts.map((post) => (
        <ImmersivePostCard
          key={post.id}
          post={post}
          settings={settings}
          roll={postRollMap[post.id]}
          isGM={isGM}
          currentUserId={currentUserId}
          isLastPost={post.id === lastPostId}
          onEdit={onEditPost}
          onRollUpdated={onRollUpdated}
        />
      ))}
    </div>
  )
}

function PostStreamSkeleton() {
  return (
    <div className="bg-card rounded-sm overflow-hidden">
      <div className="grid grid-cols-[80px_1fr] md:grid-cols-[100px_1fr] h-[160px] md:h-[180px]">
        {/* Portrait skeleton - full height */}
        <Skeleton className="h-full" />

        {/* Content skeleton */}
        <div className="p-4 flex flex-col h-full">
          <Skeleton className="h-5 w-32 mb-2 flex-shrink-0" />
          <div className="flex-1 space-y-2 overflow-hidden">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <div className="flex justify-end pt-2 border-t border-border/20 flex-shrink-0">
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>
    </div>
  )
}

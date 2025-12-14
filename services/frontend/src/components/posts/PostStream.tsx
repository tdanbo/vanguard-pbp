import { ImmersivePostCard } from './ImmersivePostCard'
import { EmptyPosts } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import type { Post, CampaignSettings } from '@/types'

interface PostStreamProps {
  posts: Post[]
  settings: CampaignSettings
  isGM?: boolean
  currentUserId?: string
  isLoading?: boolean
}

export function PostStream({
  posts,
  settings,
  isGM = false,
  currentUserId,
  isLoading = false,
}: PostStreamProps) {
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <PostStreamSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-panel backdrop-blur-md rounded-lg border border-border/50 p-8">
          <EmptyPosts variant="compact" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
      {posts.map((post) => (
        <ImmersivePostCard
          key={post.id}
          post={post}
          settings={settings}
          isGM={isGM}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  )
}

function PostStreamSkeleton() {
  return (
    <div className="bg-panel backdrop-blur-md rounded-lg border border-border/50 overflow-hidden">
      <div className="grid grid-cols-[80px_1fr] md:grid-cols-[120px_1fr]">
        {/* Portrait skeleton */}
        <Skeleton className="min-h-[120px]" />

        {/* Content skeleton */}
        <div className="p-4 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex justify-end pt-3 border-t border-border/30">
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>
    </div>
  )
}

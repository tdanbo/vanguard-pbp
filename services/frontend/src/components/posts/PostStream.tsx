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
  onEditPost?: (post: Post) => void
}

export function PostStream({
  posts,
  settings,
  isGM = false,
  currentUserId,
  isLoading = false,
  onEditPost,
}: PostStreamProps) {
  // Calculate the last post ID for edit icon logic
  const lastPostId = posts.length > 0 ? posts[posts.length - 1].id : null
  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <PostStreamSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="bg-card rounded-sm p-8">
          <EmptyPosts variant="compact" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-2">
      {posts.map((post) => (
        <ImmersivePostCard
          key={post.id}
          post={post}
          settings={settings}
          isGM={isGM}
          currentUserId={currentUserId}
          isLastPost={post.id === lastPostId}
          onEdit={onEditPost}
        />
      ))}
    </div>
  )
}

function PostStreamSkeleton() {
  return (
    <div className="bg-card rounded-sm overflow-hidden">
      <div className="grid grid-cols-[100px_1fr] md:grid-cols-[128px_1fr]">
        {/* Portrait skeleton - square */}
        <Skeleton className="aspect-square" />

        {/* Content skeleton */}
        <div className="p-4 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex justify-end pt-3 border-t border-border/20">
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>
    </div>
  )
}

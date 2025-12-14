import { useState } from 'react'
import { Bell, Check, CheckCheck, Settings, Trash2, ExternalLink } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useNotifications } from '@/hooks/useNotifications'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { Notification } from '@/types'

interface NotificationCenterProps {
  className?: string
  onSettingsClick?: () => void
}

export function NotificationCenter({ className, onSettingsClick }: NotificationCenterProps) {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loadMore,
    hasMore,
  } = useNotifications({
    autoFetch: true,
    enableRealtime: true,
    limit: 20,
  })

  const [isOpen, setIsOpen] = useState(false)
  const [markingAllRead, setMarkingAllRead] = useState(false)

  async function handleMarkAllAsRead() {
    setMarkingAllRead(true)
    try {
      await markAllAsRead()
    } finally {
      setMarkingAllRead(false)
    }
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('relative', className)}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleMarkAllAsRead}
                disabled={markingAllRead}
              >
                <CheckCheck className="mr-1 h-3 w-3" />
                Mark all read
              </Button>
            )}
            {onSettingsClick && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setIsOpen(false)
                  onSettingsClick()
                }}
              >
                <Settings className="h-3 w-3" />
              </Button>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[400px] overflow-y-auto">
          {isLoading && notifications.length === 0 ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            <>
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={() => markAsRead(notification.id)}
                  onDelete={() => deleteNotification(notification.id)}
                  onNavigate={() => setIsOpen(false)}
                />
              ))}
              {hasMore && (
                <div className="p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={loadMore}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Loading...' : 'Load more'}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface NotificationItemProps {
  notification: Notification
  onMarkAsRead: () => void
  onDelete: () => void
  onNavigate: () => void
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onNavigate,
}: NotificationItemProps) {
  const [isHovered, setIsHovered] = useState(false)

  function handleClick() {
    if (!notification.is_read) {
      onMarkAsRead()
    }
    if (notification.link) {
      window.location.href = notification.link
      onNavigate()
    }
  }

  return (
    <div
      className={cn(
        'relative flex cursor-pointer items-start gap-3 px-3 py-2 transition-colors hover:bg-accent',
        !notification.is_read && 'bg-accent/50'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      {/* Unread indicator */}
      {!notification.is_read && (
        <div className="absolute left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary" />
      )}

      <div className="min-w-0 flex-1 pl-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className={cn('text-sm', !notification.is_read && 'font-medium')}>
              {notification.title}
            </p>
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {notification.body}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
            </p>
          </div>
          {notification.is_urgent && (
            <Badge variant="destructive" className="shrink-0 text-xs">
              Urgent
            </Badge>
          )}
        </div>
      </div>

      {/* Action buttons (shown on hover) */}
      {isHovered && (
        <div className="absolute right-2 top-2 flex items-center gap-1">
          {!notification.is_read && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation()
                onMarkAsRead()
              }}
              title="Mark as read"
            >
              <Check className="h-3 w-3" />
            </Button>
          )}
          {notification.link && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation()
                window.open(notification.link!, '_blank')
              }}
              title="Open in new tab"
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  )
}

// Export NotificationBadge separately for use in other places
export function NotificationBadge({ count }: { count: number }) {
  if (count <= 0) return null

  return (
    <Badge
      variant="destructive"
      className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-xs"
    >
      {count > 99 ? '99+' : count}
    </Badge>
  )
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import type {
  Notification,
  NotificationPreferences,
  QuietHours,
  UpdateNotificationPreferencesRequest,
  UpdateQuietHoursRequest,
} from '@/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface NotificationsResponse {
  notifications: Notification[]
  limit: number
  offset: number
}

interface UnreadCountResponse {
  count: number
}

interface MarkAllAsReadResponse {
  marked_count: number
}

interface UseNotificationsOptions {
  /** Auto-fetch notifications on mount */
  autoFetch?: boolean
  /** Limit per page */
  limit?: number
  /** Subscribe to real-time notification updates */
  enableRealtime?: boolean
  /** Callback when new notification arrives */
  onNewNotification?: (notification: Notification) => void
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const {
    autoFetch = true,
    limit = 50,
    enableRealtime = true,
    onNewNotification,
  } = options

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  const offsetRef = useRef(0)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const onNewNotificationRef = useRef(onNewNotification)

  useEffect(() => {
    onNewNotificationRef.current = onNewNotification
  }, [onNewNotification])

  // Fetch notifications
  const fetchNotifications = useCallback(async (reset = false) => {
    if (isLoading) return

    setIsLoading(true)
    setError(null)

    try {
      const currentOffset = reset ? 0 : offsetRef.current
      const response = await api<NotificationsResponse>(
        `/api/v1/notifications?limit=${limit}&offset=${currentOffset}`
      )

      if (reset) {
        setNotifications(response.notifications || [])
        offsetRef.current = response.notifications?.length || 0
      } else {
        setNotifications(prev => [...prev, ...(response.notifications || [])])
        offsetRef.current += response.notifications?.length || 0
      }

      setHasMore((response.notifications?.length || 0) === limit)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, limit])

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await api<UnreadCountResponse>('/api/v1/notifications/unread/count')
      setUnreadCount(response.count)
    } catch {
      // Ignore errors for count fetch
    }
  }, [])

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    const updated = await api<Notification>(
      `/api/v1/notifications/${notificationId}/read`,
      { method: 'POST' }
    )

    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? updated : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))

    return updated
  }, [])

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    const response = await api<MarkAllAsReadResponse>(
      '/api/v1/notifications/read-all',
      { method: 'POST' }
    )

    setNotifications(prev =>
      prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
    )
    setUnreadCount(0)

    return response.marked_count
  }, [])

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    await api(`/api/v1/notifications/${notificationId}`, { method: 'DELETE' })

    const notification = notifications.find(n => n.id === notificationId)
    setNotifications(prev => prev.filter(n => n.id !== notificationId))

    if (notification && !notification.is_read) {
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
  }, [notifications])

  // Load more notifications
  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      fetchNotifications(false)
    }
  }, [hasMore, isLoading, fetchNotifications])

  // Refresh notifications
  const refresh = useCallback(() => {
    offsetRef.current = 0
    fetchNotifications(true)
    fetchUnreadCount()
  }, [fetchNotifications, fetchUnreadCount])

  // Add new notification to the top of the list
  const addNotification = useCallback((notification: Notification) => {
    setNotifications(prev => [notification, ...prev])
    if (!notification.is_read) {
      setUnreadCount(prev => prev + 1)
    }
    onNewNotificationRef.current?.(notification)
  }, [])

  // Set up real-time subscription for new notifications
  useEffect(() => {
    if (!enableRealtime) return

    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Subscribe to changes on the notifications table for this user
      const channel = supabase
        .channel('notifications-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newNotification = payload.new as Notification
            addNotification(newNotification)
          }
        )
        .subscribe()

      channelRef.current = channel
    }

    setupRealtimeSubscription()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [enableRealtime, addNotification])

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchNotifications(true)
      fetchUnreadCount()
    }
  }, [autoFetch]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    hasMore,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loadMore,
    refresh,
    fetchUnreadCount,
  }
}

// Hook for notification preferences
export function useNotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPreferences = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await api<NotificationPreferences>('/api/v1/notification-preferences')
      setPreferences(response)
    } catch {
      // Return defaults on error (API returns defaults if none set)
      setPreferences(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const updatePreferences = useCallback(async (updates: UpdateNotificationPreferencesRequest) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await api<NotificationPreferences>('/api/v1/notification-preferences', {
        method: 'PUT',
        body: updates,
      })
      setPreferences(response)
      return response
    } catch (err) {
      setError((err as Error).message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPreferences()
  }, [fetchPreferences])

  return {
    preferences,
    isLoading,
    error,
    updatePreferences,
    refresh: fetchPreferences,
  }
}

// Hook for quiet hours settings
export function useQuietHours() {
  const [quietHours, setQuietHours] = useState<QuietHours | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchQuietHours = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await api<QuietHours>('/api/v1/quiet-hours')
      setQuietHours(response)
    } catch {
      // Return defaults on error
      setQuietHours(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const updateQuietHours = useCallback(async (updates: UpdateQuietHoursRequest) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await api<QuietHours>('/api/v1/quiet-hours', {
        method: 'PUT',
        body: updates,
      })
      setQuietHours(response)
      return response
    } catch (err) {
      setError((err as Error).message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQuietHours()
  }, [fetchQuietHours])

  return {
    quietHours,
    isLoading,
    error,
    updateQuietHours,
    refresh: fetchQuietHours,
  }
}

import { useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type {
  RealtimeEvent,
  PostEvent,
  ComposeLockEvent,
  PassStateEvent,
  CharacterPresenceEvent,
  RollEvent,
} from '@/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface SceneEventHandlers {
  onPostCreated?: (event: PostEvent) => void
  onPostUpdated?: (event: PostEvent) => void
  onPostDeleted?: (event: PostEvent) => void
  onComposeLockAcquired?: (event: ComposeLockEvent) => void
  onComposeLockReleased?: (event: ComposeLockEvent) => void
  onPassStateChanged?: (event: PassStateEvent) => void
  onCharacterJoined?: (event: CharacterPresenceEvent) => void
  onCharacterLeft?: (event: CharacterPresenceEvent) => void
  onRollCreated?: (event: RollEvent) => void
  onRollResolved?: (event: RollEvent) => void
  onAnyEvent?: (event: RealtimeEvent) => void
}

interface UseSceneSubscriptionOptions {
  sceneId: string | null
  handlers: SceneEventHandlers
  enabled?: boolean
  // Character IDs the current user can see (for witness filtering)
  visibleCharacterIds?: string[]
}

export function useSceneSubscription({
  sceneId,
  handlers,
  enabled = true,
  visibleCharacterIds,
}: UseSceneSubscriptionOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const handlersRef = useRef(handlers)
  const visibleCharacterIdsRef = useRef(visibleCharacterIds)

  // Update refs when they change
  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    visibleCharacterIdsRef.current = visibleCharacterIds
  }, [visibleCharacterIds])

  // Check if user can see this post based on witness filtering
  const canSeePost = useCallback((event: PostEvent): boolean => {
    // If not hidden, everyone can see
    if (!event.is_hidden) return true

    // If no visible characters provided, assume can see everything
    const visibleIds = visibleCharacterIdsRef.current
    if (!visibleIds || visibleIds.length === 0) return true

    // Check if any of user's characters are in witness list
    return event.witness_list.some(witnessId =>
      visibleIds.includes(witnessId)
    )
  }, [])

  const handleBroadcast = useCallback((payload: { event: string; payload: RealtimeEvent }) => {
    const event = payload.payload
    const currentHandlers = handlersRef.current

    // Handle post events with witness filtering
    if (event.type === 'post_created' || event.type === 'post_updated') {
      const postEvent = event as PostEvent
      if (!canSeePost(postEvent)) {
        // User cannot see this post, skip handler
        return
      }
    }

    // Call specific handler based on event type
    switch (event.type) {
      case 'post_created':
        currentHandlers.onPostCreated?.(event as PostEvent)
        break
      case 'post_updated':
        currentHandlers.onPostUpdated?.(event as PostEvent)
        break
      case 'post_deleted':
        currentHandlers.onPostDeleted?.(event as PostEvent)
        break
      case 'compose_lock_acquired':
        currentHandlers.onComposeLockAcquired?.(event as ComposeLockEvent)
        break
      case 'compose_lock_released':
        currentHandlers.onComposeLockReleased?.(event as ComposeLockEvent)
        break
      case 'pass_state_changed':
        currentHandlers.onPassStateChanged?.(event as PassStateEvent)
        break
      case 'character_joined':
        currentHandlers.onCharacterJoined?.(event as CharacterPresenceEvent)
        break
      case 'character_left':
        currentHandlers.onCharacterLeft?.(event as CharacterPresenceEvent)
        break
      case 'roll_created':
        currentHandlers.onRollCreated?.(event as RollEvent)
        break
      case 'roll_resolved':
        currentHandlers.onRollResolved?.(event as RollEvent)
        break
    }

    // Always call the catch-all handler
    currentHandlers.onAnyEvent?.(event)
  }, [canSeePost])

  useEffect(() => {
    if (!sceneId || !enabled) {
      // Cleanup existing channel if disabled or no sceneId
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      return
    }

    // Create channel for scene-level events
    const channelName = `scene:${sceneId}`
    const channel = supabase.channel(channelName)

    // Subscribe to all broadcast events for this scene
    channel
      .on('broadcast', { event: 'post_created' }, handleBroadcast)
      .on('broadcast', { event: 'post_updated' }, handleBroadcast)
      .on('broadcast', { event: 'post_deleted' }, handleBroadcast)
      .on('broadcast', { event: 'compose_lock_acquired' }, handleBroadcast)
      .on('broadcast', { event: 'compose_lock_released' }, handleBroadcast)
      .on('broadcast', { event: 'pass_state_changed' }, handleBroadcast)
      .on('broadcast', { event: 'character_joined' }, handleBroadcast)
      .on('broadcast', { event: 'character_left' }, handleBroadcast)
      .on('broadcast', { event: 'roll_created' }, handleBroadcast)
      .on('broadcast', { event: 'roll_resolved' }, handleBroadcast)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to scene channel: ${channelName}`)
        }
      })

    channelRef.current = channel

    // Cleanup on unmount or when sceneId changes
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [sceneId, enabled, handleBroadcast])

  // Note: Return value intentionally empty - subscription status is managed internally
  // Exposing ref.current would cause issues as per React's refs rules
  return {}
}

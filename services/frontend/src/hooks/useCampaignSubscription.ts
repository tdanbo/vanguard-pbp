import { useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type {
  RealtimeEvent,
  PhaseTransitionEvent,
  PassStateEvent,
  TimeGateWarningEvent,
} from '@/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface CampaignEventHandlers {
  onPhaseTransition?: (event: PhaseTransitionEvent) => void
  onPassStateChanged?: (event: PassStateEvent) => void
  onTimeGateWarning?: (event: TimeGateWarningEvent) => void
  onAnyEvent?: (event: RealtimeEvent) => void
}

interface UseCampaignSubscriptionOptions {
  campaignId: string | null
  handlers: CampaignEventHandlers
  enabled?: boolean
}

export function useCampaignSubscription({
  campaignId,
  handlers,
  enabled = true,
}: UseCampaignSubscriptionOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const handlersRef = useRef(handlers)

  // Update handlers ref when they change
  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  const handleBroadcast = useCallback((payload: { event: string; payload: RealtimeEvent }) => {
    const event = payload.payload
    const currentHandlers = handlersRef.current

    // Call specific handler based on event type
    switch (event.type) {
      case 'phase_transition':
        currentHandlers.onPhaseTransition?.(event as PhaseTransitionEvent)
        break
      case 'pass_state_changed':
        currentHandlers.onPassStateChanged?.(event as PassStateEvent)
        break
      case 'timegate_warning':
        currentHandlers.onTimeGateWarning?.(event as TimeGateWarningEvent)
        break
    }

    // Always call the catch-all handler
    currentHandlers.onAnyEvent?.(event)
  }, [])

  useEffect(() => {
    if (!campaignId || !enabled) {
      // Cleanup existing channel if disabled or no campaignId
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      return
    }

    // Create channel for campaign-level events
    const channelName = `campaign:${campaignId}`
    const channel = supabase.channel(channelName)

    // Subscribe to broadcast events
    channel
      .on('broadcast', { event: 'phase_transition' }, handleBroadcast)
      .on('broadcast', { event: 'pass_state_changed' }, handleBroadcast)
      .on('broadcast', { event: 'timegate_warning' }, handleBroadcast)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to campaign channel: ${channelName}`)
        }
      })

    channelRef.current = channel

    // Cleanup on unmount or when campaignId changes
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [campaignId, enabled, handleBroadcast])

  // Note: Return value intentionally empty - subscription status is managed internally
  // Exposing ref.current would cause issues as per React's refs rules
  return {}
}

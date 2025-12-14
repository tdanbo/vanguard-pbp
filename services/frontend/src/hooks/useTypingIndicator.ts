import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface TypingUser {
  id: string
  characterId: string
  characterName: string
  isTyping: boolean
  lastUpdate: number
}

interface UseTypingIndicatorOptions {
  sceneId: string | null
  characterId: string | null
  characterName: string
  enabled?: boolean
}

const TYPING_TIMEOUT = 5000 // 5 seconds before marking user as not typing

export function useTypingIndicator({
  sceneId,
  characterId,
  characterName,
  enabled = true,
}: UseTypingIndicatorOptions) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([])

  const channelRef = useRef<RealtimeChannel | null>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cleanupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Broadcast typing status
  const setTyping = useCallback((isTyping: boolean) => {
    if (!channelRef.current || !characterId) return

    channelRef.current.track({
      characterId,
      characterName,
      isTyping,
      lastUpdate: Date.now(),
    })
  }, [characterId, characterName])

  // Start typing (call when user starts typing)
  const startTyping = useCallback(() => {
    setTyping(true)

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Set timeout to stop typing after inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false)
    }, TYPING_TIMEOUT)
  }, [setTyping])

  // Stop typing (call when user stops typing or submits)
  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
    setTyping(false)
  }, [setTyping])

  // Clean up stale typing indicators
  const cleanupStaleTypingUsers = useCallback(() => {
    const now = Date.now()
    setTypingUsers(prev =>
      prev.filter(user =>
        user.isTyping && (now - user.lastUpdate) < TYPING_TIMEOUT * 2
      )
    )
  }, [])

  useEffect(() => {
    // Reset typing users when scene changes or becomes disabled
    // This is intentional - we need to clear old typing state when scene changes
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTypingUsers([])

    // When disabled or no sceneId, cleanup resources
    if (!sceneId || !enabled) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current)
        cleanupIntervalRef.current = null
      }
      return
    }

    // Create presence channel
    const channelName = `typing:${sceneId}`
    const channel = supabase.channel(channelName)

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users: TypingUser[] = []

        Object.values(state).forEach((presenceList) => {
          presenceList.forEach((presence: unknown) => {
            const p = presence as {
              characterId: string
              characterName: string
              isTyping: boolean
              lastUpdate: number
            }
            // Don't include self
            if (p.characterId !== characterId && p.isTyping) {
              users.push({
                id: p.characterId,
                characterId: p.characterId,
                characterName: p.characterName,
                isTyping: p.isTyping,
                lastUpdate: p.lastUpdate,
              })
            }
          })
        })

        setTypingUsers(users)
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach((presence: unknown) => {
          const p = presence as {
            characterId: string
            characterName: string
            isTyping: boolean
            lastUpdate: number
          }
          // Don't include self
          if (p.characterId !== characterId && p.isTyping) {
            setTypingUsers(prev => {
              const existing = prev.find(u => u.characterId === p.characterId)
              if (existing) {
                return prev.map(u =>
                  u.characterId === p.characterId
                    ? { ...u, isTyping: p.isTyping, lastUpdate: p.lastUpdate }
                    : u
                )
              }
              return [...prev, {
                id: p.characterId,
                characterId: p.characterId,
                characterName: p.characterName,
                isTyping: p.isTyping,
                lastUpdate: p.lastUpdate,
              }]
            })
          }
        })
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((presence: unknown) => {
          const p = presence as { characterId: string }
          setTypingUsers(prev => prev.filter(u => u.characterId !== p.characterId))
        })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track initial presence state (not typing)
          await channel.track({
            characterId,
            characterName,
            isTyping: false,
            lastUpdate: Date.now(),
          })
        }
      })

    channelRef.current = channel

    // Set up cleanup interval for stale typing indicators
    cleanupIntervalRef.current = setInterval(cleanupStaleTypingUsers, TYPING_TIMEOUT)

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current)
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [sceneId, characterId, characterName, enabled, cleanupStaleTypingUsers])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTyping()
    }
  }, [stopTyping])

  // Get formatted typing message
  const typingMessage = useCallback((): string | null => {
    if (typingUsers.length === 0) return null

    const names = typingUsers.map(u => u.characterName)

    if (names.length === 1) {
      return `${names[0]} is typing...`
    } else if (names.length === 2) {
      return `${names[0]} and ${names[1]} are typing...`
    } else {
      return `${names.length} people are typing...`
    }
  }, [typingUsers])

  return {
    typingUsers,
    typingMessage: typingMessage(),
    startTyping,
    stopTyping,
  }
}

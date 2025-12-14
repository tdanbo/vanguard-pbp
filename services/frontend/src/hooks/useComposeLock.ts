import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import type { ComposeLock, AcquireLockRequest, HeartbeatResponse } from '@/types'

const HEARTBEAT_INTERVAL = 30000 // 30 seconds

interface UseComposeLockOptions {
  sceneId: string
  characterId: string
  onLockLost?: () => void
  onError?: (error: Error) => void
}

interface UseComposeLockReturn {
  lockId: string | null
  isLocked: boolean
  remainingSeconds: number
  acquireLock: (isHidden?: boolean) => Promise<boolean>
  releaseLock: () => Promise<void>
  updateHiddenStatus: (isHidden: boolean) => Promise<void>
  isLoading: boolean
  error: string | null
}

export function useComposeLock({
  sceneId,
  characterId,
  onLockLost,
  onError,
}: UseComposeLockOptions): UseComposeLockReturn {
  const [lockId, setLockId] = useState<string | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cleanup intervals
  const clearIntervals = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
  }, [])

  // Start heartbeat
  const startHeartbeat = useCallback((currentLockId: string) => {
    clearIntervals()

    // Heartbeat interval
    heartbeatIntervalRef.current = setInterval(async () => {
      try {
        const response = await api<HeartbeatResponse>('/api/v1/compose/heartbeat', {
          method: 'POST',
          body: { lockId: currentLockId },
        })
        setRemainingSeconds(response.remainingSeconds)
      } catch {
        // Lock lost
        clearIntervals()
        setLockId(null)
        setRemainingSeconds(0)
        onLockLost?.()
      }
    }, HEARTBEAT_INTERVAL)

    // Countdown interval
    countdownIntervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearIntervals()
          setLockId(null)
          onLockLost?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [clearIntervals, onLockLost])

  // Acquire lock
  const acquireLock = useCallback(async (isHidden = false): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const request: AcquireLockRequest = { sceneId, characterId, isHidden }
      const response = await api<ComposeLock>('/api/v1/compose/acquire', {
        method: 'POST',
        body: request,
      })

      setLockId(response.lockId)
      setRemainingSeconds(response.remainingSeconds)
      startHeartbeat(response.lockId)
      setIsLoading(false)
      return true
    } catch (err) {
      const error = err as Error
      setError(error.message)
      setIsLoading(false)
      onError?.(error)
      return false
    }
  }, [sceneId, characterId, startHeartbeat, onError])

  // Update hidden status
  const updateHiddenStatus = useCallback(async (isHidden: boolean) => {
    if (!lockId) return

    try {
      await api(`/api/v1/compose/${lockId}/hidden`, {
        method: 'PATCH',
        body: { isHidden },
      })
    } catch {
      // Ignore errors - lock might be lost
    }
  }, [lockId])

  // Release lock
  const releaseLock = useCallback(async () => {
    if (!lockId) return

    clearIntervals()

    try {
      await api(`/api/v1/compose/${lockId}`, { method: 'DELETE' })
    } catch {
      // Ignore release errors - lock might already be expired
    }

    setLockId(null)
    setRemainingSeconds(0)
  }, [lockId, clearIntervals])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearIntervals()
      // Attempt to release lock on unmount
      if (lockId) {
        api(`/api/v1/compose/${lockId}`, { method: 'DELETE' }).catch(() => {})
      }
    }
  }, [clearIntervals, lockId])

  return {
    lockId,
    isLocked: lockId !== null,
    remainingSeconds,
    acquireLock,
    releaseLock,
    updateHiddenStatus,
    isLoading,
    error,
  }
}

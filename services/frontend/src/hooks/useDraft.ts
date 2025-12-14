import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import type { Draft, SaveDraftRequest, PostBlock } from '@/types'

const AUTOSAVE_DELAY = 2000 // 2 seconds debounce

interface UseDraftOptions {
  sceneId: string
  characterId: string
  autoLoad?: boolean
}

interface UseDraftReturn {
  draft: Draft | null
  blocks: PostBlock[]
  oocText: string
  intention: string | null
  modifier: number | null
  isHidden: boolean
  isDirty: boolean
  isLoading: boolean
  isSaving: boolean
  error: string | null
  setBlocks: (blocks: PostBlock[]) => void
  setOocText: (text: string) => void
  setIntention: (intention: string | null) => void
  setModifier: (modifier: number | null) => void
  setIsHidden: (isHidden: boolean) => void
  saveDraft: () => Promise<void>
  loadDraft: () => Promise<void>
  deleteDraft: () => Promise<void>
  clearDraft: () => void
}

export function useDraft({
  sceneId,
  characterId,
  autoLoad = true,
}: UseDraftOptions): UseDraftReturn {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [blocks, setBlocksState] = useState<PostBlock[]>([])
  const [oocText, setOocTextState] = useState('')
  const [intention, setIntentionState] = useState<string | null>(null)
  const [modifier, setModifierState] = useState<number | null>(null)
  const [isHidden, setIsHiddenState] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Schedule autosave
  const scheduleAutosave = useCallback(() => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current)
    }
    autosaveTimeoutRef.current = setTimeout(async () => {
      if (blocks.length > 0 || oocText.trim()) {
        try {
          setIsSaving(true)
          const request: SaveDraftRequest = {
            sceneId,
            characterId,
            blocks,
            oocText: oocText || undefined,
            intention: intention || undefined,
            modifier: modifier ?? undefined,
            isHidden,
          }
          const savedDraft = await api<Draft>('/api/v1/drafts', {
            method: 'POST',
            body: request,
          })
          setDraft(savedDraft)
          setIsDirty(false)
        } catch (err) {
          setError((err as Error).message)
        } finally {
          setIsSaving(false)
        }
      }
    }, AUTOSAVE_DELAY)
  }, [sceneId, characterId, blocks, oocText, intention, modifier, isHidden])

  // Setters with dirty tracking and autosave
  const setBlocks = useCallback((newBlocks: PostBlock[]) => {
    setBlocksState(newBlocks)
    setIsDirty(true)
    scheduleAutosave()
  }, [scheduleAutosave])

  const setOocText = useCallback((text: string) => {
    setOocTextState(text)
    setIsDirty(true)
    scheduleAutosave()
  }, [scheduleAutosave])

  const setIntention = useCallback((newIntention: string | null) => {
    setIntentionState(newIntention)
    setIsDirty(true)
    scheduleAutosave()
  }, [scheduleAutosave])

  const setModifier = useCallback((newModifier: number | null) => {
    setModifierState(newModifier)
    setIsDirty(true)
    scheduleAutosave()
  }, [scheduleAutosave])

  const setIsHidden = useCallback((hidden: boolean) => {
    setIsHiddenState(hidden)
    setIsDirty(true)
    scheduleAutosave()
  }, [scheduleAutosave])

  // Load draft
  const loadDraft = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const loadedDraft = await api<Draft>(`/api/v1/drafts/${sceneId}/${characterId}`)
      setDraft(loadedDraft)
      setBlocksState(loadedDraft.blocks || [])
      setOocTextState(loadedDraft.oocText || '')
      setIntentionState(loadedDraft.intention)
      setModifierState(loadedDraft.modifier)
      setIsHiddenState(loadedDraft.isHidden)
      setIsDirty(false)
    } catch {
      // No draft found - that's okay
      setDraft(null)
    } finally {
      setIsLoading(false)
    }
  }, [sceneId, characterId])

  // Manual save
  const saveDraft = useCallback(async () => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current)
    }

    setIsSaving(true)
    setError(null)

    try {
      const request: SaveDraftRequest = {
        sceneId,
        characterId,
        blocks,
        oocText: oocText || undefined,
        intention: intention || undefined,
        modifier: modifier ?? undefined,
        isHidden,
      }
      const savedDraft = await api<Draft>('/api/v1/drafts', {
        method: 'POST',
        body: request,
      })
      setDraft(savedDraft)
      setIsDirty(false)
    } catch (err) {
      setError((err as Error).message)
      throw err
    } finally {
      setIsSaving(false)
    }
  }, [sceneId, characterId, blocks, oocText, intention, modifier, isHidden])

  // Delete draft
  const deleteDraft = useCallback(async () => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current)
    }

    try {
      await api(`/api/v1/drafts/${sceneId}/${characterId}`, { method: 'DELETE' })
      setDraft(null)
      setBlocksState([])
      setOocTextState('')
      setIntentionState(null)
      setModifierState(null)
      setIsHiddenState(false)
      setIsDirty(false)
    } catch {
      // Ignore delete errors
    }
  }, [sceneId, characterId])

  // Clear local state
  const clearDraft = useCallback(() => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current)
    }
    setBlocksState([])
    setOocTextState('')
    setIntentionState(null)
    setModifierState(null)
    setIsHiddenState(false)
    setIsDirty(false)
  }, [])

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad && sceneId && characterId) {
      loadDraft()
    }
  }, [autoLoad, sceneId, characterId, loadDraft])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current)
      }
    }
  }, [])

  return {
    draft,
    blocks,
    oocText,
    intention,
    modifier,
    isHidden,
    isDirty,
    isLoading,
    isSaving,
    error,
    setBlocks,
    setOocText,
    setIntention,
    setModifier,
    setIsHidden,
    saveDraft,
    loadDraft,
    deleteDraft,
    clearDraft,
  }
}

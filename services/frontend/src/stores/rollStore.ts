import { create } from 'zustand'
import { api } from '@/lib/api'
import type {
  Roll,
  CreateRollRequest,
  OverrideIntentionRequest,
  ManualResolveRequest,
  UnresolvedRoll,
  DicePreset,
} from '@/types'

interface RollState {
  // Data
  rolls: Roll[]
  pendingRolls: Roll[]
  unresolvedRolls: UnresolvedRoll[]
  dicePresets: DicePreset[]
  validDiceTypes: string[]

  // Loading states
  loadingRolls: boolean
  loadingPendingRolls: boolean
  loadingUnresolvedRolls: boolean
  loadingPresets: boolean

  error: string | null

  // Roll operations
  createRoll: (data: CreateRollRequest) => Promise<Roll>
  getRoll: (rollId: string) => Promise<Roll>
  getRollsByPost: (postId: string) => Promise<Roll[]>
  getPendingRollsForCharacter: (characterId: string) => Promise<void>
  getUnresolvedRollsInCampaign: (campaignId: string) => Promise<void>
  getRollsInScene: (sceneId: string) => Promise<void>

  // GM operations
  overrideIntention: (rollId: string, data: OverrideIntentionRequest) => Promise<Roll>
  manuallyResolve: (rollId: string, data: ManualResolveRequest) => Promise<Roll>
  invalidateRoll: (rollId: string) => Promise<Roll>

  // Dice system
  fetchDicePresets: () => Promise<void>
  fetchValidDiceTypes: () => Promise<void>

  // Utils
  clearError: () => void
  clearRolls: () => void
}

export const useRollStore = create<RollState>((set) => ({
  rolls: [],
  pendingRolls: [],
  unresolvedRolls: [],
  dicePresets: [],
  validDiceTypes: [],
  loadingRolls: false,
  loadingPendingRolls: false,
  loadingUnresolvedRolls: false,
  loadingPresets: false,
  error: null,

  createRoll: async (data: CreateRollRequest) => {
    set({ loadingRolls: true, error: null })
    try {
      const roll = await api<Roll>('/api/v1/rolls', {
        method: 'POST',
        body: data,
      })
      set((state) => ({
        rolls: [...state.rolls, roll],
        pendingRolls: roll.status === 'pending'
          ? [...state.pendingRolls, roll]
          : state.pendingRolls,
        loadingRolls: false,
      }))
      return roll
    } catch (error) {
      set({ error: (error as Error).message, loadingRolls: false })
      throw error
    }
  },

  getRoll: async (rollId: string) => {
    set({ loadingRolls: true, error: null })
    try {
      const roll = await api<Roll>(`/api/v1/rolls/${rollId}`)
      set({ loadingRolls: false })
      return roll
    } catch (error) {
      set({ error: (error as Error).message, loadingRolls: false })
      throw error
    }
  },

  getRollsByPost: async (postId: string) => {
    set({ loadingRolls: true, error: null })
    try {
      const response = await api<{ rolls: Roll[] }>(`/api/v1/posts/${postId}/rolls`)
      const rolls = response.rolls ?? []
      set((state) => ({
        rolls: [...state.rolls.filter(r => r.postId !== postId), ...rolls],
        loadingRolls: false,
      }))
      return rolls
    } catch (error) {
      set({ error: (error as Error).message, loadingRolls: false })
      throw error
    }
  },

  getPendingRollsForCharacter: async (characterId: string) => {
    set({ loadingPendingRolls: true, error: null })
    try {
      const response = await api<{ rolls: Roll[] }>(`/api/v1/characters/${characterId}/rolls/pending`)
      set({ pendingRolls: response.rolls ?? [], loadingPendingRolls: false })
    } catch (error) {
      set({ error: (error as Error).message, loadingPendingRolls: false })
      throw error
    }
  },

  getUnresolvedRollsInCampaign: async (campaignId: string) => {
    set({ loadingUnresolvedRolls: true, error: null })
    try {
      const response = await api<{ rolls: UnresolvedRoll[] }>(`/api/v1/campaigns/${campaignId}/rolls/unresolved`)
      set({ unresolvedRolls: response.rolls ?? [], loadingUnresolvedRolls: false })
    } catch (error) {
      set({ error: (error as Error).message, loadingUnresolvedRolls: false })
      throw error
    }
  },

  getRollsInScene: async (sceneId: string) => {
    set({ loadingRolls: true, error: null })
    try {
      const response = await api<{ rolls: Roll[] }>(`/api/v1/scenes/${sceneId}/rolls`)
      set({ rolls: response.rolls ?? [], loadingRolls: false })
    } catch (error) {
      set({ error: (error as Error).message, loadingRolls: false })
      throw error
    }
  },

  overrideIntention: async (rollId: string, data: OverrideIntentionRequest) => {
    set({ loadingRolls: true, error: null })
    try {
      const roll = await api<Roll>(`/api/v1/rolls/${rollId}/override-intention`, {
        method: 'POST',
        body: data,
      })
      set((state) => ({
        rolls: state.rolls.map(r => r.id === rollId ? roll : r),
        unresolvedRolls: state.unresolvedRolls.map(r =>
          r.id === rollId ? { ...roll, sceneTitle: r.sceneTitle, characterName: r.characterName } as UnresolvedRoll : r
        ),
        loadingRolls: false,
      }))
      return roll
    } catch (error) {
      set({ error: (error as Error).message, loadingRolls: false })
      throw error
    }
  },

  manuallyResolve: async (rollId: string, data: ManualResolveRequest) => {
    set({ loadingRolls: true, error: null })
    try {
      const roll = await api<Roll>(`/api/v1/rolls/${rollId}/resolve`, {
        method: 'POST',
        body: data,
      })
      set((state) => ({
        rolls: state.rolls.map(r => r.id === rollId ? roll : r),
        unresolvedRolls: state.unresolvedRolls.filter(r => r.id !== rollId),
        pendingRolls: state.pendingRolls.filter(r => r.id !== rollId),
        loadingRolls: false,
      }))
      return roll
    } catch (error) {
      set({ error: (error as Error).message, loadingRolls: false })
      throw error
    }
  },

  invalidateRoll: async (rollId: string) => {
    set({ loadingRolls: true, error: null })
    try {
      const roll = await api<Roll>(`/api/v1/rolls/${rollId}/invalidate`, {
        method: 'POST',
      })
      set((state) => ({
        rolls: state.rolls.map(r => r.id === rollId ? roll : r),
        unresolvedRolls: state.unresolvedRolls.filter(r => r.id !== rollId),
        pendingRolls: state.pendingRolls.filter(r => r.id !== rollId),
        loadingRolls: false,
      }))
      return roll
    } catch (error) {
      set({ error: (error as Error).message, loadingRolls: false })
      throw error
    }
  },

  fetchDicePresets: async () => {
    set({ loadingPresets: true, error: null })
    try {
      const response = await api<{ presets: DicePreset[] }>('/api/v1/dice/presets')
      set({ dicePresets: response.presets ?? [], loadingPresets: false })
    } catch (error) {
      set({ error: (error as Error).message, loadingPresets: false })
      throw error
    }
  },

  fetchValidDiceTypes: async () => {
    set({ loadingPresets: true, error: null })
    try {
      const response = await api<{ diceTypes: string[] }>('/api/v1/dice/types')
      set({ validDiceTypes: response.diceTypes ?? [], loadingPresets: false })
    } catch (error) {
      set({ error: (error as Error).message, loadingPresets: false })
      throw error
    }
  },

  clearError: () => set({ error: null }),
  clearRolls: () => set({ rolls: [], pendingRolls: [], unresolvedRolls: [] }),
}))

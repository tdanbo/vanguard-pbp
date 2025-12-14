import { create } from 'zustand'
import { api } from '@/lib/api'
import type {
  Campaign,
  CampaignMember,
  InviteLink,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  Character,
  CreateCharacterRequest,
  UpdateCharacterRequest,
  Scene,
  CreateSceneRequest,
  UpdateSceneRequest,
  CreateSceneResponse,
  ListScenesResponse,
} from '@/types'

interface CampaignState {
  campaigns: Campaign[]
  currentCampaign: Campaign | null
  members: CampaignMember[]
  invites: InviteLink[]
  characters: Character[]
  scenes: Scene[]
  sceneWarning: string | null

  // Granular loading states to prevent race conditions
  loadingCampaigns: boolean
  loadingCampaign: boolean
  loadingMembers: boolean
  loadingInvites: boolean
  loadingCharacters: boolean
  loadingScenes: boolean

  error: string | null

  // Campaign CRUD
  fetchCampaigns: () => Promise<void>
  fetchCampaign: (id: string) => Promise<void>
  createCampaign: (data: CreateCampaignRequest) => Promise<Campaign>
  updateCampaign: (id: string, data: UpdateCampaignRequest) => Promise<void>
  deleteCampaign: (id: string, confirmTitle: string) => Promise<void>
  pauseCampaign: (id: string) => Promise<void>
  resumeCampaign: (id: string) => Promise<void>

  // Members
  fetchMembers: (campaignId: string) => Promise<void>
  leaveCampaign: (campaignId: string) => Promise<void>
  removeMember: (campaignId: string, memberId: string) => Promise<void>
  transferGm: (campaignId: string, newGmUserId: string) => Promise<void>
  claimGm: (campaignId: string) => Promise<void>

  // Invites
  fetchInvites: (campaignId: string) => Promise<void>
  createInvite: (campaignId: string) => Promise<InviteLink>
  revokeInvite: (campaignId: string, inviteId: string) => Promise<void>
  joinCampaign: (code: string) => Promise<Campaign>
  validateInvite: (code: string) => Promise<{ campaignId: string; campaignTitle: string }>

  // Characters
  fetchCharacters: (campaignId: string) => Promise<void>
  createCharacter: (campaignId: string, data: CreateCharacterRequest) => Promise<Character>
  updateCharacter: (campaignId: string, characterId: string, data: UpdateCharacterRequest) => Promise<void>
  archiveCharacter: (campaignId: string, characterId: string) => Promise<void>
  unarchiveCharacter: (campaignId: string, characterId: string) => Promise<void>
  assignCharacter: (campaignId: string, characterId: string, userId: string) => Promise<void>
  unassignCharacter: (campaignId: string, characterId: string) => Promise<void>

  // Scenes
  fetchScenes: (campaignId: string) => Promise<void>
  createScene: (campaignId: string, data: CreateSceneRequest) => Promise<CreateSceneResponse>
  updateScene: (campaignId: string, sceneId: string, data: UpdateSceneRequest) => Promise<void>
  archiveScene: (campaignId: string, sceneId: string) => Promise<void>
  unarchiveScene: (campaignId: string, sceneId: string) => Promise<void>
  addCharacterToScene: (campaignId: string, sceneId: string, characterId: string) => Promise<void>
  removeCharacterFromScene: (campaignId: string, sceneId: string, characterId: string) => Promise<void>

  // Utils
  clearError: () => void
  setCurrentCampaign: (campaign: Campaign | null) => void
}

export const useCampaignStore = create<CampaignState>((set, get) => ({
  campaigns: [],
  currentCampaign: null,
  members: [],
  invites: [],
  characters: [],
  scenes: [],
  sceneWarning: null,
  loadingCampaigns: false,
  loadingCampaign: false,
  loadingMembers: false,
  loadingInvites: false,
  loadingCharacters: false,
  loadingScenes: false,
  error: null,

  fetchCampaigns: async () => {
    set({ loadingCampaigns: true, error: null })
    try {
      const response = await api<{ campaigns: Campaign[] }>('/api/v1/campaigns')
      // Ensure campaigns is always an array, never null
      set({ campaigns: response.campaigns ?? [], loadingCampaigns: false })
    } catch (error) {
      set({ error: (error as Error).message, loadingCampaigns: false })
      throw error
    }
  },

  fetchCampaign: async (id: string) => {
    set({ loadingCampaign: true, error: null })
    try {
      const campaign = await api<Campaign>(`/api/v1/campaigns/${id}`)
      set({ currentCampaign: campaign, loadingCampaign: false })
    } catch (error) {
      set({ error: (error as Error).message, loadingCampaign: false })
      throw error
    }
  },

  createCampaign: async (data: CreateCampaignRequest) => {
    set({ loadingCampaigns: true, error: null })
    try {
      const campaign = await api<Campaign>('/api/v1/campaigns', {
        method: 'POST',
        body: data,
      })
      set((state) => ({
        campaigns: [campaign, ...state.campaigns],
        loadingCampaigns: false,
      }))
      return campaign
    } catch (error) {
      set({ error: (error as Error).message, loadingCampaigns: false })
      throw error
    }
  },

  updateCampaign: async (id: string, data: UpdateCampaignRequest) => {
    set({ loadingCampaign: true, error: null })
    try {
      const campaign = await api<Campaign>(`/api/v1/campaigns/${id}`, {
        method: 'PATCH',
        body: data,
      })
      set((state) => ({
        campaigns: state.campaigns.map((c) => (c.id === id ? campaign : c)),
        currentCampaign: state.currentCampaign?.id === id ? campaign : state.currentCampaign,
        loadingCampaign: false,
      }))
    } catch (error) {
      set({ error: (error as Error).message, loadingCampaign: false })
      throw error
    }
  },

  deleteCampaign: async (id: string, confirmTitle: string) => {
    set({ loadingCampaign: true, error: null })
    try {
      await api(`/api/v1/campaigns/${id}`, {
        method: 'DELETE',
        body: { confirmTitle },
      })
      set((state) => ({
        campaigns: state.campaigns.filter((c) => c.id !== id),
        currentCampaign: state.currentCampaign?.id === id ? null : state.currentCampaign,
        loadingCampaign: false,
      }))
    } catch (error) {
      set({ error: (error as Error).message, loadingCampaign: false })
      throw error
    }
  },

  pauseCampaign: async (id: string) => {
    set({ loadingCampaign: true, error: null })
    try {
      const campaign = await api<Campaign>(`/api/v1/campaigns/${id}/pause`, {
        method: 'POST',
      })
      set((state) => ({
        campaigns: state.campaigns.map((c) => (c.id === id ? campaign : c)),
        currentCampaign: state.currentCampaign?.id === id ? campaign : state.currentCampaign,
        loadingCampaign: false,
      }))
    } catch (error) {
      set({ error: (error as Error).message, loadingCampaign: false })
      throw error
    }
  },

  resumeCampaign: async (id: string) => {
    set({ loadingCampaign: true, error: null })
    try {
      const campaign = await api<Campaign>(`/api/v1/campaigns/${id}/resume`, {
        method: 'POST',
      })
      set((state) => ({
        campaigns: state.campaigns.map((c) => (c.id === id ? campaign : c)),
        currentCampaign: state.currentCampaign?.id === id ? campaign : state.currentCampaign,
        loadingCampaign: false,
      }))
    } catch (error) {
      set({ error: (error as Error).message, loadingCampaign: false })
      throw error
    }
  },

  fetchMembers: async (campaignId: string) => {
    set({ loadingMembers: true, error: null })
    try {
      const response = await api<{ members: CampaignMember[] }>(`/api/v1/campaigns/${campaignId}/members`)
      set({ members: response.members ?? [], loadingMembers: false })
    } catch (error) {
      set({ error: (error as Error).message, loadingMembers: false })
      throw error
    }
  },

  leaveCampaign: async (campaignId: string) => {
    set({ loadingMembers: true, error: null })
    try {
      await api(`/api/v1/campaigns/${campaignId}/leave`, { method: 'POST' })
      set((state) => ({
        campaigns: state.campaigns.filter((c) => c.id !== campaignId),
        loadingMembers: false,
      }))
    } catch (error) {
      set({ error: (error as Error).message, loadingMembers: false })
      throw error
    }
  },

  removeMember: async (campaignId: string, memberId: string) => {
    set({ loadingMembers: true, error: null })
    try {
      await api(`/api/v1/campaigns/${campaignId}/members/${memberId}`, { method: 'DELETE' })
      set((state) => ({
        members: state.members.filter((m) => m.user_id !== memberId),
        loadingMembers: false,
      }))
    } catch (error) {
      set({ error: (error as Error).message, loadingMembers: false })
      throw error
    }
  },

  transferGm: async (campaignId: string, newGmUserId: string) => {
    set({ loadingMembers: true, error: null })
    try {
      await api(`/api/v1/campaigns/${campaignId}/transfer-gm`, {
        method: 'POST',
        body: { newGmUserId },
      })
      // Refresh campaign and members after transfer
      await get().fetchCampaign(campaignId)
      await get().fetchMembers(campaignId)
      set({ loadingMembers: false })
    } catch (error) {
      set({ error: (error as Error).message, loadingMembers: false })
      throw error
    }
  },

  claimGm: async (campaignId: string) => {
    set({ loadingMembers: true, error: null })
    try {
      await api(`/api/v1/campaigns/${campaignId}/claim-gm`, { method: 'POST' })
      await get().fetchCampaign(campaignId)
      await get().fetchMembers(campaignId)
      set({ loadingMembers: false })
    } catch (error) {
      set({ error: (error as Error).message, loadingMembers: false })
      throw error
    }
  },

  fetchInvites: async (campaignId: string) => {
    set({ loadingInvites: true, error: null })
    try {
      const response = await api<{ invites: InviteLink[] }>(`/api/v1/campaigns/${campaignId}/invites`)
      set({ invites: response.invites ?? [], loadingInvites: false })
    } catch (error) {
      set({ error: (error as Error).message, loadingInvites: false })
      throw error
    }
  },

  createInvite: async (campaignId: string) => {
    set({ loadingInvites: true, error: null })
    try {
      const invite = await api<InviteLink>(`/api/v1/campaigns/${campaignId}/invites`, {
        method: 'POST',
      })
      set((state) => ({
        invites: [invite, ...state.invites],
        loadingInvites: false,
      }))
      return invite
    } catch (error) {
      set({ error: (error as Error).message, loadingInvites: false })
      throw error
    }
  },

  revokeInvite: async (campaignId: string, inviteId: string) => {
    set({ loadingInvites: true, error: null })
    try {
      await api(`/api/v1/campaigns/${campaignId}/invites/${inviteId}`, { method: 'DELETE' })
      set((state) => ({
        invites: state.invites.map((i) =>
          i.id === inviteId ? { ...i, revoked_at: new Date().toISOString() } : i
        ),
        loadingInvites: false,
      }))
    } catch (error) {
      set({ error: (error as Error).message, loadingInvites: false })
      throw error
    }
  },

  joinCampaign: async (code: string) => {
    set({ loadingCampaigns: true, error: null })
    try {
      const campaign = await api<Campaign>('/api/v1/campaigns/join', {
        method: 'POST',
        body: { code },
      })
      set((state) => ({
        campaigns: [campaign, ...state.campaigns],
        loadingCampaigns: false,
      }))
      return campaign
    } catch (error) {
      set({ error: (error as Error).message, loadingCampaigns: false })
      throw error
    }
  },

  validateInvite: async (code: string) => {
    set({ loadingInvites: true, error: null })
    try {
      const result = await api<{ campaignId: string; campaignTitle: string }>(`/api/v1/invites/${code}`)
      set({ loadingInvites: false })
      return result
    } catch (error) {
      set({ error: (error as Error).message, loadingInvites: false })
      throw error
    }
  },

  // Characters
  fetchCharacters: async (campaignId: string) => {
    set({ loadingCharacters: true, error: null })
    try {
      const response = await api<{ characters: Character[] }>(`/api/v1/campaigns/${campaignId}/characters`)
      set({ characters: response.characters ?? [], loadingCharacters: false })
    } catch (error) {
      set({ error: (error as Error).message, loadingCharacters: false })
      throw error
    }
  },

  createCharacter: async (campaignId: string, data: CreateCharacterRequest) => {
    set({ loadingCharacters: true, error: null })
    try {
      const character = await api<Character>(`/api/v1/campaigns/${campaignId}/characters`, {
        method: 'POST',
        body: data,
      })
      set((state) => ({
        characters: [...state.characters, character],
        loadingCharacters: false,
      }))
      return character
    } catch (error) {
      set({ error: (error as Error).message, loadingCharacters: false })
      throw error
    }
  },

  updateCharacter: async (campaignId: string, characterId: string, data: UpdateCharacterRequest) => {
    set({ loadingCharacters: true, error: null })
    try {
      const character = await api<Character>(`/api/v1/campaigns/${campaignId}/characters/${characterId}`, {
        method: 'PATCH',
        body: data,
      })
      set((state) => ({
        characters: state.characters.map((c) => (c.id === characterId ? { ...c, ...character } : c)),
        loadingCharacters: false,
      }))
    } catch (error) {
      set({ error: (error as Error).message, loadingCharacters: false })
      throw error
    }
  },

  archiveCharacter: async (campaignId: string, characterId: string) => {
    set({ loadingCharacters: true, error: null })
    try {
      const character = await api<Character>(`/api/v1/campaigns/${campaignId}/characters/${characterId}/archive`, {
        method: 'POST',
      })
      set((state) => ({
        characters: state.characters.map((c) => (c.id === characterId ? { ...c, ...character } : c)),
        loadingCharacters: false,
      }))
    } catch (error) {
      set({ error: (error as Error).message, loadingCharacters: false })
      throw error
    }
  },

  unarchiveCharacter: async (campaignId: string, characterId: string) => {
    set({ loadingCharacters: true, error: null })
    try {
      const character = await api<Character>(`/api/v1/campaigns/${campaignId}/characters/${characterId}/unarchive`, {
        method: 'POST',
      })
      set((state) => ({
        characters: state.characters.map((c) => (c.id === characterId ? { ...c, ...character } : c)),
        loadingCharacters: false,
      }))
    } catch (error) {
      set({ error: (error as Error).message, loadingCharacters: false })
      throw error
    }
  },

  assignCharacter: async (campaignId: string, characterId: string, userId: string) => {
    set({ loadingCharacters: true, error: null })
    try {
      await api(`/api/v1/campaigns/${campaignId}/characters/${characterId}/assign`, {
        method: 'POST',
        body: { userId },
      })
      set((state) => ({
        characters: state.characters.map((c) =>
          c.id === characterId ? { ...c, assigned_user_id: userId, assigned_at: new Date().toISOString() } : c
        ),
        loadingCharacters: false,
      }))
    } catch (error) {
      set({ error: (error as Error).message, loadingCharacters: false })
      throw error
    }
  },

  unassignCharacter: async (campaignId: string, characterId: string) => {
    set({ loadingCharacters: true, error: null })
    try {
      await api(`/api/v1/campaigns/${campaignId}/characters/${characterId}/assign`, {
        method: 'DELETE',
      })
      set((state) => ({
        characters: state.characters.map((c) =>
          c.id === characterId ? { ...c, assigned_user_id: null, assigned_at: null } : c
        ),
        loadingCharacters: false,
      }))
    } catch (error) {
      set({ error: (error as Error).message, loadingCharacters: false })
      throw error
    }
  },

  // Scenes
  fetchScenes: async (campaignId: string) => {
    set({ loadingScenes: true, error: null })
    try {
      const response = await api<ListScenesResponse>(`/api/v1/campaigns/${campaignId}/scenes`)
      set({ scenes: response.scenes ?? [], sceneWarning: response.warning || null, loadingScenes: false })
    } catch (error) {
      set({ error: (error as Error).message, loadingScenes: false })
      throw error
    }
  },

  createScene: async (campaignId: string, data: CreateSceneRequest) => {
    set({ loadingScenes: true, error: null })
    try {
      const response = await api<CreateSceneResponse>(`/api/v1/campaigns/${campaignId}/scenes`, {
        method: 'POST',
        body: data,
      })
      set((state) => ({
        scenes: [...state.scenes, response.scene],
        sceneWarning: response.warning || null,
        loadingScenes: false,
      }))
      return response
    } catch (error) {
      set({ error: (error as Error).message, loadingScenes: false })
      throw error
    }
  },

  updateScene: async (campaignId: string, sceneId: string, data: UpdateSceneRequest) => {
    set({ loadingScenes: true, error: null })
    try {
      const scene = await api<Scene>(`/api/v1/campaigns/${campaignId}/scenes/${sceneId}`, {
        method: 'PATCH',
        body: data,
      })
      set((state) => ({
        scenes: state.scenes.map((s) => (s.id === sceneId ? scene : s)),
        loadingScenes: false,
      }))
    } catch (error) {
      set({ error: (error as Error).message, loadingScenes: false })
      throw error
    }
  },

  archiveScene: async (campaignId: string, sceneId: string) => {
    set({ loadingScenes: true, error: null })
    try {
      const scene = await api<Scene>(`/api/v1/campaigns/${campaignId}/scenes/${sceneId}/archive`, {
        method: 'POST',
      })
      set((state) => ({
        scenes: state.scenes.map((s) => (s.id === sceneId ? scene : s)),
        loadingScenes: false,
      }))
    } catch (error) {
      set({ error: (error as Error).message, loadingScenes: false })
      throw error
    }
  },

  unarchiveScene: async (campaignId: string, sceneId: string) => {
    set({ loadingScenes: true, error: null })
    try {
      const scene = await api<Scene>(`/api/v1/campaigns/${campaignId}/scenes/${sceneId}/unarchive`, {
        method: 'POST',
      })
      set((state) => ({
        scenes: state.scenes.map((s) => (s.id === sceneId ? scene : s)),
        loadingScenes: false,
      }))
    } catch (error) {
      set({ error: (error as Error).message, loadingScenes: false })
      throw error
    }
  },

  addCharacterToScene: async (campaignId: string, sceneId: string, characterId: string) => {
    set({ loadingScenes: true, error: null })
    try {
      const scene = await api<Scene>(`/api/v1/campaigns/${campaignId}/scenes/${sceneId}/characters`, {
        method: 'POST',
        body: { characterId },
      })
      // Update scenes - the character might have been removed from another scene
      set((state) => ({
        scenes: state.scenes.map((s) => {
          if (s.id === sceneId) {
            return scene
          }
          // Remove character from other scenes
          if (s.character_ids.includes(characterId)) {
            return { ...s, character_ids: s.character_ids.filter((id) => id !== characterId) }
          }
          return s
        }),
        loadingScenes: false,
      }))
    } catch (error) {
      set({ error: (error as Error).message, loadingScenes: false })
      throw error
    }
  },

  removeCharacterFromScene: async (campaignId: string, sceneId: string, characterId: string) => {
    set({ loadingScenes: true, error: null })
    try {
      const scene = await api<Scene>(`/api/v1/campaigns/${campaignId}/scenes/${sceneId}/characters/${characterId}`, {
        method: 'DELETE',
      })
      set((state) => ({
        scenes: state.scenes.map((s) => (s.id === sceneId ? scene : s)),
        loadingScenes: false,
      }))
    } catch (error) {
      set({ error: (error as Error).message, loadingScenes: false })
      throw error
    }
  },

  clearError: () => set({ error: null }),
  setCurrentCampaign: (campaign) => set({ currentCampaign: campaign }),
}))

// Re-export database types
export type { Database, Json } from './database.types'

// Application-specific types
export interface CampaignSettings {
  timeGatePreset: '24h' | '2d' | '3d' | '4d' | '5d'
  fogOfWar: boolean
  hiddenPosts: boolean
  oocVisibility: 'all' | 'gm_only'
  characterLimit: 1000 | 3000 | 6000 | 10000
  rollRequestTimeoutHours?: number
  systemPreset: SystemPreset
}

export interface SystemPreset {
  name: string
  diceType: string
  intentions: string[]
}

export interface PostBlock {
  type: 'action' | 'dialog'
  content: string
  order: number
}

// Campaign types
export type CampaignPhase = 'pc_phase' | 'gm_phase'
export type MemberRole = 'gm' | 'player'

export interface Campaign {
  id: string
  title: string
  description: string | null
  owner_id: string | null
  settings: CampaignSettings
  current_phase: CampaignPhase
  current_phase_started_at: string | null
  current_phase_expires_at: string | null
  is_paused: boolean
  last_gm_activity_at: string
  storage_used_bytes: number
  scene_count: number
  created_at: string
  updated_at: string
  user_role?: MemberRole
}

export interface CampaignMember {
  id: string
  campaign_id: string
  user_id: string
  role: MemberRole
  joined_at: string
}

export interface InviteLink {
  id: string
  campaign_id: string
  code: string
  created_by: string
  expires_at: string
  used_at: string | null
  used_by: string | null
  revoked_at: string | null
  created_at: string
}

export interface CreateCampaignRequest {
  title: string
  description?: string
  settings?: Partial<CampaignSettings>
}

export interface UpdateCampaignRequest {
  title?: string
  description?: string
  settings?: Partial<CampaignSettings>
}

// Character types
export type CharacterType = 'pc' | 'npc'

export interface Character {
  id: string
  campaign_id: string
  display_name: string
  description: string | null
  avatar_url: string | null
  character_type: CharacterType
  is_archived: boolean
  created_at: string
  updated_at: string
  assigned_user_id?: string | null
  assigned_at?: string | null
}

export interface CreateCharacterRequest {
  displayName: string
  description?: string
  characterType: CharacterType
  assignToUser?: string
}

export interface UpdateCharacterRequest {
  displayName?: string
  description?: string
  characterType?: CharacterType
}

// Scene types
export type PassState = 'none' | 'passed' | 'hard_passed'

export interface Scene {
  id: string
  campaign_id: string
  title: string
  description: string | null
  header_image_url: string | null
  character_ids: string[]
  pass_states: Record<string, PassState>
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface CreateSceneRequest {
  title: string
  description?: string
}

export interface UpdateSceneRequest {
  title?: string
  description?: string
}

export interface CreateSceneResponse {
  scene: Scene
  warning?: string
  deletedSceneId?: string
}

export interface ListScenesResponse {
  scenes: Scene[]
  count: number
  warning?: string
}

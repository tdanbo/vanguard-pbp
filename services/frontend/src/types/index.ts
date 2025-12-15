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

// Post types
export interface Post {
  id: string
  sceneId: string
  characterId: string
  userId: string
  blocks: PostBlock[]
  oocText: string | null
  intention: string | null
  modifier: number | null
  witnesses: string[]
  isHidden: boolean
  isDraft: boolean
  isLocked: boolean
  createdAt: string
  updatedAt: string
  characterName: string
  characterAvatar: string | null
  characterType: CharacterType
}

export interface CreatePostRequest {
  sceneId: string
  characterId: string | null  // null for Narrator posts (GM only)
  blocks: PostBlock[]
  oocText?: string
  intention?: string
  modifier?: number
  isHidden?: boolean
}

export interface UpdatePostRequest {
  blocks?: PostBlock[]
  oocText?: string
  intention?: string
  modifier?: number
}

export interface ListPostsResponse {
  posts: Post[]
}

// Compose lock types
export interface ComposeLock {
  lockId: string
  expiresAt: string
  remainingSeconds: number
}

export interface AcquireLockRequest {
  sceneId: string
  characterId: string
  isHidden?: boolean
}

export interface HeartbeatRequest {
  lockId: string
}

export interface HeartbeatResponse {
  acknowledged: boolean
  expiresAt: string
  remainingSeconds: number
}

export interface SceneLocksResponse {
  locks: Array<{ isLocked: boolean } | ComposeLockInfo>
  isLocked: boolean
}

export interface ComposeLockInfo {
  id: string
  sceneId: string
  characterId: string
  userId: string
  expiresAt: string
  characterName?: string
}

// Draft types
export interface Draft {
  id: string
  sceneId: string
  characterId: string
  userId: string
  blocks: PostBlock[]
  oocText: string | null
  intention: string | null
  modifier: number | null
  isHidden: boolean
  sceneTitle?: string
  characterName?: string
  updatedAt: string
}

export interface SaveDraftRequest {
  sceneId: string
  characterId: string
  blocks: PostBlock[]
  oocText?: string
  intention?: string
  modifier?: number
  isHidden?: boolean
}

export interface ListDraftsResponse {
  drafts: Draft[]
}

// Phase management types
export interface PhaseStatus {
  currentPhase: CampaignPhase
  startedAt: string | null
  expiresAt: string | null
  isPaused: boolean
  timeGatePreset: string | null
  passedCount: number
  totalCount: number
  allPassed: boolean
  canTransition: boolean
  transitionBlock: string | null
}

export interface TransitionPhaseRequest {
  toPhase: CampaignPhase
}

// Pass management types
export interface CharacterPassInfo {
  characterId: string
  characterName: string
  passState: PassState
  sceneId: string
  sceneTitle: string
}

export interface CampaignPassSummary {
  passedCount: number
  totalCount: number
  allPassed: boolean
  characters: CharacterPassInfo[]
}

export interface SetPassRequest {
  passState: PassState
}

// Roll types
export type RollStatus = 'pending' | 'completed' | 'invalidated'

export interface Roll {
  id: string
  postId: string | null
  sceneId: string
  characterId: string
  requestedBy: string
  intention: string
  modifier: number
  diceType: string
  diceCount: number
  status: RollStatus
  result: number[] | null
  total: number | null
  rolledAt: string | null
  createdAt: string
  // Override fields
  wasOverridden: boolean
  originalIntention: string | null
  overriddenBy: string | null
  overrideReason: string | null
  overrideTimestamp: string | null
  // Manual resolution fields
  manualResult: number | null
  manuallyResolvedBy: string | null
  manualResolutionReason: string | null
  // Additional display fields
  characterName?: string
  sceneTitle?: string
}

export interface CreateRollRequest {
  postId?: string
  sceneId: string
  characterId: string
  intention: string
  modifier?: number
  diceType?: string
  diceCount?: number
}

export interface OverrideIntentionRequest {
  newIntention: string
  reason: string
}

export interface ManualResolveRequest {
  result: number
  reason: string
}

export interface UnresolvedRoll extends Roll {
  sceneTitle: string
  characterName: string
  postContent?: string
}

export interface DicePreset {
  name: string
  intentions: string[]
  diceType: string
}

// Notification types
export type NotificationType =
  | 'pc_phase_started'
  | 'new_post_in_scene'
  | 'roll_requested'
  | 'intention_overridden'
  | 'character_added_to_scene'
  | 'compose_lock_released'
  | 'time_gate_warning_24h'
  | 'time_gate_warning_6h'
  | 'time_gate_warning_1h'
  | 'pass_state_cleared'
  | 'gm_role_available'
  | 'all_characters_passed'
  | 'time_gate_expired'
  | 'hidden_post_submitted'
  | 'player_joined'
  | 'player_roll_submitted'
  | 'unresolved_rolls_exist'
  | 'campaign_at_player_limit'
  | 'scene_limit_warning'

export interface Notification {
  id: string
  user_id: string
  title: string
  body: string
  type: NotificationType
  campaign_id: string | null
  scene_id: string | null
  post_id: string | null
  character_id: string | null
  is_read: boolean
  read_at: string | null
  is_urgent: boolean
  link: string | null
  expires_at: string | null
  created_at: string
  metadata: Record<string, unknown> | null
}

export type EmailFrequency = 'realtime' | 'digest_daily' | 'digest_weekly' | 'off'

export interface NotificationPreferences {
  id: string
  user_id: string
  email_enabled: boolean
  email_frequency: EmailFrequency
  in_app_enabled: boolean
  created_at: string
  updated_at: string
}

export interface QuietHours {
  id: string
  user_id: string
  enabled: boolean
  start_time: string
  end_time: string
  timezone: string
  urgent_bypass: boolean
  created_at: string
  updated_at: string
}

export interface UpdateNotificationPreferencesRequest {
  email_enabled: boolean
  email_frequency: EmailFrequency
  in_app_enabled: boolean
}

export interface UpdateQuietHoursRequest {
  enabled: boolean
  start_time: string
  end_time: string
  timezone: string
  urgent_bypass: boolean
}

// Real-time event types
export type RealtimeEventType =
  | 'phase_transition'
  | 'post_created'
  | 'post_updated'
  | 'post_deleted'
  | 'compose_lock_acquired'
  | 'compose_lock_released'
  | 'pass_state_changed'
  | 'character_joined'
  | 'character_left'
  | 'roll_created'
  | 'roll_resolved'
  | 'timegate_warning'

export interface PhaseTransitionEvent {
  type: 'phase_transition'
  campaign_id: string
  from_phase: CampaignPhase
  to_phase: CampaignPhase
  transition_reason: string
  timestamp: string
}

export interface PostEvent {
  type: 'post_created' | 'post_updated' | 'post_deleted'
  post_id: string
  scene_id: string
  campaign_id: string
  character_id?: string
  is_hidden: boolean
  witness_list: string[]
  timestamp: string
}

export interface ComposeLockEvent {
  type: 'compose_lock_acquired' | 'compose_lock_released'
  scene_id: string
  campaign_id: string
  is_locked: boolean
  timestamp: string
}

export interface PassStateEvent {
  type: 'pass_state_changed'
  campaign_id: string
  scene_id: string
  character_id: string
  has_passed: boolean
  timestamp: string
}

export interface CharacterPresenceEvent {
  type: 'character_joined' | 'character_left'
  scene_id: string
  campaign_id: string
  character_id: string
  timestamp: string
}

export interface RollEvent {
  type: 'roll_created' | 'roll_resolved'
  roll_id: string
  post_id?: string
  scene_id: string
  campaign_id: string
  character_id: string
  intention: string
  status: string
  timestamp: string
}

export interface TimeGateWarningEvent {
  type: 'timegate_warning'
  campaign_id: string
  remaining_minutes: number
  timestamp: string
}

export type RealtimeEvent =
  | PhaseTransitionEvent
  | PostEvent
  | ComposeLockEvent
  | PassStateEvent
  | CharacterPresenceEvent
  | RollEvent
  | TimeGateWarningEvent

import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ThreeColumnSceneLayout } from '@/components/layout/ThreeColumnSceneLayout'
import { SceneHeader, SceneHeaderCompact } from '@/components/scene/SceneHeader'
import { PhaseBar } from '@/components/phase/PhaseBar'
import { SceneMenu } from '@/components/scene/SceneMenu'
import { CharacterAssignmentWidget } from '@/components/scene/CharacterAssignmentWidget'
import { SceneRoster, type SceneRosterCharacter } from '@/components/scene/SceneRoster'
import { NPCSidebar, type NPCSidebarCharacter } from '@/components/scene/NPCSidebar'
import { PartySidebar, type PartySidebarCharacter } from '@/components/scene/PartySidebar'
import { CreateCharacterDialog } from '@/components/character/CreateCharacterDialog'
import { PostStream } from '@/components/posts/PostStream'
import { ImmersiveComposer } from '@/components/posts/ImmersiveComposer'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { useCampaignStore } from '@/stores/campaignStore'
import { useAuthStore } from '@/stores/authStore'
import { useRollStore } from '@/stores/rollStore'
import { useToast } from '@/hooks/use-toast'
import type { PassState, CampaignPhase, CampaignSettings, Post } from '@/types'

export default function SceneView() {
  const { id: campaignId, sceneId } = useParams<{
    id: string
    sceneId: string
  }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuthStore()

  const {
    currentCampaign,
    scenes,
    characters,
    posts,
    scenePassStates,
    phaseStatus,
    loadingCampaign,
    loadingScenes,
    loadingPosts,
    fetchCampaign,
    fetchScenes,
    fetchCharacters,
    fetchPosts,
    fetchScenePassStates,
    fetchPhaseStatus,
    setPass,
    clearPass,
    archiveScene,
    addCharacterToScene,
    transitionPhase,
    forceTransitionPhase,
  } = useCampaignStore()

  const { rolls, getRollsInScene } = useRollStore()

  const [isScrolled, setIsScrolled] = useState(false)
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    null
  )
  const [showRosterSheet, setShowRosterSheet] = useState(false)
  const [addCharacterDialogOpen, setAddCharacterDialogOpen] = useState(false)
  const [addCharacterSelectedId, setAddCharacterSelectedId] = useState('')
  const [createNPCDialogOpen, setCreateNPCDialogOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<Post | null>(null)

  // Character assignment widget state (for party bubble add buttons)
  const [assignmentWidgetOpen, setAssignmentWidgetOpen] = useState(false)
  const [assignmentWidgetFilter, setAssignmentWidgetFilter] = useState<'pc' | 'npc'>('npc')

  // Current scene
  const scene = useMemo(
    () => scenes.find((s) => s.id === sceneId),
    [scenes, sceneId]
  )

  // Is user GM?
  const isGM = currentCampaign?.user_role === 'gm'

  // Default campaign settings if not loaded
  const settings: CampaignSettings = currentCampaign?.settings || {
    timeGatePreset: '24h',
    fogOfWar: false,
    hiddenPosts: false,
    oocVisibility: 'all',
    characterLimit: 3000,
    systemPreset: { name: 'Custom', diceType: 'd20', intentions: [] },
  }

  // Characters in this scene
  const sceneCharacters = useMemo(() => {
    if (!scene) return []
    return characters.filter((c) => scene.character_ids.includes(c.id))
  }, [characters, scene])

  // Characters owned by current user
  const userCharacters = useMemo(() => {
    if (!user) return []
    return sceneCharacters.filter((c) => c.assigned_user_id === user.id)
  }, [sceneCharacters, user])

  // Characters available to add (not archived, not already in this scene)
  const availableCharacters = useMemo(() => {
    if (!scene) return []
    return characters.filter(
      (c) => !c.is_archived && !scene.character_ids.includes(c.id)
    )
  }, [characters, scene])

  // Compute effective selected character ID (handles initial selection)
  // GMs default to 'narrator' when they have no assigned characters
  const effectiveSelectedCharacterId = useMemo(() => {
    if (selectedCharacterId) return selectedCharacterId
    if (userCharacters.length > 0) return userCharacters[0].id
    if (isGM) return 'narrator'
    return null
  }, [userCharacters, selectedCharacterId, isGM])

  // Is Narrator mode active?
  const isNarrator = effectiveSelectedCharacterId === 'narrator'

  // Selected character for posting
  const selectedCharacter = useMemo(
    () => characters.find((c) => c.id === effectiveSelectedCharacterId) || null,
    [characters, effectiveSelectedCharacterId]
  )

  // Selected character's pass state
  const selectedCharacterPassState: PassState = useMemo(() => {
    if (!effectiveSelectedCharacterId || effectiveSelectedCharacterId === 'narrator') return 'none'
    return (scenePassStates[effectiveSelectedCharacterId] || 'none') as PassState
  }, [effectiveSelectedCharacterId, scenePassStates])

  // Load data on mount
  useEffect(() => {
    if (!campaignId || !sceneId) return

    const loadData = async () => {
      try {
        await Promise.all([
          fetchCampaign(campaignId),
          fetchScenes(campaignId),
          fetchCharacters(campaignId),
        ])
        await fetchScenePassStates(campaignId, sceneId)
        await Promise.all([
          fetchPosts(campaignId, sceneId),
          getRollsInScene(sceneId),
          fetchPhaseStatus(campaignId),
        ])
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Failed to load scene',
          description: (error as Error).message,
        })
      }
    }

    loadData()
  }, [
    campaignId,
    sceneId,
    fetchCampaign,
    fetchScenes,
    fetchCharacters,
    fetchPosts,
    fetchScenePassStates,
    fetchPhaseStatus,
    getRollsInScene,
    toast,
  ])

  // Handle scroll for compact header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 200)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Map characters to roster format (for sheet roster)
  const rosterCharacters: SceneRosterCharacter[] = useMemo(
    () =>
      sceneCharacters.map((c) => ({
        id: c.id,
        displayName: c.display_name,
        avatarUrl: c.avatar_url,
        passState: (scenePassStates[c.id] || scene?.pass_states?.[c.id] || 'none') as PassState,
        isOwnedByUser: c.assigned_user_id === user?.id,
      })),
    [sceneCharacters, scenePassStates, scene, user]
  )

  // Map characters for sidebars - split by character type
  const npcSidebarCharacters: NPCSidebarCharacter[] = useMemo(
    () =>
      sceneCharacters
        .filter((c) => c.character_type === 'npc')
        .map((c) => ({
          id: c.id,
          displayName: c.display_name,
          avatarUrl: c.avatar_url,
          passState: (scenePassStates[c.id] || scene?.pass_states?.[c.id] || 'none') as PassState,
          isOwnedByUser: c.assigned_user_id === user?.id,
        })),
    [sceneCharacters, scenePassStates, scene, user]
  )

  const partySidebarCharacters: PartySidebarCharacter[] = useMemo(
    () =>
      sceneCharacters
        .filter((c) => c.character_type === 'pc')
        .map((c) => ({
          id: c.id,
          displayName: c.display_name,
          avatarUrl: c.avatar_url,
          passState: (scenePassStates[c.id] || scene?.pass_states?.[c.id] || 'none') as PassState,
          isOwnedByUser: c.assigned_user_id === user?.id,
        })),
    [sceneCharacters, scenePassStates, scene, user]
  )

  // Handle pass state changes
  const handlePass = async (
    characterId: string,
    state: 'passed' | 'hard_passed'
  ) => {
    if (!campaignId || !sceneId) return
    try {
      await setPass(campaignId, sceneId, characterId, state)
      toast({ title: `Character ${state === 'passed' ? 'passed' : 'hard passed'}` })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to set pass',
        description: (error as Error).message,
      })
    }
  }

  const handleClearPass = async (characterId: string) => {
    if (!campaignId || !sceneId) return
    try {
      await clearPass(campaignId, sceneId, characterId)
      toast({ title: 'Pass cleared' })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to clear pass',
        description: (error as Error).message,
      })
    }
  }

  const handleArchive = async () => {
    if (!campaignId || !sceneId) return
    try {
      await archiveScene(campaignId, sceneId)
      toast({ title: 'Scene archived' })
      navigate(`/campaigns/${campaignId}`)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to archive scene',
        description: (error as Error).message,
      })
    }
  }

  const handleForceGMPhase = async () => {
    if (!campaignId) return
    try {
      await forceTransitionPhase(campaignId, 'gm_phase')
      toast({ title: 'Forced transition to GM Phase' })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to force phase transition',
        description: (error as Error).message,
      })
    }
  }

  const handleAddCharacter = async () => {
    if (!campaignId || !sceneId || !addCharacterSelectedId) return
    try {
      await addCharacterToScene(campaignId, sceneId, addCharacterSelectedId)
      toast({ title: 'Character added to scene' })
      setAddCharacterDialogOpen(false)
      setAddCharacterSelectedId('')
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to add character',
        description: (error as Error).message,
      })
    }
  }

  const handlePostCreated = () => {
    if (campaignId && sceneId) {
      fetchPosts(campaignId, sceneId)
    }
  }

  const handleRollUpdated = () => {
    if (sceneId) {
      getRollsInScene(sceneId)
    }
  }

  // Edit post handlers
  const handleEditPost = (post: Post) => {
    setEditingPost(post)
    // Set the character selection to match the post's character
    if (post.characterId) {
      setSelectedCharacterId(post.characterId)
    } else {
      // Narrator post
      setSelectedCharacterId('narrator')
    }
  }

  const handleEditComplete = () => {
    setEditingPost(null)
    if (campaignId && sceneId) {
      fetchPosts(campaignId, sceneId)
    }
  }

  const handleEditCancel = () => {
    setEditingPost(null)
  }

  const handlePostDeleted = () => {
    setEditingPost(null)
    if (campaignId && sceneId) {
      fetchPosts(campaignId, sceneId)
    }
  }

  // Handle bubble click to pass (for players)
  const handleBubblePass = async (characterId: string) => {
    if (!campaignId || !sceneId) return
    try {
      await setPass(campaignId, sceneId, characterId, 'passed')
      toast({ title: 'Turn passed' })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to pass',
        description: (error as Error).message,
      })
    }
  }

  // Handler for NPC add button (opens assignment widget filtered to NPCs)
  const handleAddNPC = () => {
    setAssignmentWidgetFilter('npc')
    setAssignmentWidgetOpen(true)
  }

  // Handler for PC add button (opens assignment widget filtered to PCs)
  const handleAddPC = () => {
    setAssignmentWidgetFilter('pc')
    setAssignmentWidgetOpen(true)
  }

  // Loading state
  if (loadingCampaign || loadingScenes || !scene) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Determine phase
  const phase: CampaignPhase | 'paused' = currentCampaign?.is_paused
    ? 'paused'
    : currentCampaign?.current_phase || 'gm_phase'

  return (
    <ThreeColumnSceneLayout
      backgroundImage={scene.header_image_url}
      onBack={() => navigate(`/campaigns/${campaignId}`)}
      backLabel="Back to campaign"
      leftSidebar={
        <NPCSidebar
          characters={npcSidebarCharacters}
          isGM={isGM}
          selectedCharacterId={effectiveSelectedCharacterId}
          onSelectCharacter={setSelectedCharacterId}
          onPass={handleBubblePass}
          onAddNPC={isGM ? handleAddNPC : undefined}
        />
      }
      rightSidebar={
        <PartySidebar
          characters={partySidebarCharacters}
          isGM={isGM}
          selectedCharacterId={effectiveSelectedCharacterId}
          onSelectCharacter={setSelectedCharacterId}
          onPass={handleBubblePass}
          onAddPC={isGM ? handleAddPC : undefined}
        />
      }
      menuContent={
        <div className="flex items-center gap-2">
          {isGM && currentCampaign?.current_phase === 'gm_phase' && !currentCampaign.is_paused && (
            <CharacterAssignmentWidget
              campaignId={campaignId!}
              sceneId={sceneId!}
              sceneCharacterIds={scene?.character_ids || []}
            />
          )}
          <SceneMenu
            isGM={isGM}
            currentPhase={currentCampaign?.current_phase}
            onForceGMPhase={handleForceGMPhase}
            onViewRoster={() => setShowRosterSheet(true)}
            onSettings={() =>
              navigate(`/campaigns/${campaignId}/scenes/${sceneId}/settings`)
            }
            onArchive={handleArchive}
          />
        </div>
      }
    >
      {/* Compact header when scrolled */}
      {isScrolled && (
        <div className="fixed top-0 left-0 right-0 lg:left-1/4 lg:right-1/4 z-40">
          <SceneHeaderCompact scene={scene} />
        </div>
      )}

      {/* Main content */}
      <div>
        <SceneHeader scene={scene} />

        <PhaseBar
          currentPhase={currentCampaign?.current_phase || 'gm_phase'}
          phaseStartedAt={currentCampaign?.current_phase_started_at || null}
          expiresAt={currentCampaign?.current_phase_expires_at || null}
          isGM={isGM}
          canTransition={phaseStatus?.canTransition ?? false}
          transitionBlock={phaseStatus?.transitionBlock}
          isPaused={currentCampaign?.is_paused}
          onTransitionPhase={(toPhase) => {
            if (!campaignId) return
            transitionPhase(campaignId, toPhase)
              .then(() => {
                toast({ title: `Transitioned to ${toPhase === 'gm_phase' ? 'GM' : 'PC'} Phase` })
              })
              .catch((error: Error) => {
                toast({
                  variant: 'destructive',
                  title: 'Failed to transition phase',
                  description: error.message,
                })
              })
          }}
        />

        <PostStream
          posts={posts}
          settings={settings}
          rolls={rolls}
          isGM={isGM}
          currentUserId={user?.id}
          isLoading={loadingPosts}
          onEditPost={handleEditPost}
          onRollUpdated={handleRollUpdated}
        />

        {/* Spacer for fixed composer */}
        <div className="h-32" />
      </div>

      {/* Quick NPC creation dialog (kept for roster sheet) */}
      {scene && (
        <CreateCharacterDialog
          open={createNPCDialogOpen}
          onOpenChange={setCreateNPCDialogOpen}
          campaignId={campaignId!}
          sceneId={sceneId!}
          sceneName={scene.title}
          forceCharacterType="npc"
        />
      )}

      {/* Character assignment widget (controlled mode for party bubble add buttons) */}
      {scene && (
        <CharacterAssignmentWidget
          campaignId={campaignId!}
          sceneId={sceneId!}
          sceneCharacterIds={scene.character_ids || []}
          open={assignmentWidgetOpen}
          onOpenChange={setAssignmentWidgetOpen}
          initialFilter={assignmentWidgetFilter}
          showFilterToggle={false}
          hideTrigger={true}
        />
      )}

      {/* Full roster sheet (accessed via menu) */}
      <Sheet open={showRosterSheet} onOpenChange={setShowRosterSheet}>
        <SheetContent side="bottom" className="h-[60vh]">
          <SceneRoster
            phase={phase}
            characters={rosterCharacters}
            isGM={isGM}
            onPass={handlePass}
            onClearPass={handleClearPass}
            onAddCharacter={() => setAddCharacterDialogOpen(true)}
          />
        </SheetContent>
      </Sheet>

      {/* Composer */}
      <ImmersiveComposer
        campaignId={campaignId!}
        sceneId={sceneId!}
        character={selectedCharacter}
        isNarrator={isNarrator}
        settings={settings}
        onPostCreated={handlePostCreated}
        editingPost={editingPost}
        onEditComplete={handleEditComplete}
        onEditCancel={handleEditCancel}
        isGM={isGM}
        onPostDeleted={handlePostDeleted}
        currentPhase={currentCampaign?.current_phase}
        selectedCharacterPassState={selectedCharacterPassState}
      />

      {/* Add Character Dialog */}
      <Dialog open={addCharacterDialogOpen} onOpenChange={setAddCharacterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Character to Scene</DialogTitle>
            <DialogDescription>
              Select a character to add. Characters can only be in one scene at a time.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {availableCharacters.length === 0 ? (
              <p className="text-center text-muted-foreground">
                All characters are already assigned to scenes.
              </p>
            ) : (
              <Select value={addCharacterSelectedId} onValueChange={setAddCharacterSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a character" />
                </SelectTrigger>
                <SelectContent>
                  {availableCharacters.map((character) => (
                    <SelectItem key={character.id} value={character.id}>
                      {character.display_name} ({character.character_type.toUpperCase()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCharacterDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCharacter} disabled={!addCharacterSelectedId}>
              Add Character
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ThreeColumnSceneLayout>
  )
}

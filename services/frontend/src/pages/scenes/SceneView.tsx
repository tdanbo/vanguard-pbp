import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ImmersiveLayout } from '@/components/layout/ImmersiveLayout'
import { SceneHeader, SceneHeaderCompact } from '@/components/scene/SceneHeader'
import { SceneMenu } from '@/components/scene/SceneMenu'
import { SceneRoster, type SceneRosterCharacter } from '@/components/scene/SceneRoster'
import { PostStream } from '@/components/posts/PostStream'
import { ImmersiveComposer } from '@/components/posts/ImmersiveComposer'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
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
import { Users, Loader2 } from 'lucide-react'
import { useCampaignStore } from '@/stores/campaignStore'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/hooks/use-toast'
import type { PassState, CampaignPhase, CampaignSettings } from '@/types'

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
    loadingCampaign,
    loadingScenes,
    loadingPosts,
    fetchCampaign,
    fetchScenes,
    fetchCharacters,
    fetchPosts,
    fetchScenePassStates,
    setPass,
    clearPass,
    archiveScene,
    addCharacterToScene,
  } = useCampaignStore()

  const [isScrolled, setIsScrolled] = useState(false)
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    null
  )
  const [showRosterSheet, setShowRosterSheet] = useState(false)
  const [addCharacterDialogOpen, setAddCharacterDialogOpen] = useState(false)
  const [addCharacterSelectedId, setAddCharacterSelectedId] = useState('')

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
        await fetchPosts(campaignId, sceneId)
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

  // Map characters to roster format
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

  // Character selector for multi-character users or GMs with Narrator option
  const showCharacterSelector = isGM || userCharacters.length > 1
  const CharacterSelector = showCharacterSelector ? (
    <div className="fixed bottom-24 left-4 z-40 lg:hidden">
      <Select
        value={effectiveSelectedCharacterId || ''}
        onValueChange={setSelectedCharacterId}
      >
        <SelectTrigger className="w-[160px] bg-panel backdrop-blur-md border-border/50">
          <SelectValue placeholder="Select character" />
        </SelectTrigger>
        <SelectContent>
          {isGM && (
            <SelectItem value="narrator">Narrator</SelectItem>
          )}
          {userCharacters.map((char) => (
            <SelectItem key={char.id} value={char.id}>
              {char.display_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ) : null

  return (
    <ImmersiveLayout
      backgroundImage={scene.header_image_url}
      onBack={() => navigate(`/campaigns/${campaignId}`)}
      backLabel="Back to campaign"
      menuContent={
        <SceneMenu
          isGM={isGM}
          onViewRoster={() => setShowRosterSheet(true)}
          onSettings={() =>
            navigate(`/campaigns/${campaignId}/scenes/${sceneId}/settings`)
          }
          onArchive={handleArchive}
        />
      }
    >
      {/* Compact header when scrolled */}
      {isScrolled && (
        <div className="fixed top-0 left-0 right-0 z-40">
          <SceneHeaderCompact scene={scene} />
        </div>
      )}

      {/* Main content with sidebar on desktop */}
      <div className="lg:pr-72">
        {/* Main column - centered with sidebar offset on desktop */}
        <div>
          <SceneHeader scene={scene} />

          <PostStream
            posts={posts}
            settings={settings}
            isGM={isGM}
            currentUserId={user?.id}
            isLoading={loadingPosts}
          />

          {/* Spacer for fixed composer */}
          <div className="h-32" />
        </div>
      </div>

      {/* Desktop sidebar - fixed on right */}
      <div className="hidden lg:block fixed top-20 right-4 w-64 z-30">
        <SceneRoster
          phase={phase}
          characters={rosterCharacters}
          isGM={isGM}
          onPass={handlePass}
          onClearPass={handleClearPass}
          onAddCharacter={() => setAddCharacterDialogOpen(true)}
        />

        {/* Desktop character selector */}
        {showCharacterSelector && (
          <div className="mt-4">
            <Select
              value={effectiveSelectedCharacterId || ''}
              onValueChange={setSelectedCharacterId}
            >
              <SelectTrigger className="bg-panel backdrop-blur-md border-border/50">
                <SelectValue placeholder="Select character" />
              </SelectTrigger>
              <SelectContent>
                {isGM && (
                  <SelectItem value="narrator">Narrator</SelectItem>
                )}
                {userCharacters.map((char) => (
                  <SelectItem key={char.id} value={char.id}>
                    {char.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Mobile roster button and sheet */}
      <div className="lg:hidden">
        <Sheet open={showRosterSheet} onOpenChange={setShowRosterSheet}>
          <SheetTrigger asChild>
            <Button
              size="icon"
              className="fixed bottom-24 right-4 z-30 rounded-full bg-panel backdrop-blur-sm border border-border/50"
            >
              <Users className="h-5 w-5" />
            </Button>
          </SheetTrigger>
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
      </div>

      {/* Character selector for mobile */}
      {CharacterSelector}

      {/* Composer */}
      <ImmersiveComposer
        campaignId={campaignId!}
        sceneId={sceneId!}
        character={selectedCharacter}
        isNarrator={isNarrator}
        settings={settings}
        onPostCreated={handlePostCreated}
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
    </ImmersiveLayout>
  )
}

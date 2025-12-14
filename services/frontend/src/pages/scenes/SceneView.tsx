import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ImmersiveLayout } from '@/components/layout/ImmersiveLayout'
import { SceneHeader, SceneHeaderCompact } from '@/components/scene/SceneHeader'
import { SceneMenu } from '@/components/scene/SceneMenu'
import { SceneRoster, type SceneRosterCharacter } from '@/components/scene/SceneRoster'
import { PostStream } from '@/components/posts/PostStream'
import { ImmersiveComposer } from '@/components/posts/ImmersiveComposer'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
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
  } = useCampaignStore()

  const [isScrolled, setIsScrolled] = useState(false)
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    null
  )
  const [showRosterSheet, setShowRosterSheet] = useState(false)

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

  // Compute effective selected character ID (handles initial selection)
  const effectiveSelectedCharacterId = useMemo(() => {
    if (selectedCharacterId) return selectedCharacterId
    if (userCharacters.length > 0) return userCharacters[0].id
    return null
  }, [userCharacters, selectedCharacterId])

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

  // Character selector for multi-character users
  const CharacterSelector =
    userCharacters.length > 1 ? (
      <div className="fixed bottom-24 right-4 z-40 md:hidden">
        <Select
          value={effectiveSelectedCharacterId || ''}
          onValueChange={setSelectedCharacterId}
        >
          <SelectTrigger className="w-[160px] bg-panel backdrop-blur-md border-border/50">
            <SelectValue placeholder="Select character" />
          </SelectTrigger>
          <SelectContent>
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
      <div className="flex">
        {/* Main column */}
        <div className="flex-1">
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

        {/* Desktop sidebar */}
        <div className="hidden lg:block w-64 shrink-0 p-4">
          <div className="sticky top-20">
            <SceneRoster
              phase={phase}
              characters={rosterCharacters}
              isGM={isGM}
              onPass={handlePass}
              onClearPass={handleClearPass}
            />

            {/* Desktop character selector */}
            {userCharacters.length > 1 && (
              <div className="mt-4">
                <Select
                  value={effectiveSelectedCharacterId || ''}
                  onValueChange={setSelectedCharacterId}
                >
                  <SelectTrigger className="bg-panel backdrop-blur-md border-border/50">
                    <SelectValue placeholder="Select character" />
                  </SelectTrigger>
                  <SelectContent>
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
        </div>
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
        settings={settings}
        onPostCreated={handlePostCreated}
      />
    </ImmersiveLayout>
  )
}

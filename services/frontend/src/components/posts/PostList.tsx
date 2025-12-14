import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { PenLine, AlertCircle, RefreshCcw } from 'lucide-react'
import { PostCard } from './PostCard'
import { PostComposer } from './PostComposer'
import { useCampaignStore } from '@/stores/campaignStore'
import { useToast } from '@/hooks/use-toast'
import type { Character, CampaignSettings, CampaignPhase } from '@/types'

interface PostListProps {
  campaignId: string
  sceneId: string
  characters: Character[]
  currentUserId: string
  isGM: boolean
  currentPhase: CampaignPhase
  settings: CampaignSettings
}

export function PostList({
  campaignId,
  sceneId,
  characters,
  currentUserId,
  isGM,
  currentPhase,
  settings,
}: PostListProps) {
  const { toast } = useToast()
  const { posts, loadingPosts, fetchPosts, clearPosts } = useCampaignStore()

  const [isComposing, setIsComposing] = useState(false)
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('')
  const [viewAsCharacterId, setViewAsCharacterId] = useState<string>('')

  // Get characters the user can post as
  const userCharacters = characters.filter(
    (c) =>
      !c.is_archived &&
      (c.assigned_user_id === currentUserId || (isGM && c.character_type === 'npc'))
  )

  // Get characters in this scene that user controls
  const sceneCharactersUserControls = userCharacters.filter((c) => {
    const scene = useCampaignStore.getState().scenes.find((s) => s.id === sceneId)
    return scene?.character_ids.includes(c.id)
  })

  // Characters user can view as (for fog of war)
  const viewableCharacters = settings.fogOfWar
    ? characters.filter(
        (c) =>
          !c.is_archived &&
          (c.assigned_user_id === currentUserId || isGM)
      )
    : []

  const loadPosts = useCallback(async () => {
    try {
      await fetchPosts(
        campaignId,
        sceneId,
        settings.fogOfWar ? viewAsCharacterId || undefined : undefined
      )
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to load posts',
        description: (error as Error).message,
      })
    }
  }, [campaignId, sceneId, settings.fogOfWar, viewAsCharacterId, fetchPosts, toast])

  useEffect(() => {
    loadPosts()
    return () => {
      clearPosts()
    }
  }, [loadPosts, clearPosts])

  // Reload when view character changes
  useEffect(() => {
    if (viewAsCharacterId) {
      loadPosts()
    }
  }, [viewAsCharacterId, loadPosts])

  const handleStartCompose = () => {
    if (sceneCharactersUserControls.length === 1) {
      setSelectedCharacterId(sceneCharactersUserControls[0].id)
      setIsComposing(true)
    } else if (sceneCharactersUserControls.length > 1) {
      // Will show character selector
      setSelectedCharacterId('')
    }
  }

  const handleSelectCharacterAndCompose = (characterId: string) => {
    setSelectedCharacterId(characterId)
    setIsComposing(true)
  }

  const canCompose =
    (currentPhase === 'pc_phase' || isGM) && sceneCharactersUserControls.length > 0

  const selectedCharacter = characters.find((c) => c.id === selectedCharacterId)

  if (loadingPosts) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Fog of War character selector */}
      {settings.fogOfWar && viewableCharacters.length > 0 && !isGM && (
        <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
          <Label className="whitespace-nowrap">View as:</Label>
          <Select value={viewAsCharacterId} onValueChange={setViewAsCharacterId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All visible posts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All visible posts</SelectItem>
              {viewableCharacters.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={loadPosts}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Compose button or composer */}
      {isComposing && selectedCharacter ? (
        <PostComposer
          campaignId={campaignId}
          sceneId={sceneId}
          character={selectedCharacter}
          settings={settings}
          onClose={() => {
            setIsComposing(false)
            setSelectedCharacterId('')
          }}
          onPostCreated={loadPosts}
        />
      ) : (
        <div className="space-y-2">
          {canCompose && (
            <>
              {sceneCharactersUserControls.length === 1 ? (
                <Button onClick={handleStartCompose} className="w-full">
                  <PenLine className="mr-2 h-4 w-4" />
                  Compose Post as {sceneCharactersUserControls[0].display_name}
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedCharacterId}
                    onValueChange={handleSelectCharacterAndCompose}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select character to post as" />
                    </SelectTrigger>
                    <SelectContent>
                      {sceneCharactersUserControls.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.display_name} ({c.character_type.toUpperCase()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {!canCompose && currentPhase === 'gm_phase' && !isGM && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Posting is disabled during GM Phase. Please wait for the PC Phase.
              </AlertDescription>
            </Alert>
          )}

          {!canCompose && sceneCharactersUserControls.length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You don't have any characters in this scene to post as.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Posts list */}
      {posts.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          No posts in this scene yet. Be the first to post!
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              isGM={isGM}
              currentUserId={currentUserId}
              settings={settings}
              sceneCharacters={characters}
            />
          ))}
        </div>
      )}
    </div>
  )
}

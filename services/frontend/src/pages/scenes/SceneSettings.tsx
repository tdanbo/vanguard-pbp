import { useEffect, useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useCampaignStore } from '@/stores/campaignStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { Loader2, UserMinus, UserPlus, Archive } from 'lucide-react'
import { ManagementLayout } from '@/components/layout'
import { SceneHeaderUploader } from '@/components/image/SceneHeaderUploader'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const settingsSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
})

type SettingsFormValues = z.infer<typeof settingsSchema>

export default function SceneSettings() {
  const { id: campaignId, sceneId } = useParams<{ id: string; sceneId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const {
    currentCampaign,
    scenes,
    characters,
    loadingCampaign,
    loadingScenes,
    fetchCampaign,
    fetchScenes,
    fetchCharacters,
    updateScene,
    archiveScene,
    addCharacterToScene,
    removeCharacterFromScene,
  } = useCampaignStore()

  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [addCharacterDialogOpen, setAddCharacterDialogOpen] = useState(false)
  const [removeCharacterDialogOpen, setRemoveCharacterDialogOpen] = useState(false)
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const [addCharacterSelectedId, setAddCharacterSelectedId] = useState('')

  const scene = useMemo(
    () => scenes.find((s) => s.id === sceneId),
    [scenes, sceneId]
  )

  const sceneCharacters = useMemo(() => {
    if (!scene) return []
    return characters.filter((c) => scene.character_ids.includes(c.id))
  }, [characters, scene])

  const availableCharacters = useMemo(() => {
    if (!scene) return []
    return characters.filter(
      (c) => !c.is_archived && !scene.character_ids.includes(c.id)
    )
  }, [characters, scene])

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      title: '',
      description: '',
    },
  })

  useEffect(() => {
    if (campaignId) {
      fetchCampaign(campaignId)
      fetchScenes(campaignId)
      fetchCharacters(campaignId)
    }
  }, [campaignId, fetchCampaign, fetchScenes, fetchCharacters])

  useEffect(() => {
    if (scene) {
      form.reset({
        title: scene.title,
        description: scene.description || '',
      })
    }
  }, [scene, form])

  async function onSubmit(values: SettingsFormValues) {
    if (!campaignId || !sceneId) return
    try {
      await updateScene(campaignId, sceneId, {
        title: values.title,
        description: values.description,
      })
      toast({
        title: 'Settings saved',
        description: 'Scene settings have been updated.',
      })
      navigate(`/campaigns/${campaignId}/scenes/${sceneId}`)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to save settings',
        description: (error as Error).message,
      })
    }
  }

  async function handleArchive() {
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

  async function handleAddCharacter() {
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

  async function handleRemoveCharacter() {
    if (!campaignId || !sceneId || !selectedCharacterId) return
    try {
      await removeCharacterFromScene(campaignId, sceneId, selectedCharacterId)
      toast({ title: 'Character removed from scene' })
      setRemoveCharacterDialogOpen(false)
      setSelectedCharacterId(null)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to remove character',
        description: (error as Error).message,
      })
    }
  }

  const isLoading = loadingCampaign || loadingScenes

  if (isLoading || !scene || !currentCampaign) {
    return (
      <ManagementLayout maxWidth="2xl">
        <Skeleton className="mb-4 h-8 w-32" />
        <Skeleton className="mb-8 h-10 w-3/4" />
        <Skeleton className="h-96 w-full" />
      </ManagementLayout>
    )
  }

  // Only GM can access settings
  if (currentCampaign.user_role !== 'gm') {
    return (
      <ManagementLayout maxWidth="2xl">
        <div className="text-center py-12">
          <h1 className="font-display text-2xl font-semibold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6">Only the GM can access scene settings.</p>
          <Button asChild>
            <Link to={`/campaigns/${campaignId}/scenes/${sceneId}`}>Back to Scene</Link>
          </Button>
        </div>
      </ManagementLayout>
    )
  }

  return (
    <ManagementLayout maxWidth="2xl">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-2">
          <Link to={`/campaigns/${campaignId}/scenes/${sceneId}`}>
            &larr; Back to scene
          </Link>
        </Button>
        <h1 className="font-display text-2xl md:text-3xl font-semibold">Scene Settings</h1>
        <p className="text-muted-foreground mt-1">{scene.title}</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Header Image */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Header Image</CardTitle>
              <CardDescription>Set a background image for this scene</CardDescription>
            </CardHeader>
            <CardContent>
              <SceneHeaderUploader
                campaignId={campaignId!}
                sceneId={sceneId!}
                currentUrl={scene.header_image_url}
                onUploadComplete={() => {
                  fetchScenes(campaignId!)
                  toast({ title: 'Header image updated' })
                }}
                onDeleteComplete={() => {
                  fetchScenes(campaignId!)
                  toast({ title: 'Header image removed' })
                }}
              />
            </CardContent>
          </Card>

          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Scene Details</CardTitle>
              <CardDescription>Update the scene title and description</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scene Title</FormLabel>
                    <FormControl>
                      <Input {...field} maxLength={200} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} className="min-h-[100px] resize-none" maxLength={2000} />
                    </FormControl>
                    <FormDescription>
                      Describe the scene setting and atmosphere.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Character Roster */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Scene Roster</CardTitle>
              <CardDescription>Characters currently in this scene</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sceneCharacters.length === 0 ? (
                <p className="text-sm text-muted-foreground">No characters in this scene yet.</p>
              ) : (
                <div className="space-y-2">
                  {sceneCharacters.map((character) => (
                    <div
                      key={character.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={character.avatar_url || undefined} />
                          <AvatarFallback>
                            {character.display_name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{character.display_name}</p>
                          <p className="text-xs text-muted-foreground uppercase">
                            {character.character_type}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedCharacterId(character.id)
                          setRemoveCharacterDialogOpen(true)
                        }}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Separator />
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddCharacterDialogOpen(true)}
                disabled={availableCharacters.length === 0}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Character
              </Button>
              {availableCharacters.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  All characters are already in scenes or archived.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="font-display text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-medium flex items-center gap-2">
                    <Archive className="h-4 w-4" />
                    Archive Scene
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Archive this scene. Characters will be released.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => setArchiveDialogOpen(true)}
                  type="button"
                >
                  Archive
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button type="button" variant="outline" asChild>
              <Link to={`/campaigns/${campaignId}/scenes/${sceneId}`}>Cancel</Link>
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Settings
            </Button>
          </div>
        </form>
      </Form>

      {/* Archive Scene Dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Scene</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive this scene? Characters will be released and can be
              added to other scenes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Archive Scene
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Character Dialog */}
      <AlertDialog open={addCharacterDialogOpen} onOpenChange={setAddCharacterDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add Character to Scene</AlertDialogTitle>
            <AlertDialogDescription>
              Select a character to add to this scene.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
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
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAddCharacterSelectedId('')}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleAddCharacter} disabled={!addCharacterSelectedId}>
              Add Character
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Character Dialog */}
      <AlertDialog open={removeCharacterDialogOpen} onOpenChange={setRemoveCharacterDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Character</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this character from the scene? They can be added back
              later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedCharacterId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveCharacter}>
              Remove Character
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ManagementLayout>
  )
}

import { useEffect, useState } from 'react'
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
import { Switch } from '@/components/ui/switch'
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
import { Loader2, Pause, Play, Trash2, Crown } from 'lucide-react'
import { ManagementLayout } from '@/components/layout'
import { CampaignHeaderCompact } from '@/components/campaign'
import { StorageIndicator } from '@/components/image/StorageIndicator'

const settingsSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(2000).optional(),
  timeGatePreset: z.enum(['24h', '2d', '3d', '4d', '5d']),
  characterLimit: z.enum(['1000', '3000', '6000', '10000']),
  fogOfWar: z.boolean(),
  hiddenPosts: z.boolean(),
  oocVisibility: z.enum(['all', 'gm_only']),
})

type SettingsFormValues = z.infer<typeof settingsSchema>

const characterLimitOptions = {
  '1000': 1000,
  '3000': 3000,
  '6000': 6000,
  '10000': 10000,
} as const

export default function CampaignSettings() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const {
    currentCampaign,
    members,
    loadingCampaign,
    fetchCampaign,
    fetchMembers,
    updateCampaign,
    pauseCampaign,
    resumeCampaign,
    deleteCampaign,
    transferGm,
  } = useCampaignStore()

  // Dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmTitle, setDeleteConfirmTitle] = useState('')
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [selectedMemberForTransfer, setSelectedMemberForTransfer] = useState<string | null>(null)

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      title: '',
      description: '',
      timeGatePreset: '3d',
      characterLimit: '3000',
      fogOfWar: false,
      hiddenPosts: false,
      oocVisibility: 'gm_only',
    },
  })

  useEffect(() => {
    if (id) {
      fetchCampaign(id)
      fetchMembers(id)
    }
  }, [id, fetchCampaign, fetchMembers])

  const isPaused = currentCampaign?.is_paused ?? false

  async function handlePauseResume() {
    if (!currentCampaign || !id) return
    try {
      if (isPaused) {
        await resumeCampaign(id)
        toast({ title: 'Campaign resumed', description: 'The campaign is now active again.' })
      } else {
        await pauseCampaign(id)
        toast({ title: 'Campaign paused', description: 'Time gates are now frozen.' })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to update campaign',
        description: (error as Error).message,
      })
    }
  }

  async function handleDelete() {
    if (!currentCampaign || !id) return
    try {
      await deleteCampaign(id, deleteConfirmTitle)
      toast({ title: 'Campaign deleted', description: 'The campaign has been permanently deleted.' })
      navigate('/')
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to delete campaign',
        description: (error as Error).message,
      })
    }
  }

  async function handleTransferGm() {
    if (!selectedMemberForTransfer || !id) return
    try {
      await transferGm(id, selectedMemberForTransfer)
      toast({ title: 'GM role transferred' })
      setTransferDialogOpen(false)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to transfer GM role',
        description: (error as Error).message,
      })
    }
  }

  const playerMembers = members.filter((m) => m.role === 'player')

  useEffect(() => {
    if (currentCampaign) {
      form.reset({
        title: currentCampaign.title,
        description: currentCampaign.description || '',
        timeGatePreset: currentCampaign.settings.timeGatePreset,
        characterLimit: String(currentCampaign.settings.characterLimit) as SettingsFormValues['characterLimit'],
        fogOfWar: currentCampaign.settings.fogOfWar ?? false,
        hiddenPosts: currentCampaign.settings.hiddenPosts ?? false,
        oocVisibility: currentCampaign.settings.oocVisibility,
      })
    }
  }, [currentCampaign, form])

  async function onSubmit(values: SettingsFormValues) {
    if (!id) return
    try {
      await updateCampaign(id, {
        title: values.title,
        description: values.description,
        settings: {
          ...currentCampaign?.settings,
          timeGatePreset: values.timeGatePreset,
          characterLimit: characterLimitOptions[values.characterLimit],
          fogOfWar: values.fogOfWar,
          hiddenPosts: values.hiddenPosts,
          oocVisibility: values.oocVisibility,
        },
      })
      toast({
        title: 'Settings saved',
        description: 'Campaign settings have been updated.',
      })
      navigate(`/campaigns/${id}`)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to save settings',
        description: (error as Error).message,
      })
    }
  }

  if (loadingCampaign || !currentCampaign) {
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
          <p className="text-muted-foreground mb-6">Only the GM can access campaign settings.</p>
          <Button asChild>
            <Link to={`/campaigns/${id}`}>Back to Campaign</Link>
          </Button>
        </div>
      </ManagementLayout>
    )
  }

  return (
    <ManagementLayout maxWidth="2xl">
      <CampaignHeaderCompact
        campaign={currentCampaign}
        backTo={`/campaigns/${id}`}
        backLabel="Back to campaign"
      />

      <h1 className="font-display text-2xl md:text-3xl font-semibold mb-8">Campaign Settings</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Campaign Details</CardTitle>
              <CardDescription>Update your campaign&apos;s name and description</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Campaign Title</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                      <Textarea {...field} className="min-h-[100px] resize-none" />
                    </FormControl>
                    <FormDescription>
                      A brief description of your campaign for players.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Game Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Game Settings</CardTitle>
              <CardDescription>Configure game rules and time limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="timeGatePreset"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time Gate Duration</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="24h">24 hours</SelectItem>
                        <SelectItem value="2d">2 days</SelectItem>
                        <SelectItem value="3d">3 days</SelectItem>
                        <SelectItem value="4d">4 days</SelectItem>
                        <SelectItem value="5d">5 days</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Time limit for PC phase before auto-advance.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="characterLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Character Limit per Post</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select limit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1000">1,000 characters</SelectItem>
                        <SelectItem value="3000">3,000 characters</SelectItem>
                        <SelectItem value="6000">6,000 characters</SelectItem>
                        <SelectItem value="10000">10,000 characters</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Maximum characters allowed per post</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </CardContent>
          </Card>

          {/* Secrecy Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Secrecy Settings</CardTitle>
              <CardDescription>Configure information visibility and anti-metagaming features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="fogOfWar"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Fog of War</FormLabel>
                      <FormDescription>
                        Controls information visibility across scenes. When enabled, characters only see scenes where they have witnessed at least one post.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hiddenPosts"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Hidden Posts</FormLabel>
                      <FormDescription>
                        Allows secret posts within a shared scene. When enabled, players can mark posts as hidden so only the GM sees them.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="oocVisibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OOC Comment Visibility</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select visibility" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all">Visible to all players</SelectItem>
                        <SelectItem value="gm_only">GM only</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Controls who can see out-of-character text on posts.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Campaign Status */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Campaign Status</CardTitle>
              <CardDescription>Storage usage and campaign state</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <StorageIndicator campaignId={id!} />
              <Separator />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-medium">Pause Campaign</h4>
                  <p className="text-sm text-muted-foreground">
                    Freeze time gates and prevent new posts
                  </p>
                </div>
                <Button variant="outline" onClick={handlePauseResume} type="button">
                  {isPaused ? (
                    <Play className="mr-2 h-4 w-4" />
                  ) : (
                    <Pause className="mr-2 h-4 w-4" />
                  )}
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="font-display text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Transfer GM Role */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-medium flex items-center gap-2">
                    <Crown className="h-4 w-4" />
                    Transfer GM Role
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Transfer ownership to another player
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setTransferDialogOpen(true)}
                  disabled={playerMembers.length === 0}
                  type="button"
                >
                  Transfer
                </Button>
              </div>
              <Separator />
              {/* Delete Campaign */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-medium flex items-center gap-2 text-destructive">
                    <Trash2 className="h-4 w-4" />
                    Delete Campaign
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete this campaign and all its data
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                  type="button"
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button type="button" variant="outline" asChild>
              <Link to={`/campaigns/${id}`}>Cancel</Link>
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Settings
            </Button>
          </div>
        </form>
      </Form>

      {/* Delete Campaign Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the campaign and all
              associated data including scenes, posts, and characters.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-2">
              Type <strong>{currentCampaign.title}</strong> to confirm:
            </p>
            <Input
              value={deleteConfirmTitle}
              onChange={(e) => setDeleteConfirmTitle(e.target.value)}
              placeholder="Campaign title"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmTitle('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteConfirmTitle !== currentCampaign.title}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer GM Role Dialog */}
      <AlertDialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer GM Role</AlertDialogTitle>
            <AlertDialogDescription>
              Select a player to transfer the GM role to. You will become a player in this
              campaign.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select
              value={selectedMemberForTransfer || ''}
              onValueChange={setSelectedMemberForTransfer}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a player" />
              </SelectTrigger>
              <SelectContent>
                {playerMembers.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    Player ({member.user_id.slice(0, 8)}...)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedMemberForTransfer(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleTransferGm} disabled={!selectedMemberForTransfer}>
              Transfer GM Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ManagementLayout>
  )
}

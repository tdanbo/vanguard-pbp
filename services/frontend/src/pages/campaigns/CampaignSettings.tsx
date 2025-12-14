import { useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useCampaignStore } from '@/stores/campaignStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import { ManagementLayout } from '@/components/layout'
import { CampaignHeaderCompact } from '@/components/campaign'

const settingsSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(2000).optional(),
  timeGatePreset: z.enum(['24h', '2d', '3d', '4d', '5d']),
  characterLimit: z.enum(['1000', '3000', '6000', '10000']),
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
  const { currentCampaign, loadingCampaign, fetchCampaign, updateCampaign } = useCampaignStore()

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      title: '',
      description: '',
      timeGatePreset: '3d',
      characterLimit: '3000',
      oocVisibility: 'gm_only',
    },
  })

  useEffect(() => {
    if (id) {
      fetchCampaign(id)
    }
  }, [id, fetchCampaign])

  useEffect(() => {
    if (currentCampaign) {
      form.reset({
        title: currentCampaign.title,
        description: currentCampaign.description || '',
        timeGatePreset: currentCampaign.settings.timeGatePreset,
        characterLimit: String(currentCampaign.settings.characterLimit) as SettingsFormValues['characterLimit'],
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
                    <FormDescription>Who can see OOC (out-of-character) comments</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
    </ManagementLayout>
  )
}

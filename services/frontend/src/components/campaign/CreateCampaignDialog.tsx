import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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
import { useToast } from '@/hooks/use-toast'
import { useCampaignStore } from '@/stores/campaignStore'
import { Plus, Loader2 } from 'lucide-react'

const createCampaignSchema = z.object({
  title: z.string().min(1, 'Campaign title is required').max(255, 'Title is too long'),
  description: z.string().max(2000, 'Description is too long').optional(),
})

type CreateCampaignFormValues = z.infer<typeof createCampaignSchema>

export function CreateCampaignDialog() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()
  const { createCampaign, campaigns } = useCampaignStore()

  const form = useForm<CreateCampaignFormValues>({
    resolver: zodResolver(createCampaignSchema),
    defaultValues: {
      title: '',
      description: '',
    },
  })

  const gmCampaignsCount = campaigns.filter((c) => c.user_role === 'gm').length

  async function onSubmit(values: CreateCampaignFormValues) {
    try {
      const campaign = await createCampaign({
        title: values.title,
        description: values.description,
      })
      toast({
        title: 'Campaign created',
        description: 'Your campaign is ready. Invite players to get started.',
      })
      setOpen(false)
      form.reset()
      navigate(`/campaigns/${campaign.id}`)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to create campaign',
        description: (error as Error).message,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={gmCampaignsCount >= 5}>
          <Plus className="mr-2 h-4 w-4" />
          Create Campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Campaign</DialogTitle>
          <DialogDescription>
            Start a new play-by-post campaign. You&apos;ll be the Game Master.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Campaign Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter campaign title" {...field} />
                  </FormControl>
                  <FormDescription>This is the name players will see.</FormDescription>
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
                    <Textarea
                      placeholder="Describe your campaign..."
                      className="min-h-[100px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A brief description to help players understand the campaign.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Campaign
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

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
import { useToast } from '@/hooks/use-toast'
import { useCampaignStore } from '@/stores/campaignStore'
import { UserPlus, Loader2 } from 'lucide-react'

const joinCampaignSchema = z.object({
  code: z.string().min(1, 'Invite code is required'),
  alias: z.string().optional(),
})

type JoinCampaignFormValues = z.infer<typeof joinCampaignSchema>

export function JoinCampaignDialog() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()
  const { joinCampaign } = useCampaignStore()

  const form = useForm<JoinCampaignFormValues>({
    resolver: zodResolver(joinCampaignSchema),
    defaultValues: {
      code: '',
      alias: '',
    },
  })

  async function onSubmit(values: JoinCampaignFormValues) {
    try {
      const campaign = await joinCampaign(values.code, values.alias || undefined)
      toast({
        title: 'Joined campaign',
        description: `You've joined "${campaign.title}".`,
      })
      setOpen(false)
      form.reset()
      navigate(`/campaigns/${campaign.id}`)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to join campaign',
        description: (error as Error).message,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlus className="mr-2 h-4 w-4" />
          Join Campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Join Campaign</DialogTitle>
          <DialogDescription>Enter the invite code from the Game Master to join a campaign.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invite Code</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter invite code" {...field} />
                  </FormControl>
                  <FormDescription>The code from your invite link.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="alias"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>OOC Alias</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter an out-of-character alias" {...field} />
                  </FormControl>
                  <FormDescription>
                    This is not your character name but an out-of-character alias. You can change it later.
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
                Join
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

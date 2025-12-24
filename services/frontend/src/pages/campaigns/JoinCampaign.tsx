import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useCampaignStore } from '@/stores/campaignStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react'

export default function JoinCampaign() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { validateInvite, joinCampaign } = useCampaignStore()

  const [campaignInfo, setCampaignInfo] = useState<{ campaignId: string; campaignTitle: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alias, setAlias] = useState('')

  useEffect(() => {
    if (code) {
      validateInvite(code)
        .then(setCampaignInfo)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [code, validateInvite])

  async function handleJoin() {
    if (!code) return
    setJoining(true)
    try {
      const campaign = await joinCampaign(code, alias || undefined)
      toast({
        title: 'Joined campaign',
        description: `You've joined "${campaign.title}".`,
      })
      navigate(`/campaigns/${campaign.id}`)
    } catch (err) {
      setError((err as Error).message)
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Validating invite...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <h2 className="mt-4 text-xl font-semibold">Invalid Invite</h2>
            <p className="mt-2 text-center text-muted-foreground">{error}</p>
            <Button className="mt-6" asChild>
              <Link to="/">Go to Campaigns</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-primary" />
          <CardTitle className="mt-4">Join Campaign</CardTitle>
          <CardDescription>You&apos;ve been invited to join</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-muted p-4 text-center">
            <h3 className="text-xl font-semibold">{campaignInfo?.campaignTitle}</h3>
          </div>

          <div className="space-y-2">
            <Label htmlFor="alias">OOC Alias</Label>
            <Input
              id="alias"
              placeholder="Enter an out-of-character alias"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              This is not your character name but an out-of-character alias. You can change it later.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" asChild>
              <Link to="/">Cancel</Link>
            </Button>
            <Button className="flex-1" onClick={handleJoin} disabled={joining}>
              {joining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Join Campaign
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

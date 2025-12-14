import { useEffect } from 'react'
import { useCampaignStore } from '@/stores/campaignStore'
import { useAuthStore } from '@/stores/authStore'
import { CampaignCard } from '@/components/campaign/CampaignCard'
import { CreateCampaignDialog } from '@/components/campaign/CreateCampaignDialog'
import { JoinCampaignDialog } from '@/components/campaign/JoinCampaignDialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LogOut, BookOpen } from 'lucide-react'

function CampaignCardSkeleton() {
  return (
    <div className="rounded-lg border p-6">
      <div className="space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
    </div>
  )
}

export default function CampaignList() {
  const { campaigns, fetchCampaigns, loadingCampaigns } = useCampaignStore()
  const { signOut, user } = useAuthStore()

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2 font-semibold">
            <BookOpen className="h-5 w-5" />
            <span>Vanguard PBP</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Campaigns</h1>
            <p className="text-muted-foreground">Manage your play-by-post campaigns</p>
          </div>
          <div className="flex gap-2">
            <JoinCampaignDialog />
            <CreateCampaignDialog />
          </div>
        </div>

        {/* Campaign Grid */}
        {loadingCampaigns ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CampaignCardSkeleton key={i} />
            ))}
          </div>
        ) : !campaigns || campaigns.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-semibold">No campaigns yet</h2>
            <p className="mt-2 text-muted-foreground">
              Create your first campaign or join one with an invite code.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <JoinCampaignDialog />
              <CreateCampaignDialog />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

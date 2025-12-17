import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useCampaignStore } from '@/stores/campaignStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import {
  Crown,
  Users,
  Settings,
  Trash2,
  Copy,
  LinkIcon,
  UserMinus,
  LogOut,
  User,
  BookOpen,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { CampaignMember, InviteLink, CreateSceneRequest } from '@/types'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { PlusCircle, Eye, EyeOff } from 'lucide-react'
import { ManagementLayout } from '@/components/layout'
import { CampaignHeader, SceneCardsGrid } from '@/components/campaign'
import { CharacterManager } from '@/components/character/CharacterManager'
import { EmptyState } from '@/components/ui/empty-state'
import {
  PhaseIndicator,
  PhaseTransitionButton,
  TimeGateInfo,
  CampaignPassOverview,
} from '@/components/phase'

export default function CampaignDashboard() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const {
    currentCampaign,
    members,
    invites,
    scenes,
    phaseStatus,
    loadingCampaign,
    fetchCampaign,
    fetchMembers,
    fetchInvites,
    fetchScenes,
    fetchPhaseStatus,
    createInvite,
    revokeInvite,
    removeMember,
    leaveCampaign,
    createScene,
  } = useCampaignStore()

  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)

  // Scene state
  const [showArchivedScenes, setShowArchivedScenes] = useState(false)
  const [createSceneDialogOpen, setCreateSceneDialogOpen] = useState(false)
  const [sceneTitle, setSceneTitle] = useState('')
  const [sceneDescription, setSceneDescription] = useState('')

  useEffect(() => {
    if (id) {
      fetchCampaign(id)
      fetchMembers(id)
      fetchScenes(id)
      fetchPhaseStatus(id)
      fetchInvites(id).catch(() => {
        // Non-GMs can't fetch invites, that's ok
      })
    }
  }, [id, fetchCampaign, fetchMembers, fetchScenes, fetchInvites, fetchPhaseStatus])

  if (loadingCampaign || !currentCampaign) {
    return (
      <ManagementLayout maxWidth="6xl">
        <Skeleton className="mb-4 h-8 w-32" />
        <Skeleton className="mb-2 h-10 w-3/4" />
        <Skeleton className="mb-4 h-6 w-1/2" />
        <div className="mt-8 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </ManagementLayout>
    )
  }

  const isGM = currentCampaign.user_role === 'gm'
  const isPaused = currentCampaign.is_paused

  async function handleCreateInvite() {
    if (!currentCampaign) return
    try {
      const invite = await createInvite(currentCampaign.id)
      const url = `${window.location.origin}/join/${invite.code}`
      await navigator.clipboard.writeText(url)
      toast({
        title: 'Invite link created',
        description: 'The link has been copied to your clipboard.',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to create invite',
        description: (error as Error).message,
      })
    }
  }

  async function handleCopyInvite(code: string) {
    const url = `${window.location.origin}/join/${code}`
    await navigator.clipboard.writeText(url)
    toast({ title: 'Copied', description: 'Invite link copied to clipboard.' })
  }

  async function handleRevokeInvite(inviteId: string) {
    if (!currentCampaign) return
    try {
      await revokeInvite(currentCampaign.id, inviteId)
      toast({ title: 'Invite revoked' })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to revoke invite',
        description: (error as Error).message,
      })
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!currentCampaign) return
    try {
      await removeMember(currentCampaign.id, memberId)
      toast({ title: 'Member removed' })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to remove member',
        description: (error as Error).message,
      })
    }
  }

  async function handleLeave() {
    if (!currentCampaign) return
    try {
      await leaveCampaign(currentCampaign.id)
      toast({ title: 'Left campaign' })
      navigate('/')
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to leave campaign',
        description: (error as Error).message,
      })
    }
  }

  async function handleCreateScene() {
    if (!currentCampaign || !sceneTitle.trim()) return
    try {
      const data: CreateSceneRequest = {
        title: sceneTitle.trim(),
        description: sceneDescription.trim() || undefined,
      }
      await createScene(currentCampaign.id, data)
      toast({ title: 'Scene created' })
      setCreateSceneDialogOpen(false)
      setSceneTitle('')
      setSceneDescription('')
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to create scene',
        description: (error as Error).message,
      })
    }
  }

  const activeInvites = invites.filter((i) => !i.used_at && !i.revoked_at && new Date(i.expires_at) > new Date())

  // Filter scenes for display
  const visibleScenes = scenes.filter((s) => showArchivedScenes || !s.is_archived)
  const activeSceneCount = scenes.filter((s) => !s.is_archived).length

  return (
    <ManagementLayout maxWidth="6xl">
      {/* Campaign Header */}
      <CampaignHeader
        campaign={currentCampaign}
        memberCount={members.length}
        isGM={isGM}
      />

      {/* GM Actions */}
      {isGM && (
        <div className="flex flex-wrap gap-2 mb-6">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/campaigns/${id}/settings`}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
        </div>
      )}

      {/* Phase Status */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <PhaseIndicator
                phase={currentCampaign.current_phase}
                isPaused={isPaused}
                phaseStatus={phaseStatus}
                size="md"
                showDetails={currentCampaign.current_phase === 'pc_phase'}
              />
              <TimeGateInfo
                preset={currentCampaign.settings?.timeGatePreset || null}
                expiresAt={currentCampaign.current_phase_expires_at}
              />
            </div>
            <div className="flex items-center gap-4">
              {isGM && phaseStatus && (
                <PhaseTransitionButton
                  campaignId={currentCampaign.id}
                  phaseStatus={phaseStatus}
                  isGM={isGM}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pass Overview (PC Phase only) */}
      {currentCampaign.current_phase === 'pc_phase' && (
        <CampaignPassOverview
          campaignId={currentCampaign.id}
          isPCPhase={currentCampaign.current_phase === 'pc_phase'}
          className="mb-6"
        />
      )}

      {/* Tabs with gold underline */}
      <Tabs defaultValue="scenes" className="space-y-6">
        <TabsList variant="underline">
          <TabsTrigger value="scenes" variant="underline">
            <BookOpen className="mr-2 h-4 w-4" />
            Scenes
          </TabsTrigger>
          <TabsTrigger value="pcs" variant="underline">
            <User className="mr-2 h-4 w-4" />
            PCs
          </TabsTrigger>
          <TabsTrigger value="npcs" variant="underline">
            <Users className="mr-2 h-4 w-4" />
            NPCs
          </TabsTrigger>
          <TabsTrigger value="members" variant="underline">
            <Users className="mr-2 h-4 w-4" />
            Members ({members.length})
          </TabsTrigger>
          {isGM && (
            <TabsTrigger value="invites" variant="underline">
              <LinkIcon className="mr-2 h-4 w-4" />
              Invites ({activeInvites.length})
            </TabsTrigger>
          )}
        </TabsList>

          <TabsContent value="scenes">
            {/* GM controls header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <p className="text-sm text-muted-foreground">
                  {activeSceneCount} / 25 active scenes
                </p>
                {isGM && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowArchivedScenes(!showArchivedScenes)}
                    className="text-muted-foreground"
                  >
                    {showArchivedScenes ? (
                      <>
                        <EyeOff className="mr-2 h-4 w-4" />
                        Hide archived
                      </>
                    ) : (
                      <>
                        <Eye className="mr-2 h-4 w-4" />
                        Show archived
                      </>
                    )}
                  </Button>
                )}
              </div>
              {isGM && (
                <Dialog open={createSceneDialogOpen} onOpenChange={setCreateSceneDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Create Scene
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Scene</DialogTitle>
                      <DialogDescription>Add a new scene to the campaign.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="sceneTitle">Title</Label>
                        <Input
                          id="sceneTitle"
                          value={sceneTitle}
                          onChange={(e) => setSceneTitle(e.target.value)}
                          placeholder="Scene title"
                          maxLength={200}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sceneDescription">Description</Label>
                        <Textarea
                          id="sceneDescription"
                          value={sceneDescription}
                          onChange={(e) => setSceneDescription(e.target.value)}
                          placeholder="Scene description (optional)"
                          maxLength={2000}
                          rows={3}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCreateSceneDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateScene} disabled={!sceneTitle.trim()}>
                        Create Scene
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Scene cards grid */}
            {visibleScenes.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No scenes yet"
                description={isGM ? "Create your first scene to get started." : "No scenes have been created yet."}
              />
            ) : (
              <SceneCardsGrid
                scenes={visibleScenes}
                campaignId={currentCampaign.id}
                isGM={isGM}
                phase={currentCampaign.is_paused ? 'paused' : currentCampaign.current_phase}
              />
            )}
          </TabsContent>

          <TabsContent value="pcs">
            <CharacterManager
              campaignId={currentCampaign.id}
              isGM={isGM}
              members={members}
              scenes={scenes}
              characterTypeFilter="pc"
            />
          </TabsContent>

          <TabsContent value="npcs">
            <CharacterManager
              campaignId={currentCampaign.id}
              isGM={isGM}
              members={members}
              scenes={scenes}
              characterTypeFilter="npc"
            />
          </TabsContent>

          <TabsContent value="members">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Members</CardTitle>
                <CardDescription>{members.length} / 50 members</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {members.map((member) => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      isCurrentUserGM={isGM}
                      currentCampaign={currentCampaign}
                      onRemove={() => handleRemoveMember(member.user_id)}
                    />
                  ))}
                </div>
                {!isGM && (
                  <Button
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={() => setLeaveDialogOpen(true)}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Leave Campaign
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {isGM && (
            <TabsContent value="invites">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Invite Links</CardTitle>
                    <CardDescription>Create and manage invite links for players</CardDescription>
                  </div>
                  <Button onClick={handleCreateInvite}>
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Create Invite
                  </Button>
                </CardHeader>
                <CardContent>
                  {invites.length === 0 ? (
                    <p className="py-4 text-center text-muted-foreground">No invite links created yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {invites.map((invite) => (
                        <InviteRow
                          key={invite.id}
                          invite={invite}
                          onCopy={() => handleCopyInvite(invite.code)}
                          onRevoke={() => handleRevokeInvite(invite.id)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

      {/* Leave Dialog */}
      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              You will lose access to this campaign. Your characters will become unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeave}>Leave Campaign</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ManagementLayout>
  )
}

function MemberRow({
  member,
  isCurrentUserGM,
  currentCampaign,
  onRemove,
}: {
  member: CampaignMember
  isCurrentUserGM: boolean
  currentCampaign: { owner_id: string | null }
  onRemove: () => void
}) {
  const isGM = member.role === 'gm'
  const isOwner = currentCampaign.owner_id === member.user_id

  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm">
          {isGM ? <Crown className="h-4 w-4" /> : <Users className="h-4 w-4" />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {isGM ? 'Game Master' : 'Player'}
            </span>
            <Badge variant={isGM ? 'default' : 'secondary'} className="text-xs">
              {member.role.toUpperCase()}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Joined {formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}
          </div>
        </div>
      </div>
      {isCurrentUserGM && !isOwner && (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <UserMinus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

function InviteRow({
  invite,
  onCopy,
  onRevoke,
}: {
  invite: InviteLink
  onCopy: () => void
  onRevoke: () => void
}) {
  const isUsed = !!invite.used_at
  const isRevoked = !!invite.revoked_at
  const isExpired = new Date(invite.expires_at) < new Date()
  const isActive = !isUsed && !isRevoked && !isExpired

  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div>
        <div className="flex items-center gap-2">
          <code className="text-sm">{invite.code}</code>
          {isUsed && <Badge variant="secondary">Used</Badge>}
          {isRevoked && <Badge variant="outline">Revoked</Badge>}
          {isExpired && !isUsed && !isRevoked && <Badge variant="destructive">Expired</Badge>}
          {isActive && <Badge variant="default">Active</Badge>}
        </div>
        <div className="text-xs text-muted-foreground">
          {isActive
            ? `Expires ${formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true })}`
            : `Created ${formatDistanceToNow(new Date(invite.created_at), { addSuffix: true })}`}
        </div>
      </div>
      {isActive && (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onCopy}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onRevoke}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

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
  ArrowLeft,
  Crown,
  Users,
  Settings,
  Pause,
  Play,
  Trash2,
  Copy,
  LinkIcon,
  UserMinus,
  LogOut,
  Clock,
  User,
  BookOpen,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { CampaignMember, InviteLink } from '@/types'
import { CharacterManager } from '@/components/character/CharacterManager'
import { SceneManager } from '@/components/scene/SceneManager'

export default function CampaignDashboard() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const {
    currentCampaign,
    members,
    invites,
    loadingCampaign,
    fetchCampaign,
    fetchMembers,
    fetchInvites,
    pauseCampaign,
    resumeCampaign,
    deleteCampaign,
    createInvite,
    revokeInvite,
    removeMember,
    leaveCampaign,
    transferGm,
  } = useCampaignStore()

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmTitle, setDeleteConfirmTitle] = useState('')
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [selectedMemberForTransfer, setSelectedMemberForTransfer] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      fetchCampaign(id)
      fetchMembers(id)
      fetchInvites(id).catch(() => {
        // Non-GMs can't fetch invites, that's ok
      })
    }
  }, [id, fetchCampaign, fetchMembers, fetchInvites])

  if (loadingCampaign || !currentCampaign) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <Skeleton className="mb-4 h-8 w-32" />
          <Skeleton className="mb-2 h-10 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
        </div>
      </div>
    )
  }

  const isGM = currentCampaign.user_role === 'gm'
  const isPaused = currentCampaign.is_paused

  async function handlePauseResume() {
    if (!currentCampaign) return
    try {
      if (isPaused) {
        await resumeCampaign(currentCampaign.id)
        toast({ title: 'Campaign resumed', description: 'The campaign is now active again.' })
      } else {
        await pauseCampaign(currentCampaign.id)
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
    if (!currentCampaign) return
    try {
      await deleteCampaign(currentCampaign.id, deleteConfirmTitle)
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

  async function handleTransferGm() {
    if (!selectedMemberForTransfer || !currentCampaign) return
    try {
      await transferGm(currentCampaign.id, selectedMemberForTransfer)
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

  const activeInvites = invites.filter((i) => !i.used_at && !i.revoked_at && new Date(i.expires_at) > new Date())

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link to="/" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to campaigns
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold">{currentCampaign.title}</h1>
                {isGM && (
                  <Badge variant="default" className="gap-1">
                    <Crown className="h-3 w-3" />
                    GM
                  </Badge>
                )}
                {isPaused && (
                  <Badge variant="secondary">
                    <Pause className="mr-1 h-3 w-3" />
                    Paused
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-muted-foreground">{currentCampaign.description || 'No description'}</p>
            </div>
            {isGM && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handlePauseResume}>
                  {isPaused ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/campaigns/${id}/settings`}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Phase Info */}
        <Card className="mb-6">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <Badge variant={currentCampaign.current_phase === 'gm_phase' ? 'secondary' : 'default'} className="text-sm">
                {currentCampaign.current_phase === 'gm_phase' ? 'GM Phase' : 'PC Phase'}
              </Badge>
              {currentCampaign.current_phase_expires_at && (
                <span className="flex items-center text-sm text-muted-foreground">
                  <Clock className="mr-1 h-4 w-4" />
                  Expires {formatDistanceToNow(new Date(currentCampaign.current_phase_expires_at), { addSuffix: true })}
                </span>
              )}
            </div>
            <div className="text-sm text-muted-foreground">{currentCampaign.scene_count} scenes</div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="scenes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="scenes">
              <BookOpen className="mr-2 h-4 w-4" />
              Scenes
            </TabsTrigger>
            <TabsTrigger value="characters">
              <User className="mr-2 h-4 w-4" />
              Characters
            </TabsTrigger>
            <TabsTrigger value="members">
              <Users className="mr-2 h-4 w-4" />
              Members ({members.length})
            </TabsTrigger>
            {isGM && (
              <TabsTrigger value="invites">
                <LinkIcon className="mr-2 h-4 w-4" />
                Invites ({activeInvites.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="scenes">
            <SceneManager
              campaignId={currentCampaign.id}
              isGM={isGM}
              currentPhase={currentCampaign.current_phase}
            />
          </TabsContent>

          <TabsContent value="characters">
            <CharacterManager
              campaignId={currentCampaign.id}
              isGM={isGM}
              members={members}
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
                      onTransfer={() => {
                        setSelectedMemberForTransfer(member.user_id)
                        setTransferDialogOpen(true)
                      }}
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

        {/* Danger Zone */}
        {isGM && (
          <Card className="mt-6 border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedMemberForTransfer(null)
                  setTransferDialogOpen(true)
                }}
              >
                Transfer GM Role
              </Button>
              <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Campaign
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All scenes, posts, and data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">
              Type &quot;{currentCampaign.title}&quot; to confirm:
            </label>
            <Input
              className="mt-2"
              value={deleteConfirmTitle}
              onChange={(e) => setDeleteConfirmTitle(e.target.value)}
              placeholder="Campaign title"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleteConfirmTitle !== currentCampaign.title}
            >
              Delete Campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* Transfer GM Dialog */}
      <AlertDialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer GM Role?</AlertDialogTitle>
            <AlertDialogDescription>
              You will become a player and lose GM permissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="mb-2 block text-sm font-medium">Select new GM:</label>
            <div className="space-y-2">
              {members
                .filter((m) => m.role === 'player')
                .map((member) => (
                  <Button
                    key={member.id}
                    variant={selectedMemberForTransfer === member.user_id ? 'default' : 'outline'}
                    className="w-full justify-start"
                    onClick={() => setSelectedMemberForTransfer(member.user_id)}
                  >
                    Player {member.user_id.slice(0, 8)}...
                  </Button>
                ))}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleTransferGm} disabled={!selectedMemberForTransfer}>
              Transfer Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function MemberRow({
  member,
  isCurrentUserGM,
  currentCampaign,
  onRemove,
  onTransfer,
}: {
  member: CampaignMember
  isCurrentUserGM: boolean
  currentCampaign: { owner_id: string | null }
  onRemove: () => void
  onTransfer: () => void
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
          {member.role === 'player' && (
            <Button variant="ghost" size="sm" onClick={onTransfer}>
              <Crown className="h-4 w-4" />
            </Button>
          )}
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

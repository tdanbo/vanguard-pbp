import { useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Dices } from 'lucide-react'
import { useRollStore } from '@/stores/rollStore'

interface PendingRollsBadgeProps {
  characterId: string
  className?: string
}

export function PendingRollsBadge({ characterId, className }: PendingRollsBadgeProps) {
  const { pendingRolls, getPendingRollsForCharacter, loadingPendingRolls } = useRollStore()

  useEffect(() => {
    getPendingRollsForCharacter(characterId)
  }, [characterId, getPendingRollsForCharacter])

  if (loadingPendingRolls || pendingRolls.length === 0) {
    return null
  }

  return (
    <Badge variant="destructive" className={className}>
      <Dices className="h-3 w-3 mr-1" />
      {pendingRolls.length} pending roll{pendingRolls.length !== 1 ? 's' : ''}
    </Badge>
  )
}

import { useState, useEffect } from 'react'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { apiGet } from '@/lib/api'
import { HardDrive, AlertTriangle } from 'lucide-react'

interface StorageStatus {
  usedBytes: number
  limitBytes: number
  percentage: number
  warningLevel: '' | 'medium' | 'high' | 'critical'
}

interface StorageIndicatorProps {
  campaignId: string
  className?: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function StorageIndicator({ campaignId, className }: StorageIndicatorProps) {
  const [status, setStatus] = useState<StorageStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await apiGet<StorageStatus>(`/api/v1/campaigns/${campaignId}/storage`)
        setStatus(data)
      } catch {
        // Silently fail - storage status is not critical
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()
  }, [campaignId])

  if (loading || !status) {
    return null
  }

  const getProgressColor = () => {
    switch (status.warningLevel) {
      case 'critical':
        return 'bg-destructive'
      case 'high':
        return 'bg-orange-500'
      case 'medium':
        return 'bg-yellow-500'
      default:
        return ''
    }
  }

  const getAlertVariant = () => {
    if (status.warningLevel === 'critical') return 'destructive'
    return 'default'
  }

  return (
    <div className={className}>
      {status.warningLevel && (
        <Alert variant={getAlertVariant()} className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Storage {status.warningLevel === 'critical' ? 'Almost Full' : 'Warning'}</AlertTitle>
          <AlertDescription>
            {status.warningLevel === 'critical'
              ? 'Campaign storage is nearly full. Delete some images to continue uploading.'
              : status.warningLevel === 'high'
              ? 'Campaign storage is running low. Consider removing unused images.'
              : 'Campaign storage is filling up.'}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-3 text-sm">
        <HardDrive className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <Progress
            value={status.percentage}
            className={`h-2 ${getProgressColor()}`}
          />
        </div>
        <span className="text-muted-foreground whitespace-nowrap">
          {formatBytes(status.usedBytes)} / {formatBytes(status.limitBytes)}
        </span>
      </div>
    </div>
  )
}

export default StorageIndicator

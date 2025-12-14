import { Wifi, WifiOff, Loader2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

type ConnectionState = 'connected' | 'connecting' | 'disconnected'

interface ConnectionStatusProps {
  state: ConnectionState
  className?: string
}

export function ConnectionStatus({ state, className }: ConnectionStatusProps) {
  // Don't show anything when connected
  if (state === 'connected') return null

  const config: Record<Exclude<ConnectionState, 'connected'>, {
    icon: typeof Wifi
    title: string
    description: string
    variant: 'default' | 'destructive'
    iconClassName?: string
  }> = {
    connecting: {
      icon: Loader2,
      title: 'Reconnecting...',
      description: 'Trying to reconnect to the server.',
      variant: 'default',
      iconClassName: 'animate-spin',
    },
    disconnected: {
      icon: WifiOff,
      title: 'Connection lost',
      description: 'Trying to reconnect. Your changes will be saved when connection is restored.',
      variant: 'destructive',
    },
  }

  const { icon: Icon, title, description, variant, iconClassName } = config[state]

  return (
    <Alert variant={variant} className={cn('', className)}>
      <Icon className={cn('h-4 w-4', iconClassName)} />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  )
}

// Compact banner version for top of page
interface ConnectionBannerProps {
  state: ConnectionState
  className?: string
}

export function ConnectionBanner({ state, className }: ConnectionBannerProps) {
  if (state === 'connected') return null

  const isDisconnected = state === 'disconnected'

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm border-b flex items-center justify-center gap-2',
        isDisconnected
          ? 'bg-destructive/10 text-destructive border-destructive/30'
          : 'bg-warning/10 text-warning border-warning/30',
        className
      )}
    >
      {isDisconnected ? (
        <WifiOff className="h-4 w-4" />
      ) : (
        <Loader2 className="h-4 w-4 animate-spin" />
      )}
      <span>
        {isDisconnected ? 'Connection lost. Retrying...' : 'Reconnecting...'}
      </span>
    </div>
  )
}

export type { ConnectionState }
export default ConnectionStatus

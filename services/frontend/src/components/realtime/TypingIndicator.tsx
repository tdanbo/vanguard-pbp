import { cn } from '@/lib/utils'

interface TypingUser {
  name: string
  id?: string
}

interface TypingIndicatorProps {
  users: TypingUser[]
  className?: string
}

export function TypingIndicator({ users, className }: TypingIndicatorProps) {
  if (users.length === 0) return null

  const getMessage = () => {
    if (users.length === 1) {
      return `${users[0].name} is typing...`
    }
    if (users.length === 2) {
      return `${users[0].name} and ${users[1].name} are typing...`
    }
    return `${users[0].name} and ${users.length - 1} others are typing...`
  }

  return (
    <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <BouncingDots />
      <span>{getMessage()}</span>
    </div>
  )
}

function BouncingDots() {
  return (
    <div className="flex items-center gap-1">
      <span
        className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"
        style={{ animationDelay: '0ms' }}
      />
      <span
        className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"
        style={{ animationDelay: '150ms' }}
      />
      <span
        className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"
        style={{ animationDelay: '300ms' }}
      />
    </div>
  )
}

export { BouncingDots }
export default TypingIndicator

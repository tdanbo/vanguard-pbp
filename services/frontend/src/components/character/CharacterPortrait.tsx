import { cn } from "@/lib/utils"

interface CharacterPortraitProps {
  src?: string | null
  name?: string | null
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeClasses = {
  sm: "w-12 h-15 text-sm",      // 48×60
  md: "w-20 h-[100px] text-lg",  // 80×100
  lg: "w-30 h-[150px] text-2xl", // 120×150
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "N" // Default for Narrator
  const words = name.trim().split(/\s+/)
  if (words.length === 0 || words[0].length === 0) {
    return "?"
  }
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase()
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

function getGradient(name: string | null | undefined): string {
  // Generate consistent gradient based on name
  const gradients = [
    "from-amber-900 to-amber-700",
    "from-emerald-900 to-emerald-700",
    "from-blue-900 to-blue-700",
    "from-purple-900 to-purple-700",
    "from-rose-900 to-rose-700",
    "from-cyan-900 to-cyan-700",
    "from-orange-900 to-orange-700",
    "from-indigo-900 to-indigo-700",
  ]
  const effectiveName = name || "Narrator"
  const hash = effectiveName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return gradients[hash % gradients.length]
}

export function CharacterPortrait({
  src,
  name,
  size = "md",
  className,
}: CharacterPortraitProps) {
  const displayName = name || "Narrator"
  const initials = getInitials(name)
  const gradient = getGradient(name)

  return (
    <div
      className={cn(
        "relative rounded-lg overflow-hidden border-2 border-border flex-shrink-0",
        sizeClasses[size],
        className
      )}
    >
      {src ? (
        <img
          src={src}
          alt={displayName}
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className={cn(
            "w-full h-full bg-gradient-to-br flex items-center justify-center font-display font-semibold text-white/90",
            gradient
          )}
        >
          {initials}
        </div>
      )}
    </div>
  )
}

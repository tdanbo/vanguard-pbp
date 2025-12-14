import { cn } from "@/lib/utils"

interface ManagementLayoutProps {
  children: React.ReactNode
  className?: string
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "6xl"
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
}

/**
 * ManagementLayout - Wrapper for management views (Campaign Dashboard, Settings)
 * Uses solid bg-background (no transparency), centered container with max width
 * This contrasts with immersive views (Scene View) which use transparent panels
 */
export function ManagementLayout({
  children,
  className,
  maxWidth = "4xl",
}: ManagementLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <div
        className={cn(
          "container mx-auto px-4 py-8 md:px-6 lg:px-8",
          maxWidthClasses[maxWidth],
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}

export default ManagementLayout

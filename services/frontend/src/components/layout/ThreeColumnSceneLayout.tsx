import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface ThreeColumnSceneLayoutProps {
  children: React.ReactNode
  leftSidebar: React.ReactNode
  rightSidebar: React.ReactNode
  backgroundImage?: string | null
  onBack?: () => void
  backLabel?: string
  menuContent?: React.ReactNode
}

export function ThreeColumnSceneLayout({
  children,
  leftSidebar,
  rightSidebar,
  backgroundImage,
  onBack,
  backLabel = 'Back',
  menuContent,
}: ThreeColumnSceneLayoutProps) {
  const navigate = useNavigate()

  const handleBack = onBack || (() => navigate(-1))

  return (
    <div className="min-h-screen relative bg-background">
      {/* Minimal chrome - floating buttons */}
      <div className="fixed top-4 left-4 right-4 z-50 flex justify-between pointer-events-none">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full bg-background/40 backdrop-blur-md border border-border/30 pointer-events-auto"
          onClick={handleBack}
          aria-label={backLabel}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        {menuContent && (
          <div className="pointer-events-auto">{menuContent}</div>
        )}
      </div>

      {/* 3-column layout container */}
      <div className="flex min-h-screen">
        {/* Left column - NPCs - hidden on mobile */}
        <aside className="hidden lg:flex w-1/4 flex-col items-center sticky top-0 h-screen pt-20 pb-4 overflow-y-auto">
          {leftSidebar}
        </aside>

        {/* Center column - main content with background */}
        <main className="flex-1 lg:w-1/2 relative">
          {/* Background image - full height of center column */}
          {backgroundImage && (
            <>
              <div className="absolute inset-0 z-0 overflow-hidden">
                <img
                  src={backgroundImage}
                  alt=""
                  className="w-full h-auto object-top -mt-32"
                />
              </div>
              {/* Gradient overlays for readability */}
              {/* Top vignette for header text */}
              <div className="absolute inset-0 z-[1] bg-gradient-to-b from-background/70 via-transparent via-30% to-transparent pointer-events-none" />
              {/* Bottom fade into background */}
              <div className="absolute inset-0 z-[1] bg-gradient-to-b from-transparent via-background/50 via-40% to-background pointer-events-none" />
            </>
          )}

          {/* Fallback atmosphere when no image */}
          {!backgroundImage && (
            <div className="absolute inset-0 z-0 scene-atmosphere" />
          )}

          {/* Content */}
          <div className="relative z-10">{children}</div>
        </main>

        {/* Right column - Party - hidden on mobile */}
        <aside className="hidden lg:flex w-1/4 flex-col items-center sticky top-0 h-screen pt-20 pb-4 overflow-y-auto">
          {rightSidebar}
        </aside>
      </div>
    </div>
  )
}

import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import { useNavigate } from "react-router-dom"

interface ImmersiveLayoutProps {
  children: React.ReactNode
  backgroundImage?: string | null
  onBack?: () => void
  backLabel?: string
  menuContent?: React.ReactNode
}

export function ImmersiveLayout({
  children,
  backgroundImage,
  onBack,
  backLabel = "Back",
  menuContent,
}: ImmersiveLayoutProps) {
  const navigate = useNavigate()

  const handleBack = onBack || (() => navigate(-1))

  return (
    <div className="min-h-screen relative">
      {/* Background layer */}
      <div className="fixed inset-0 -z-10">
        {backgroundImage ? (
          <>
            <img
              src={backgroundImage}
              alt=""
              className="w-full h-full object-cover object-top opacity-50"
            />
            {/* Gradient overlay to fade into background */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />
          </>
        ) : (
          <div className="w-full h-full scene-atmosphere" />
        )}
      </div>

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
          <div className="pointer-events-auto">
            {menuContent}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="relative">
        {children}
      </div>
    </div>
  )
}

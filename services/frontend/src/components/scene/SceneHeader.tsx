import { cn } from "@/lib/utils"

interface SceneHeaderProps {
  scene: {
    title: string
    description?: string | null
    header_image_url?: string | null
  }
  className?: string
}

export function SceneHeader({ scene, className }: SceneHeaderProps) {
  return (
    <div className={cn("relative", className)}>
      {/* Image or gradient background - shorter height */}
      <div className="h-48 md:h-56 relative">
        {scene.header_image_url ? (
          <>
            <img
              src={scene.header_image_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 scene-gradient" />
          </>
        ) : (
          <div className="absolute inset-0 scene-atmosphere" />
        )}

        {/* Title overlay - centered */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="text-center">
            <h1 className="scene-title text-white mb-2">
              {scene.title}
            </h1>
            {scene.description && (
              <p className="text-base md:text-lg text-gold italic max-w-xl mx-auto">
                {scene.description}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface SceneHeaderCompactProps {
  scene: {
    title: string
  }
}

export function SceneHeaderCompact({ scene }: SceneHeaderCompactProps) {
  return (
    <div className="bg-panel backdrop-blur-md border-b border-border/50 py-3 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="font-display text-xl font-semibold">{scene.title}</h1>
      </div>
    </div>
  )
}

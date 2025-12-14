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
      {/* Image or gradient background */}
      <div className="min-h-[40vh] relative">
        {scene.header_image_url ? (
          <>
            <img
              src={scene.header_image_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 scene-gradient" />
          </>
        ) : (
          <div className="absolute inset-0 scene-atmosphere" />
        )}

        {/* Title overlay - positioned at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="scene-title text-white mb-2">
              {scene.title}
            </h1>
            {scene.description && (
              <p className="text-lg text-white/80 max-w-2xl">
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
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display text-xl font-semibold">{scene.title}</h1>
      </div>
    </div>
  )
}

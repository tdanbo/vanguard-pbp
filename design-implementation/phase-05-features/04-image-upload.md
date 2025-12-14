# 5.4 Image Upload

**Skill**: `image-upload`

## Goal

Create image upload components for avatars, scene headers, and storage management.

---

## Design References

- [11-image-upload.md](../../product-design-system/11-image-upload.md) - Complete image upload specs

---

## Overview

Image upload components include:
- **AvatarUploader** - Square preview, upload, remove
- **SceneHeaderUploader** - 16:9 aspect, dashed empty state
- **StorageIndicator** - Usage bar with warning levels

---

## AvatarUploader Component

```tsx
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Upload, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface AvatarUploaderProps {
  currentUrl?: string | null
  onUpload: (file: File) => Promise<string>
  onRemove: () => Promise<void>
  size?: "sm" | "md" | "lg"
}

const sizeClasses = {
  sm: "w-16 h-16",
  md: "w-24 h-24",
  lg: "w-32 h-32",
}

export function AvatarUploader({
  currentUrl,
  onUpload,
  onRemove,
  size = "md",
}: AvatarUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Please upload PNG, JPG, or WebP")
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File must be under 20MB")
      return
    }

    setIsUploading(true)
    try {
      await onUpload(file)
    } finally {
      setIsUploading(false)
    }
  }

  async function handleRemove() {
    setIsRemoving(true)
    try {
      await onRemove()
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "relative rounded-lg border-2 border-dashed border-border overflow-hidden",
          sizeClasses[size],
          !currentUrl && "flex items-center justify-center bg-secondary"
        )}
      >
        {currentUrl ? (
          <>
            <img
              src={currentUrl}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
            {/* Remove button overlay */}
            <button
              onClick={handleRemove}
              disabled={isRemoving}
              className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground opacity-0 hover:opacity-100 transition-opacity"
            >
              {isRemoving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3 w-3" />
              )}
            </button>
          </>
        ) : (
          <Upload className="h-6 w-6 text-muted-foreground" />
        )}

        {/* Upload overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
      >
        {currentUrl ? "Change" : "Upload"}
      </Button>
    </div>
  )
}
```

---

## SceneHeaderUploader Component

```tsx
interface SceneHeaderUploaderProps {
  currentUrl?: string | null
  onUpload: (file: File) => Promise<string>
  onRemove: () => Promise<void>
}

export function SceneHeaderUploader({
  currentUrl,
  onUpload,
  onRemove,
}: SceneHeaderUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // ... similar file handling logic ...

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "relative aspect-video rounded-lg border-2 border-dashed border-border overflow-hidden",
          !currentUrl && "flex flex-col items-center justify-center bg-secondary"
        )}
      >
        {currentUrl ? (
          <>
            <img
              src={currentUrl}
              alt="Scene header"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => inputRef.current?.click()}
                >
                  Change
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleRemove}
                >
                  Remove
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Click to upload scene header
            </p>
            <p className="text-xs text-muted-foreground">
              16:9 aspect ratio recommended
            </p>
          </>
        )}

        {/* Click to upload */}
        {!currentUrl && (
          <button
            className="absolute inset-0"
            onClick={() => inputRef.current?.click()}
          />
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
```

---

## StorageIndicator Component

```tsx
interface StorageIndicatorProps {
  usedBytes: number
  totalBytes: number // 500MB = 524288000
}

export function StorageIndicator({
  usedBytes,
  totalBytes,
}: StorageIndicatorProps) {
  const percentage = (usedBytes / totalBytes) * 100
  const usedMB = (usedBytes / 1024 / 1024).toFixed(1)
  const totalMB = (totalBytes / 1024 / 1024).toFixed(0)

  // Warning levels
  const state =
    percentage >= 95
      ? "critical"
      : percentage >= 85
      ? "warning"
      : percentage >= 70
      ? "caution"
      : "normal"

  const colorClasses = {
    normal: "bg-gold",
    caution: "bg-yellow-500",
    warning: "bg-orange-500",
    critical: "bg-destructive",
  }[state]

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Storage</span>
        <span className={state !== "normal" ? "text-warning" : ""}>
          {usedMB} MB / {totalMB} MB
        </span>
      </div>

      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn("h-full transition-all", colorClasses)}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>

      {state === "critical" && (
        <p className="text-xs text-destructive">
          Storage almost full. Delete unused images to free space.
        </p>
      )}
      {state === "warning" && (
        <p className="text-xs text-warning">
          Storage is running low.
        </p>
      )}
    </div>
  )
}
```

---

## File Validation Helper

```tsx
interface ValidationResult {
  valid: boolean
  error?: string
}

export function validateImageFile(file: File): ValidationResult {
  const validTypes = ["image/png", "image/jpeg", "image/webp"]
  const maxSize = 20 * 1024 * 1024 // 20MB

  if (!validTypes.includes(file.type)) {
    return { valid: false, error: "Please upload PNG, JPG, or WebP" }
  }

  if (file.size > maxSize) {
    return { valid: false, error: "File must be under 20MB" }
  }

  return { valid: true }
}
```

---

## Success Criteria

- [ ] AvatarUploader shows preview and remove
- [ ] SceneHeaderUploader with aspect-video preview
- [ ] Dashed border empty state
- [ ] File validation for type and size
- [ ] StorageIndicator with warning levels
- [ ] Progress bar color changes at thresholds

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { apiUpload, apiDelete, APIError } from '@/lib/api'
import { Loader2, Upload, Trash2, ImageIcon, Check, X } from 'lucide-react'

interface SceneHeaderUploaderProps {
  campaignId: string
  sceneId: string
  currentUrl: string | null
  onUploadComplete?: (url: string) => void
  onDeleteComplete?: () => void
}

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export function SceneHeaderUploader({
  campaignId,
  sceneId,
  currentUrl,
  onUploadComplete,
  onDeleteComplete,
}: SceneHeaderUploaderProps) {
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [savedUrl, setSavedUrl] = useState<string | null>(currentUrl)
  // Pending file state - file selected but not yet uploaded
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPreview, setPendingPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Synchronous file selection - just validate and store locally
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset input value to allow re-selecting the same file
    e.target.value = ''

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'Maximum file size is 20MB.',
      })
      return
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Invalid format',
        description: 'Only PNG, JPG, and WebP images are allowed.',
      })
      return
    }

    // Clear previous pending preview
    if (pendingPreview) {
      URL.revokeObjectURL(pendingPreview)
    }

    // Store file and create preview
    setPendingFile(file)
    setPendingPreview(URL.createObjectURL(file))
  }

  // Cancel pending upload
  const handleCancel = () => {
    if (pendingPreview) {
      URL.revokeObjectURL(pendingPreview)
    }
    setPendingFile(null)
    setPendingPreview(null)
  }

  // Confirm and upload the pending file
  const handleConfirmUpload = async () => {
    if (!pendingFile) return

    setUploading(true)
    try {
      const result = await apiUpload<{ url: string }>(
        `/api/v1/campaigns/${campaignId}/scenes/${sceneId}/header`,
        pendingFile
      )

      // Clear pending state
      if (pendingPreview) {
        URL.revokeObjectURL(pendingPreview)
      }
      setPendingFile(null)
      setPendingPreview(null)

      // Update saved URL
      setSavedUrl(result.url)
      onUploadComplete?.(result.url)
      toast({ title: 'Scene header uploaded' })
    } catch (error) {
      if (error instanceof APIError) {
        if (error.code === 'STORAGE_LIMIT_REACHED') {
          toast({
            variant: 'destructive',
            title: 'Storage full',
            description: 'Campaign has reached the 500MB storage limit. Delete some images to free space.',
          })
        } else {
          toast({
            variant: 'destructive',
            title: 'Upload failed',
            description: error.message,
          })
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Upload failed',
          description: 'An unexpected error occurred.',
        })
      }
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!savedUrl) return

    setDeleting(true)
    try {
      await apiDelete(`/api/v1/campaigns/${campaignId}/scenes/${sceneId}/header`)
      setSavedUrl(null)
      onDeleteComplete?.()
      toast({ title: 'Scene header removed' })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to remove header',
        description: error instanceof Error ? error.message : 'An error occurred',
      })
    } finally {
      setDeleting(false)
    }
  }

  // Show pending preview if available, otherwise show saved URL
  const displayUrl = pendingPreview || savedUrl
  const hasPendingFile = pendingFile !== null

  return (
    <div className="space-y-4">
      {displayUrl ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
          <img
            src={displayUrl}
            alt="Scene header"
            className="h-full w-full object-cover"
          />
          {hasPendingFile && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="rounded bg-background/90 px-2 py-1 text-sm font-medium">
                Preview - Click Confirm to upload
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed bg-muted/50">
          <div className="text-center">
            <ImageIcon className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">No header image</p>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileSelect}
        disabled={uploading || deleting}
        className="hidden"
      />

      <div className="flex gap-2">
        {hasPendingFile ? (
          // Show confirm/cancel buttons when there's a pending file
          <>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleConfirmUpload}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Confirm Upload
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={uploading}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </>
        ) : (
          // Show upload/change/remove buttons when no pending file
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || deleting}
            >
              <Upload className="mr-2 h-4 w-4" />
              {savedUrl ? 'Change Header' : 'Upload Header'}
            </Button>

            {savedUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={uploading || deleting}
              >
                {deleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </>
                )}
              </Button>
            )}
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        16:9 aspect ratio recommended. Max 20MB. PNG, JPG, or WebP only.
      </p>
    </div>
  )
}

export default SceneHeaderUploader

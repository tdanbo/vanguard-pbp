import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import { apiUpload, apiDelete, APIError } from '@/lib/api'
import { Loader2, Upload, Trash2 } from 'lucide-react'

interface AvatarUploaderProps {
  campaignId: string
  characterId: string
  currentUrl: string | null
  displayName: string
  onUploadComplete?: (url: string) => void
  onDeleteComplete?: () => void
}

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export function AvatarUploader({
  campaignId,
  characterId,
  currentUrl,
  displayName,
  onUploadComplete,
  onDeleteComplete,
}: AvatarUploaderProps) {
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentUrl)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setUploading(true)
    try {
      const result = await apiUpload<{ url: string }>(
        `/api/v1/campaigns/${campaignId}/characters/${characterId}/avatar`,
        file
      )

      setPreview(result.url)
      onUploadComplete?.(result.url)
      toast({ title: 'Avatar uploaded' })
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
    if (!preview) return

    setDeleting(true)
    try {
      await apiDelete(`/api/v1/campaigns/${campaignId}/characters/${characterId}/avatar`)
      setPreview(null)
      onDeleteComplete?.()
      toast({ title: 'Avatar removed' })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to remove avatar',
        description: error instanceof Error ? error.message : 'An error occurred',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src={preview || undefined} alt={displayName} />
          <AvatarFallback className="text-2xl">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-col gap-2">
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileSelect}
            disabled={uploading || deleting}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || deleting}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Avatar
              </>
            )}
          </Button>

          {preview && (
            <Button
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
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Square images recommended. Max 20MB. PNG, JPG, or WebP only.
      </p>
    </div>
  )
}

export default AvatarUploader

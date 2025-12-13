# Image Upload System

## Overview

GM-only image uploads for avatars (square) and scene headers (16:9). Storage tracked per campaign with 500MB limit.

## PRD References

- [Settings](/home/tobiasd/github/vanguard-pbp/prd/settings.md) - Image constraints, storage limits

## Storage Organization

```
/campaigns/{campaign_id}/
  /avatars/{character_id}.{ext}
  /scenes/{scene_id}.{ext}
```

## Backend Service

```go
// internal/service/image.go
const (
    MaxFileSize = 20 * 1024 * 1024  // 20MB
    MaxDimension = 4000
    StorageLimit = 500 * 1024 * 1024  // 500MB per campaign
)

func (s *ImageService) UploadAvatar(ctx context.Context, campaignID, characterID, gmUserID uuid.UUID, file multipart.File, header *multipart.FileHeader) (string, error) {
    // Verify GM
    campaign, err := s.queries.GetCampaign(ctx, campaignID)
    if err != nil {
        return "", err
    }
    if !campaign.OwnerID.Valid || campaign.OwnerID.UUID != gmUserID {
        return "", ErrNotGM
    }

    // Check file size
    if header.Size > MaxFileSize {
        return "", errors.New("file too large (max 20MB)")
    }

    // Check campaign storage
    if campaign.StorageUsedBytes + header.Size > StorageLimit {
        return "", errors.New("campaign storage limit reached (500MB)")
    }

    // Decode image
    img, format, err := image.Decode(file)
    if err != nil {
        return "", errors.New("invalid image format")
    }

    // Check dimensions
    bounds := img.Bounds()
    if bounds.Dx() > MaxDimension || bounds.Dy() > MaxDimension {
        return "", errors.New("image too large (max 4000x4000px)")
    }

    // Validate format
    if format != "png" && format != "jpeg" && format != "webp" {
        return "", errors.New("unsupported format (use PNG, JPG, or WebP)")
    }

    // Upload to Supabase Storage
    path := fmt.Sprintf("campaigns/%s/avatars/%s.%s", campaignID, characterID, format)
    url, err := s.storage.Upload(path, file, header.Header.Get("Content-Type"))
    if err != nil {
        return "", err
    }

    // Update character avatar_url
    err = s.queries.UpdateCharacterAvatar(ctx, generated.UpdateCharacterAvatarParams{
        ID:        characterID,
        AvatarUrl: sql.NullString{String: url, Valid: true},
    })
    if err != nil {
        return "", err
    }

    // Update campaign storage
    err = s.queries.IncrementCampaignStorage(ctx, generated.IncrementCampaignStorageParams{
        ID:    campaignID,
        Bytes: header.Size,
    })
    if err != nil {
        return "", err
    }

    return url, nil
}
```

## Frontend Component

```tsx
// components/image/ImageUploader.tsx
export function AvatarUploader({ campaignId, characterId, currentUrl }: AvatarUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: 'Error', description: 'File too large (max 20MB)', variant: 'destructive' });
      return;
    }

    // Validate format
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast({ title: 'Error', description: 'Unsupported format', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const result = await api.post(
        `/api/campaigns/${campaignId}/characters/${characterId}/avatar`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      setPreview(result.url);
      toast({ title: 'Success', description: 'Avatar uploaded successfully' });
    } catch (error: any) {
      if (error.response?.data?.error?.code === 'STORAGE_LIMIT_REACHED') {
        toast({
          title: 'Storage Full',
          description: 'Campaign has reached 500MB storage limit. Delete scenes to free space.',
          variant: 'destructive'
        });
      } else {
        toast({ title: 'Error', description: 'Upload failed', variant: 'destructive' });
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Avatar className="h-24 w-24">
        <AvatarImage src={preview || undefined} />
        <AvatarFallback>?</AvatarFallback>
      </Avatar>

      <Input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleUpload}
        disabled={uploading}
      />

      <p className="text-sm text-muted-foreground">
        Square aspect ratio recommended. Max 20MB, 4000x4000px.
        PNG, JPG, or WebP only.
      </p>
    </div>
  );
}
```

## Storage Warnings

```go
func (s *ImageService) GetStorageStatus(ctx context.Context, campaignID uuid.UUID) (*StorageStatus, error) {
    campaign, err := s.queries.GetCampaign(ctx, campaignID)
    if err != nil {
        return nil, err
    }

    usedBytes := campaign.StorageUsedBytes
    limitBytes := int64(StorageLimit)
    percentage := float64(usedBytes) / float64(limitBytes) * 100

    status := &StorageStatus{
        UsedBytes:   usedBytes,
        LimitBytes:  limitBytes,
        Percentage:  percentage,
        WarningLevel: "",
    }

    if percentage >= 95 {
        status.WarningLevel = "critical"
    } else if percentage >= 90 {
        status.WarningLevel = "high"
    } else if percentage >= 80 {
        status.WarningLevel = "medium"
    }

    return status, nil
}
```

## Edge Cases

- **Storage Quota**: Uploads blocked at 500MB. GM must delete scenes to free space.
- **Large Images**: Images >4000px rejected client-side and server-side.
- **Format Validation**: Only PNG, JPG, WebP allowed. GIF, SVG rejected.
- **Concurrent Uploads**: Last upload wins. No versioning.

## Testing

- [ ] Upload avatar as GM (square crop)
- [ ] Upload scene header as GM (16:9 crop)
- [ ] Block upload as non-GM
- [ ] Block upload >20MB
- [ ] Block upload >4000x4000px
- [ ] Block unsupported formats
- [ ] Storage quota enforced at 500MB
- [ ] Warnings at 80%, 90%, 95%
- [ ] Delete scene frees storage

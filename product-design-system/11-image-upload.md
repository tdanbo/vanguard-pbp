# Image Upload

This document defines the UI patterns for image upload functionality in Vanguard PBP.

**Related Components**:
- `src/components/image/AvatarUploader.tsx` - Character avatar upload
- `src/components/image/SceneHeaderUploader.tsx` - Scene header image upload
- `src/components/image/StorageIndicator.tsx` - Campaign storage usage display

---

## Design Principles

1. **Clear Constraints** - Show file limits before upload attempts
2. **Immediate Feedback** - Progress and success/error states
3. **Reversible Actions** - Easy to remove/replace uploaded images
4. **Storage Awareness** - Users understand campaign storage limits

---

## File Constraints

| Constraint | Value |
|------------|-------|
| Maximum file size | 20MB |
| Allowed formats | PNG, JPG, WebP |
| Campaign storage limit | 500MB |

---

## Avatar Uploader

For character profile images.

### Layout

```
┌──────────────────────────────────────┐
│ ┌────────┐  ┌──────────────────────┐ │
│ │        │  │ [Upload Avatar]      │ │
│ │   DV   │  ├──────────────────────┤ │
│ │        │  │ [Remove]             │ │
│ └────────┘  └──────────────────────┘ │
│                                      │
│ Square images recommended. Max 20MB. │
│ PNG, JPG, or WebP only.              │
└──────────────────────────────────────┘
```

### Component Structure

```tsx
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
        className="hidden"
      />
      <Button variant="outline" size="sm">
        <Upload className="mr-2 h-4 w-4" />
        Upload Avatar
      </Button>

      {hasAvatar && (
        <Button variant="outline" size="sm">
          <Trash2 className="mr-2 h-4 w-4" />
          Remove
        </Button>
      )}
    </div>
  </div>

  <p className="text-xs text-muted-foreground">
    Square images recommended. Max 20MB. PNG, JPG, or WebP only.
  </p>
</div>
```

### Avatar Size

| Context | Size | Class |
|---------|------|-------|
| Uploader preview | 80x80px | `h-20 w-20` |
| Post display | 40x40px | `h-10 w-10` |
| Inline mention | 24x24px | `h-6 w-6` |

### Fallback Display

When no avatar is uploaded, show character initial:

```tsx
<AvatarFallback className="text-2xl">
  {displayName.charAt(0).toUpperCase()}
</AvatarFallback>
```

---

## Scene Header Uploader

For scene header/banner images.

### With Image

```
┌──────────────────────────────────────────────┐
│ ┌──────────────────────────────────────────┐ │
│ │                                          │ │
│ │          [Scene Header Image]            │ │
│ │              16:9 aspect                 │ │
│ │                                          │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ [Change Header] [Remove]                     │
│                                              │
│ 16:9 aspect ratio recommended. Max 20MB.     │
│ PNG, JPG, or WebP only.                      │
└──────────────────────────────────────────────┘
```

### Empty State

```
┌──────────────────────────────────────────────┐
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│                                              │
│ │             [Image Icon]                 │ │
│              No header image                 │
│ │                                          │ │
│                                              │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│                                              │
│ [Upload Header]                              │
│                                              │
│ 16:9 aspect ratio recommended. Max 20MB.     │
│ PNG, JPG, or WebP only.                      │
└──────────────────────────────────────────────┘
```

### Component Structure

```tsx
<div className="space-y-4">
  {preview ? (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
      <img
        src={preview}
        alt="Scene header"
        className="h-full w-full object-cover"
      />
    </div>
  ) : (
    <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed bg-muted/50">
      <div className="text-center">
        <ImageIcon className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">No header image</p>
      </div>
    </div>
  )}

  <div className="flex gap-2">
    <Input type="file" className="hidden" />
    <Button variant="outline" size="sm">
      <Upload className="mr-2 h-4 w-4" />
      {preview ? 'Change Header' : 'Upload Header'}
    </Button>

    {preview && (
      <Button variant="outline" size="sm">
        <Trash2 className="mr-2 h-4 w-4" />
        Remove
      </Button>
    )}
  </div>

  <p className="text-xs text-muted-foreground">
    16:9 aspect ratio recommended. Max 20MB. PNG, JPG, or WebP only.
  </p>
</div>
```

### Empty State Styling

```tsx
<div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed bg-muted/50">
  <div className="text-center">
    <ImageIcon className="mx-auto h-10 w-10 text-muted-foreground" />
    <p className="mt-2 text-sm text-muted-foreground">No header image</p>
  </div>
</div>
```

Key styles:
- `aspect-video` - 16:9 aspect ratio
- `border-dashed` - Dashed border for empty state
- `bg-muted/50` - Semi-transparent muted background

---

## Storage Indicator

Shows campaign storage usage with warning states.

### Layout

```
┌──────────────────────────────────────────────┐
│ [!] Storage Almost Full                      │
│ Campaign storage is nearly full. Delete some │
│ images to continue uploading.                │
├──────────────────────────────────────────────┤
│ [HDD] ████████████████░░░░  425.2 MB / 500 MB│
└──────────────────────────────────────────────┘
```

### Warning Levels

| Level | Threshold | Progress Color | Alert |
|-------|-----------|----------------|-------|
| None | < 70% | Default (primary) | None |
| `medium` | 70-84% | `bg-yellow-500` | Info warning |
| `high` | 85-94% | `bg-orange-500` | Warning |
| `critical` | 95%+ | `bg-destructive` | Destructive alert |

### Component Structure

```tsx
<div className={className}>
  {status.warningLevel && (
    <Alert variant={status.warningLevel === 'critical' ? 'destructive' : 'default'} className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        Storage {status.warningLevel === 'critical' ? 'Almost Full' : 'Warning'}
      </AlertTitle>
      <AlertDescription>
        {getWarningMessage(status.warningLevel)}
      </AlertDescription>
    </Alert>
  )}

  <div className="flex items-center gap-3 text-sm">
    <HardDrive className="h-4 w-4 text-muted-foreground" />
    <div className="flex-1">
      <Progress value={status.percentage} className={`h-2 ${getProgressColor()}`} />
    </div>
    <span className="text-muted-foreground whitespace-nowrap">
      {formatBytes(status.usedBytes)} / {formatBytes(status.limitBytes)}
    </span>
  </div>
</div>
```

### Warning Messages

| Level | Title | Message |
|-------|-------|---------|
| `medium` | "Storage Warning" | "Campaign storage is filling up." |
| `high` | "Storage Warning" | "Campaign storage is running low. Consider removing unused images." |
| `critical` | "Storage Almost Full" | "Campaign storage is nearly full. Delete some images to continue uploading." |

### Progress Bar Colors

```tsx
const getProgressColor = () => {
  switch (status.warningLevel) {
    case 'critical':
      return 'bg-destructive'
    case 'high':
      return 'bg-orange-500'
    case 'medium':
      return 'bg-yellow-500'
    default:
      return '' // Uses default primary color
  }
}
```

---

## Loading States

### Upload in Progress

```tsx
<Button variant="outline" size="sm" disabled>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Uploading...
</Button>
```

### Delete in Progress

```tsx
<Button variant="outline" size="sm" disabled>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Removing...
</Button>
```

---

## Error States

### Validation Errors

Shown immediately on file selection:

```tsx
// File too large
toast({
  variant: 'destructive',
  title: 'File too large',
  description: 'Maximum file size is 20MB.',
})

// Invalid format
toast({
  variant: 'destructive',
  title: 'Invalid format',
  description: 'Only PNG, JPG, and WebP images are allowed.',
})
```

### Storage Limit Error

```tsx
toast({
  variant: 'destructive',
  title: 'Storage full',
  description: 'Campaign has reached the 500MB storage limit. Delete some images to free space.',
})
```

### Upload Failed

```tsx
toast({
  variant: 'destructive',
  title: 'Upload failed',
  description: error.message,
})
```

### Delete Failed

```tsx
toast({
  variant: 'destructive',
  title: 'Failed to remove avatar',
  description: error.message,
})
```

---

## Success States

### Upload Success

```tsx
toast({ title: 'Avatar uploaded' })
// or
toast({ title: 'Scene header uploaded' })
```

### Delete Success

```tsx
toast({ title: 'Avatar removed' })
// or
toast({ title: 'Scene header removed' })
```

---

## Icons

| Icon | Usage |
|------|-------|
| `Upload` | Upload button |
| `Trash2` | Remove/delete button |
| `ImageIcon` | Empty state placeholder |
| `Loader2` | Loading spinner (with `animate-spin`) |
| `HardDrive` | Storage indicator |
| `AlertTriangle` | Storage warning |

---

## Aspect Ratios

| Image Type | Aspect Ratio | Tailwind Class |
|------------|--------------|----------------|
| Avatar | 1:1 (square) | Fixed `h-20 w-20` |
| Scene header | 16:9 | `aspect-video` |

---

## Hidden File Input Pattern

File inputs are hidden and triggered via button click:

```tsx
const fileInputRef = useRef<HTMLInputElement>(null)

<Input
  ref={fileInputRef}
  type="file"
  accept="image/png,image/jpeg,image/webp"
  onChange={handleFileSelect}
  className="hidden"
/>

<Button onClick={() => fileInputRef.current?.click()}>
  Upload
</Button>
```

---

## Accessibility

- Buttons have descriptive text ("Upload Avatar", not just "Upload")
- Loading states disable buttons to prevent double-submission
- Error messages are shown via toast for screen reader announcement
- File input accept attribute restricts file picker to valid types

---

## Integration Notes

### Storage Check Before Upload

The storage indicator should be displayed in campaign settings alongside image upload sections. When storage is at warning levels, users should see the alert before attempting uploads.

### Consistent Validation

Both avatar and scene header uploaders share the same constraints:
- 20MB max file size
- PNG, JPG, WebP only
- Same error message patterns

### Bucket Organization

Images are stored in Supabase Storage:
- Avatars: `avatars/{campaign_id}/{character_id}`
- Scene headers: `scene-headers/{campaign_id}/{scene_id}`

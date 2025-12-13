---
name: image-upload
description: Image upload and storage management for the Vanguard PBP system. Use this skill when implementing or debugging GM image uploads, avatar constraints, scene header images, storage bucket organization, campaign storage limits (500MB), file validation (size, dimensions, types), or image deletion/cleanup workflows.
---

# Image Upload

## Overview

This skill provides patterns and implementation guidance for the Vanguard PBP image upload system, which handles avatar images, scene header images, and campaign storage management. All image uploads are GM-only operations with strict validation rules to prevent abuse and maintain performance.

## Reference

### Upload Restrictions

**GM-Only Access:**
- Players cannot upload images directly
- All image uploads require GM role verification
- Image assignment happens during character/scene creation or editing
- Validation occurs at both frontend UI and backend API layers

**Use Cases:**
- Character avatars (GM uploads for PCs and NPCs)
- Scene header images (16:9 aspect ratio)
- Default images provided when no custom upload exists

### File Validation Rules

**Size Constraints:**
- Maximum file size: 20 MB per upload
- Campaign storage limit: 500 MB total (all images combined)
- Storage tracking via `Campaign.storageUsedBytes` field
- Reject uploads that would exceed campaign limit

**Dimension Constraints:**
- Maximum dimensions: 4000x4000 pixels
- Avatar images: square aspect ratio (cropped via UI)
- Scene headers: 16:9 aspect ratio (cropped via UI)
- Validation enforced server-side to prevent frontend bypass

**File Type Validation:**
- Allowed formats: PNG, JPG/JPEG, WebP only
- MIME type validation required
- File extension verification
- Reject all other formats (GIF, SVG, TIFF, etc.)

### Storage Bucket Organization

**Bucket Structure:**
```
campaigns/{campaignId}/avatars/{characterId}.{ext}
campaigns/{campaignId}/scenes/{sceneId}.{ext}
```

**Access Control:**
- Supabase Storage with row-level security
- Public read access for all campaign members
- Write access restricted to GM role
- Automatic URL generation on upload success

**Storage URL Format:**
```
https://{supabase-url}/storage/v1/object/public/campaigns/{campaignId}/{type}/{id}.{ext}
```

### Campaign Storage Limits

**Tracking:**
- `Campaign.storageUsedBytes` field maintains running total
- Updated atomically on upload and deletion
- Warning thresholds: 400MB (80%), 450MB (90%), 475MB (95%)
- Hard limit: 500 MB (reject new uploads)

**Enforcement:**
- Validate before upload: `currentBytes + uploadBytes <= 500MB`
- Return error with current usage if limit exceeded
- Recommend image deletion or compression to GM
- No automatic compression server-side (stored as-is)

**Error Response:**
```json
{
  "error": {
    "code": "STORAGE_LIMIT_EXCEEDED",
    "message": "Campaign storage limit reached (500MB). Delete unused images to upload new ones.",
    "timestamp": "2025-12-13T10:30:00Z",
    "requestId": "req_abc123def456",
    "metadata": {
      "currentUsage": 495000000,
      "attemptedUpload": 15000000,
      "limit": 524288000
    }
  }
}
```

### Image Deletion and Cleanup

**Manual Deletion:**
- GM can delete any image via character/scene edit modal
- Deletion frees storage immediately
- Update `Campaign.storageUsedBytes` atomically
- Remove file from Supabase Storage bucket

**Automatic Cleanup:**
- When character is archived: avatar remains (not deleted)
- When scene is deleted: header image deleted, storage freed
- When campaign is deleted: entire bucket deleted (all images)
- Orphaned files detected via periodic cleanup job (if implemented)

**Cleanup Workflow:**
1. Identify image to delete (character avatar, scene header)
2. Retrieve file size from storage metadata
3. Delete file from Supabase Storage
4. Decrement `Campaign.storageUsedBytes` by file size
5. Update character/scene record to clear image URL

### Upload Error Handling

**Validation Failures:**
- File too large (>20MB): "Image must be under 20MB"
- Dimensions too large (>4000x4000): "Image dimensions must be under 4000x4000 pixels"
- Invalid file type: "Only PNG, JPG, and WebP images are allowed"
- Storage limit exceeded: "Campaign storage limit reached (500MB)"

**Upload Failures:**
- Network timeout: Retry with exponential backoff
- Supabase Storage error: Log error, return user-friendly message
- Transaction failure: Rollback storage and database changes
- Concurrent uploads: Handle via optimistic locking on `storageUsedBytes`

**Error Handling Pattern:**
```typescript
async function uploadImage(file: File, campaignId: string): Promise<string> {
  // 1. Validate file type, size, dimensions
  if (file.size > 20_000_000) {
    throw new Error("Image must be under 20MB");
  }

  // 2. Check campaign storage limit
  const campaign = await getCampaign(campaignId);
  if (campaign.storageUsedBytes + file.size > 500_000_000) {
    throw new Error("Campaign storage limit reached (500MB)");
  }

  // 3. Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('campaigns')
    .upload(`${campaignId}/avatars/${characterId}.${ext}`, file);

  if (error) {
    throw new Error("Failed to upload image. Please try again.");
  }

  // 4. Update campaign storage tracking
  await updateCampaignStorage(campaignId, campaign.storageUsedBytes + file.size);

  // 5. Return public URL
  return data.path;
}
```

## Guidelines

### Image Upload API Endpoints

**Upload Avatar:**
```
POST /api/characters/:id/avatar
Content-Type: multipart/form-data

Body:
- file: image file (PNG/JPG/WebP, max 20MB)

Response:
{
  "avatarUrl": "https://.../{characterId}.png",
  "storageUsed": 145000000  // Updated campaign total
}
```

**Upload Scene Header:**
```
POST /api/scenes/:id/header
Content-Type: multipart/form-data

Body:
- file: image file (PNG/JPG/WebP, max 20MB)

Response:
{
  "headerImageUrl": "https://.../{sceneId}.jpg",
  "storageUsed": 160000000
}
```

**Delete Image:**
```
DELETE /api/characters/:id/avatar
DELETE /api/scenes/:id/header

Response:
{
  "success": true,
  "storageUsed": 130000000  // Updated total after deletion
}
```

### Frontend Upload Flow

**Character Avatar Upload:**
1. GM opens character edit modal
2. Clicks avatar upload button
3. File picker opens (accept: .png,.jpg,.jpeg,.webp)
4. UI validates file size and type before upload
5. Image cropper modal (square aspect ratio)
6. GM confirms crop → upload to API
7. Display upload progress indicator
8. On success: update character avatar in UI
9. On failure: show inline error message

**Scene Header Upload:**
1. GM opens scene edit modal
2. Clicks header image upload button
3. File picker opens (accept: .png,.jpg,.jpeg,.webp)
4. UI validates file size and type before upload
5. Image cropper modal (16:9 aspect ratio)
6. GM confirms crop → upload to API
7. Display upload progress indicator
8. On success: update scene header in UI
9. On failure: show inline error message

### Default Images

**Avatars:**
- Default avatar URL: `/assets/default-avatar.png`
- Used when `Character.avatarUrl` is null
- Same default for PCs and NPCs (generic silhouette)

**Scene Headers:**
- Default header URL: `/assets/default-scene-header.png`
- Used when `Scene.headerImageUrl` is null
- Generic fantasy/adventure themed image

**Implementation:**
```typescript
function getAvatarUrl(character: Character): string {
  return character.avatarUrl ?? '/assets/default-avatar.png';
}

function getSceneHeaderUrl(scene: Scene): string {
  return scene.headerImageUrl ?? '/assets/default-scene-header.png';
}
```

### Storage Monitoring

**Campaign Storage Dashboard (GM View):**
- Display current storage usage: "145 MB / 500 MB used"
- Progress bar with color thresholds:
  - Green: 0-80% (0-400MB)
  - Yellow: 80-95% (400-475MB)
  - Red: 95-100% (475-500MB)
- List of uploaded images with size and delete buttons
- Sort by size (largest first) to help GM identify cleanup targets

**Warning Notifications:**
- 80% (400MB): "Campaign storage is 80% full. Consider deleting unused images."
- 90% (450MB): "Campaign storage is 90% full. Delete images to free space."
- 95% (475MB): "Campaign storage is 95% full. You're approaching the 500MB limit."
- 100% (500MB): "Campaign storage limit reached. Delete images before uploading new ones."

### Rate Limiting

Image uploads follow standard rate limiting rules from technical.md:

- Image Upload: 5 req/min, burst 2 (resource-heavy operations)
- Prevents rapid upload abuse
- Returns 429 status with standard error format

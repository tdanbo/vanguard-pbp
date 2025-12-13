---
name: supabase-integration
description: Supabase integration patterns for the Vanguard PBP system. Use this skill when implementing or debugging authentication (JWT, session management), Row-Level Security policies, real-time subscriptions, Storage integration (avatars, scene headers), or type generation from database schema. Critical for auth flows, visibility filtering, live updates, and frontend-backend type safety.
---

# Supabase Integration

## Overview

This skill provides patterns and implementation guidance for integrating Supabase as the backend-as-a-service for Vanguard PBP. Supabase provides PostgreSQL hosting, authentication, real-time subscriptions, storage for images, and auto-generated REST APIs. This skill covers auth patterns, RLS policy implementation, real-time event subscriptions, storage configuration, and type generation workflows.

## Core Capabilities

### 1. Authentication and Session Management

Supabase Auth handles all user authentication with JWT tokens and sliding window sessions.

> **API Key Migration Note**: Supabase has transitioned to new API keys (late 2024). Legacy keys (`anon`, `service_role`) work until late 2026, but new projects should use the new key format (`sb_publishable_...`, `sb_secret_...`). JWT verification now uses JWKS (asymmetric) instead of shared secrets.

#### Auth Configuration

```typescript
// frontend/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// Use VITE_SUPABASE_PUBLISHABLE_KEY (new) or VITE_SUPABASE_ANON_KEY (legacy)
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce' // Use PKCE flow for security
  }
});
```

#### Session Lifecycle

**Sliding Window Sessions:**
- Sessions automatically refresh when the user is active
- Default expiration: ~30 days
- Auto-refresh triggers when >50% of session time has elapsed
- Multiple sessions allowed (users can be logged in on multiple devices)

**Email Verification:**
```typescript
// Registration requires email verification
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password',
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`
  }
});

// Users cannot access the app until email is verified
// Supabase handles verification link generation and email delivery
```

#### JWT Validation (Backend)

JWT verification uses JWKS (JSON Web Key Set) for asymmetric key validation. This is more secure than shared secrets and automatically handles key rotation.

```go
// backend/internal/middleware/auth.go
package middleware

import (
    "context"
    "errors"
    "net/http"
    "strings"
    "time"

    "github.com/MicahParks/keyfunc/v2"
    "github.com/gin-gonic/gin"
    "github.com/golang-jwt/jwt/v5"
)

// JWKS holds the cached JSON Web Key Set for JWT validation
type JWKS struct {
    keyFunc *keyfunc.JWKS
}

// NewJWKS creates a new JWKS validator from a Supabase project URL
// JWKS URL format: https://[PROJECT_REF].supabase.co/auth/v1/.well-known/jwks.json
func NewJWKS(jwksURL string) (*JWKS, error) {
    kf, err := keyfunc.Get(jwksURL, keyfunc.Options{
        RefreshInterval:   time.Hour,      // Refresh keys every hour
        RefreshRateLimit:  time.Minute * 5, // Rate limit refresh attempts
        RefreshTimeout:    time.Second * 10,
        RefreshUnknownKID: true,           // Refresh if unknown key ID encountered
    })
    if err != nil {
        return nil, err
    }
    return &JWKS{keyFunc: kf}, nil
}

// Close shuts down the JWKS background refresh
func (j *JWKS) Close() {
    j.keyFunc.EndBackground()
}

// Claims represents the JWT claims from Supabase Auth
type Claims struct {
    jwt.RegisteredClaims
    Email         string `json:"email"`
    EmailVerified bool   `json:"email_verified"`
    Role          string `json:"role"`
}

// AuthMiddleware validates JWTs using JWKS
func AuthMiddleware(jwks *JWKS) gin.HandlerFunc {
    return func(c *gin.Context) {
        authHeader := c.GetHeader("Authorization")
        if authHeader == "" {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing authorization header"})
            c.Abort()
            return
        }

        tokenString := strings.TrimPrefix(authHeader, "Bearer ")

        // Parse and validate JWT using JWKS
        token, err := jwt.ParseWithClaims(tokenString, &Claims{}, jwks.keyFunc.Keyfunc)
        if err != nil {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
            c.Abort()
            return
        }

        claims, ok := token.Claims.(*Claims)
        if !ok || !token.Valid {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
            c.Abort()
            return
        }

        // Add user ID to context (Subject contains the user UUID)
        c.Set("user_id", claims.Subject)
        c.Set("user_email", claims.Email)
        c.Next()
    }
}
```

**Initialization in main.go:**

```go
// Initialize JWKS validator
jwksURL := os.Getenv("SUPABASE_JWKS_URL") // https://[PROJECT_REF].supabase.co/auth/v1/.well-known/jwks.json
jwks, err := middleware.NewJWKS(jwksURL)
if err != nil {
    log.Fatalf("Failed to initialize JWKS: %v", err)
}
defer jwks.Close()

// Apply middleware
api := router.Group("/api/v1")
api.Use(middleware.AuthMiddleware(jwks))
```

#### OAuth Providers

```typescript
// Google OAuth
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    scopes: 'email' // Email required for all accounts
  }
});

// Discord OAuth
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'discord',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    scopes: 'email identify'
  }
});
```

### 2. Row-Level Security (RLS) Policies

RLS policies enforce visibility rules at the database layer, ensuring users only see data they're authorized to access.

#### User Visibility (Anonymous System)

No usernames exist in the system. Players are anonymous to each other.

```sql
-- migrations/20250101000001_users_rls.sql

-- Users can only see their own user record
CREATE POLICY "Users can view own profile"
ON public.users
FOR SELECT
USING (auth.uid() = id);

-- Users can update their own settings
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
USING (auth.uid() = id);
```

#### Campaign Membership Policies

```sql
-- migrations/20250101000002_campaigns_rls.sql

-- Users can view campaigns they're members of
CREATE POLICY "Members can view campaign"
ON public.campaigns
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM campaign_members
    WHERE campaign_members.campaign_id = campaigns.id
    AND campaign_members.user_id = auth.uid()
  )
);

-- Only GMs can update campaign settings
CREATE POLICY "GMs can update campaign"
ON public.campaigns
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM campaign_members
    WHERE campaign_members.campaign_id = campaigns.id
    AND campaign_members.user_id = auth.uid()
    AND campaign_members.role = 'gm'
  )
);
```

#### Witness Visibility (Fog of War)

Posts are filtered by witness rules to implement fog of war.

```sql
-- migrations/20250101000003_posts_rls.sql

-- Users can only see posts where one of their characters is a witness
CREATE POLICY "Users see witnessed posts"
ON public.posts
FOR SELECT
USING (
  -- Post is submitted (not a draft)
  submitted = true
  AND
  -- At least one of the user's characters is a witness
  EXISTS (
    SELECT 1 FROM character_assignments
    WHERE character_assignments.user_id = auth.uid()
    AND character_assignments.character_id = ANY(posts.witnesses)
  )
  OR
  -- OR user is the GM (GMs see everything)
  EXISTS (
    SELECT 1 FROM campaign_members
    JOIN scenes ON scenes.id = posts.scene_id
    WHERE campaign_members.campaign_id = scenes.campaign_id
    AND campaign_members.user_id = auth.uid()
    AND campaign_members.role = 'gm'
  )
);
```

#### Draft Visibility

Drafts are only visible to the user who created them.

```sql
-- Drafts visible only to creator
CREATE POLICY "Users see own drafts"
ON public.posts
FOR SELECT
USING (
  submitted = false
  AND user_id = auth.uid()
);

CREATE POLICY "Users can create drafts"
ON public.posts
FOR INSERT
WITH CHECK (
  submitted = false
  AND user_id = auth.uid()
);
```

#### Storage Policies (Images)

Avatar and scene header images are stored in Supabase Storage with access control.

```sql
-- migrations/20250101000004_storage_policies.sql

-- GM-only upload policy
CREATE POLICY "GMs can upload images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'campaign-images'
  AND
  EXISTS (
    SELECT 1 FROM campaign_members
    WHERE campaign_members.user_id = auth.uid()
    AND campaign_members.role = 'gm'
  )
);

-- Members can view images from their campaigns
CREATE POLICY "Members can view campaign images"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'campaign-images'
  AND
  EXISTS (
    SELECT 1 FROM campaign_members
    JOIN campaigns ON campaigns.id::text = (storage.foldername(objects.name))[1]
    WHERE campaign_members.user_id = auth.uid()
    AND campaign_members.campaign_id = campaigns.id
  )
);
```

### 3. Real-Time Subscriptions

Supabase Real-Time provides WebSocket subscriptions for live updates. No separate WebSocket hub needed.

#### Client Subscription Patterns

**Subscribe to Campaign Updates:**
```typescript
// frontend/src/hooks/use-campaign-realtime.ts
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCampaignStore } from '@/stores/campaign-store';

export function useCampaignRealtime(campaignId: string) {
  const updateCampaign = useCampaignStore(state => state.updateCampaign);

  useEffect(() => {
    const channel = supabase
      .channel(`campaign:${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'campaigns',
          filter: `id=eq.${campaignId}`
        },
        (payload) => {
          updateCampaign(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);
}
```

**Subscribe to Scene Posts:**
```typescript
// frontend/src/hooks/use-scene-realtime.ts
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useSceneStore } from '@/stores/scene-store';

export function useSceneRealtime(sceneId: string) {
  const addPost = useSceneStore(state => state.addPost);
  const updatePost = useSceneStore(state => state.updatePost);
  const removePost = useSceneStore(state => state.removePost);

  useEffect(() => {
    const channel = supabase
      .channel(`scene:${sceneId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
          filter: `scene_id=eq.${sceneId}`
        },
        (payload) => {
          addPost(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'posts',
          filter: `scene_id=eq.${sceneId}`
        },
        (payload) => {
          updatePost(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'posts',
          filter: `scene_id=eq.${sceneId}`
        },
        (payload) => {
          removePost(payload.old.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sceneId]);
}
```

**Presence Tracking (Typing Indicators):**
```typescript
// frontend/src/hooks/use-compose-presence.ts
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useComposePresence(sceneId: string, characterId: string | null) {
  useEffect(() => {
    if (!characterId) return;

    const channel = supabase.channel(`scene:${sceneId}:presence`);

    // Track when user starts composing
    channel.track({
      user_id: supabase.auth.user()?.id,
      character_id: characterId,
      online_at: new Date().toISOString()
    });

    // Listen for other users composing
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      // Update UI to show "Another player is currently posting"
      // Note: No identity exposed to prevent hidden post leakage
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sceneId, characterId]);
}
```

#### Backend Event Broadcasting

Backend triggers real-time events by modifying the database. Supabase automatically broadcasts changes.

```go
// backend/internal/service/post.go
package service

func (s *PostService) CreatePost(ctx context.Context, post *Post) error {
    // Insert post into database
    // Supabase Real-time automatically broadcasts INSERT event to subscribed clients
    _, err := s.db.Exec(
        ctx,
        `INSERT INTO posts (id, scene_id, character_id, user_id, blocks, witnesses, submitted)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        post.ID, post.SceneID, post.CharacterID, post.UserID, post.Blocks, post.Witnesses, post.Submitted,
    )
    return err
}
```

### 4. Storage Integration

Supabase Storage handles avatar images and scene header images with access control and size limits.

#### Bucket Configuration

```sql
-- migrations/20250101000005_storage_buckets.sql

-- Create bucket for campaign images
INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-images', 'campaign-images', false);

-- Set storage limits at the bucket level
-- Note: Per-campaign limits enforced in application logic via campaign.storage_used_bytes
```

#### Upload Pattern (GM-Only)

```typescript
// frontend/src/lib/storage.ts
import { supabase } from './supabase';

export async function uploadCampaignImage(
  campaignId: string,
  file: File,
  type: 'avatar' | 'scene-header'
): Promise<{ url: string; size: number }> {
  // Validate file size (20MB max)
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('File size exceeds 20MB limit');
  }

  // Validate file type
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Only PNG, JPG, and WebP images are allowed');
  }

  // Validate dimensions (4000x4000 max)
  const dimensions = await getImageDimensions(file);
  if (dimensions.width > 4000 || dimensions.height > 4000) {
    throw new Error('Image dimensions exceed 4000x4000px limit');
  }

  // Upload to Supabase Storage
  const filePath = `${campaignId}/${type}/${crypto.randomUUID()}.${file.name.split('.').pop()}`;

  const { data, error } = await supabase.storage
    .from('campaign-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw error;

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('campaign-images')
    .getPublicUrl(filePath);

  return {
    url: urlData.publicUrl,
    size: file.size
  };
}

async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
```

#### Storage Quota Tracking

```typescript
// Track storage usage per campaign
interface Campaign {
  storageUsedBytes: number; // Track storage for 500MB limit
}

// Update storage quota after upload
export async function trackStorageUsage(
  campaignId: string,
  additionalBytes: number
): Promise<void> {
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('storage_used_bytes')
    .eq('id', campaignId)
    .single();

  const newTotal = campaign.storage_used_bytes + additionalBytes;

  if (newTotal > 500 * 1024 * 1024) {
    throw new Error('Campaign storage limit (500MB) exceeded');
  }

  await supabase
    .from('campaigns')
    .update({ storage_used_bytes: newTotal })
    .eq('id', campaignId);
}
```

#### Image Deletion and Cleanup

```typescript
// Delete image and update storage quota
export async function deleteCampaignImage(
  campaignId: string,
  imageUrl: string
): Promise<void> {
  // Extract file path from URL
  const filePath = imageUrl.split('/').slice(-3).join('/');

  // Get file size before deletion
  const { data: fileData } = await supabase.storage
    .from('campaign-images')
    .list(filePath.split('/').slice(0, -1).join('/'));

  const file = fileData?.find(f => filePath.includes(f.name));
  const fileSize = file?.metadata?.size || 0;

  // Delete from storage
  await supabase.storage
    .from('campaign-images')
    .remove([filePath]);

  // Update storage quota
  await supabase
    .from('campaigns')
    .update({ storage_used_bytes: supabase.rpc('decrement', { x: fileSize }) })
    .eq('id', campaignId);
}
```

### 5. Type Generation and Code Sync

Generate TypeScript types from the database schema to maintain type safety between frontend and backend.

#### Supabase CLI Type Generation

```bash
# Generate TypeScript types from database schema
supabase gen types typescript --linked > frontend/src/types/generated.ts

# Or from local database
supabase gen types typescript --local > frontend/src/types/generated.ts
```

#### Generated Types Example

```typescript
// frontend/src/types/generated.ts (auto-generated)
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      campaigns: {
        Row: {
          id: string
          title: string
          description: string
          owner_id: string | null
          settings: Json
          current_phase: 'pc_phase' | 'gm_phase'
          current_phase_expires_at: string | null
          is_paused: boolean
          last_gm_activity_at: string
          storage_used_bytes: number
          scene_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description: string
          owner_id?: string | null
          settings?: Json
          current_phase?: 'pc_phase' | 'gm_phase'
          current_phase_expires_at?: string | null
          is_paused?: boolean
          last_gm_activity_at?: string
          storage_used_bytes?: number
          scene_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          owner_id?: string | null
          settings?: Json
          current_phase?: 'pc_phase' | 'gm_phase'
          current_phase_expires_at?: string | null
          is_paused?: boolean
          last_gm_activity_at?: string
          storage_used_bytes?: number
          scene_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      posts: {
        Row: {
          id: string
          scene_id: string
          character_id: string | null
          user_id: string
          blocks: Json
          ooc_text: string | null
          witnesses: string[]
          submitted: boolean
          intention: string | null
          modifier: number | null
          is_locked: boolean
          locked_at: string | null
          edited_by_gm: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          scene_id: string
          character_id?: string | null
          user_id: string
          blocks: Json
          ooc_text?: string | null
          witnesses?: string[]
          submitted?: boolean
          intention?: string | null
          modifier?: number | null
          is_locked?: boolean
          locked_at?: string | null
          edited_by_gm?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          scene_id?: string
          character_id?: string | null
          user_id?: string
          blocks?: Json
          ooc_text?: string | null
          witnesses?: string[]
          submitted?: boolean
          intention?: string | null
          modifier?: number | null
          is_locked?: boolean
          locked_at?: string | null
          edited_by_gm?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
```

#### Using Generated Types

```typescript
// frontend/src/lib/api.ts
import type { Database } from '@/types/generated';

type Campaign = Database['public']['Tables']['campaigns']['Row'];
type Post = Database['public']['Tables']['posts']['Row'];

// Type-safe API calls
export async function getCampaign(id: string): Promise<Campaign> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data; // TypeScript knows this matches Campaign type
}
```

#### Backend Type Generation (sqlc)

For the Go backend, use sqlc to generate type-safe database access code.

```yaml
# backend/sqlc.yaml
version: "2"
sql:
  - schema: "../migrations"
    queries: "./internal/db/queries"
    engine: "postgresql"
    gen:
      go:
        package: "db"
        out: "./internal/db/generated"
        sql_package: "pgx/v5"
        emit_json_tags: true
        emit_prepared_queries: false
        emit_interface: true
        emit_exact_table_names: false
```

```bash
# Generate Go types and queries from SQL
sqlc generate
```

## Common Integration Patterns

### Pattern 1: Authenticated API Request

```typescript
// Frontend: Make authenticated request to Go backend
async function makeAuthenticatedRequest(endpoint: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
}
```

### Pattern 2: Witness Transaction (GM Phase → PC Phase)

```sql
-- migrations/20250101000006_witness_transaction.sql

-- Function to apply witnesses atomically during phase transition
CREATE OR REPLACE FUNCTION apply_witnesses_to_gm_posts(campaign_id_param UUID)
RETURNS void AS $$
BEGIN
  -- Update all GM Phase posts (empty witnesses) to include current scene characters
  UPDATE posts
  SET witnesses = (
    SELECT COALESCE(array_agg(unnest), '{}'::uuid[])
    FROM unnest(scenes.characters)
  )
  FROM scenes
  WHERE posts.scene_id = scenes.id
    AND scenes.campaign_id = campaign_id_param
    AND posts.witnesses = '{}'::uuid[]  -- Only posts with empty witness list
    AND posts.submitted = true;
END;
$$ LANGUAGE plpgsql;
```

```go
// backend/internal/service/campaign.go

func (s *CampaignService) TransitionToPC(ctx context.Context, campaignID string) error {
    tx, err := s.db.Begin(ctx)
    if err != nil {
        return err
    }
    defer tx.Rollback(ctx)

    // Apply witnesses to all GM Phase posts atomically
    _, err = tx.Exec(ctx, "SELECT apply_witnesses_to_gm_posts($1)", campaignID)
    if err != nil {
        return err
    }

    // Update campaign phase
    _, err = tx.Exec(ctx,
        `UPDATE campaigns SET current_phase = 'pc_phase', current_phase_expires_at = NOW() + INTERVAL '24 hours' WHERE id = $1`,
        campaignID,
    )
    if err != nil {
        return err
    }

    return tx.Commit(ctx)
}
```

### Pattern 3: Multi-Tab Draft Synchronization

Drafts are server-persisted and sync across tabs via Supabase Real-time.

```typescript
// frontend/src/hooks/use-draft-sync.ts
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useDraftStore } from '@/stores/draft-store';

export function useDraftSync(sceneId: string, characterId: string) {
  const setDraft = useDraftStore(state => state.setDraft);

  useEffect(() => {
    // Subscribe to draft changes for this character
    const channel = supabase
      .channel(`draft:${sceneId}:${characterId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
          filter: `scene_id=eq.${sceneId},character_id=eq.${characterId},submitted=eq.false`
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setDraft(payload.new);
          } else if (payload.eventType === 'DELETE') {
            setDraft(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sceneId, characterId]);
}
```

## Troubleshooting

### RLS Policy Debugging

If users can't see data they should have access to:

1. Check RLS is enabled on the table:
```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```

2. Test policy logic directly:
```sql
-- Simulate auth.uid() for testing
SET request.jwt.claims TO '{"sub": "user-uuid-here"}';

-- Run SELECT to see what policy allows
SELECT * FROM posts WHERE scene_id = 'scene-uuid';
```

3. Enable RLS logging:
```sql
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
SET log_statement = 'all';
```

### Real-Time Subscription Issues

If subscriptions aren't receiving updates:

1. Verify Real-Time is enabled in Supabase dashboard
2. Check channel subscription status:
```typescript
channel.subscribe((status) => {
  console.log('Subscription status:', status);
});
```

3. Ensure RLS policies allow SELECT on subscribed tables
4. Check filter syntax matches database column names

### Storage Upload Failures

Common issues:

- **Policy mismatch:** Ensure user has INSERT policy on storage.objects
- **Bucket public setting:** Campaign images bucket should be `public: false`
- **File path format:** Must follow pattern `campaignId/type/filename`
- **CORS configuration:** Check allowed origins in Supabase dashboard

### Type Generation Drift

Keep generated types in sync with schema:

1. Run type generation after every migration:
```bash
supabase migration new my_change
# Edit migration SQL
supabase db push
supabase gen types typescript --linked > frontend/src/types/generated.ts
```

2. Add type generation to CI pipeline:
```yaml
# .github/workflows/types.yml
- name: Generate types
  run: supabase gen types typescript > frontend/src/types/generated.ts
- name: Check for drift
  run: git diff --exit-code frontend/src/types/generated.ts
```

3. For Go backend:
```bash
sqlc generate
git diff --exit-code internal/db/generated/
```

# 1.3 Supabase Project Setup

**Skill**: `supabase-integration`

**Goal**: Configure Supabase project with authentication, storage, and real-time capabilities.

---

## Overview

Supabase provides the backend-as-a-service infrastructure:
- PostgreSQL database with Row-Level Security
- Authentication (email, OAuth)
- Real-time subscriptions
- File storage for images

---

## PRD References

From [technical.md](../../prd/technical.md):
- Supabase for PostgreSQL hosting
- Supabase Auth for authentication
- Supabase Real-time for WebSocket subscriptions
- Supabase Storage for image uploads

---

## Prerequisites

Complete the Supabase project creation steps in [Manual Setup](../manual_setup.md#1-supabase-project-setup).

---

## Implementation Steps

### Step 1: Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# or using npm
npm install -g supabase

# Verify installation
supabase --version
```

### Step 2: Initialize Supabase in Project

```bash
cd /path/to/vanguard-pbp
supabase init
```

This creates a `supabase/` directory with configuration files.

### Step 3: Link to Remote Project

```bash
supabase link --project-ref [YOUR_PROJECT_REF]
```

When prompted, enter your database password.

### Step 4: Configure Authentication

In Supabase Dashboard, go to **Authentication > Providers**:

#### Email Provider (Default)
- Enable "Confirm email"
- Set email templates (optional customization)

#### Google OAuth (Optional)
1. Enable Google provider
2. Add Client ID and Secret from Google Cloud Console
3. Add redirect URL to Google OAuth consent screen

#### Discord OAuth (Optional)
1. Enable Discord provider
2. Add Client ID and Secret from Discord Developer Portal
3. Add redirect URL to Discord OAuth settings

### Step 5: Configure Authentication Settings

In **Authentication > URL Configuration**:

```
Site URL: http://localhost:5173
Redirect URLs:
  - http://localhost:5173/auth/callback
  - https://yourdomain.com/auth/callback (production)
```

### Step 6: Create Storage Bucket

In **Storage > Create bucket**:

```
Name: campaign-images
Public: false (we'll use RLS policies)
File size limit: 20 MB
Allowed MIME types: image/png, image/jpeg, image/webp
```

### Step 7: Configure Storage Policies

Navigate to **Storage > Policies** for `campaign-images` bucket:

**Select Policy (Read Access)**:
```sql
-- Allow campaign members to read images
CREATE POLICY "Campaign members can read images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'campaign-images'
  AND (
    -- Extract campaign_id from path: campaigns/{campaign_id}/...
    EXISTS (
      SELECT 1 FROM public.campaign_members
      WHERE campaign_id = (storage.foldername(name))[1]::uuid
      AND user_id = auth.uid()
    )
  )
);
```

**Insert Policy (Write Access)**:
```sql
-- Allow GMs to upload images
CREATE POLICY "GMs can upload images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'campaign-images'
  AND (
    EXISTS (
      SELECT 1 FROM public.campaign_members
      WHERE campaign_id = (storage.foldername(name))[1]::uuid
      AND user_id = auth.uid()
      AND role = 'gm'
    )
  )
);
```

**Delete Policy**:
```sql
-- Allow GMs to delete images
CREATE POLICY "GMs can delete images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'campaign-images'
  AND (
    EXISTS (
      SELECT 1 FROM public.campaign_members
      WHERE campaign_id = (storage.foldername(name))[1]::uuid
      AND user_id = auth.uid()
      AND role = 'gm'
    )
  )
);
```

### Step 8: Enable Real-time

In **Database > Replication**:

Enable real-time for these tables (after creating them in the next step):
- `posts`
- `compose_locks`
- `campaigns` (for phase state)
- `scenes` (for pass states)

### Step 9: Configure Database Settings

In **Database > Settings**:

1. **Connection pooling**: Enable (recommended for production)
2. **SSL**: Enforce SSL connections
3. **Statement timeout**: 60 seconds (default)

### Step 10: Generate TypeScript Types

Create a script to generate types from your database schema:

**package.json** (in frontend):
```json
{
  "scripts": {
    "db:types": "supabase gen types typescript --project-id [PROJECT_REF] > src/types/database.types.ts"
  }
}
```

Run after creating tables:
```bash
bun run db:types
```

---

## Supabase Directory Structure

```
supabase/
├── config.toml           # Supabase CLI configuration
├── seed.sql              # Seed data (optional)
└── migrations/
    └── 20240101000000_initial.sql  # Database migrations
```

### config.toml

```toml
[api]
enabled = true
port = 54321
schemas = ["public", "storage"]

[db]
port = 54322

[studio]
enabled = true
port = 54323

[auth]
enabled = true
site_url = "http://localhost:5173"
additional_redirect_urls = ["http://localhost:5173/auth/callback"]

[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = true

[auth.external.google]
enabled = true

[auth.external.discord]
enabled = true

[storage]
enabled = true
file_size_limit = "20MB"
```

---

## Local Development

For local development, you can run Supabase locally:

```bash
# Start local Supabase
supabase start

# Stop local Supabase
supabase stop

# Reset database
supabase db reset

# Push migrations to remote
supabase db push
```

Local URLs:
- API: http://localhost:54321
- Studio: http://localhost:54323
- Database: postgresql://postgres:postgres@localhost:54322/postgres

---

## Environment Variables Reference

After setup, collect these values:

| Variable | Location | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Settings > API > Project URL | Base URL for Supabase |
| `SUPABASE_ANON_KEY` | Settings > API > anon public | Public client key |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings > API > service_role | Backend-only key (secret) |
| `SUPABASE_JWT_SECRET` | Settings > API > JWT Secret | For JWT validation |
| `DATABASE_URL` | Settings > Database > Connection string | Direct DB connection |

---

## Security Checklist

- [ ] RLS enabled on all tables (default in Supabase)
- [ ] Service role key only used on backend
- [ ] JWT secret stored securely
- [ ] Email confirmation required
- [ ] Storage policies restrict access
- [ ] OAuth redirect URLs configured correctly
- [ ] CORS settings appropriate for your domains

---

## Verification

1. **Auth**: Create test user via Supabase Dashboard > Authentication > Users
2. **Storage**: Upload test file via Dashboard > Storage
3. **Database**: Run query in SQL Editor
4. **Real-time**: Check Database > Replication settings

---

## Troubleshooting

### "Invalid JWT" errors
- Verify JWT secret matches exactly
- Check token hasn't expired
- Ensure using correct key type (anon vs service_role)

### Storage upload failures
- Check bucket exists and policies are set
- Verify file size within limits
- Ensure MIME type is allowed

### Real-time not working
- Confirm table is enabled in Replication
- Check RLS policies allow SELECT
- Verify subscription channel name

---

## Next Step

Proceed to [04-database-schema.md](./04-database-schema.md) to create the database schema.

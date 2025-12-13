# Manual Setup Guide

This document outlines all manual configuration steps required before and during implementation. These are things that cannot be automated and require your direct action.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Supabase Project Setup](#1-supabase-project-setup)
3. [Environment Variables](#2-environment-variables)
4. [OAuth Provider Configuration](#3-oauth-provider-configuration)
5. [Railway Deployment Setup](#4-railway-deployment-setup)
6. [Domain & SSL Configuration](#5-domain--ssl-configuration)
7. [Email Service Setup](#6-email-service-setup)

---

## Project Structure

This is a **monorepo** with both frontend and backend in the same repository:

```
vanguard-pbp/
├── .env                    # Shared environment variables (root level)
├── .env.example            # Example env file (commit this, not .env)
├── services/
│   ├── backend/            # Go API server
│   │   ├── cmd/
│   │   ├── internal/
│   │   ├── db/
│   │   ├── go.mod
│   │   └── Makefile
│   └── frontend/           # React application
│       ├── src/
│       ├── public/
│       ├── package.json
│       └── vite.config.ts
├── supabase/               # Supabase migrations
├── implementation/         # This implementation plan
├── prd/                    # Product requirements
└── .github/workflows/      # CI/CD
```

**Important**: Both services share a single `.env` file at the repository root. This simplifies local development and ensures consistency between frontend and backend configuration.

---

## 1. Supabase Project Setup

### Create Project
1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Configure:
   - **Organization**: Select or create one
   - **Name**: `vanguard-pbp` (or your preferred name)
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier works for development

### Retrieve Credentials
After project creation, go to **Settings > API** and note:
- **Project URL**: `https://[PROJECT_REF].supabase.co`
- **Publishable key** (or `anon` key for legacy): For frontend client - safe to expose in browser
- **Secret key** (or `service_role` key for legacy): For backend only - KEEP SECRET

> **Note on API Keys**: Supabase has transitioned to new API key formats. New projects use `sb_publishable_...` and `sb_secret_...` keys. Legacy projects may still use `eyJ...` format keys. Both work until late 2026. This documentation supports both formats.

Go to **Settings > Database** and note:
- **Connection string**: `postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres`

For JWT verification, note the JWKS URL (constructed from your project):
- **JWKS URL**: `https://[PROJECT_REF].supabase.co/auth/v1/.well-known/jwks.json`

### Enable Required Features
1. **Authentication**: Settings > Authentication
   - Enable Email provider (default)
   - Enable "Confirm email" for email verification

2. **Storage**: Create bucket for images
   - Go to Storage > Create bucket
   - Name: `campaign-images`
   - Public: No (we'll use RLS policies)

3. **Realtime**: Enable for required tables
   - Go to Database > Replication
   - Enable realtime for: `posts`, `compose_locks`, `campaigns`, `scenes`

---

## 2. Environment Variables

### Shared Environment File

Create `/.env` at the repository root (shared by both frontend and backend):

```env
# ============================================
# SHARED ENVIRONMENT VARIABLES
# ============================================
# This file is used by both frontend and backend.
# Copy to .env and fill in your values.
# NEVER commit .env to git - only .env.example
# ============================================

# --------------------------------------------
# SERVER CONFIGURATION (Backend)
# --------------------------------------------
PORT=8080
GIN_MODE=debug                    # Use "release" in production

# --------------------------------------------
# SUPABASE CONFIGURATION (Both)
# --------------------------------------------
# Get these from: Supabase Dashboard > Settings > API
# New keys (sb_publishable_/sb_secret_) recommended; legacy (anon/service_role) works until late 2026

SUPABASE_URL=https://[PROJECT_REF].supabase.co

# New API Keys (Recommended for new projects)
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxx    # Safe for browser
SUPABASE_SECRET_KEY=sb_secret_xxxxxxxxxxxx              # Backend only - keep secret!

# Legacy API Keys (Deprecated - still works until late 2026)
# SUPABASE_ANON_KEY=eyJ...                              # Use SUPABASE_PUBLISHABLE_KEY instead
# SUPABASE_SERVICE_ROLE_KEY=eyJ...                      # Use SUPABASE_SECRET_KEY instead
# SUPABASE_JWT_SECRET=your-jwt-secret                   # Use JWKS URL instead

# JWT Verification via JWKS (replaces shared JWT_SECRET)
SUPABASE_JWKS_URL=https://[PROJECT_REF].supabase.co/auth/v1/.well-known/jwks.json

# Frontend uses VITE_ prefix (Vite exposes these to the browser)
VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_SUPABASE_PUBLISHABLE_KEY=${SUPABASE_PUBLISHABLE_KEY}

# --------------------------------------------
# DATABASE (Backend only)
# --------------------------------------------
# Get from: Supabase Dashboard > Settings > Database > Connection string
# Format: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres

DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres

# --------------------------------------------
# CORS CONFIGURATION (Backend)
# --------------------------------------------
# Comma-separated list of allowed origins
# Include your frontend URL(s)

CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# --------------------------------------------
# API CONFIGURATION (Frontend)
# --------------------------------------------
# URL where the backend API is running

VITE_API_URL=http://localhost:8080

# --------------------------------------------
# RATE LIMITING (Backend)
# --------------------------------------------

RATE_LIMIT_ENABLED=true

# --------------------------------------------
# EMAIL CONFIGURATION (Backend)
# --------------------------------------------
# Choose ONE provider and configure accordingly.
# See "Email Service Setup" section below for details.

# Provider selection: "supabase" | "resend" | "smtp"
EMAIL_PROVIDER=supabase

# --- Option A: Supabase Built-in ---
# No additional config needed. Supabase handles auth emails automatically.
# Good for development, limited to 4 emails/hour on free tier.
# Only handles auth emails (verification, password reset).

# --- Option B: Resend (Recommended for Production) ---
# Get API key from: https://resend.com/api-keys
# RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
# EMAIL_FROM=noreply@yourdomain.com

# --- Option C: Custom SMTP ---
# Use any SMTP provider (SendGrid, Mailgun, AWS SES, etc.)
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=your-smtp-username
# SMTP_PASSWORD=your-smtp-password
# EMAIL_FROM=noreply@yourdomain.com

# --------------------------------------------
# FEATURE FLAGS (Frontend, optional)
# --------------------------------------------

VITE_ENABLE_OAUTH=true
```

### Environment Variable Reference

| Variable | Service | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | Backend | No | Server port (default: 8080) |
| `GIN_MODE` | Backend | No | Gin mode: debug/release |
| `SUPABASE_URL` | Both | Yes | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Both | Yes | Supabase publishable key (safe for browser) |
| `SUPABASE_SECRET_KEY` | Backend | Yes | Supabase secret key (backend only!) |
| `SUPABASE_JWKS_URL` | Backend | Yes | JWKS URL for JWT verification |
| `DATABASE_URL` | Backend | Yes | PostgreSQL connection string |
| `CORS_ALLOWED_ORIGINS` | Backend | Yes | Allowed CORS origins |
| `VITE_SUPABASE_URL` | Frontend | Yes | Supabase URL (exposed to browser) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend | Yes | Supabase publishable key (safe for browser) |
| `VITE_API_URL` | Frontend | Yes | Backend API URL |
| `EMAIL_PROVIDER` | Backend | No | Email provider selection |
| `RESEND_API_KEY` | Backend | Conditional | Required if using Resend |
| `EMAIL_FROM` | Backend | Conditional | Sender email for notifications |

> **Legacy Variables**: If using legacy keys, use `SUPABASE_ANON_KEY` instead of `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` instead of `SUPABASE_SECRET_KEY`, and `SUPABASE_JWT_SECRET` instead of `SUPABASE_JWKS_URL`.

### Where to Find Values

| Variable | Location |
|----------|----------|
| `SUPABASE_URL` | Supabase Dashboard > Settings > API > Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase Dashboard > Settings > API > Project API keys > Publishable |
| `SUPABASE_SECRET_KEY` | Supabase Dashboard > Settings > API > Project API keys > Secret |
| `SUPABASE_JWKS_URL` | Constructed: `https://[PROJECT_REF].supabase.co/auth/v1/.well-known/jwks.json` |
| `DATABASE_URL` | Supabase Dashboard > Settings > Database > Connection string |

> **Legacy keys**: If your dashboard shows `anon` and `service_role` keys (format: `eyJ...`), use those values for `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` respectively - they work the same way.

### Loading Environment Variables

**Backend (Go)**: Uses `godotenv` to load from root `.env`:

```go
// In cmd/server/main.go
import "github.com/joho/godotenv"

func main() {
    // Load from repository root
    godotenv.Load("../../.env")
    // ... rest of initialization
}
```

**Frontend (Vite)**: Automatically loads `.env` from project root. Configure `vite.config.ts` to look at the monorepo root:

```typescript
// In services/frontend/vite.config.ts
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  envDir: '../../',  // Look for .env in repository root
  // ... rest of config
})
```

---

## 3. OAuth Provider Configuration

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth 2.0 Client IDs**
5. Configure:
   - Application type: Web application
   - Authorized redirect URIs:
     - `https://[PROJECT_REF].supabase.co/auth/v1/callback`
     - `http://localhost:5173/auth/callback` (development)
6. Copy **Client ID** and **Client Secret**
7. In Supabase Dashboard:
   - Go to **Authentication > Providers > Google**
   - Enable and paste credentials

### Discord OAuth

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**
3. Navigate to **OAuth2 > General**
4. Add redirect URLs:
   - `https://[PROJECT_REF].supabase.co/auth/v1/callback`
   - `http://localhost:5173/auth/callback` (development)
5. Copy **Client ID** and **Client Secret**
6. In Supabase Dashboard:
   - Go to **Authentication > Providers > Discord**
   - Enable and paste credentials

---

## 4. Railway Deployment Setup

### Create Railway Account
1. Go to [railway.app](https://railway.app) and sign up
2. Connect your GitHub account

### Create Services

Since this is a monorepo, you'll create two services from the same repository:

#### Backend Service
1. Click **New Project > Deploy from GitHub repo**
2. Select your repository
3. Configure:
   - **Root directory**: `services/backend`
   - **Build command**: `go build -o server ./cmd/server`
   - **Start command**: `./server`
4. Add environment variables (copy relevant vars from .env)

#### Frontend Service
1. In same project, click **New Service > GitHub repo**
2. Select your repository
3. Configure:
   - **Root directory**: `services/frontend`
   - **Build command**: `bun install && bun run build`
   - **Start command**: `bun run preview` (or configure static hosting)
4. Add environment variables (copy `VITE_*` vars from .env)

### Generate Domain
1. Select each service
2. Go to **Settings > Networking > Generate Domain**
3. Note the URLs for CORS configuration

---

## 5. Domain & SSL Configuration

### Custom Domain (Optional)

If using a custom domain:

1. **DNS Configuration**:
   - Add CNAME record pointing to Railway domain
   - Example: `app.yourdomain.com` → `[service].up.railway.app`

2. **Railway Configuration**:
   - Go to service **Settings > Networking > Custom Domain**
   - Add your domain
   - Railway handles SSL automatically

3. **Update Environment Variables**:
   - Update `CORS_ALLOWED_ORIGINS` to include custom domain
   - Update `VITE_API_URL` if backend has custom domain
   - Update OAuth redirect URIs in providers

### Supabase Site URL

1. Go to **Authentication > URL Configuration**
2. Set **Site URL** to your production frontend URL
3. Add redirect URLs for both development and production

---

## 6. Email Service Setup

Vanguard PBP uses email for two purposes:
1. **Authentication emails** (verification, password reset) - handled by Supabase Auth
2. **Notification emails** (new posts, phase changes, etc.) - handled by backend

### Understanding Email Providers

| Provider | Auth Emails | Notification Emails | Best For |
|----------|-------------|---------------------|----------|
| Supabase Built-in | Yes | No | Development only |
| Resend | Via Supabase SMTP | Yes | Production |
| Custom SMTP | Via Supabase SMTP | Yes | Enterprise |

### Option A: Supabase Built-in (Development)

**No configuration needed.** Supabase automatically sends auth emails.

**Limitations**:
- 4 emails/hour on free tier
- 100 emails/hour on Pro tier
- Only handles auth emails (verification, password reset)
- Cannot send notification emails (posts, phases, etc.)

**When to use**: Local development and testing only.

**Configuration**:
```env
EMAIL_PROVIDER=supabase
# No additional config needed
```

### Option B: Resend (Recommended for Production)

[Resend](https://resend.com) is a modern email API with excellent deliverability and a generous free tier (100 emails/day).

**Setup Steps**:

1. **Create Resend Account**:
   - Go to [resend.com](https://resend.com) and sign up
   - Verify your email

2. **Add Your Domain** (required for production):
   - Go to **Domains > Add Domain**
   - Add DNS records (DKIM, SPF) as instructed
   - Wait for verification (usually minutes)

3. **Create API Key**:
   - Go to **API Keys > Create API Key**
   - Name it (e.g., "vanguard-pbp-production")
   - Copy the key (starts with `re_`)

4. **Configure Environment**:
   ```env
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
   EMAIL_FROM=noreply@yourdomain.com
   ```

5. **Configure Supabase to use Resend for Auth emails** (optional but recommended):
   - Go to **Supabase > Settings > Auth > SMTP Settings**
   - Enable custom SMTP
   - Use Resend's SMTP credentials:
     - Host: `smtp.resend.com`
     - Port: `465`
     - Username: `resend`
     - Password: Your API key (`re_xxx...`)

**Pricing**:
- Free: 100 emails/day, 3,000/month
- Pro: $20/month for 50,000 emails

### Option C: Custom SMTP (Enterprise/Self-hosted)

Use any SMTP provider: SendGrid, Mailgun, AWS SES, Postmark, or your own mail server.

**Setup Steps**:

1. **Get SMTP Credentials** from your provider

2. **Configure Environment**:
   ```env
   EMAIL_PROVIDER=smtp
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USER=apikey
   SMTP_PASSWORD=SG.xxxxxxxxxxxxxxxxxxxx
   EMAIL_FROM=noreply@yourdomain.com
   ```

3. **Configure Supabase SMTP** (same credentials):
   - Go to **Supabase > Settings > Auth > SMTP Settings**
   - Enable and enter your SMTP details

**Common SMTP Providers**:

| Provider | Host | Port | Notes |
|----------|------|------|-------|
| SendGrid | smtp.sendgrid.net | 587 | Use "apikey" as username |
| Mailgun | smtp.mailgun.org | 587 | Region-specific |
| AWS SES | email-smtp.{region}.amazonaws.com | 587 | Requires verification |
| Postmark | smtp.postmarkapp.com | 587 | Excellent deliverability |

---

## Checklist

Use this checklist to track manual setup completion:

```
[ ] Supabase project created
[ ] Supabase credentials retrieved
[ ] Storage bucket created
[ ] Realtime enabled for tables
[ ] Root .env file configured
[ ] .env added to .gitignore
[ ] Google OAuth configured (optional)
[ ] Discord OAuth configured (optional)
[ ] Railway project created
[ ] Backend service deployed (services/backend)
[ ] Frontend service deployed (services/frontend)
[ ] Custom domain configured (optional)
[ ] Email service configured
[ ] Production environment variables set
```

---

## Security Reminders

1. **Never commit `.env` files** - Add to `.gitignore`
2. **Commit `.env.example`** - Template without real values
3. **Rotate keys if exposed** - Generate new ones immediately
4. **Use service_role key only on backend** - Never expose to frontend
5. **Enable RLS on all tables** - Default deny policy
6. **Review OAuth scopes** - Request only what you need
7. **Enable 2FA** on Supabase, Railway, and OAuth provider accounts

---

## Troubleshooting

### "Invalid JWT" errors
- Verify `SUPABASE_JWKS_URL` is correctly constructed from your project reference
- Check that the JWKS endpoint is accessible (try fetching it directly)
- Check token expiration
- Ensure correct key (publishable vs secret)

### CORS errors
- Add frontend URL to `CORS_ALLOWED_ORIGINS`
- Include both http and https if applicable
- Don't forget trailing slashes (or lack thereof)

### OAuth redirect errors
- Verify redirect URLs match exactly (including trailing slashes)
- Check both Supabase and OAuth provider configurations
- Ensure Site URL is set correctly in Supabase

### Database connection errors
- Verify DATABASE_URL format
- Check password doesn't contain special characters that need escaping
- Ensure IP is allowed (Railway IPs may need allowlisting)

### Email not sending
- Check EMAIL_PROVIDER is set correctly
- Verify API keys are valid
- Check email domain is verified (Resend)
- Review Supabase Auth > Logs for auth email issues

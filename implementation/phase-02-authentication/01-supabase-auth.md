# 2.1 Supabase Auth Configuration

**Skill**: `supabase-integration`

**Goal**: Configure Supabase Auth providers and settings.

---

## Overview

Supabase Auth provides:
- Email/password authentication
- OAuth providers (Google, Discord)
- Email verification
- Session management with JWTs
- Secure token refresh

---

## PRD References

From [technical.md](../../prd/technical.md):
- Supabase Auth for authentication
- Email verification required
- OAuth providers: Google, Discord

---

## Configuration Steps

### Step 1: Email Provider Settings

In Supabase Dashboard > Authentication > Providers > Email:

```
Enable Email provider: ON
Confirm email: ON
Secure email change: ON
```

### Step 2: Email Templates

In Authentication > Email Templates, customize:

**Confirm signup**:
```html
<h2>Confirm your Vanguard PBP account</h2>
<p>Click the link below to confirm your account:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm Email</a></p>
<p>This link expires in 24 hours.</p>
```

**Magic Link** (if enabled):
```html
<h2>Login to Vanguard PBP</h2>
<p>Click the link below to login:</p>
<p><a href="{{ .ConfirmationURL }}">Login</a></p>
<p>This link expires in 1 hour.</p>
```

**Reset Password**:
```html
<h2>Reset your Vanguard PBP password</h2>
<p>Click the link below to reset your password:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
<p>This link expires in 24 hours.</p>
```

### Step 3: URL Configuration

In Authentication > URL Configuration:

```
Site URL: http://localhost:5173

Redirect URLs:
- http://localhost:5173/auth/callback
- http://localhost:5173/auth/reset-password
- https://yourdomain.com/auth/callback (production)
- https://yourdomain.com/auth/reset-password (production)
```

### Step 4: Google OAuth (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI:
   - `https://[PROJECT_REF].supabase.co/auth/v1/callback`

In Supabase > Authentication > Providers > Google:
```
Enable: ON
Client ID: [from Google]
Client Secret: [from Google]
```

### Step 5: Discord OAuth (Optional)

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create application and get OAuth2 credentials
3. Add redirect URL:
   - `https://[PROJECT_REF].supabase.co/auth/v1/callback`

In Supabase > Authentication > Providers > Discord:
```
Enable: ON
Client ID: [from Discord]
Client Secret: [from Discord]
```

### Step 6: Security Settings

In Authentication > Settings:

```
JWT expiry: 3600 (1 hour)
Enable refresh token rotation: ON
Refresh token reuse interval: 10 (seconds)
```

---

## Auth Helper Functions

Create **frontend/src/lib/auth.ts**:

```typescript
import { supabase } from './supabase'
import type { Provider } from '@supabase/supabase-js'

export interface SignUpData {
  email: string
  password: string
}

export interface SignInData {
  email: string
  password: string
}

/**
 * Sign up with email and password
 * User will receive verification email
 */
export async function signUp({ email, password }: SignUpData) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  })

  if (error) throw error
  return data
}

/**
 * Sign in with email and password
 * Fails if email not verified
 */
export async function signIn({ email, password }: SignInData) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error
  return data
}

/**
 * Sign in with OAuth provider
 */
export async function signInWithOAuth(provider: Provider) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })

  if (error) throw error
  return data
}

/**
 * Sign out current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/**
 * Get current session
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

/**
 * Get current user
 */
export async function getUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data.user
}

/**
 * Request password reset email
 */
export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  })

  if (error) throw error
}

/**
 * Update password (when user has reset token)
 */
export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) throw error
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(email: string) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
  })

  if (error) throw error
}
```

---

## Auth State Listener

Update **frontend/src/stores/authStore.ts**:

```typescript
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  initialized: boolean
  error: string | null

  initialize: () => Promise<void>
  setError: (error: string | null) => void
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  initialized: false,
  error: null,

  initialize: async () => {
    if (get().initialized) return

    try {
      // Get initial session
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error) throw error

      set({
        session,
        user: session?.user ?? null,
        loading: false,
        initialized: true,
      })

      // Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event: AuthChangeEvent, session: Session | null) => {
          console.log('Auth event:', event)

          set({
            session,
            user: session?.user ?? null,
          })

          // Handle specific events
          if (event === 'SIGNED_OUT') {
            // Clear any app state
          } else if (event === 'TOKEN_REFRESHED') {
            // Token was refreshed
          } else if (event === 'USER_UPDATED') {
            // User data changed
          }
        }
      )

      // Cleanup function (call when app unmounts)
      return () => {
        subscription.unsubscribe()
      }
    } catch (error) {
      set({
        error: (error as Error).message,
        loading: false,
        initialized: true,
      })
    }
  },

  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}))
```

---

## Verification

1. **Test email signup**:
   - Register with email
   - Check inbox for verification email
   - Click verification link
   - Verify redirect to callback URL

2. **Test email login**:
   - Login with verified email
   - Verify session is created
   - Check access token in Supabase client

3. **Test OAuth** (if configured):
   - Click "Login with Google"
   - Complete OAuth flow
   - Verify redirect and session creation

---

## Edge Cases

1. **Unverified email login attempt**: Clear error message
2. **Expired verification link**: Resend verification option
3. **OAuth account already exists**: Link or error
4. **Network failure during auth**: Retry with backoff
5. **Token refresh failure**: Force re-login

---

## Testing

```typescript
// Test: Signup creates unverified user
test('signup creates user', async () => {
  const { data } = await signUp({
    email: 'test@example.com',
    password: 'password123',
  })

  expect(data.user).toBeDefined()
  expect(data.user?.email_confirmed_at).toBeNull()
})

// Test: Login fails for unverified user
test('login fails for unverified', async () => {
  await expect(signIn({
    email: 'unverified@example.com',
    password: 'password123',
  })).rejects.toThrow()
})
```

---

## Next Step

Proceed to [02-backend-jwt.md](./02-backend-jwt.md) to implement backend JWT validation.

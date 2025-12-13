# 1.2 React Frontend Scaffolding

**Skill**: `shadcn-react`

**Goal**: Create a React frontend using Vite, TypeScript, Tailwind CSS, and shadcn/ui.

---

## Overview

The frontend provides the user interface for Vanguard PBP. It uses:
- Vite for fast development and building
- TypeScript for type safety
- Tailwind CSS for styling
- shadcn/ui for accessible components
- Supabase client for auth and real-time

---

## PRD References

From [technical.md](../../prd/technical.md):
- React with TypeScript
- Tailwind CSS utility-first styling
- shadcn/ui component library
- Bun as package manager
- Vite for build tooling

---

## Project Structure

The frontend lives at `services/frontend/` in the monorepo and loads environment variables from the root `.env` file.

```
services/frontend/
├── src/
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   └── ...
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Layout.tsx
│   │   └── features/           # Feature-specific components
│   │       ├── campaigns/
│   │       ├── characters/
│   │       └── posts/
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useCampaign.ts
│   │   └── useSupabase.ts
│   ├── lib/
│   │   ├── supabase.ts         # Supabase client
│   │   ├── api.ts              # API client
│   │   └── utils.ts            # Utility functions
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── Login.tsx
│   │   │   └── Register.tsx
│   │   ├── campaigns/
│   │   │   ├── CampaignList.tsx
│   │   │   └── CampaignView.tsx
│   │   └── Home.tsx
│   ├── stores/
│   │   ├── authStore.ts        # Auth state (Zustand)
│   │   └── campaignStore.ts    # Campaign state
│   ├── types/
│   │   ├── database.types.ts   # Supabase generated types
│   │   └── index.ts            # App types
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
│   └── favicon.ico
├── index.html
├── package.json
├── bun.lockb
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── components.json             # shadcn/ui config
```

**Environment**: The frontend loads `VITE_*` variables from the repository root (`.env` at `../../`).

---

## Implementation Steps

### Step 1: Create Vite Project

```bash
cd /path/to/vanguard-pbp
mkdir -p services
bun create vite services/frontend --template react-ts
cd services/frontend
bun install
```

### Step 2: Install Dependencies

```bash
# Core dependencies
bun add @supabase/supabase-js zustand react-router-dom

# Form handling
bun add react-hook-form @hookform/resolvers zod

# Development dependencies
bun add -d @types/node tailwindcss postcss autoprefixer

# Date handling
bun add date-fns
```

### Step 3: Configure Tailwind CSS

```bash
bunx tailwindcss init -p
```

**tailwind.config.js**:

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Vanguard-specific colors
        "gm-phase": "hsl(var(--gm-phase))",
        "pc-phase": "hsl(var(--pc-phase))",
        "passed": "hsl(var(--passed))",
        "hard-passed": "hsl(var(--hard-passed))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "drain": {
          from: { width: "100%" },
          to: { width: "0%" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "drain": "drain var(--drain-duration) linear",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

### Step 4: Configure CSS Variables

**src/index.css**:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;

    /* Vanguard-specific */
    --gm-phase: 280 60% 50%;      /* Purple for GM Phase */
    --pc-phase: 142 76% 36%;      /* Green for PC Phase */
    --passed: 210 40% 60%;        /* Blue-gray for Passed */
    --hard-passed: 215 20% 50%;   /* Muted for Hard Passed */
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;

    /* Vanguard-specific (dark) */
    --gm-phase: 280 60% 60%;
    --pc-phase: 142 76% 46%;
    --passed: 210 40% 70%;
    --hard-passed: 215 20% 60%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

### Step 5: Initialize shadcn/ui

```bash
bunx shadcn@latest init
```

When prompted:
- Style: Default
- Base color: Slate
- CSS variables: Yes

**components.json**:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

### Step 6: Add Common shadcn Components

```bash
bunx shadcn@latest add button card input label dialog alert toast
bunx shadcn@latest add form select textarea avatar badge
bunx shadcn@latest add dropdown-menu tabs skeleton separator
```

### Step 7: Configure Path Aliases

**tsconfig.json**:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**vite.config.ts**:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  // Load .env from repository root (shared with backend)
  envDir: '../../',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
```

### Step 8: Create Supabase Client

**src/lib/supabase.ts**:

```ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
// Use VITE_SUPABASE_PUBLISHABLE_KEY (new) or VITE_SUPABASE_ANON_KEY (legacy)
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})
```

### Step 9: Create API Client

**src/lib/api.ts**:

```ts
import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
}

export class APIError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public requestId?: string
  ) {
    super(message)
    this.name = 'APIError'
  }
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new APIError('UNAUTHORIZED', 'No active session', 401)
  }

  return {
    'Authorization': `Bearer ${session.access_token}`,
  }
}

export async function api<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {} } = options

  const authHeader = await getAuthHeader()

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new APIError(
      data.code || 'UNKNOWN_ERROR',
      data.message || 'An error occurred',
      response.status,
      data.requestId
    )
  }

  return data as T
}

// Convenience methods
export const apiGet = <T>(endpoint: string) => api<T>(endpoint)
export const apiPost = <T>(endpoint: string, body: unknown) =>
  api<T>(endpoint, { method: 'POST', body })
export const apiPut = <T>(endpoint: string, body: unknown) =>
  api<T>(endpoint, { method: 'PUT', body })
export const apiDelete = <T>(endpoint: string) =>
  api<T>(endpoint, { method: 'DELETE' })
```

### Step 10: Create Utility Functions

**src/lib/utils.ts**:

```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

export function formatRelativeTime(date: Date | string): string {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(date)
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}
```

### Step 11: Create Auth Store

**src/stores/authStore.ts**:

```ts
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
  initialize: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  signInWithOAuth: (provider: 'google' | 'discord') => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  error: null,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      set({
        session,
        user: session?.user ?? null,
        loading: false
      })

      // Listen for auth changes
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, user: session?.user ?? null })
      })
    } catch (error) {
      set({ error: 'Failed to initialize auth', loading: false })
    }
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      set({ session: data.session, user: data.user, loading: false })
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
      throw error
    }
  },

  signUp: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })
      if (error) throw error
      set({ session: data.session, user: data.user, loading: false })
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
      throw error
    }
  },

  signOut: async () => {
    set({ loading: true })
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      set({ session: null, user: null, loading: false })
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
      throw error
    }
  },

  signInWithOAuth: async (provider) => {
    set({ loading: true, error: null })
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
      throw error
    }
  },
}))
```

### Step 12: Create App Entry Point

**src/App.tsx**:

```tsx
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Toaster } from '@/components/ui/toaster'

// Pages (to be created)
import Home from '@/pages/Home'
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import AuthCallback from '@/pages/auth/AuthCallback'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function App() {
  const { initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}
```

### Step 13: Create Placeholder Pages

**src/pages/Home.tsx**:

```tsx
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Home() {
  const { user, signOut } = useAuthStore()

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Welcome to Vanguard PBP</CardTitle>
          <CardDescription>
            Logged in as {user?.email}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={signOut}>Sign Out</Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## Environment Variables

The frontend uses the shared `.env` file at the repository root. Vite is configured to load from `../../` via the `envDir` option.

See [manual_setup.md](../manual_setup.md) for the complete environment variable reference.

Key frontend variables (must have `VITE_` prefix to be exposed to the browser):

```env
# Supabase (safe to expose - anon key is public)
VITE_SUPABASE_URL=https://[PROJECT_REF].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... # or VITE_SUPABASE_ANON_KEY for legacy

# API URL (backend)
VITE_API_URL=http://localhost:8080

# Feature flags
VITE_ENABLE_OAUTH=true
```

**Note**: Only variables prefixed with `VITE_` are exposed to the browser. The `.env` file is at the repository root.

---

## Verification

After completing this sub-phase:

```bash
# From services/frontend
cd services/frontend
bun run dev

# Or from repository root
cd services/frontend && bun run dev
```

Open http://localhost:5173 and verify:
- Page loads without errors
- Tailwind styles are applied
- Console shows no errors

---

## Edge Cases

1. **Missing environment variables**: App shows clear error message
2. **Supabase connection failure**: Show user-friendly error
3. **API unreachable**: Graceful degradation with retry option

---

## Next Step

Proceed to [03-supabase-setup.md](./03-supabase-setup.md) to configure Supabase.

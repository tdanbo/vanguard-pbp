# Phase 2: Authentication & User Management

**Goal**: Implement user authentication with Supabase Auth.

---

## Overview

This phase implements the complete authentication flow:
- Email/password registration with verification
- OAuth login (Google, Discord)
- JWT validation on backend
- Session management
- Protected routes

---

## Skills to Activate

| Skill | Purpose |
|-------|---------|
| `supabase-integration` | Auth configuration, JWT validation |
| `go-api-server` | Auth middleware, protected routes |
| `shadcn-react` | Login/Register forms, auth UI |

---

## Sub-phases

| # | Task | File | Description |
|---|------|------|-------------|
| 2.1 | Supabase Auth | [01-supabase-auth.md](./01-supabase-auth.md) | Configure auth providers |
| 2.2 | Backend JWT | [02-backend-jwt.md](./02-backend-jwt.md) | JWT validation middleware |
| 2.3 | Frontend Auth | [03-frontend-auth.md](./03-frontend-auth.md) | Login/Register UI |

---

## PRD References

- [technical.md](../../prd/technical.md) - Auth requirements
- [settings.md](../../prd/settings.md) - User preferences

From PRD:
- Email verification required for activation
- Session management via JWT (sliding window ~30 days)
- No usernames—anonymous to other players
- Character-based identity within campaigns
- GM sees user_id → character mapping

---

## Prerequisites

- Phase 1 complete
- Supabase project created
- OAuth providers configured (optional)

---

## Authentication Flow

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Frontend   │      │   Supabase   │      │   Backend    │
│              │      │     Auth     │      │              │
└──────┬───────┘      └──────┬───────┘      └──────┬───────┘
       │                     │                     │
       │  1. signUp(email)   │                     │
       │────────────────────▶│                     │
       │                     │                     │
       │  2. Confirm email   │                     │
       │◀────────────────────│                     │
       │                     │                     │
       │  3. signIn(email)   │                     │
       │────────────────────▶│                     │
       │                     │                     │
       │  4. JWT + refresh   │                     │
       │◀────────────────────│                     │
       │                     │                     │
       │  5. API request with JWT                  │
       │──────────────────────────────────────────▶│
       │                     │                     │
       │                     │  6. Validate JWT    │
       │                     │◀────────────────────│
       │                     │                     │
       │  7. Response                              │
       │◀──────────────────────────────────────────│
```

---

## Deliverables

- [ ] Supabase Auth configured
- [ ] Email/password registration
- [ ] Email verification flow
- [ ] OAuth login (Google, Discord)
- [ ] JWT middleware on backend
- [ ] Protected API routes
- [ ] Login page
- [ ] Register page
- [ ] Auth callback handler
- [ ] Session persistence
- [ ] Logout functionality

---

## Security Considerations

1. **Password requirements**: Minimum 8 characters (Supabase default)
2. **Email verification**: Required before account is active
3. **JWT expiration**: 1 hour access token, 7 day refresh token
4. **HTTPS only**: All auth traffic encrypted
5. **CORS**: Restrict to known origins
6. **Rate limiting**: Prevent brute force attacks

---

## Testing Checklist

- [ ] Register new user with email
- [ ] Receive and click verification email
- [ ] Login with verified account
- [ ] Login fails with unverified account
- [ ] OAuth login redirects correctly
- [ ] OAuth callback creates/links account
- [ ] JWT rejected when expired
- [ ] Refresh token extends session
- [ ] Logout clears session
- [ ] Protected routes redirect to login

---

## Completion Checklist

- [ ] Users can register with email
- [ ] Email verification works
- [ ] Users can login
- [ ] OAuth providers work (if configured)
- [ ] Backend validates JWTs
- [ ] Protected routes require auth
- [ ] Session persists across browser refresh
- [ ] Logout works correctly

---

## Next Phase

After completing Phase 2, proceed to [Phase 3: Campaign Core](../phase-03-campaigns/README.md).

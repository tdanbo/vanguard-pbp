# Phase 3: Campaign Core

## Overview

Phase 3 implements the core campaign management features that allow GMs to create and configure campaigns, invite players, and manage campaign membership. This phase establishes the foundation for all gameplay features.

## Skills Required

- **go-api-server**: Backend API handlers, service layer logic, request validation
- **supabase-integration**: Authentication, database queries, RLS policies
- **shadcn-react**: Frontend components for campaign management UI

## Deliverables

### Campaign CRUD
- Create campaign (max 5 per user as GM)
- Get campaign details
- Update campaign settings (GM only)
- Delete campaign with confirmation (GM only)
- List user's campaigns
- Pause/resume campaign functionality

### Campaign Settings
- Time gate presets (24h, 2d, 3d, 4d, 5d)
- Fog of War toggle
- Hidden posts toggle
- OOC visibility (all/gm_only)
- Character limit (1000/3000/6000/10000)
- System presets (D&D 5e, Pathfinder 2e, Custom)

### Invite System
- Generate invite links (24h expiration, one-time use)
- View active/used/expired/revoked links
- Revoke invite links
- Public invite lookup endpoint
- Rate limiting on invite generation

### Membership Management
- Join campaign via invite
- Leave campaign
- GM removes player
- GM transfer (voluntary)
- GM abandonment handling (30 days inactivity)
- Member list display

## PRD References

- [Overview](/home/tobiasd/github/vanguard-pbp/prd/overview.md) - Design philosophy, problems addressed
- [Scope](/home/tobiasd/github/vanguard-pbp/prd/scope.md) - v1 scope, success criteria
- [Settings](/home/tobiasd/github/vanguard-pbp/prd/settings.md) - Campaign settings, defaults, constraints
- [Technical](/home/tobiasd/github/vanguard-pbp/prd/technical.md) - Data models, API endpoints, architecture

## Implementation Files

1. [01-campaign-crud.md](./01-campaign-crud.md) - Campaign CRUD operations
2. [02-campaign-settings.md](./02-campaign-settings.md) - Settings management
3. [03-invite-system.md](./03-invite-system.md) - Invite link system
4. [04-membership.md](./04-membership.md) - Membership management

## Success Criteria

- [ ] GM can create up to 5 campaigns
- [ ] Campaign creation blocks at limit with clear messaging
- [ ] All campaign settings persist correctly
- [ ] Invite links expire after 24 hours
- [ ] Invite links are one-time use
- [ ] Players can join via valid invite links
- [ ] GM can pause/resume campaigns (freezes time gates)
- [ ] Campaign deletion requires typing campaign name
- [ ] GM transfer works correctly (voluntary and abandonment)
- [ ] 30-day inactivity threshold triggers correctly

## Testing Checklist

- [ ] Create campaign with valid settings
- [ ] Create campaign with invalid settings (validation)
- [ ] Create 6th campaign as GM (should fail)
- [ ] Update campaign settings (GM only)
- [ ] Non-GM attempts to update (should fail)
- [ ] Delete campaign with wrong confirmation text (should fail)
- [ ] Delete campaign with correct confirmation text
- [ ] Generate invite link
- [ ] Use invite link successfully
- [ ] Attempt to reuse invite link (should fail)
- [ ] Use expired invite link (should fail)
- [ ] Revoke invite link and attempt to use (should fail)
- [ ] Join campaign at 50-player limit (should fail gracefully)
- [ ] Pause campaign and verify time gate freezes
- [ ] Resume campaign and verify time gate resumes
- [ ] Transfer GM role voluntarily
- [ ] Claim abandoned GM role after 30 days

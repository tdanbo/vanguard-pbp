# Phase 10: Polish & Production

## Overview

Phase 10 focuses on GM moderation tools, game log and bookmarking features, rate limiting, and production deployment. This phase ensures the Vanguard PBP system is production-ready with proper tooling, performance optimization, and operational safeguards.

## Skills

This phase leverages all skills developed throughout the project:

- **go-api-server**: Backend API patterns and middleware
- **shadcn-react**: Frontend components and UI
- **supabase-integration**: Authentication and database integration
- **visibility-filter**: Witness-based filtering in game log
- **compose-lock**: Lock management and GM override
- **state-machine**: Phase transition constraints
- **notification-system**: Rate limiting integration
- **real-time-sync**: Real-time updates for GM tools

## PRD References

- **prd/core-concepts.md**: GM moderation, witness filtering
- **prd/turn-structure.md**: Phase constraints, GM tools
- **prd/scope.md**: Campaign limits, rate limiting
- **prd/technical.md**: Production deployment, monitoring
- **prd/information-architecture.md**: Game log, bookmarks

## Implementation Files

1. **01-gm-tools.md** - GM moderation capabilities
2. **02-game-log.md** - Game log and bookmark system
3. **03-rate-limiting.md** - Rate limiting implementation
4. **04-deployment.md** - Production deployment guide

## Key Features

### GM Moderation Tools

- Edit any post (before/after lock)
- Delete any post (unlocks previous post)
- "Edited by GM" badge
- Force-release compose lock
- Character type promotion/demotion (PC ↔ NPC)
- Restrictions: cannot edit rolls, cannot change witness lists retroactively

### Game Log & Bookmarks

- Character-scoped game log view
- Scene list with witnessed posts only
- Infinite scroll with recent-first ordering
- Jump to recent button
- Multi-character filtering
- Bookmark system (character, scene, post)
- Navigate to first/last encounter

### Rate Limiting

- Token bucket algorithm
- Endpoint-specific limits
- Rate limit headers (X-RateLimit-*)
- 429 responses with retry-after
- Per-user and per-IP limiting

### Production Deployment

- Railway configuration
- Environment variables
- Domain and SSL setup
- Health checks
- Monitoring and logging
- Database connection pooling
- Backup strategy

## Dependencies

- All previous phases (1-9)
- Railway deployment platform
- Production database (Supabase)
- Domain registration and DNS
- SSL certificate (automatic via Railway)
- Optional: Sentry for error tracking
- Optional: CDN for static assets

## Success Criteria

- [ ] GM can edit and delete posts with proper audit trail
- [ ] GM can force-release compose locks
- [ ] Game log displays character-scoped history
- [ ] Bookmarks navigate to correct positions
- [ ] Rate limiting prevents abuse
- [ ] Production deployment is stable and monitored
- [ ] Health checks return correct status
- [ ] Database backups run automatically
- [ ] Error tracking captures production issues
- [ ] Performance meets SLA (p95 < 500ms)

## Testing Strategy

- Unit tests for GM moderation logic
- Integration tests for rate limiting
- E2E tests for game log and bookmarks
- Load tests for production readiness
- Disaster recovery tests for backups
- Monitoring and alerting validation
- Security audit for GM permissions

## Security Considerations

- RLS policies enforce GM-only moderation
- Audit logging for all GM actions
- Rate limiting prevents abuse and DoS
- Production secrets in environment variables
- Database credentials rotated regularly
- API keys and JWT secrets secured
- CORS configuration for production domain

## Performance Considerations

- Database connection pooling (25 connections)
- Query optimization for game log
- Indexed queries for bookmarks
- Rate limit checks cached (Redis optional)
- CDN for static assets (optional)
- Gzip compression enabled
- Health check endpoint optimized
- Log aggregation for performance analysis

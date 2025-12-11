# Scope

What's in v1 and what's deferred.

## In Scope (v1)

### Core Features

- Campaign creation and invitation system
- Scene management (create, pause, archive)
- Turn-based play with player windows and GM resolution
- Sequential composing with compose locks
- Witness-based visibility system
- Pass mechanics (pass and hard pass)
- Configurable time gates
- Fog of war (optional per-campaign)
- Hidden actions (optional per-campaign)
- Intent tagging and dice rolling
- Game log with witness filtering

### User Management

- User registration and authentication
- Per-campaign player profiles (name, avatar)
- GM and player roles
- Invitation links for campaign joining

### Notifications

- In-app notifications
- Email notifications (configurable)
- Time gate warnings

### GM Tools

- Scene dashboard
- Player management
- Compose lock override
- Roll requests
- Content moderation

---

## Out of Scope (v1)

### Character Management

- **Character sheets:** Players manage characters externally (paper, D&D Beyond, custom tools)
- **Inventory tracking:** No built-in item management
- **HP/condition tracking:** No health or status systems

### Game Mechanics

- **System-specific rules:** No D&D, Pathfinder, FATE, etc. rule enforcement
- **Automated mechanics:** No automatic damage calculation, saving throws, etc.
- **Initiative systems:** Turn order is narrative, not mechanical

### Advanced Features

- **Maps and tokens:** No visual battlemap or positioning
- **Scheduled sessions:** No calendar integration for synchronous windows
- **Campaign templates:** No pre-built settings or scenarios
- **Public campaign directory:** No discovery/listing of public games
- **Search:** No full-text search in v1 (use bookmarks and filters instead)
- **Export:** No campaign/log export in v1

### Social Features

- **Player ratings/reputation:** No trust scores
- **Looking-for-group:** No player matching
- **Campaign cloning:** No forking of campaigns

### Mobile

- **Native mobile apps:** Web-responsive only for v1
- **Push notifications:** Email and in-app only

---

## Future Considerations (v2+)

### Near-Term

- Mobile-responsive improvements
- Push notifications
- Campaign export (PDF, archive)
- Full-text search in game logs

### Medium-Term

- Campaign templates and scenarios
- Public campaign directory
- Player reputation system
- Integration APIs for external tools
- Webhook support for automation

### Long-Term

- Native mobile apps
- Voice/video integration for hybrid sessions
- AI-assisted GM tools
- Plugin system for game-specific rules

---

## Success Criteria (v1)

### Functional

- A GM can create a campaign and invite players
- Players can join via link and set up their profile
- GM can create scenes and place characters
- Turn cycle functions correctly (window → turns → pass → resolution)
- Global turn synchronization works across all scenes
- Compose locks prevent race conditions
- Witness system correctly filters visibility
- Fog of war hides information appropriately
- Time gates auto-advance when expired
- Intent-based dice rolls work with predefined system presets
- Notifications arrive for key events
- GM can edit/delete turns for moderation

### Non-Functional

- Page load under 3 seconds
- API response time under 1 second
- Support 100-200 concurrent users
- Support 50+ concurrent campaigns
- 99.9% uptime target
- Mobile-usable (responsive, not native)

### Performance Expectations

Play-by-post RPGs are approached casually, not in real-time. Low load expected.
- WebSocket connections minimal (turn reminders, not constant sync)
- No high-performance optimization needed—rely on defaults
- Supabase free tier handles expected load easily

---

## Constraints

### Technical

- Must work in modern browsers (Chrome, Firefox, Safari, Edge)
- Must be accessible (WCAG 2.1 AA)
- Must handle intermittent connectivity gracefully

### Business

- Small team, focused scope
- Prioritize core loop over features
- Ship working product over perfect product

### User Experience

- Simple enough for non-technical GMs
- Clear mental model of witness/visibility
- Minimal clicks to post an action

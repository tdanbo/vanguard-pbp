# Change: Add Secrecy Settings Group to Campaign Settings

## Why

The campaign settings UI currently only exposes `oocVisibility` but not `fogOfWar` or `hiddenPosts`, even though these settings exist in the database and are core to the platform's anti-metagaming architecture. GMs need a way to configure these secrecy-related settings through the UI.

## What Changes

- Add a new "Secrecy Settings" card/section to the Campaign Settings page
- Expose `fogOfWar` toggle with description from PRD
- Expose `hiddenPosts` toggle with description from PRD
- Move `oocVisibility` into this section (currently in "Game Settings")
- Add descriptive help text for each setting based on PRD documentation

## Impact

- Affected code:
  - `services/frontend/src/pages/campaigns/CampaignSettings.tsx` - Add new settings section
  - Form schema update to include `fogOfWar` and `hiddenPosts`
- No backend changes required - settings already exist in database
- No database migrations required - fields already present

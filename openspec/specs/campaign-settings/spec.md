# campaign-settings Specification

## Purpose
TBD - created by archiving change add-secrecy-settings-group. Update Purpose after archive.
## Requirements
### Requirement: Secrecy Settings Section
The Campaign Settings page SHALL display a dedicated "Secrecy Settings" section that groups all visibility and privacy-related campaign settings together.

#### Scenario: GM views campaign settings
- **WHEN** a GM navigates to the Campaign Settings page
- **THEN** they see a "Secrecy Settings" card with Fog of War, Hidden Posts, and OOC Visibility options

### Requirement: Fog of War Toggle

The Secrecy Settings section SHALL include a Fog of War toggle switch that controls information visibility across scenes. **When enabled, visibility is scoped to the currently selected character, not aggregated across all owned characters.**

#### Scenario: GM enables Fog of War
- **WHEN** the GM toggles Fog of War to enabled
- **AND** saves the settings
- **THEN** the `fogOfWar` setting is saved as `true`
- **AND** players only see scenes where **their currently selected character** has witnessed posts

#### Scenario: Player selects character with no witnessed posts (ADDED)
- **GIVEN** Fog of War is enabled
- **AND** the player owns multiple characters
- **WHEN** the player selects a character that has not witnessed any posts in a scene
- **THEN** that scene is NOT displayed in the scene list
- **AND** selecting a different character that HAS witnessed posts in that scene WILL show the scene

#### Scenario: Player with no character selected (ADDED)
- **GIVEN** Fog of War is enabled
- **AND** the player has not selected a character
- **WHEN** the player views the campaign dashboard
- **THEN** they see scenes visible to ANY of their assigned characters (aggregate fallback)

#### Scenario: Fog of War description displayed (UNCHANGED)
- **WHEN** the Fog of War toggle is rendered
- **THEN** it displays the description: "Controls information visibility across scenes. When enabled, characters only see scenes where they have witnessed at least one post."

### Requirement: Hidden Posts Toggle
The Secrecy Settings section SHALL include a Hidden Posts toggle switch that controls whether players can submit secret posts visible only to the GM.

#### Scenario: GM enables Hidden Posts
- **WHEN** the GM toggles Hidden Posts to enabled
- **AND** saves the settings
- **THEN** the `hiddenPosts` setting is saved as `true`
- **AND** the hidden post option appears in the post composer

#### Scenario: GM disables Hidden Posts
- **WHEN** the GM toggles Hidden Posts to disabled
- **AND** saves the settings
- **THEN** the `hiddenPosts` setting is saved as `false`
- **AND** the hidden post option does not appear in the post composer

#### Scenario: Hidden Posts description displayed
- **WHEN** the Hidden Posts toggle is rendered
- **THEN** it displays the description: "Allows secret posts within a shared scene. When enabled, players can mark posts as hidden so only the GM sees them."

### Requirement: OOC Visibility Setting
The OOC Visibility setting SHALL be displayed within the Secrecy Settings section (moved from Game Settings) and control who can see out-of-character text on posts.

#### Scenario: OOC Visibility in Secrecy Settings
- **WHEN** the GM views the Campaign Settings page
- **THEN** the OOC Visibility dropdown appears in the Secrecy Settings section
- **AND** it displays the description: "Controls who can see out-of-character text on posts."

#### Scenario: GM sets OOC visibility to all players
- **WHEN** the GM selects "Visible to all players" for OOC Visibility
- **AND** saves the settings
- **THEN** the `oocVisibility` setting is saved as `all`

#### Scenario: GM sets OOC visibility to GM only
- **WHEN** the GM selects "GM only" for OOC Visibility
- **AND** saves the settings
- **THEN** the `oocVisibility` setting is saved as `gm_only`


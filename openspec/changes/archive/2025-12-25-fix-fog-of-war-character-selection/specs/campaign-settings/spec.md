# campaign-settings Spec Delta

This delta modifies the Fog of War behavior to scope visibility to the currently selected character.

## MODIFIED Requirements

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

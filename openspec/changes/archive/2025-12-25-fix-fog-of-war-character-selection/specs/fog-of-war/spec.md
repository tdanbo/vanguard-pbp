# fog-of-war Spec Delta

This delta adds character-scoped visibility API and empty state messaging.

## ADDED Requirements

### Requirement: Character-Scoped Scene Visibility API

The scenes listing API SHALL support an optional `characterId` query parameter for per-character visibility filtering.

#### Scenario: Player requests scenes with characterId parameter
- **GIVEN** Fog of War is enabled
- **AND** the player is not a GM
- **WHEN** the player requests `/api/v1/campaigns/{id}/scenes?characterId={uuid}`
- **AND** the character is assigned to the player
- **THEN** only scenes where that specific character has witnessed posts are returned

#### Scenario: Player requests scenes with unowned characterId
- **GIVEN** the player requests scenes with a characterId not assigned to them
- **WHEN** the API processes the request
- **THEN** a 403 Forbidden response is returned

#### Scenario: GM requests scenes with characterId parameter
- **GIVEN** the user is a GM
- **WHEN** they request scenes with any characterId parameter
- **THEN** the characterId is ignored
- **AND** all scenes are returned

#### Scenario: CharacterId with Fog of War disabled
- **GIVEN** Fog of War is disabled
- **WHEN** scenes are requested with a characterId parameter
- **THEN** the characterId is ignored
- **AND** all scenes are returned

### Requirement: Character-Specific Empty State

When character-scoped visibility results in no visible scenes, the UI SHALL display a character-specific message.

#### Scenario: No scenes visible to selected character
- **GIVEN** Fog of War is enabled
- **AND** the player has selected a character
- **AND** that character has not witnessed any posts
- **WHEN** the scene list is displayed
- **THEN** the empty state shows: "No scenes visible to {character name} yet"
- **AND** includes guidance: "Select a different character to see other scenes"

# fog-of-war Specification

## Purpose
TBD - created by archiving change implement-fog-of-war-filtering. Update Purpose after archive.
## Requirements
### Requirement: Scene Visibility with Fog of War

When the campaign's `fogOfWar` setting is enabled, the system SHALL restrict scene visibility for players based on their characters' witness history. A player SHALL only see scenes where at least one of their assigned characters has witnessed at least one post.

#### Scenario: GM sees all scenes regardless of fog of war

- **GIVEN** a campaign with `fogOfWar` enabled
- **AND** the campaign has 3 scenes with various posts
- **WHEN** the GM requests the scene list
- **THEN** all 3 scenes are returned
- **AND** the response includes scene metadata (title, description, character_ids)

#### Scenario: Player sees only witnessed scenes

- **GIVEN** a campaign with `fogOfWar` enabled
- **AND** the campaign has 3 scenes: "Tavern", "Forest", "Castle"
- **AND** the player controls character "Garrett"
- **AND** "Garrett" has witnessed posts in "Tavern" and "Forest"
- **AND** "Garrett" has not witnessed any posts in "Castle"
- **WHEN** the player requests the scene list
- **THEN** only "Tavern" and "Forest" are returned
- **AND** "Castle" is not included in the response

#### Scenario: Player with multiple characters sees union of visible scenes

- **GIVEN** a campaign with `fogOfWar` enabled
- **AND** the campaign has 3 scenes: "Tavern", "Forest", "Castle"
- **AND** the player controls characters "Garrett" and "Thorne"
- **AND** "Garrett" has witnessed posts in "Tavern"
- **AND** "Thorne" has witnessed posts in "Castle"
- **WHEN** the player requests the scene list
- **THEN** both "Tavern" and "Castle" are returned
- **AND** "Forest" is not included in the response

#### Scenario: Player with no character assignments sees no scenes

- **GIVEN** a campaign with `fogOfWar` enabled
- **AND** the campaign has active scenes
- **AND** the player has no character assignments
- **WHEN** the player requests the scene list
- **THEN** an empty scene list is returned

#### Scenario: Archived scenes are excluded from filtered results

- **GIVEN** a campaign with `fogOfWar` enabled
- **AND** scene "Old Tavern" is archived
- **AND** the player's character witnessed posts in "Old Tavern"
- **WHEN** the player requests the scene list
- **THEN** "Old Tavern" is not included in the response

### Requirement: Scene Visibility without Fog of War

When the campaign's `fogOfWar` setting is disabled, the system SHALL show all scenes to all campaign members.

#### Scenario: All members see all scenes when fog of war disabled

- **GIVEN** a campaign with `fogOfWar` disabled
- **AND** the campaign has 3 scenes
- **AND** a player has no character assignments
- **WHEN** the player requests the scene list
- **THEN** all 3 scenes are returned

### Requirement: Fog of War Empty State Messaging

When a player has no visible scenes due to fog of war filtering, the system SHALL display an informative empty state explaining why no scenes are visible.

#### Scenario: Empty state shows fog of war explanation

- **GIVEN** a campaign with `fogOfWar` enabled
- **AND** the player has a character assignment
- **AND** the character has not witnessed any posts in any scene
- **WHEN** the player views the campaign dashboard
- **THEN** an empty state message is displayed
- **AND** the message explains that scenes become visible when their character witnesses a post

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

### Requirement: GM Witness Editing

The GM SHALL be able to edit the witness list of any post for editorial corrections. This allows the GM to fix situations where witnesses were incorrectly assigned.

#### Scenario: GM adds a character as witness

- **GIVEN** the user is the campaign GM
- **AND** post has witnesses ["Garrett"]
- **AND** "Thorne" is in the scene but not a witness
- **WHEN** the GM opens the witness popover
- **AND** adds "Thorne" to the witness list
- **AND** saves the changes
- **THEN** the API is called with `PATCH /posts/:postId/witnesses`
- **AND** the post witnesses are updated to ["Garrett", "Thorne"]
- **AND** "Thorne" can now see the post

#### Scenario: GM removes a character from witnesses

- **GIVEN** the user is the campaign GM
- **AND** post has witnesses ["Garrett", "Thorne"]
- **WHEN** the GM opens the witness popover
- **AND** removes "Garrett" from the witness list
- **AND** saves the changes
- **THEN** the post witnesses are updated to ["Thorne"]
- **AND** "Garrett" can no longer see the post

#### Scenario: GM sets empty witness list

- **GIVEN** the user is the campaign GM
- **AND** post has witnesses ["Garrett"]
- **WHEN** the GM removes all witnesses
- **AND** saves the changes
- **THEN** the post witnesses are updated to []
- **AND** only the GM and post author can see the post

#### Scenario: Non-GM cannot edit witnesses

- **GIVEN** the user is a player (not GM)
- **WHEN** the user views the witness popover
- **THEN** no edit controls are displayed
- **AND** the witness list is read-only

#### Scenario: Witness update validates scene membership

- **GIVEN** the user is the campaign GM
- **AND** "Thorne" is NOT in the current scene
- **WHEN** the GM attempts to add "Thorne" as a witness
- **THEN** the API returns a 400 error
- **AND** the error message indicates the character is not in the scene

### Requirement: Witness Editing API

The backend SHALL provide an endpoint for updating post witnesses.

#### Scenario: PATCH witnesses endpoint success

- **GIVEN** a valid post ID and GM authorization
- **WHEN** `PATCH /api/v1/posts/:postId/witnesses` is called
- **AND** the request body contains `{ "witnesses": ["uuid-1", "uuid-2"] }`
- **THEN** the response is 200 OK
- **AND** the response contains the full updated post

#### Scenario: PATCH witnesses requires GM

- **GIVEN** a valid post ID
- **AND** the user is NOT the campaign GM
- **WHEN** `PATCH /api/v1/posts/:postId/witnesses` is called
- **THEN** the response is 403 Forbidden
- **AND** the error code is "NOT_GM"

#### Scenario: PATCH witnesses validates post exists

- **GIVEN** an invalid post ID
- **WHEN** `PATCH /api/v1/posts/:postId/witnesses` is called
- **THEN** the response is 404 Not Found


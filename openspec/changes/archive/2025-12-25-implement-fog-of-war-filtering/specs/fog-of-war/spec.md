## ADDED Requirements

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

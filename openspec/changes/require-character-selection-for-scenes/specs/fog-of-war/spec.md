## MODIFIED Requirements

### Requirement: Fog of War Empty State Messaging

When a player has no visible scenes due to fog of war filtering, the system SHALL display an informative empty state explaining why no scenes are visible. When fog of war is enabled and no character is selected, the system SHALL prompt the player to select a character before displaying scenes.

#### Scenario: Empty state shows fog of war explanation

- **GIVEN** a campaign with `fogOfWar` enabled
- **AND** the player has a character selected
- **AND** the character has not witnessed any posts in any scene
- **WHEN** the player views the campaign dashboard
- **THEN** an empty state message is displayed
- **AND** the message explains that scenes become visible when their character witnesses a post

#### Scenario: No character selected shows selection prompt

- **GIVEN** a campaign with `fogOfWar` enabled
- **AND** the player has character assignments
- **AND** no character is currently selected
- **WHEN** the player views the campaign dashboard
- **THEN** an empty state message is displayed
- **AND** the message prompts the player to select a character to view scenes
- **AND** no scenes are fetched or displayed

## REMOVED Requirements

### Requirement: Player with multiple characters sees union of visible scenes

**Reason**: Aggregate visibility across all characters creates implicit metagaming. Players should explicitly select which character's perspective to view, reinforcing the character-scoped experience.

**Migration**: Players must now select a character to see scenes. The ActiveCharacterBar already prompts for selection when none is chosen.

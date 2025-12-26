## MODIFIED Requirements

### Requirement: GM Edit Access on All Posts

The GM SHALL always have edit access to all posts in the campaign, regardless of lock status or ownership. Posts are never locked for the GM, and the lock icon SHALL NOT be displayed to GMs.

#### Scenario: GM sees edit button on any post

- **GIVEN** the user is the campaign GM
- **WHEN** viewing any post in any scene
- **THEN** a Pencil (edit) icon is displayed
- **AND** no Lock icon is ever shown to the GM

#### Scenario: GM can edit locked posts

- **GIVEN** the user is the campaign GM
- **AND** a post is locked for regular users (newer posts exist)
- **WHEN** the GM clicks the edit button
- **THEN** the post edit interface opens
- **AND** the GM can modify the post content

#### Scenario: GM reveals hidden post via witness editing

- **GIVEN** the user is the campaign GM
- **AND** a post is hidden (has no witnesses or only the poster)
- **WHEN** the GM opens the witness popover
- **AND** adds witnesses to the post
- **THEN** the post becomes visible to those witnesses
- **AND** no separate "Reveal" button is needed

#### Scenario: Lock icon only visible to players

- **GIVEN** a post is locked (newer posts exist)
- **WHEN** a player views the post
- **THEN** a Lock icon is displayed indicating the post cannot be edited
- **AND** when the GM views the same post, no Lock icon is shown

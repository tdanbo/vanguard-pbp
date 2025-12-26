# post-display Delta

## MODIFIED Requirements

### Requirement: GM Edit Access on All Posts

The GM SHALL always have edit access to all posts in the campaign, regardless of lock status or ownership. Posts are never locked for the GM. The "..." action menu SHALL always be visible to the GM on every post.

#### Scenario: GM sees action menu on any post

- **GIVEN** the user is the campaign GM
- **WHEN** viewing any post in any scene (locked or unlocked)
- **THEN** the "..." action menu is displayed
- **AND** the menu contains Edit and Delete options

#### Scenario: GM sees edit button on locked posts

- **GIVEN** the user is the campaign GM
- **AND** a post is locked for regular users (newer posts exist)
- **WHEN** the post is rendered
- **THEN** the "..." action menu is displayed
- **AND** clicking Edit opens the post in edit mode

#### Scenario: GM can cancel edit mode

- **GIVEN** the user is the campaign GM
- **AND** the GM has entered edit mode on any post
- **WHEN** the GM clicks the Cancel button
- **THEN** edit mode is exited
- **AND** the composer returns to its default state
- **AND** no changes are saved

### Requirement: Player Post Action Menu Visibility

Players SHALL only see the "..." action menu on posts they own that are both the most recent post AND not locked.

#### Scenario: Player sees action menu on their unlocked last post

- **GIVEN** the user is a player
- **AND** they are viewing their own post
- **AND** the post is the last post in the scene
- **AND** the post is not locked
- **WHEN** the post is rendered
- **THEN** the "..." action menu is displayed

#### Scenario: Player does not see action menu on locked posts

- **GIVEN** the user is a player
- **AND** they are viewing their own post
- **AND** the post is locked (newer posts exist)
- **WHEN** the post is rendered
- **THEN** no action menu is displayed

#### Scenario: Player does not see action menu on others' posts

- **GIVEN** the user is a player
- **AND** they are viewing another player's post
- **WHEN** the post is rendered
- **THEN** no action menu is displayed

### Requirement: Post Deletion via Action Menu Only

Post deletion SHALL only be accessible via the "..." action menu on the post card, not from within the composer.

#### Scenario: Delete option in action menu

- **GIVEN** a user has delete permission on a post
- **WHEN** they open the "..." action menu
- **THEN** a Delete option is available
- **AND** clicking it shows a confirmation dialog

#### Scenario: No delete button in edit composer

- **GIVEN** a user is editing a post
- **WHEN** the composer is displayed
- **THEN** no Delete button is shown in the composer
- **AND** the user must cancel edit and use the action menu to delete

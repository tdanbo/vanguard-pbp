# witness-viewer Specification

## Purpose
TBD - created by archiving change add-witness-viewer-button. Update Purpose after archive.
## Requirements
### Requirement: Witness Viewer Button on Posts

Each post SHALL display a small eye icon button that, when activated, shows the list of characters who witnessed that post.

#### Scenario: Player views witnesses on a visible post

- **GIVEN** a player is viewing a scene with posts
- **AND** the player can see a post (their character is a witness)
- **WHEN** the player clicks the eye icon button on that post
- **THEN** a popover appears showing the list of witness character names
- **AND** each character shows their avatar (or initials fallback)
- **AND** each character shows their type badge (PC/NPC)

#### Scenario: GM views witnesses on any post

- **GIVEN** a GM is viewing a scene with posts
- **WHEN** the GM clicks the eye icon button on any post
- **THEN** a popover appears showing the complete witness list
- **AND** all witnesses are shown regardless of visibility rules

#### Scenario: Post with multiple witnesses displays all

- **GIVEN** a post has 5 witness characters
- **WHEN** a user clicks the eye icon button
- **THEN** all 5 characters are displayed in the popover
- **AND** characters are listed in a readable format

#### Scenario: Popover closes on outside click

- **GIVEN** the witness popover is open
- **WHEN** the user clicks outside the popover
- **THEN** the popover closes

### Requirement: Witness Viewer Accessibility

The witness viewer button and popover SHALL be fully keyboard accessible and screen reader compatible.

#### Scenario: Keyboard navigation to witness button

- **GIVEN** a user is navigating via keyboard
- **WHEN** they tab to the witness button
- **THEN** the button receives visible focus
- **AND** pressing Enter or Space opens the popover

#### Scenario: Screen reader announces witness count

- **GIVEN** a screen reader user focuses the witness button
- **THEN** the button announces "View witnesses" or similar descriptive label

### Requirement: Witness Viewer Visual Design

The witness button SHALL be visually unobtrusive and consistent with the existing post UI.

#### Scenario: Button does not clutter post header

- **GIVEN** a post is displayed
- **THEN** the eye icon button is small and uses ghost/subtle styling
- **AND** the button does not compete visually with post content
- **AND** the button is positioned consistently across all posts

#### Scenario: Popover displays character information clearly

- **GIVEN** the witness popover is open
- **THEN** each witness shows: avatar (small), display name, and character type
- **AND** the layout is compact but readable
- **AND** the popover has a clear header like "Witnessed by"


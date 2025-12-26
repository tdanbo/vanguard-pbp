## MODIFIED Requirements

### Requirement: Edit Mode Behavior

Editing a post SHALL behave identically to taking a turn for new posts. The user acquires the compose lock, makes changes, and either submits or releases the lock to exit.

#### Scenario: Edit acquires lock directly

- **GIVEN** a user clicks Edit on a post they can edit
- **AND** no other user holds the compose lock
- **WHEN** the edit action is initiated
- **THEN** the compose lock is immediately acquired
- **AND** the composer opens with the post content loaded
- **AND** no intermediate "Edit Post" button is shown

#### Scenario: Edit blocked when lock is held

- **GIVEN** a user attempts to edit a post
- **AND** another user currently holds the compose lock
- **WHEN** the edit action is initiated
- **THEN** the lock acquisition fails
- **AND** the user sees the "X is composing..." locked state
- **AND** the user cannot enter edit mode

#### Scenario: Release button exits edit mode

- **GIVEN** a user is editing a post (has acquired the lock)
- **WHEN** the user clicks the Release button
- **THEN** the compose lock is released
- **AND** the edit mode is exited
- **AND** the post content reverts to its original state
- **AND** no Cancel button is shown (Release is the only exit option)

#### Scenario: No Cancel button in edit mode

- **GIVEN** a user is editing a post
- **WHEN** the composer is displayed
- **THEN** only a Release button is shown (not Cancel)
- **AND** the behavior matches taking a turn for a new post

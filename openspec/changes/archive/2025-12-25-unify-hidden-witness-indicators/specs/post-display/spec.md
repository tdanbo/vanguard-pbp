# post-display Specification Delta

## ADDED Requirements

### Requirement: Unified Hidden Post and Witness Indicator

When a post is hidden, the system SHALL display a single EyeOff icon that serves as both the hidden indicator and the witness viewer trigger. The icon SHALL NOT include a "Hidden" text label.

#### Scenario: Hidden post shows EyeOff icon without text

- **GIVEN** a user viewing a hidden post they can see (author or GM)
- **WHEN** the post is rendered
- **THEN** an EyeOff icon is displayed in the post header
- **AND** no "Hidden" text badge is shown

#### Scenario: Clicking EyeOff opens witness popover

- **GIVEN** a user viewing a hidden post with an EyeOff icon
- **WHEN** the user clicks the EyeOff icon
- **THEN** the witness popover opens
- **AND** the popover shows the current witness list (typically empty or poster only)

#### Scenario: Non-hidden post shows Eye icon

- **GIVEN** a user viewing a non-hidden post
- **WHEN** the post is rendered
- **THEN** an Eye icon is displayed (not EyeOff)
- **AND** clicking it opens the witness popover with the full witness list

### Requirement: Author Edit/Lock Visibility on Hidden Posts

The post author SHALL see the edit or lock indicator on their own hidden posts, consistent with non-hidden post behavior.

#### Scenario: Author sees edit icon on their hidden post

- **GIVEN** a player viewing their own hidden post
- **AND** the post is the last post in the scene
- **AND** the post is not locked
- **WHEN** the post is rendered
- **THEN** a Pencil (edit) icon is displayed
- **AND** clicking it allows editing the post

#### Scenario: Author sees lock icon on locked hidden post

- **GIVEN** a player viewing their own hidden post
- **AND** the post is locked (newer posts exist)
- **WHEN** the post is rendered
- **THEN** a Lock icon is displayed indicating the post cannot be edited

### Requirement: GM Edit Access on All Posts

The GM SHALL always have edit access to all posts in the campaign, regardless of lock status or ownership. Posts are never locked for the GM.

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

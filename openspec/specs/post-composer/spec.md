# post-composer Specification

## Purpose
TBD - created by archiving change improve-hidden-post-toggle-ux. Update Purpose after archive.
## Requirements
### Requirement: Hidden Post Toggle Visual Feedback

The post composer's hidden post toggle SHALL provide clear visual feedback indicating the current state and its implications.

#### Scenario: Hidden toggle in OFF state (default)

- **GIVEN** a player opens the post composer
- **AND** hidden posts are enabled in campaign settings
- **WHEN** the hidden toggle is OFF (default)
- **THEN** the toggle displays with a muted/default appearance
- **AND** the toggle shows "Visible to witnesses" or similar messaging
- **AND** the submit button shows "Submit Post"

#### Scenario: Hidden toggle in ON state

- **WHEN** the player enables the hidden toggle
- **THEN** the toggle displays with a distinct contrasting appearance (e.g., amber/warning color)
- **AND** the toggle shows "Hidden from players" or similar messaging
- **AND** an icon (e.g., lock or eye-off) indicates the hidden state
- **AND** the submit button changes to "Submit Hidden Post"

#### Scenario: Toggle provides mode explanation

- **GIVEN** the hidden toggle is displayed
- **THEN** helper text explains what the current mode means
- **AND** when OFF, text indicates "All witnesses will see this post"
- **AND** when ON, text indicates "Only the GM will see this until revealed"

### Requirement: Unified Submit Button

The post composer SHALL use a single submit button that reflects the current hidden state, rather than separate buttons for hidden and visible posts.

#### Scenario: Single submit button for all posts

- **GIVEN** hidden posts are enabled in campaign settings
- **WHEN** the post composer is displayed
- **THEN** only one submit button is shown
- **AND** the button label dynamically reflects whether the post will be hidden or visible
- **AND** hidden state is controlled entirely by the toggle

#### Scenario: Submit button visual indicator for hidden posts

- **WHEN** the hidden toggle is ON
- **THEN** the submit button includes a visual indicator (icon) showing it will be hidden
- **AND** the button may use a distinct style (e.g., secondary variant) to reinforce hidden mode


# fog-of-war Spec Delta

## ADDED Requirements

### Requirement: Character-Scoped Post Visibility

When viewing posts in a scene, the frontend SHALL pass the selected character ID to the posts API for proper witness filtering. Posts SHALL be refetched when the selected character changes.

#### Scenario: Player switches character and posts update

- **GIVEN** a player controls characters "Garrett" and "Thorne" in a scene
- **AND** "Garrett" has witnessed posts 1, 2, 3
- **AND** "Thorne" has witnessed posts 2, 3, 4
- **AND** the player is viewing the scene as "Garrett"
- **WHEN** the player switches to view as "Thorne"
- **THEN** the frontend refetches posts with `characterId=thorne-uuid`
- **AND** only posts 2, 3, 4 are displayed
- **AND** post 1 is no longer visible

#### Scenario: GM narrator mode shows all posts

- **GIVEN** the user is the campaign GM
- **AND** the GM has selected "Narrator" mode
- **WHEN** posts are fetched
- **THEN** no characterId parameter is passed
- **AND** all posts in the scene are returned
- **AND** the backend returns unfiltered posts

#### Scenario: Initial load uses selected character

- **GIVEN** a player controls character "Garrett"
- **AND** "Garrett" has witnessed posts 1, 2, 3 (but not 4, 5)
- **WHEN** the scene view first loads
- **THEN** posts are fetched with `characterId=garrett-uuid`
- **AND** only posts 1, 2, 3 are displayed

---

## ADDED Requirements

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

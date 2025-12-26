# Spec: Scene Settings Menu

## ADDED Requirements

### Requirement: Scene Settings Menu Component

The system SHALL provide a SceneSettingsMenu component that offers quick access to scene management actions from the campaign dashboard.

#### Scenario: GM views scene card with settings menu
- **Given** user is the campaign GM
- **And** viewing the campaign dashboard
- **When** the scene cards are displayed
- **Then** each scene card shows a settings menu trigger in the lower-right corner

#### Scenario: Non-GM user does not see settings menu
- **Given** user is a campaign player (not GM)
- **When** viewing scene cards on the campaign dashboard
- **Then** no settings menu trigger is visible

#### Scenario: Settings menu contains expected options
- **Given** user is GM
- **When** clicking the settings menu trigger
- **Then** a dropdown menu appears with options:
  - "Edit Scene" (navigates to full settings page)
  - "Archive Scene" or "Unarchive Scene" (based on current state)
  - "Delete Scene" (destructive action)

### Requirement: Delete Scene Functionality

The system SHALL allow GMs to permanently delete a scene and all its content, with title confirmation to prevent accidental deletion.

#### Scenario: GM initiates scene deletion
- **Given** user is GM
- **And** settings menu is open
- **When** clicking "Delete Scene"
- **Then** a confirmation dialog appears
- **And** the dialog warns that deletion is permanent

#### Scenario: Delete requires title confirmation
- **Given** delete confirmation dialog is open
- **And** the scene title is "The Dark Forest"
- **When** user has not typed the scene title
- **Then** the "Delete" button is disabled
- **When** user types "The Dark Forest" exactly
- **Then** the "Delete" button becomes enabled

#### Scenario: Successful scene deletion
- **Given** user has confirmed deletion with correct title
- **When** clicking the enabled "Delete" button
- **Then** the scene is deleted from the database
- **And** the scene header image is deleted from storage (if present)
- **And** the scene is removed from the campaign dashboard
- **And** a success toast is displayed

#### Scenario: Delete scene API response
- **Given** DELETE request to `/api/v1/campaigns/:id/scenes/:sceneId`
- **And** user is campaign GM
- **When** the scene exists
- **Then** respond with `204 No Content`
- **And** decrement campaign.scene_count

#### Scenario: Non-GM cannot delete scene
- **Given** DELETE request to `/api/v1/campaigns/:id/scenes/:sceneId`
- **And** user is not campaign GM
- **Then** respond with `403 Forbidden`
- **And** error code "NOT_GM"

### Requirement: Archive Scene from Menu

The system SHALL allow GMs to archive or unarchive scenes directly from the settings menu without navigating to the full settings page.

#### Scenario: GM archives scene from menu
- **Given** settings menu is open for a non-archived scene
- **When** clicking "Archive Scene"
- **Then** the scene is archived
- **And** the scene card updates to show archived state
- **And** a success toast is displayed

#### Scenario: GM unarchives scene from menu
- **Given** settings menu is open for an archived scene
- **When** clicking "Unarchive Scene"
- **Then** the scene is unarchived
- **And** the scene card updates to show active state
- **And** a success toast is displayed

### Requirement: Edit Scene Navigation

The system SHALL provide navigation to the full scene settings page from the settings menu.

#### Scenario: GM navigates to full settings page
- **Given** settings menu is open
- **When** clicking "Edit Scene"
- **Then** user is navigated to `/campaigns/:id/scenes/:sceneId/settings`

## REMOVED Requirements

### Requirement: View Roster Action

The "View Roster" action SHALL be removed from scene management. Character roster management is handled through the CharacterAssignmentWidget on scene cards during GM Phase.

#### Scenario: View Roster not present in menu
- **Given** user is GM
- **When** opening the scene settings menu
- **Then** "View Roster" option is not present

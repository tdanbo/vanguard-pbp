# Tasks: Add Secrecy Settings Group

## 1. Frontend Implementation

- [x] 1.1 Update settings form schema to include `fogOfWar` (boolean) and `hiddenPosts` (boolean)
- [x] 1.2 Add form default values for `fogOfWar` and `hiddenPosts` from campaign data
- [x] 1.3 Create "Secrecy Settings" Card section in CampaignSettings.tsx
- [x] 1.4 Add Fog of War switch with description: "Controls information visibility across scenes. When enabled, characters only see scenes where they have witnessed at least one post."
- [x] 1.5 Add Hidden Posts switch with description: "Allows secret posts within a shared scene. When enabled, players can mark posts as hidden so only the GM sees them."
- [x] 1.6 Move OOC Visibility select into Secrecy Settings section with updated description: "Controls who can see out-of-character text on posts."
- [x] 1.7 Update form submission to include `fogOfWar` and `hiddenPosts` in settings payload

## 2. Validation

- [x] 2.1 Verify settings save correctly and persist on page reload
- [x] 2.2 Verify default values load correctly for existing campaigns
- [x] 2.3 Test that toggling Fog of War affects post visibility in scenes
- [x] 2.4 Test that toggling Hidden Posts enables/disables hidden post option in composer

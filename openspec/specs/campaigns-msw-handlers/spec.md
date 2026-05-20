### Requirement: MSW handlers cover all /campaigns routes used in this slice
The MSW mock layer SHALL include in-memory handlers for the following routes, registered in `src/mocks/handlers/campaigns.handlers.ts` and merged into the main handlers array in `src/mocks/browser.ts`:

- `GET /campaigns` — returns the current in-memory campaign array
- `POST /campaigns` — creates a new campaign (generates a UUID `id`), appends to the array, returns the created campaign
- `GET /campaigns/:id` — returns the matching campaign or 404
- `PUT /campaigns/:id` — merges `{ name, isPublic }` into the matching campaign, returns the updated campaign or 404
- `DELETE /campaigns/:id` — removes the campaign from the array, returns 204 or 404
- `POST /campaigns/:id/activate` — toggles `isActive` on the matching campaign, returns the updated campaign or 404

The in-memory array SHALL be seeded with at least two fixture campaigns (one active/public, one inactive/private) so the list page renders meaningful data on first load.

#### Scenario: GET /campaigns returns the fixture list
- **WHEN** a client issues `GET /campaigns`
- **THEN** MSW returns an array containing at least the seeded fixture campaigns with 200

#### Scenario: POST /campaigns creates and returns a campaign
- **WHEN** a client issues `POST /campaigns` with `{ name: "Test", isActive: false, isPublic: false }`
- **THEN** MSW creates the campaign with a generated id, appends it to the in-memory array, and returns the created object with 201

#### Scenario: PUT /campaigns/:id updates fields
- **WHEN** a client issues `PUT /campaigns/:id` with `{ name: "Renamed" }`
- **THEN** MSW updates the campaign in the array and returns the updated object; a subsequent `GET /campaigns` reflects the change

#### Scenario: DELETE /campaigns/:id removes the campaign
- **WHEN** a client issues `DELETE /campaigns/:id`
- **THEN** MSW removes the campaign from the array and returns 204; a subsequent `GET /campaigns` does not include it

#### Scenario: POST /campaigns/:id/activate toggles isActive
- **WHEN** a client issues `POST /campaigns/:id/activate` for a campaign with `isActive: true`
- **THEN** MSW sets `isActive: false` on the campaign and returns the updated object; a subsequent `GET /campaigns` reflects the change

#### Scenario: Unknown campaign id returns 404
- **WHEN** a client issues any request targeting `campaigns/:id` with a non-existent id
- **THEN** MSW returns a 404 response

### Requirement: MSW handlers cover the /campaigns/:id/players sub-resource
The MSW mock layer SHALL extend `src/mocks/handlers/campaigns.handlers.ts` with in-memory handlers for the campaign-players sub-resource:

- `GET /campaigns/:id/players` — returns the array of player users currently assigned to the campaign, each entry shaped as `{ id, username, role }` (no password)
- `POST /campaigns/:id/players` — accepts `{ playerId }`, validates that the campaign exists, validates that a user with that id exists and has `role === 'player'`, then appends the association; returns the assigned user with 201. Re-assigning an already-assigned player SHALL be idempotent (return 201 or 200 without creating a duplicate).
- `DELETE /campaigns/:id/players/:playerId` — removes the association; returns 204 or 404 if the campaign or the assignment does not exist

The in-memory association store SHALL be seeded so at least one fixture campaign has at least one fixture player assigned, so both panels (`<app-user-campaigns-panel>` and `<app-campaign-players-panel>`) render meaningful data on first load.

#### Scenario: GET /campaigns/:id/players returns the seeded assignments
- **WHEN** a client issues `GET /campaigns/:id/players` for a campaign with two assigned players
- **THEN** MSW returns an array of two `{ id, username, role: 'player' }` objects with 200

#### Scenario: POST /campaigns/:id/players assigns a player
- **WHEN** a client issues `POST /campaigns/:id/players` with `{ playerId: "<existing-player-id>" }`
- **THEN** MSW appends the association and returns the assigned user with 201; a subsequent `GET /campaigns/:id/players` includes the player

#### Scenario: POST rejects non-existent players
- **WHEN** a client issues `POST /campaigns/:id/players` with a `playerId` that does not match any user
- **THEN** MSW returns a 404

#### Scenario: POST rejects admins
- **WHEN** a client issues `POST /campaigns/:id/players` with the id of a user whose role is `admin`
- **THEN** MSW returns a 400 (or 422) and does not assign the user

#### Scenario: POST is idempotent for already-assigned players
- **WHEN** a client issues `POST /campaigns/:id/players` for a player that is already assigned to the campaign
- **THEN** MSW returns a 2xx response and `GET /campaigns/:id/players` still contains exactly one entry for that player

#### Scenario: DELETE removes the association
- **WHEN** a client issues `DELETE /campaigns/:id/players/:playerId` for an existing assignment
- **THEN** MSW removes the association and returns 204; a subsequent `GET /campaigns/:id/players` does not include the player

#### Scenario: DELETE on missing assignment returns 404
- **WHEN** a client issues `DELETE /campaigns/:id/players/:playerId` for a `(campaign, player)` pair that has no association
- **THEN** MSW returns a 404

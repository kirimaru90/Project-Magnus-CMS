### Requirement: MSW handlers cover all terminal routes used in this slice
The MSW mock layer SHALL register handlers for the following routes, registered in `src/mocks/browser.ts` via a module `src/mocks/handlers/terminals.handlers.ts`:

- `GET /campaigns/:campaignId/terminals`
- `POST /campaigns/:campaignId/terminals`
- `POST /campaigns/:campaignId/terminals/import`
- `GET /terminals/:id`
- `DELETE /terminals/:id`
- `POST /terminals/:id/export`

#### Scenario: Handlers registered with the mock service worker
- **WHEN** the application boots with MSW enabled
- **THEN** none of the above routes fall through to the real network; each is served by an in-memory handler

### Requirement: In-memory store seeded with fixture terminals
On MSW initialization, the terminals store SHALL be seeded with at least two fixture terminals belonging to the first fixture campaign defined by `campaigns.handlers.ts`. The fixtures SHALL each satisfy `TerminalContentSchema`.

#### Scenario: Seeded list returns at least two terminals for first campaign
- **WHEN** the client calls `GET /campaigns/<first-fixture-id>/terminals` against MSW
- **THEN** the response is an array containing at least two terminals, each conforming to `TerminalContentSchema`

### Requirement: List rows expose codename, timestamps, and views
The `GET /campaigns/:campaignId/terminals` handler SHALL return each terminal as a list-view row (`TerminalDto`) carrying, in addition to `id` and `meta`: a `hiddenId` (codename) string, a `createdAt` timestamp, an `updatedAt` timestamp, and an optional `views` count. These are list-view sidecar fields stored alongside the canonical `TerminalContent`, not part of `TerminalContentSchema`. Seeded fixtures SHALL include at least one terminal with a defined `views` value and at least one with `views` left undefined.

#### Scenario: List rows carry the sidecar fields
- **WHEN** the client calls `GET /campaigns/<first-fixture-id>/terminals` against MSW
- **THEN** each returned row includes `hiddenId`, `createdAt`, and `updatedAt`
- **AND** at least one seeded row omits `views` while at least one provides a numeric `views`

### Requirement: Create handler assigns an id and stores under the campaign
The `POST /campaigns/:campaignId/terminals` handler SHALL accept any body conforming to `TerminalContentSchema`, assign a fresh id (via `crypto.randomUUID()`) and a generated `hiddenId` codename, set `createdAt` and `updatedAt` to the current time and `views` to `0`, associate it with the path's `campaignId`, append it to the in-memory store, and return 201 with the stored entry.

#### Scenario: Create returns 201 with stored body
- **WHEN** the client POSTs a valid stub to `/campaigns/c1/terminals`
- **THEN** the response status is 201 and the returned body has an `id` distinct from the request body's `meta.id`
- **AND** a subsequent `GET /campaigns/c1/terminals` includes the new entry

### Requirement: Import handler accepts a full terminal verbatim
The `POST /campaigns/:campaignId/terminals/import` handler SHALL behave identically to the create handler but accept the full terminal content as the request body without further validation. The in-memory record SHALL always be assigned a fresh server-side id, regardless of the request body's `meta.id`.

#### Scenario: Import assigns a new id even when meta.id is present
- **WHEN** the client POSTs a valid terminal with `meta.id = "demo"` to `/campaigns/c1/terminals/import`
- **THEN** the response 201 includes a `meta.id` distinct from `"demo"` (assigned server-side)
- **AND** a subsequent `GET /campaigns/c1/terminals` includes the new entry alongside any existing ones

### Requirement: Detail and delete handlers operate by terminal id
- `GET /terminals/:id` SHALL return the stored content for the matching id, or 404 if absent.
- `DELETE /terminals/:id` SHALL remove the matching id from the store and respond 204, or 404 if absent.

#### Scenario: Detail returns stored content
- **WHEN** the client calls `GET /terminals/<existing-id>`
- **THEN** the response status is 200 and the body matches the stored `TerminalContent`

#### Scenario: Detail returns 404 for unknown id
- **WHEN** the client calls `GET /terminals/does-not-exist`
- **THEN** the response status is 404

#### Scenario: Delete removes and returns 204
- **WHEN** the client calls `DELETE /terminals/<existing-id>`
- **THEN** the response status is 204 and a subsequent `GET /terminals/<existing-id>` returns 404

### Requirement: Export handler returns the stored content
The `POST /terminals/:id/export` handler SHALL respond 200 with the stored `TerminalContent` as the JSON body, or 404 if the id is unknown.

#### Scenario: Export returns the stored body
- **WHEN** the client POSTs to `/terminals/<existing-id>/export`
- **THEN** the response body equals the same object returned by `GET /terminals/<existing-id>`

#### Scenario: Export of unknown id returns 404
- **WHEN** the client POSTs to `/terminals/does-not-exist/export`
- **THEN** the response status is 404

### Requirement: PUT /terminals/:id updates stored content
The MSW mock layer SHALL handle `PUT /terminals/:id`. The handler SHALL accept a Terminal Content body and, when the id exists in the in-memory store, overwrite that record's `content` with the body, preserve the server-side fields (`id`, `campaignId`, `createdAt`, `views`), set `updatedAt` to the current time, and return the updated content with a 200 status. When the id does not exist, the handler SHALL return 404. The handler SHALL NOT re-validate the body against the Zod schema (the client validator is authoritative in dev).

#### Scenario: Save updates the record
- **WHEN** a `PUT /terminals/:id` request is made with edited content for an existing terminal
- **THEN** the handler stores the new content, bumps `updatedAt`, and a subsequent `GET /terminals/:id` returns the edited content

#### Scenario: Server fields preserved
- **WHEN** content is saved via `PUT /terminals/:id`
- **THEN** the record's `id`, `campaignId`, `createdAt`, and `views` are unchanged from before the save

#### Scenario: Export reflects the save
- **WHEN** content is saved and the terminal is then exported via `POST /terminals/:id/export`
- **THEN** the exported JSON matches the saved content

#### Scenario: Unknown id returns 404
- **WHEN** a `PUT /terminals/:id` request targets an id not in the store
- **THEN** the handler responds with 404 and no record is created

### Requirement: meta.id is server-owned; hiddenId is author-owned content
The mock SHALL treat `meta.id` as a server-owned identifier: it SHALL strip `meta.id` from any create/import/update body before storing, SHALL inject `meta.id` (equal to the record's API id) into the content returned by `GET /terminals/:id` and the `PUT` response, and SHALL omit `meta.id` from the `POST /terminals/:id/export` body. The DTO's `hiddenId` SHALL be sourced from `content.meta.hiddenId` (not a server-generated codename). A non-empty `meta.hiddenId` SHALL be unique within its campaign; create/import/update SHALL return 409 when it collides with another terminal in the same campaign.

#### Scenario: id injected on read, stripped on write
- **WHEN** a terminal is created/imported/updated and then read via `GET /terminals/:id`
- **THEN** the stored content carries no `meta.id`, and the read response includes `meta.id` equal to the record's API id

#### Scenario: Export omits the API id
- **WHEN** a terminal is exported via `POST /terminals/:id/export`
- **THEN** the exported content has no `meta.id` and still carries `meta.hiddenId` when one was authored

#### Scenario: Duplicate hiddenId rejected
- **WHEN** a create/import/update sets a `meta.hiddenId` already used by another terminal in the same campaign
- **THEN** the handler responds with 409 and the store is unchanged

### Requirement: Resolve a terminal by hiddenId
The mock SHALL handle `GET /campaigns/:campaignId/terminals/by-hidden-id/:hiddenId` — the only endpoint keyed on `hiddenId` — returning the matching terminal's DTO, or 404 when no terminal in that campaign has the given `hiddenId`.

#### Scenario: Resolve existing hiddenId
- **WHEN** a `GET /campaigns/:campaignId/terminals/by-hidden-id/:hiddenId` request targets an existing slug in that campaign
- **THEN** the handler returns that terminal's DTO (including its server-owned `id`)

#### Scenario: Unknown hiddenId returns 404
- **WHEN** the requested `hiddenId` does not exist in the campaign
- **THEN** the handler responds with 404

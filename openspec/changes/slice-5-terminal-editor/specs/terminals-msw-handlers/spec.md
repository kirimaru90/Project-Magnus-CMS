## ADDED Requirements

### Requirement: PUT /terminals/:id updates stored content
The MSW mock layer SHALL handle `PUT /terminals/:id`. The handler SHALL accept a Terminal Content body and, when the id exists in the in-memory store, overwrite that record's `content` with the body, preserve the server-side sidecar fields (`id`, `campaignId`, `hiddenId`, `createdAt`, `views`), set `updatedAt` to the current time, and return the updated content with a 200 status. When the id does not exist, the handler SHALL return 404. The handler SHALL NOT re-validate the body against the Zod schema (the client validator is authoritative in dev).

#### Scenario: Save updates the record
- **WHEN** a `PUT /terminals/:id` request is made with edited content for an existing terminal
- **THEN** the handler stores the new content, bumps `updatedAt`, and a subsequent `GET /terminals/:id` returns the edited content

#### Scenario: Sidecar fields preserved
- **WHEN** content is saved via `PUT /terminals/:id`
- **THEN** the record's `id`, `campaignId`, `hiddenId`, `createdAt`, and `views` are unchanged from before the save

#### Scenario: Export reflects the save
- **WHEN** content is saved and the terminal is then exported via `POST /terminals/:id/export`
- **THEN** the exported JSON matches the saved content

#### Scenario: Unknown id returns 404
- **WHEN** a `PUT /terminals/:id` request targets an id not in the store
- **THEN** the handler responds with 404 and no record is created

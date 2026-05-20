# Backoffice MVP — Sliced Plan

This document is the implementation roadmap for the **MAGNUS-CMS Backoffice** (admin web app
for the RobCo Terminal Simulator). Each slice has a ready-to-use prompt for
`/opsx:propose` so a full OpenSpec change can be generated per slice.

---

## Context (shared across all slices)

**Reference artifacts in this repo:**

- Architecture: `reference/robco-terminal-architecture.md`
- API contract: `reference/API-docs.json` (raw OpenAPI 3.0.0) + `reference/Swagger API.html` (rendered)
- Stack proposal: `reference/stack proposal.md`

**Locked decisions (confirmed during explore):**

| Topic | Decision |
|---|---|
| Framework | Angular (latest stable), Standalone Components, Signals |
| Forms | Reactive Forms (recursive: nodes / choices / conditions / mutations) |
| Schema validation | Zod (canonical TS+Zod model lives inside this repo; no shared package) |
| Components | PrimeNG (Aura theme) — no PrimeFlex |
| Layout / utilities | Tailwind (CSS layers configured so PrimeNG wins in component scope) |
| HTTP | Angular HttpClient + RxJS, Bearer-token interceptor |
| State management | Signal services + Reactive Form state. **No NgRx.** |
| Mock API (dev) | MSW (or equivalent) driven by `reference/API-docs.json` |
| Auth | JWT, 24h lifetime, Bearer header. No refresh token. Logout is client-side (204). |
| Fictional credentials | **Stored cleartext, never hashed.** Admin sees them in the editor. API strips them before delivering content to the Terminal. |
| Editor mode (MVP) | Form-based only. No visual graph. |

**Open items deferred to later (NOT MVP scope):**

- Visual node graph editor (Twine/Rete.js)
- Live preview during authoring
- Audit log
- Auto-save drafts
- Backup / restore
- Per-terminal version history

---

## Slice overview

| # | Slice | Depends on | Effort |
|---|---|---|---|
| 1 | Bootstrap + Auth shell | — | M |
| 2 | Campaigns | 1 | M |
| 3 | Users + Assignments | 1 (2 optional) | M |
| 4 | Terminals — list + JSON I/O | 2 | M |
| 5 | Terminal editor — form-based | 4 | **XL** (likely sub-slice during propose) |
| 6 | State viewer/editor + Resets | 4 | M |

> Slices 3 and 4 are independent and can run in parallel once Slice 2 lands.
> Slice 5 is the heaviest; the proposer should consider sub-splitting (5a metadata/state/users, 5b nodes & choices, 5c condition & mutation editors).

---

## Slice 1 — Bootstrap + Auth shell

**Scope**
- Initialize Angular workspace with Standalone bootstrap and Signals
- Add PrimeNG (Aura theme), Tailwind (no PrimeFlex, CSS layers configured), Zod
- ESLint + Prettier + strict TypeScript
- Environment config (`environment.ts` with API base URL)
- Generated TypeScript client + types from `reference/API-docs.json` (codegen tool of proposer's choice — `orval`, `openapi-typescript`, or `ng-openapi-gen`)
- MSW mock layer for `/auth/login`, `/auth/logout`, `/auth/me`
- Login screen (plain admin aesthetic — **not** the CRT look)
- `AuthService` signal-based (`isAuthenticated`, `currentUser`)
- HTTP interceptor: attach Bearer token, on 401 clear state + redirect to login
- Route guard: redirect unauthenticated to `/login`
- App shell: topbar (user menu + logout) + sidebar (placeholder items) + router outlet
- Empty placeholder route for `/campaigns` and `/users`

**Out of scope**
- Any business CRUD (campaigns, users, terminals)
- The campaign switcher UI (stub the signal only)

**Acceptance**
- `npm install && npm start` boots Angular against MSW mocks
- Visiting `/` redirects to `/login`
- Logging in (any creds, MSW responds with a fake JWT) lands on `/campaigns` (empty page)
- Refreshing the page restores session from stored token via `GET /auth/me`
- Logout clears token and redirects to `/login`

**Propose prompt** *(paste verbatim after `/opsx:propose`):*

```
Bootstrap the MAGNUS-CMS Backoffice Angular workspace and the auth shell.

Scope:
- Angular (latest stable) workspace, standalone components, signals, strict TS, ESLint, Prettier.
- Add PrimeNG (Aura theme) for components and Tailwind for layout/utilities. Do NOT add PrimeFlex. Configure CSS layers so PrimeNG's component styles win in component scope and Tailwind utilities win at the application layer. Either disable Tailwind preflight or scope it carefully.
- Add Zod.
- Generate a typed TypeScript API client and DTOs from reference/API-docs.json. The proposer chooses the tool (orval / openapi-typescript / ng-openapi-gen) and explains the choice in design.md. Generated artifacts must be committed and regenerable via an npm script.
- Add MSW (or equivalent) as the dev-time mock layer, seeded from reference/API-docs.json. Implement mocks for POST /auth/login, POST /auth/logout, GET /auth/me only in this slice.
- Implement AuthService as a signal-based service exposing { isAuthenticated, currentUser, token }. Persist the JWT in localStorage. On app start, if a token exists, call GET /auth/me to restore session; on 401, clear state.
- Implement an HttpInterceptor that attaches the Bearer token to API calls and on 401 clears auth state and redirects to /login.
- Implement a CanActivate guard that redirects unauthenticated users to /login.
- Login screen: plain admin aesthetic (NOT the Fallout CRT look — the CRT is only for the player-facing Terminal app). Standard PrimeNG form with username + password, displays error on failed login.
- App shell with PrimeNG: topbar showing current user + logout button, sidebar with placeholder nav items for Campaigns and Users, main router outlet.
- Empty placeholder routes for /campaigns and /users that just render a heading.

Out of scope: any business CRUD (campaigns, users, terminals), the current-campaign workspace switcher UI (stub the signal service only).

Context:
- Full architecture: reference/robco-terminal-architecture.md
- API spec: reference/API-docs.json (Bearer JWT, 24h, logout is stateless 204, no refresh token)
- Locked stack & decisions: reference/backoffice-mvp-plan.md

Acceptance:
- npm install && npm start boots the app against MSW mocks
- Visiting / redirects to /login
- Login succeeds, navigates to /campaigns placeholder
- Page refresh restores session via /auth/me; logout returns to /login
- Lint and typecheck pass
```

---

## Slice 2 — Campaigns

**Scope**
- Campaigns list page (PrimeNG table) — shows all campaigns visible to the admin (active and inactive)
- Create campaign dialog (name, optional `is_active`, optional `is_public`)
- Edit campaign (rename, toggle `is_public`)
- Toggle `is_active` via `POST /campaigns/:id/activate`
- Delete campaign with confirmation
- **Current-campaign signal service** — the workspace context that subsequent slices consume
- Workspace switcher UI: in topbar or sidebar (proposer decides), persists selection in localStorage so it survives reloads
- MSW mocks for the full `/campaigns` route family

**Out of scope**
- Campaign players (Slice 3)
- Terminals inside a campaign (Slice 4)
- Campaign state (Slice 6)

**Acceptance**
- Admin can list, create, rename, delete campaigns
- Toggling active/public reflects in the list
- Selecting a campaign in the switcher updates the current-campaign signal
- Refreshing the page restores the selected campaign

**Propose prompt:**

```
Add Campaigns CRUD and the current-campaign workspace context to MAGNUS-CMS Backoffice.

Scope:
- Campaigns list page at /campaigns using a PrimeNG table. Shows all campaigns visible to the admin (active and inactive). Columns include name, is_active, is_public, and row actions.
- Create campaign: PrimeNG dialog, Reactive Form (name required, is_active and is_public optional booleans, both default false), Zod validation before submit.
- Edit campaign: rename and toggle is_public via PUT /campaigns/:id.
- Toggle is_active via POST /campaigns/:id/activate.
- Delete campaign with a PrimeNG ConfirmDialog. The confirmation message warns that terminals and state belonging to the campaign will be lost.
- Implement CurrentCampaignService — a signal-based service exposing { currentCampaign, setCurrent, clear }. Persist the selected campaign id in localStorage and rehydrate on app start. Subsequent slices (Terminals, State) consume this signal.
- UI affordance for switching the current campaign — proposer decides between a topbar dropdown and a sidebar workspace switcher; document the choice in design.md.
- Extend the MSW mock layer with handlers for all /campaigns routes used in this slice (list, create, get, update, delete, activate). In-memory state is fine — it does not need to persist across MSW restarts.

Out of scope: campaign players, terminals inside a campaign, campaign state.

Context:
- Slice 1 (bootstrap + auth) is complete: app shell, auth, MSW infra, generated client all exist.
- API spec: reference/API-docs.json — endpoints under the "campaigns" tag.
- Plan: reference/backoffice-mvp-plan.md

Acceptance:
- Admin can list, create, rename, delete campaigns
- Toggling active/public reflects in the list immediately
- Selecting a campaign in the switcher updates the CurrentCampaignService signal
- Reloading the page restores the previously selected campaign
- Lint and typecheck pass
```

---

## Slice 3 — Users + Assignments

**Scope**
- Users list page (PrimeNG table)
- Create user (username, role admin/player, initial password)
- Edit user (rename, change role, reset password)
- Delete user with confirmation
- For player users: assign / unassign to campaigns (multi-select against the campaigns list)
- MSW mocks for `/users/*` and `/campaigns/:id/players/*`

**Out of scope**
- Anything terminal-related

**Acceptance**
- Admin can manage users and their roles
- Admin can assign players to multiple campaigns and remove them
- A campaign's player list is visible from the user detail screen *and* from the campaign detail screen

**Propose prompt:**

```
Add Users CRUD and Campaign Player Assignments to MAGNUS-CMS Backoffice.

Scope:
- Users list page at /users using a PrimeNG table. Columns include username, role, action buttons. Lists both admin and player users.
- Create user: PrimeNG dialog with Reactive Form (username required, role required as a select of 'admin' | 'player', password required on creation). Zod-validated.
- Edit user: rename, change role, reset password. Password reset is a separate action that posts a new password without revealing the current one.
- Delete user with PrimeNG ConfirmDialog.
- Campaign assignments for player users:
  - From the user detail view, show the list of campaigns the player is assigned to with the ability to add or remove memberships (multi-select picker against the campaigns list).
  - From the campaign detail view (Slice 2 extension): show the list of assigned players with add/remove controls.
  - Use GET /campaigns/:id/players, POST /campaigns/:id/players, DELETE /campaigns/:id/players/:playerId.
- Hide assignment controls for admin users (admins have implicit access to all campaigns).
- Extend MSW mock handlers for all /users routes and the campaign players endpoints.

Out of scope: anything terminal-related, campaign state.

Context:
- Slices 1 and 2 complete. Auth, app shell, campaigns CRUD, current-campaign service all exist.
- API spec: reference/API-docs.json — "users" tag and campaign players endpoints.
- Plan: reference/backoffice-mvp-plan.md

Acceptance:
- Admin can manage users (create, rename, role change, password reset, delete)
- Admin can assign and unassign players to campaigns from both the user detail and campaign detail views
- Role changes immediately affect the UI (e.g., admin → player exposes the assignments panel)
- Lint and typecheck pass
```

---

## Slice 4 — Terminals: list + JSON import/export

**Scope**
- Define the **canonical terminal content schema** as TypeScript types + Zod (this is the deliverable; later slices build forms against these types). Lives at `src/app/domain/terminal-schema.ts` or similar.
- Terminals list page scoped to the current campaign (PrimeNG table)
- Create terminal (metadata only: title, public flag) — produces a minimal valid terminal stub
- Import terminal from JSON file upload — client-side Zod validation, then `POST /campaigns/:id/terminals/import`
- Export terminal as JSON download — calls `POST /terminals/:id/export`
- Delete terminal with confirmation (warn about state loss)
- Terminal detail screen shows metadata only — no editor yet (Slice 5)
- MSW mocks for `/terminals/*` (list, get, create, delete, import, export)

**Out of scope**
- Editing terminal content (nodes, state schema, fictional users) — Slice 5
- State view — Slice 6

**Acceptance**
- Admin can list terminals in the current campaign
- Admin can import a valid terminal JSON file; invalid ones are rejected client-side with specific Zod errors
- Admin can export an existing terminal as a downloadable JSON file
- Admin can delete a terminal

**Propose prompt:**

```
Add Terminals list and JSON import/export to MAGNUS-CMS Backoffice, including the canonical terminal-content schema.

Scope:
- Define the canonical Terminal Content schema as both TypeScript interfaces and a Zod schema. The schema must cover: meta { title, public, id }, state { local, global } with per-variable type (boolean | number | enum | string), default, and (for enums) values; login { users[{ username, password }] } with passwords held as cleartext strings (the API strips them on delivery); nodes (map keyed by node id) each with text, on_enter mutations, choices (with label, target, optional when condition, optional set mutations), variants, and components (input type with placeholder, set target, branches). Conditions are recursive: leaf predicates { key, eq|neq|gt|lt|gte|lte|in, value } and combinators { and: [...] } / { or: [...] } / { default: true } for fallback variants. Reference the schema example in reference/robco-terminal-architecture.md. Place the schema in src/app/domain/terminal-schema.ts (or equivalent — proposer decides). This schema is consumed by Slice 5.
- Terminals list page at /campaigns/:campaignId/terminals — scoped to the current campaign from CurrentCampaignService. PrimeNG table with title, public flag, action buttons. Show an empty state when no campaign is selected.
- Create terminal: dialog with title and public flag. Produces a minimal valid terminal stub with empty state declarations, no fictional users, and a single 'start' node containing placeholder text. POST /campaigns/:campaignId/terminals.
- Import terminal: file upload (.json). Parse → validate with Zod against the canonical schema → on success POST /campaigns/:campaignId/terminals/import. On failure, display Zod errors (path + message) in a readable list.
- Export terminal: button on the terminal detail page that calls POST /terminals/:id/export and triggers a download of the returned JSON.
- Delete terminal: PrimeNG ConfirmDialog warning that associated state will be lost.
- Terminal detail screen at /terminals/:id: shows metadata only in this slice — title, public flag, campaign, last-updated. Display a "Content editing coming in Slice 5" placeholder where the editor will live.
- Extend MSW mocks for /campaigns/:id/terminals, /terminals/:id, /campaigns/:id/terminals/import, /terminals/:id/export, and DELETE /terminals/:id.

Out of scope: editing terminal content, state viewing/editing, fictional-login playback.

Context:
- Slices 1–2 complete (slice 3 may be in parallel). Auth, campaigns, current-campaign service exist.
- API spec: reference/API-docs.json — "terminals" tag.
- Schema reference: reference/robco-terminal-architecture.md (section "Terminal Content Schema").
- Plan: reference/backoffice-mvp-plan.md — note fictional credentials are stored cleartext and never delivered to the Terminal player app.

Acceptance:
- Listing terminals scopes to the currently selected campaign
- Importing a valid JSON file creates a terminal; invalid files surface specific Zod errors
- Export downloads a JSON file that round-trips back through import
- The canonical Zod schema and TS types are exported and ready for Slice 5 to consume
- Lint and typecheck pass
```

---

## Slice 5 — Terminal editor (form-based) ⚠ XL

**Scope** — the proposer SHOULD consider splitting this into 5a / 5b / 5c.

- **Metadata editor** — title, public flag
- **State schema editor** — declare local + global variables with type and default (and enum values when type=enum)
- **Fictional users editor** — list of `{ username, password }` with both fields in cleartext. Visible warning that these credentials are visible to admins by design and are never sent to the Terminal player app.
- **Nodes editor** — list of nodes, each with id, text (Markdown with `ngx-markdown` preview), `on_enter` mutations, choices, variants, components
- **Recursive condition builder** — AND/OR blocks combining leaf predicates `{ key, op, value }`. The form must allow nesting and produce JSON conforming to the canonical condition schema. Implementation tip: a recursive Angular component bound to a `FormGroup` / `FormArray` tree.
- **Recursive mutation editor** — list of `{ key, op (set/increment/toggle), value }` entries
- **Input component editor** — placeholder, target variable, branches (each with `when` condition + target node)
- All edits go through Reactive Forms; on save, the form is serialized, validated with the canonical Zod schema, and submitted via `PUT /terminals/:id`

**Out of scope**
- Live preview (deferred Nice-to-Have)
- Visual node graph (deferred Nice-to-Have)
- State view/edit (Slice 6)

**Acceptance**
- An admin can author a non-trivial terminal end-to-end through forms
- Saving produces JSON that re-imports cleanly via Slice 4's import path
- Round-trip: imported → edited → exported → reimported produces identical content

**Propose prompt:**

```
Build the form-based Terminal Editor for MAGNUS-CMS Backoffice. This is the largest slice — strongly consider splitting it into 5a (metadata + state schema + fictional users), 5b (nodes: text, on_enter, choices, variants), and 5c (recursive condition builder + recursive mutation editor + input components). Document the decision in design.md.

Scope:
- Build the editor against the canonical Zod schema and TypeScript types from Slice 4 (src/app/domain/terminal-schema.ts).
- Open the editor on the terminal detail page (/terminals/:id), replacing the Slice 4 placeholder.
- All editing uses Angular Reactive Forms, with FormGroups and FormArrays mirroring the schema structure. The recursive condition tree and recursive mutation list MUST be expressible as nested FormArrays.
- Sub-editors:
  1. Metadata: title, public flag.
  2. State schema: separate sections for local and global variables. Per-variable form: name, type (boolean | number | enum | string), default, and a values list when type=enum. Adding/removing variables uses FormArray.
  3. Fictional users: list of { username, password }. Both fields are plain text inputs (no masking). Above the section, display a banner: "Fictional credentials are visible to admins and stored as-is. They are never sent to the Terminal player app — the API strips them before delivery."
  4. Nodes: ordered list. Each node has id, Markdown text body (use ngx-markdown for a live preview pane), on_enter mutations (recursive editor — see 6), choices (label, target node, optional when-condition (recursive editor — see 5), optional set mutations (recursive editor — see 6)), variants (alternative text/choices selected by condition, plus a default fallback variant), and components (currently just input — placeholder, set target variable, branches list each with when-condition + target).
  5. Recursive condition builder: a single Angular component that renders either a leaf predicate { key (scope-prefixed: 'local.foo' or 'global.bar'), op (eq | neq | gt | lt | gte | lte | in), value } or an and/or combinator containing a FormArray of child conditions. Buttons to add a leaf, add an and group, add an or group, and remove. Must serialize to the canonical condition JSON shape.
  6. Recursive mutation editor: a FormArray of { key (scope-prefixed), op (set | increment | toggle), value }. Used in on_enter, choice.set, and input component.set contexts.
- On save: form.getRawValue(), run through the canonical Zod schema, surface validation errors inline against the offending fields, and on success PUT /terminals/:id.
- Show a "dirty" indicator and a "discard changes" action. No auto-save (deferred).
- No live preview pane (deferred Nice-to-Have).
- Extend MSW handlers for PUT /terminals/:id to reflect saved content in subsequent GET /terminals/:id calls.

Out of scope:
- Live preview rendering of the terminal
- Visual node graph editor
- Terminal state view/edit (Slice 6)
- Hashing or any obfuscation of fictional passwords — they are explicitly stored cleartext

Context:
- Slices 1–4 complete. The canonical Zod + TS schema exists in src/app/domain/.
- Schema reference: reference/robco-terminal-architecture.md ("Terminal Content Schema" and "Condition Syntax").
- API spec: reference/API-docs.json — PUT /terminals/:id.
- Plan: reference/backoffice-mvp-plan.md.

Acceptance:
- An admin can author a non-trivial terminal end-to-end through forms (multiple nodes, choices, variants, conditions, mutations, input components, fictional users, state declarations)
- Saving serializes form state to valid canonical JSON (verified by re-import through Slice 4's import path)
- Recursive condition tree handles at least three levels of nesting (and inside or inside and)
- Round-trip: imported JSON → opened in editor → saved → exported → re-imported yields identical content (byte-equivalent ignoring whitespace ordering)
- Lint and typecheck pass
```

---

## Slice 6 — State viewer/editor + Resets

**Scope**
- Local state view per terminal: table of `{ key, type, default, current }` with inline edit + per-variable reset
- Global state view per campaign: same table layout, accessible from the campaign detail screen
- Manual override of any variable's value (typed input matching the variable's declared type)
- Reset operations:
  - Single variable to default
  - All local state of a terminal to defaults
  - All global state of campaign to defaults
  - Reset entire campaign (all local across all terminals + all global) — strong confirmation
- MSW mocks for state endpoints

**Out of scope**
- Surfacing state mutations as a chronological log (audit log is a deferred Nice-to-Have)

**Acceptance**
- Admin can inspect and override every state variable in the campaign
- All four reset operations work and produce the documented behavior
- Type validation prevents setting a number variable to a string, etc.

**Propose prompt:**

```
Add the State viewer/editor and Reset operations to MAGNUS-CMS Backoffice.

Scope:
- Per-terminal local state view: a panel/tab on the terminal detail page showing a PrimeNG table with columns key, type, default value, current value, and row actions. Source: GET /terminals/:id/state.
- Per-campaign global state view: a panel/tab on the campaign detail page with the same table layout. Source: GET /campaigns/:id/state.
- Inline edit of a current value: clicking edit opens a typed input matching the variable's declared type (checkbox for boolean, number input for number, dropdown of declared values for enum, text input for string). Submit calls the appropriate /state/mutate endpoint with a single mutation atom. Reject mismatched types client-side via Zod before the network call.
- Reset operations, each behind a PrimeNG ConfirmDialog with severity scaled to blast radius:
  - Per-variable reset: POST /terminals/:id/state/:key/reset or POST /campaigns/:id/state/:key/reset.
  - All local state of a terminal: POST /terminals/:id/state/reset.
  - All global state of campaign: POST /campaigns/:id/state/reset.
  - Reset entire campaign: invoke both /campaigns/:id/state/reset and a /terminals/:id/state/reset for every terminal in the campaign — proposer documents the chosen orchestration (sequential vs parallel) and error-handling strategy in design.md. The confirmation requires the admin to retype the campaign name.
- Extend MSW handlers for GET state, /state/mutate, and all reset variants. Ensure mock state reflects mutations on subsequent reads.

Out of scope:
- Chronological mutation/audit log (deferred Nice-to-Have)
- Surfacing state at any granularity finer than the campaign+terminal split

Context:
- Slices 1–5 complete. Campaigns, terminals, editor, current-campaign service all exist.
- API spec: reference/API-docs.json — campaign state and terminal state endpoint groups.
- Plan: reference/backoffice-mvp-plan.md.

Acceptance:
- Admin can inspect every state variable (local + global) and see default vs current
- Admin can override any variable; the API call uses the matching /state/mutate endpoint
- All four reset operations work and reflect in the UI after completion
- Type validation prevents nonsensical overrides (e.g., string into a number variable)
- The "reset entire campaign" action requires typing the campaign name to confirm
- Lint and typecheck pass
```

---

## How to use this document

1. Land Slice 1 first — everything else depends on the shell and codegen pipeline.
2. After Slice 2, Slices 3 and 4 can proceed in parallel.
3. Before starting Slice 5, expect the proposer to ask whether to split it into 5a/5b/5c.
4. Slice 6 closes the MVP loop — at that point the backoffice can author content end-to-end and inspect/manipulate state, ready for integration with the real API.

For each slice, paste the corresponding propose prompt into `/opsx:propose` to generate the full OpenSpec change (proposal + design + specs + tasks).

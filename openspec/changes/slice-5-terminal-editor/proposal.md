## Why

Slice 4 delivered the canonical Terminal Content schema (`src/app/domain/terminal-schema.ts`) plus list / create-stub / import / export / delete, but the terminal detail page (`/terminals/:id`) still shows only metadata and a "Editor del contenuto disponibile nello Slice 5" placeholder. There is no way to author the actual narrative content — state declarations, fictional logins, nodes, choices, conditional variants, mutations, or input components — through the backoffice. Slice 5 builds that form-based editor against the exact Slice 4 types, turning the schema from a contract into an authoring tool.

This is the largest slice in the plan. It is delivered as **one change**, but implementation is **phased into 5a → 5b → 5c** (see `design.md`, D1) so each phase is independently reviewable and the recursive primitives (5c) land before the node editors (5b) that compose them.

## What Changes

- **Replace the Slice 4 placeholder** on `/terminals/:id` with a Reactive-Forms editor whose `FormGroup`/`FormArray` tree mirrors `TerminalContentSchema`. Load via the existing `GET /terminals/:id`.
- **Phase 5a — metadata, state schema, fictional users:**
  - Metadata editor: `title` (required), `public` flag.
  - State schema editor: separate **local** and **global** sections; each variable has a name, `type` (`boolean | number | enum | string`), a type-appropriate `default`, and a `values` list when `type = enum`. Add/remove via `FormArray`.
  - Fictional users editor: list of `{ username, password }`, both **cleartext** inputs (no masking), preceded by a banner stating credentials are admin-visible by design and stripped by the API before delivery to the Terminal player app.
- **Phase 5b — nodes editor:** ordered list of nodes, each with an `id`, a Markdown `text` body with an `ngx-markdown` rendered preview, `on_enter` mutations, `choices` (label, target, optional `when` condition, optional `set` mutations), `variants` (alternative `text`/`choices` selected by a `when` condition, plus a `default: true` fallback variant), `components` (currently only `input`: placeholder, `set` target variable, and `branches` each with a `when` condition + target), and a **per-node login gate** (`login.users` multiselect from the terminal's declared fictional users — see §4 of the authoring guide).
- **Phase 5c — recursive primitives** (built first, consumed by 5b):
  - Recursive condition builder: one component rendering either a leaf predicate (`key`, op ∈ `eq|neq|gt|lt|gte|lte|in`, value) or an `and`/`or` combinator holding a `FormArray` of child conditions; serializes to the canonical key-presence JSON shape (`{ key, <op>: value }`, `{ and: [...] }`, `{ or: [...] }`). A leaf can be promoted to an AND/OR combo at any nesting level via inline convert buttons.
  - Recursive mutation editor: a `FormArray` of `{ key, op (set | increment | toggle), value | by }`, used in `on_enter`, `choice.set`, and input-component `set` contexts.
  - **Variable-key autocomplete:** both the condition-builder leaf `key` input and the mutation-editor `key` input show a native `<datalist>` autocomplete populated from the terminal's declared local/global state variables (`local.foo`, `global.bar`), updated reactively as the author edits the state section.
- **Save pipeline:** serialize the form (`getRawValue()` → canonical JSON with empty optionals pruned) → validate with `TerminalContentSchema` → on failure surface Zod issues inline against the offending fields → on success `PUT /terminals/:id`.
- **Dirty indicator + "Annulla modifiche" (discard)** that resets the form to the last-loaded content. No auto-save.
- **Add an MSW handler for `PUT /terminals/:id`** so saved content is reflected in subsequent `GET /terminals/:id` and export calls.
- **Add the `ngx-markdown` dependency** (with `marked`) for the node-text preview pane.
- **Separate the two terminal identifiers (D15/D16):** treat `meta.id` as a server-owned API-call identifier that is never shown in the UI and never sent on write (stripped from exports), and `meta.hiddenId` as the optional, user-authored, per-campaign-unique slug that round-trips on import/export and is the only id surfaced in the UI. Make `meta.id` optional and add optional `meta.hiddenId` to the schema; edit `hiddenId` in the metadata section; add `TerminalsApiService.getByHiddenId` + the `GET /campaigns/:id/terminals/by-hidden-id/:hiddenId` mock as the single hiddenId-keyed call.

## Capabilities

### New Capabilities

- `terminal-editor-shell`: Hosts the editor on `/terminals/:id`, assembles the root form from loaded content, tracks dirty state, provides discard, and runs the save pipeline (serialize → Zod validate → inline errors → `PUT`).
- `terminal-metadata-state-users-editor`: Phase 5a — metadata (title, public), local/global state-variable declarations with enum values, and the cleartext fictional-users list with its security banner.
- `terminal-nodes-editor`: Phase 5b — the ordered node list with `id`, Markdown text + `ngx-markdown` preview, `on_enter`, choices, variants, and input components.
- `terminal-recursive-editors`: Phase 5c — the recursive condition builder (with leaf-to-AND/OR conversion and variable-key autocomplete) and the recursive mutation editor (with variable-key autocomplete), including the form-model ↔ canonical-JSON serialization.

### Modified Capabilities

- `terminals-msw-handlers`: Add a `PUT /terminals/:id` handler that overwrites stored content, bumps `updatedAt`, and returns the updated content so subsequent `GET`/export reflect the save. Treat `meta.id` as server-owned (injected on read, stripped on write/export) and `meta.hiddenId` as the author-owned slug; add a `GET /campaigns/:id/terminals/by-hidden-id/:hiddenId` resolver and enforce per-campaign `hiddenId` uniqueness (409).
- `terminal-metadata-state-users-editor`: Replace the read-only ID display with an editable optional `hiddenId` ("ID nascosto") field; never display the server-owned `meta.id`.
- `terminal-editor-shell`: Stop serializing `meta.id` on save (server-owned); emit `meta.hiddenId` only when set.

## Impact

- **New files:**
  - `src/app/features/terminals/editor/terminal-editor.ts` — editor host (shell) replacing the detail-page placeholder.
  - `src/app/features/terminals/editor/terminal-form.ts` — builders to convert `TerminalContent` ↔ the form tree, plus the canonical serializer (prunes empty optionals).
  - `src/app/features/terminals/editor/metadata-section.ts`, `state-schema-section.ts`, `fictional-users-section.ts` — 5a sub-editors.
  - `src/app/features/terminals/editor/nodes-section.ts`, `node-editor.ts` (choices, variants, components) — 5b sub-editors.
  - `src/app/features/terminals/editor/condition-builder.ts`, `mutation-editor.ts` — 5c recursive primitives.
- **Modified files:**
  - `src/app/features/terminals/terminal-detail.ts` — mount the editor in place of the placeholder; show `meta.hiddenId` instead of `meta.id` (D15).
  - `src/app/core/terminal/terminals-api.service.ts` — add `update(id, content)` for `PUT /terminals/:id`; add `getByHiddenId(campaignId, hiddenId)` (D16).
  - `src/mocks/handlers/terminals.handlers.ts` — add the `PUT` handler; server-owned `meta.id` (inject on read / strip on write); `by-hidden-id` resolver; per-campaign `hiddenId` uniqueness (D15/D16).
  - `src/app/domain/terminal-schema.ts` — `meta.id` optional, add optional `meta.hiddenId` (D15).
  - `src/app/core/terminal/terminal.types.ts` — `TerminalDto.hiddenId` optional (D15).
  - `src/app/core/terminal/terminal-stub.ts` — drop server-owned `meta.id` from the create stub (D15).
  - `src/app/features/terminals/export-terminal.ts` — filename from `hiddenId`/title slug (D15).
  - `src/app/features/terminals/terminals-list.ts` — render optional `hiddenId` (D15).
  - `src/app/features/terminals/editor/metadata-section.ts` — editable `hiddenId`, no `meta.id` display (D15).
  - `src/app/features/terminals/editor/terminal-form.ts` — `hiddenId` control; serializer omits `meta.id`, emits `hiddenId` (D15).
  - `src/app/app.config.ts` (or equivalent) — provide `ngx-markdown`.
  - `package.json` — add `ngx-markdown` + `marked`.
- **API surface used:** `GET /terminals/:id` (load), `PUT /terminals/:id` (save), `GET /campaigns/:id/terminals/by-hidden-id/:hiddenId` (hiddenId resolution — the only hiddenId-keyed call). Body shape is `TerminalContentDto`.
- **Consumed unchanged:** `terminal-content-schema` (the canonical Zod + TS contract), `terminals-import-export` (round-trip target), `current-campaign-service`.
- **No breaking changes** to Slice 1–4 contracts.

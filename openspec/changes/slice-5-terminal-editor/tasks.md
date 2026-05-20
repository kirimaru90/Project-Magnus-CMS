## 1. Dependencies and scaffolding

- [ ] 1.1 Add `ngx-markdown` and its peer `marked` to `package.json`, pinning a version compatible with Angular 21; run install and resolve any peer-range conflict (record the chosen versions; use `overrides` only if unavoidable, per design Open Questions)
- [ ] 1.2 Provide `ngx-markdown` once at app config level (`provideMarkdown()` in `src/app/app.config.ts` or equivalent)
- [ ] 1.3 Create the `src/app/features/terminals/editor/` folder for all editor components
- [ ] 1.4 Add `TerminalsApiService.update(id, content): Observable<TerminalContent>` issuing `PUT /terminals/:id`

## 2. MSW PUT handler (terminals-msw-handlers)

- [ ] 2.1 Add a `http.put(${base}/terminals/:id, ...)` handler to `src/mocks/handlers/terminals.handlers.ts`
- [ ] 2.2 On known id: overwrite `record.content` with the body, preserve `id`/`campaignId`/`hiddenId`/`createdAt`/`views`, set `updatedAt = now`, return stored content with 200
- [ ] 2.3 On unknown id: return 404
- [ ] 2.4 Verify `GET /terminals/:id` and `POST /terminals/:id/export` reflect a prior PUT (manual MSW check)

## 3. Form mapping layer (shell core)

- [ ] 3.1 Create `editor/terminal-form.ts` with `toForm(content: TerminalContent): FormGroup` building the full tree (meta, state.local/global FormArrays, login.users FormArray, nodes FormArray) per design D2/D3/D11
- [ ] 3.2 Implement `toContent(raw): unknown` serializing the form to canonical JSON: reduce nodes array → record keyed by `id` in order (D3), prune empty optionals (`when`, `set`, `on_enter`, `choices`, `variants`, `components`, blank `text`, non-enum `values`) per D8, preserve `meta.id` verbatim
- [ ] 3.3 Implement mutation serialization helper: `set→{key,op,value}`, `increment→{key,op,by}`, `toggle→{key,op}` (D4), with the inverse loader (shorthand `{key,value}` and explicit set both load as `op:'set'`)
- [ ] 3.4 Implement condition serialization helpers: leaf `{ key, [op]: value }` (array for `in`), combinators `{and:[...]}`/`{or:[...]}` (D5), with the inverse loader mapping JSON → `kind`-tagged groups
- [ ] 3.5 Implement a path-to-control resolver mapping a Zod `issue.path` to the corresponding control (walks the same indices `toContent` emits), with a documented fallback when unresolvable (D7)
- [ ] 3.6 Add cross-field form validators: unique node ids, unique variable names per scope, at-most-one default variant per node, at-most-one default branch per input component

## 4. Editor shell host (terminal-editor-shell)

- [ ] 4.1 Create `editor/terminal-editor.ts` (standalone, OnPush) that takes loaded `TerminalContent`, builds the form via `toForm`, and renders the section components
- [ ] 4.2 Implement the save pipeline: `getRawValue()` → `toContent` → `TerminalContentSchema.safeParse` → on failure set inline errors via the path resolver + render a summary list for unresolved issues; block PUT while invalid (D7)
- [ ] 4.3 On valid save: call `terminalsApi.update(id, content)`; on 200 reset pristine baseline to saved content, clear dirty, success toast; on non-2xx keep dirty and show API error
- [ ] 4.4 Implement the dirty indicator (visible when form differs from baseline) and an "Annulla modifiche" discard action (reset to baseline, with a confirm per design Open Questions); ensure no auto-save
- [ ] 4.5 Mount the editor in `terminal-detail.ts`, removing the "Editor del contenuto disponibile nello Slice 5" placeholder; keep the metadata header and "Esporta" button; preserve the 404 not-found state

## 5. Phase 5a — metadata, state, fictional users (terminal-metadata-state-users-editor)

- [ ] 5.1 Create `editor/metadata-section.ts`: `Titolo` (required) + `Pubblico` checkbox bound to `meta`; confirm `meta.id` is preserved (not regenerated)
- [ ] 5.2 Create `editor/state-schema-section.ts`: separate Locale/Globale FormArrays with add/remove; per-variable name + type selector + type-appropriate default control (D11)
- [ ] 5.3 Add the enum sub-case: a `values` editor (≥1) shown only for type `enum`, with `default` constrained to a dropdown of declared values; omit `values` for non-enum on serialize
- [ ] 5.4 Wire the per-scope unique-name validator and inline error display
- [ ] 5.5 Create `editor/fictional-users-section.ts`: `login.users` FormArray of `{ username, password }` as plain-text (unmasked) inputs; add/remove rows
- [ ] 5.6 Add the security banner above the section (admin-visible by design; stored as-is; stripped by the API before delivery to the Terminal player app)

## 6. Phase 5c — recursive primitives (terminal-recursive-editors)

- [ ] 6.1 Create `editor/mutation-editor.ts`: a FormArray editor of `{ key, op, value|by }` rows; show `value` for set, numeric `by` for increment, nothing for toggle; reusable in on_enter/choice.set/input.set contexts
- [ ] 6.2 Create `editor/condition-builder.ts` as a recursive standalone component bound to a `kind`-tagged FormGroup (`leaf|and|or`); render leaf controls (key, op, value) or a children FormArray that recursively renders the same component
- [ ] 6.3 Add condition-builder actions: add leaf, add AND group, add OR group, remove; support the `in` operator value as an array/chip editor and primitive inference (string/number/boolean) for the others
- [ ] 6.4 Verify (manual fixture) a 3-level nested AND-in-OR-in-AND tree serializes and validates against `ConditionSchema`, and that loading it back reconstructs the tree

## 7. Phase 5b — nodes editor (terminal-nodes-editor)

- [ ] 7.1 Create `editor/nodes-section.ts`: nodes FormArray with add/remove; per-node `id` control with required + unique validation; block removing the last node
- [ ] 7.2 Create `editor/node-editor.ts`: Markdown `text` textarea + `<markdown [data]>` preview pane; omit blank text on serialize
- [ ] 7.3 Add the node `on_enter` editor using the mutation editor (6.1); omit when empty
- [ ] 7.4 Add the choices editor (FormArray): label (required) + target, optional `when` (condition builder), optional `set` (mutation editor); prune empty optionals
- [ ] 7.5 Add the variants editor (FormArray): conditional variant (`when` + optional alt `text`/`choices`) vs. default-fallback toggle (`default: true`, no `when`); enforce at-most-one default
- [ ] 7.6 Add the input-component editor: `placeholder`, `set` target, `branches` FormArray (conditional `when`+`target` or default `{default:true,target}`); enforce at-most-one default branch; serialize as `{ type:'input', placeholder, set, branches }`

## 8. Verification

- [ ] 8.1 Run `npm run lint` — zero errors
- [ ] 8.2 Run `npm run typecheck` — zero errors
- [ ] 8.3 Manually author a non-trivial terminal end-to-end (multiple nodes, choices, variants, ≥3-level condition, mutations, input component, fictional users, local+global state declarations) and save successfully
- [ ] 8.4 Verify inline validation: introduce an invalid state (empty choice label, enum default not in values, duplicate node id) and confirm field-level errors appear and PUT is blocked
- [ ] 8.5 Verify dirty/discard: edit → dirty indicator shows → discard restores baseline; edit → save → indicator clears and reload shows saved content
- [ ] 8.6 Round-trip: export the authored terminal, re-import via the Slice 4 import path, confirm it validates and produces semantically identical content (deep-equal ignoring key order)
- [ ] 8.7 Verify the Markdown preview renders node text, and the fictional-users passwords display in cleartext with the banner visible

## 1. Canonical Terminal Content schema

- [ ] 1.1 Create `src/app/domain/terminal-schema.ts` with Zod schemas: `MetaSchema`, `StateVariableSchema` (discriminated union by `type`), `StateDeclarationSchema`, `LoginUserSchema`, `LoginBlockSchema`, `ConditionSchema` (via `z.lazy`), `MutationSchema` (discriminated union by `op`), `NodeChoiceSchema`, `NodeVariantSchema`, `NodeComponentSchema`, `TerminalNodeSchema`, and `TerminalContentSchema`
- [ ] 1.2 Derive TypeScript types (`TerminalContent`, `TerminalMeta`, `StateDeclaration`, `LoginBlock`, `TerminalNode`, `NodeChoice`, `NodeVariant`, `NodeComponent`, `Condition`, `Mutation`) via `z.infer` and export them from the same module
- [ ] 1.3 Add a doc-comment to `LoginUserSchema` noting that fictional passwords are cleartext at rest in terminal content and are stripped by the API before delivery to the Terminal player app
- [ ] 1.4 Enforce that `state.<scope>.<var>.default` matches the declared `type` (boolean / number / string / one-of `values` for enum) — use a `superRefine` if needed
- [ ] 1.5 Enforce `nodes` non-empty (`z.record(...).refine(map => Object.keys(map).length > 0)`)
- [ ] 1.6 Sanity-test the schema against the JSON example in `reference/robco-terminal-architecture.md` (section "Terminal Content Schema") during implementation; a parse failure here is a schema bug to fix before proceeding

## 2. Terminal types and stub factory

- [ ] 2.1 Create `src/app/core/terminal/terminal.types.ts` with a `TerminalDto` interface for list-view rows: `{ id: string, meta: TerminalMeta, campaignId: string, updatedAt?: string }` (campaignId and updatedAt are best-effort; the real API may omit them)
- [ ] 2.2 Create `src/app/core/terminal/terminal-stub.ts` exporting `buildTerminalStub({ title, public }): TerminalContent` that returns the minimal valid stub from D4 (slug-derived `meta.id`, empty state/login, single `start` node with placeholder text)
- [ ] 2.3 Verify in code that `TerminalContentSchema.safeParse(buildTerminalStub({...})).success === true`

## 3. Terminals API service

- [ ] 3.1 Create `src/app/core/terminal/terminals-api.service.ts` with `HttpClient` and methods: `listByCampaign(campaignId)`, `create(campaignId, content)`, `import(campaignId, content)`, `get(id)`, `delete(id)`, `export(id)` — all returning `Observable<T>`
- [ ] 3.2 Use the existing Bearer interceptor (no new auth wiring)

## 4. MSW terminals handlers

- [ ] 4.1 Create `src/mocks/handlers/terminals.handlers.ts` with an in-memory `Map<string, { campaignId: string; content: TerminalContent }>` seeded with two fixture terminals belonging to the first fixture campaign from `campaigns.handlers.ts`
- [ ] 4.2 Implement `GET /campaigns/:campaignId/terminals` (filters store entries by campaignId, returns array of list-view rows)
- [ ] 4.3 Implement `POST /campaigns/:campaignId/terminals` (assigns uuid, stores, returns 201 with stored entry)
- [ ] 4.4 Implement `POST /campaigns/:campaignId/terminals/import` (same as create but accepts full content body, always assigns fresh server-side id)
- [ ] 4.5 Implement `GET /terminals/:id` (returns stored content or 404)
- [ ] 4.6 Implement `DELETE /terminals/:id` (removes from store, returns 204 or 404)
- [ ] 4.7 Implement `POST /terminals/:id/export` (returns stored content as JSON body, or 404)
- [ ] 4.8 Register `terminalsHandlers` in `src/mocks/browser.ts`

## 5. Routes and sidebar wiring

- [ ] 5.1 Register `/campaigns/:campaignId/terminals` route in `src/app/app.routes.ts` pointing to the terminals list component (lazy-loaded standalone)
- [ ] 5.2 Register `/terminals/:id` route in `src/app/app.routes.ts` pointing to the terminal detail component (lazy-loaded standalone)
- [ ] 5.3 Add a "Terminali" entry to `src/app/layout/sidebar.ts`; computed-link based on `CurrentCampaignService.currentCampaign()?.id`; render disabled when no campaign is selected

## 6. Terminals list page

- [ ] 6.1 Create `src/app/features/terminals/terminals-list.ts` (standalone, imports `TableModule`, `ButtonModule`, `ConfirmDialogModule`, `ToastModule`, `DialogModule`)
- [ ] 6.2 Inject `TerminalsApiService`, `CampaignsApiService`, `CurrentCampaignService`, `ConfirmationService`, `MessageService`, `ActivatedRoute`
- [ ] 6.3 Resolve `campaignId` from the route; load terminals with `toSignal(terminalsApi.listByCampaign(campaignId))`
- [ ] 6.4 Render `<p-table>` with columns Titolo, Pubblico (badge), Azioni (open detail, export, delete); add loading and empty-state handling
- [ ] 6.5 Add "Nuovo terminale" button triggering the create dialog
- [ ] 6.6 Add "Importa terminale" button triggering the import dialog
- [ ] 6.7 Add row delete action wired to `ConfirmationService.confirm(...)` with the state-loss warning message; on confirm, call `terminalsApi.delete(id)` and remove from list
- [ ] 6.8 Add row "Esporta" action that calls into the shared export helper (same code-path as the detail page button) — convenient shortcut, optional but cheap
- [ ] 6.9 Handle 404 on campaign load with a "Campagna non trovata" empty-state message

## 7. Create terminal dialog

- [ ] 7.1 Create `src/app/features/terminals/create-terminal-dialog.ts` (standalone, uses `DialogModule`, `ReactiveFormsModule`, `CheckboxModule`, `InputTextModule`)
- [ ] 7.2 Build Reactive Form: `title` (required, min 1), `public` (boolean, default false)
- [ ] 7.3 On submit: call `buildTerminalStub({ title, public })`, assert via `TerminalContentSchema.safeParse` (defence-in-depth), then `terminalsApi.create(campaignId, stub)`
- [ ] 7.4 Emit success to parent on 2xx; parent closes dialog and refreshes list
- [ ] 7.5 Integrate dialog into `terminals-list.ts` with `<p-dialog>` visibility binding

## 8. Import terminal dialog

- [ ] 8.1 Create `src/app/features/terminals/import-terminal-dialog.ts` (standalone, uses `DialogModule`, `FileUploadModule`, plus a local error-list component or inline `<ul>`)
- [ ] 8.2 Add `<p-fileupload mode="basic" accept=".json,application/json" [maxFileSize]="1048576">` with a "Choose file" button label
- [ ] 8.3 On file select: read via `FileReader.readAsText`; wrap `JSON.parse` in try/catch and on throw render "Il file non è un JSON valido."
- [ ] 8.4 Run `TerminalContentSchema.safeParse` on the parsed value; on failure render `<ul>` with one `<li>` per `issues[i]` showing `path.join('.') + ': ' + message`
- [ ] 8.5 On success: call `terminalsApi.import(campaignId, parsedContent)`; on 2xx close dialog, refresh list, show success toast "Terminale importato"
- [ ] 8.6 On API non-2xx: keep dialog open and render an inline error including the response body message when present
- [ ] 8.7 Integrate dialog into `terminals-list.ts` with `<p-dialog>` visibility binding

## 9. Terminal detail page

- [ ] 9.1 Create `src/app/features/terminals/terminal-detail.ts` (standalone)
- [ ] 9.2 Resolve `:id` from the route, load via `terminalsApi.get(id)` and resolve the parent campaign via `CurrentCampaignService` (or `CampaignsApiService.get(campaignId)` if unknown locally)
- [ ] 9.3 Render the metadata panel: title, public badge, parent campaign label, last-updated label (if present)
- [ ] 9.4 Render the editor placeholder element with the literal text "Editor del contenuto disponibile nello Slice 5"
- [ ] 9.5 Add an "Esporta" button that calls the shared export helper (see Task 10)
- [ ] 9.6 Add a back-link to `/campaigns/:campaignId/terminals` when the parent campaign is known
- [ ] 9.7 Handle 404 with an empty-state and a link back to `/campaigns`

## 10. Export helper (shared)

- [ ] 10.1 Create `src/app/features/terminals/export-terminal.ts` exporting a function `exportTerminal(api, messageService, terminalId)` that calls `api.export(id)`, constructs a `Blob` with `JSON.stringify(json, null, 2)`, triggers a download with filename `<json.meta.id>.json`, and on error shows a PrimeNG toast with severity `error`
- [ ] 10.2 Use the helper from both `terminal-detail.ts` (Task 9.5) and the list-row export action (Task 6.8)

## 11. Verification

- [ ] 11.1 Run `npm run lint` — zero errors
- [ ] 11.2 Run `npm run typecheck` (or `tsc --noEmit`) — zero errors
- [ ] 11.3 Manually verify with MSW: navigate to a campaign, click "Terminali" in the sidebar, see the seeded list
- [ ] 11.4 Manually verify: create a terminal via the dialog; new row appears
- [ ] 11.5 Manually verify: open detail page; metadata renders and editor placeholder is visible
- [ ] 11.6 Manually verify: export → downloads a JSON file → import the same file back → import succeeds and a new row appears
- [ ] 11.7 Manually verify: import a deliberately invalid JSON (e.g. missing `meta.title`) and confirm path-precise Zod errors render in the dialog
- [ ] 11.8 Manually verify: import a non-JSON file and confirm the "Il file non è un JSON valido." message
- [ ] 11.9 Manually verify: delete a terminal via the ConfirmDialog and confirm it disappears from the list

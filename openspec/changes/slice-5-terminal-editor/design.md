## Context

Slice 4 shipped the canonical Terminal Content schema (`src/app/domain/terminal-schema.ts`) and the CRUD/import/export surface. The terminal detail page (`src/app/features/terminals/terminal-detail.ts`) loads a terminal via `GET /terminals/:id` and renders metadata plus a static placeholder ("Editor del contenuto disponibile nello Slice 5"). Slice 5 replaces that placeholder with a form-based content editor.

The editor must be built **against the existing canonical Zod schema** — it is the source of truth, not the simplified shapes in the propose prompt. Two places where the real schema diverges from the prompt's shorthand are load-bearing for this design:

1. **Mutations** are a `z.union` whose members differ by `op`: `set` carries `value`, `increment` carries `by: number`, `toggle` carries neither. (There is also a `{ key, value }` shorthand-set form; the editor will emit the explicit `{ key, op: 'set', value }` form.)
2. **Condition leaves** are `strict` objects of the shape `{ key, <op>: value }` — the operator is the *key name*, not a `op` field. `in` takes an array; the others take a primitive. Combinators are `{ and: [...] }` / `{ or: [...] }`, and there is a `{ default: true }` fallback marker.

Relevant existing files:
- `src/app/domain/terminal-schema.ts` — `TerminalContentSchema` and all sub-schemas + derived types (the contract).
- `src/app/features/terminals/terminal-detail.ts` — host page; gains the editor in place of the placeholder.
- `src/app/core/terminal/terminals-api.service.ts` — pattern for the new `update()` method.
- `src/mocks/handlers/terminals.handlers.ts` — in-memory store; gains the `PUT` handler. `GET /terminals/:id` already returns full `content` including `login.users` (admin-visible).
- `reference/robco-terminal-architecture.md` §"Terminal Content Schema" / §"Condition Syntax" — informal reference with worked examples (scope-prefixed keys `local.foo` / `global.bar`).
- `reference/API-docs.json` — `PUT /terminals/:id` (body `TerminalContentDto`, 200).

## Goals / Non-Goals

**Goals:**
- An admin can author a non-trivial terminal end-to-end through Reactive Forms: multiple nodes, choices, variants, ≥3-level-nested conditions, mutations, input components, fictional users, and state declarations.
- Saving serializes the form to canonical JSON that validates against `TerminalContentSchema` and re-imports cleanly via the Slice 4 import path.
- Round-trip integrity: imported JSON → opened in editor → saved → exported → re-imported yields semantically identical content (deep-equal ignoring object-key order and pruned empty optionals).
- Validation errors surface inline against the offending fields, not just as a toast.
- Dirty indicator + discard; no auto-save.
- `PUT /terminals/:id` MSW handler reflects saves in subsequent reads.
- Lint and typecheck pass.

**Non-Goals:**
- Live preview / playback rendering of the whole terminal (the terminal "player") — deferred Nice-to-Have. (The per-node Markdown *preview pane* is in scope; see D9.)
- Visual node-graph editor — deferred Nice-to-Have.
- Terminal state view/edit — Slice 6.
- Hashing or obfuscation of fictional passwords — explicitly cleartext per the architecture doc.
- Schema changes — `terminal-content-schema` is consumed unchanged, **except** for the additive `meta.id`/`meta.hiddenId` adjustment in D15 (making `meta.id` optional and adding optional `meta.hiddenId`), which aligns the schema with the authoring guide's id model. No other schema shape changes; if authoring needs a shape the schema forbids, that is a schema bug to triage in its own change.
- Automated round-trip test in CI — validated manually this slice (consistent with Slice 4 D-level decision).

## Decisions

### D1 — One change, phased 5a/5b/5c (the split decision)

The propose prompt asks whether to split into 5a (metadata + state + users), 5b (nodes), and 5c (recursive condition + mutation editors). **Decision: keep it as a single OpenSpec change, but phase the implementation and the spec capabilities along the 5a/5b/5c lines.**

Rationale:
- The three parts share one root `FormGroup` and one save pipeline; splitting into three separate OpenSpec changes would force three propose/apply cycles over the same component tree and the same `terminal-editor-shell`, with 5b and 5c unable to be exercised independently of the shell.
- **Build order is 5a → 5c → 5b, not 5a → 5b → 5c.** The node editor (5b) *composes* the recursive condition builder and mutation editor (5c) — a choice's `when`/`set`, a node's `on_enter`, a variant's `when`, and an input branch's `when` all reuse the 5c primitives. So 5c primitives are built before the 5b nodes that consume them. The tasks file orders work this way; capabilities are still named after the prompt's 5a/5b/5c grouping for traceability.
- Each phase remains independently reviewable: 5a is a self-contained editor over a static stub; 5c primitives ship with their own demonstrable form↔JSON behavior; 5b assembles them.

Capabilities: `terminal-editor-shell` (cross-cutting host + save), `terminal-metadata-state-users-editor` (5a), `terminal-recursive-editors` (5c), `terminal-nodes-editor` (5b), and the modified `terminals-msw-handlers`.

**Alternative considered:** three separate changes (`slice-5a`, `slice-5b`, `slice-5c`). Rejected — the shell and save pipeline are shared, the parts are not separately shippable to a user (a node editor with no host is not a feature), and the round-trip acceptance criterion spans all three.

### D2 — Form tree mirrors the schema; a dedicated mapping layer bridges form ⇄ JSON

The root is a typed `FormGroup` whose shape mirrors `TerminalContentSchema`, with `FormArray`s wherever the schema has arrays or records. The form model is **not** identical to the JSON, so a single module — `editor/terminal-form.ts` — owns both directions:

- `toForm(content: TerminalContent): FormGroup` — builds the tree from loaded content.
- `toContent(raw): unknown` — serializes `form.getRawValue()` to canonical JSON (the object then handed to Zod and to `PUT`).

Keeping both transforms in one file means the round-trip invariant is enforced in one place and is unit-reviewable. Every other section component receives a sub-`FormGroup`/`FormArray` and never reaches across the boundary.

**Alternative considered:** bind controls directly to the JSON shape (no mapping layer). Rejected — the JSON's key-presence discriminators (conditions) and record-keyed nodes do not map cleanly onto stable form controls, and a `value`/`by` field that changes name by `op` cannot be a single control.

### D3 — Nodes: record ⇄ `FormArray` of `{ id, ...node }`

`nodes` is a `Record<nodeId, TerminalNode>`. The form represents it as a `FormArray` of groups each carrying an explicit `id` control plus the node fields, so nodes are orderable and id-renamable.

- **Load:** `Object.entries(nodes)` → array (insertion order preserved).
- **Save:** reduce the array back to a record keyed by `id`, in array order.
- **Validation:** node `id` is required and must be unique across the array (a form-level validator on the nodes `FormArray`); duplicate ids surface inline before Zod runs. Empty list is blocked (schema requires ≥1 node).

Key order in the resulting record may differ from the original file, which is acceptable: the round-trip criterion is *semantic* equivalence (deep-equal ignoring key order), not byte-for-byte.

### D4 — Mutations: form `{ key, op, value, by }` → op-specific JSON

The mutation editor is a `FormArray` of groups `{ key, op, value, by }`. The template shows only the field relevant to the selected `op`: `value` for `set`, `by` (number) for `increment`, nothing for `toggle`. Serialization in `toContent`:

| op | emitted JSON |
|----|--------------|
| `set` | `{ key, op: 'set', value }` |
| `increment` | `{ key, op: 'increment', by }` |
| `toggle` | `{ key, op: 'toggle' }` |

On load, the inverse: a `{ key, value }` shorthand-set or `{ key, op:'set', value }` both load as `op:'set'`; `increment` reads `by`; `toggle` clears both. `key` is scope-prefixed free text (`local.foo` / `global.bar`) with a soft validator (warn, not block, if the prefix isn't `local.`/`global.` — the schema itself does not constrain it).

**Alternative considered:** model the discriminated union with separate controls per op via a `FormGroup` swap on `op` change. Rejected as heavier than carrying inert `value`/`by` controls and pruning at serialize time.

### D5 — Condition builder: recursive component over a `kind`-tagged `FormGroup`

A single standalone component (`condition-builder.ts`) binds to a `FormGroup` carrying a synthetic `kind` discriminator the JSON does not have: `kind ∈ { leaf, and, or }`.

- `kind = 'leaf'` → controls `{ key, op, value }`, op ∈ `eq|neq|gt|lt|gte|lte|in`. For `in`, `value` is an array editor (comma-split or chip list); for the others, a single primitive (string/number/boolean inferred). Serializes to `{ key, [op]: value }`.
- `kind = 'and' | 'or'` → a `FormArray` named `children` of nested condition `FormGroup`s, rendered by recursively instancing the same component. Serializes to `{ and: [...] }` / `{ or: [...] }`.

Buttons: **add leaf**, **add AND group**, **add OR group**, **remove**. The component renders itself for each child (`@for` over `children`), giving unbounded nesting; the acceptance criterion (and-inside-or-inside-and, ≥3 levels) falls out naturally.

On load, `{ and: [...] }`/`{ or: [...] }` map to the combinator kinds; any single-operator object maps to `kind:'leaf'` with `op` = the present key. **`{ default: true }` is not a `kind` of the builder** — see D6.

**Leaf-to-combo conversion (D14):** a leaf node exposes "Converti in AND" / "Converti in OR" buttons. These emit a `@Output() convert: EventEmitter<FormGroup>` carrying a new combo group whose sole child is a clone of the current leaf. Parents handle replacement: the recursive combo template calls `replaceChild(i, g)` internally; root call sites in `node-editor.ts` call `group.setControl('when', g)`. This allows any root condition (choice `when`, variant `when`, branch `when`) to be promoted from a simple leaf to a multi-condition AND/OR tree.

**Alternative considered:** a `op: 'and'|'or'|'leaf'` field reusing the same name as leaf operators. Rejected — collides conceptually; a separate `kind` control is clearer and never serialized.

### D6 — `default: true` fallback handled by the variant/branch editors, not the condition builder

`{ default: true }` is, schema-wise, a member of the `Condition` union, but in practice it marks a *fallback* on a `NodeVariant` (`default?: true`) and on an input `Branch` (`{ default: true, target }`). Rather than offer "default" as a condition kind that could be illogically nested inside `and`/`or`, the editor models it where it belongs:

- **Variants:** each variant is either conditional (has a `when` built by the condition builder) or the default fallback (a "Predefinita (fallback)" toggle → emits `default: true`, no `when`). Exactly one variant per node may be the default; a validator enforces at-most-one.
- **Input branches:** each branch is either conditional (`when` + `target`) or the default fallback (toggle → `{ default: true, target }`). At-most-one default per component.

This keeps the recursive condition builder focused on `leaf`/`and`/`or` and prevents nonsensical trees.

### D7 — Save pipeline: serialize → Zod → inline errors → `PUT`

On "Salva":
1. `raw = form.getRawValue()`.
2. `content = toContent(raw)` (D2; prunes empty optionals per D8).
3. `result = TerminalContentSchema.safeParse(content)`.
4. **On failure:** map each `issue.path` to the corresponding control and set a `{ schema: issue.message }` error on it (and/or render a summary list with the path). The path-to-control resolver walks the same array indices `toContent` produced, so `nodes[2].choices[0].when...` lands on the right control. Focus/scroll the first offending field.
5. **On success:** `terminalsApi.update(id, content)` → on 200, reset the form's pristine baseline to the saved content, clear the dirty flag, success toast. On non-2xx, keep the form dirty and show the API error message.

Defence-in-depth: validation happens client-side even though the form constrains most inputs, because the recursive/freeform parts (keys, values, condition trees) can still produce invalid combinations.

### D8 — Canonical serializer prunes empty optionals (round-trip stability)

`toContent` must omit optional fields that are empty so a round-trip stays semantically identical and diffs stay small:
- A choice with no `when` emits `{ label, target }` — not `when: undefined` or `set: []`.
- `on_enter`, `choices`, `variants`, `components` are omitted when empty arrays; `text` omitted when blank (unless it's the only content of a node — a node needs at least one of text/choices/variants/components to be meaningful, though the schema permits an empty node).
- `meta.id` from the loaded content is preserved verbatim (never regenerated on edit).
- Mutations/conditions emit only the keys their op/kind requires (D4, D5).

This is the crux of the round-trip acceptance criterion and is the most test-worthy part of the mapping layer.

### D9 — Markdown preview via `ngx-markdown` (per-node, not terminal playback)

The propose prompt both asks for `ngx-markdown` node-text preview *and* defers "live preview". These are different things: the deferred item is **terminal playback simulation** (evaluating state, walking nodes). The in-scope item is a **static Markdown render of the node's `text` field** beside its textarea. Slice 5 includes the latter only.

`ngx-markdown` (with peer `marked`) is added to `package.json` and provided once (`provideMarkdown()` in the app config). Each node editor shows a two-pane layout: a `text` textarea and a `<markdown [data]="textCtrl.value">` preview. No sanitization concerns beyond `ngx-markdown` defaults — content is authored by trusted admins.

**Alternative considered:** hand-roll Markdown with a tiny renderer. Rejected — `ngx-markdown` is the named, maintained choice and avoids reinventing parsing. **Version risk** noted in Risks (Angular 21 peer range).

### D10 — `update()` API method and MSW `PUT` handler

`TerminalsApiService.update(id, content): Observable<TerminalContent>` issues `PUT /terminals/:id` with the canonical body. The MSW handler:
- 404 if the id is unknown.
- Otherwise overwrites `record.content` with the body, **preserving** the server-side `id`/`campaignId`/`hiddenId`/`createdAt`/`views` sidecar fields and bumping `updatedAt = now`.
- Returns the stored `content` (matching `GET /terminals/:id`), so a subsequent reload/export reflects the save.

The mock does not re-validate with Zod (consistent with Slice 4 D8 — the client validator is authoritative in dev).

### D11 — State variable editor mirrors the discriminated union

Each state variable (in the local or global `FormArray`) is a group `{ name, type, default, values }`. The visible/required controls switch on `type`:
- `boolean` → `default` is a checkbox.
- `number` → `default` is a number input.
- `string` → `default` is a text input.
- `enum` → a `values` chip/list editor (≥1 value) plus `default` constrained to a dropdown of the entered values (mirrors the schema's `superRefine` that default ∈ values).

Serialization keys the local/global records by `name`; duplicate names within a scope are blocked by a form validator. `values` is omitted for non-enum types.

## Risks / Trade-offs

- **[Risk] Zod issue paths don't map cleanly to controls for the recursive/record parts.** A `nodes` record keyed by id vs. a `FormArray` index, and the `kind`-tagged conditions, mean `issue.path` indices may not line up 1:1. → **Mitigation:** the path-to-control resolver is written against the *same* index order `toContent` emits; conditions validated bottom-up so the failing leaf is reachable. If a path can't be resolved, fall back to a top-of-form summary list (path string + message) so no error is ever swallowed.
- **[Risk] Round-trip not byte-identical** because record key order and pruned optionals differ from the source file. → **Accepted/Mitigated:** the acceptance is *semantic* equivalence (deep-equal ignoring key order). D8's pruning keeps the comparison clean; document the comparison method in the verification tasks.
- **[Risk] `ngx-markdown` peer-dependency range may not yet list Angular 21.** → **Mitigation:** pin a compatible `ngx-markdown`/`marked` pair; if none supports Angular 21 cleanly, install with an explicit version and, only if required, an `overrides` entry — recorded as an open question rather than silently forcing.
- **[Risk] Large recursive forms (deep condition trees, many nodes) hurt change-detection performance.** → **Mitigation:** all editor components use `OnPush`; recursion binds to stable `FormGroup` references; avoid recomputing derived values in templates (use signals/`computed`).
- **[Risk] Free-text scope-prefixed keys (`local.x`) can reference undeclared variables.** → **Accepted for MVP:** keys are validated for shape only (soft `local.`/`global.` warning), not cross-checked against declared state. Cross-validation against the state schema is a Nice-to-Have; flagged as an open question.
- **[Trade-off] Carrying inert `value`/`by`/`values` controls** that are pruned at serialize time (D4, D11) is slightly wasteful but far simpler than swapping `FormGroup` shapes on every `op`/`type` change.
- **[Trade-off] No autosave / no optimistic locking.** Two admins editing the same terminal can clobber each other (last `PUT` wins). Acceptable for MVP; the dirty indicator at least prevents accidental navigation loss within a session.

### D12 — Variable-key autocomplete via HTML `<datalist>`

Condition-builder (leaf `key` input) and mutation-editor (`key` input) accept scope-prefixed free text (`local.foo` / `global.bar`). To guide authors toward declared variables, each component gains an `@Input() availableKeys: string[] = []` and renders a single `<datalist>` element (outside the `@for` loop) populated from that list. The `key` input's `list` attribute points to the datalist by a fixed per-component id.

The list is computed in `terminal-editor.ts` from `stateLocal` and `stateGlobal` FormArrays, updated reactively via `merge(stateLocal.valueChanges, stateGlobal.valueChanges).pipe(startWith(null))`, and threaded as `@Input()` through `nodes-section → node-editor → mutation-editor / condition-builder`. The recursive `<app-condition-builder>` self-usage also passes `[availableKeys]` down.

HTML `<datalist>` is chosen over a custom dropdown: zero extra dependencies, native browser autocomplete UX, and free-text entry is still allowed (for keys referencing variables not yet declared, which is a valid intermediate state).

**Alternative considered:** a `<select>` restricted to declared keys. Rejected — blocks authoring if the author wants to type the key before declaring the variable, which is a natural sequence.

### D13 — Per-node login gate: `loginUsers` in each node FormGroup

The terminal JSON supports `node.login.users: string[]` (§5.5 of the authoring guide) to gate a node behind a fictional-login challenge. The initial implementation omitted this field.

**Form model:** each node group gains `loginUsers: FormControl<string[]>` (initial value: `node.login?.users ?? []`). Serialization: `loginUsers.length > 0` → emit `"login": { "users": loginUsers }`; omit otherwise (clean round-trip for nodes that have no gate).

**UI:** a `<select multiple>` in the node editor, populated from `availableUsernames: string[]` (threaded `terminal-editor → nodes-section → node-editor`, computed as `usersArray.controls.map(c => c.get('username')?.value).filter(Boolean)`). When `availableUsernames` is empty, a note directs the author to declare users in the Utenti fittizi section first.

**Alternative considered:** free-text tag array (comma-separated or add/remove inputs). Rejected — usernames must match top-level `login.users` entries per the spec; a `<select multiple>` constrained to declared users enforces correctness and prevents silent typos.

### D14 — AND/OR at root level: leaf-to-combo conversion via `@Output() convert`

**Problem:** `makeChoiceGroup`, `makeVariantGroup`, and `makeBranchGroup` initialize the `when` group as `makeLeafGroup()`. The condition builder's `+ AND` / `+ OR` buttons only appear in combo mode, making AND/OR unreachable from a freshly-created root condition.

**Fix:** the condition builder leaf row gains two buttons: "Converti in AND" and "Converti in OR". Clicking one runs `wrapInCombo(kind)`:
1. Create a new combo group (`makeComboGroup(kind)`).
2. Push a clone of the current leaf (`key`, `op`, `value`) into the combo's `children`.
3. Emit the combo via `@Output() convert: EventEmitter<FormGroup>`.

**Parent wiring:**
- Inside the recursive combo template (children array): `(convert)="replaceChild(i, $event)"` — handled entirely within `condition-builder.ts` via `children.setControl(i, newGroup)`.
- Root call sites in `node-editor.ts`: `(convert)="replaceChoiceWhen(ci, $event)"`, `(convert)="replaceVariantWhen(vi, $event)"`, `(convert)="replaceBranchWhen(comp, bi, $event)"` — each calls the enclosing FormGroup's `setControl('when', newGroup)`.

No schema change. A single-child AND is valid per the condition schema and serializes to `{ "and": [{ "key": ..., "<op>": ... }] }`. The round-trip is stable.

**Alternative considered:** always initialize root conditions as combo groups (default to AND with empty children). Rejected — changes the serialized output for every existing simple condition (`{ "and": [{ key, eq: val }] }` instead of `{ key, eq: val }`), which breaks the round-trip stability criterion and adds noise to exports.

### D15 — Two identifiers: server-owned `id` vs. user-authored `hiddenId`

A terminal has **two** distinct identifiers, and the initial Slice 5 implementation conflated them (it displayed `meta.id`, serialized `meta.id` back on save, and treated the sidecar `hiddenId` as a server-generated codename).

| | `id` (a.k.a. `meta.id`) | `hiddenId` (`meta.hiddenId`) |
|---|---|---|
| Owner | Server | Author (human) |
| Purpose | The identifier used in **API call paths** (`/terminals/:id`, `PUT`, export, delete) | A friendly, optional slug for hidden-terminal lookup |
| Uniqueness | Globally unique (server-assigned) | Unique **within the campaign**, enforced only when present |
| UI visibility | **Never shown** in the UI | The only id surfaced in the UI (detail page, list "Codename" column, metadata editor) |
| Lifecycle | Injected by the API on every read; **not sent** by the client on create/import/update; **stripped** from exports | Round-trips on import/export; editable in the metadata section |

**Schema (additive):** `MetaSchema.id` becomes `optional()` (present on reads, absent on writes/exports) and `MetaSchema.hiddenId: z.string().optional()` is added.

**Mapping (`terminal-form.ts`):** the meta `FormGroup` keeps `id` (loaded for reference, never displayed) and gains a `hiddenId` control. `toContent` omits `id` entirely and emits `hiddenId` only when non-empty (pruned-optional rule, D8).

**Mock (`terminals.handlers.ts`):** stored content carries no `meta.id`; `withMetaId` injects it on `GET`/`PUT` responses; `stripMetaId` removes it on create/import/update; export returns content without `id`. The DTO `hiddenId` is sourced from `content.meta.hiddenId` (no more server codename). create/import/update return **409** when a non-empty `hiddenId` collides with another terminal in the same campaign.

**UI:** the detail page shows `meta.hiddenId` (when present) instead of `meta.id`; the metadata editor replaces the read-only ID display with an editable "ID nascosto" input; the export filename derives from `hiddenId` (falling back to a title slug) since `meta.id` is no longer present in exports.

**Alternative considered:** keep the server-generated codename as `hiddenId` and leave `meta.id` displayed. Rejected — it contradicts the authoring guide (the real API strips `meta.id` and treats `hiddenId` as author-owned), and exposing the API id in the UI invites authors to reference an unstable, server-owned value.

### D16 — `hiddenId` resolution endpoint

`GET /campaigns/:campaignId/terminals/by-hidden-id/:hiddenId` is the **only** API call keyed on `hiddenId`; every other terminal call uses the server-owned `id`. `TerminalsApiService.getByHiddenId(campaignId, hiddenId): Observable<TerminalDto>` issues it, and the mock resolves the matching record (404 if none). It is exposed as the canonical lookup path so any future "open hidden terminal by slug" flow uses it rather than inventing another hiddenId-keyed route.

## Migration Plan

Additive. New editor files under `src/app/features/terminals/editor/`, one new API method, one new MSW handler, one new dependency. The only modification to existing behavior is replacing the detail-page placeholder with the editor — the metadata panel and export button remain. Rollback: revert the slice's commits and remove the `ngx-markdown` dependency; the detail page returns to the Slice 4 placeholder and the rest of the app is unaffected.

## Open Questions

- **`ngx-markdown` version for Angular 21** — confirm a compatible release exists during implementation; if not, decide between an `overrides` pin and deferring the preview pane to a follow-up. (Default: pin a compatible version.)
- **Cross-validate condition/mutation keys against declared state variables?** — ~~Deferred Nice-to-Have.~~ **Partially addressed by D12:** native `<datalist>` autocomplete provides soft guidance toward declared keys. Full hard validation (blocking save if a key is undeclared) remains a Nice-to-Have for a follow-up slice.
- **Should discard prompt for confirmation when dirty?** — Default: yes, a small confirm to avoid accidental loss; revisit if it feels heavy.

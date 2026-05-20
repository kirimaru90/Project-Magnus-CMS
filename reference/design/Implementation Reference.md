# RobCo Backoffice — Implementation Reference

> Companion document to `Backoffice Prototype.html`.
> Captures the design tokens, component inventory, screen specs, and behavioural contracts a developer needs to reimplement the prototype in their target stack (React, Vue, Svelte — pick your poison; the contract is the same).
>
> The prototype itself is the source of truth for visuals. This doc is the source of truth for **structure, naming, and behaviour**.

---

## 0 · TL;DR for the implementer

- **Stack-agnostic design system**: all visual decisions live in CSS variables (`--bo-*`) declared in `css/tokens.css`. Theme switching = swap a `data-theme` attribute on the root frame.
- **Two themes**, light and dark. **One accent** (terminal-green by default; the Tweaks panel can swap to amber / blue but production should ship green only unless requested).
- **Three real screens**: Terminali (list + inspector), Editor nodi (form + graph toggle), Stato (global + local tables).
- **Theme is per-user**, persisted to `localStorage` under key `rc.bo.theme`. Should later move to user preferences on the API.
- **No icon library shipped** — icons in the prototype are 14px inline SVGs (Feather-style stroke). You can swap to lucide / phosphor / heroicons; sizes and stroke widths in this doc are what looked right.
- **Italian copy**. Keep it.

---

## 1 · Design tokens

All tokens are CSS custom properties scoped to `.bo-frame`. Switching `data-theme="light|dark"` swaps the palette; an HSL accent triple (`--bo-accent-h/s/l`) lets you recolor without touching the rest.

### 1.1 Color palette

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bo-bg` | `#f5f3ee` | `#121210` | App background (behind cards) |
| `--bo-panel` | `#ffffff` | `#1b1b18` | Card / sidebar / topbar surface |
| `--bo-panel-2` | `#faf8f2` | `#232320` | Subtle alt surface (table headers, alternate rows) |
| `--bo-panel-sunk` | `#ebe8df` | `#0e0e0c` | Inset surfaces (code blocks, tag bg, graph canvas) |
| `--bo-border` | `#e3e0d6` | `#2c2c28` | Default 1px dividers |
| `--bo-border-strong` | `#cfccc1` | `#3b3b36` | Input borders, button borders |
| `--bo-text` | `#1a1a16` | `#ebe9df` | Primary text |
| `--bo-text-muted` | `#6a675e` | `#908d83` | Secondary text, sub-labels |
| `--bo-text-faint` | `#a39f93` | `#5f5d54` | Tertiary (IDs, kbd hints, "no data") |
| `--bo-text-inverse` | `#ffffff` | `#0c0c0a` | Text on accent (primary buttons) |
| `--bo-danger` | `#b8442b` | `#e87355` | Destructive action / error |
| `--bo-warn` | `#a17517` | `#d6a64a` | Warnings, draft state, fallback condition |
| `--bo-hover` | `rgba(0,0,0,.04)` | `rgba(255,255,255,.04)` | Generic row/button hover |
| `--bo-active` | `rgba(0,0,0,.06)` | `rgba(255,255,255,.07)` | Pressed state |

**Accent** (terminal green, used for primary buttons, active nav, modified-state pills, global-state emphasis):

```css
--bo-accent-h: 132;  /* light theme */
--bo-accent-s: 52%;
--bo-accent-l: 32%;

/* dark theme */
--bo-accent-h: 128;
--bo-accent-s: 70%;
--bo-accent-l: 60%;

--bo-accent:      hsl(var(--bo-accent-h) var(--bo-accent-s) var(--bo-accent-l));
--bo-accent-text: hsl(var(--bo-accent-h) var(--bo-accent-s) calc(var(--bo-accent-l) ± offset));
--bo-accent-soft: hsl(var(...) / 0.10|0.14);   /* active row bg, primary-button-soft */
--bo-accent-edge: hsl(var(...) / 0.30|0.35);   /* focus rings, accent borders */
```

**CRT preview palette** (only used inside `.bo-crt`):
- `--bo-crt-bg: #0a0a08`
- `--bo-crt-fg: #33ff66`

### 1.2 Typography

```
UI:    Inter, system-ui, -apple-system, "Segoe UI", sans-serif
       weights: 400, 500, 600, 700
Mono:  JetBrains Mono, "IBM Plex Mono", ui-monospace, monospace
       weights: 400, 500, 600
```

**When to use mono** (this is the entire "Fallout flavor" lever):
- All IDs (`super-duper-admin`, `local.access_count`)
- All section titles inside cards (`bo-card-head`)
- All tabular numbers and state values
- Topbar labels (`v0.4.1`, `admin.king`)
- Sidebar section labels (`CAMPAGNA`, `SISTEMA`)
- ASCII rules (`──── FINE ELENCO ────`)
- Status pills (`bo-pill`, `bo-tag`)
- Primary button labels (rendered as `[ Salva ]` via `::before` / `::after`)

Body copy, page titles ("Stato della campagna"), and form values use Inter.

**Numeric values** must use `font-variant-numeric: tabular-nums` (`.t-num` class).

**Sizes used** (no scale system, just these):
- 19px / 600 — Card inspector titles
- 16px / 600 mono uppercase — Page header `<h1>`
- 13.5px / 500 — Card titles
- 12.5–13px / 400 — Body text
- 12px / 500 mono — Form field values, IDs
- 11px / 500 mono uppercase — Card-head labels, tabs, sidebar items
- 10–10.5px mono uppercase letterspaced — Section labels, status pills

### 1.3 Spacing & radii

- Spacing scale (in px): **4, 6, 8, 10, 12, 14, 16, 18, 20, 24** — no arbitrary values
- Radii: `--bo-radius` 6px (cards, inputs), `--bo-radius-sm` 4px (buttons, tags), `--bo-radius-lg` 10px (modals if any), `999px` (pills)
- Density: **comfortable** for lists, **compact** for the editor and the node list
- Default row heights: 28px buttons/inputs, 24px compact, 22px micro

### 1.4 Shadows

Almost never used. Cards are bordered, not shadowed. The two exceptions:
- `--bo-shadow-sm`: `0 1px 2px rgba(0,0,0,.04)` — toggle thumbs, floating chips
- `--bo-shadow`: under modals / popovers if introduced later

---

## 2 · Component inventory

Listed in dependency order. Names match the prototype's React function names; rename freely.

### 2.1 Frame / chrome

| Component | Purpose | Key props |
|---|---|---|
| `Frame` | Static frame wrapper for design-canvas use | `theme`, `accentH`, `crumbs`, `sidebar`, `noSidebar` |
| `PrototypeFrame` | Interactive shell (manages theme state externally) | `theme`, `onToggleTheme`, `screen`, `onNav`, `crumbs` |
| `InteractiveTopbar` | Logo + breadcrumbs + version + theme toggle + user chip | `theme`, `onToggleTheme`, `crumbs`, `user` |
| `InteractiveSidebar` | Campaign switcher + 2 nav groups (Campagna, Sistema) + status footer | `screen`, `onNav` |
| `PageHeader` | Title + sub + right-aligned actions; wraps on narrow viewports | `title`, `sub`, `actions` |

**Sidebar layout**:
- Width: 200px fixed (`flex: 0 0 200px`)
- Section label → nav links with optional count → footer
- Active state: left accent bar (`::before`), soft accent background, accent-text color

**Topbar layout**:
- Height: 44px fixed
- 12px gutter on each side, 14px gap between elements
- Right-side: version string · theme toggle (sun/moon icon button) · user chip

### 2.2 Primitives

| Class / component | Purpose |
|---|---|
| `.bo-btn` | Base button — 28px tall, 11px padding, 4px radius |
| `.bo-btn.primary` | Accent fill, mono uppercase label, `[ ]` brackets auto-added via pseudo-elements |
| `.bo-btn.ghost` | Transparent, no border, muted text |
| `.bo-btn.danger` | Danger-colored text |
| `.bo-btn.icon` | Square 28×28 icon-only |
| `.bo-input` | Text input, 28px tall |
| `.bo-input.mono` | Mono variant — for IDs, values |
| `.bo-input.textarea` | Multi-line, auto height |
| `.bo-select` | Native select with custom chevron |
| `.bo-search` | Input wrapped with search icon + optional kbd shortcut chip |
| `Pill` / `.bo-pill` | 19px tall mono uppercase pill. Variants: `active` (green), `warn` (amber), `danger`. Optional `dot` |
| `.bo-tag` | Smaller, square-cornered alternative — 18px, no transformation |
| `Rule` / `.bo-rule` | ASCII-style section divider — dashed flanking lines with mono uppercase text in the middle |
| `.bo-switch` | Pill-shaped toggle. Add `.on` class for the active state |

### 2.3 Cards & tables

`bo-card` is the workhorse container. Used for: list panels, inspector panels, table wrappers, state cards.

```
<div class="bo-card">
  <div class="bo-card-head">
    <Icon/> <span>Card title</span> <span class="bo-tag">badge</span>
    <div class="actions">
      <button class="bo-btn ghost">...</button>
    </div>
  </div>
  <!-- card body -->
</div>
```

- `bo-card-head` is 11px mono uppercase. The `actions` slot is right-aligned via `margin-left: auto`.
- An accent-green head variant exists for "global" emphasis (Stato globale, importance markers): override `background: var(--bo-accent-soft)` and `color: var(--bo-accent-text)` inline.

`bo-table` is the standard data table:
- Header row: 10.5px mono uppercase, panel-2 bg, no left padding before first column? — actually 12px on every cell.
- Body rows: 12.5px, 9px vertical / 12px horizontal padding, 1px border-bottom (none on last).
- `.id` class on cells with IDs (mono, muted, 11.5px). `.num` class for tabular numerics.
- `.row-actions` containers inside a row are `opacity: 0` and reveal on row hover.

### 2.4 CRT preview

The `.bo-crt` block is the only place where the Fallout aesthetic gets full. Used for inline node-text previews.

```css
.bo-crt {
  background: var(--bo-crt-bg);    /* #0a0a08 regardless of theme */
  color: var(--bo-crt-fg);          /* #33ff66 */
  font-family: var(--bo-font-mono);
  text-shadow: 0 0 4px var(--bo-crt-fg);
  /* ::before adds a 3px-period scanline overlay */
}
.bo-crt .choice::before { content: "> "; }
.bo-crt .cursor::after { content: "_"; animation: bo-blink 1s steps(2) infinite; }
```

The CRT block does NOT respect dark/light theme — it's always dark phosphor. That's intentional: it represents the player-facing terminal.

### 2.5 Node-editor specifics

| Component | Role |
|---|---|
| `NodeList` / `NodeListItem` | Left column. Each item shows status dot, title, ID, type badge, choice count, login icon if any. |
| `FormSection` | Section wrapper inside the form column. Mono uppercase label + a dashed-line filler to the right edge. |
| `MutationRow` | Grid row: `scope` (select) · `var name` (input) · `op` (select) · `value` (input) · trash button. Used in "on enter" and inside choices. |
| `ChoiceRow` | A card-like block: drag handle · label · `→` · target node select · trash. Below it, badges for attached condition / mutations + "add condition" / "add mutation" buttons. |
| `ConditionBuilder` | Recursive AND/OR + leaf predicate builder. Produces structured JSON matching the schema in `SERVER-DESIGN.md`. |
| `LivePreview` | The mini CRT inside the editor's right column. Re-renders on any form change. |
| `NodeGraph` | SVG-based flow view. 9 nodes / ~11 edges in the mock. Renders inside the same `bo-card` shell as the form, so the toggle swap is seamless. |

The form/graph toggle is a segmented control in the page header's `actions` slot. State lives on the editor screen, not globally.

### 2.6 Tweaks panel

Optional. The prototype uses a generic floating panel for theme + accent. In production:
- Theme toggle: already in the topbar (sun/moon icon)
- Accent: probably ship one. Don't expose to users.

The Tweaks code can be deleted from the production bundle.

---

## 3 · Screens

### 3.1 Terminali (`/campaigns/:id/terminals`)

**Layout**: 2-column grid. Left = list card (~440px). Right = inspector stack (cards stacked vertically).

**Left card** (`bo-card` with scrollable body):
- Head: count badge, "X pubb / Y nasc" tags, filter button, sort select
- Rows: title (with active highlight) · status pill · ID + node count + lock icon (if `hasLogin`) + relative date
- Active row: 2px accent border-left + soft accent background + accent-text title
- Click → selects, updates inspector

**Right column** (stack of `bo-card`s):
1. **Title card** — kicker, title, ID + meta, action buttons (export, preview, primary "Modifica")
2. **CRT preview card** — head with eye icon + "Apri in player" link, body containing a `.bo-crt` block of the start node
3. **Two state cards side-by-side** — local (neutral) and global (accent-green head). Each shows ~5 rows of `key | value`, modified rows in accent
4. **Login users card** (only if terminal has fictional login) — username + "password hashata, non visibile al client" hint + edit button

**API calls** to wire:
- `GET /campaigns/:id/terminals` → list
- `GET /terminals/:id` → inspector content (terminal struct, current state snapshot)
- "Modifica" button → navigate to editor screen, pass `:id`
- "Esporta" → `POST /terminals/:id/export`

**Empty / error states** (not in prototype, add):
- No terminals yet: card with placeholder "Nessun terminale ancora · [ Crea il primo ]"
- Loading: skeleton rows in the left card

### 3.2 Editor nodi (`/terminals/:id/edit`)

**Layout**: 3-column grid. Left = node list card (260px). Middle = form **or** graph card. Right = preview/state/diagnostics stack (360px).

**Page header**:
- Title: terminal title (16px mono uppercase). Sub: ID · node count · author.
- Actions: `← Torna ai terminali` ghost button · `[Form][Grafo]` segmented toggle · `auto-salvato HH:MM:SS` active pill · primary `Pubblica` button.

**Form mode middle card**:
- Head: ID badge + node title + flag pills (`login`, `+1 mutazione`, `3 scelte`)
- Body sections, in order:
  1. **Identificativo** — ID input + Titolo input (2-col grid)
  2. **Testo · markdown** — tall textarea
  3. **On enter** — `MutationRow`s + "+ mutazione" button
  4. **Scelte** — `ChoiceRow`s + "+ Aggiungi scelta" button
  5. **Login · utenti finti** — only if applicable. User + password row, "Le password sono memorizzate hashate" hint.

**Graph mode middle card**:
- Head: "Grafo · flusso narrativo" + edge/cycle counts + reorganize / export SVG buttons
- Body: SVG canvas with radial-gradient dotted bg, nodes as 160×56 rounded rects, dashed edges = conditional, solid = unconditional
- Active node highlighted with accent border
- Legend in bottom-left, zoom controls (+/-/⊡) in bottom-right
- Click a node → switch back to Form mode focused on that node

**Right column** (3 stacked cards):
1. **Anteprima dal vivo** — `.bo-crt` block, re-renders on form edits. Substitutes `{{var}}` from the simulated state.
2. **Stato simulato** — list of `scope.key → value` rows. Modified values in accent. Reset button in head.
3. **Diagnostica** — bullet list: ✓ reachability, ✓ undeclared vars, ! orphan nodes.

**API calls**:
- `GET /terminals/:id` → load nodes
- `PUT /terminals/:id` → save (debounced auto-save; manual on "Pubblica")
- All state mutations go through the validation engine client-side first (the API will validate again)

**Open questions for implementation** (call these out before building):
- Auto-save granularity: per field blur, or debounced 1s after last edit?
- Conflict resolution: two admins editing same terminal — show a banner ("modificato da T. Kowalski 2m fa, ricarica"), or hard-lock?
- Graph layout: store positions per node in the terminal JSON, or recompute on every load?
- Undo stack: in-session only, or persisted?

### 3.3 Stato (`/campaigns/:id/state`)

**Layout**: Two stacked cards. Top = global (accent head). Bottom = local.

**Page header actions**: search · `Esporta snapshot` · destructive `Ripristina tutto`.

**Filter bar** (above the cards):
- Tabs: Globale (count) · Locale (count) · Tutte (count) — switches which card(s) show
- Right side: terminal filter select · "solo modificate" toggle switch

**Global card**:
- Head bg = `bo-accent-soft`, text = `bo-accent-text`
- Tag: "N var · M modificate"
- Right side of head: hint text ("condiviso fra tutti i terminali della campagna") + "Ripristina globali" ghost button
- Body: `bo-table` with columns: Variabile · Tipo · Default · Valore corrente (editable) · Dichiarata in · Stato · row actions
- Modified rows: accent-soft background, accent-text values, **600 weight**
- Variable name prefix: green `global.` then key

**Local card**:
- Neutral head, same table structure
- Last column: terminal owner instead of "dichiarata in"

**Bottom footer**: ASCII rule with snapshot time on the right (`SNAP · 14:32:08`).

**API calls**:
- `GET /campaigns/:id/state` → global rows
- For each terminal: `GET /terminals/:id/state` → local rows (or denormalize on the API into one endpoint)
- Inline edit → `POST /.../state/mutate` per field blur
- Per-row reset → `POST /.../state/:key/reset`
- "Ripristina globali" → `POST /campaigns/:id/state/reset`
- "Ripristina tutto" → confirm modal, then `POST` to both campaign + every terminal reset endpoint (atomic backend call preferred)

### 3.4 Screens not in this prototype

The sidebar shows these as nav items with placeholders. They need design before implementation:
- **Panoramica** (dashboard)
- **Giocatori** (campaign members assignment)
- **Import / Export** (JSON import flow with validation feedback)
- **Utenti** (real-user admin, role assignment)
- **Impostazioni** (campaign settings: name, active, is_public)

Don't ship them yet; show the placeholder card or hide from the nav until designed.

---

## 4 · Theme system

### 4.1 Mechanics

- Root frame element carries `data-theme="light"` or `data-theme="dark"`.
- CSS scoped to `.bo-frame[data-theme="light"]` / `.bo-frame[data-theme="dark"]` declares all tokens.
- All component styles read tokens via `var(--bo-*)`. No hardcoded colors in component CSS.

### 4.2 Persistence

```js
// On load
const theme = localStorage.getItem('rc.bo.theme') || 'light';

// On toggle
localStorage.setItem('rc.bo.theme', next);
```

When user authentication is in place, also sync to API as a user preference so the choice follows them across devices.

### 4.3 Accent override

```js
frameEl.style.setProperty('--bo-accent-h', '38');  // amber
```

Production should ship with `--bo-accent-h: 132` (light) and `128` (dark) and leave it alone.

### 4.4 Honoring system preference (recommendation)

If no localStorage entry exists, fall back to `prefers-color-scheme`:

```js
const stored = localStorage.getItem('rc.bo.theme');
const initial = stored
  || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
```

---

## 5 · File structure (suggested)

```
src/
  app/
    App.tsx                # Top-level: theme + screen state, route mounting
    routes.ts              # Route definitions
  chrome/
    Frame.tsx              # PrototypeFrame
    Topbar.tsx
    Sidebar.tsx
    PageHeader.tsx
  primitives/
    Button.tsx             # bo-btn
    Input.tsx              # bo-input, bo-search
    Select.tsx
    Pill.tsx               # bo-pill + bo-tag
    Switch.tsx
    Card.tsx               # bo-card + bo-card-head
    Rule.tsx               # ASCII rule
    Table.tsx              # bo-table wrapper
    Crt.tsx                # bo-crt preview
  icons/
    index.tsx              # All inline SVGs (or replace w/ icon lib)
  screens/
    Terminals/
      TerminalList.tsx
      TerminalInspector.tsx
    NodeEditor/
      NodeEditor.tsx
      NodeList.tsx
      NodeForm.tsx
      NodeGraph.tsx
      LivePreview.tsx
      mutations/ChoiceRow.tsx
      mutations/MutationRow.tsx
      mutations/ConditionBuilder.tsx
    State/
      StateScreen.tsx
      StateTable.tsx
  api/
    client.ts              # Fetch wrapper with auth
    terminals.ts
    state.ts
    campaigns.ts
  styles/
    tokens.css             # the CSS-variable definitions (copy from prototype)
    components.css         # all .bo-* component styles
  hooks/
    useTheme.ts            # reads/writes localStorage, returns [theme, setTheme]
```

---

## 6 · Behavioural contracts

### 6.1 Active state highlighting

**Sidebar nav active**:
- `background: var(--bo-accent-soft)`
- `color: var(--bo-accent-text)`
- 2px accent bar on the left edge (`::before`, `left: -10px`)

**Selected list row** (terminal list, node list):
- Same as above, but the left bar replaces the row's default left border instead of overlapping the sidebar

**Modified state value** (state editor, terminal inspector):
- `bo-accent-soft` cell background
- `bo-accent-text` text color
- `font-weight: 600`
- Pill: `Pill tone="active" dot` with text "modificata"

### 6.2 Status semantics

| State | Pill | Where |
|---|---|---|
| Terminal pubblico, attivo | `tone="active" dot` "pubblico" | Inspector, list |
| Terminal nascosto | neutral `dot` "nascosto" | List row, inspector |
| Terminal bozza | `tone="warn" dot` "bozza" | List row |
| Variabile modificata | `tone="active" dot` "modificata" | State table |
| Variabile al default | neutral "default" | State table |
| Login required (node/terminal) | neutral pill w/ lock icon "login" | Inspector, editor header |
| Condizione fallback | `tone="warn"` "default" | Variant editor |
| Saved/autosaved | `tone="active" dot` "auto-salvato HH:MM:SS" | Editor header |

### 6.3 Destructive confirmations

Every destructive action ("Ripristina tutto", "Elimina terminale", "Rimuovi utente finto") must surface a confirmation modal. The prototype doesn't show the modal but production must have one.

Suggested copy pattern:
> **Ripristinare lo stato dell'intera campagna?**
> 11 variabili verranno riportate ai valori di default dichiarati nei terminali. Quest'azione non può essere annullata.
> `[ Annulla ]` `[ Ripristina ]`

### 6.4 Keyboard

Minimum:
- `⌘K` / `Ctrl+K` opens search in the current screen's primary search box
- `←` and `→` in the graph view pan; `+` / `-` zoom; `⊡` fit-to-screen
- `Esc` clears any selection / closes any modal
- `Tab` order is row → row, not cell → cell, in tables

---

## 7 · Implementation gotchas

- **Don't use viewport units for layout.** All screens use px-based grids with `minmax()` and a `min-width` on the scroll container, because the chrome (sidebar + topbar) eats a known amount of viewport. Mobile is out of scope.
- **Cards have `overflow: hidden`** so the rounded corners clip table headers correctly. Inner scroll containers must be explicit.
- **The CRT preview text-shadow** uses the literal accent color, not the token, because the CRT block has its own theme. Keep `#33ff66` as a literal.
- **Mono numerals**: any element rendering a number must have `font-variant-numeric: tabular-nums` (apply via `.t-num` or directly), otherwise digits jitter in lists.
- **Sidebar campaign switcher** is a button that opens a popover (not built in the prototype — add). When designing, allow filtering and a "Crea nuova campagna" footer.
- **Action button order**: secondary buttons first (left), destructive (if present) in the middle, primary always rightmost. Inside a card head, ghost buttons live in `.actions` and a single primary action lives in the page header, not the card.
- **Don't conditionally render entire cards based on permission.** Render the card empty/disabled with explanatory text so admins know features exist. Hide nav items only.

---

## 8 · Open questions to resolve with the team

1. **Auto-save vs explicit save** in the node editor — prototype shows both ("auto-salvato" pill + "Pubblica" button). Pick one as the primary contract or define what each means (draft vs published).
2. **Public terminals** — does a non-public campaign hide *all* its terminals from non-members, or are public/private flags per-terminal too? Spec says campaign-level; double-check.
3. **Fictional password display** — admin needs to author the puzzle. Show password in cleartext only during creation and never again? Or revealable with a "show password" toggle for the authoring admin only?
4. **Graph view layout persistence** — store node positions in the JSON content blob, or derive from a layout algorithm on every load? The prototype's positions are hand-placed.
5. **Snapshot system** — the State diff variant references snapshots; the V1 we shipped doesn't. Is this scope or noise?
6. **Search scope** — `⌘K` in the topbar should open a global "find anything" command palette, distinct from the per-screen filter inputs. Worth scoping in v1?

---

*Reference v1 · derived from `Backoffice Prototype.html` · update this doc when the prototype changes.*

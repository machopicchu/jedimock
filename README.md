# ⚡ JediMock Suite

A browser-based developer & QA toolkit for mocking APIs, editing JSON, validating, beautifying and comparing data — all in one app.

**No dependencies · No backend · No install · [jedimock.com](https://jedimock.com)**

---

## ✨ Features

### ⚡ Mock Generator

Intercept fetch and XHR requests in your browser and return custom JSON responses — without touching your backend. Paste one script in DevTools and every matching request is intercepted.

**Intercept modes**
- **Intercept** — patches both `fetch` and `XMLHttpRequest` simultaneously
- **Async ID** — captures a dynamic ID from a trigger request and injects it into a different URL's response. Supports Firestore `onSnapshot` patch for real-time updates.

**Target modes**
- **Response** — modify what comes back from the server
- **Request** — modify the outgoing request body before it reaches the server
- **Both** — modify both in one script

**Merge / Replace**
- **Merge changes** — apply your edits on top of the real data
- **Replace entirely** — ignore the real data, return/send exactly your JSON

**URL matching**
- Exact string: `/api/users`
- Wildcards: `/api/users/*`, `/api/*/orders`

**Response Rules** — stateful per-call mocking:
- `Call #N` — specific response on an exact call number
- `After call N` — response for all calls after N
- `Always` — always override
- Custom JSON, status code and delay per rule
- Enable/disable individually

**Request body editor**
- Full inline tree editor — same experience as the response editor
- Click any value to edit, add or delete fields
- Changes summary diff panel with field-level undo
- Merge your changes into the real body or replace it entirely

**Fallback mode**
- Available in both Intercept and Async ID modes (per tab)
- **Intercept fallback** — if the server never responds within the configured timeout, JediMock returns your mock instead. Triggers on timeout and network errors.
- **Async ID fallback** — if the response URL never fires after the trigger, JediMock constructs the full response URL using the captured ID and returns your mock. Requires the full response URL pattern (the `*` is replaced with the captured ID).
- Configurable timeout per tab — default 30 seconds
- Activation log shows `fallback: '30s'` when enabled

**Script generation**
- Clean output card showing URL, target, mode, active rules, fallback — no raw code visible
- Script is readable and ready to paste
- Auto-logs every interception: `⚡ JediMock active`, `⚡ JediMock intercepted`, `⚡ JediMock rule matched`, `⚡ JediMock fallback`
- **Outdated indicator** — Generate button turns amber with "Regenerate" label whenever config changes after generating. Copy button dims until regenerated.
- Clipboard fallback if copy API is blocked

**Other**
- Wildcard URL matching
- Status code override and response delay
- cURL import — auto-routes URL and body to the correct field based on target mode
- Built-in templates: Empty, 401, 403, 404, 500, Timeout, Slow (3s)
- Save your own custom templates
- Up to 100 tabs, each with independent configuration
- Import / Export config as JSON
- Share a tab as a compressed URL

---

### ✎ JSON Editor

A full-featured structured JSON editor with a powerful bulk operations toolbox.

- Interactive tree with inline editing, add, delete and rename on every node
- Depth-level visual system — colored guide lines per level
- Live search across all keys and values
- Large JSON support — lazy rendering for 5000+ nodes

**Bulk operations** (all scoped to selected depth level):
- **Bulk Add** — add a field to all blocks (custom value, null, empty, random, UUID, timestamp, auto-increment, nested objects/arrays)
- **Bulk Remove** — delete a field from all blocks
- **Bulk Rename** — rename a key across all blocks preserving order
- **Bulk Edit** — change a value across all blocks
- **Find & Replace** — global value replacement with regex support
- **Conditional Op** — WHERE field == value → SET field = value
- **Type Cast** — convert field types (string, number, boolean, null)
- **Sort & Transform** — sort keys A→Z or Z→A
- **Generate Blocks** — create N blocks from a template
- **Flatten / Unflatten** — convert nested JSON to flat and back
- **Deduplicate** — remove duplicate blocks

**Tabs:**
- 📊 **Analyze** — field coverage, value distribution, type inconsistencies, missing fields
- 🧬 **Schema** — auto-detect and export JSON Schema
- ⏱ **History** — last 20 operations with one-click undo

Send to Validator / Send to Beautifier / Download / Copy

---

### ✨ Beautifier

Format and minify JSON with side-by-side input/output.

- Pretty-print or minify
- Line gutters with copy button
- Swap input/output

---

### ⟷ Diff

Compare two JSON or text blocks with inline word-level highlights.

- Side-by-side diff with change highlighting
- Prev/Next navigation between differences
- Fullscreen mode
- Swap panels

---

### ✓ Validator

Lint JSON with accurate line-level error reporting.

- Correct line numbers for every error type
- Cascade suppression — no phantom errors from a single broken line
- Detects: missing commas, unclosed brackets, unterminated strings, trailing commas, unquoted keys
- Red line highlights + Prev/Next navigation
- Fix & Beautify — auto-repairs broken JSON and pretty-prints it

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/⌘ + 1` | Switch to Mock |
| `Ctrl/⌘ + 2` | Switch to Editor |
| `Ctrl/⌘ + 3` | Switch to Beautifier |
| `Ctrl/⌘ + 4` | Switch to Diff |
| `Ctrl/⌘ + 5` | Switch to Validator |
| `Ctrl/⌘ + T` | New tab (Mock tool) |
| `Ctrl/⌘ + Enter` | Generate script (Mock) |
| `Ctrl/⌘ + Shift + V` | Import cURL |
| `Ctrl/⌘ + F` | Search tree (Editor) |
| `Ctrl/⌘ + Shift + E` | Expand all (Editor) |
| `Ctrl/⌘ + Shift + C` | Collapse all (Editor) |
| `?` | Show shortcuts panel |
| `Esc` | Close modal / exit fullscreen |

---

## 🧪 Using the Mock Script

1. Set the URL pattern to intercept (e.g. `/api/users` or `/api/users/*`)
2. Choose your target — **Response**, **Request**, or **Both**
3. Paste your JSON and click **Load JSON** (for response) or **Load JSON** in the request body card
4. Edit fields in the tree if needed — changes are tracked in the diff panel
5. Set status code, delay, response rules, and fallback mode (optional)
6. Click **⚡ Generate Script**
7. Copy the script and paste it into your browser's DevTools console

The script intercepts all matching requests automatically. The console logs every interception with `⚡ JediMock intercepted`. Refresh the page to deactivate.

If you change any configuration after generating, the button turns amber — click **Regenerate** to update the script.

---

## 💾 Data Persistence

JediMock stores nothing on any server. All data lives in your browser via `localStorage` and is restored automatically on next visit. Every change autosaves within 1 second.

- **Export** — save all tabs as a `.json` config file
- **Import** — restore a saved config
- **Share** — compress the current tab into a URL hash
- **Clear session** — wipe all saved data and start fresh

---

## 🌍 Browser Support

| Feature | Requirement |
|---|---|
| Core app | Chrome 89+, Firefox 90+, Safari 15+, Edge 89+ |
| Share links | Chrome 80+, Firefox 113+, Safari 16.4+ |
| Clipboard paste | Chrome 89+, Firefox 90+, Safari 15+ |

---

## 📄 License

Business Source License 1.1 — free for personal and non-commercial use.
Commercial use requires a license: machopicchu97@gmail.com
Converts to MIT on January 1, 2030.

---

Built with ⚡ and zero dependencies. If JediMock saves you time, consider [buying me a coffee](https://buymeacoffee.com/machopicchu).

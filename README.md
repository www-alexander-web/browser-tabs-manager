# Browser Tabs Manager

Save the current window’s tabs as a session, close them, and restore/export/import sessions later — **privacy-friendly and local-only**.

## Features (MVP)

- **Capture tabs → create a session → close tabs**
  - Click the toolbar action or use the keyboard command (**Ctrl+Shift+Y**, macOS: **Cmd+Shift+Y**)
  - Captures tabs from the **current window**
  - Skips **restricted URLs** (`chrome://`, `edge://`, `about:`, etc.) and stores `skippedCount`
  - Persists the session **before** closing tabs (if closing fails, the session is still saved)
- **Manager page (dedicated extension page)**
  - Sessions list + session detail view
  - Editable **session title**, `createdAt` timestamp
  - Session items: `{ title, url, favIconUrl? }`
  - Actions:
    - Open one tab
    - Open all in a new window
    - Delete session
    - Export session to JSON
    - Import JSON as a new session
  - Search/filter across **session title + item title/url**
- **Storage**
  - Uses `chrome.storage.local` with a small repository abstraction
  - No backend, no network required for core functionality

## Planned / Ideas

- More capture rules (include/exclude pinned, domain filters, “keep active tab”, etc.)
- Bulk actions (multi-select sessions, delete/export in batch)
- Session grouping (by domain / window title)
- Optional sync support (`chrome.storage.sync`) with conflict handling

## Screenshots

- **Manager page (sessions list + session view)** — _placeholder_
- **Options page** — _placeholder_

## Installation / Development

### Prerequisites

- **Node.js LTS** (18+ recommended)
- npm (bundled with Node)

### Install dependencies

```bash
npm install
```

### Automatic version bumping (local git hook)

This repo uses a **local-only** Git hook (Husky) to automatically bump the SemVer version in `package.json` **on every commit**.

- **Default**: PATCH bump (e.g. `0.1.0` → `0.1.1`)
- **Commit message controls the bump**:
  - **MAJOR**: `BREAKING:` prefix, or Conventional Commits `!` marker (e.g. `feat!: ...`, `fix(scope)!: ...`)
  - **MINOR**: `feat: ...` (or `feat(scope): ...`)
  - **PATCH**: `fix: ...` (or `fix(scope): ...`)
  - **No prefix**: PATCH

Examples:

- `fix: handle empty sessions`
- `feat: add session search`
- `feat!: change storage schema`
- `BREAKING: drop legacy import format`

Disable (transparent + easy):

- **Per commit**: `BTM_VERSION_BUMP=0 git commit ...` (or `HUSKY=0 git commit ...`)
- **Per shell/session**: `export BTM_VERSION_BUMP=0`
- **Permanently**: remove the `"prepare": "husky"` script and/or uninstall `husky`, and delete `.husky/`

Implementation note:

- The hook runs on `post-commit`, bumps the version, then immediately does a single `git commit --amend --no-edit` so the commit you end up with contains the updated version files.

### Development (UI)

```bash
npm run dev
```

Note: Vite dev server runs outside the extension context, so `chrome.*` APIs are not available. The UI will show a friendly “Extension context required” message.

### Build the extension

```bash
npm run build
```

The build output goes to `dist/` (extension-ready).

### Icons

The extension includes a full PNG icon set in `public/icons/` (generated from `public/icons/icon.svg`) at these sizes:

- 16, 24, 32, 48, 64, 96, 128, 256, 512

To regenerate icons:

```bash
npm run icons
```

### Load unpacked in Chrome (step-by-step)

1. Build the project: `npm run build`
2. Open Chrome Extensions: `chrome://extensions`
3. Enable **Developer mode** (top-right)
4. Click **Load unpacked**
5. Select the project’s **`dist/`** folder
6. Pin the extension (optional): puzzle icon → pin **Browser Tabs Manager**

## Usage

### Send tabs to the manager (capture)

- Click the extension’s toolbar icon **or**
- Use the command shortcut (**Ctrl+Shift+Y**, macOS: **Cmd+Shift+Y**)

This creates a new session from tabs in the current window and closes the captured tabs.

### Restore tabs

In the Manager page:

- **Open tab** to restore a single item, or
- **Open all in new window** to restore a whole session

### Export / Import

- **Export session to JSON**: Manager → “Export JSON” (downloads a `.json` file)
- **Import JSON**: Manager sidebar → “Import JSON” (creates a new session)

### About restricted URLs

Some URLs cannot be accessed/managed by extensions (e.g. `chrome://` pages). These items are **skipped** during capture and tracked as `skippedCount` so you can see what was omitted.

## Project structure

```text
browser-tabs-manager/
  public/
    manifest.json
    icons/
  pages/
    manager/index.html
    options/index.html
  scripts/
    generate-icons.mjs
  src/
    background/
      service-worker.ts
    shared/
      chrome.ts
      id.ts
      storage.ts
      time.ts
      types.ts
      url.ts
    pages/
      manager/
        main.tsx
        managerApp.tsx
        manager.css
      options/
        main.tsx
        optionsApp.tsx
      ui/
        styles.css
        toast.tsx
  vite.config.ts
  tsconfig.json
```

## Tech stack

- **Chrome Extension**: Manifest V3 (service worker background)
- **Language**: TypeScript
- **UI**: React
- **Build**: Vite (multi-page output for extension pages)
- **Quality**: ESLint + Prettier
- **Styling**: plain CSS (no Tailwind)

## Privacy

Browser Tabs Manager is **local-only**:

- All sessions and settings are stored in **`chrome.storage.local`**
- No backend and no analytics/tracking built in
- No host permissions needed for basic URLs

## Troubleshooting

- **The background service worker “stops”**
  - In MV3, the service worker is **event-driven** and can be suspended when idle. This is normal.
  - After you click the action/command, it spins up to handle the event.
- **Permission errors (tabs/storage)**
  - Ensure `dist/manifest.json` includes `"permissions": ["tabs", "storage"]`.
  - Reload the extension in `chrome://extensions` after rebuilding.
- **You changed code but nothing updates**
  - Re-run `npm run build`, then click **Reload** on the extension in `chrome://extensions`.
  - Extension pages (Manager/Options) may need a refresh as well.

## Contributing

PRs and issues are welcome.

- Keep changes focused and typed
- Run `npm run lint` and `npm run build` before submitting
- Prefer small, composable utilities in `src/shared/`

## License

MIT — see the `LICENSE` file.

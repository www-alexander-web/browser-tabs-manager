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
    - Open one tab (foreground or background)
    - Restore Center: restore all/selected → current window or new window
    - Optional: restore into a new window as a tab group (if supported)
    - Delete session
    - Export session to JSON
    - Import JSON as a new session
  - Search/filter across **session title + item title/url**
  - Per-session selection UX:
    - Checkboxes per tab row
    - Select all filtered / none
    - “Show only selected” filter
    - Selection is preserved while searching
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

- Click the extension’s toolbar icon → the popup opens → click **“Send tabs to Manager”** **or**
- Use the command shortcut (**Ctrl+Shift+Y**, macOS: **Cmd+Shift+Y**)

This creates a new session from tabs in the current window and closes the captured tabs.

### Manual verification (popup)

- Build the project and load unpacked
- Click the toolbar icon → popup opens
- Click **Send tabs to Manager** → capture runs → Manager opens with a new session
- Use **Ctrl+Shift+Y** / **Cmd+Shift+Y** → capture runs without opening the popup
- Re-open the popup → “Last capture” shows updated stats

### Restore tabs

In the Manager page:

- **Restore…** menu:
  - Restore all → Current window (safe: does not close existing tabs)
  - Restore all → New window
  - Restore selected → Current window / New window
  - Optional: “New window (tab group)” (only shown when supported)
- **Selection helpers** (within a session):
  - Checkboxes per row
  - Select all filtered / Select none
  - Show only selected
- **Single tab**:
  - Open tab (foreground)
  - Open bg (background)

### Export / Import

- **Export session to JSON**: Manager → “Export JSON” (downloads a `.json` file)
- **Import JSON**: Manager sidebar → “Import JSON” (creates a new session)

### About restricted URLs

Some URLs cannot be accessed/managed by extensions (e.g. `chrome://` pages). These items are **skipped** during capture and tracked as `skippedCount` so you can see what was omitted.

## Manual verification matrix (capture/close)

Use this checklist to validate deterministic + safe behavior:

- **Current window only**
  - Open two Chrome windows with different tabs → trigger capture in one window → only that window’s tabs are saved/closed.
- **Pinned tabs**
  - With “Exclude pinned tabs” enabled → pinned tabs remain open and are not saved; banner shows `skippedPinnedCount`.
  - With it disabled → pinned tabs are saved and (if eligible) closed.
- **Active tab**
  - With “Keep active tab” enabled → active tab is saved but not closed; banner shows `skippedActiveCount = 1`.
  - With it disabled → active tab is saved and can be closed.
- **Restricted URLs**
  - Include tabs like `chrome://extensions`, `about:blank`, `chrome-extension://...` → they are not saved/closed; banner shows `skippedRestrictedCount`.
- **Mixed URLs + close failures**
  - Simulate failures by rapidly closing tabs during capture → session must still be saved; banner shows `failedToCloseCount` and the first few failed URLs.

## Manual verification checklist (restore)

- **Restore into current window**
  - Use “Restore all → Current window” → existing tabs in the window must remain open (no closing/replacing).
  - Tabs should open in the saved order.
- **Restore into new window**
  - Use “Restore all → New window” → a new window is created; tabs open in saved order.
- **Restore selection + search**
  - Search within a session, select a few, clear search → selection remains.
  - Use “Show only selected”.
  - Use “Select all filtered”.
- **Duplicates on/off**
  - Turn on/off “Skip duplicate URLs when restoring” in Options.
  - With it ON: restoring into a window that already contains a URL should skip opening that URL again.
- **Background restore**
  - Turn on “Open restored tabs in background by default” in Options.
  - Restored tabs should not steal focus.
- **Stress (100 tabs)**
  - Restore a large session (100+) and confirm the progress UI updates and the UI stays responsive.

## Project structure

```text
browser-tabs-manager/
  public/
    manifest.json
    icons/
  pages/
    manager/index.html
    options/index.html
    popup/index.html
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
      popup/
        main.tsx
        popupApp.tsx
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

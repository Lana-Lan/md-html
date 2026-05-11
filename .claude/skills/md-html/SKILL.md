---
name: md-html
description: Browse and edit all Markdown files in a directory from one browser page with sidebar navigation, live preview, and dual-save sync (.md + .html). All generated HTML files are organized in a md-html-manager subdirectory, and the manager page auto-opens in your browser after execution. Use when the user wants to manage, navigate, or edit multiple markdown files in a folder, mentions "markdown directory editor", "edit all md files", "md file browser", "markdown workspace manager", "browse and edit markdown", "md directory viewer with editing", "sync edit markdown folder", "md to html", "convert md to html".
---

# md-html: Markdown Directory Editor with Sync and Navigation

md-html renders all Markdown files in a directory into browser-editable HTML pages, then generates a manager page with sidebar navigation for browsing and editing all files. Support Mermaid render and zoom in/out.

Key design principle: **md produces, html consumes**. All generated HTML files are placed in a dedicated `md-html-manager/` subdirectory (under the user's specified directory), preserving the source directory's structure. The source `.md` files stay untouched in their original locations — only the `md-html-manager/` directory contains generated output. After execution, the manager page auto-opens in the browser.

## What to do

1. **Identify the input** — the user will provide either:
   - A path to a `.md` file → the skill uses that file's parent directory as the root and finds all `.md` files in the directory tree
   - A path to a directory → the skill scans for all `.md` files in the directory and its subdirectories

2. **Run the render script** — execute `scripts/render_md_html.js` with the input path and optional parameters:

   ```bash
   node scripts/render_md_html.js <input.md-or-directory> [--output <manager-path>] [--port <port>] [--initial <relative-path>] [--no-server]
   ```

   - `--output`: Output path for the manager HTML (default: `<directory>/md-html-manager/index.manager.html`)
   - `--port`: Specific port for the combined server (default: auto-select a free port)
   - `--initial`: Relative path to the HTML file to show first in the manager (default: first file found alphabetically, or the .html corresponding to the provided .md file)
   - `--no-server`: Skip the combined server — only generate the HTML files; editing uses the Download fallback

   **Important:** The script starts a background HTTP server that serves two purposes:
   - **Content serving**: loads HTML file content on demand when you click a file in the sidebar
   - **Dual-save sync**: when you press Ctrl+S in any editable HTML, the server writes to both `.md` and `.html` files

   Run the script in the background (`run_in_background`) so you can continue working, or tell the user to keep the terminal open.

   **Auto-open:** After the script finishes generating files and starting the server (if applicable), it automatically opens `md-html-manager/index.manager.html` in the default browser. You don't need to manually open any file.

3. **Tell the user** where the output files are and how to use them:
   - All generated HTML files are in the `md-html-manager/` subdirectory, organized by the same directory structure as the source .md files
   - The manager page is `md-html-manager/index.manager.html` — it auto-opens in the browser
   - The sidebar on the right shows all HTML files organized by subdirectory with expand/collapse
   - Click any file in the sidebar to view/edit it — the content loads in the main area
   - Syncable files (from .md) show a ✎ badge — they have full editing capability: split-view editor with live preview
   - Standalone files (pre-existing .html) show a ■ badge — they are viewable but not editable via sync
   - Press Ctrl+S or click "Save" to sync edits to both `.md` AND `.html` files (only works for syncable files)
   - The status bar shows "Sync ready (md + html)" when the server is connected
   - Use "Download" as a fallback if the sync server is unreachable
   - Search box at the top of the sidebar filters files by name/path
   - Keyboard navigation: Up/Down arrows move between files, Enter opens the selected file

## Output directory structure

All generated HTML files are placed in `<directory>/md-html-manager/`, mirroring the source directory structure:

```
source-dir/
├── subdir/
│   └── notes.md          (stays in original location)
├── README.md             (stays in original location)
└── md-html-manager/      (all generated output goes here)
    ├── subdir/
    │   └── notes.html    (generated from notes.md)
    ├── README.html       (generated from README.md)
    └── index.manager.html (the manager page)
```

Standalone pre-existing `.html` files in the source directory are not moved — they are served directly from their original locations through the server, and appear in the sidebar with a ■ badge.

## How it works

- **On launch**: The script scans for all `.md` files, generates an editable sync HTML for each one in `md-html-manager/`. It also scans for all pre-existing `.html` files. A single combined server starts on localhost. The browser auto-opens `md-html-manager/index.manager.html`.
- **In the browser**: The manager page loads the initial file on startup. The sidebar lists all HTML files — syncable ones (from .md) with a ✎ badge, standalone ones (pre-existing) with a ■ badge. Clicking sidebar items loads different files. Syncable files are editable HTML with their own editor and preview panels; standalone files are shown as-is.
- **On Ctrl+S / Save**: Only works for syncable files. The loaded HTML sends the editor content to the server with a file identifier. The server:
  1. Writes the content to the source `.md` file (in the original location)
  2. Regenerates the `.html` file in `md-html-manager/` with the updated content embedded
  3. Returns `{ ok: true, htmlUpdated: true }` — the save button shows "Synced!"
- **Result**: Both `.md` (original location) and `.html` (md-html-manager) files are always current. The manager page reflects the latest content because it loads from disk via the server.

## Why a bundled script

The HTML templates are substantial (~500 lines for the editable page, ~300 lines for the manager). The Node.js script handles directory scanning, HTML generation for each file, manager page generation, and the combined server lifecycle (content serving + dual-save sync). A bundled script guarantees consistent output and handles the server lifecycle without reconstructing templates from scratch each time.

## Features

**From md-live-edit-sync (each file's editing page):**
- Split-view editor with live preview
- View modes: Split, View (read-only), Edit (editor-only)
- Dual-save sync: Ctrl+S saves to both `.md` AND `.html`
- Download fallback when server is offline
- Tab key support, scroll sync, Ctrl+S shortcut
- Markdown rendering (markdown-it), code highlighting (highlight.js)
- Mermaid diagrams with click-to-zoom
- Dark/light mode, auto-generated TOC

**From html-dir-manager (the manager page):**
- Split view: content area + sidebar file list
- Directory tree sidebar with expand/collapse
- Click-to-switch navigation between ALL HTML files (syncable + standalone)
- File badges: ✎ for syncable (from .md), ■ for standalone (pre-existing)
- Search filter in sidebar
- Keyboard navigation (arrow keys + Enter)
- Current file highlight, breadcrumb navigation
- Dark/light mode, responsive layout
- File count and subdirectory badges

**Output organization:**
- All generated HTML files placed in `md-html-manager/` subdirectory
- Source `.md` files remain untouched in original locations
- Manager page auto-opens in browser after execution

## Input handling

- **Single .md file**: Uses the file's parent directory as root. Finds all `.md` files in that directory tree. Also finds all pre-existing `.html` files. The initial file in the manager is the `.html` corresponding to the provided `.md` file.
- **Directory**: Scans all `.md` files recursively. Generates HTML for each in `md-html-manager/`. Also scans all pre-existing `.html` files. The initial file is the first one found alphabetically, unless `--initial` is specified.
- **No .md files found**: If there are pre-existing `.html` files, the manager is still generated with only standalone (view-only) files. If there are neither `.md` nor `.html` files, the script reports an error and exits.
- **Manager output exclusion**: The `md-html-manager/` directory is automatically excluded from source scanning, preventing generated files from being treated as standalone input.
- **Re-running**: Running the script multiple times on the same directory regenerates all files in `md-html-manager/`. Previous output is overwritten. Source `.md` files are never modified unless you edit and save from the browser.

## Browser compatibility

- **All modern browsers**: Full functionality (Chrome, Edge, Firefox, Safari)
- **Server mode**: Content served on demand + dual-save sync — best for directories with many files
- **Static mode (--no-server)**: All HTML content embedded in the manager; editing uses Download fallback only (no sync)

## Troubleshooting

- "Server offline" in the status bar → the Node.js process has stopped; restart it
- Manager shows no files → check the directory contains `.md` files (case-insensitive `.md` extension)
- Content not loading in manager → check browser console for CORS errors; the server handles this
- Ctrl+S doesn't save → check the status shows "Sync ready (md + html)"; if not, the server may be offline
- HTML file not updating after save → check the Node.js process console for "HTML regeneration failed" errors
- Large directories (>50 files) → use server mode (default) for best performance
- Browser didn't auto-open → the script tries to open automatically, but may fail on some systems; manually open `<directory>/md-html-manager/index.manager.html`
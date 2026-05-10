---
name: md-html
description: Browse and edit all Markdown files in a directory from one browser page. Use when the user wants to manage, navigate, or edit multiple markdown files in a folder, mentions "markdown directory editor", "edit all md files", "md file browser", "markdown workspace manager", "browse and edit markdown", "md directory viewer with editing", "sync edit markdown folder".
---

# md-html: Markdown Directory Editor with Sync and Navigation

This skill combines the power of two workflows into one seamless experience:

1. **md-live-edit-sync** — renders each `.md` file into an editable, self-contained HTML with live preview and dual-save that syncs edits back to both `.md` and `.html` files on disk
2. **html-dir-manager** — generates a manager page with a sidebar listing ALL HTML files in a directory tree (both rendered from .md and pre-existing standalone ones), with click-to-switch navigation

The result: a single browser page where you can navigate between all your markdown documents and existing HTML pages using a sidebar, and edit any markdown-sourced document inline with live preview. Pre-existing HTML files are viewable but not editable through the sync mechanism. Press Ctrl+S to save edits — both the `.md` and `.html` files on disk stay current. No re-rendering, no file picker dialogs, no opening files one by one.

## What to do

1. **Identify the input** — the user will provide either:
   - A path to a `.md` file → the skill uses that file's parent directory as the root and finds all `.md` files in the directory tree
   - A path to a directory → the skill scans for all `.md` files in the directory and its subdirectories

2. **Run the render script** — execute `scripts/render_md_dir_sync.js` with the input path and optional parameters:

   ```bash
   node scripts/render_md_dir_sync.js <input.md-or-directory> [--output <manager-path>] [--port <port>] [--initial <relative-path>] [--no-server]
   ```

   - `--output`: Output path for the manager HTML (default: `<directory>/index-manager.html`)
   - `--port`: Specific port for the combined server (default: auto-select a free port)
   - `--initial`: Relative path to the HTML file to show first in the manager (default: first file found alphabetically, or the .html corresponding to the provided .md file)
   - `--no-server`: Skip the combined server — only generate the HTML files; editing uses the Download fallback

   **Important:** The script starts a background HTTP server that serves two purposes:
   - **Content serving**: loads HTML file content on demand when you click a file in the sidebar
   - **Dual-save sync**: when you press Ctrl+S in any editable HTML, the server writes to both `.md` and `.html` files

   Run the script in the background (`run_in_background`) so you can continue working, or tell the user to keep the terminal open.

3. **Tell the user** where the output files are and how to use them:
   - Open the manager HTML file in a browser (any modern browser works)
   - The sidebar on the right shows all HTML files organized by subdirectory with expand/collapse
   - Click any file in the sidebar to view/edit it — the content loads in the main area
   - Syncable files (from .md) show a ✎ badge — they have full editing capability: split-view editor with live preview
   - Standalone files (pre-existing .html) show a ■ badge — they are viewable but not editable via sync
   - Press Ctrl+S or click "Save" to sync edits to both `.md` AND `.html` files (only works for syncable files)
   - The status bar shows "Sync ready (md + html)" when the server is connected
   - Use "Download" as a fallback if the sync server is unreachable
   - Search box at the top of the sidebar filters files by name/path
   - Keyboard navigation: Up/Down arrows move between files, Enter opens the selected file

## How it works

- **On launch**: The script scans for all `.md` files, generates an editable sync HTML for each one. It also scans for all pre-existing `.html` files. A single combined server starts on localhost.
- **In the browser**: The manager page loads the initial file on startup. The sidebar lists all HTML files — syncable ones (from .md) with a ✎ badge, standalone ones (pre-existing) with a ■ badge. Clicking sidebar items loads different files. Syncable files are editable HTML with their own editor and preview panels; standalone files are shown as-is.
- **On Ctrl+S / Save**: Only works for syncable files. The loaded HTML sends the editor content to the server with a file identifier. The server:
  1. Writes the content to the source `.md` file
  2. Regenerates the `.html` file with the updated content embedded
  3. Returns `{ ok: true, htmlUpdated: true }` — the save button shows "Synced!"
- **Result**: Both files on disk are always current. The manager page reflects the latest content because it loads from disk via the server.

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

## Input handling

- **Single .md file**: Uses the file's parent directory as root. Finds all `.md` files in that directory tree. Also finds all pre-existing `.html` files. The initial file in the manager is the `.html` corresponding to the provided `.md` file.
- **Directory**: Scans all `.md` files recursively. Generates HTML for each. Also scans all pre-existing `.html` files. The initial file is the first one found alphabetically, unless `--initial` is specified.
- **No .md files found**: If there are pre-existing `.html` files, the manager is still generated with only standalone (view-only) files. If there are neither `.md` nor `.html` files, the script reports an error and exits.
- **Manager output exclusion**: The generated manager HTML file (e.g., `index-manager.html`) is automatically excluded from the sidebar listing.

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
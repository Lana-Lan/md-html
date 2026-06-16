---
name: md-html
description: Browse and edit all Markdown, HTML, and source code (.java/.py/.js) files in a directory from one browser page with sidebar navigation, live preview, and sync save. .md files get split-view editing with dual-save (.md + .html), plus View mode supports direct contenteditable HTML editing with sync save to both .md and .html. Standalone .html files get contenteditable visual editing and HTML source editing with direct save back to the original file. Source code files (.java/.py/.js) get split-view editing with syntax-highlighted preview and sync save to both original source file + .html. All generated HTML files are organized in a md-html-manager subdirectory, and the manager page auto-opens in your browser after execution. Use when the user wants to manage, navigate, or edit multiple markdown, HTML, or source code files in a folder, mentions "markdown directory editor", "edit all md files", "md file browser", "markdown workspace manager", "browse and edit markdown", "edit html files in browser", "html directory editor", "visual html editor", "contenteditable html", "html source editor", "sync edit markdown folder", "md to html", "convert md to html", "edit html and save", "edit rendered html", "direct html editing", "contenteditable preview", "edit html view", "edit java files in browser", "python code editor", "javascript editor browser", "source code browser", "code file manager", "browse and edit java", "edit python in browser", "view and edit js files", "code directory editor".
---

# md-html: Markdown, HTML & Source Code Directory Editor with Sync and Navigation

md-html renders all Markdown files in a directory into browser-editable HTML pages, wraps standalone .html files with a visual editor, and generates editable HTML pages for source code files (.java/.py/.js) with syntax-highlighted preview. A manager page with sidebar navigation lets you browse and edit all files. Support Mermaid render, zoom in/out, edge click interaction, and resizable table columns.

Key design principle: **md produces, html consumes**. All generated HTML files are placed in a dedicated `md-html-manager/` subdirectory (under the user's specified directory), preserving the source directory's structure. The source `.md` and source code files stay untouched in their original locations — only the `md-html-manager/` directory contains generated output. Standalone `.html` files get editing wrappers in `md-html-manager/_standalone/`. Source code files get editing pages in `md-html-manager/_code/`. After execution, the manager page auto-opens in the browser.

## What to do

1. **Identify the input** — the user will provide either:
   - A path to a `.md` file → the skill uses that file's parent directory as the root and finds all `.md` files in the directory tree
   - A path to a `.java`/`.py`/`.js` file → the skill uses that file's parent directory as the root
   - A path to a directory → the skill scans for all `.md` files, source code files (.java/.py/.js), and `.html` files in the directory and its subdirectories

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
   - All files show a ✎ badge — both .md-derived and standalone .html files are editable
   - .md-derived files have split-view editor with live markdown preview; View mode supports direct contenteditable editing; Ctrl+S syncs to both `.md` AND `.html`
   - Source code files (.java/.py/.js) have split-view editor with syntax-highlighted preview; View mode supports direct contenteditable code editing; Ctrl+S syncs to both original source file AND `.html`
   - Standalone .html files have View/Edit/Source modes; Ctrl+S saves directly to the original `.html` file
   - The status bar shows "Sync ready", "Sync ready (html)", or "Sync ready (src)" when the server is connected
   - Use "Download" as a fallback if the sync server is unreachable
   - Search box at the top of the sidebar filters files by name/path
   - Keyboard navigation: Up/Down arrows move between files, Enter opens the selected file

## Output directory structure

All generated HTML files are placed in `<directory>/md-html-manager/`, mirroring the source directory structure:

```
source-dir/
├── subdir/
│   └── notes.md          (stays in original location)
│   └── page.html         (stays in original location)
│   └── App.java          (stays in original location)
│   └── utils.py          (stays in original location)
├── README.md             (stays in original location)
├── test.html             (stays in original location)
├── index.js              (stays in original location)
└── md-html-manager/      (all generated output goes here)
    ├── subdir/
    │   └── notes.html    (generated from notes.md)
    ├── README.html       (generated from README.md)
    ├── _standalone/
    │   ├── subdir/
    │   │   └── page.html (editing wrapper for page.html)
    │   └── test.html     (editing wrapper for test.html)
    ├── _code/
    │   ├── subdir/
    │   │   ├── App.html  (generated from App.java)
    │   │   └── utils.html (generated from utils.py)
    │   └── index.html    (generated from index.js)
    └── index.manager.html (the manager page)
```

Standalone pre-existing `.html` files in the source directory are not moved — their original versions stay in place. Editing wrappers in `md-html-manager/_standalone/` load the original content via the server and save modifications back to the original file.

## How it works

- **On launch**: The script scans for all `.md` files, generates an editable sync HTML for each one in `md-html-manager/`. It scans for all source code files (.java/.py/.js) and generates editable HTML with syntax highlighting for each one in `md-html-manager/_code/`. It also scans for all pre-existing `.html` files and wraps each one with a standalone editing template in `md-html-manager/_standalone/`. A single combined server starts on localhost. The browser auto-opens `md-html-manager/index.manager.html`.
- **In the browser**: The manager page loads the initial file on startup. The sidebar lists all HTML files — all files show a ✎ badge (editable). Clicking sidebar items loads different files. .md-derived files are editable HTML with markdown editor and preview panels; View mode supports direct contenteditable editing of the rendered preview with dual-save to .md and .html; standalone .html files have a visual editor with View, Edit, and Source modes; source code files (.java/.py/.js) have a code editor with Split (editor + highlighted preview), View (contenteditable code block), and Edit (editor-only) modes.
- **On Ctrl+S / Save**: Works for all modes. For .md-derived files in View mode with direct edits: the edited HTML is converted back to markdown using TurndownService, then dual-saved to both `.md` and `.html`. For .md-derived files in Split/Edit mode: the markdown content is dual-saved to both `.md` and `.html`. For source code files in View mode with direct edits: the edited text is extracted from the code block, then dual-saved to both the original source file and `.html`. For source code files in Split/Edit mode: the source code content is dual-saved to both the original source file and `.html`. For standalone .html files: the modified HTML content is sent to the server which writes directly to the original `.html` file. All return `{ ok: true }` — the save button shows "Synced!"
- **Result**: For .md-derived files, both `.md` (original location) and `.html` (md-html-manager) are always current. For source code files, both the original source file and `.html` (md-html-manager/_code/) are always current. For standalone .html files, the original file is always current. The manager page reflects the latest content because it loads from disk via the server.

## Why a bundled script

The HTML templates are substantial (~500 lines for the editable page, ~300 lines for the manager). The Node.js script handles directory scanning, HTML generation for each file, manager page generation, and the combined server lifecycle (content serving + dual-save sync). A bundled script guarantees consistent output and handles the server lifecycle without reconstructing templates from scratch each time.

## Features

**From md-live-edit-sync (each file's editing page):**
- Split-view editor with live preview
- View modes: Split, View (contenteditable for direct HTML editing), Edit (editor-only)
- Dual-save sync: Ctrl+S saves to both `.md` AND `.html`
- View mode direct editing: click anywhere in the rendered preview to edit HTML directly; Ctrl+S converts the edited HTML back to markdown using TurndownService, then dual-saves to both `.md` and `.html`. Switching to Split/Edit mode after saving will show the converted markdown and re-rendered preview.
- Download fallback when server is offline
- Tab key support, scroll sync, Ctrl+S shortcut
- Markdown rendering (markdown-it), code highlighting (highlight.js)
- Mermaid diagrams with click-to-zoom
- Mermaid edge interaction: click a connection line in the zoomed overlay to highlight it and view source/target nodes and flow direction
- Resizable table columns: drag column borders in `<th>` to adjust width; double-click to reset to auto
- Dark/light mode, auto-generated TOC

**From html-dir-manager (the manager page):**
- Split view: content area + sidebar file list
- Directory tree sidebar with hierarchical expand/collapse — 20px indent per depth level with tree lines
- Expand All / Collapse All buttons in sidebar header for quick navigation
- Click-to-switch navigation between ALL HTML files (syncable + standalone)
- All files show ✎ badge (all are editable)
- Search filter in sidebar
- Keyboard navigation (arrow keys + Enter)
- Current file highlight, breadcrumb navigation
- Dark/light mode, responsive layout
- File count and subdirectory badges

**Standalone HTML editing (for pre-existing .html files):**
- View mode: read-only rendered preview via iframe
- Edit mode: contenteditable iframe — click anywhere to edit content directly
- Source mode: HTML source editor (textarea) + rendered preview (iframe)
- Ctrl+S saves directly to the original .html file via server sync
- Download fallback when server is offline
- Tab key support in source editor, live preview refresh
- Relative URL resolution via server asset endpoint
- Dark/light mode

**Source code editing (for .java/.py/.js files):**
- Split mode: source code editor (textarea) + syntax-highlighted preview using highlight.js
- View mode: contenteditable code block — click anywhere to edit code directly; Ctrl+S extracts textContent and saves
- Edit mode: editor-only (textarea)
- Dual-save sync: Ctrl+S saves to both original source file AND .html in md-html-manager/_code/
- Language badge in topbar showing detected language (Java/Python/JavaScript)
- Syntax highlighting with highlight.js, language-specific highlighting based on file extension
- Copy button on code preview block
- Download fallback when server is offline
- Tab key support, dark/light mode

**Output organization:**
- All generated HTML files placed in `md-html-manager/` subdirectory
- Source `.md` files remain untouched in original locations
- Source code files (.java/.py/.js) remain untouched in original locations, editing HTML placed in `md-html-manager/_code/`
- Manager page auto-opens in browser after execution

## Input handling

- **Single .md file**: Uses the file's parent directory as root. Finds all `.md` files in that directory tree. Also finds all source code files (.java/.py/.js) and pre-existing `.html` files. The initial file in the manager is the `.html` corresponding to the provided `.md` file.
- **Single source code file (.java/.py/.js)**: Uses the file's parent directory as root. Finds all `.md` files, source code files, and `.html` files. The initial file is the `.html` corresponding to the provided source code file.
- **Directory**: Scans all `.md` files recursively. Generates HTML for each in `md-html-manager/`. Also scans all source code files (.java/.py/.js) and generates HTML in `md-html-manager/_code/`. Also scans all pre-existing `.html` files. The initial file is the first one found alphabetically, unless `--initial` is specified.
- **No files found**: If there are neither `.md`, source code (.java/.py/.js), nor `.html` files, the script reports an error and exits.
- **Manager output exclusion**: The `md-html-manager/` directory is automatically excluded from source scanning, preventing generated files from being treated as standalone or source code input.
- **Re-running**: Running the script multiple times on the same directory regenerates all files in `md-html-manager/`. Previous output is overwritten. Source `.md` and source code files are never modified unless you edit and save from the browser.

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
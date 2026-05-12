# md-html

Markdown directory editor with sidebar navigation, live preview, and dual-save sync — browse and edit all your Markdown files from a single browser page.

## Overview

md-html is a skill that enables browser-based editing of Markdown files and management of all HTML files within a directory. Support Mermaid render and zoom in/out.

md-html combines two workflows into one seamless experience:

- **md editable on html page** — renders each `.md` file into an editable, self-contained HTML with split-view editor and live preview. Press Ctrl+S to save edits back to both `.md` and `.html` files on disk simultaneously.
- **Directory manager** — generates a single page with a sidebar listing all HTML files (both rendered from `.md` and pre-existing standalone `.html`), with click-to-switch navigation.

The result: one browser page where you navigate between all your markdown documents using a sidebar, edit any markdown-sourced document inline with live preview, and keep both `.md` and `.html` files in sync — no file picker dialogs, no opening files one by one.

## Features

**From md-live-edit-sync (each file's editing page):**
- Split-view editor with live preview
- View modes: Split, View (read-only), Edit (editor-only)
- Dual-save sync: Ctrl+S saves to both `.md` AND `.html`
- Download fallback when server is offline
- Tab key support, scroll sync, Ctrl+S shortcut
- Markdown rendering (markdown-it), code highlighting (highlight.js)
- Mermaid diagrams with click-to-zoom
- Mermaid edge interaction: click a connection line in the zoomed overlay to highlight it and view source/target nodes and flow direction
- Resizable table columns: drag column borders in `<th>` to adjust width; double-click to reset to auto
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

## Installation

### Requirements

- **Node.js** 12+ (no external dependencies — uses only built-in modules)

### Install

Clone the repository and copy it to your skill directory to use:

```bash
git clone https://github.com/Lana-Lan/md-html.git
```

## License

See [LICENSE](LICENSE) for details.
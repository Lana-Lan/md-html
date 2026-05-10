# md-html

Markdown directory editor with sidebar navigation, live preview, and dual-save sync — browse and edit all your Markdown files from a single browser page.

## Overview

md-html combines two workflows into one seamless experience:

- **Live edit & sync** — renders each `.md` file into an editable, self-contained HTML with split-view editor and live preview. Press Ctrl+S to save edits back to both `.md` and `.html` files on disk simultaneously.
- **Directory manager** — generates a single page with a sidebar listing all HTML files (both rendered from `.md` and pre-existing standalone `.html`), with click-to-switch navigation.

The result: one browser page where you navigate between all your markdown documents using a sidebar, edit any markdown-sourced document inline with live preview, and keep both `.md` and `.html` files in sync — no file picker dialogs, no opening files one by one.

## Features

**Editing (per file):**

- Split-view editor with live Markdown preview
- View modes: Split / View (read-only) / Edit (editor-only)
- Dual-save sync: Ctrl+S writes to both `.md` AND `.html`
- Download fallback when the sync server is offline
- Markdown rendering (markdown-it), code highlighting (highlight.js)
- Mermaid diagrams with click-to-zoom
- Dark/light mode, auto-generated TOC
- Tab key support, scroll sync

**Navigation (manager page):**

- Sidebar with directory tree, expand/collapse subdirectories
- Click-to-switch between all HTML files
- Badges: ✎ for syncable (from `.md`), ■ for standalone (pre-existing `.html`)
- Search filter in sidebar
- Keyboard navigation (arrow keys + Enter)
- Current file highlight, breadcrumb navigation
- Dark/light mode, responsive layout, file count and subdirectory badges

## Installation

### Requirements

- **Node.js** 12+ (no external dependencies — uses only built-in modules)

### Install

Clone the repository and you're ready to use it:

```bash
git clone https://github.com/Lana-Lan/md-html.git
```

## License

See [LICENSE](LICENSE) for details.
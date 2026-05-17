const { escapeForJs } = require('./utils');

const EDIT_CSS = `
:root {
  --bg: #ffffff;
  --text: #1a1a1a;
  --heading: #111111;
  --link: #0366d6;
  --code-bg: #f6f8fa;
  --border: #e1e4e8;
  --toc-bg: #f8f9fa;
  --quote-border: #dfe2e5;
  --table-border: #c6c8cb;
  --overlay-bg: rgba(255,255,255,0.97);
  --muted: #6a737d;
  --success: #28a745;
}

[data-theme="dark"] {
  --bg: #0d1117;
  --text: #c9d1d9;
  --heading: #f0f6fc;
  --link: #58a6ff;
  --code-bg: #161b22;
  --border: #30363d;
  --toc-bg: #161b22;
  --quote-border: #3b434b;
  --table-border: #3b434b;
  --overlay-bg: rgba(13,17,23,0.97);
  --muted: #8b949e;
  --success: #3fb950;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: var(--text);
  background: var(--bg);
  height: 100vh;
  overflow: hidden;
}

.topbar {
  position: sticky;
  top: 0;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  padding: 8px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 100;
  height: 44px;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.topbar-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--muted);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.save-status {
  font-size: 11px;
  color: var(--muted);
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--code-bg);
  white-space: nowrap;
}

.save-status.connected {
  color: var(--success);
  background: rgba(40, 167, 69, 0.1);
  font-weight: 500;
}

.topbar-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: nowrap;
}

.mode-group {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.mode-btn {
  background: none;
  border: none;
  border-right: 1px solid var(--border);
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  color: var(--text);
  transition: background 0.15s;
  white-space: nowrap;
}

.mode-btn:last-child { border-right: none; }
.mode-btn.active-mode { background: var(--link); color: #fff; }
.mode-btn:hover:not(.active-mode) { background: var(--code-bg); }

.topbar-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  color: var(--text);
  transition: background 0.15s;
  white-space: nowrap;
}
.topbar-btn:hover { background: var(--code-bg); }
.topbar-btn.save-ready { border-color: var(--success); color: var(--success); }

.toc-sidebar {
  position: fixed;
  left: 0;
  top: 44px;
  width: 260px;
  height: calc(100vh - 44px);
  background: var(--toc-bg);
  border-right: 1px solid var(--border);
  padding: 20px 16px;
  overflow-y: auto;
  font-size: 13px;
  display: none;
  z-index: 90;
}
.toc-sidebar.open { display: block; }

.toc-link {
  display: block;
  padding: 3px 0;
  color: var(--muted);
  text-decoration: none;
  transition: color 0.15s;
  line-height: 1.4;
}
.toc-link:hover { color: var(--link); }
.toc-h2 { padding-left: 0; font-weight: 500; }
.toc-h3 { padding-left: 16px; }
.toc-h4 { padding-left: 32px; }

.main-content {
  height: calc(100vh - 44px);
  transition: margin-left 0.2s;
}
.main-content.with-toc { margin-left: 260px; }

.split-container {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.editor-pane {
  width: 50%;
  display: flex;
  flex-direction: column;
  border-right: 2px solid var(--border);
  overflow: hidden;
  transition: width 0.15s;
}

.preview-pane {
  width: 50%;
  overflow-y: auto;
  padding: 40px 24px;
  transition: width 0.15s;
}

.editor-pane textarea {
  width: 100%;
  height: 100%;
  resize: none;
  border: none;
  padding: 20px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text);
  background: var(--bg);
  outline: none;
  tab-size: 4;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-y: auto;
}

.md-body h1, .md-body h2, .md-body h3, .md-body h4, .md-body h5, .md-body h6 {
  color: var(--heading);
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}
.md-body h1 { font-size: 2em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
.md-body h2 { font-size: 1.5em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
.md-body h3 { font-size: 1.25em; }
.md-body h4 { font-size: 1em; }
.md-body p { margin-bottom: 16px; }
.md-body a { color: var(--link); text-decoration: none; }
.md-body a:hover { text-decoration: underline; }
.md-body strong { font-weight: 600; }

.md-body ul, .md-body ol {
  margin-bottom: 16px;
  padding-left: 2em;
}
.md-body li { margin-bottom: 4px; }
.md-body li.task-list-item { list-style: none; margin-left: -1.5em; }

.md-body blockquote {
  padding: 0 1em;
  margin-bottom: 16px;
  color: var(--muted);
  border-left: 4px solid var(--quote-border);
}

.md-body code {
  padding: 0.2em 0.4em;
  margin: 0;
  font-size: 85%;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  background: var(--code-bg);
  border-radius: 3px;
}

.md-body pre {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background: var(--code-bg);
  border-radius: 6px;
  margin-bottom: 16px;
  position: relative;
}
.md-body pre code {
  padding: 0;
  margin: 0;
  font-size: 100%;
  background: none;
  border-radius: 0;
}

.copy-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
  color: var(--muted);
  opacity: 0;
  transition: opacity 0.2s;
}
.md-body pre:hover .copy-btn { opacity: 1; }
.copy-btn:hover { background: var(--border); }

.md-body table {
  border-collapse: collapse;
  margin-bottom: 16px;
  width: 100%;
}
.md-body table th, .md-body table td {
  padding: 6px 13px;
  border: 1px solid var(--table-border);
  overflow: hidden;
}
.md-body table th {
  font-weight: 600;
  background: var(--toc-bg);
  position: relative;
  user-select: none;
}
.md-body table th .col-resize-handle {
  position: absolute;
  top: 0;
  right: -2px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 1;
  background: transparent;
  transition: background 0.15s;
}
.md-body table th .col-resize-handle:hover,
.md-body table th .col-resize-handle.resizing {
  background: var(--link);
  opacity: 0.5;
}
.md-body table tr:nth-child(even) { background: var(--toc-bg); }

.md-body img { max-width: 100%; border-radius: 4px; }
.md-body hr { height: 2px; padding: 0; margin: 24px 0; background: var(--border); border: 0; }

/* View mode: contenteditable preview */
.preview-pane.view-editable { cursor: text; }
.preview-pane.view-editable .md-body {
  outline: 1px dashed var(--border);
  outline-offset: 4px;
  min-height: 100%;
}
.preview-pane.view-editable .md-body:focus-within {
  outline: 2px solid var(--link);
  outline-offset: 4px;
}

.mermaid-wrapper {
  text-align: center;
  margin: 16px 0;
  cursor: pointer;
  position: relative;
}
.mermaid-wrapper .zoom-hint {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 11px;
  color: var(--muted);
  background: var(--bg);
  padding: 2px 6px;
  border-radius: 3px;
  opacity: 0;
  transition: opacity 0.2s;
}
.mermaid-wrapper:hover .zoom-hint { opacity: 1; }
.mermaid-wrapper svg { max-width: 100%; }

.mermaid-error {
  color: #d73a49;
  font-family: monospace;
  font-size: 13px;
  padding: 8px 12px;
  background: var(--code-bg);
  border-radius: 4px;
  border: 1px solid var(--border);
  white-space: pre-wrap;
}

.svg-overlay {
  display: none;
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: var(--overlay-bg);
  z-index: 200;
  cursor: grab;
  overflow: hidden;
}
.svg-overlay.active { display: flex; align-items: center; justify-content: center; }

.svg-overlay .overlay-close {
  position: absolute;
  top: 16px; right: 16px;
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text);
  opacity: 0.5;
  z-index: 210;
}
.svg-overlay .overlay-close:hover { opacity: 1; }

.svg-overlay .overlay-controls {
  position: absolute;
  bottom: 16px; right: 16px;
  display: flex; gap: 8px;
  z-index: 210;
}
.svg-overlay .overlay-btn {
  background: var(--toc-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  color: var(--text);
}
.svg-overlay .overlay-btn:hover { background: var(--border); }

.svg-overlay .svg-container {
  transform-origin: center center;
  transition: none;
  max-width: 90vw;
  max-height: 90vh;
}

.svg-overlay .zoom-level {
  position: absolute;
  bottom: 16px; left: 16px;
  font-size: 12px;
  color: var(--muted);
  z-index: 210;
}

/* Edge interaction in overlay */
.svg-overlay svg path[marker-end],
.svg-overlay svg line[marker-end] {
  pointer-events: all;
  cursor: pointer;
  transition: stroke-width 0.15s, filter 0.15s;
}
.svg-overlay svg path[marker-end]:hover,
.svg-overlay svg line[marker-end]:hover {
  stroke-width: 3px;
  filter: drop-shadow(0 0 2px rgba(3, 102, 214, 0.4));
}

path.mermaid-edge-selected,
line.mermaid-edge-selected,
.mermaid-edge-selected > path,
.mermaid-edge-selected > line {
  stroke: #ff9800 !important;
  stroke-width: 4px !important;
  filter: drop-shadow(0 0 6px rgba(255, 152, 0, 0.6)) !important;
}

.edge-info-panel {
  position: absolute;
  bottom: 50px;
  left: 16px;
  background: var(--toc-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 13px;
  color: var(--text);
  z-index: 210;
  display: none;
  max-width: 400px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.edge-info-panel.visible { display: block; }
.edge-info-panel .edge-info-header { font-weight: 600; margin-bottom: 8px; color: var(--heading); }
.edge-info-panel .edge-info-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.edge-info-panel .edge-info-label { color: var(--muted); min-width: 50px; }
.edge-info-panel .edge-info-value { color: var(--text); font-weight: 500; }
.edge-info-panel .edge-info-close {
  position: absolute;
  top: 6px;
  right: 10px;
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: var(--muted);
  opacity: 0.6;
  line-height: 1;
}
.edge-info-panel .edge-info-close:hover { opacity: 1; }

@media print {
  .topbar, .toc-sidebar, .copy-btn, .zoom-hint, .svg-overlay,
  .editor-pane, .mode-group, .save-status { display: none !important; }
  .preview-pane { width: 100% !important; padding: 0 !important; }
  .main-content { margin-left: 0 !important; height: auto !important; }
  body { height: auto; overflow: visible; }
  .split-container { display: block !important; }
}

@media (max-width: 768px) {
  .toc-sidebar { width: 200px; }
  .main-content.with-toc { margin-left: 0; }
  .topbar-actions { flex-wrap: wrap; gap: 4px; }
  .topbar-left { max-width: 120px; }
  .split-container { flex-direction: column; }
  .editor-pane { width: 100% !important; height: 50%; border-right: none; border-bottom: 2px solid var(--border); }
  .preview-pane { width: 100% !important; height: 50%; }
}
`;

const EDIT_JS = `
(function() {
  var rawMarkdown = __MD_CONTENT_PLACEHOLDER__;
  var sourceFileName = __SOURCE_FILE_NAME_PLACEHOLDER__;
  var sourceRelPath = __SOURCE_REL_PATH_PLACEHOLDER__;
  var savePort = __SAVE_PORT_PLACEHOLDER__;

  var currentTheme = 'light';
  var currentMode = 'view';
  var serverConnected = false;
  var syncScrollLock = null;
  var mdi = null;
  var mermaidReady = false;
  var mermaidTheme = 'default';
  var isHtmlDirty = false;
  var mermaidSources = {};

  var editor = document.getElementById('editor');
  var previewBody = document.getElementById('preview-body');
  var previewPane = document.getElementById('preview-pane');
  var editorPane = document.getElementById('editor-pane');

  editor.value = rawMarkdown;

  // Check server connection on load
  checkServerConnection();

  function checkServerConnection() {
    fetch('http://localhost:' + savePort + '/ping')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.ok) {
          serverConnected = true;
          var statusEl = document.getElementById('save-status');
          statusEl.textContent = 'Sync ready';
          statusEl.className = 'save-status connected';
          var saveBtn = document.getElementById('save-btn');
          saveBtn.classList.add('save-ready');
        }
      })
      .catch(function() {
        var statusEl = document.getElementById('save-status');
        statusEl.textContent = 'Server offline - use Download';
      });
  }

  // Tab key inserts tab character
  editor.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      var start = editor.selectionStart;
      var end = editor.selectionEnd;
      editor.value = editor.value.substring(0, start) + '\\t' + editor.value.substring(end);
      editor.selectionStart = editor.selectionEnd = start + 1;
      if (mdi) triggerRender();
    }
  });

  // Ctrl+S save shortcut
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveToFile();
    }
  });

  // Theme toggle
  var themeBtn = document.getElementById('theme-toggle');
  var hljsLight = document.getElementById('hljs-light-theme');
  var hljsDark = document.getElementById('hljs-dark-theme');

  themeBtn.addEventListener('click', function() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', currentTheme);
    themeBtn.textContent = currentTheme === 'light' ? 'Dark' : 'Light';
    hljsLight.disabled = currentTheme === 'dark';
    hljsDark.disabled = currentTheme !== 'dark';
    if (mermaidReady) updateMermaidTheme();
  });

  // TOC toggle
  var tocSidebar = document.getElementById('toc-sidebar');
  var tocToggle = document.getElementById('toc-toggle');
  var mainContent = document.getElementById('main-content');

  tocToggle.addEventListener('click', function() {
    tocSidebar.classList.toggle('open');
    mainContent.classList.toggle('with-toc');
  });

  // Mode toggle
  var modeButtons = document.querySelectorAll('.mode-btn');
  modeButtons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      setMode(btn.dataset.mode);
    });
  });

  function setMode(mode) {
    // Warn about unsaved HTML edits when leaving View mode
    if (currentMode === 'view' && mode !== 'view' && isHtmlDirty) {
      if (!confirm('You have unsaved direct edits in View mode. Switching mode will re-render from markdown and lose them. Continue?')) {
        return;
      }
    }

    // Disable contentEditable when leaving View mode (if dirty, re-render from md)
    if (currentMode === 'view' && mode !== 'view') {
      previewBody.contentEditable = 'false';
      previewPane.classList.remove('view-editable');
      isHtmlDirty = false;
      if (mdi && mode !== 'view') renderPreview();
    }

    currentMode = mode;
    modeButtons.forEach(function(b) {
      b.classList.toggle('active-mode', b.dataset.mode === mode);
    });

    if (mode === 'split') {
      editorPane.style.display = 'flex';
      editorPane.style.width = '50%';
      previewPane.style.display = 'block';
      previewPane.style.width = '50%';
    } else if (mode === 'view') {
      editorPane.style.display = 'none';
      previewPane.style.display = 'block';
      previewPane.style.width = '100%';
      // View mode: contenteditable for direct HTML editing
      previewBody.contentEditable = 'true';
      previewPane.classList.add('view-editable');
      isHtmlDirty = false;
    } else if (mode === 'edit') {
      editorPane.style.display = 'flex';
      editorPane.style.width = '100%';
      previewPane.style.display = 'none';
    }
  }

  // Track direct edits in View mode
  previewBody.addEventListener('input', function() {
    if (currentMode === 'view') {
      isHtmlDirty = true;
    }
  });

  // Scroll sync
  editor.addEventListener('scroll', function() {
    if (syncScrollLock) return;
    syncScrollLock = 'editor';
    var ratio = editor.scrollTop / (editor.scrollHeight - editor.clientHeight || 1);
    previewPane.scrollTop = ratio * (previewPane.scrollHeight - previewPane.clientHeight || 1);
    setTimeout(function() { syncScrollLock = null; }, 50);
  });

  previewPane.addEventListener('scroll', function() {
    if (syncScrollLock) return;
    syncScrollLock = 'preview';
    var ratio = previewPane.scrollTop / (previewPane.scrollHeight - previewPane.clientHeight || 1);
    editor.scrollTop = ratio * (editor.scrollHeight - editor.clientHeight || 1);
    setTimeout(function() { syncScrollLock = null; }, 50);
  });

  // File operations — save via local server (syncs both md AND html)
  var saveBtn = document.getElementById('save-btn');
  var downloadBtn = document.getElementById('download-btn');

  saveBtn.addEventListener('click', saveToFile);
  downloadBtn.addEventListener('click', downloadFile);

  function saveToFile() {
    // In View mode with direct HTML edits: convert HTML→md then dual-save via /save
    if (currentMode === 'view' && isHtmlDirty) {
      var newMd = htmlToMd();
      editor.value = newMd;
      isHtmlDirty = false;
      // Re-render preview from the converted md so it stays consistent
      if (mdi) {
        rawMarkdown = newMd;
        renderPreview();
      }
    }

    // Dual-save (works for all modes now)
    if (serverConnected) {
      fetch('http://localhost:' + savePort + '/save?file=' + encodeURIComponent(sourceRelPath), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editor.value })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.ok) {
          if (data.htmlUpdated) {
            saveBtn.textContent = 'Synced!';
          } else {
            saveBtn.textContent = 'Saved!';
          }
          setTimeout(function() { saveBtn.textContent = 'Save'; }, 2000);
        } else {
          alert('Save failed: ' + (data.error || 'unknown error'));
        }
      })
      .catch(function(e) {
        alert('Save failed: server unreachable. Use Download instead.');
      });
    } else {
      downloadFile();
    }
  }

  // Convert edited preview HTML back to markdown using TurndownService
  function htmlToMd() {
    if (typeof TurndownService === 'undefined') return editor.value;

    // Clone preview to clean it without affecting the actual display
    var clone = previewBody.cloneNode(true);

    // Remove injected elements
    clone.querySelectorAll('.copy-btn').forEach(function(el) { el.remove(); });
    clone.querySelectorAll('.zoom-hint').forEach(function(el) { el.remove(); });
    clone.querySelectorAll('.col-resize-handle').forEach(function(el) { el.remove(); });
    clone.querySelectorAll('[data-resize-ready]').forEach(function(el) { el.removeAttribute('data-resize-ready'); });

    // Restore mermaid source: replace .mermaid-wrapper with <pre><code class="language-mermaid">
    clone.querySelectorAll('.mermaid-wrapper').forEach(function(wrapper) {
      var key = wrapper.dataset.mermaidKey;
      var source = mermaidSources[key] || '';
      var pre = document.createElement('pre');
      var code = document.createElement('code');
      code.className = 'language-mermaid';
      code.textContent = source;
      pre.appendChild(code);
      wrapper.parentNode.replaceChild(pre, wrapper);
    });

    // Remove auto-generated heading IDs
    clone.querySelectorAll('[id^="heading-"]').forEach(function(el) {
      if (el.id.match(/^heading-[a-z0-9]+$/)) el.removeAttribute('id');
    });

    var turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-'
    });

    // Build regex for newline replacement using RegExp constructor
    var newlineRegex = new RegExp(String.fromCharCode(10), 'g');

    // Build backtick fence using char codes
    var fence = String.fromCharCode(96) + String.fromCharCode(96) + String.fromCharCode(96);

    // Preserve <code> with language classes as fenced code blocks
    turndown.addRule('fencedCodeBlock', {
      filter: function(node) {
        return node.nodeName === 'PRE' && node.querySelector('code');
      },
      replacement: function(content, node) {
        var code = node.querySelector('code');
        var lang = (code.className || '').match(/language-(\\S+)/);
        var langPrefix = lang ? lang[1] : '';
        var codeText = code.textContent;
        return '\\n\\n' + fence + langPrefix + '\\n' + codeText + '\\n' + fence + '\\n\\n';
      }
    });

    // Preserve HTML tables as markdown tables
    turndown.addRule('markdownTable', {
      filter: function(node) {
        return node.nodeName === 'TABLE';
      },
      replacement: function(content, node) {
        var thead = node.querySelector('thead');
        var tbody = node.querySelector('tbody');
        // Collect header cells — use turndown on innerHTML to preserve links etc
        var headerCells = [];
        if (thead) {
          var ths = thead.querySelectorAll('tr:first-child th');
          if (ths.length === 0) ths = thead.querySelectorAll('th');
          ths.forEach(function(th) {
            headerCells.push(turndown.turndown(th.innerHTML).replace(newlineRegex, ' ').trim());
          });
        }
        // Collect body rows
        var bodyRows = [];
        var trs = tbody ? tbody.querySelectorAll('tr') : node.querySelectorAll('tr');
        trs.forEach(function(tr) {
          // Skip header rows that are direct children (no thead wrapper)
          if (!thead && tr.querySelector('th') && !tr.querySelector('td')) {
            if (headerCells.length === 0) {
              tr.querySelectorAll('th').forEach(function(th) {
                headerCells.push(turndown.turndown(th.innerHTML).replace(newlineRegex, ' ').trim());
              });
            }
            return;
          }
          var cells = [];
          var tds = tr.querySelectorAll('td');
          tds.forEach(function(td) {
            cells.push(turndown.turndown(td.innerHTML).replace(newlineRegex, ' ').trim());
          });
          if (cells.length > 0) bodyRows.push(cells);
        });
        // Build markdown table
        if (headerCells.length === 0) return content;
        var colCount = headerCells.length;
        var lines = [];
        lines.push('| ' + headerCells.join(' | ') + ' |');
        lines.push('| ' + headerCells.map(function() { return '---'; }).join(' | ') + ' |');
        bodyRows.forEach(function(row) {
          while (row.length < colCount) row.push('');
          lines.push('| ' + row.join(' | ') + ' |');
        });
        return '\\n\\n' + lines.join('\\n') + '\\n\\n';
      }
    });

    return turndown.turndown(clone.innerHTML);
  }

  function downloadFile() {
    var blob = new Blob([editor.value], { type: 'text/markdown' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = sourceFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Render functions
  var renderTimeout;
  function triggerRender() {
    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(renderPreview, 200);
  }

  function renderPreview() {
    if (!mdi) return;
    rawMarkdown = editor.value;
    previewBody.innerHTML = mdi.render(rawMarkdown);
    addCopyButtons();
    processMermaid();
    buildTOC();
    processTableResize();
  }

  function addCopyButtons() {
    var preBlocks = previewBody.querySelectorAll('pre');
    preBlocks.forEach(function(pre) {
      var code = pre.querySelector('code');
      if (code && (code.classList.contains('language-mermaid') || code.classList.contains('language-Mermaid'))) return;
      var btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.textContent = 'Copy';
      btn.addEventListener('click', function() {
        var text = code ? code.textContent : pre.textContent;
        navigator.clipboard.writeText(text).then(function() {
          btn.textContent = 'Copied!';
          setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
        });
      });
      pre.style.position = 'relative';
      pre.appendChild(btn);
    });
  }

  function processMermaid() {
    if (!mermaidReady) return;
    mermaidSources = {};
    var blocks = previewBody.querySelectorAll('pre code.language-mermaid, pre code.language-Mermaid');
    blocks.forEach(function(block, idx) {
      var source = block.textContent;
      mermaidSources['mermaid-' + idx] = source.trim();
      var wrapper = document.createElement('div');
      wrapper.className = 'mermaid-wrapper';
      wrapper.dataset.mermaidKey = 'mermaid-' + idx;
      var hint = document.createElement('span');
      hint.className = 'zoom-hint';
      hint.textContent = 'Click to zoom';
      var mermaidDiv = document.createElement('div');
      mermaidDiv.className = 'mermaid';
      mermaidDiv.textContent = source.trim();
      var pre = block.parentElement;
      pre.parentElement.insertBefore(wrapper, pre);
      pre.remove();
      wrapper.appendChild(hint);
      wrapper.appendChild(mermaidDiv);
      wrapper.addEventListener('click', function(e) {
        if (e.target === hint) return;
        setTimeout(function() {
          var svg = mermaidDiv.querySelector('svg');
          if (svg) showOverlay(svg.outerHTML);
        }, 500);
      });
    });
    setTimeout(function() { mermaid.run({ querySelector: '.mermaid' }); }, 100);
  }

  function buildTOC() {
    var headings = previewBody.querySelectorAll('h1, h2, h3, h4');
    var html = '';
    headings.forEach(function(h) {
      var level = h.tagName.toLowerCase();
      var text = h.textContent;
      if (!h.id) h.id = 'heading-' + Math.random().toString(36).substr(2, 6);
      html += '<a class="toc-link toc-' + level + '" href="#' + h.id + '">' + text + '</a>';
    });
    tocSidebar.innerHTML = html;
  }

  function updateMermaidTheme() {
    mermaidTheme = currentTheme === 'dark' ? 'dark' : 'default';
    mermaid.initialize({ theme: mermaidTheme });
    renderPreview();
  }

  // SVG Zoom overlay
  var overlay = document.getElementById('svg-overlay');
  var svgContainer = document.getElementById('svg-container');
  var zoomLevelEl = document.getElementById('zoom-level');
  var currentZoom = 1;
  var panX = 0, panY = 0;
  var isDragging = false;
  var dragStartX, dragStartY, panStartX, panStartY;

  function showOverlay(svgSource) {
    svgContainer.innerHTML = svgSource;
    currentZoom = 1; panX = 0; panY = 0;
    updateTransform();
    overlay.classList.add('active');
    var svg = svgContainer.querySelector('svg');
    if (svg) {
      if (!svg.getAttribute('viewBox')) {
        var w = parseFloat(svg.getAttribute('width')) || svg.clientWidth || 800;
        var h = parseFloat(svg.getAttribute('height')) || svg.clientHeight || 600;
        svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      }
      svg.style.width = '100%';
      svg.style.height = '100%';
      svg.style.maxWidth = '90vw';
      svg.style.maxHeight = '90vh';
    }
    clearEdgeSelection();
    setupEdgeInteraction();
  }

  function hideOverlay() {
    overlay.classList.remove('active');
    clearEdgeSelection();
  }

  function updateTransform() {
    svgContainer.style.transform = 'scale(' + currentZoom + ') translate(' + panX + 'px, ' + panY + 'px)';
    zoomLevelEl.textContent = Math.round(currentZoom * 100) + '%';
  }

  document.getElementById('overlay-close').addEventListener('click', hideOverlay);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) hideOverlay(); });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && overlay.classList.contains('active')) hideOverlay();
  });

  document.getElementById('zoom-in').addEventListener('click', function() {
    currentZoom = Math.min(currentZoom * 1.25, 10);
    updateTransform();
  });
  document.getElementById('zoom-out').addEventListener('click', function() {
    currentZoom = Math.max(currentZoom / 1.25, 0.1);
    updateTransform();
  });
  document.getElementById('zoom-reset').addEventListener('click', function() {
    currentZoom = 1; panX = 0; panY = 0;
    updateTransform();
  });

  overlay.addEventListener('wheel', function(e) {
    if (!overlay.classList.contains('active')) return;
    e.preventDefault();
    var delta = e.deltaY > 0 ? 0.85 : 1.18;
    currentZoom = Math.max(0.1, Math.min(10, currentZoom * delta));
    updateTransform();
  });

  svgContainer.addEventListener('mousedown', function(e) {
    if (overlay.classList.contains('active')) {
      isDragging = true;
      dragStartX = e.clientX; dragStartY = e.clientY;
      panStartX = panX; panStartY = panY;
      overlay.style.cursor = 'grabbing';
    }
  });
  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    panX = panStartX + (e.clientX - dragStartX) / currentZoom;
    panY = panStartY + (e.clientY - dragStartY) / currentZoom;
    updateTransform();
  });
  document.addEventListener('mouseup', function() {
    isDragging = false;
    overlay.style.cursor = 'grab';
  });

  // --- Mermaid edge click interaction ---
  var selectedEdge = null;

  function setupEdgeInteraction() {
    var svg = svgContainer.querySelector('svg');
    if (!svg) return;

    var edgeCandidates = [];

    // Find paths/lines with directional markers (arrows)
    svg.querySelectorAll('path[marker-end]').forEach(function(p) {
      var isInNode = false;
      var parent = p.parentElement;
      while (parent && parent !== svg) {
        var cls = parent.getAttribute('class') || '';
        if (cls.indexOf('node') !== -1 && cls.indexOf('edge') === -1) {
          isInNode = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (!isInNode) edgeCandidates.push(p);
    });

    svg.querySelectorAll('line[marker-end]').forEach(function(l) {
      edgeCandidates.push(l);
    });

    // Find paths inside edge groups
    svg.querySelectorAll('g').forEach(function(g) {
      var cls = g.getAttribute('class') || '';
      if (cls.indexOf('edgePath') !== -1 || (cls.indexOf('edge') !== -1 && cls.indexOf('edges') === -1 && cls.indexOf('node') === -1)) {
        g.querySelectorAll('path').forEach(function(p) {
          if (!edgeCandidates.includes(p) && !p.getAttribute('marker-start')) edgeCandidates.push(p);
        });
      }
    });

    // Build a map of edge labels using Mermaid v11 data-id pattern: L_source_target_index
    var edgeLabelMap = {};
    svg.querySelectorAll('g.edgeLabel g.label[data-id]').forEach(function(labelG) {
      var dataId = labelG.getAttribute('data-id') || '';
      // Parse L_source_target_index
      var match = dataId.match(/^L_(.+?)_(.+?)_(\d+)$/);
      if (match) {
        var key = match[1] + '_' + match[2] + '_' + match[3];
        var fo = labelG.querySelector('foreignObject');
        var labelText = '';
        if (fo) {
          var span = fo.querySelector('span.edgeLabel');
          if (span) labelText = span.textContent.trim();
        }
        edgeLabelMap[key] = { sourceKey: match[1], targetKey: match[2], label: labelText };
      }
    });

    // Build a map of node display labels from foreignObject/nodeLabel
    var nodeLabelMap = {};
    svg.querySelectorAll('g.node').forEach(function(nodeG) {
      var nodeId = nodeG.getAttribute('id') || '';
      // Parse node name from id: mermaid-xxx-flowchart-name-index
      var idMatch = nodeId.match(/flowchart-(.+?)-(\d+)$/);
      var nodeKey = idMatch ? idMatch[1] : '';
      var fo = nodeG.querySelector('foreignObject');
      var displayLabel = '';
      if (fo) {
        var span = fo.querySelector('span.nodeLabel');
        if (span) displayLabel = span.textContent.trim();
      }
      if (nodeKey && displayLabel) nodeLabelMap[nodeKey] = displayLabel;
    });

    edgeCandidates.forEach(function(edge) {
      edge.style.cursor = 'pointer';
      edge.style.pointerEvents = 'all';

      edge.addEventListener('mousedown', function(e) {
        e.stopPropagation();
      });

      edge.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        selectEdge(edge, svg, edgeLabelMap, nodeLabelMap);
      });
    });
  }

  function selectEdge(edgeEl, svg, edgeLabelMap, nodeLabelMap) {
    clearEdgeSelection();
    edgeEl.classList.add('mermaid-edge-selected');
    var parentG = edgeEl.parentElement;
    if (parentG && parentG.tagName.toLowerCase() === 'g') parentG.classList.add('mermaid-edge-selected');
    selectedEdge = edgeEl;
    var info = extractEdgeInfo(edgeEl, svg, edgeLabelMap, nodeLabelMap);
    displayEdgeInfo(info);
  }

  function clearEdgeSelection() {
    if (selectedEdge) {
      selectedEdge.classList.remove('mermaid-edge-selected');
      var parentG = selectedEdge.parentElement;
      if (parentG && parentG.tagName === 'g') parentG.classList.remove('mermaid-edge-selected');
      selectedEdge = null;
    }
    var panel = document.getElementById('edge-info-panel');
    if (panel) panel.classList.remove('visible');
  }

  function extractEdgeInfo(edgeEl, svg, edgeLabelMap, nodeLabelMap) {
    var source = '', target = '', sourceDisplay = '', targetDisplay = '', label = '', direction = 'forward';

    // Strategy 1: Match edge path with edge label data-id by index
    // Edge paths in <g class="edgePaths"> correspond by DOM order to edge labels
    var edgePathsContainer = svg.querySelector('g.edgePaths');
    if (edgePathsContainer) {
      var allEdgePaths = edgePathsContainer.querySelectorAll('path[marker-end]');
      var edgeIndex = -1;
      for (var i = 0; i < allEdgePaths.length; i++) {
        if (allEdgePaths[i] === edgeEl) { edgeIndex = i; break; }
      }
      if (edgeIndex >= 0) {
        // Find matching edge label by same index
        var edgeLabelGs = svg.querySelectorAll('g.edgeLabel');
        if (edgeIndex < edgeLabelGs.length) {
          var matchingLabelG = edgeLabelGs[edgeIndex];
          var innerLabel = matchingLabelG.querySelector('g.label[data-id]');
          if (innerLabel) {
            var dataId = innerLabel.getAttribute('data-id') || '';
            var match = dataId.match(/^L_(.+?)_(.+?)_(\d+)$/);
            if (match) {
              source = match[1];
              target = match[2];
              sourceDisplay = nodeLabelMap[source] || source;
              targetDisplay = nodeLabelMap[target] || target;
              // Get edge label text
              var fo = innerLabel.querySelector('foreignObject');
              if (fo) {
                var span = fo.querySelector('span.edgeLabel');
                if (span) label = span.textContent.trim();
              }
            }
          }
        }
      }
    }

    // Strategy 2: Mermaid older version class pattern LS-X LE-Y
    if (!source || !target) {
      var parentG = edgeEl.parentElement;
      var parentClass = parentG ? (parentG.getAttribute('class') || '') : '';
      var lsMatch = parentClass.match(/LS-([^\\s]+)/);
      var leMatch = parentClass.match(/LE-([^\\s]+)/);
      if (lsMatch) source = lsMatch[1];
      if (leMatch) target = leMatch[1];
      sourceDisplay = nodeLabelMap[source] || source;
      targetDisplay = nodeLabelMap[target] || target;
    }

    // Strategy 3: Find nearest nodes by path position (fallback)
    if (!source || !target) {
      try {
        var d = edgeEl.getAttribute('d') || '';
        var endpoints = extractPathEndpoints(d);
        var nodePositions = collectNodePositions(svg);
        if (endpoints && nodePositions.length > 0) {
          if (!source) {
            var nearest = findNearestNodeLabel(endpoints.sx, endpoints.sy, nodePositions);
            if (nearest) { source = nearest; sourceDisplay = nearest; }
          }
          if (!target) {
            var nearest2 = findNearestNodeLabel(endpoints.ex, endpoints.ey, nodePositions);
            if (nearest2) { target = nearest2; targetDisplay = nearest2; }
          }
        }
      } catch(e) {}
    }

    // Determine direction
    var markerEnd = edgeEl.getAttribute('marker-end') || '';
    var markerStart = edgeEl.getAttribute('marker-start') || '';
    if (markerStart && markerEnd) direction = 'bidirectional';
    else if (markerEnd) {
      if (markerEnd.indexOf('cross') !== -1 || markerEnd.indexOf('block') !== -1) direction = 'blocked';
      else direction = 'forward';
    }
    else if (markerStart) direction = 'backward';
    else direction = 'undirected';

    return { source: source, target: target, sourceDisplay: sourceDisplay, targetDisplay: targetDisplay, label: label, direction: direction };
  }

  function extractPathEndpoints(d) {
    if (!d) return null;
    var startMatch = d.match(/^[Mm]\\s*([0-9.e+-]+)\\s*[, ]\\s*([0-9.e+-]+)/);
    var nums = d.match(/[0-9.e+-]+/g);
    if (!startMatch || !nums || nums.length < 4) return null;
    return {
      sx: parseFloat(startMatch[1]),
      sy: parseFloat(startMatch[2]),
      ex: parseFloat(nums[nums.length - 2]),
      ey: parseFloat(nums[nums.length - 1])
    };
  }

  function collectNodePositions(svg) {
    var positions = [];
    svg.querySelectorAll('g.node').forEach(function(nodeG) {
      // Get display label from foreignObject
      var fo = nodeG.querySelector('foreignObject');
      var displayLabel = '';
      if (fo) {
        var span = fo.querySelector('span.nodeLabel');
        if (span) displayLabel = span.textContent.trim();
      }
      // Fallback: try <text> elements (older Mermaid versions)
      if (!displayLabel) {
        var textEl = nodeG.querySelector('text');
        if (textEl) displayLabel = textEl.textContent.trim();
      }
      // Also get node key from id
      var nodeId = nodeG.getAttribute('id') || '';
      var idMatch = nodeId.match(/flowchart-(.+?)-(\d+)$/);
      var nodeKey = idMatch ? idMatch[1] : '';

      if (!displayLabel && !nodeKey) return;

      var label = displayLabel || nodeKey;
      var transform = nodeG.getAttribute('transform') || '';
      var tm = transform.match(/translate\\(([^,\\s]+)[,\\s]+([^)]+)\\)/);
      if (tm) {
        positions.push({ label: label, x: parseFloat(tm[1]), y: parseFloat(tm[2]) });
      } else {
        try {
          var bbox = nodeG.getBBox();
          positions.push({ label: label, x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 });
        } catch(e) {}
      }
    });
    return positions;
  }

  function findNearestNodeLabel(x, y, nodes) {
    var best = null, bestDist = Infinity;
    nodes.forEach(function(n) {
      var dist = Math.sqrt((x - n.x) * (x - n.x) + (y - n.y) * (y - n.y));
      if (dist < bestDist) { bestDist = dist; best = n.label; }
    });
    return best;
  }

  function displayEdgeInfo(info) {
    var panel = document.getElementById('edge-info-panel');
    if (!panel) return;

    var dirSymbol = '';
    switch (info.direction) {
      case 'forward': dirSymbol = ' → '; break;
      case 'backward': dirSymbol = ' ← '; break;
      case 'bidirectional': dirSymbol = ' ↔ '; break;
      case 'blocked': dirSymbol = ' ✖ '; break;
      default: dirSymbol = ' — '; break;
    }

    var flowText = (info.sourceDisplay || info.source || '?') + dirSymbol + (info.targetDisplay || info.target || '?');

    panel.innerHTML =
      '<button class="edge-info-close">&times;</button>' +
      '<div class="edge-info-header">Connection Detail</div>' +
      '<div class="edge-info-row"><span class="edge-info-label">From:</span><span class="edge-info-value">' + (info.sourceDisplay || info.source || 'unknown') + '</span></div>' +
      '<div class="edge-info-row"><span class="edge-info-label">To:</span><span class="edge-info-value">' + (info.targetDisplay || info.target || 'unknown') + '</span></div>' +
      '<div class="edge-info-row"><span class="edge-info-label">Flow:</span><span class="edge-info-value">' + flowText + '</span></div>' +
      (info.label ? '<div class="edge-info-row"><span class="edge-info-label">Label:</span><span class="edge-info-value">' + info.label + '</span></div>' : '');

    var closeBtn = panel.querySelector('.edge-info-close');
    if (closeBtn) closeBtn.addEventListener('click', function() { panel.classList.remove('visible'); });

    panel.classList.add('visible');
  }

  // --- Resizable table columns ---
  function processTableResize() {
    var tables = previewBody.querySelectorAll('table');
    tables.forEach(function(table) {
      if (table.dataset.resizeReady) return;
      table.dataset.resizeReady = '1';

      var ths = table.querySelectorAll('th');
      if (ths.length === 0) return;

      ths.forEach(function(th) {
        var handle = document.createElement('div');
        handle.className = 'col-resize-handle';
        th.appendChild(handle);

        var startX, startWidth, tableFixed, originalWidths;

        handle.addEventListener('mousedown', function(e) {
          e.preventDefault();
          e.stopPropagation();

          // Capture current widths before switching to fixed layout
          if (!tableFixed) {
            originalWidths = [];
            var allThs = table.querySelectorAll('th');
            allThs.forEach(function(t) {
              originalWidths.push(t.offsetWidth);
            });

            table.style.tableLayout = 'fixed';
            allThs.forEach(function(t, i) {
              t.style.width = originalWidths[i] + 'px';
            });

            var allCells = table.querySelectorAll('td, th');
            allCells.forEach(function(cell) {
              cell.style.overflow = 'hidden';
              cell.style.textOverflow = 'ellipsis';
              cell.style.whiteSpace = 'nowrap';
            });

            tableFixed = true;
          }

          startX = e.pageX;
          startWidth = th.offsetWidth;
          handle.classList.add('resizing');

          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);

          function onMouseMove(e) {
            var diff = e.pageX - startX;
            var newWidth = Math.max(30, startWidth + diff);
            th.style.width = newWidth + 'px';
          }

          function onMouseUp() {
            handle.classList.remove('resizing');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
          }
        });

        // Double-click resets to auto
        handle.addEventListener('dblclick', function(e) {
          e.preventDefault();
          e.stopPropagation();
          th.style.width = '';
          var allThs = table.querySelectorAll('th');
          var allAuto = true;
          allThs.forEach(function(t) { if (t.style.width) allAuto = false; });
          if (allAuto) {
            table.style.tableLayout = '';
            tableFixed = false;
            var allCells = table.querySelectorAll('td, th');
            allCells.forEach(function(cell) {
              cell.style.overflow = '';
              cell.style.textOverflow = '';
              cell.style.whiteSpace = '';
            });
          }
        });
      });
    });
  }

  // Init: wait for CDN scripts then set up editor listener and render
  function waitForScripts() {
    if (typeof markdownit !== 'undefined' && typeof hljs !== 'undefined') {
      mdi = window.markdownit({
        html: true, linkify: true, typographer: true,
        highlight: function(str, lang) {
          if (lang && window.hljs.getLanguage(lang)) {
            try { return window.hljs.highlight(str, {language: lang}).value; } catch(e) {}
          }
          try { return window.hljs.highlightAuto(str).value; } catch(e) {}
          return '';
        }
      });

      if (typeof mermaid !== 'undefined') {
        mermaid.initialize({
          startOnLoad: false,
          theme: mermaidTheme,
          securityLevel: 'loose',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
        });
        mermaidReady = true;
      }

      editor.addEventListener('input', triggerRender);
      renderPreview();
      setMode('view');
    } else {
      setTimeout(waitForScripts, 100);
    }
  }

  waitForScripts();
})();
`;

function generateEditableHtml(mdContent, title, sourceFilename, sourceRelPath, savePort) {
  const escapedMd = escapeForJs(mdContent);
  const escapedFn = escapeForJs(sourceFilename);
  const escapedRelPath = escapeForJs(sourceRelPath);
  const jsFilled = EDIT_JS
    .replace('__MD_CONTENT_PLACEHOLDER__', escapedMd)
    .replace('__SOURCE_FILE_NAME_PLACEHOLDER__', escapedFn)
    .replace('__SOURCE_REL_PATH_PLACEHOLDER__', escapedRelPath)
    .replace('__SAVE_PORT_PLACEHOLDER__', String(savePort));

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `<title>${title}</title>`,
    '',
    '<!-- Mermaid -->',
    '<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>',
    '',
    '<!-- markdown-it -->',
    '<script src="https://cdn.jsdelivr.net/npm/markdown-it@14/dist/markdown-it.min.js"></script>',
    '',
    '<!-- highlight.js -->',
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/styles/github.min.css" id="hljs-light-theme">',
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/styles/github-dark.min.css" id="hljs-dark-theme" disabled>',
    '<script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/highlight.min.js"></script>',
    '',
    '<!-- Turndown (HTML to Markdown converter) -->',
    '<script src="https://cdn.jsdelivr.net/npm/turndown/dist/turndown.js"></script>',
    '',
    '<style>',
    EDIT_CSS,
    '</style>',
    '</head>',
    '<body data-theme="light">',
    '',
    '<!-- Top bar -->',
    '<div class="topbar">',
    '  <div class="topbar-left">',
    `    <span class="topbar-title">${title}</span>`,
    '    <span class="save-status" id="save-status">Checking server...</span>',
    '  </div>',
    '  <div class="topbar-actions">',
    '    <div class="mode-group">',
    '      <button class="mode-btn" data-mode="split">Split</button>',
    '      <button class="mode-btn active-mode" data-mode="view">View</button>',
    '      <button class="mode-btn" data-mode="edit">Edit</button>',
    '    </div>',
    '    <button class="topbar-btn" id="save-btn">Save</button>',
    '    <button class="topbar-btn" id="download-btn">Download</button>',
    '    <button class="topbar-btn" id="toc-toggle">TOC</button>',
    '    <button class="topbar-btn" id="theme-toggle">Dark</button>',
    '  </div>',
    '</div>',
    '',
    '<!-- TOC sidebar -->',
    '<div class="toc-sidebar" id="toc-sidebar"></div>',
    '',
    '<!-- Main content -->',
    '<div class="main-content" id="main-content">',
    '  <div class="split-container" id="split-container">',
    '    <div class="editor-pane" id="editor-pane">',
    '      <textarea id="editor" spellcheck="false"></textarea>',
    '    </div>',
    '    <div class="preview-pane" id="preview-pane">',
    '      <div class="md-body" id="preview-body"></div>',
    '    </div>',
    '  </div>',
    '</div>',
    '',
    '<!-- SVG Zoom overlay -->',
    '<div class="svg-overlay" id="svg-overlay">',
    '  <button class="overlay-close" id="overlay-close">&times;</button>',
    '  <div class="svg-container" id="svg-container"></div>',
    '  <div class="zoom-level" id="zoom-level">100%</div>',
    '  <div class="overlay-controls">',
    '    <button class="overlay-btn" id="zoom-in">Zoom In</button>',
    '    <button class="overlay-btn" id="zoom-out">Zoom Out</button>',
    '    <button class="overlay-btn" id="zoom-reset">Reset</button>',
    '  </div>',
    '  <div class="edge-info-panel" id="edge-info-panel"></div>',
    '</div>',
    '',
    '<script>',
    jsFilled,
    '</script>',
    '</body>',
    '</html>',
  ].join('\n');
}

module.exports = { EDIT_CSS, EDIT_JS, generateEditableHtml };
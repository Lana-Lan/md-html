#!/usr/bin/env node
// Render all Markdown files in a directory (or a single .md file's parent directory)
// into editable, sync-enabled HTML pages, then generate a manager page with sidebar
// navigation. A single combined server handles both content serving and dual-save sync.

const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const { exec } = require('child_process');

// --- Argument parsing ---
const args = process.argv.slice(2);
let inputPath = null;
let outputPath = null;
let port = null;
let initialFile = null;
let noServer = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--output' && i + 1 < args.length) { outputPath = args[++i]; }
  else if (args[i] === '--port' && i + 1 < args.length) { port = parseInt(args[++i], 10); }
  else if (args[i] === '--initial' && i + 1 < args.length) { initialFile = args[++i]; }
  else if (args[i] === '--no-server') { noServer = true; }
  else if (!inputPath) { inputPath = args[i]; }
}

if (!inputPath) {
  console.error('Usage: render_md_dir_sync.js <input.md-or-directory> [--output <manager-path>] [--port <port>] [--initial <relative-path>] [--no-server]');
  process.exit(1);
}

inputPath = path.resolve(inputPath);

// Determine root directory and whether input is a file or directory
let rootDir;
let isFileInput = false;

if (fs.existsSync(inputPath) && fs.statSync(inputPath).isFile()) {
  isFileInput = true;
  rootDir = path.dirname(inputPath);
} else if (fs.existsSync(inputPath) && fs.statSync(inputPath).isDirectory()) {
  rootDir = inputPath;
} else {
  console.error(`Error: "${inputPath}" is not a valid file or directory.`);
  process.exit(1);
}

// --- Scan for .md files ---
function scanMdFiles(dir, baseDir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'md-html-manager') continue;
      const sub = scanMdFiles(fullPath, baseDir);
      results.push(...sub);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      results.push({ name: entry.name, relPath, fullPath });
    }
  }
  return results.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

const mdFiles = scanMdFiles(rootDir, rootDir);
if (mdFiles.length === 0 && !fs.readdirSync(rootDir).some(e => e.toLowerCase().endsWith('.html'))) {
  console.error(`No .md or .html files found in "${rootDir}" or its subdirectories.`);
  process.exit(1);
}

if (mdFiles.length > 0) {
  console.log(`Found ${mdFiles.length} .md files in "${rootDir}"`);
}

// --- Output directory for generated HTML files ---
const mdHtmlManagerDir = path.join(rootDir, 'md-html-manager');

// --- Compute output HTML paths for each md file ---
const syncedHtmlFiles = mdFiles.map(md => {
  const htmlRelPath = md.relPath.replace(/\.md$/i, '.html');
  const htmlFullPath = path.join(mdHtmlManagerDir, htmlRelPath);
  return {
    mdRelPath: md.relPath,
    mdFullPath: md.fullPath,
    name: path.basename(htmlFullPath),
    relPath: htmlRelPath,
    fullPath: htmlFullPath,
    syncable: true
  };
});



// --- Find a free port ---
function findFreePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      const p = server.address().port;
      server.close(() => resolve(p));
    });
    server.on('error', () => {
      findFreePort(startPort + 1).then(resolve).catch(reject);
    });
  });
}

// ============================================================
// Editable HTML template (from md-live-edit-sync, modified for multi-file)
// ============================================================

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
}
.md-body table th { font-weight: 600; background: var(--toc-bg); }
.md-body table tr:nth-child(even) { background: var(--toc-bg); }

.md-body img { max-width: 100%; border-radius: 4px; }
.md-body hr { height: 2px; padding: 0; margin: 24px 0; background: var(--border); border: 0; }

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
  var currentMode = 'split';
  var serverConnected = false;
  var syncScrollLock = null;
  var mdi = null;
  var mermaidReady = false;
  var mermaidTheme = 'default';

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
    } else if (mode === 'edit') {
      editorPane.style.display = 'flex';
      editorPane.style.width = '100%';
      previewPane.style.display = 'none';
    }
  }

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
    var blocks = previewBody.querySelectorAll('pre code.language-mermaid, pre code.language-Mermaid');
    blocks.forEach(function(block) {
      var source = block.textContent;
      var wrapper = document.createElement('div');
      wrapper.className = 'mermaid-wrapper';
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
  }

  function hideOverlay() { overlay.classList.remove('active'); }

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
      setMode('split');
    } else {
      setTimeout(waitForScripts, 100);
    }
  }

  waitForScripts();
})();
`;

// ============================================================
// Manager HTML template (from html-dir-manager)
// ============================================================

function buildTree(files) {
  const tree = {};
  for (const f of files) {
    const parts = f.relPath.split('/');
    let node = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node[parts[i]]) node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = f;
  }
  return tree;
}

function treeToHtml(node, parentPath) {
  let html = '';
  const keys = Object.keys(node).sort();
  for (const key of keys) {
    const val = node[key];
    const fullPath = parentPath ? parentPath + '/' + key : key;
    if (val && val.relPath) {
      const badge = val.syncable ? '<span class="file-badge file-badge-sync">&#9999;</span>' : '<span class="file-badge file-badge-static">&#9632;</span>';
      html += `<div class="file-item" data-path="${val.relPath}" data-syncable="${val.syncable ? '1' : '0'}" tabindex="0">${badge} ${val.name}</div>\n`;
    } else {
      const subHtml = treeToHtml(val, fullPath);
      const count = countFiles(val);
      html += `<div class="dir-item" data-dir-path="${fullPath}">
        <div class="dir-header" tabindex="0">
          <span class="dir-arrow">&#9654;</span>
          <span class="dir-name">${key}</span>
          <span class="dir-badge">${count}</span>
        </div>
        <div class="dir-contents">${subHtml}</div>
      </div>\n`;
    }
  }
  return html;
}

function countFiles(node) {
  let c = 0;
  for (const key of Object.keys(node)) {
    if (node[key] && node[key].relPath) c++;
    else c += countFiles(node[key]);
  }
  return c;
}

// ============================================================
// Utility functions
// ============================================================

function escapeForJs(text) {
  return JSON.stringify(text);
}

function deriveTitle(mdContent, fallbackTitle) {
  const match = mdContent.match(/^#\s+(.+)/);
  return match ? match[1].trim() : fallbackTitle;
}

// ============================================================
// Generate editable HTML for a single .md file
// ============================================================

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
    '      <button class="mode-btn active-mode" data-mode="split">Split</button>',
    '      <button class="mode-btn" data-mode="view">View</button>',
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
    '</div>',
    '',
    '<script>',
    jsFilled,
    '</script>',
    '</body>',
    '</html>',
  ].join('\n');
}



* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text);
  background: var(--bg);
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.topbar {
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  padding: 8px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 44px;
  flex-shrink: 0;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 400px;
}

.file-count {
  font-size: 11px;
  color: var(--muted);
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--badge-bg);
}

.server-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
}

.server-status.online { color: var(--success); background: rgba(40,167,69,0.1); font-weight: 500; }
.server-status.offline { color: var(--muted); background: var(--badge-bg); }

.topbar-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.btn {
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}
.btn:hover { background: var(--hover-bg); }

.main-area {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.breadcrumb {
  padding: 6px 12px;
  background: var(--breadcrumb-bg);
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  color: var(--muted);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.breadcrumb-path {
  color: var(--link);
  font-weight: 500;
}

.iframe-wrap {
  flex: 1;
  overflow: hidden;
  border: none;
}

.iframe-wrap iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: var(--bg);
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--empty-bg);
  color: var(--empty-text);
  font-size: 16px;
}

.sidebar {
  width: 260px;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
  transition: width 0.25s, border-right-width 0.25s;
}
.sidebar.collapsed {
  width: 0;
  border-right-width: 0;
}
.sidebar.collapsed .sidebar-header,
.sidebar.collapsed .sidebar-list { visibility: hidden; }

.sidebar-header {
  padding: 8px;
  border-bottom: 1px solid var(--border);
}

.search-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--search-border);
  border-radius: 6px;
  background: var(--search-bg);
  color: var(--text);
  font-size: 13px;
  outline: none;
}
.search-input:focus { border-color: var(--link); }
.search-input::placeholder { color: var(--muted); }

.sidebar-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.file-item {
  padding: 6px 12px 6px 16px;
  cursor: pointer;
  border-radius: 4px;
  margin: 1px 4px;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background 0.15s;
}
.file-item:hover { background: var(--hover-bg); }
.file-item.active { background: var(--active-bg); color: var(--active-text); font-weight: 500; }

.file-badge {
  font-size: 10px;
  padding: 0px 3px;
  border-radius: 2px;
  vertical-align: middle;
  line-height: 1;
}
.file-badge-sync { color: var(--success); }
.file-badge-static { color: var(--muted); }

.dir-item {}

.dir-header {
  padding: 6px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 4px;
  margin: 1px 4px;
  transition: background 0.15s;
}
.dir-header:hover { background: var(--hover-bg); }

.dir-arrow {
  font-size: 10px;
  transition: transform 0.2s;
  color: var(--muted);
}
.dir-item.open .dir-arrow { transform: rotate(90deg); }

.dir-name { overflow: hidden; text-overflow: ellipsis; }

.dir-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--badge-bg);
  color: var(--badge-text);
}

.dir-contents {
  display: none;
  padding-left: 8px;
}
.dir-item.open .dir-contents { display: block; }

.hidden { display: none !important; }

@media (max-width: 768px) {
  .sidebar { width: 200px; }
}

@media (max-width: 500px) {
  .sidebar { position: absolute; right: 0; top: 44px; bottom: 0; z-index: 50; transform: translateX(100%); transition: transform 0.25s; width: 240px; }
  .sidebar.open { transform: translateX(0); }
  .sidebar-toggle-mobile { display: inline-flex; }
}
</style>
</head>
<body>

<div class="topbar">
  <div class="topbar-left">
    <span class="topbar-title">MD-HTML</span>
    <span class="file-count">${totalFiles} files</span>
    <span class="server-status" id="serverStatus">Checking...</span>
  </div>
  <div class="topbar-actions">
    <button class="btn" id="sidebarToggleBtn" title="Toggle sidebar">&#9776;</button>
    <button class="btn" id="themeBtn" title="Toggle theme">&#9789;</button>
  </div>
</div>

<div class="main-area">
  <div class="content-area">
    <div class="breadcrumb">
      <span>Current:</span>
      <span class="breadcrumb-path" id="breadcrumbPath">-</span>
    </div>
    <div class="iframe-wrap" id="iframeWrap">
      <iframe id="contentFrame" sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads" src="about:blank"></iframe>
    </div>
    <div class="empty-state" id="emptyState" style="display:none;">Select a file from the sidebar</div>
  </div>
  <div class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <input class="search-input" id="searchInput" type="text" placeholder="Search files..." autocomplete="off">
    </div>
    <div class="sidebar-list" id="sidebarList">
      ${sidebarHtmlContent}
    </div>
  </div>
</div>

<script>
const FILES = ${fileDataJson};
const SERVER_PORT = ${serverPort || 0};
const NO_SERVER = ${noServer ? 'true' : 'false'};
let currentFile = "${initialRelPath}";
const serverStatusEl = document.getElementById('serverStatus');
const breadcrumbPathEl = document.getElementById('breadcrumbPath');
const contentFrame = document.getElementById('contentFrame');
const iframeWrap = document.getElementById('iframeWrap');
const emptyState = document.getElementById('emptyState');
const sidebarList = document.getElementById('sidebarList');
const searchInput = document.getElementById('searchInput');
const themeBtn = document.getElementById('themeBtn');
const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
const sidebarEl = document.getElementById('sidebar');

// --- Sidebar toggle ---
function toggleSidebar() {
  const collapsed = sidebarEl.classList.toggle('collapsed');
  sidebarToggleBtn.innerHTML = collapsed ? '☰' : '☶';
  try { localStorage.setItem('md-dir-sidebar', collapsed ? 'collapsed' : 'open'); } catch(e) {}
}
sidebarToggleBtn.addEventListener('click', toggleSidebar);
try { if (localStorage.getItem('md-dir-sidebar') === 'collapsed') { sidebarEl.classList.add('collapsed'); sidebarToggleBtn.innerHTML = '☰'; } } catch(e) {}

// --- Theme ---
function getTheme() { return document.documentElement.getAttribute('data-theme') || 'light'; }
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  themeBtn.textContent = t === 'dark' ? '☀' : '☾';
  try { localStorage.setItem('md-dir-theme', t); } catch(e) {}
}
themeBtn.addEventListener('click', () => setTheme(getTheme() === 'dark' ? 'light' : 'dark'));
try { setTheme(localStorage.getItem('md-dir-theme') || 'light'); } catch(e) { setTheme('light'); }

// --- Server connectivity ---
let serverOnline = false;

async function checkServer() {
  if (NO_SERVER) { serverOnline = false; serverStatusEl.textContent = 'Static mode'; serverStatusEl.className = 'server-status offline'; return; }
  try {
    const res = await fetch('http://localhost:' + SERVER_PORT + '/ping', { signal: AbortSignal.timeout(2000) });
    if (res.ok) { serverOnline = true; serverStatusEl.textContent = 'Server online'; serverStatusEl.className = 'server-status online'; }
  } catch(e) {
    serverOnline = false;
    serverStatusEl.textContent = 'Server offline';
    serverStatusEl.className = 'server-status offline';
  }
}

// --- Load initial file after server check ---
checkServer().then(() => loadFile(currentFile));
setInterval(checkServer, 5000);

// --- Load file content ---
function loadFile(relPath) {
  currentFile = relPath;
  breadcrumbPathEl.textContent = relPath;

  // Update active state in sidebar
  document.querySelectorAll('.file-item').forEach(el => {
    el.classList.toggle('active', el.dataset.path === relPath);
  });

  // Expand all parent directories of the current file
  expandParents(relPath);

  if (serverOnline) {
    contentFrame.src = 'http://localhost:' + SERVER_PORT + '/file?path=' + encodeURIComponent(relPath);
    iframeWrap.style.display = '';
    emptyState.style.display = 'none';
  } else {
    // Static mode: try embedded content
    const embedded = document.getElementById('embedded-' + relPath);
    if (embedded) {
      const doc = contentFrame.contentDocument || contentFrame.contentWindow.document;
      doc.open();
      doc.write(embedded.textContent);
      doc.close();
      iframeWrap.style.display = '';
      emptyState.style.display = 'none';
    } else if (NO_SERVER) {
      iframeWrap.style.display = 'none';
      emptyState.style.display = '';
      emptyState.textContent = 'File content not embedded (static mode)';
    } else {
      contentFrame.src = 'about:blank';
      iframeWrap.style.display = 'none';
      emptyState.style.display = '';
      emptyState.textContent = 'Server offline — cannot load file content';
    }
  }
}

function expandParents(relPath) {
  const parts = relPath.split('/');
  let currentDir = '';
  for (let i = 0; i < parts.length - 1; i++) {
    currentDir = currentDir ? currentDir + '/' + parts[i] : parts[i];
    const dirEl = document.querySelector('.dir-item[data-dir-path="' + currentDir + '"]');
    if (dirEl) dirEl.classList.add('open');
  }
}

// --- Sidebar interactions ---
sidebarList.addEventListener('click', (e) => {
  const fileItem = e.target.closest('.file-item');
});

// Keyboard navigation
sidebarList.addEventListener('keydown', (e) => {
  const items = [...sidebarList.querySelectorAll('.file-item:not(.hidden)')];
  if (!items.length) return;
  const active = sidebarList.querySelector('.file-item.active');
  let idx = items.indexOf(active);
});

// --- Search ---
searchInput.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase().trim();
  const allFiles = sidebarList.querySelectorAll('.file-item');
  const allDirs = sidebarList.querySelectorAll('.dir-item');
});
</script>
</body>
</html>`;
}


// ============================================================
// Combined server (handles both save and file serving)
// ============================================================

function startCombinedServer(port, rootDir, htmlFilesList, mdHtmlManagerDir) {
  // Build file map: relPath -> fullPath for correct file serving
  const fileMap = {};
  for (const f of htmlFilesList) {
    fileMap[f.relPath] = f.fullPath;
  }

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://localhost:${port}`);

    // Health check
    if (req.method === 'GET' && url.pathname === '/ping') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // File content serving (for manager iframe)
    if (req.method === 'GET' && url.pathname === '/file') {
      const filePath = url.searchParams.get('path');
      if (!filePath) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing path parameter');
        return;
      }
      // Use file map to locate actual file on disk (syncable in md-html-manager, standalone in source dir)
      const fullPath = fileMap[filePath] || path.join(rootDir, filePath.replace(/\\/g, '/'));
      // Security: ensure the path is within rootDir
      if (!fullPath.startsWith(rootDir)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Access denied');
        return;
      }
      if (!fs.existsSync(fullPath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found');
        return;
      }
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Read error: ' + e.message);
      }
      return;
    }

    // Dual-save sync (from editable HTML pages)
    if (req.method === 'POST' && url.pathname === '/save') {
      const mdRelPath = url.searchParams.get('file');
      if (!mdRelPath) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Missing file parameter' }));
        return;
      }

      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const newContent = data.content;

          // Resolve paths — .md stays in source dir, .html goes to md-html-manager
          const mdFullPath = path.join(rootDir, mdRelPath.replace(/\\/g, '/'));
          const htmlRelPath = mdRelPath.replace(/\.md$/i, '.html');
          const htmlFullPath = path.join(mdHtmlManagerDir, htmlRelPath.replace(/\\/g, '/'));
          const sourceFilename = path.basename(mdFullPath);
          const fallbackTitle = path.basename(mdFullPath, path.extname(mdFullPath));

          // Security check
          if (!mdFullPath.startsWith(rootDir) || !htmlFullPath.startsWith(mdHtmlManagerDir)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Access denied' }));
            return;
          }

          // 1. Save to .md file
          fs.writeFileSync(mdFullPath, newContent, 'utf8');

          // 2. Derive new title
          const newTitle = deriveTitle(newContent, fallbackTitle);

          // 3. Regenerate .html file with updated content in md-html-manager
          let htmlUpdated = false;
          try {
            const htmlOutputDir = path.dirname(htmlFullPath);
            if (!fs.existsSync(htmlOutputDir)) {
              fs.mkdirSync(htmlOutputDir, { recursive: true });
            }
            const newHtml = generateEditableHtml(newContent, newTitle, sourceFilename, mdRelPath, port);
            fs.writeFileSync(htmlFullPath, newHtml, 'utf8');
            htmlUpdated = true;
          } catch (htmlErr) {
            console.error('HTML regeneration failed: ' + htmlErr.message);
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, htmlUpdated: htmlUpdated }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`Combined server running on http://localhost:${port}`);
  });

  return server;
}

// ============================================================
// Main workflow
// ============================================================

async function main() {
  // Step 0: Create md-html-manager output directory
  if (!fs.existsSync(mdHtmlManagerDir)) {
    fs.mkdirSync(mdHtmlManagerDir, { recursive: true });
  }

  // Step 1: Generate editable HTML for each .md file (if any)
  if (mdFiles.length > 0) {
    console.log('\n--- Generating editable HTML files in md-html-manager ---');
    for (const md of mdFiles) {
      const mdContent = fs.readFileSync(md.fullPath, 'utf8');
      const fallbackTitle = path.basename(md.fullPath, '.md');
      const title = deriveTitle(mdContent, fallbackTitle);
      const sourceFilename = path.basename(md.fullPath);
      const mdRelPath = md.relPath;

      const htmlRelPath = mdRelPath.replace(/\.md$/i, '.html');
      const htmlOutputPath = path.join(mdHtmlManagerDir, htmlRelPath);
      const htmlOutputDir = path.dirname(htmlOutputPath);
      if (!fs.existsSync(htmlOutputDir)) {
        fs.mkdirSync(htmlOutputDir, { recursive: true });
      }

      const placeholderPort = noServer ? 0 : 9999;

      const htmlContent = generateEditableHtml(mdContent, title, sourceFilename, mdRelPath, placeholderPort);
      fs.writeFileSync(htmlOutputPath, htmlContent, 'utf8');
      console.log(`  ${mdRelPath} -> md-html-manager/${htmlRelPath}`);
    }
  }

  // Step 2: Re-scan for all html files now (including newly generated ones + standalone ones)
  // This ensures the manager list is complete and excludes index-manager.html
  const managerOutputPath = outputPath || path.join(mdHtmlManagerDir, 'index.manager.html');
  const managerRelPath = path.relative(rootDir, managerOutputPath).replace(/\\/g, '/');

  // Refresh standalone scan to pick up newly generated files and exclude the manager itself
  const freshSyncedRelPaths = new Set(syncedHtmlFiles.map(f => f.relPath));
  const freshStandaloneHtmlFiles = scanHtmlFiles(rootDir, rootDir, freshSyncedRelPaths)
    .filter(f => f.relPath !== managerRelPath);
  const allHtmlFilesForManager = [...syncedHtmlFiles, ...freshStandaloneHtmlFiles].sort((a, b) => a.relPath.localeCompare(b.relPath));

  if (allHtmlFilesForManager.length === 0) {
    console.error('No HTML files to manage.');
    process.exit(1);
  }

  console.log(`\n--- Total HTML files for manager: ${allHtmlFilesForManager.length} (${syncedHtmlFiles.length} syncable, ${freshStandaloneHtmlFiles.length} standalone) ---`);

  // Step 3: Build sidebar HTML for the manager
  const fileTree = buildTree(allHtmlFilesForManager);
  const sidebarHtml = treeToHtml(fileTree, '');

  // Step 4: Determine server port and regenerate HTML files with actual port
  let chosenPort;
  if (noServer) {
    chosenPort = 0;
  } else {
    chosenPort = port || await findFreePort(3800);

    // Regenerate each editable HTML with the actual server port
    if (mdFiles.length > 0) {
      console.log('\n--- Updating HTML files with server port ' + chosenPort + ' ---');
      for (const md of mdFiles) {
        const mdContent = fs.readFileSync(md.fullPath, 'utf8');
        const fallbackTitle = path.basename(md.fullPath, '.md');
        const title = deriveTitle(mdContent, fallbackTitle);
        const sourceFilename = path.basename(md.fullPath);
        const mdRelPath = md.relPath;
        const htmlRelPath = mdRelPath.replace(/\.md$/i, '.html');
        const htmlOutputPath = path.join(mdHtmlManagerDir, htmlRelPath);
        const htmlOutputDir = path.dirname(htmlOutputPath);
        if (!fs.existsSync(htmlOutputDir)) {
          fs.mkdirSync(htmlOutputDir, { recursive: true });
        }

        const htmlContent = generateEditableHtml(mdContent, title, sourceFilename, mdRelPath, chosenPort);
        fs.writeFileSync(htmlOutputPath, htmlContent, 'utf8');
      }
    }
  }



  const syncCount = syncedHtmlFiles.length;
  const staticCount = freshStandaloneHtmlFiles.length;
  console.log(`\nOpen ${managerOutputPath} in a browser to browse ${allHtmlFilesForManager.length} HTML files (${syncCount} editable, ${staticCount} view-only).`);
  console.log(`Tip: Without --no-server, Ctrl+S syncs edits to both .md and .html automatically.`);

  // Auto-open manager in browser
  const managerAbsPath = path.resolve(managerOutputPath);
  const openCmd = process.platform === 'win32' ? `start "" "${managerAbsPath}"` :
                    process.platform === 'darwin' ? `open "${managerAbsPath}"` :
                    `xdg-open "${managerAbsPath}"`;
  exec(openCmd, (err) => {
    if (err) console.warn('Could not auto-open browser: ' + err.message);
  });
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
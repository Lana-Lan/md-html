const fs = require('fs');

function buildTree(files) {
  const tree = {};
  for (const f of files) {
    const parts = (f.displayRelPath || f.relPath).split('/');
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
      const displayPath = val.displayRelPath || val.relPath;
      const serverPathAttr = (val.displayRelPath && val.displayRelPath !== val.relPath) ? ` data-server-path="${val.relPath}"` : '';
      const badge = val.syncable ? '<span class="file-badge file-badge-sync">&#9999;</span>' : '<span class="file-badge file-badge-static">&#9632;</span>';
      const langBadge = val.codeLanguage ? `<span class="file-badge file-badge-lang">${val.codeLanguage}</span>` : '';
      const displayName = val.displayName || val.name;
      html += `<div class="file-item" data-path="${displayPath}"${serverPathAttr} data-syncable="${val.syncable ? '1' : '0'}" tabindex="0">${badge}${langBadge} ${displayName}</div>\n`;
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

function generateManagerHtml(serverPort, htmlFilesList, sidebarHtmlContent, initialRelPath, totalFiles, noServer) {
  const fileDataJson = JSON.stringify(htmlFilesList.map(f => ({ name: f.displayName || f.name, displayRelPath: f.displayRelPath || f.relPath, relPath: f.relPath, syncable: f.syncable })));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MD-HTML Manager</title>
<style>
:root {
  --bg: #ffffff;
  --sidebar-bg: #f7f8fa;
  --text: #1a1a1a;
  --heading: #111111;
  --link: #0366d6;
  --border: #e1e4e8;
  --muted: #6a737d;
  --active-bg: #e8f0fe;
  --active-text: #0366d6;
  --hover-bg: #f0f1f3;
  --dir-bg: #eef0f2;
  --badge-bg: #d1d5db;
  --badge-text: #4b5563;
  --search-bg: #ffffff;
  --search-border: #d1d5db;
  --breadcrumb-bg: #f7f8fa;
  --iframe-border: #e1e4e8;
  --empty-bg: #f7f8fa;
  --empty-text: #6a737d;
  --success: #28a745;
}
[data-theme="dark"] {
  --bg: #0d1117;
  --sidebar-bg: #161b22;
  --text: #c9d1d9;
  --heading: #f0f6fc;
  --link: #58a6ff;
  --border: #30363d;
  --muted: #8b949e;
  --active-bg: #1c2d41;
  --active-text: #58a6ff;
  --hover-bg: #1a1f25;
  --dir-bg: #1c2128;
  --badge-bg: #30363d;
  --badge-text: #8b949e;
  --search-bg: #0d1117;
  --search-border: #30363d;
  --breadcrumb-bg: #161b22;
  --iframe-border: #30363d;
  --empty-bg: #161b22;
  --empty-text: #8b949e;
  --success: #3fb950;
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
.file-badge-lang {
  font-size: 9px;
  padding: 0px 3px;
  border-radius: 2px;
  vertical-align: middle;
  line-height: 1;
  background: var(--badge-bg);
  color: var(--badge-text);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

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
.dir-item.open > .dir-header > .dir-arrow { transform: rotate(90deg); }

.dir-name { overflow: hidden; text-overflow: ellipsis; }

.dir-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--badge-bg);
  color: var(--badge-text);
}

.sidebar-controls {
  display: flex;
  gap: 4px;
  margin-top: 6px;
}

.sidebar-btn {
  padding: 3px 8px;
  font-size: 11px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  flex: 1;
  text-align: center;
  white-space: nowrap;
}
.sidebar-btn:hover { background: var(--hover-bg); color: var(--text); }

.dir-contents {
  display: none;
  margin-left: 12px;
  padding-left: 8px;
  border-left: 1px solid var(--border);
}
.dir-item.open > .dir-contents { display: block; }

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
      <div class="sidebar-controls">
        <button class="sidebar-btn" id="expandAllBtn" title="Expand all directories">&#9662; Expand All</button>
        <button class="sidebar-btn" id="collapseAllBtn" title="Collapse all directories">&#9652; Collapse All</button>
      </div>
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

// Build path map: display path → server path (for code/standalone files whose display path differs from physical path)
const PATH_MAP = {};
FILES.forEach(f => { if (f.displayRelPath && f.displayRelPath !== f.relPath) PATH_MAP[f.displayRelPath] = f.relPath; });
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
function loadFile(displayPath) {
  currentFile = displayPath;
  breadcrumbPathEl.textContent = displayPath;

  // Update active state in sidebar
  document.querySelectorAll('.file-item').forEach(el => {
    el.classList.toggle('active', el.dataset.path === displayPath);
  });

  // Expand all parent directories of the current file
  expandParents(displayPath);

  // Resolve server path from display path (code/standalone files have different physical paths)
  const serverPath = PATH_MAP[displayPath] || displayPath;

  if (serverOnline) {
    contentFrame.src = 'http://localhost:' + SERVER_PORT + '/file?path=' + encodeURIComponent(serverPath);
    iframeWrap.style.display = '';
    emptyState.style.display = 'none';
  } else {
    // Static mode: try embedded content using display path
    const embedded = document.getElementById('embedded-' + displayPath);
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
  if (fileItem) {
    loadFile(fileItem.dataset.path);
    return;
  }
  const dirHeader = e.target.closest('.dir-header');
  if (dirHeader) {
    const dirItem = dirHeader.closest('.dir-item');
    dirItem.classList.toggle('open');
  }
});

// --- Expand / Collapse All ---
document.getElementById('expandAllBtn').addEventListener('click', () => {
  document.querySelectorAll('.dir-item').forEach(d => d.classList.add('open'));
});
document.getElementById('collapseAllBtn').addEventListener('click', () => {
  document.querySelectorAll('.dir-item').forEach(d => d.classList.remove('open'));
  // Re-expand only the current file's parents
  if (currentFile) expandParents(currentFile);
});

// Keyboard navigation
sidebarList.addEventListener('keydown', (e) => {
  const items = [...sidebarList.querySelectorAll('.file-item:not(.hidden)')];
  if (!items.length) return;
  const active = sidebarList.querySelector('.file-item.active');
  let idx = items.indexOf(active);

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    idx = idx < items.length - 1 ? idx + 1 : 0;
    items[idx].focus();
    items[idx].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    idx = idx > 0 ? idx - 1 : items.length - 1;
    items[idx].focus();
    items[idx].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    if (active) loadFile(active.dataset.path);
  }
});

// --- Search ---
searchInput.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase().trim();
  const allFiles = sidebarList.querySelectorAll('.file-item');
  const allDirs = sidebarList.querySelectorAll('.dir-item');

  if (!query) {
    allFiles.forEach(f => f.classList.remove('hidden'));
    allDirs.forEach(d => d.classList.remove('hidden'));
    allDirs.forEach(d => d.classList.remove('open'));
    if (currentFile) expandParents(currentFile);
    return;
  }

  allFiles.forEach(f => {
    const matches = f.dataset.path.toLowerCase().includes(query) || f.textContent.toLowerCase().includes(query);
    f.classList.toggle('hidden', !matches);
  });

  allDirs.forEach(d => {
    const visibleFiles = d.querySelectorAll('.file-item:not(.hidden)');
    const hasVisible = visibleFiles.length > 0;
    d.classList.toggle('hidden', !hasVisible);
    if (hasVisible) d.classList.add('open');
    else d.classList.remove('open');
  });
});
</script>
</body>
</html>`;
}

function generateStaticManagerHtml(htmlFilesList, sidebarHtmlContent, initialRelPath, totalFiles, noServer) {
  // Generate manager HTML first
  const managerHtml = generateManagerHtml(0, htmlFilesList, sidebarHtmlContent, initialRelPath, totalFiles, noServer);

  // Embed each editable HTML file's content in a script tag (using display path for IDs)
  let embeddedContent = '';
  for (const f of htmlFilesList) {
    try {
      const content = fs.readFileSync(f.fullPath, 'utf8');
      const escaped = content.replace(/<\/script/gi, '<\\/script');
      const displayPath = f.displayRelPath || f.relPath;
      embeddedContent += `<script type="text/plain" id="embedded-${displayPath}">${escaped}</script>\n`;
    } catch(e) {
      console.warn(`Could not read ${f.relPath}: ${e.message}`);
    }
  }

  // Inject embedded content before </body>
  return managerHtml.replace('</body>', embeddedContent + '</body>');
}

module.exports = { buildTree, treeToHtml, countFiles, generateManagerHtml, generateStaticManagerHtml };
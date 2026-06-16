const { escapeForJs } = require('./utils');

const STANDALONE_CSS = `
:root {
  --bg: #ffffff;
  --text: #1a1a1a;
  --link: #0366d6;
  --code-bg: #f6f8fa;
  --border: #e1e4e8;
  --muted: #6a737d;
  --success: #28a745;
}

[data-theme="dark"] {
  --bg: #0d1117;
  --text: #c9d1d9;
  --link: #58a6ff;
  --code-bg: #161b22;
  --border: #30363d;
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
  max-width: 300px;
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

.main-content {
  height: calc(100vh - 44px);
}

/* View/Edit mode: contenteditable iframe */
.content-iframe-wrap { height: 100%; overflow: hidden; }
.content-iframe-wrap iframe { width: 100%; height: 100%; border: none; background: var(--bg); }
.content-iframe-wrap.editing iframe { outline: 2px solid var(--link); outline-offset: -2px; }

/* Source mode: textarea editor + preview iframe */
.source-wrap { display: none; flex-direction: row; height: 100%; overflow: hidden; }
.source-wrap.active { display: flex; }
.source-editor-pane { width: 50%; display: flex; flex-direction: column; border-right: 2px solid var(--border); overflow: hidden; }
.source-preview-pane { width: 50%; overflow: hidden; }
.source-preview-pane iframe { width: 100%; height: 100%; border: none; background: var(--bg); }

.source-editor-pane textarea {
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

@media (max-width: 768px) {
  .source-wrap.active { flex-direction: column; }
  .source-editor-pane { width: 100% !important; height: 50%; border-right: none; border-bottom: 2px solid var(--border); }
  .source-preview-pane { width: 100% !important; height: 50%; }
  .topbar-actions { flex-wrap: wrap; gap: 4px; }
  .topbar-left { max-width: 120px; }
}
`;

const STANDALONE_JS = `
(function() {
  var sourceFileName = {{{{MDHTML_SOURCE_FILE_NAME}}}};
  var sourceRelPath = {{{{MDHTML_SOURCE_REL_PATH}}}};
  var baseDir = {{{{MDHTML_BASE_DIR}}}};
  var savePort = {{{{MDHTML_SAVE_PORT}}}};
  var initialHtml = {{{{MDHTML_HTML_CONTENT}}}};
  var currentTheme = 'light';
  var currentMode = 'edit';
  var serverConnected = false;
  var rawHtml = initialHtml;
  var isDirty = false;

  var contentIframe = document.getElementById('content-iframe');
  var contentWrap = document.getElementById('content-iframe-wrap');
  var sourceWrap = document.getElementById('source-wrap');
  var sourceEditor = document.getElementById('source-editor');
  var sourcePreview = document.getElementById('source-preview-iframe');
  var saveBtn = document.getElementById('save-btn');

  // Check server connection
  checkServerConnection();

  function checkServerConnection() {
    if (!savePort) {
      // Static mode: use embedded content
      if (rawHtml) { renderContentIframe(rawHtml); setMode('view'); }
      document.getElementById('save-status').textContent = 'Static mode';
      return;
    }
    fetch('http://localhost:' + savePort + '/ping')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.ok) {
          serverConnected = true;
          var statusEl = document.getElementById('save-status');
          statusEl.textContent = 'Sync ready (html)';
          statusEl.className = 'save-status connected';
          saveBtn.classList.add('save-ready');
          loadContent();
        }
      })
      .catch(function() {
        if (rawHtml) { renderContentIframe(rawHtml); setMode('view'); }
        document.getElementById('save-status').textContent = 'Server offline';
      });
  }

  function loadContent() {
    fetch('http://localhost:' + savePort + '/raw-html?path=' + encodeURIComponent(sourceRelPath))
      .then(function(r) { return r.text(); })
      .then(function(html) {
        rawHtml = html;
        sourceEditor.value = rawHtml;
        renderContentIframe(rawHtml);
        setMode('edit');
      })
      .catch(function() {
        if (rawHtml) { renderContentIframe(rawHtml); setMode('view'); }
      });
  }

  function prepareHtmlForSrcdoc(html) {
    if (!savePort) return html;
    if (html.indexOf('<base') !== -1) return html;
    var baseUrl = 'http://localhost:' + savePort + '/asset/' + encodeURIComponent(baseDir) + '/';
    var baseTag = '<base href="' + baseUrl + '" data-edit-injected="true">';
    var headIdx = html.toLowerCase().indexOf('<head>');
    if (headIdx !== -1) {
      return html.substring(0, headIdx + 6) + baseTag + html.substring(headIdx + 6);
    } else {
      return '<html><head>' + baseTag + '</head><body>' + html + '</body></html>';
    }
  }

  function renderContentIframe(html) {
    contentIframe.srcdoc = prepareHtmlForSrcdoc(html);
  }

  // Enable/disable contenteditable on the iframe after load
  contentIframe.addEventListener('load', function() {
    try {
      var doc = contentIframe.contentDocument || contentIframe.contentWindow.document;
      if (currentMode === 'edit') {
        doc.body.contentEditable = 'true';
        doc.designMode = 'on';
        var style = doc.createElement('style');
        style.setAttribute('data-edit-injected', 'true');
        style.textContent = 'body[contenteditable="true"]:focus { outline: 2px solid #0366d6; outline-offset: -2px; }';
        doc.head.appendChild(style);
      }
    } catch(e) {}
  });

  // Track changes via contenteditable
  contentIframe.addEventListener('load', function() {
    try {
      var doc = contentIframe.contentDocument || contentIframe.contentWindow.document;
      doc.addEventListener('input', function() { isDirty = true; });
      // Intercept Ctrl+S inside the iframe so the browser's native "Save As"
      // dialog doesn't open when the user is editing inside the iframe
      doc.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
          e.stopPropagation();
          saveToFile();
        }
      });
    } catch(e) {}
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
  themeBtn.addEventListener('click', function() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', currentTheme);
    themeBtn.textContent = currentTheme === 'light' ? 'Dark' : 'Light';
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
    isDirty = false;
    modeButtons.forEach(function(b) {
      b.classList.toggle('active-mode', b.dataset.mode === mode);
    });

    if (mode === 'view' || mode === 'edit') {
      // Switch to iframe view
      if (sourceWrap.classList.contains('active')) {
        rawHtml = sourceEditor.value;
        renderContentIframe(rawHtml);
      }
      sourceWrap.classList.remove('active');
      contentWrap.style.display = 'block';
      contentWrap.classList.toggle('editing', mode === 'edit');
      try {
        var doc = contentIframe.contentDocument || contentIframe.contentWindow.document;
        if (mode === 'edit') {
          doc.body.contentEditable = 'true';
          doc.designMode = 'on';
        } else {
          doc.body.contentEditable = 'false';
          doc.designMode = 'off';
        }
      } catch(e) {}
    } else if (mode === 'source') {
      try {
        var doc = contentIframe.contentDocument || contentIframe.contentWindow.document;
        rawHtml = doc.documentElement.outerHTML;
      } catch(e) {}
      sourceEditor.value = rawHtml;
      contentWrap.style.display = 'none';
      sourceWrap.classList.add('active');
      renderSourcePreview();
    }
  }

  // Source mode: render preview from textarea
  var sourceRenderTimeout;
  sourceEditor.addEventListener('input', function() {
    isDirty = true;
    clearTimeout(sourceRenderTimeout);
    sourceRenderTimeout = setTimeout(renderSourcePreview, 300);
  });

  // Tab key in source editor
  sourceEditor.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      var start = sourceEditor.selectionStart;
      var end = sourceEditor.selectionEnd;
      sourceEditor.value = sourceEditor.value.substring(0, start) + '\\t' + sourceEditor.value.substring(end);
      sourceEditor.selectionStart = sourceEditor.selectionEnd = start + 1;
    }
  });

  function renderSourcePreview() {
    sourcePreview.srcdoc = prepareHtmlForSrcdoc(sourceEditor.value);
  }

  // File operations
  var downloadBtn = document.getElementById('download-btn');
  saveBtn.addEventListener('click', saveToFile);
  downloadBtn.addEventListener('click', downloadFile);

  function getCurrentContent() {
    if (currentMode === 'source') {
      return sourceEditor.value;
    } else {
      try {
        var doc = contentIframe.contentDocument || contentIframe.contentWindow.document;
        return doc.documentElement.outerHTML;
      } catch(e) {
        return rawHtml;
      }
    }
  }

  // Strip injected elements before save
  function cleanContentForSave(html) {
    html = html.replace(/<base[^>]*data-edit-injected[^>]*>\\n?/gi, '');
    html = html.replace(/<style[^>]*data-edit-injected[^>]*>[\\s\\S]*?<\\/style>\\n?/gi, '');
    html = html.replace(/(<body[^>]*?)\\s+contentEditable="true"/gi, '$1');
    html = html.replace(/(<body[^>]*?)\\s+contenteditable="true"/gi, '$1');
    return html;
  }

  function saveToFile() {
    var content = cleanContentForSave(getCurrentContent());
    if (serverConnected) {
      fetch('http://localhost:' + savePort + '/save-html?file=' + encodeURIComponent(sourceRelPath), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.ok) {
          saveBtn.textContent = 'Synced!';
          isDirty = false;
          setTimeout(function() { saveBtn.textContent = 'Save'; }, 2000);
        } else {
          alert('Save failed: ' + (data.error || 'unknown error'));
        }
      })
      .catch(function() {
        downloadFile();
      });
    } else {
      downloadFile();
    }
  }

  function downloadFile() {
    var content = getCurrentContent();
    var blob = new Blob([content], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = sourceFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
})();
`;

function generateStandaloneEditableHtml(title, sourceFilename, sourceRelPath, baseDir, savePort, initialHtml) {
  const escapedFn = escapeForJs(sourceFilename);
  const escapedRelPath = escapeForJs(sourceRelPath);
  const escapedBaseDir = escapeForJs(baseDir);
  const escapedInitialHtml = initialHtml ? escapeForJs(initialHtml) : "''";
  const jsFilled = STANDALONE_JS
    .replace('{{{{MDHTML_SOURCE_FILE_NAME}}}}', escapedFn)
    .replace('{{{{MDHTML_SOURCE_REL_PATH}}}}', escapedRelPath)
    .replace('{{{{MDHTML_BASE_DIR}}}}', escapedBaseDir)
    .replace('{{{{MDHTML_SAVE_PORT}}}}', String(savePort))
    .replace('{{{{MDHTML_HTML_CONTENT}}}}', escapedInitialHtml);

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `<title>${title}</title>`,
    '<style>',
    STANDALONE_CSS,
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
    '      <button class="mode-btn" data-mode="view">View</button>',
    '      <button class="mode-btn active-mode" data-mode="edit">Edit</button>',
    '      <button class="mode-btn" data-mode="source">Source</button>',
    '    </div>',
    '    <button class="topbar-btn" id="save-btn">Save</button>',
    '    <button class="topbar-btn" id="download-btn">Download</button>',
    '    <button class="topbar-btn" id="theme-toggle">Dark</button>',
    '  </div>',
    '</div>',
    '',
    '<!-- Main content -->',
    '<div class="main-content" id="main-content">',
    '  <!-- View/Edit mode: contenteditable iframe -->',
    '  <div class="content-iframe-wrap" id="content-iframe-wrap">',
    '    <iframe id="content-iframe" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"></iframe>',
    '  </div>',
    '  <!-- Source mode: textarea + preview -->',
    '  <div class="source-wrap" id="source-wrap">',
    '    <div class="source-editor-pane">',
    '      <textarea id="source-editor" spellcheck="false"></textarea>',
    '    </div>',
    '    <div class="source-preview-pane">',
    '      <iframe id="source-preview-iframe" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>',
    '    </div>',
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

module.exports = { STANDALONE_CSS, STANDALONE_JS, generateStandaloneEditableHtml };
const http = require('http');
const path = require('path');
const fs = require('fs');
const { deriveTitle } = require('./utils');
const { generateEditableHtml } = require('./md-edit-templates');

function startCombinedServer(port, rootDir, htmlFilesList, mdHtmlManagerDir, originalHtmlMap) {
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

    // Serve original HTML content for standalone files (for standalone editor template)
    if (req.method === 'GET' && url.pathname === '/raw-html') {
      const filePath = url.searchParams.get('path');
      if (!filePath) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing path parameter');
        return;
      }
      // Use originalHtmlMap for standalone files, or fall back to fileMap
      const fullPath = (originalHtmlMap && originalHtmlMap[filePath]) || fileMap[filePath] || path.join(rootDir, filePath.replace(/\\/g, '/'));
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

    // Save standalone HTML content back to original file
    if (req.method === 'POST' && url.pathname === '/save-html') {
      const htmlRelPath = url.searchParams.get('file');
      if (!htmlRelPath) {
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
          const originalFullPath = (originalHtmlMap && originalHtmlMap[htmlRelPath]) || path.join(rootDir, htmlRelPath.replace(/\\/g, '/'));
          if (!originalFullPath.startsWith(rootDir)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Access denied' }));
            return;
          }
          fs.writeFileSync(originalFullPath, newContent, 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    // Serve static assets from rootDir (for relative URL resolution in standalone HTML)
    if (req.method === 'GET' && url.pathname.startsWith('/asset/')) {
      const assetRelPath = decodeURIComponent(url.pathname.substring('/asset/'.length));
      const assetFullPath = path.join(rootDir, assetRelPath.replace(/\\/g, '/'));
      if (!assetFullPath.startsWith(rootDir)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Access denied');
        return;
      }
      if (!fs.existsSync(assetFullPath) || !fs.statSync(assetFullPath).isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found');
        return;
      }
      try {
        const content = fs.readFileSync(assetFullPath);
        const ext = path.extname(assetFullPath).toLowerCase();
        const mimeTypes = {
          '.html': 'text/html', '.htm': 'text/html',
          '.css': 'text/css', '.js': 'application/javascript',
          '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
          '.gif': 'image/gif', '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon', '.webp': 'image/webp',
          '.woff': 'font/woff', '.woff2': 'font/woff2',
          '.ttf': 'font/ttf', '.eot': 'application/vnd.ms-fontobject',
          '.json': 'application/json', '.xml': 'text/xml',
          '.txt': 'text/plain', '.md': 'text/plain',
          '.pdf': 'application/pdf',
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Read error: ' + e.message);
      }
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

module.exports = { startCombinedServer };
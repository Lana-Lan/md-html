const net = require('net');

function escapeForJs(text) {
  // JSON.stringify handles quotes and special chars, but we must also
  // escape </script> to prevent premature closing of <script> blocks in HTML
  return JSON.stringify(text).replace(/<\/script/gi, '<\\/script');
}

function deriveTitle(mdContent, fallbackTitle) {
  const match = mdContent.match(/^#\s+(.+)/);
  return match ? match[1].trim() : fallbackTitle;
}

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

function getLanguageFromExt(ext) {
  const map = {
    '.java': 'java',
    '.py': 'python',
    '.js': 'javascript',
  };
  return map[ext.toLowerCase()] || '';
}

module.exports = { escapeForJs, deriveTitle, findFreePort, getLanguageFromExt };
const net = require('net');

function escapeForJs(text) {
  return JSON.stringify(text);
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

module.exports = { escapeForJs, deriveTitle, findFreePort };
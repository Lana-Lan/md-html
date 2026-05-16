#!/usr/bin/env node
// Render all Markdown files in a directory (or a single .md file's parent directory)
// into editable, sync-enabled HTML pages, then generate a manager page with sidebar
// navigation. A single combined server handles both content serving and dual-save sync.

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const { deriveTitle, findFreePort } = require('./utils');
const { generateEditableHtml } = require('./md-edit-templates');
const { generateStandaloneEditableHtml } = require('./html-edit-templates');
const { buildTree, treeToHtml, generateManagerHtml, generateStaticManagerHtml } = require('./manager-templates');
const { startCombinedServer } = require('./server');

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

// --- Scan for existing .html files (not derived from .md) ---
function scanHtmlFiles(dir, baseDir, syncedRelPaths) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'md-html-manager') continue;
      const sub = scanHtmlFiles(fullPath, baseDir, syncedRelPaths);
      results.push(...sub);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      // Skip files derived from .md (they're already in syncedHtmlFiles)
      if (syncedRelPaths.has(relPath)) continue;
      // Skip the manager output file itself (will be excluded later)
      results.push({ name: entry.name, relPath, fullPath, syncable: false });
    }
  }
  return results.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

const syncedRelPaths = new Set(syncedHtmlFiles.map(f => f.relPath));
const standaloneHtmlFiles = scanHtmlFiles(rootDir, rootDir, syncedRelPaths);

if (standaloneHtmlFiles.length > 0) {
  console.log(`Found ${standaloneHtmlFiles.length} standalone .html files in "${rootDir}"`);
}

// --- Merge all HTML files for the manager ---
const allHtmlFiles = [...syncedHtmlFiles, ...standaloneHtmlFiles].sort((a, b) => a.relPath.localeCompare(b.relPath));

// --- Determine initial file ---
if (!initialFile) {
  if (isFileInput && mdFiles.find(f => f.fullPath === inputPath)) {
    initialFile = mdFiles.find(f => f.fullPath === inputPath).relPath.replace(/\.md$/i, '.html');
  } else if (allHtmlFiles.length > 0) {
    initialFile = allHtmlFiles[0].relPath;
  }
} else {
  initialFile = initialFile.replace(/\\/g, '/');
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

  // Step 1b: Generate standalone editable HTML for each standalone .html file
  if (standaloneHtmlFiles.length > 0) {
    console.log('\n--- Generating standalone editable HTML files in md-html-manager/_standalone ---');
    const standaloneDir = path.join(mdHtmlManagerDir, '_standalone');
    if (!fs.existsSync(standaloneDir)) {
      fs.mkdirSync(standaloneDir, { recursive: true });
    }
    for (const htmlFile of standaloneHtmlFiles) {
      const htmlContent = fs.readFileSync(htmlFile.fullPath, 'utf8');
      const title = htmlFile.name.replace(/\.html?$/i, '');
      const sourceFilename = htmlFile.name;
      const sourceRelPath = htmlFile.relPath;
      const baseDir = sourceRelPath.includes('/') ? sourceRelPath.substring(0, sourceRelPath.lastIndexOf('/')) : '';
      const placeholderPort = noServer ? 0 : 9999;
      const standaloneOutputPath = path.join(standaloneDir, sourceRelPath);
      const standaloneOutputDir = path.dirname(standaloneOutputPath);
      if (!fs.existsSync(standaloneOutputDir)) {
        fs.mkdirSync(standaloneOutputDir, { recursive: true });
      }
      const wrappedHtml = generateStandaloneEditableHtml(title, sourceFilename, sourceRelPath, baseDir, placeholderPort, noServer ? htmlContent : '');
      fs.writeFileSync(standaloneOutputPath, wrappedHtml, 'utf8');
      console.log(`  ${sourceRelPath} -> md-html-manager/_standalone/${sourceRelPath}`);
    }
  }

  // Step 2: Re-scan for all html files now (including newly generated ones + standalone ones)
  // This ensures the manager list is complete and excludes index-manager.html
  const managerOutputPath = outputPath || path.join(mdHtmlManagerDir, 'index.manager.html');
  const managerRelPath = path.relative(rootDir, managerOutputPath).replace(/\\/g, '/');

  // Refresh standalone scan to pick up newly generated files and exclude the manager itself
  const freshSyncedRelPaths = new Set(syncedHtmlFiles.map(f => f.relPath));
  const originalStandaloneFiles = scanHtmlFiles(rootDir, rootDir, freshSyncedRelPaths)
    .filter(f => f.relPath !== managerRelPath);

  // Build originalHtmlMap for server (relPath -> original fullPath for standalone files)
  const originalHtmlMap = {};
  for (const f of originalStandaloneFiles) {
    originalHtmlMap[f.relPath] = f.fullPath;
  }

  // Map standalone files to their wrapped versions in _standalone/ (now editable)
  const freshStandaloneHtmlFiles = originalStandaloneFiles.map(f => ({
    ...f,
    fullPath: path.join(mdHtmlManagerDir, '_standalone', f.relPath),
    syncable: true
  }));

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

    // Regenerate each standalone editable HTML with the actual server port
    if (freshStandaloneHtmlFiles.length > 0) {
      console.log('\n--- Updating standalone HTML files with server port ' + chosenPort + ' ---');
      for (const f of freshStandaloneHtmlFiles) {
        const originalPath = originalHtmlMap[f.relPath];
        const htmlContent = fs.readFileSync(originalPath, 'utf8');
        const title = f.name.replace(/\.html?$/i, '');
        const baseDir = f.relPath.includes('/') ? f.relPath.substring(0, f.relPath.lastIndexOf('/')) : '';
        const wrappedHtml = generateStandaloneEditableHtml(title, f.name, f.relPath, baseDir, chosenPort, '');
        const standaloneOutputPath = path.join(mdHtmlManagerDir, '_standalone', f.relPath);
        const standaloneOutputDir = path.dirname(standaloneOutputPath);
        if (!fs.existsSync(standaloneOutputDir)) {
          fs.mkdirSync(standaloneOutputDir, { recursive: true });
        }
        fs.writeFileSync(standaloneOutputPath, wrappedHtml, 'utf8');
      }
    }
  }

  // Step 5: Generate manager HTML
  let managerHtmlContent;

  if (noServer) {
    managerHtmlContent = generateStaticManagerHtml(allHtmlFilesForManager, sidebarHtml, initialFile, allHtmlFilesForManager.length, noServer);
  } else {
    managerHtmlContent = generateManagerHtml(chosenPort, allHtmlFilesForManager, sidebarHtml, initialFile, allHtmlFilesForManager.length, noServer);
  }

  fs.writeFileSync(managerOutputPath, managerHtmlContent, 'utf8');
  console.log(`\n--- Manager page generated ---`);
  console.log(`  ${managerOutputPath}`);

  // Step 6: Start combined server (if not --no-server)
  if (!noServer) {
    const server = startCombinedServer(chosenPort, rootDir, allHtmlFilesForManager, mdHtmlManagerDir, originalHtmlMap);
    console.log('\n--- Combined server started ---');
    console.log(`  Content serving + dual-save sync on http://localhost:${chosenPort}`);
    const syncCount = syncedHtmlFiles.length;
    const staticCount = freshStandaloneHtmlFiles.length;
    console.log(`\nOpen ${managerOutputPath} in a browser to browse and edit ${allHtmlFilesForManager.length} HTML files (${syncCount} from .md, ${staticCount} standalone).`);
    console.log(`Ctrl+S saves edits: .md files sync to both .md + .html, standalone .html files sync to original file.`);
    console.log(`Close this terminal to stop the server.`);

    // Auto-open manager in browser
    const managerAbsPath = path.resolve(managerOutputPath);
    const openCmd = process.platform === 'win32' ? `start "" "${managerAbsPath}"` :
                    process.platform === 'darwin' ? `open "${managerAbsPath}"` :
                    `xdg-open "${managerAbsPath}"`;
    exec(openCmd, (err) => {
      if (err) console.warn('Could not auto-open browser: ' + err.message);
    });

    process.on('SIGINT', () => {
      server.close();
      console.log('\nServer stopped.');
      process.exit(0);
    });

    setInterval(() => {}, 60000);
  } else {
    const syncCount = syncedHtmlFiles.length;
    const staticCount = freshStandaloneHtmlFiles.length;
    console.log(`\nOpen ${managerOutputPath} in a browser to browse ${allHtmlFilesForManager.length} HTML files (${syncCount} from .md, ${staticCount} standalone).`);
    console.log(`Tip: Without --no-server, Ctrl+S syncs edits automatically — .md files to both .md + .html, standalone .html to original file.`);

    // Auto-open manager in browser
    const managerAbsPath = path.resolve(managerOutputPath);
    const openCmd = process.platform === 'win32' ? `start "" "${managerAbsPath}"` :
                    process.platform === 'darwin' ? `open "${managerAbsPath}"` :
                    `xdg-open "${managerAbsPath}"`;
    exec(openCmd, (err) => {
      if (err) console.warn('Could not auto-open browser: ' + err.message);
    });
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
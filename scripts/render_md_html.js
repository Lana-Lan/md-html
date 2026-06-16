#!/usr/bin/env node
// Render all Markdown files in a directory (or a single .md file's parent directory)
// into editable, sync-enabled HTML pages, then generate a manager page with sidebar
// navigation. A single combined server handles both content serving and dual-save sync.

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const { deriveTitle, findFreePort, getLanguageFromExt } = require('./utils');
const { generateEditableHtml } = require('./md-edit-templates');
const { generateStandaloneEditableHtml } = require('./html-edit-templates');
const { generateCodeEditableHtml } = require('./code-edit-templates');
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

// --- Scan for source code files (.java, .py, .js) ---
const CODE_EXTENSIONS = ['.java', '.py', '.js'];

function scanCodeFiles(dir, baseDir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'md-html-manager') continue;
      const sub = scanCodeFiles(fullPath, baseDir);
      results.push(...sub);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (CODE_EXTENSIONS.includes(ext)) {
        const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        results.push({ name: entry.name, relPath, fullPath, ext });
      }
    }
  }
  return results.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

const srcCodeFiles = scanCodeFiles(rootDir, rootDir);

if (mdFiles.length === 0 && srcCodeFiles.length === 0 && !fs.readdirSync(rootDir).some(e => e.toLowerCase().endsWith('.html'))) {
  console.error(`No .md, source code (.java/.py/.js), or .html files found in "${rootDir}" or its subdirectories.`);
  process.exit(1);
}

if (mdFiles.length > 0) {
  console.log(`Found ${mdFiles.length} .md files in "${rootDir}"`);
}

if (srcCodeFiles.length > 0) {
  console.log(`Found ${srcCodeFiles.length} source code files (.java/.py/.js) in "${rootDir}"`);
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
function scanHtmlFiles(dir, baseDir, syncedRelPaths, codeRelPaths) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'md-html-manager') continue;
      const sub = scanHtmlFiles(fullPath, baseDir, syncedRelPaths, codeRelPaths);
      results.push(...sub);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      // Skip files derived from .md (they're already in syncedHtmlFiles)
      if (syncedRelPaths.has(relPath)) continue;
      // Skip files derived from source code (.java/.py/.js)
      if (codeRelPaths && codeRelPaths.has(relPath)) continue;
      // Skip the manager output file itself (will be excluded later)
      results.push({ name: entry.name, relPath, fullPath, syncable: false });
    }
  }
  return results.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

// --- Compute output HTML paths for each source code file ---
const syncedCodeHtmlFiles = srcCodeFiles.map(src => {
  const htmlRelPath = src.relPath.replace(/\.(java|py|js)$/i, '.html');
  const htmlFullPath = path.join(mdHtmlManagerDir, '_code', htmlRelPath);
  const codeLanguage = getLanguageFromExt(src.ext);
  // relPath uses _code/ prefix for physical file location (avoids naming conflicts with .md-derived HTML)
  // displayRelPath uses original source path so code files appear at their original directory position in sidebar
  return {
    srcRelPath: src.relPath,
    srcFullPath: src.fullPath,
    name: path.basename(htmlFullPath),
    displayName: src.name,
    relPath: '_code/' + htmlRelPath,
    displayRelPath: src.relPath,
    fullPath: htmlFullPath,
    syncable: true,
    codeLanguage: codeLanguage,
    isCodeFile: true
  };
});

// codeHtmlNames: flat HTML names that source code files would produce (e.g. "index.html")
// These are excluded from standalone .html file scan to prevent naming conflicts
const codeHtmlNames = new Set(srcCodeFiles.map(src => src.relPath.replace(/\.(java|py|js)$/i, '.html')));

const syncedRelPaths = new Set(syncedHtmlFiles.map(f => f.relPath));
const standaloneHtmlFiles = scanHtmlFiles(rootDir, rootDir, syncedRelPaths, codeHtmlNames);

if (standaloneHtmlFiles.length > 0) {
  console.log(`Found ${standaloneHtmlFiles.length} standalone .html files in "${rootDir}"`);
}

// --- Merge all HTML files for the manager ---
const allHtmlFiles = [...syncedHtmlFiles, ...syncedCodeHtmlFiles, ...standaloneHtmlFiles].sort((a, b) => (a.displayRelPath || a.relPath).localeCompare(b.displayRelPath || b.relPath));

// --- Determine initial file (using display path for sidebar) ---
if (!initialFile) {
  if (isFileInput && mdFiles.find(f => f.fullPath === inputPath)) {
    initialFile = mdFiles.find(f => f.fullPath === inputPath).relPath.replace(/\.md$/i, '.html');
  } else if (isFileInput && srcCodeFiles.find(f => f.fullPath === inputPath)) {
    const srcFile = srcCodeFiles.find(f => f.fullPath === inputPath);
    initialFile = srcFile.relPath;  // display path = original source path (e.g., render_js.js)
  } else if (allHtmlFiles.length > 0) {
    initialFile = allHtmlFiles[0].displayRelPath || allHtmlFiles[0].relPath;
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

  // Step 1c: Generate editable HTML for each source code file (.java/.py/.js)
  if (srcCodeFiles.length > 0) {
    console.log('\n--- Generating source code HTML files in md-html-manager/_code ---');
    const codeDir = path.join(mdHtmlManagerDir, '_code');
    if (!fs.existsSync(codeDir)) {
      fs.mkdirSync(codeDir, { recursive: true });
    }
    for (const src of srcCodeFiles) {
      const srcContent = fs.readFileSync(src.fullPath, 'utf8');
      const codeLanguage = getLanguageFromExt(src.ext);
      const fallbackTitle = path.basename(src.fullPath, path.extname(src.fullPath));
      const sourceFilename = path.basename(src.fullPath);
      const srcRelPath = src.relPath;

      const htmlRelPath = srcRelPath.replace(/\.(java|py|js)$/i, '.html');
      const htmlOutputPath = path.join(codeDir, htmlRelPath);
      const htmlOutputDir = path.dirname(htmlOutputPath);
      if (!fs.existsSync(htmlOutputDir)) {
        fs.mkdirSync(htmlOutputDir, { recursive: true });
      }

      const placeholderPort = noServer ? 0 : 9999;

      const htmlContent = generateCodeEditableHtml(srcContent, fallbackTitle, sourceFilename, srcRelPath, codeLanguage, placeholderPort);
      fs.writeFileSync(htmlOutputPath, htmlContent, 'utf8');
      console.log(`  ${srcRelPath} -> md-html-manager/_code/${htmlRelPath}`);
    }
  }

  // Step 2: Re-scan for all html files now (including newly generated ones + standalone ones)
  // This ensures the manager list is complete and excludes index-manager.html
  const managerOutputPath = outputPath || path.join(mdHtmlManagerDir, 'index.manager.html');
  const managerRelPath = path.relative(rootDir, managerOutputPath).replace(/\\/g, '/');

  // Refresh standalone scan to pick up newly generated files and exclude the manager itself
  const freshSyncedRelPaths = new Set(syncedHtmlFiles.map(f => f.relPath));
  const freshCodeHtmlNames = new Set(srcCodeFiles.map(src => src.relPath.replace(/\.(java|py|js)$/i, '.html')));
  const originalStandaloneFiles = scanHtmlFiles(rootDir, rootDir, freshSyncedRelPaths, freshCodeHtmlNames)
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

  // Map source code files to their HTML versions in _code/ (editable)
  const freshCodeHtmlFiles = syncedCodeHtmlFiles.map(f => ({
    ...f,
    fullPath: f.fullPath,
    syncable: true
  }));

  // Build srcCodeFilesMap and codeLangMap for server
  const srcCodeFilesMap = {};
  const codeLangMap = {};
  for (const src of srcCodeFiles) {
    srcCodeFilesMap[src.relPath] = src.fullPath;
    codeLangMap[src.relPath] = getLanguageFromExt(src.ext);
  }

  const allHtmlFilesForManager = [...syncedHtmlFiles, ...freshCodeHtmlFiles, ...freshStandaloneHtmlFiles].sort((a, b) => (a.displayRelPath || a.relPath).localeCompare(b.displayRelPath || b.relPath));

  if (allHtmlFilesForManager.length === 0) {
    console.error('No HTML files to manage.');
    process.exit(1);
  }

  console.log(`\n--- Total HTML files for manager: ${allHtmlFilesForManager.length} (${syncedHtmlFiles.length} from .md, ${freshCodeHtmlFiles.length} from source code, ${freshStandaloneHtmlFiles.length} standalone) ---`);

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

    // Regenerate each source code editable HTML with the actual server port
    if (srcCodeFiles.length > 0) {
      console.log('\n--- Updating source code HTML files with server port ' + chosenPort + ' ---');
      const codeDir = path.join(mdHtmlManagerDir, '_code');
      for (const src of srcCodeFiles) {
        const srcContent = fs.readFileSync(src.fullPath, 'utf8');
        const codeLanguage = getLanguageFromExt(src.ext);
        const fallbackTitle = path.basename(src.fullPath, path.extname(src.fullPath));
        const sourceFilename = path.basename(src.fullPath);
        const srcRelPath = src.relPath;
        const htmlRelPath = srcRelPath.replace(/\.(java|py|js)$/i, '.html');
        const htmlOutputPath = path.join(codeDir, htmlRelPath);
        const htmlOutputDir = path.dirname(htmlOutputPath);
        if (!fs.existsSync(htmlOutputDir)) {
          fs.mkdirSync(htmlOutputDir, { recursive: true });
        }

        const htmlContent = generateCodeEditableHtml(srcContent, fallbackTitle, sourceFilename, srcRelPath, codeLanguage, chosenPort);
        fs.writeFileSync(htmlOutputPath, htmlContent, 'utf8');
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
    const server = startCombinedServer(chosenPort, rootDir, allHtmlFilesForManager, mdHtmlManagerDir, originalHtmlMap, srcCodeFilesMap, codeLangMap);
    console.log('\n--- Combined server started ---');
    console.log(`  Content serving + dual-save sync on http://localhost:${chosenPort}`);
    const syncCount = syncedHtmlFiles.length;
    const codeCount = srcCodeFiles.length;
    const staticCount = freshStandaloneHtmlFiles.length;
    console.log(`\nOpen ${managerOutputPath} in a browser to browse and edit ${allHtmlFilesForManager.length} HTML files (${syncCount} from .md, ${codeCount} from source code, ${staticCount} standalone).`);
    console.log(`Ctrl+S saves edits: .md files sync to both .md + .html, source code files sync to original file + .html, standalone .html files sync to original file.`);
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
    const codeCount = srcCodeFiles.length;
    const staticCount = freshStandaloneHtmlFiles.length;
    console.log(`\nOpen ${managerOutputPath} in a browser to browse ${allHtmlFilesForManager.length} HTML files (${syncCount} from .md, ${codeCount} from source code, ${staticCount} standalone).`);
    console.log(`Tip: Without --no-server, Ctrl+S syncs edits automatically — .md files to both .md + .html, source code files to original + .html, standalone .html to original file.`);

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
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('--- PROCESSING NEW LOGO ---');

const srcPng = 'C:/Users/douglas/.gemini/antigravity-ide/brain/03493d7d-2146-4984-9663-834966630400/.user_uploaded/media_1792275364854.png';
const pluginLogoDir = 'D:/Projetos/Meu ACM/plugin_rebuild/GOACM/lib/Logo';
const portalPublicDir = 'D:/Projetos/Meu ACM/portal/public';

const pngBuf = fs.readFileSync(srcPng);
const pngBase64 = pngBuf.toString('base64');

// Copy PNG files
fs.copyFileSync(srcPng, path.join(portalPublicDir, 'acmgo-logo.png'));
fs.copyFileSync(srcPng, path.join(portalPublicDir, 'goacm-logo.png'));
fs.copyFileSync(srcPng, path.join(pluginLogoDir, 'acmgo-logo.png'));
fs.copyFileSync(srcPng, path.join(pluginLogoDir, 'LogotipoACMGO.png'));
fs.copyFileSync(srcPng, path.join(pluginLogoDir, 'LogotipoGOACM.png'));
console.log('1. Copied PNG logo files');

// Generate SVG with embedded clean image & viewBox
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 21" width="100%" height="100%" role="img" aria-label="ACMGO">
  <image width="96" height="21" href="data:image/png;base64,${pngBase64}" />
</svg>
`;

fs.writeFileSync(path.join(portalPublicDir, 'acmgo-logo.svg'), svg, 'utf8');
fs.writeFileSync(path.join(portalPublicDir, 'goacm-logo.svg'), svg, 'utf8');
fs.writeFileSync(path.join(pluginLogoDir, 'LogotipoACMGO.svg'), svg, 'utf8');
fs.writeFileSync(path.join(pluginLogoDir, 'LogotipoGOACM.svg'), svg, 'utf8');
console.log('2. Created SVG logo files');

// Update Favicon with the new logo
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#0f172a" />
  <image x="1" y="8" width="30" height="16" href="data:image/png;base64,${pngBase64}" />
</svg>
`;
fs.writeFileSync(path.join(portalPublicDir, 'favicon.svg'), faviconSvg, 'utf8');
console.log('3. Updated favicon.svg');

// Check portal files using logo
const authShell = 'D:/Projetos/Meu ACM/portal/src/components/AuthShell.tsx';
if (fs.existsSync(authShell)) {
  let content = fs.readFileSync(authShell, 'utf8');
  content = content.replace(/alt="GOACM"/g, 'alt="ACMGO"');
  content = content.replace(/aria-label="GOACM"/g, 'aria-label="ACMGO"');
  fs.writeFileSync(authShell, content, 'utf8');
  console.log('4. Updated AuthShell.tsx');
}

// Update ui_theme.rb logo css to fit ratio 96/21 (~4.57)
const uiThemePath = 'D:/Projetos/Meu ACM/plugin_rebuild/GOACM/lib/ui_theme.rb';
let uiTheme = fs.readFileSync(uiThemePath, 'utf8');
// The aspect ratio of 96x21 is 4.57:1. In height 18px, width is ~82px. In height 24px, width is ~110px.
fs.writeFileSync(uiThemePath, uiTheme, 'utf8');

// Update publish_dialog.rb logo sizing if needed
const pubDialogPath = 'D:/Projetos/Meu ACM/plugin_rebuild/GOACM/lib/publish_dialog.rb';
let pubDialog = fs.readFileSync(pubDialogPath, 'utf8');
pubDialog = pubDialog.replace(/\.tbar \.acm-logo \{ width: \d+px; height: \d+px; \}/g, '.tbar .acm-logo { width: 96px; height: 21px; }');
fs.writeFileSync(pubDialogPath, pubDialog, 'utf8');
console.log('5. Adjusted logo proportions in dialogs');

// Bump to 1.1.43
const versionRbPath = 'D:/Projetos/Meu ACM/plugin_rebuild/GOACM/lib/version.rb';
let versionRb = fs.readFileSync(versionRbPath, 'utf8');
versionRb = versionRb.replace(/VERSION\s*=\s*"[^"]+"/, 'VERSION = "1.1.43"');
fs.writeFileSync(versionRbPath, versionRb, 'utf8');

const loaderPath = 'D:/Projetos/Meu ACM/plugin_rebuild/GOACM.rb';
let loader = fs.readFileSync(loaderPath, 'utf8');
loader = loader.replace(/PLUGIN_VERSION\s*=\s*"[^"]+"/, 'PLUGIN_VERSION = "1.1.43"');
fs.writeFileSync(loaderPath, loader, 'utf8');
console.log('6. Bumped version to 1.1.43');

// Rebuild package
console.log('7. Building package GOACM-1.1.43.rbz...');
const buildOut = execSync('powershell -ExecutionPolicy Bypass -File "D:/Projetos/Meu ACM/plugin_rebuild/build-test-package.ps1"', {
  encoding: 'utf8',
  cwd: 'D:/Projetos/Meu ACM/plugin_rebuild'
});
console.log(buildOut);

const distTest = 'D:/Projetos/Meu ACM/plugin_rebuild/dist/GOACM-1.1.43-test.rbz';
const distProd = 'D:/Projetos/Meu ACM/plugin_rebuild/dist/GOACM-1.1.43.rbz';
fs.copyFileSync(distTest, distProd);
console.log('8. Package created:', distProd);

// Sync to local SketchUp 2024
const suDir = path.join(process.env.APPDATA || '', 'SketchUp/SketchUp 2024/SketchUp/Plugins');
if (fs.existsSync(suDir)) {
  const targetGoacm = path.join(suDir, 'GOACM');
  fs.cpSync('D:/Projetos/Meu ACM/plugin_rebuild/GOACM', targetGoacm, { recursive: true });
  fs.copyFileSync(loaderPath, path.join(suDir, 'GOACM.rb'));
  console.log('9. Synced to SketchUp plugins folder:', suDir);
}

// Publish to Supabase
async function publish() {
  const fileBytes = fs.readFileSync(distProd);
  const base64Data = fileBytes.toString('base64');
  console.log(`10. Publishing v1.1.43 (${fileBytes.length} bytes) to Supabase...`);

  const payload = {
    action: 'publish_base64',
    version: '1.1.43',
    file_name: 'GOACM-1.1.43.rbz',
    file_base64: base64Data,
    notes: 'Atualização oficial v1.1.43: Novo logotipo oficial ACMGO integrado no portal e no plugin do SketchUp.',
    min_sketchup_version: '2021',
    is_mandatory: false
  };

  const response = await fetch('https://dqwrxsbekfeyzbzvnubg.supabase.co/functions/v1/plugin-version', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-publish-key': 'goacm-release-sync-2026'
    },
    body: JSON.stringify(payload)
  });

  const resJson = await response.json();
  console.log('Publish result:', resJson);
}

publish().catch(err => console.error('Publish error:', err));

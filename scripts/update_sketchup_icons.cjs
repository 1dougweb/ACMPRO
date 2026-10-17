const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('--- UPDATING SKETCHUP LOGO AND ICON ---');

const portalPublic = 'D:/Projetos/Meu ACM/portal/public';
const pluginRoot = 'D:/Projetos/Meu ACM/plugin_rebuild';
const pluginDir = 'D:/Projetos/Meu ACM/plugin_rebuild/GOACM';

// 1. Read favicon.svg content
const faviconRaw = fs.readFileSync(path.join(portalPublic, 'favicon.svg'), 'utf8');

// Create toolbar_live.svg centered in square viewBox
const toolbarLiveSvg = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" width="48px" height="48px" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd"
viewBox="0 0 102 102">
 <g id="Camada_x0020_1" transform="translate(0, 26.6)">
  <path fill="#089F6F" fill-rule="nonzero" d="M80.06 0.09c6.72,0 12.52,2.72 16.46,7.13 3.94,4.41 6.03,10.49 5.32,17.21 -0.71,6.72 -4.07,12.81 -8.94,17.21 -4.87,4.41 -11.24,7.13 -17.97,7.13 -6.72,0 -12.52,-2.72 -16.46,-7.13 -3.94,-4.41 -6.03,-10.49 -5.32,-17.21 0.71,-6.72 4.07,-12.81 8.94,-17.21 4.87,-4.41 11.24,-7.13 17.97,-7.13zm8.16 14.64c-2.22,-2.48 -5.49,-4.02 -9.28,-4.02 -3.79,0 -7.38,1.53 -10.12,4.02 -2.74,2.48 -4.64,5.91 -5.04,9.7 -0.4,3.79 0.78,7.22 3,9.7 2.22,2.48 5.49,4.02 9.28,4.02 3.79,0 7.38,-1.53 10.12,-4.02 2.74,-2.48 4.64,-5.91 5.04,-9.7 0.4,-3.79 -0.78,-7.22 -3,-9.7z"/>
  <path fill="#089F6F" fill-rule="nonzero" d="M43.64 48.77c-0.11,0 -0.21,0.01 -0.32,0.01l-15.61 0c-6.73,0 -12.54,-2.73 -16.49,-7.14 -3.95,-4.41 -6.04,-10.51 -5.33,-17.24 0.3,-2.81 1.05,-5.5 2.19,-8.01l-8.08 0 1.29 -1.97 7.79 0 12.09 0 3.58 0c-0.72,0.45 -1.4,0.96 -2.03,1.53 -2.39,2.16 -4.04,5.15 -4.39,8.46 -0.35,3.3 0.68,6.29 2.61,8.46 1.94,2.16 4.78,3.5 8.09,3.5l10.62 0 0.91 -8.63c0.33,-3.09 3.1,-5.6 6.19,-5.6 3.09,0 5.34,2.51 5.01,5.6l-1.56 14.84 -0.07 0.62c-0.33,3.09 -3.1,5.6 -6.19,5.6 -0.1,0 -0.2,-0 -0.3,-0.01zm-33.36 -36.34c1.3,-1.94 2.84,-3.72 4.57,-5.29 4.88,-4.41 11.26,-7.14 18,-7.14l15.51 0c3.43,0 5.92,2.78 5.56,6.22 -0.36,3.43 -3.44,6.22 -6.87,6.22l-7.75 0 -7.75 0 -21.26 0z"/>
 </g>
</svg>
`;

// Write toolbar_live.svg
const iconsDir = path.join(pluginDir, 'lib/icons');
fs.writeFileSync(path.join(iconsDir, 'toolbar_live.svg'), toolbarLiveSvg, 'utf8');
fs.writeFileSync(path.join(iconsDir, 'favicon.svg'), faviconRaw, 'utf8');
console.log('1. Updated toolbar_live.svg with favicon vector');

// 2. Read logo-acmgo.svg content
const logoSvg = fs.readFileSync(path.join(portalPublic, 'logo-acmgo.svg'), 'utf8');
const logoDir = path.join(pluginDir, 'lib/Logo');
fs.writeFileSync(path.join(logoDir, 'LogotipoACMGO.svg'), logoSvg, 'utf8');
fs.writeFileSync(path.join(logoDir, 'LogotipoGOACM.svg'), logoSvg, 'utf8');
fs.writeFileSync(path.join(logoDir, 'logo-acmgo.svg'), logoSvg, 'utf8');
fs.writeFileSync(path.join(logoDir, 'favicon.svg'), faviconRaw, 'utf8');
console.log('2. Updated LogotipoACMGO.svg and LogotipoGOACM.svg with vector logo');

// 3. Bump version to 1.1.44
const versionRbPath = path.join(pluginDir, 'lib/version.rb');
let versionRb = fs.readFileSync(versionRbPath, 'utf8');
versionRb = versionRb.replace(/VERSION\s*=\s*"[^"]+"/, 'VERSION = "1.1.44"');
fs.writeFileSync(versionRbPath, versionRb, 'utf8');

const loaderPath = path.join(pluginRoot, 'GOACM.rb');
let loader = fs.readFileSync(loaderPath, 'utf8');
loader = loader.replace(/PLUGIN_VERSION\s*=\s*"[^"]+"/, 'PLUGIN_VERSION = "1.1.44"');
fs.writeFileSync(loaderPath, loader, 'utf8');
console.log('3. Bumped version to 1.1.44');

// 4. Build package
console.log('4. Compiling package via build-test-package.ps1...');
const buildOut = execSync('powershell -ExecutionPolicy Bypass -File "D:/Projetos/Meu ACM/plugin_rebuild/build-test-package.ps1"', {
  encoding: 'utf8',
  cwd: pluginRoot
});
console.log(buildOut);

const distTest = path.join(pluginRoot, 'dist/GOACM-1.1.44-test.rbz');
const distProd = path.join(pluginRoot, 'dist/GOACM-1.1.44.rbz');
fs.copyFileSync(distTest, distProd);
console.log('5. Created package:', distProd);

// 5. Sync to SketchUp plugins folder
const suDir = path.join(process.env.APPDATA || '', 'SketchUp/SketchUp 2024/SketchUp/Plugins');
if (fs.existsSync(suDir)) {
  const targetGoacm = path.join(suDir, 'GOACM');
  fs.cpSync(pluginDir, targetGoacm, { recursive: true });
  fs.copyFileSync(loaderPath, path.join(suDir, 'GOACM.rb'));
  console.log('6. Synced to SketchUp 2024 Plugins folder:', suDir);
}

// 6. Publish to Supabase
async function publish() {
  const fileBytes = fs.readFileSync(distProd);
  const base64Data = fileBytes.toString('base64');
  console.log(`7. Publishing v1.1.44 (${fileBytes.length} bytes) to Supabase...`);

  const payload = {
    action: 'publish_base64',
    version: '1.1.44',
    file_name: 'GOACM-1.1.44.rbz',
    file_base64: base64Data,
    notes: 'Atualização oficial v1.1.44: Ícone da barra de ferramentas do SketchUp e logotipos oficiais atualizados com o novo favicon.svg.',
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

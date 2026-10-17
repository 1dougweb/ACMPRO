const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('--- STARTING ACMGO REBRAND & UI ENHANCEMENT ---');

const pluginDir = 'D:/Projetos/Meu ACM/plugin_rebuild/GOACM';
const rootDir = 'D:/Projetos/Meu ACM/plugin_rebuild';
const portalDir = 'D:/Projetos/Meu ACM/portal';

// 1. Update Logotipo SVG (ACMGO: ACM in #0F172A, GO in Emerald gradient)
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 76" role="img" aria-labelledby="title">
  <title id="title">ACMGO</title>
  <defs>
    <linearGradient id="supabaseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10B981" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
  </defs>
  <text x="0" y="61" fill="#0F172A" font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="62" font-weight="800" letter-spacing="-3">ACM</text>
  <text x="135" y="61" fill="url(#supabaseGrad)" font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="62" font-weight="900" letter-spacing="-3">GO</text>
</svg>
`;

fs.writeFileSync(path.join(pluginDir, 'lib/Logo/LogotipoGOACM.svg'), svgContent, 'utf8');
fs.writeFileSync(path.join(pluginDir, 'lib/Logo/LogotipoACMGO.svg'), svgContent, 'utf8');
fs.writeFileSync(path.join(portalDir, 'public/goacm-logo.svg'), svgContent, 'utf8');
fs.writeFileSync(path.join(portalDir, 'public/acmgo-logo.svg'), svgContent, 'utf8');
console.log('1. Updated logos to ACMGO');

// 2. Update UITheme (ui_theme.rb)
const uiThemePath = path.join(pluginDir, 'lib/ui_theme.rb');
let uiTheme = fs.readFileSync(uiThemePath, 'utf8');

// Update Tokens in ui_theme.rb
uiTheme = uiTheme.replace(/--radius-tag:\s*\d+px;/, '--radius-tag: 6px;');
uiTheme = uiTheme.replace(/--radius-badge:\s*\d+px;/, '--radius-badge: 6px;');
uiTheme = uiTheme.replace(/--radius-button:\s*\d+px;/, '--radius-button: 8px;');
uiTheme = uiTheme.replace(/--radius-control:\s*\d+px;/, '--radius-control: 8px;');
uiTheme = uiTheme.replace(/--radius-module:\s*\d+px;/, '--radius-module: 10px;');
uiTheme = uiTheme.replace(/--radius-card:\s*\d+px;/, '--radius-card: 10px;');
uiTheme = uiTheme.replace(/--radius-panel:\s*\d+px;/, '--radius-panel: 12px;');
uiTheme = uiTheme.replace(/--font-ui:\s*"[^"]+";/, '--font-ui: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;');
uiTheme = uiTheme.replace(/--shadow-card:\s*[^;]+;/, '--shadow-card: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03);');
uiTheme = uiTheme.replace(/--shadow-panel:\s*[^;]+;/, '--shadow-panel: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03);');

// Enhance HUB_SKIN with website feel
const customHubSkinAddition = `
      /* ═══ ACMGO Modern Portal Aesthetics ═══ */
      * { box-sizing: border-box; }
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: var(--page-bg); }
      ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }
      ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

      .section, .card, .panel {
        background: var(--surface) !important;
        border: 1px solid var(--border) !important;
        border-radius: var(--radius-card) !important;
        box-shadow: var(--shadow-card) !important;
      }

      .btn, .btn-mini, button {
        border-radius: var(--radius-button) !important;
        font-family: var(--font-ui) !important;
        font-weight: 600 !important;
        transition: all 0.15s ease !important;
      }

      .btn-pri, #hubpage_flat .btn-pri, .hub-publish {
        background: linear-gradient(180deg, #10b981 0%, #059669 100%) !important;
        color: #ffffff !important;
        border: 1px solid #059669 !important;
        box-shadow: 0 1px 3px rgba(16, 185, 129, 0.35) !important;
      }
      .btn-pri:hover, #hubpage_flat .btn-pri:hover, .hub-publish:hover {
        background: #059669 !important;
        box-shadow: 0 2px 6px rgba(16, 185, 129, 0.45) !important;
        border-color: #047857 !important;
      }

      .btn-sec, #hubpage_flat .btn-sec {
        background: #ffffff !important;
        border: 1px solid var(--border) !important;
        color: #334155 !important;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04) !important;
      }
      .btn-sec:hover, #hubpage_flat .btn-sec:hover {
        background: var(--page-bg) !important;
        border-color: var(--border-hover, #cbd5e1) !important;
        color: #0f172a !important;
      }

      input[type=text], input[type=number], select, textarea {
        border: 1px solid var(--border) !important;
        border-radius: var(--radius-control) !important;
        background: #ffffff !important;
        font-family: var(--font-ui) !important;
        transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
      }
      input[type=text]:focus, input[type=number]:focus, select:focus, textarea:focus {
        border-color: var(--focus-ring, #10b981) !important;
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.20) !important;
        outline: none !important;
      }
`;

if (!uiTheme.includes('ACMGO Modern Portal Aesthetics')) {
  uiTheme = uiTheme.replace('HUB_SKIN = <<~\'CSS\'.freeze', 'HUB_SKIN = <<~\'CSS\'.freeze' + customHubSkinAddition);
}

fs.writeFileSync(uiThemePath, uiTheme, 'utf8');
console.log('2. Enhanced ui_theme.rb with modern portal styling');

// 3. Update Construtor Hub (construtor_hub.rb)
const hubPath = path.join(pluginDir, 'lib/construtor_hub.rb');
let hub = fs.readFileSync(hubPath, 'utf8');
hub = hub.replace(/<span class="hub-brand hub-brand--logo">ACM<span class="hub-brand-360">360<\/span><\/span>/g, '<span class="hub-brand hub-brand--logo">ACM<span style="color:#10b981;font-weight:900;">GO</span></span>');
hub = hub.replace(/<span class="hub-brand hub-brand--logo">GOACM<\/span>/g, '<span class="hub-brand hub-brand--logo">ACM<span style="color:#10b981;font-weight:900;">GO</span></span>');
hub = hub.replace(/dialog_title:\s*I18n\.t\('hub\.window_title'\)/g, 'dialog_title: "ACMGO - Construtor"');
fs.writeFileSync(hubPath, hub, 'utf8');
console.log('3. Updated construtor_hub.rb branding');

// 4. Update Main.rb
const mainPath = path.join(pluginDir, 'main.rb');
let main = fs.readFileSync(mainPath, 'utf8');
main = main.replace(/toolbar = UI::Toolbar\.new\("GOACM"\)/g, 'toolbar = UI::Toolbar.new("ACMGO")');
main = main.replace(/menu = UI\.menu\("Plugins"\)\.add_submenu\("GOACM"\)/g, 'menu = UI.menu("Plugins").add_submenu("ACMGO")');
main = main.replace(/menu = UI\.menu\('Plugins'\)\.add_submenu\('GOACM'\)/g, 'menu = UI.menu("Plugins").add_submenu("ACMGO")');
fs.writeFileSync(mainPath, main, 'utf8');
console.log('4. Updated main.rb menu and toolbar to ACMGO');

// 5. Update Dialogs (dialogs.rb, live_settings_dialog.rb, publish_dialog.rb, live_html_panel.rb, name_prompt.rb, project_views.rb)
const dialogsRbPath = path.join(pluginDir, 'lib/dialogs.rb');
let dialogsRb = fs.readFileSync(dialogsRbPath, 'utf8');
dialogsRb = dialogsRb.replace(/dialog_title:\s*"GOACM/g, 'dialog_title: "ACMGO');
dialogsRb = dialogsRb.replace(/alt="GOACM"/g, 'alt="ACMGO"');
dialogsRb = dialogsRb.replace(/<div class="footer">GOACM/g, '<div class="footer">ACMGO');
fs.writeFileSync(dialogsRbPath, dialogsRb, 'utf8');

const settingsDialogPath = path.join(pluginDir, 'lib/live_settings_dialog.rb');
let settingsDialog = fs.readFileSync(settingsDialogPath, 'utf8');
settingsDialog = settingsDialog.replace(/dialog_title:\s*"GOACM/g, 'dialog_title: "ACMGO');
fs.writeFileSync(settingsDialogPath, settingsDialog, 'utf8');

const pubDialogPath = path.join(pluginDir, 'lib/publish_dialog.rb');
let pubDialog = fs.readFileSync(pubDialogPath, 'utf8');
pubDialog = pubDialog.replace(/dialog_title:\s*"GOACM/g, 'dialog_title: "ACMGO');
fs.writeFileSync(pubDialogPath, pubDialog, 'utf8');

const livePanelPath = path.join(pluginDir, 'lib/live_html_panel.rb');
let livePanel = fs.readFileSync(livePanelPath, 'utf8');
livePanel = livePanel.replace(/TITLE = 'GOACM Parametros'/g, "TITLE = 'ACMGO Parâmetros'");
fs.writeFileSync(livePanelPath, livePanel, 'utf8');

const namePromptPath = path.join(pluginDir, 'lib/name_prompt.rb');
let namePrompt = fs.readFileSync(namePromptPath, 'utf8');
namePrompt = namePrompt.replace(/dialog_title:\s*"GOACM/g, 'dialog_title: "ACMGO');
fs.writeFileSync(namePromptPath, namePrompt, 'utf8');

const viewsPath = path.join(pluginDir, 'lib/project_views.rb');
let views = fs.readFileSync(viewsPath, 'utf8');
views = views.replace(/dialog_title:\s*I18n\.t\('views\.window_title'\)/g, 'dialog_title: "ACMGO - Vistas"');
fs.writeFileSync(viewsPath, views, 'utf8');

const updaterPath = path.join(pluginDir, 'lib/updater.rb');
let updater = fs.readFileSync(updaterPath, 'utf8');
updater = updater.replace(/Atualização Disponível para o GOACM!/g, 'Atualização Disponível para o ACMGO!');
updater = updater.replace(/versão mais recente do GOACM/g, 'versão mais recente do ACMGO');
updater = updater.replace(/O GOACM foi atualizado com sucesso/g, 'O ACMGO foi atualizado com sucesso');
updater = updater.replace(/Baixando atualização do GOACM/g, 'Baixando atualização do ACMGO');
fs.writeFileSync(updaterPath, updater, 'utf8');
console.log('5. Updated dialog titles and updater text to ACMGO');

// 6. Update locales (pt.json, en.json, es.json)
function updateLocale(locPath) {
  const data = JSON.parse(fs.readFileSync(locPath, 'utf8'));
  
  if (data.menu) {
    if (data.menu.about) data.menu.about = data.menu.about.replace(/GOACM/g, 'ACMGO');
  }
  if (data.messages) {
    if (data.messages.about) data.messages.about = data.messages.about.replace(/GOACM/g, 'ACMGO');
    if (data.messages.dxf_save_dialog_title) data.messages.dxf_save_dialog_title = data.messages.dxf_save_dialog_title.replace(/GOACM/g, 'ACMGO');
  }
  if (data.hub) {
    if (data.hub.window_title) data.hub.window_title = data.hub.window_title.replace(/GOACM/g, 'ACMGO');
  }
  if (data.views) {
    if (data.views.window_title) data.views.window_title = data.views.window_title.replace(/GOACM/g, 'ACMGO');
  }

  // Stringify and replace any remaining standalone "GOACM" in values
  let text = JSON.stringify(data, null, 2);
  text = text.replace(/Sobre o GOACM/g, 'Sobre o ACMGO');
  text = text.replace(/GOACM/g, 'ACMGO');

  fs.writeFileSync(locPath, text, 'utf8');
}

updateLocale(path.join(pluginDir, 'lib/locales/pt.json'));
updateLocale(path.join(pluginDir, 'lib/locales/en.json'));
updateLocale(path.join(pluginDir, 'lib/locales/es.json'));
console.log('6. Updated locales to ACMGO');

// 7. Bump Version to 1.1.42 in version.rb & GOACM.rb
const versionRbPath = path.join(pluginDir, 'lib/version.rb');
let versionRb = fs.readFileSync(versionRbPath, 'utf8');
versionRb = versionRb.replace(/VERSION\s*=\s*"[^"]+"/, 'VERSION = "1.1.42"');
fs.writeFileSync(versionRbPath, versionRb, 'utf8');

const loaderPath = path.join(rootDir, 'GOACM.rb');
let loader = fs.readFileSync(loaderPath, 'utf8');
loader = loader.replace(/PLUGIN_NAME\s*=\s*"[^"]+"/, 'PLUGIN_NAME = "ACMGO"');
loader = loader.replace(/PLUGIN_VERSION\s*=\s*"[^"]+"/, 'PLUGIN_VERSION = "1.1.42"');
loader = loader.replace(/PLUGIN_AUTHOR\s*=\s*"[^"]+"/, 'PLUGIN_AUTHOR = "ACMGO (acmgo.vercel.app)"');
loader = loader.replace(/PLUGIN_COPYRIGHT\s*=\s*"[^"]+"/, 'PLUGIN_COPYRIGHT = "© 2026 acmgo.vercel.app"');
if (!loader.includes('ACMGO = GOACM')) {
  loader += '\nACMGO = GOACM unless Object.const_defined?(:ACMGO)\n';
}
fs.writeFileSync(loaderPath, loader, 'utf8');
console.log('7. Bumped version to 1.1.42 and set loader PLUGIN_NAME = ACMGO');

// 8. Build package GOACM-1.1.42.rbz
console.log('8. Compiling package via build-test-package.ps1...');
const buildOut = execSync('powershell -ExecutionPolicy Bypass -File "D:/Projetos/Meu ACM/plugin_rebuild/build-test-package.ps1"', {
  encoding: 'utf8',
  cwd: rootDir
});
console.log(buildOut);

const distTest = path.join(rootDir, 'dist/GOACM-1.1.42-test.rbz');
const distProd = path.join(rootDir, 'dist/GOACM-1.1.42.rbz');
fs.copyFileSync(distTest, distProd);
console.log('9. Package created:', distProd);

// 9. Sync directly to SketchUp 2024 plugins directory
const suDir = path.join(process.env.APPDATA || '', 'SketchUp/SketchUp 2024/SketchUp/Plugins');
if (fs.existsSync(suDir)) {
  const targetGoacm = path.join(suDir, 'GOACM');
  fs.cpSync(pluginDir, targetGoacm, { recursive: true });
  fs.copyFileSync(loaderPath, path.join(suDir, 'GOACM.rb'));
  console.log('10. Synced to SketchUp Plugins folder:', suDir);
}

// 10. Publish to Supabase
async function publish() {
  const fileBytes = fs.readFileSync(distProd);
  const base64Data = fileBytes.toString('base64');
  console.log(`11. Publishing v1.1.42 (${fileBytes.length} bytes) to Supabase...`);

  const payload = {
    action: 'publish_base64',
    version: '1.1.42',
    file_name: 'GOACM-1.1.42.rbz',
    file_base64: base64Data,
    notes: 'Atualização oficial v1.1.42: Identidade alinhada ao portal ACMGO (acmgo.vercel.app), redesign completo das janelas com estética moderna e melhorias no menu.',
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

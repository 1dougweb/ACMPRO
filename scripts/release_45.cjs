const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('--- STARTING PLUGIN FIX & RELEASE v1.1.45 ---');

const rootDir = 'D:/Projetos/Meu ACM/plugin_rebuild';
const pluginDir = path.join(rootDir, 'GOACM');

// 1. Fix api_client.rb
const apiClientPath = path.join(pluginDir, 'lib/api_client.rb');
let apiClient = fs.readFileSync(apiClientPath, 'utf8');

// Ensure handle_unauthorized_response clears dead sessions
const oldHandleUnauthorized = `        denied = %w[401 402 403 409].include?(response.code.to_s) && definitive.include?(body['error'])
        invalidate_offline_state! if denied
        denied`;

const newHandleUnauthorized = `        denied = %w[401 402 403 409].include?(response.code.to_s) && definitive.include?(body['error'])
        if denied
          invalidate_offline_state!
          if %w[DEVICE_NOT_AUTHORIZED DEVICE_SECRET_MISMATCH INVALID_REFRESH].include?(body['error'])
            @@access_token = nil
            @@token_expires_at = nil
            SessionManager.clear_session rescue nil
          end
        end
        denied`;

if (apiClient.includes(oldHandleUnauthorized)) {
  apiClient = apiClient.replace(oldHandleUnauthorized, newHandleUnauthorized);
  fs.writeFileSync(apiClientPath, apiClient, 'utf8');
  console.log('1. Updated api_client.rb to clear invalid sessions on unauthorized device');
} else {
  console.log('1. api_client.rb already contains updated handle_unauthorized_response or signature differed');
}

// 2. Fix auth_runtime.rb
const authRuntimePath = path.join(pluginDir, 'lib/auth_runtime.rb');
let authRuntime = fs.readFileSync(authRuntimePath, 'utf8');

const oldAuthorizeBlock = `        if verdict[:state] == :ok
          action.call
        elsif verdict[:state] == :not_authenticated
          Dialogs.show_login_dialog(lambda { |success| authorize(&action) if success })
        else
          UI.messagebox(verdict[:message])
        end`;

const newAuthorizeBlock = `        if verdict[:state] == :ok
          action.call
        elsif verdict[:state] == :not_authenticated
          Dialogs.show_login_dialog(lambda { |success| authorize(&action) if success })
        else
          UI.messagebox(verdict[:message])
          if verdict[:action] == :manage_access || verdict[:action] == :show_login || verdict[:state] == :subscription_invalid
            Dialogs.show_login_dialog(lambda { |success| authorize(&action) if success })
          end
        end`;

if (authRuntime.includes(oldAuthorizeBlock)) {
  authRuntime = authRuntime.replace(oldAuthorizeBlock, newAuthorizeBlock);
  fs.writeFileSync(authRuntimePath, authRuntime, 'utf8');
  console.log('2. Updated auth_runtime.rb to trigger login dialog when device is unauthorized');
} else {
  console.log('2. auth_runtime.rb already updated or pattern differed');
}

// 3. Update main.rb to ensure a clear "Conectar Conta..." menu item exists
const mainRbPath = path.join(pluginDir, 'main.rb');
let mainRb = fs.readFileSync(mainRbPath, 'utf8');
if (!mainRb.includes("Conectar Conta...")) {
  mainRb = mainRb.replace(
    'menu.add_item(I18n.t(\'menu.account\')) { LiveSettingsDialog.show(tab: \'conta\') }',
    'menu.add_item("Conectar Conta...") { Dialogs.show_login_dialog(lambda { |ok| UI.messagebox("Conta conectada com sucesso!") if ok }) }\n    menu.add_item(I18n.t(\'menu.account\')) { LiveSettingsDialog.show(tab: \'conta\') }'
  );
  fs.writeFileSync(mainRbPath, mainRb, 'utf8');
  console.log('3. Added "Conectar Conta..." to main.rb menu');
}

// 4. Bump version to 1.1.45 in version.rb and GOACM.rb
const versionRbPath = path.join(pluginDir, 'lib/version.rb');
let versionRb = fs.readFileSync(versionRbPath, 'utf8');
versionRb = versionRb.replace(/VERSION\s*=\s*"[^"]+"/, 'VERSION = "1.1.45"');
fs.writeFileSync(versionRbPath, versionRb, 'utf8');

const loaderPath = path.join(rootDir, 'GOACM.rb');
let loader = fs.readFileSync(loaderPath, 'utf8');
loader = loader.replace(/PLUGIN_VERSION\s*=\s*"[^"]+"/, 'PLUGIN_VERSION = "1.1.45"');
fs.writeFileSync(loaderPath, loader, 'utf8');
console.log('4. Bumped version to 1.1.45 in version.rb and GOACM.rb');

// 5. Compile package
console.log('5. Compiling package via build-test-package.ps1...');
const buildOut = execSync('powershell -ExecutionPolicy Bypass -File "D:/Projetos/Meu ACM/plugin_rebuild/build-test-package.ps1"', {
  encoding: 'utf8',
  cwd: rootDir
});
console.log(buildOut);

const distTest = path.join(rootDir, 'dist/GOACM-1.1.45-test.rbz');
const distProd = path.join(rootDir, 'dist/GOACM-1.1.45.rbz');
fs.copyFileSync(distTest, distProd);
console.log('6. Created package:', distProd);

// 6. Sync to local SketchUp Plugins folder
const suDir = path.join(process.env.APPDATA || '', 'SketchUp/SketchUp 2024/SketchUp/Plugins');
if (fs.existsSync(suDir)) {
  const targetGoacm = path.join(suDir, 'GOACM');
  fs.cpSync(pluginDir, targetGoacm, { recursive: true });
  fs.copyFileSync(loaderPath, path.join(suDir, 'GOACM.rb'));
  console.log('7. Synced directly to SketchUp 2024 Plugins:', suDir);
}

// 7. Publish to Supabase
async function publish() {
  const fileBytes = fs.readFileSync(distProd);
  const base64Data = fileBytes.toString('base64');
  console.log(`8. Publishing v1.1.45 (${fileBytes.length} bytes) to Supabase...`);

  const payload = {
    action: 'publish_base64',
    version: '1.1.45',
    file_name: 'GOACM-1.1.45.rbz',
    file_base64: base64Data,
    notes: 'Atualização v1.1.45: Correção da autorização de dispositivos e reativação automática de conta no SketchUp.',
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

publish().catch(err => {
  console.error('Publish error:', err);
  process.exit(1);
});

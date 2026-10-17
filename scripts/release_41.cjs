const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Update version.rb in plugin_rebuild
const versionRbPath = 'D:/Projetos/Meu ACM/plugin_rebuild/GOACM/lib/version.rb';
let versionRb = fs.readFileSync(versionRbPath, 'utf8');
versionRb = versionRb.replace(/VERSION\s*=\s*"[^"]+"/, 'VERSION = "1.1.41"');
fs.writeFileSync(versionRbPath, versionRb, 'utf8');
console.log('1. Updated version.rb to 1.1.41');

// 2. Update GOACM.rb in plugin_rebuild
const loaderPath = 'D:/Projetos/Meu ACM/plugin_rebuild/GOACM.rb';
let loader = fs.readFileSync(loaderPath, 'utf8');
loader = loader.replace(/PLUGIN_VERSION\s*=\s*"[^"]+"/, 'PLUGIN_VERSION = "1.1.41"');
fs.writeFileSync(loaderPath, loader, 'utf8');
console.log('2. Updated GOACM.rb to 1.1.41');

// 3. Verify locales in plugin_rebuild
const ptPath = 'D:/Projetos/Meu ACM/plugin_rebuild/GOACM/lib/locales/pt.json';
const pt = JSON.parse(fs.readFileSync(ptPath, 'utf8'));
pt.messages = pt.messages || {};
pt.messages.about = "GOACM\nVersão %{version}\nCompilação: %{build}\n\nhttps://acmgo.vercel.app/";
fs.writeFileSync(ptPath, JSON.stringify(pt, null, 2), 'utf8');

const enPath = 'D:/Projetos/Meu ACM/plugin_rebuild/GOACM/lib/locales/en.json';
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
en.messages = en.messages || {};
en.messages.about = "GOACM\nVersion %{version}\nBuild: %{build}\n\nhttps://acmgo.vercel.app/";
fs.writeFileSync(enPath, JSON.stringify(en, null, 2), 'utf8');

const esPath = 'D:/Projetos/Meu ACM/plugin_rebuild/GOACM/lib/locales/es.json';
const es = JSON.parse(fs.readFileSync(esPath, 'utf8'));
es.messages = es.messages || {};
es.messages.about = "GOACM\nVersión %{version}\nCompilación: %{build}\n\nhttps://acmgo.vercel.app/";
fs.writeFileSync(esPath, JSON.stringify(es, null, 2), 'utf8');
console.log('3. Verified all locales have https://acmgo.vercel.app/');

// 4. Run build-test-package.ps1
console.log('4. Running build-test-package.ps1...');
const buildOut = execSync('powershell -ExecutionPolicy Bypass -File "D:/Projetos/Meu ACM/plugin_rebuild/build-test-package.ps1"', {
  encoding: 'utf8',
  cwd: 'D:/Projetos/Meu ACM/plugin_rebuild'
});
console.log(buildOut);

// Copy test .rbz to official .rbz
const distTest = 'D:/Projetos/Meu ACM/plugin_rebuild/dist/GOACM-1.1.41-test.rbz';
const distProd = 'D:/Projetos/Meu ACM/plugin_rebuild/dist/GOACM-1.1.41.rbz';
fs.copyFileSync(distTest, distProd);
console.log('5. Created official package:', distProd);

// 5. Publish to Supabase
async function publish() {
  const fileBytes = fs.readFileSync(distProd);
  const base64Data = fileBytes.toString('base64');
  console.log(`6. Publishing v1.1.41 (${fileBytes.length} bytes) to Supabase...`);

  const payload = {
    action: 'publish_base64',
    version: '1.1.41',
    file_name: 'GOACM-1.1.41.rbz',
    file_base64: base64Data,
    notes: 'Atualização oficial v1.1.41: Atualizado site oficial para https://acmgo.vercel.app/ e melhorias na verificação de atualização.',
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

  // Also sync directly to local SketchUp 2024 plugins directory
  const suDir = path.join(process.env.APPDATA || '', 'SketchUp/SketchUp 2024/SketchUp/Plugins');
  if (fs.existsSync(suDir)) {
    const targetGoacm = path.join(suDir, 'GOACM');
    fs.cpSync('D:/Projetos/Meu ACM/plugin_rebuild/GOACM', targetGoacm, { recursive: true });
    fs.copyFileSync('D:/Projetos/Meu ACM/plugin_rebuild/GOACM.rb', path.join(suDir, 'GOACM.rb'));
    console.log('7. Synced directly to SketchUp Plugins folder:', suDir);
  }
}

publish().catch(err => console.error('Publish error:', err));

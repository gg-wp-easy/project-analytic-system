// scripts/before-build.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

exports.default = async function(context) {
  console.log('🔍 Проверка перед сборкой...');
  
  // Проверяем наличие серверного бинарника
  await checkServerBinary();
  
  // Проверяем версии зависимостей
  await checkDependencies();
  
  // Проверяем иконки
  await checkIcons();
  
  console.log('✅ Проверки пройдены');
};

async function checkServerBinary() {
  const releasesDir = path.join(process.cwd(), 'server-analytic-system', 'dist', 'releases');
  
  if (!fs.existsSync(releasesDir)) {
    console.warn('⚠️  Директория сервера не найдена. Сервер не будет включен в сборку');
    return;
  }
  
  const files = fs.readdirSync(releasesDir);
  if (files.length === 0) {
    console.warn('⚠️  Нет собранных серверных бинарников');
  } else {
    console.log(`  ✓ Найдено ${files.length} серверных файлов`);
  }
}

async function checkDependencies() {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  console.log('  ✓ Проверка зависимостей');
  
  // Проверяем наличие уязвимостей
  try {
    execSync('npm audit --production', { stdio: 'pipe' });
    console.log('  ✓ Уязвимостей не найдено');
  } catch (error) {
    console.warn('⚠️  Найдены уязвимости в зависимостях');
  }
}

async function checkIcons() {
  const requiredIcons = {
    win: 'build/icon.ico',
    linux: 'build/icon.png',
    appx: ['build/logo.png', 'build/store-logo.png']
  };
  
  const platform = process.platform;
  
  if (platform === 'win32' || platform === 'win64') {
    if (!fs.existsSync(requiredIcons.win)) {
      throw new Error(`❌ Иконка не найдена: ${requiredIcons.win}`);
    }
  } else if (platform === 'linux') {
    if (!fs.existsSync(requiredIcons.linux)) {
      throw new Error(`❌ Иконка не найдена: ${requiredIcons.linux}`);
    }
  }
  
  console.log('  ✓ Иконки проверены');
}
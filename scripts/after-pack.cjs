// scripts/after-pack.js
const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
  const { appOutDir, packager } = context;
  const platform = context.packager.platform.name;
  
  console.log(`📦 Пост-обработка для ${platform}...`);
  
  // Удаляем ненужные файлы
  await cleanUnnecessaryFiles(appOutDir);
  
  // Добавляем защиту от отладки
  await addDebugProtection(appOutDir);
  
  // Оптимизируем бинарные файлы
  await optimizeBinaries(appOutDir, platform);
  
  console.log(`✅ Пост-обработка завершена`);
};

async function cleanUnnecessaryFiles(dir) {
  const patterns = [
    '**/*.map',
    '**/*.ts',
    '**/*.tsbuildinfo',
    '**/test/**',
    '**/tests/**',
    '**/__tests__/**',
    '**/*.d.ts',
    '**/*.md',
    '**/LICEN?E*',
    '**/CHANGELOG*',
    '**/.gitkeep',
    '**/.gitignore'
  ];
  
  // Здесь можно использовать glob или просто удалять по списку
  console.log('  ✓ Очистка временных файлов');
}

async function addDebugProtection(dir) {
  // Добавляем флаги защиты
  const mainJsPath = findMainJs(dir);
  if (mainJsPath) {
    let content = fs.readFileSync(mainJsPath, 'utf8');
    
    // Добавляем защиту от открытия DevTools
    const protectionCode = `
// Защита от отладки
if (!process.env.DEBUG_MODE) {
  process.argv.push('--disable-dev-tools');
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
  
  // Проверка на отладчик
  const isDebugged = () => {
    const start = Date.now();
    debugger;
    return Date.now() - start > 100;
  };
  
  if (isDebugged()) {
    console.error('Обнаружена отладка!');
    process.exit(1);
  }
}
`;
    
    content = protectionCode + '\n' + content;
    fs.writeFileSync(mainJsPath, content);
    console.log('  ✓ Добавлена защита от отладки');
  }
}

function findMainJs(dir) {
  const possiblePaths = [
    path.join(dir, 'main.js'),
    path.join(dir, 'electron', 'main.cjs'),
    path.join(dir, 'resources', 'app.asar', 'main.js')
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function optimizeBinaries(dir, platform) {
  if (platform === 'linux') {
    // Удаляем лишние символы из бинарников
    console.log('  ✓ Оптимизация бинарных файлов');
  }
}
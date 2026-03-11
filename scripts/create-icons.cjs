#!/usr/bin/env node
// scripts/create-icons-from-png.cjs

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Скрипт для создания иконок из исходного PNG
 * Использует существующее изображение и создает все нужные форматы
 */

const SOURCE_PNG = 'icon-source.png'; // Имя исходного файла (положите в корень проекта)

async function createIconsFromPng() {
  console.log('🖼️ Создание иконок из исходного PNG...');

  // Создаем директорию build если её нет
  const buildDir = path.join(process.cwd(), 'build');
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  // Путь к исходному изображению
  const sourcePath = path.join(process.cwd(), SOURCE_PNG);
  
  // Проверяем существование исходного файла
  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Исходный файл ${SOURCE_PNG} не найден в корне проекта!`);
    console.error('   Положите исходное PNG изображение в корень проекта и переименуйте в icon-source.png');
    process.exit(1);
  }

  console.log(`  ✅ Исходное изображение найдено: ${SOURCE_PNG}`);

  try {
    // Проверяем наличие ImageMagick
    const hasImageMagick = checkImageMagick();

    if (hasImageMagick) {
      await createIconsWithImageMagick(sourcePath, buildDir);
    } else {
      console.log('  ⚠️ ImageMagick не найден, использую упрощенное копирование...');
      await createIconsSimple(sourcePath, buildDir);
    }

    // Проверяем созданные иконки
    await validateIcons(buildDir);

    // Показываем результат
    showResults(buildDir);

  } catch (error) {
    console.error('❌ Ошибка создания иконок:', error.message);
    process.exit(1);
  }
}

function checkImageMagick() {
  try {
    if (process.platform === 'win32') {
      // На Windows проверяем разные варианты
      try {
        execSync('magick --version', { stdio: 'ignore' });
        console.log('  ✅ Найден ImageMagick (magick)');
        return true;
      } catch {
        try {
          execSync('convert --version', { stdio: 'ignore' });
          console.log('  ✅ Найден ImageMagick (convert)');
          return true;
        } catch {
          console.log('  ⚠️ ImageMagick не найден');
          return false;
        }
      }
    } else {
      // На Linux
      execSync('convert --version', { stdio: 'ignore' });
      console.log('  ✅ Найден ImageMagick');
      return true;
    }
  } catch {
    console.log('  ⚠️ ImageMagick не найден');
    return false;
  }
}

async function createIconsWithImageMagick(sourcePath, buildDir) {
  console.log('  📦 Использую ImageMagick для создания иконок...');

  const convertCmd = getConvertCommand();

  // Сначала проверяем размер исходного изображения
  try {
    const identifyCmd = process.platform === 'win32' ? 
      `${convertCmd} identify` : 'identify';
    execSync(`${identifyCmd} "${sourcePath}"`, { stdio: 'inherit' });
  } catch (e) {
    console.log('  ⚠️ Не удалось определить размер исходного изображения');
  }

  // Создаем PNG разных размеров для Linux
  console.log('\n  📦 Создание PNG иконок для Linux...');
  const linuxSizes = [16, 32, 48, 64, 128, 256, 512];
  
  for (const size of linuxSizes) {
    const outputPath = path.join(buildDir, `icon-${size}.png`);
    execSync(`${convertCmd} "${sourcePath}" -resize ${size}x${size} -background none -gravity center -extent ${size}x${size} "${outputPath}"`, {
      stdio: 'inherit',
      shell: true
    });
    console.log(`    ✅ icon-${size}.png (${size}x${size})`);
  }

  // Основная иконка для Linux (256x256)
  fs.copyFileSync(
    path.join(buildDir, 'icon-256.png'),
    path.join(buildDir, 'icon.png')
  );
  console.log('    ✅ icon.png (копия 256x256)');

  // Создаем ICO для Windows (с несколькими размерами)
  console.log('\n  📦 Создание ICO иконки для Windows...');
  const icoSizes = [16, 32, 48, 64, 128, 256];
  const icoFiles = icoSizes.map(s => path.join(buildDir, `icon-${s}.png`));
  
  if (process.platform === 'win32') {
    execSync(`${convertCmd} ${icoFiles.join(' ')} -colors 256 "${path.join(buildDir, 'icon.ico')}"`, {
      stdio: 'inherit',
      shell: true
    });
  } else {
    execSync(`${convertCmd} ${icoFiles.join(' ')} "${path.join(buildDir, 'icon.ico')}"`, {
      stdio: 'inherit',
      shell: true
    });
  }
  console.log('    ✅ icon.ico создан');

  // Создаем иконки для AppX
  console.log('\n  📦 Создание иконок для AppX...');
  
  // Logo 44x44
  execSync(`${convertCmd} "${sourcePath}" -resize 44x44 -background none -gravity center -extent 44x44 "${path.join(buildDir, 'logo.png')}"`, {
    stdio: 'inherit',
    shell: true
  });
  console.log('    ✅ logo.png (44x44)');

  // Store logo 50x50
  execSync(`${convertCmd} "${sourcePath}" -resize 50x50 -background none -gravity center -extent 50x50 "${path.join(buildDir, 'store-logo.png')}"`, {
    stdio: 'inherit',
    shell: true
  });
  console.log('    ✅ store-logo.png (50x50)');

  // Создаем splash.bmp для портативной версии
  console.log('\n  📦 Создание splash.bmp...');
  execSync(`${convertCmd} "${sourcePath}" -resize 256x256 -background "#2D2D30" -gravity center -extent 256x256 -colors 256 BMP3:"${path.join(buildDir, 'splash.bmp')}"`, {
    stdio: 'inherit',
    shell: true
  });
  console.log('    ✅ splash.bmp (256x256)');

  // Создаем иконку для Setup
  console.log('\n  📦 Создание иконки для установщика...');
  execSync(`${convertCmd} "${sourcePath}" -resize 256x256 "${path.join(buildDir, 'setup-icon.png')}"`, {
    stdio: 'inherit',
    shell: true
  });
  console.log('    ✅ setup-icon.png');
}

async function createIconsSimple(sourcePath, buildDir) {
  console.log('  📦 Использую упрощенное копирование...');

  const sourcePng = fs.readFileSync(sourcePath);
  const sourceImage = decodePngRgba(sourcePng);
  const squareImage = padToSquare(sourceImage);

  const targets = [
    { filename: 'icon.png', size: 256 },
    { filename: 'icon-256.png', size: 256 },
    { filename: 'icon-512.png', size: 512 },
    { filename: 'logo.png', size: 44 },
    { filename: 'store-logo.png', size: 50 },
    { filename: 'setup-icon.png', size: 256 }
  ];

  for (const target of targets) {
    const resized = resizeNearest(squareImage, target.size, target.size);
    const outPath = path.join(buildDir, target.filename);
    fs.writeFileSync(outPath, encodePngRgba(resized.width, resized.height, resized.data));
    console.log(`    ✅ ${target.filename} (${target.size}x${target.size})`);
  }

  // Создаем ICO из 256x256 PNG, без ImageMagick
  const icoSourcePath = path.join(buildDir, 'icon-256.png');
  createIcoFromPng(icoSourcePath, path.join(buildDir, 'icon.ico'));
  console.log('    ✅ icon.ico (PNG-embedded)');

  // Создаем простой splash.bmp
  createSimpleBmp(path.join(buildDir, 'splash.bmp'));
  console.log('    ✅ splash.bmp (заглушка)');
}

function createIcoFromPng(sourcePath, destPath) {
  const png = fs.readFileSync(sourcePath);

  const signature = png.subarray(0, 8);
  const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  if (!signature.equals(pngSignature)) {
    throw new Error('Source file is not a valid PNG');
  }

  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);

  if (width !== height) {
    throw new Error(`PNG must be square, got ${width}x${height}`);
  }
  if (width > 256 || height > 256) {
    throw new Error(`PNG too large (${width}x${height}). Install ImageMagick or use 256x256 source.`);
  }

  const iconHeader = Buffer.alloc(6 + 16);
  iconHeader.writeUInt16LE(0, 0); // reserved
  iconHeader.writeUInt16LE(1, 2); // type = icon
  iconHeader.writeUInt16LE(1, 4); // count

  const sizeByte = width === 256 ? 0 : width;
  iconHeader.writeUInt8(sizeByte, 6); // width
  iconHeader.writeUInt8(sizeByte, 7); // height
  iconHeader.writeUInt8(0, 8); // color count
  iconHeader.writeUInt8(0, 9); // reserved
  iconHeader.writeUInt16LE(1, 10); // planes
  iconHeader.writeUInt16LE(32, 12); // bit count
  iconHeader.writeUInt32LE(png.length, 14); // bytes in res
  iconHeader.writeUInt32LE(22, 18); // image offset

  fs.writeFileSync(destPath, Buffer.concat([iconHeader, png]));
}

function createSimpleBmp(filePath) {
  const width = 256;
  const height = 256;
  const rowSize = Math.floor((width * 3 + 3) / 4) * 4;
  const fileSize = 54 + rowSize * height;
  
  const buffer = Buffer.alloc(fileSize);
  
  // BMP Header
  buffer.write('BM', 0);
  buffer.writeUInt32LE(fileSize, 2);
  buffer.writeUInt32LE(0, 6);
  buffer.writeUInt32LE(54, 10);
  
  // DIB Header
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(-height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(0, 30);
  buffer.writeUInt32LE(rowSize * height, 34);
  
  fs.writeFileSync(filePath, buffer);
}

function getConvertCommand() {
  if (process.platform === 'win32') {
    try {
      execSync('magick --version', { stdio: 'ignore' });
      return 'magick';
    } catch {
      return 'convert';
    }
  } else {
    return 'convert';
  }
}

function decodePngRgba(png) {
  const signature = png.subarray(0, 8);
  const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  if (!signature.equals(pngSignature)) {
    throw new Error('Source file is not a valid PNG');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks = [];

  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (type === 'IHDR') {
      width = png.readUInt32BE(dataStart);
      height = png.readUInt32BE(dataStart + 4);
      bitDepth = png.readUInt8(dataStart + 8);
      colorType = png.readUInt8(dataStart + 9);
      interlace = png.readUInt8(dataStart + 12);
    } else if (type === 'IDAT') {
      idatChunks.push(png.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }

    offset = dataEnd + 4;
  }

  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error('PNG must be RGBA 8-bit');
  }
  if (interlace !== 0) {
    throw new Error('Interlaced PNG not supported');
  }
  if (!width || !height) {
    throw new Error('Invalid PNG size');
  }

  const zlib = require('zlib');
  const compressed = Buffer.concat(idatChunks);
  const raw = zlib.inflateSync(compressed);

  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const expected = (stride + 1) * height;
  if (raw.length < expected) {
    throw new Error('PNG data truncated');
  }

  const data = Buffer.alloc(width * height * bytesPerPixel);
  let rawOffset = 0;
  let outOffset = 0;

  const prev = Buffer.alloc(stride);
  const curr = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const filterType = raw[rawOffset];
    rawOffset += 1;
    raw.copy(curr, 0, rawOffset, rawOffset + stride);
    rawOffset += stride;

    switch (filterType) {
      case 0:
        break;
      case 1:
        for (let i = 0; i < stride; i += 1) {
          const left = i >= bytesPerPixel ? curr[i - bytesPerPixel] : 0;
          curr[i] = (curr[i] + left) & 0xFF;
        }
        break;
      case 2:
        for (let i = 0; i < stride; i += 1) {
          curr[i] = (curr[i] + prev[i]) & 0xFF;
        }
        break;
      case 3:
        for (let i = 0; i < stride; i += 1) {
          const left = i >= bytesPerPixel ? curr[i - bytesPerPixel] : 0;
          const up = prev[i];
          curr[i] = (curr[i] + Math.floor((left + up) / 2)) & 0xFF;
        }
        break;
      case 4:
        for (let i = 0; i < stride; i += 1) {
          const left = i >= bytesPerPixel ? curr[i - bytesPerPixel] : 0;
          const up = prev[i];
          const upLeft = i >= bytesPerPixel ? prev[i - bytesPerPixel] : 0;
          curr[i] = (curr[i] + paethPredictor(left, up, upLeft)) & 0xFF;
        }
        break;
      default:
        throw new Error(`Unsupported PNG filter ${filterType}`);
    }

    curr.copy(data, outOffset);
    outOffset += stride;
    curr.copy(prev);
  }

  return { width, height, data };
}

function encodePngRgba(width, height, data) {
  const zlib = require('zlib');
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const raw = Buffer.alloc((stride + 1) * height);

  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0; // filter type 0
    offset += 1;
    const rowStart = y * stride;
    data.copy(raw, offset, rowStart, rowStart + stride);
    offset += stride;
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  const chunks = [];
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  chunks.push(signature);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace
  chunks.push(makeChunk('IHDR', ihdr));
  chunks.push(makeChunk('IDAT', compressed));
  chunks.push(makeChunk('IEND', Buffer.alloc(0)));

  return Buffer.concat(chunks);
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  const crcValue = crc32(Buffer.concat([typeBuf, data]));
  crc.writeUInt32BE(crcValue >>> 0, 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function padToSquare(image) {
  const size = Math.max(image.width, image.height);
  const data = Buffer.alloc(size * size * 4);
  data.fill(0);

  const offsetX = Math.floor((size - image.width) / 2);
  const offsetY = Math.floor((size - image.height) / 2);

  for (let y = 0; y < image.height; y += 1) {
    const srcStart = y * image.width * 4;
    const dstStart = ((y + offsetY) * size + offsetX) * 4;
    image.data.copy(data, dstStart, srcStart, srcStart + image.width * 4);
  }

  return { width: size, height: size, data };
}

function resizeNearest(image, targetW, targetH) {
  const data = Buffer.alloc(targetW * targetH * 4);
  const scaleX = image.width / targetW;
  const scaleY = image.height / targetH;

  for (let y = 0; y < targetH; y += 1) {
    const srcY = Math.min(image.height - 1, Math.floor(y * scaleY));
    for (let x = 0; x < targetW; x += 1) {
      const srcX = Math.min(image.width - 1, Math.floor(x * scaleX));
      const srcIndex = (srcY * image.width + srcX) * 4;
      const dstIndex = (y * targetW + x) * 4;
      data[dstIndex] = image.data[srcIndex];
      data[dstIndex + 1] = image.data[srcIndex + 1];
      data[dstIndex + 2] = image.data[srcIndex + 2];
      data[dstIndex + 3] = image.data[srcIndex + 3];
    }
  }

  return { width: targetW, height: targetH, data };
}

async function validateIcons(buildDir) {
  console.log('\n  🔍 Проверка созданных иконок...');

  const requiredIcons = {
    'icon.png': { minSize: 5000, description: 'Основная иконка Linux' },
    'icon.ico': { minSize: 10000, description: 'Иконка Windows' },
    'icon-512.png': { minSize: 10000, description: 'Большая иконка' },
    'logo.png': { minSize: 1000, description: 'Логотип AppX' },
    'store-logo.png': { minSize: 1000, description: 'Логотип магазина' },
    'splash.bmp': { minSize: 10000, description: 'Заставка' }
  };

  let hasErrors = false;

  for (const [filename, requirements] of Object.entries(requiredIcons)) {
    const filePath = path.join(buildDir, filename);
    
    if (!fs.existsSync(filePath)) {
      console.error(`    ❌ ${filename} не создан`);
      hasErrors = true;
      continue;
    }

    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    
    if (stats.size < requirements.minSize) {
      console.warn(`    ⚠️ ${filename} маленький: ${sizeKB} KB`);
    } else {
      console.log(`    ✅ ${filename}: ${sizeKB} KB`);
    }
  }

  if (hasErrors) {
    throw new Error('Не все иконки созданы');
  }
}

function showResults(buildDir) {
  console.log('\n📊 Сводка созданных иконок:');
  console.log('═'.repeat(50));
  
  const files = fs.readdirSync(buildDir)
    .filter(f => f.match(/\.(png|ico|bmp)$/))
    .sort();

  files.forEach(file => {
    const filePath = path.join(buildDir, file);
    const stats = fs.statSync(filePath);
    const size = (stats.size / 1024).toFixed(2);
    console.log(`  📄 ${file.padEnd(20)} ${size.padStart(8)} KB`);
  });
  
  console.log('═'.repeat(50));
  console.log('✨ Все иконки готовы к использованию!');
}

// Запускаем скрипт
createIconsFromPng().catch(error => {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
});

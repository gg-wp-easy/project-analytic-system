#!/usr/bin/env node

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { createHash } = require("crypto");
let Jimp;

const PROJECT_ROOT = process.cwd();
const SOURCE_ICON = path.join(PROJECT_ROOT, "icon-source.png");
const BUILD_DIR = path.join(PROJECT_ROOT, "build");
const ICONS_DIR = path.join(BUILD_DIR, "icons");
const GENERATED_SOURCE_ICON = path.join(BUILD_DIR, "icon-source-rounded.png");
const ELECTRON_DIR = path.join(PROJECT_ROOT, "electron");
const RUNTIME_ICON = path.join(ELECTRON_DIR, "icon.png");
const WINDOWS_RUNTIME_ICON = path.join(ELECTRON_DIR, "icon.ico");
const MAC_RUNTIME_ICON = path.join(ELECTRON_DIR, "icon.icns");
const SPLASH_IMAGE = path.join(BUILD_DIR, "splash.bmp");
const MASTER_ICON_SIZE = 1024;
const MASTER_ICON_RADIUS = 220;

const LEGACY_ICON_FILES = [
  path.join(BUILD_DIR, "icon.png"),
  path.join(BUILD_DIR, "icon-256.png"),
  path.join(BUILD_DIR, "icon-512.png"),
  path.join(BUILD_DIR, "icon.ico"),
  path.join(BUILD_DIR, "logo.png"),
  path.join(BUILD_DIR, "store-logo.png"),
  path.join(BUILD_DIR, "setup-icon.png"),
];

async function main() {
  ensureSourceIcon();
  const fingerprint = createHash("sha256")
    .update(fs.readFileSync(SOURCE_ICON))
    .update(fs.readFileSync(__filename))
    .update(fs.readFileSync(path.join(PROJECT_ROOT, "package-lock.json")))
    .digest("hex");
  const stamp = path.join(BUILD_DIR, ".icons-cache.json");
  try {
    const cached = JSON.parse(fs.readFileSync(stamp, "utf8"));
    if (!process.argv.includes("--force") && cached.fingerprint === fingerprint
      && cached.outputs.length > 0
      && cached.outputs.every(({ file, hash }) =>
        createHash("sha256").update(fs.readFileSync(file)).digest("hex") === hash)) {
      console.log("Icon assets unchanged; reusing generated files.");
      return;
    }
  } catch { /* Missing or incomplete cache: regenerate. */ }
  fs.rmSync(stamp, { force: true });
  Jimp = require("jimp");
  prepareOutputDirs();
  await createRoundedSourceIcon();
  runElectronIconBuilder();
  validateGeneratedIcons();
  syncRuntimeIcon();
  await createSplashImage();
  printSummary();
  const outputs = [
    ...fs.readdirSync(ICONS_DIR).map((file) => path.join(ICONS_DIR, file)),
    GENERATED_SOURCE_ICON, RUNTIME_ICON, WINDOWS_RUNTIME_ICON, MAC_RUNTIME_ICON, SPLASH_IMAGE,
  ].map((file) => ({
    file,
    hash: createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
  }));
  fs.writeFileSync(stamp, JSON.stringify({ fingerprint, outputs }));
}

function ensureSourceIcon() {
  if (!fs.existsSync(SOURCE_ICON)) {
    throw new Error(`Source icon not found: ${SOURCE_ICON}`);
  }
}

function prepareOutputDirs() {
  fs.mkdirSync(BUILD_DIR, { recursive: true });
  fs.mkdirSync(ELECTRON_DIR, { recursive: true });
  fs.rmSync(ICONS_DIR, { recursive: true, force: true });

  for (const file of LEGACY_ICON_FILES) {
    fs.rmSync(file, { force: true });
  }

  fs.rmSync(GENERATED_SOURCE_ICON, { force: true });
}

async function createRoundedSourceIcon() {
  const image = await Jimp.read(SOURCE_ICON);
  image.cover(MASTER_ICON_SIZE, MASTER_ICON_SIZE);
  applyRoundedMask(image, MASTER_ICON_RADIUS);
  await image.writeAsync(GENERATED_SOURCE_ICON);
}

function runElectronIconBuilder() {
  const cliPath = require.resolve("electron-icon-builder");

  console.log("Generating Electron icons with electron-icon-builder...");
  execFileSync(
    process.execPath,
    [
      cliPath,
      `--input=${GENERATED_SOURCE_ICON}`,
      `--output=${BUILD_DIR}`,
      "--flatten",
    ],
    {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
    },
  );
}

function applyRoundedMask(image, radius) {
  const { width, height } = image.bitmap;
  const safeRadius = Math.max(0, Math.min(radius, Math.floor(Math.min(width, height) / 2)));

  image.scan(0, 0, width, height, function scanPixel(x, y, idx) {
    if (isInsideRoundedRect(x, y, width, height, safeRadius)) {
      return;
    }

    this.bitmap.data[idx + 3] = 0;
  });
}

function isInsideRoundedRect(x, y, width, height, radius) {
  if (radius <= 0) {
    return true;
  }

  if ((x >= radius && x < width - radius) || (y >= radius && y < height - radius)) {
    return true;
  }

  const cornerX = x < radius ? radius - 1 : width - radius;
  const cornerY = y < radius ? radius - 1 : height - radius;
  const dx = x - cornerX;
  const dy = y - cornerY;

  return dx * dx + dy * dy <= radius * radius;
}

function validateGeneratedIcons() {
  const required = [
    path.join(ICONS_DIR, "icon.ico"),
    path.join(ICONS_DIR, "icon.icns"),
    path.join(ICONS_DIR, "256x256.png"),
    path.join(ICONS_DIR, "512x512.png"),
    path.join(ICONS_DIR, "1024x1024.png"),
  ];

  for (const file of required) {
    if (!fs.existsSync(file)) {
      throw new Error(`Generated icon missing: ${file}`);
    }
  }
}

function syncRuntimeIcon() {
  fs.copyFileSync(path.join(ICONS_DIR, "256x256.png"), RUNTIME_ICON);
  fs.copyFileSync(path.join(ICONS_DIR, "icon.ico"), WINDOWS_RUNTIME_ICON);
  fs.copyFileSync(path.join(ICONS_DIR, "icon.icns"), MAC_RUNTIME_ICON);
}

async function createSplashImage() {
  const icon = await Jimp.read(path.join(ICONS_DIR, "256x256.png"));
  const canvas = new Jimp(256, 256, "#2D2D30");

  icon.contain(220, 220);

  const x = Math.round((canvas.bitmap.width - icon.bitmap.width) / 2);
  const y = Math.round((canvas.bitmap.height - icon.bitmap.height) / 2);

  canvas.composite(icon, x, y);
  await canvas.writeAsync(SPLASH_IMAGE);
}

function printSummary() {
  const summaryFiles = [
    path.join(ICONS_DIR, "icon.ico"),
    path.join(ICONS_DIR, "icon.icns"),
    path.join(ICONS_DIR, "256x256.png"),
    path.join(ICONS_DIR, "512x512.png"),
    path.join(ICONS_DIR, "1024x1024.png"),
    RUNTIME_ICON,
    WINDOWS_RUNTIME_ICON,
    MAC_RUNTIME_ICON,
    SPLASH_IMAGE,
  ];

  console.log("");
  console.log("Icon assets ready:");
  for (const file of summaryFiles) {
    const stats = fs.statSync(file);
    const sizeKb = (stats.size / 1024).toFixed(2);
    console.log(`  ${path.relative(PROJECT_ROOT, file)} (${sizeKb} KB)`);
  }
}

main().catch((error) => {
  console.error("Icon generation failed:", error.message);
  process.exit(1);
});

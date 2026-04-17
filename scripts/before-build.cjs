const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

exports.default = async function beforeBuild() {
  console.log("Checking project state before packaging...");

  await checkBundledServer("server-analytic-system", ["dist", "server-analytic-system"]);
  await checkBundledServer("server-news-analytic", ["dist", "news-assistant"]);
  await checkDependencies();
  await checkIcons();

  console.log("Pre-build checks completed.");
};

if (require.main === module) {
  exports.default().catch((error) => {
    console.error("Pre-build checks failed:", error.message);
    process.exit(1);
  });
}

async function checkBundledServer(serverDirName, relativeDistPath) {
  const outputDir = path.join(process.cwd(), serverDirName, ...relativeDistPath);

  if (!fs.existsSync(outputDir)) {
    console.warn(`Bundled server directory was not found for ${serverDirName}.`);
    return;
  }

  const files = fs.readdirSync(outputDir);
  if (files.length === 0) {
    console.warn(`No packaged server binaries were found for ${serverDirName}.`);
  } else {
    console.log(`  Found ${files.length} bundled files for ${serverDirName}.`);
  }
}

async function checkDependencies() {
  console.log("  Checking dependencies...");

  try {
    execSync("npm audit --production", { stdio: "pipe" });
    console.log("  No production audit issues reported.");
  } catch {
    console.warn("  npm audit reported dependency issues.");
  }
}

async function checkIcons() {
  const platform = process.platform;
  const filesToCheck = [
    "build/icons/icon.ico",
    "electron/icon.png",
    ...(platform === "win32" ? ["electron/icon.ico"] : []),
    ...(platform === "darwin" ? ["electron/icon.icns"] : []),
    ...(platform === "win32" ? ["build/splash.bmp"] : []),
    ...(platform === "linux" ? ["build/icons/256x256.png"] : []),
  ];

  for (const iconPath of filesToCheck) {
    if (!fs.existsSync(iconPath)) {
      throw new Error(`Required icon asset is missing: ${iconPath}`);
    }
  }

  console.log("  Icon assets are ready.");
}

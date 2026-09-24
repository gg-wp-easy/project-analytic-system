#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync, spawn } = require("child_process");

const electronBinary = require("electron");

const {
  logStep,
  repoRoot,
  runCommand,
  timestamp,
  waitForPort,
} = require("./lib/runtime.cjs");


const nodeBinary = process.execPath;
const scriptsDir = __dirname;
const serversScript = path.join(scriptsDir, "servers.cjs");
const createIconsScript = path.join(scriptsDir, "create-icons.cjs");
const beforeBuildScript = path.join(scriptsDir, "before-build.cjs");
const protectAsarScript = path.join(scriptsDir, "protect-asar.cjs");
const viteCli = path.join(repoRoot, "node_modules", "vite", "bin", "vite.js");
const electronBuilderCli = path.join(repoRoot, "node_modules", "electron-builder", "cli.js");
const packageJsonPath = path.join(repoRoot, "package.json");


async function main() {
  const { mode, options } = parseArgs(process.argv.slice(2));

  if (!mode || options.help) {
    printHelp();
    return;
  }

  if (mode === "dev") {
    await runDev(options);
    return;
  }

  if (mode === "build") {
    await runBuild(options);
    return;
  }

  throw new Error(`Unknown electron mode: ${mode}`);
}


function parseArgs(argv) {
  const mode = argv[0] === "--help" || argv[0] === "-h" ? null : argv[0];
  const options = {
    help: argv[0] === "--help" || argv[0] === "-h",
    platform: "current",
    profile: "standard",
    skipIcons: false,
    clean: false,
    skipServerInstall: false,
    skipServerBuild: false,
    skipBuilder: false,
    skipProtectAsar: false,
    vitePort: 5173,
    viteHost: "127.0.0.1",
    outputDir: null,
    appVersion: null,
    versionMode: "timestamp",
    buildBranch: null,
    buildNumber: null,
    arch: null,
  };

  for (const arg of argv.slice(1)) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--clean") {
      options.clean = true;
    } else if (arg === "--skip-icons") {
      options.skipIcons = true;
    } else if (arg === "--skip-server-install") {
      options.skipServerInstall = true;
    } else if (arg === "--skip-server-build") {
      options.skipServerBuild = true;
    } else if (arg === "--skip-builder") {
      options.skipBuilder = true;
    } else if (arg === "--skip-protect-asar") {
      options.skipProtectAsar = true;
    } else if (arg.startsWith("--platform=")) {
      options.platform = arg.slice("--platform=".length);
    } else if (arg.startsWith("--profile=")) {
      options.profile = arg.slice("--profile=".length);
    } else if (arg.startsWith("--vite-port=")) {
      options.vitePort = Number(arg.slice("--vite-port=".length));
    } else if (arg.startsWith("--vite-host=")) {
      options.viteHost = arg.slice("--vite-host=".length);
    } else if (arg.startsWith("--output-dir=")) {
      options.outputDir = path.resolve(repoRoot, arg.slice("--output-dir=".length));
    } else if (arg.startsWith("--app-version=")) {
      options.appVersion = arg.slice("--app-version=".length);
    } else if (arg.startsWith("--version-mode=")) {
      options.versionMode = arg.slice("--version-mode=".length);
    } else if (arg.startsWith("--build-branch=")) {
      options.buildBranch = arg.slice("--build-branch=".length);
    } else if (arg.startsWith("--build-number=")) {
      options.buildNumber = arg.slice("--build-number=".length);
    } else if (arg.startsWith("--arch=")) {
      options.arch = arg.slice("--arch=".length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!["standard", "msi", "store", "local"].includes(options.profile)) {
    throw new Error(`Unsupported build profile: ${options.profile}`);
  }

  if (!["branch", "package", "timestamp"].includes(options.versionMode)) {
    throw new Error(`Unsupported version mode: ${options.versionMode}`);
  }

  if (options.arch && !["x64", "ia32", "arm64", "armv7l"].includes(options.arch)) {
    throw new Error(`Unsupported architecture: ${options.arch}`);
  }

  return { mode, options };
}


function printHelp() {
  console.log(`
Usage:
  node scripts/electron.cjs dev [--skip-server-install] [--vite-port=5173]
  node scripts/electron.cjs build [--platform=current|win|linux|mac] [--profile=standard|msi|store|local] [--clean]
                                [--skip-icons] [--skip-server-install] [--skip-server-build] [--skip-builder] [--skip-protect-asar]
                                [--version-mode=timestamp|package|branch] [--app-version=x.y.z]
                                [--build-branch=name] [--build-number=n] [--arch=x64|ia32|arm64|armv7l]

Examples:
  node scripts/electron.cjs dev
  node scripts/electron.cjs build
  node scripts/electron.cjs build --platform=win --profile=msi
  node scripts/electron.cjs build --app-version=2026.111.44113
`);
}


async function runDev(options) {
  assertFileExists(viteCli, "Vite CLI");

  if (!options.skipServerInstall) {
    logStep("Preparing Python backends for Electron dev");
    await runCommand(nodeBinary, [serversScript, "install", "all"], {
      cwd: repoRoot,
      env: process.env,
    });
  }

  logStep("Starting Vite dev server");
  const viteProcess = spawn(nodeBinary, [viteCli, "--host", options.viteHost], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
    shell: false,
    windowsHide: false,
  });

  try {
    await waitForProcessPort(
      viteProcess,
      "Vite dev server",
      options.viteHost,
      options.vitePort,
      120000,
    );
  } catch (error) {
    await stopChild(viteProcess);
    throw error;
  }

  logStep("Starting Electron dev shell");
  const electronProcess = spawn(electronBinary, ["."], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
    shell: false,
    windowsHide: false,
  });

  await superviseChildren([
    { label: "Electron", child: electronProcess, primary: true },
    { label: "Vite", child: viteProcess, primary: false },
  ]);
}


async function runBuild(options) {
  assertFileExists(viteCli, "Vite CLI");
  assertFileExists(electronBuilderCli, "electron-builder CLI");

  const targetPlatform = resolveElectronPlatform(options.platform);
  const localBuild = options.profile === "local";
  const buildVersion = resolveBuildVersion(options);
  const outputDir = options.outputDir || path.join(
    repoRoot,
    "release",
    localBuild ? `${targetPlatform.label}-local` : `${targetPlatform.label}-${timestamp()}`,
  );
  const builderEnv = {
    ...process.env,
    ELECTRON_OUTPUT_DIR: outputDir,
    ELECTRON_APP_VERSION: buildVersion.value,
  };

  console.log(`Electron build output directory: ${outputDir}`);
  console.log(`Electron app version: ${buildVersion.value} (${buildVersion.source})`);

  if (!options.skipIcons) {
    logStep("Generating icon assets");
    await runCommand(nodeBinary, [createIconsScript], {
      cwd: repoRoot,
      env: process.env,
    });
  }

  if (!options.skipServerBuild) {
    logStep("Building bundled Python backends");
    await runCommand(nodeBinary, [serversScript, "build", "all",
      ...(options.skipServerInstall ? ["--skip-install"] : []),
      ...(options.clean ? ["--clean"] : []),
    ], {
      cwd: repoRoot,
      env: process.env,
    });
  }

  logStep("Building frontend with Vite");
  await runCommand(nodeBinary, [viteCli, "build"], {
    cwd: repoRoot,
    env: process.env,
  });

  logStep("Running Electron pre-pack checks");
  await runCommand(nodeBinary, [beforeBuildScript], {
    cwd: repoRoot,
    env: process.env,
  });

  if (!options.skipBuilder) {
    const builderArgs = [
      electronBuilderCli,
      ...resolveBuilderArgs(targetPlatform.key, options.profile),
      ...resolveBuilderArchArgs(options.arch || (localBuild ? process.arch : null)),
      ...(localBuild ? ["--config.compression=store"] : []),
      `--config.directories.output=${outputDir}`,
      `--config.extraMetadata.version=${buildVersion.value}`,
      `--config.buildVersion=${buildVersion.value}`,
      "--publish",
      "never",
    ];

    logStep(`Packaging Electron app for ${targetPlatform.label}`);
    await runCommand(nodeBinary, builderArgs, {
      cwd: repoRoot,
      env: builderEnv,
    });
  } else {
    console.log("Skipping electron-builder packaging.");
  }

  if (!options.skipProtectAsar && !options.skipBuilder && !localBuild) {
    logStep("Protecting ASAR bundle");
    await runCommand(nodeBinary, [protectAsarScript], {
      cwd: repoRoot,
      env: builderEnv,
    });
  } else {
    console.log("Skipping ASAR protection.");
  }
}


function resolveElectronPlatform(rawPlatform) {
  const platform = rawPlatform === "current" ? currentPlatformKey() : rawPlatform;

  switch (platform) {
    case "win":
      return { key: "win", label: "windows" };
    case "linux":
      return { key: "linux", label: "linux" };
    case "mac":
      return { key: "mac", label: "macos" };
    default:
      throw new Error(`Unsupported Electron platform: ${rawPlatform}`);
  }
}


function currentPlatformKey() {
  if (process.platform === "win32") {
    return "win";
  }

  if (process.platform === "darwin") {
    return "mac";
  }

  return "linux";
}


function resolveBuilderArgs(platform, profile) {
  if (profile === "local") {
    return [`--${platform}`, "--dir"];
  }

  if (platform === "win") {
    if (profile === "msi") {
      return ["--win", "msi"];
    }

    if (profile === "store") {
      return ["--win", "appx"];
    }

    return ["--win", "nsis", "portable"];
  }

  if (profile !== "standard") {
    console.warn(`Profile "${profile}" is ignored for ${platform} builds.`);
  }

  if (platform === "linux") {
    return ["--linux"];
  }

  return ["--mac"];
}


function resolveBuilderArchArgs(arch) {
  return arch ? [`--${arch}`] : [];
}


function assertFileExists(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${label} was not found: ${targetPath}`);
  }
}


function resolveBuildVersion(options) {
  const packageMetadata = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const packageVersion = packageMetadata.version;

  if (!isValidSemver(packageVersion)) {
    throw new Error(`package.json version is not a valid semver value: ${packageVersion}`);
  }

  const explicitVersion = options.appVersion || process.env.ELECTRON_APP_VERSION || process.env.APP_VERSION;
  if (explicitVersion) {
    if (!isValidSemver(explicitVersion)) {
      throw new Error(`Build version must be a valid semver value: ${explicitVersion}`);
    }

    return {
      value: explicitVersion,
      source: options.appVersion ? "cli --app-version" : "environment",
    };
  }

  if (options.versionMode === "package") {
    return {
      value: packageVersion,
      source: "package.json",
    };
  }

  if (options.versionMode === "branch") {
    const buildBranch = resolveBuildBranch(options);
    const buildNumber = resolveBuildNumber(options);
    const branchVersion = createBranchBuildSemver(packageVersion, buildBranch, buildNumber);

    return {
      value: branchVersion,
      source: `branch "${buildBranch}" build ${buildNumber}`,
    };
  }

  return {
    value: createTimestampSemver(new Date()),
    source: "generated UTC timestamp",
  };
}


function resolveBuildBranch(options) {
  return (
    options.buildBranch ||
    process.env.ELECTRON_BUILD_BRANCH ||
    process.env.BUILD_BRANCH ||
    process.env.GITHUB_REF_NAME ||
    process.env.CI_COMMIT_REF_NAME ||
    process.env.BRANCH_NAME ||
    normalizeGitBranch(process.env.GIT_BRANCH) ||
    readGitValue(["rev-parse", "--abbrev-ref", "HEAD"]) ||
    "local"
  );
}


function resolveBuildNumber(options) {
  const rawBuildNumber = (
    options.buildNumber ||
    process.env.ELECTRON_BUILD_NUMBER ||
    process.env.APP_BUILD_NUMBER ||
    process.env.BUILD_NUMBER ||
    process.env.GITHUB_RUN_NUMBER ||
    process.env.CI_PIPELINE_IID ||
    process.env.CI_PIPELINE_ID ||
    process.env.CI_BUILD_ID ||
    readGitValue(["rev-list", "--count", "HEAD"]) ||
    createFallbackBuildNumber(new Date())
  );

  return normalizeBuildNumber(rawBuildNumber);
}


function normalizeGitBranch(value) {
  if (!value) {
    return "";
  }

  return String(value).replace(/^origin\//, "");
}


function readGitValue(args) {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}


function createFallbackBuildNumber(now) {
  const year = now.getUTCFullYear();
  const startOfYearUtcMs = Date.UTC(year, 0, 1);
  const nowUtcMs = Date.UTC(
    year,
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds(),
  );
  const dayOfYear = Math.floor((nowUtcMs - startOfYearUtcMs) / 86400000) + 1;
  const secondsSinceMidnight = (
    now.getUTCHours() * 3600
    + now.getUTCMinutes() * 60
    + now.getUTCSeconds()
  );

  return `${dayOfYear}${String(secondsSinceMidnight).padStart(5, "0")}`;
}


function normalizeBuildNumber(value) {
  const digits = String(value ?? "").match(/\d+/g)?.join("") ?? "";
  const normalized = digits.replace(/^0+(?=\d)/, "");
  return normalized || "0";
}


function createBranchBuildSemver(packageVersion, branch, buildNumber) {
  const branchId = sanitizePrereleaseIdentifier(branch);
  const value = `${packageVersion}-${branchId}.${buildNumber}`;

  if (!isValidSemver(value)) {
    throw new Error(`Generated branch build version is not a valid semver value: ${value}`);
  }

  return value;
}


function sanitizePrereleaseIdentifier(value) {
  const raw = String(value || "local").trim().toLowerCase();
  const normalized = raw
    .replace(/[^0-9a-z-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  const fallback = normalized || "local";

  return fallback
    .split("-")
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) ? `b${part}` : part))
    .join("-") || "local";
}


function createTimestampSemver(now) {
  const year = now.getUTCFullYear();
  const startOfYearUtcMs = Date.UTC(year, 0, 1);
  const nowUtcMs = Date.UTC(
    year,
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds(),
  );
  const dayOfYear = Math.floor((nowUtcMs - startOfYearUtcMs) / 86400000) + 1;
  const secondsSinceMidnight = (
    now.getUTCHours() * 3600
    + now.getUTCMinutes() * 60
    + now.getUTCSeconds()
  );

  return `${year}.${dayOfYear}.${secondsSinceMidnight}`;
}


function isValidSemver(value) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(value);
}


function waitForProcessPort(child, label, host, port, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (callback) => (value) => {
      if (settled) {
        return;
      }

      settled = true;
      child.removeListener("error", onError);
      child.removeListener("exit", onExit);
      callback(value);
    };

    const onError = finish(reject);
    const onExit = finish((details) => {
      reject(
        new Error(
          `${label} exited before startup was complete (code=${details.code ?? "null"}, signal=${details.signal ?? "null"})`,
        ),
      );
    });

    child.once("error", onError);
    child.once("exit", (code, signal) => onExit({ code, signal }));

    waitForPort(host, port, timeoutMs, 500).then(finish(resolve)).catch(finish(reject));
  });
}


async function superviseChildren(processes) {
  const stopAll = async () => {
    await Promise.all(processes.map(({ child }) => stopChild(child)));
  };

  const onSignal = async () => {
    await stopAll();
  };

  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);

  try {
    const result = await Promise.race(
      processes.map(({ label, child, primary }) => waitForChildExit(label, child, primary)),
    );

    await stopAll();

    if (result.primary && result.code === 0) {
      return;
    }

    throw new Error(
      `${result.label} exited with code=${result.code ?? "null"} signal=${result.signal ?? "null"}`,
    );
  } finally {
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
  }
}


function waitForChildExit(label, child, primary) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      resolve({ label, code, signal, primary });
    });
  });
}


function stopChild(child) {
  if (!child || child.exitCode !== null || child.killed) {
    return Promise.resolve();
  }

  if (process.platform === "win32") {
    return new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
        windowsHide: true,
      });
      killer.once("exit", () => resolve());
      killer.once("error", () => resolve());
    });
  }

  return new Promise((resolve) => {
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
    setTimeout(resolve, 500);
  });
}


if (require.main === module) {
  main().catch((error) => {
    console.error(`Electron orchestration failed: ${error.message}`);
    process.exit(1);
  });
}

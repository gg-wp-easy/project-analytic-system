const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { autoUpdater } = require("electron-updater");

const LOG_FILE_NAME = "app.log";
const LOG_IPC_CHANNEL = "app:log";
const CHECK_FOR_UPDATES_CHANNEL = "app:check-for-updates";
const INSTALL_UPDATE_CHANNEL = "app:install-update";
const UPDATE_STATUS_CHANNEL = "app:update-status";
const GET_LOG_INFO_CHANNEL = "app:get-log-info";
const OPEN_LOGS_DIRECTORY_CHANNEL = "app:open-logs-directory";
const LOG_LEVELS = new Set(["debug", "info", "warn", "error"]);
const AUTO_UPDATE_INITIAL_DELAY_MS = 12_000;
const AUTO_UPDATE_INTERVAL_MS = 4 * 60 * 60 * 1000;

let log;
try {
  log = require("electron-log");
  if (typeof log.initialize === "function") {
    log.initialize({ spyRendererConsole: true });
  }
} catch (error) {
  console.error("electron-log is unavailable, using console fallback.", error);
  log = {
    transports: {
      console: { level: "debug", format: "{text}" },
      file: { level: "info", format: "{text}" },
    },
    info: (...args) => console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
    debug: (...args) => console.debug(...args),
  };
}

if (log.transports && log.transports.console) {
  log.transports.console.level = "debug";
  log.transports.console.format = "[{h}:{i}:{s}.{ms}] > {text}";
}

if (log.transports && log.transports.file) {
  log.transports.file.level = "debug";
  log.transports.file.fileName = LOG_FILE_NAME;
  log.transports.file.format = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}";
  log.transports.file.resolvePathFn = () => getAppLogFilePath();
}

if (typeof log.catchErrors === "function") {
  log.catchErrors({ showDialog: false });
}

app.commandLine.appendSwitch("ignore-certificate-errors");

const isDev = !app.isPackaged;
const APP_ID = "com.invest.analytics.desktop";
const DEFAULT_HOST = "127.0.0.1";

let splashWindow = null;
let mainWindow = null;
const managedServices = new Map();
let autoUpdateHandlersAttached = false;
let autoUpdateCheckScheduled = false;
let autoUpdateCheckInFlight = null;
let autoUpdateIntervalId = null;

const BACKEND_SERVICES = [
  {
    key: "analytics",
    displayName: "server-analytic-system",
    host: DEFAULT_HOST,
    port: 8000,
    healthPath: "/health",
    required: true,
    resolveRunConfig: resolveAnalyticsRunConfig,
  },
];

registerAppIpcHandlers();

function getProjectRoot() {
  return path.join(__dirname, "..");
}

function ensureDirectorySilent(targetPath) {
  try {
    fs.mkdirSync(targetPath, { recursive: true });
  } catch {
    // The file transport will report write errors if the directory is not usable.
  }
}

function configureAppLogsDirectory() {
  try {
    const logsDir = path.join(app.getPath("userData"), "logs");
    app.setAppLogsPath(logsDir);
    ensureDirectorySilent(logsDir);
  } catch (error) {
    console.warn("Failed to configure application logs directory.", error);
  }
}

function getAppLogsDirectory() {
  const candidates = [
    () => app.getPath("logs"),
    () => path.join(app.getPath("userData"), "logs"),
    () => path.join(os.tmpdir(), "nk-invest-analytics-logs"),
  ];

  for (const resolveCandidate of candidates) {
    try {
      const logsDir = resolveCandidate();
      ensureDirectorySilent(logsDir);
      return logsDir;
    } catch {
      // Try the next candidate.
    }
  }

  const fallbackDir = path.join(os.tmpdir(), "nk-invest-analytics-logs");
  ensureDirectorySilent(fallbackDir);
  return fallbackDir;
}

function getAppLogFilePath() {
  return path.join(getAppLogsDirectory(), LOG_FILE_NAME);
}

function normalizeRendererLogArg(value) {
  if (value && typeof value === "object" && typeof value.message === "string") {
    const name = typeof value.name === "string" ? value.name : "Error";
    const stack = typeof value.stack === "string" ? `\n${value.stack}` : "";
    return `${name}: ${value.message}${stack}`;
  }

  return value;
}

function registerAppIpcHandlers() {
  ipcMain.on(LOG_IPC_CHANNEL, (_event, payload = {}) => {
    const level = LOG_LEVELS.has(payload.level) ? payload.level : "info";
    const data = Array.isArray(payload.data) ? payload.data.map(normalizeRendererLogArg) : [];
    log[level]("[renderer]", ...data);
  });

  ipcMain.handle(CHECK_FOR_UPDATES_CHANNEL, async () => {
    return performAutoUpdateCheck({ manual: true });
  });

  ipcMain.handle(INSTALL_UPDATE_CHANNEL, async () => {
    if (!shouldEnableAutoUpdate()) {
      return {
        status: "disabled",
        message: "Auto-update is unavailable for this build.",
      };
    }

    autoUpdater.quitAndInstall(false, true);
    return {
      status: "installing",
      message: "Installing update.",
    };
  });

  ipcMain.handle(GET_LOG_INFO_CHANNEL, async () => {
    return {
      logsDirectory: getAppLogsDirectory(),
      logFilePath: getAppLogFilePath(),
    };
  });

  ipcMain.handle(OPEN_LOGS_DIRECTORY_CHANNEL, async () => {
    const logsDirectory = getAppLogsDirectory();
    const result = await shell.openPath(logsDirectory);
    return {
      status: result ? "error" : "ok",
      message: result,
      logsDirectory,
      logFilePath: getAppLogFilePath(),
    };
  });
}

function resolveWindowIconPath() {
  const iconName = process.platform === "win32"
    ? "icon.ico"
    : process.platform === "darwin"
      ? "icon.icns"
      : "icon.png";

  const iconPath = path.join(__dirname, iconName);
  return fs.existsSync(iconPath) ? iconPath : undefined;
}

function getServiceHealthUrl(service) {
  return `http://${service.host}:${service.port}${service.healthPath}`;
}

function pingServiceHealth(service) {
  return new Promise((resolve) => {
    const req = http.get(getServiceHealthUrl(service), (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        log.info(`[${service.displayName}] health response: ${res.statusCode} - ${data}`);
        resolve(res.statusCode === 200);
      });
    });

    req.on("error", (err) => {
      log.warn(`[${service.displayName}] health check error: ${err.message}`);
      resolve(false);
    });

    req.setTimeout(1200, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServiceHealth(service, timeoutMs = 60000, intervalMs = 600) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    if (await pingServiceHealth(service)) {
      return true;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

function resolveProjectPython(serverDir) {
  const candidates = process.platform === "win32"
    ? [path.join(serverDir, ".venv", "Scripts", "python.exe"), "python"]
    : [path.join(serverDir, ".venv", "bin", "python"), "python3", "python"];

  for (const candidate of candidates) {
    if (!candidate.includes(path.sep) || fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return process.platform === "win32" ? "python" : "python3";
}

function ensureDirectory(targetPath) {
  try {
    fs.mkdirSync(targetPath, { recursive: true });
  } catch (error) {
    log.warn(`Failed to ensure directory ${targetPath}:`, error);
  }
}

function createServiceUserDirs(relativeDirName) {
  const rootDir = path.join(app.getPath("userData"), relativeDirName);
  const logDir = path.join(rootDir, "logs");
  const dataDir = path.join(rootDir, "data");
  const cacheDir = path.join(rootDir, "cache");
  const matplotlibCacheDir = path.join(cacheDir, "matplotlib");

  ensureDirectory(rootDir);
  ensureDirectory(logDir);
  ensureDirectory(dataDir);
  ensureDirectory(cacheDir);
  ensureDirectory(matplotlibCacheDir);

  return { rootDir, logDir, dataDir, cacheDir, matplotlibCacheDir };
}

function resolveAnalyticsExecutablePath() {
  const exeName = process.platform === "win32"
    ? "server-analytic-system.exe"
    : "server-analytic-system";

  if (app.isPackaged) {
    const packagedExePath = path.join(process.resourcesPath, "server", exeName);
    return fs.existsSync(packagedExePath) ? packagedExePath : null;
  }

  const projectRoot = getProjectRoot();
  const candidates = [
    path.join(projectRoot, "server-analytic-system", "dist", "server-analytic-system", exeName),
    path.join(projectRoot, "server-analytic-system", "dist", exeName),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolveAnalyticsRunConfig() {
  const exePath = resolveAnalyticsExecutablePath();
  if (exePath) {
    const dirs = createServiceUserDirs("analytics-server");
    return {
      command: exePath,
      args: [],
      cwd: path.dirname(exePath),
      env: {
        ...process.env,
        ANALYTIC_LOG_DIR: dirs.logDir,
        ANALYTIC_DATA_DIR: dirs.dataDir,
      },
    };
  }

  if (app.isPackaged) {
    return null;
  }

  const serverDir = path.join(getProjectRoot(), "server-analytic-system");
  const mainPy = path.join(serverDir, "main.py");
  if (!fs.existsSync(mainPy)) {
    return null;
  }

  return {
    command: resolveProjectPython(serverDir),
    args: ["main.py"],
    cwd: serverDir,
  };
}

function killProcessTree(pid) {
  if (!pid) {
    return Promise.resolve();
  }

  if (process.platform === "win32") {
    return new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(pid), "/t", "/f"], {
        windowsHide: true,
        stdio: "ignore",
      });
      killer.on("exit", () => resolve());
      killer.on("error", () => resolve());
    });
  }

  return new Promise((resolve) => {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      resolve();
      return;
    }
    setTimeout(resolve, 400);
  });
}

async function stopManagedService(serviceKey) {
  const state = managedServices.get(serviceKey);
  if (!state || !state.process) {
    return;
  }

  managedServices.delete(serviceKey);
  await killProcessTree(state.process.pid);
}

async function stopAllManagedServices() {
  const serviceKeys = Array.from(managedServices.keys());
  await Promise.all(serviceKeys.map((key) => stopManagedService(key)));
}

async function ensureService(service) {
  if (await pingServiceHealth(service)) {
    managedServices.delete(service.key);
    return true;
  }

  const runConfig = service.resolveRunConfig();
  if (!runConfig) {
    const error = new Error(`${service.displayName} executable was not found.`);
    if (service.required) {
      throw error;
    }
    log.warn(error.message);
    return false;
  }

  const child = spawn(runConfig.command, runConfig.args, {
    cwd: runConfig.cwd,
    env: runConfig.env,
    stdio: "ignore",
    windowsHide: true,
  });

  managedServices.set(service.key, { process: child, service });

  child.on("error", (error) => {
    log.error(`[${service.displayName}] process error:`, error);
  });

  child.on("exit", (code, signal) => {
    managedServices.delete(service.key);
    log.info(`[${service.displayName}] stopped with code=${code ?? "null"} signal=${signal ?? "null"}`);
  });

  const healthy = await waitForServiceHealth(service);
  if (!healthy) {
    await stopManagedService(service.key);
    const error = new Error(`${service.displayName} did not start in time.`);
    if (service.required) {
      throw error;
    }
    log.warn(error.message);
    return false;
  }

  log.info(`[${service.displayName}] is ready at ${getServiceHealthUrl(service)}`);
  return true;
}

async function ensureBackendServices() {
  for (const service of BACKEND_SERVICES.filter((item) => item.required)) {
    // eslint-disable-next-line no-await-in-loop
    await ensureService(service);
  }

  for (const service of BACKEND_SERVICES.filter((item) => !item.required)) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await ensureService(service);
    } catch (error) {
      log.warn(`Optional service ${service.displayName} is unavailable:`, error);
    }
  }
}

function createSplashWindow() {
  const iconPath = resolveWindowIconPath();
  splashWindow = new BrowserWindow({
    width: 520,
    height: 320,
    frame: false,
    transparent: false,
    resizable: false,
    movable: false,
    show: true,
    alwaysOnTop: true,
    center: true,
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  splashWindow.loadFile(path.join(__dirname, "splash.html"), {
    query: {
      version: app.getVersion(),
    },
  });
  splashWindow.on("closed", () => {
    splashWindow = null;
  });
}

function createMainWindow() {
  const iconPath = resolveWindowIconPath();
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
    mainWindow.show();
    scheduleAutoUpdateCheck();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  return mainWindow;
}

function isPortableBuild() {
  return process.platform === "win32" && Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
}

function isInstalledWindowsApp() {
  if (process.platform !== "win32") {
    return true;
  }

  try {
    const executableDir = path.dirname(process.execPath);
    const siblingFiles = fs.readdirSync(executableDir);
    return siblingFiles.some((fileName) => /^uninstall .*\.exe$/i.test(fileName));
  } catch (error) {
    log.warn("Failed to detect the Windows installation state:", error);
    return false;
  }
}

function resolveUpdateConfigPath() {
  return path.join(process.resourcesPath, "app-update.yml");
}

function shouldEnableAutoUpdate() {
  if (!app.isPackaged) {
    return false;
  }

  if (isPortableBuild()) {
    log.info("Auto-update is disabled for the portable build.");
    return false;
  }

  if (!isInstalledWindowsApp()) {
    log.info("Auto-update is disabled because the application is not installed.");
    return false;
  }

  const updateConfigPath = resolveUpdateConfigPath();
  if (!fs.existsSync(updateConfigPath)) {
    log.info(`Auto-update configuration was not found: ${updateConfigPath}`);
    return false;
  }

  return true;
}

function attachAutoUpdateHandlers() {
  if (autoUpdateHandlersAttached) {
    return;
  }

  autoUpdateHandlersAttached = true;
  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    log.info(`Checking for updates. Current version: ${app.getVersion()}`);
  });

  autoUpdater.on("update-available", (info) => {
    log.info(`Update available: ${info.version}`);
    sendUpdateStatus({
      status: "available",
      version: info.version,
      message: "Update is available.",
    });
  });

  autoUpdater.on("update-not-available", () => {
    log.info("No application updates are currently available.");
    sendUpdateStatus({
      status: "not-available",
      message: "No updates are available.",
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    log.info(`Update download progress: ${Math.round(progress.percent)}%`);
    sendUpdateStatus({
      status: "downloading",
      progress: Math.round(progress.percent),
      message: "Update download is in progress.",
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    log.info(`Update downloaded: ${info.version}`);
    sendUpdateStatus({
      status: "downloaded",
      version: info.version,
      message: "Update is ready to install.",
    });
  });

  autoUpdater.on("error", (error) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    log.error(`Auto-update failed: ${message}`);
    sendUpdateStatus({
      status: "error",
      message,
    });
  });
}

function sendUpdateStatus(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send(UPDATE_STATUS_CHANNEL, payload);
}

async function performAutoUpdateCheck({ manual = false } = {}) {
  if (!shouldEnableAutoUpdate()) {
    return {
      status: "disabled",
      message: "Auto-update is unavailable for this build.",
    };
  }

  attachAutoUpdateHandlers();

  if (autoUpdateCheckInFlight) {
    return autoUpdateCheckInFlight;
  }

  autoUpdateCheckInFlight = autoUpdater
    .checkForUpdates()
    .then((result) => {
      const hasDownload = Boolean(result?.downloadPromise);
      if (hasDownload) {
        const version = result?.updateInfo?.version || "";
        return {
          status: "available",
          version,
          message: version
            ? `Update ${version} found. Download has started.`
            : "An update was found. Download has started.",
        };
      }

      return {
        status: "not-available",
        message: manual
          ? "You already have the latest version installed."
          : "No updates are available.",
      };
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      log.error("Unable to check for updates:", error);
      sendUpdateStatus({
        status: "error",
        message,
      });
      return {
        status: "error",
        message,
      };
    })
    .finally(() => {
      autoUpdateCheckInFlight = null;
    });

  return autoUpdateCheckInFlight;
}

function scheduleAutoUpdateCheck() {
  if (autoUpdateCheckScheduled || !shouldEnableAutoUpdate()) {
    return;
  }

  autoUpdateCheckScheduled = true;
  attachAutoUpdateHandlers();

  setTimeout(() => {
    performAutoUpdateCheck().catch((error) => {
      log.error("Unable to run the initial update check:", error);
    });
  }, AUTO_UPDATE_INITIAL_DELAY_MS);

  autoUpdateIntervalId = setInterval(() => {
    performAutoUpdateCheck().catch((error) => {
      log.error("Unable to run the scheduled update check:", error);
    });
  }, AUTO_UPDATE_INTERVAL_MS);
}

app.whenReady().then(async () => {
  configureAppLogsDirectory();
  log.info(`Application started. Version=${app.getVersion()}, packaged=${app.isPackaged}, logFile=${getAppLogFilePath()}`);

  if (process.platform === "win32") {
    app.setAppUserModelId(APP_ID);
  }

  createSplashWindow();

  try {
    await ensureBackendServices();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown startup error";
    dialog.showErrorBox("Server Startup Error", message);
    app.quit();
    return;
  }

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("before-quit", async () => {
  if (autoUpdateIntervalId) {
    clearInterval(autoUpdateIntervalId);
    autoUpdateIntervalId = null;
  }
  await stopAllManagedServices();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

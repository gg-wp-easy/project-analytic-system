const { app, BrowserWindow, ipcMain, shell } = require("electron");
const fs = require("fs");
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
const TOGGLE_FULLSCREEN_CHANNEL = "app:toggle-fullscreen";
const GET_FULLSCREEN_STATE_CHANNEL = "app:get-fullscreen-state";
const FULLSCREEN_STATE_CHANGED_CHANNEL = "app:fullscreen-state-changed";
const SET_THEME_CHANNEL = "app:set-theme";
const THEME_FILE_NAME = "theme.json";
const SPLASH_THEMES = {
  light: "#ffffff",
  dark: "#0f172a",
};
const LOG_LEVELS = new Set(["debug", "info", "warn", "error"]);
const AUTO_UPDATE_INITIAL_DELAY_MS = 12_000;
const AUTO_UPDATE_INTERVAL_MS = 4 * 60 * 60 * 1000;

let log;
try {
  log = require("electron-log");
  if (typeof log.initialize === "function") {
    log.initialize({ spyRendererConsole: false });
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

const isDev = !app.isPackaged;
const APP_ID = "com.invest.analytics.desktop";

let splashWindow = null;
let mainWindow = null;
let autoUpdateHandlersAttached = false;
let autoUpdateCheckScheduled = false;
let autoUpdateCheckInFlight = null;
let autoUpdateIntervalId = null;

// Расчёты и рыночные данные — на сервере платформы NK-Tech Finance (адрес задаётся при
// сборке в VITE_PLATFORM_URL); встроенного Python-сервера больше нет.

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

function getThemeFilePath() {
  return path.join(app.getPath("userData"), THEME_FILE_NAME);
}

// The renderer keeps the theme in localStorage, which the main process cannot read
// before the main window exists, so the renderer mirrors it into a small file.
function readSavedTheme() {
  try {
    const saved = JSON.parse(fs.readFileSync(getThemeFilePath(), "utf8"));
    return saved?.theme === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function saveTheme(theme) {
  try {
    fs.writeFileSync(getThemeFilePath(), JSON.stringify({ theme }), "utf8");
  } catch (error) {
    log.warn("Failed to persist theme:", error);
  }
}

function registerAppIpcHandlers() {
  ipcMain.on(SET_THEME_CHANNEL, (_event, theme) => {
    if (theme === "light" || theme === "dark") {
      saveTheme(theme);
    }
  });

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

  ipcMain.handle(TOGGLE_FULLSCREEN_CHANNEL, (event) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);
    if (!targetWindow || targetWindow.isDestroyed()) {
      return { isFullscreen: false };
    }

    const nextState = !targetWindow.isFullScreen();
    targetWindow.setFullScreen(nextState);
    return { isFullscreen: nextState };
  });

  ipcMain.handle(GET_FULLSCREEN_STATE_CHANNEL, (event) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);
    return { isFullscreen: Boolean(targetWindow && !targetWindow.isDestroyed() && targetWindow.isFullScreen()) };
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

function createSplashWindow() {
  const iconPath = resolveWindowIconPath();
  const theme = readSavedTheme();
  splashWindow = new BrowserWindow({
    width: 620,
    height: 300,
    frame: false,
    transparent: false,
    resizable: false,
    movable: false,
    show: true,
    alwaysOnTop: true,
    center: true,
    autoHideMenuBar: true,
    backgroundColor: SPLASH_THEMES[theme],
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
      theme,
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
    backgroundColor: SPLASH_THEMES[readSavedTheme()],
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

  mainWindow.on("enter-full-screen", () => {
    sendFullscreenState(true);
  });

  mainWindow.on("leave-full-screen", () => {
    sendFullscreenState(false);
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

function sendFullscreenState(isFullscreen) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send(FULLSCREEN_STATE_CHANGED_CHANNEL, { isFullscreen });
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
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("before-quit", () => {
  if (autoUpdateIntervalId) {
    clearInterval(autoUpdateIntervalId);
    autoUpdateIntervalId = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

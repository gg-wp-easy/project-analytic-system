const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");
const log = require('electron-log/main');

// **Важно:** Вызовите initialize для поддержки логирования из процессов рендерера
log.initialize();

// --- Настройка транспортов (куда отправлять логи) ---

// 1. Настройка вывода в консоль
// Уровень 'debug' будет показывать всё в режиме разработки
log.transports.console.level = 'debug';
// Можно задать свой формат для консоли
log.transports.console.format = '[{h}:{i}:{s}.{ms}] › {text}';

// 2. Настройка сохранения в файл
// Уровень 'info' — в файл пишутся события info, warn, error и выше
log.transports.file.level = 'info';
// Кастомный формат для файла с датой
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

app.commandLine.appendSwitch('ignore-certificate-errors');

const isDev = !app.isPackaged;
const SERVER_HOST = "127.0.0.1";
const SERVER_PORT = 8000;
const SERVER_HEALTH_URL = `http://${SERVER_HOST}:${SERVER_PORT}/health`;

let splashWindow = null;
let serverProcess = null;
let serverManagedByApp = false;

function pingServerHealth() {
  return new Promise((resolve) => {
    const req = http.get(SERVER_HEALTH_URL, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        log.info(`Health check response: ${res.statusCode} - ${data}`);
        resolve(res.statusCode === 200);
      });
    });
    
    req.on("error", (err) => {
      log.error('Health check error:', err.message);
      resolve(false);
    });
    
    req.setTimeout(1200, () => {
      req.destroy();
      log.warn('Health check timeout');
      resolve(false);
    });
  });
}

async function waitForServerHealth(timeoutMs = 60000, intervalMs = 600) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    if (await pingServerHealth()) {
      return true;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

function resolveServerExecutablePath() {
  const exeName = "server-analytic-system.exe";

  if (app.isPackaged) {
    const packagedExePath = path.join(process.resourcesPath, "server", exeName);
    if (fs.existsSync(packagedExePath)) {
      return packagedExePath;
    }
    return null;
  }

  const projectRoot = path.join(__dirname, "..");
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

function resolveServerCommand() {
  const exePath = resolveServerExecutablePath();
  if (exePath) {
    return {
      command: exePath,
      args: [],
      cwd: path.dirname(exePath),
    };
  }

  if (app.isPackaged) {
    return null;
  }

  const projectRoot = path.join(__dirname, "..");
  const serverDir = path.join(projectRoot, "server-analytic-system");
  const mainPy = path.join(serverDir, "main.py");
  if (!fs.existsSync(mainPy)) {
    return null;
  }

  return {
    command: "python",
    args: ["main.py"],
    cwd: serverDir,
  };
}

function killServerProcess(pid) {
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

async function stopServerService() {
  if (!serverManagedByApp || !serverProcess) {
    return;
  }
  const pid = serverProcess.pid;
  serverProcess = null;
  serverManagedByApp = false;
  await killServerProcess(pid);
}

async function ensureServerService() {
  if (await pingServerHealth()) {
    serverManagedByApp = false;
    return;
  }

  const runConfig = resolveServerCommand();
  if (!runConfig) {
    throw new Error("Server executable not found. Build server-analytic-system from main.py first.");
  }

  serverProcess = spawn(runConfig.command, runConfig.args, {
    cwd: runConfig.cwd,
    stdio: "ignore",
    windowsHide: true,
  });
  serverManagedByApp = true;

  serverProcess.on("exit", () => {
    serverProcess = null;
    serverManagedByApp = false;
  });

  const healthy = await waitForServerHealth();
  if (!healthy) {
    await stopServerService();
    throw new Error("server-analytic-system did not start in time.");
  }
}

function createSplashWindow() {
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
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  splashWindow.loadFile(path.join(__dirname, "splash.html"));
  splashWindow.on("closed", () => {
    splashWindow = null;
  });
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
    win.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(async () => {
  createSplashWindow();

  try {
    await ensureServerService();
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
  await stopServerService();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

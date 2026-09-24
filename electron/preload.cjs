const { contextBridge, ipcRenderer } = require("electron");

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

function normalizeForIpc(value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  try {
    JSON.stringify(value);
    return value;
  } catch {
    return String(value);
  }
}

function sendLog(level, ...data) {
  ipcRenderer.send(LOG_IPC_CHANNEL, {
    level,
    data: data.map(normalizeForIpc),
  });
}

window.addEventListener("error", (event) => {
  sendLog("error", "Renderer uncaught error", {
    message: event.message,
    source: event.filename,
    line: event.lineno,
    column: event.colno,
    error: normalizeForIpc(event.error),
  });
});

window.addEventListener("unhandledrejection", (event) => {
  sendLog("error", "Renderer unhandled rejection", normalizeForIpc(event.reason));
});

contextBridge.exposeInMainWorld("electron", {
  isDesktop: true,
  checkForUpdates: () => ipcRenderer.invoke(CHECK_FOR_UPDATES_CHANNEL),
  installUpdate: () => ipcRenderer.invoke(INSTALL_UPDATE_CHANNEL),
  getLogInfo: () => ipcRenderer.invoke(GET_LOG_INFO_CHANNEL),
  openLogsDirectory: () => ipcRenderer.invoke(OPEN_LOGS_DIRECTORY_CHANNEL),
  toggleFullscreen: () => ipcRenderer.invoke(TOGGLE_FULLSCREEN_CHANNEL),
  getFullscreenState: () => ipcRenderer.invoke(GET_FULLSCREEN_STATE_CHANNEL),
  setTheme: (theme) => ipcRenderer.send(SET_THEME_CHANNEL, theme),
  onUpdateStatus: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on(UPDATE_STATUS_CHANNEL, handler);
    return () => ipcRenderer.removeListener(UPDATE_STATUS_CHANNEL, handler);
  },
  onFullscreenChange: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on(FULLSCREEN_STATE_CHANGED_CHANNEL, handler);
    return () => ipcRenderer.removeListener(FULLSCREEN_STATE_CHANGED_CHANNEL, handler);
  },
  log: {
    debug: (...data) => sendLog("debug", ...data),
    info: (...data) => sendLog("info", ...data),
    warn: (...data) => sendLog("warn", ...data),
    error: (...data) => sendLog("error", ...data),
  },
});

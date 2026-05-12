const { contextBridge, ipcRenderer } = require("electron");

const LOG_IPC_CHANNEL = "app:log";
const CHECK_FOR_UPDATES_CHANNEL = "app:check-for-updates";
const INSTALL_UPDATE_CHANNEL = "app:install-update";
const UPDATE_STATUS_CHANNEL = "app:update-status";

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
  onUpdateStatus: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on(UPDATE_STATUS_CHANNEL, handler);
    return () => ipcRenderer.removeListener(UPDATE_STATUS_CHANNEL, handler);
  },
  log: {
    debug: (...data) => sendLog("debug", ...data),
    info: (...data) => sendLog("info", ...data),
    warn: (...data) => sendLog("warn", ...data),
    error: (...data) => sendLog("error", ...data),
  },
});

const { contextBridge, ipcRenderer } = require("electron");

const LOG_IPC_CHANNEL = "app:log";
const OPEN_LOGS_DIRECTORY_CHANNEL = "app:open-logs-directory";
const GET_LOGS_DIRECTORY_CHANNEL = "app:get-logs-directory";
const CHECK_FOR_UPDATES_CHANNEL = "app:check-for-updates";

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
  getLogsDirectory: () => ipcRenderer.invoke(GET_LOGS_DIRECTORY_CHANNEL),
  openLogsDirectory: () => ipcRenderer.invoke(OPEN_LOGS_DIRECTORY_CHANNEL),
  checkForUpdates: () => ipcRenderer.invoke(CHECK_FOR_UPDATES_CHANNEL),
  log: {
    debug: (...data) => sendLog("debug", ...data),
    info: (...data) => sendLog("info", ...data),
    warn: (...data) => sendLog("warn", ...data),
    error: (...data) => sendLog("error", ...data),
  },
});

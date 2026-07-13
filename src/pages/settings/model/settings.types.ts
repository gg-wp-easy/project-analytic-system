export type StatusState = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

export type DesktopLogApi = {
  debug?: (...data: unknown[]) => void;
  info?: (...data: unknown[]) => void;
  warn?: (...data: unknown[]) => void;
  error?: (...data: unknown[]) => void;
};

export type UpdateStatusPayload = {
  status?: string;
  version?: string;
  progress?: number;
  message?: string;
};

export type LogInfo = {
  logsDirectory?: string;
  logFilePath?: string;
};

export type DesktopApi = {
  isDesktop?: boolean;
  checkForUpdates?: () => Promise<{ status?: string; message?: string; version?: string }>;
  installUpdate?: () => Promise<{ status?: string; message?: string }>;
  getLogInfo?: () => Promise<LogInfo>;
  openLogsDirectory?: () => Promise<{ status?: string; message?: string; logsDirectory?: string; logFilePath?: string }>;
  onUpdateStatus?: (listener: (payload: UpdateStatusPayload) => void) => () => void;
  log?: DesktopLogApi;
};

const fs = require("fs");
const net = require("net");
const path = require("path");
const { spawn, spawnSync } = require("child_process");


const repoRoot = path.resolve(__dirname, "..", "..");


function ensureDirectory(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}


function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join("") + "-" + [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}


function logStep(message) {
  console.log(`\n==> ${message}`);
}


function checkCommand(command, args = []) {
  const result = spawnSync(command, args, {
    stdio: "ignore",
    shell: false,
    windowsHide: true,
  });

  return result.status === 0;
}


function runCommand(command, args = [], options = {}) {
  const {
    cwd = repoRoot,
    env = process.env,
    stdio = "inherit",
    shell = false,
    windowsHide = true,
    allowNonZeroExit = false,
  } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio,
      shell,
      windowsHide,
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code, signal) => {
      if (code === 0 || allowNonZeroExit) {
        resolve({ code, signal });
        return;
      }

      reject(
        new Error(
          `Command failed (${code ?? "null"}): ${[command, ...args].join(" ")}`,
        ),
      );
    });
  });
}


function runForeground(command, args = [], options = {}) {
  const {
    cwd = repoRoot,
    env = process.env,
    windowsHide = false,
  } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: "inherit",
      shell: false,
      windowsHide,
    });

    const stopChild = () => {
      if (child.exitCode !== null || child.killed) {
        return;
      }

      if (process.platform === "win32") {
        const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
          stdio: "ignore",
          windowsHide: true,
        });
        killer.on("error", () => {});
      } else {
        child.kill("SIGTERM");
      }
    };

    const onSignal = (signal) => {
      stopChild();
      if (signal === "SIGINT") {
        resolve({ code: 130, signal });
      } else {
        resolve({ code: 143, signal });
      }
    };

    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);

    child.on("error", (error) => {
      process.removeListener("SIGINT", onSignal);
      process.removeListener("SIGTERM", onSignal);
      reject(error);
    });

    child.on("exit", (code, signal) => {
      process.removeListener("SIGINT", onSignal);
      process.removeListener("SIGTERM", onSignal);

      if (code === 0) {
        resolve({ code, signal });
        return;
      }

      reject(
        new Error(
          `Command failed (${code ?? "null"}): ${[command, ...args].join(" ")}`,
        ),
      );
    });
  });
}


function waitForPort(host, port, timeoutMs = 60000, intervalMs = 500) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = new net.Socket();

      socket.setTimeout(intervalMs);

      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });

      const retry = () => {
        socket.destroy();
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }

        setTimeout(tryConnect, intervalMs);
      };

      socket.once("timeout", retry);
      socket.once("error", retry);
      socket.connect(port, host);
    };

    tryConnect();
  });
}


module.exports = {
  checkCommand,
  ensureDirectory,
  logStep,
  repoRoot,
  runCommand,
  runForeground,
  sleep,
  timestamp,
  waitForPort,
};

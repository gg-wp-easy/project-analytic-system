#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const {
  checkCommand,
  ensureDirectory,
  logStep,
  repoRoot,
  runCommand,
  runForeground,
} = require("./lib/runtime.cjs");


const SERVER_CONFIG = {
  analytics: {
    key: "analytics",
    aliases: ["analytics", "server", "server-analytic-system"],
    dirName: "server-analytic-system",
    projectName: "server-analytic-system",
    entrypoint: ["main.py"],
    pythonEnvVar: "SERVER_ANALYTIC_PYTHON",
  },
};


async function main() {
  const { command, target, passthroughArgs, flags } = parseArgs(process.argv.slice(2));

  if (!command || flags.help) {
    printHelp();
    return;
  }

  const servers = resolveTargets(target, command);

  if (command === "install") {
    for (const server of servers) {
      await prepareServer(server, { install: true, build: false });
    }
    return;
  }

  if (command === "build") {
    for (const server of servers) {
      await prepareServer(server, {
        install: !flags.skipInstall,
        build: !flags.skipBuild,
      });
    }
    return;
  }

  if (command === "dev") {
    if (servers.length !== 1) {
      throw new Error("Dev mode supports only one server at a time.");
    }

    await prepareServer(servers[0], {
      install: !flags.skipInstall,
      build: false,
    });
    await runServerDev(servers[0], passthroughArgs);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}


function parseArgs(argv) {
  const args = [...argv];
  const passthroughIndex = args.indexOf("--");
  const passthroughArgs = passthroughIndex >= 0 ? args.slice(passthroughIndex + 1) : [];
  const rawArgs = passthroughIndex >= 0 ? args.slice(0, passthroughIndex) : args;
  const flags = {
    help: rawArgs[0] === "--help" || rawArgs[0] === "-h",
    skipInstall: false,
    skipBuild: false,
  };

  const command = rawArgs[0] === "--help" || rawArgs[0] === "-h" ? null : rawArgs[0];
  let target = rawArgs[1];

  for (const arg of rawArgs.slice(command ? 2 : 1)) {
    if (arg === "--help" || arg === "-h") {
      flags.help = true;
    } else if (arg === "--skip-install") {
      flags.skipInstall = true;
    } else if (arg === "--skip-build") {
      flags.skipBuild = true;
    } else if (!target) {
      target = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return {
    command,
    target,
    passthroughArgs,
    flags,
  };
}


function printHelp() {
  console.log(`
Usage:
  node scripts/servers.cjs install [analytics|all]
  node scripts/servers.cjs build [analytics|all] [--skip-install] [--skip-build]
  node scripts/servers.cjs dev [analytics] [--skip-install] [-- <extra args>]

Examples:
  node scripts/servers.cjs install all
  node scripts/servers.cjs build analytics
  node scripts/servers.cjs dev analytics
`);
}


function resolveTargets(rawTarget, command) {
  if (!rawTarget || rawTarget === "all") {
    if (command === "dev") {
      return [SERVER_CONFIG.analytics];
    }
    return Object.values(SERVER_CONFIG);
  }

  const normalized = rawTarget.toLowerCase();
  const matched = Object.values(SERVER_CONFIG).find((server) => server.aliases.includes(normalized));
  if (!matched) {
    throw new Error(`Unknown server target: ${rawTarget}`);
  }

  return [matched];
}


async function prepareServer(server, options) {
  const serverDir = path.join(repoRoot, server.dirName);
  const hostPython = resolvePythonLaunch(server.pythonEnvVar);
  const venvPython = getVenvPython(serverDir);
  const venvDir = path.dirname(path.dirname(venvPython));
  const buildRoot = path.join(serverDir, ".build");
  const tempDir = path.join(buildRoot, "temp");
  const pipCacheDir = path.join(buildRoot, "pip-cache");
  const env = {
    ...process.env,
    TEMP: tempDir,
    TMP: tempDir,
    TMPDIR: tempDir,
    PIP_CACHE_DIR: pipCacheDir,
  };

  ensureDirectory(buildRoot);
  ensureDirectory(tempDir);
  ensureDirectory(pipCacheDir);

  logStep(`Preparing ${server.dirName}`);

  if (!options.install && !fs.existsSync(venvPython)) {
    throw new Error(
      `Virtual environment for ${server.dirName} does not exist yet. Run install/build without --skip-install first.`,
    );
  }

  if (fs.existsSync(venvPython)) {
    console.log(`Reusing virtual environment: ${venvPython}`);
  } else {
    const recreateArgs = [
      ...hostPython.args,
      "-m",
      "venv",
      ...(fs.existsSync(venvDir) ? ["--clear"] : []),
      "--without-pip",
      ".venv",
    ];

    logStep(`Creating virtual environment with ${hostPython.label}`);
    await runCommand(hostPython.command, recreateArgs, {
      cwd: serverDir,
      env,
    });

    if (!fs.existsSync(venvPython)) {
      throw new Error(`Virtual environment was not created correctly: ${venvPython}`);
    }
  }

  if (options.install) {
    await installRequirements(serverDir, hostPython, venvPython, env);
  } else {
    console.log("Skipping dependency installation.");
  }

  if (options.build) {
    logStep(`Building ${server.projectName} with PyInstaller`);
    await runCommand(
      venvPython,
      [
        "build.py",
        "--mode",
        "pyinstaller",
        "--target",
        "current",
        "--project-name",
        server.projectName,
        "--clean",
      ],
      {
        cwd: serverDir,
        env,
      },
    );
  } else {
    console.log("Skipping build step.");
  }
}


async function installRequirements(serverDir, hostPython, venvPython, env) {
  const requirementsPath = path.join(serverDir, "requirements.txt");
  if (!fs.existsSync(requirementsPath)) {
    throw new Error(`requirements.txt was not found in ${serverDir}`);
  }

  if (hasVenvPip(venvPython)) {
    logStep("Installing Python dependencies");
    await runCommand(
      venvPython,
      ["-m", "pip", "install", "--disable-pip-version-check", "-r", "requirements.txt"],
      {
        cwd: serverDir,
        env,
      },
    );
    return;
  }

  try {
    logStep("Installing Python dependencies via host pip");
    await runCommand(
      hostPython.command,
      [
        ...hostPython.args,
        "-m",
        "pip",
        "--python",
        ".venv",
        "install",
        "--disable-pip-version-check",
        "-r",
        "requirements.txt",
      ],
      {
        cwd: serverDir,
        env,
      },
    );
    return;
  } catch (error) {
    console.warn("Host pip install into .venv failed, trying ensurepip fallback.");
  }

  await runCommand(venvPython, ["-m", "ensurepip", "--upgrade"], {
    cwd: serverDir,
    env,
  });

  await runCommand(
    venvPython,
    ["-m", "pip", "install", "--disable-pip-version-check", "-r", "requirements.txt"],
    {
      cwd: serverDir,
      env,
    },
  );
}


async function runServerDev(server, passthroughArgs) {
  const serverDir = path.join(repoRoot, server.dirName);
  const venvPython = getVenvPython(serverDir);

  logStep(`Starting ${server.dirName} in dev mode`);
  await runForeground(
    venvPython,
    [...server.entrypoint, ...passthroughArgs],
    {
      cwd: serverDir,
      env: process.env,
    },
  );
}


function resolvePythonLaunch(envVarName) {
  const override = process.env[envVarName];
  const candidates = [];

  if (override) {
    candidates.push({
      command: override,
      args: [],
      label: override,
    });
  }

  if (process.platform === "win32") {
    candidates.push(
      { command: "py", args: ["-3"], label: "py -3" },
      { command: "python", args: [], label: "python" },
    );
  } else {
    candidates.push(
      { command: "python3", args: [], label: "python3" },
      { command: "python", args: [], label: "python" },
    );
  }

  for (const candidate of candidates) {
    if (checkCommand(candidate.command, [...candidate.args, "--version"])) {
      return candidate;
    }
  }

  throw new Error(
    `Python was not found. Set ${envVarName} or install Python in PATH.`,
  );
}


function getVenvPython(serverDir) {
  return process.platform === "win32"
    ? path.join(serverDir, ".venv", "Scripts", "python.exe")
    : path.join(serverDir, ".venv", "bin", "python");
}


function hasVenvPip(venvPython) {
  const scriptsDir = path.dirname(venvPython);
  const pipName = process.platform === "win32" ? "pip.exe" : "pip";
  return fs.existsSync(path.join(scriptsDir, pipName));
}


if (require.main === module) {
  main().catch((error) => {
    console.error(`Build orchestration failed: ${error.message}`);
    process.exit(1);
  });
}

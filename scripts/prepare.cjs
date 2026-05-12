#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const {
  checkCommand,
  logStep,
  repoRoot,
  runCommand,
} = require("./lib/runtime.cjs");

const REPOSITORIES = {
  analytics: {
    key: "analytics",
    aliases: ["analytics", "server", "server-analytic-system"],
    dirName: "server-analytic-system",
    url: "https://github.com/gg-wp-easy/server-analytic-system.git",
    urlEnvVar: "SERVER_ANALYTIC_REPOSITORY_URL",
    tokenEnvVar: "SERVER_ANALYTIC_REPOSITORY_TOKEN",
  },
};

async function main() {
  const { target, flags } = parseArgs(process.argv.slice(2));

  if (flags.help) {
    printHelp();
    return;
  }

  if (!checkCommand("git", ["--version"])) {
    throw new Error("Git is required but was not found in PATH.");
  }

  const repositories = resolveTargets(target);

  for (const repository of repositories) {
    await syncRepository(repository, flags);
  }

  console.log("\nServer repositories are up to date.");
}

function parseArgs(argv) {
  const flags = {
    help: false,
    reclone: false,
  };
  let target = "all";

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      flags.help = true;
    } else if (arg === "--reclone") {
      flags.reclone = true;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown flag: ${arg}`);
    } else if (target === "all") {
      target = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { target, flags };
}

function printHelp() {
  console.log(`
Usage:
  node scripts/prepare.cjs [analytics|all] [--reclone]

Behavior:
  - clones the server repository if it is missing
  - runs git fetch/pull if the repository already exists
  - replaces an uninitialized checkout/gitlink directory with a fresh clone
  - with --reclone removes the local copy first and clones from scratch
  - SERVER_ANALYTIC_REPOSITORY_URL can override the backend repository URL
  - SERVER_ANALYTIC_REPOSITORY_TOKEN can authenticate the default GitHub URL

Examples:
  node scripts/prepare.cjs
  node scripts/prepare.cjs analytics
`);
}

function resolveTargets(target) {
  if (!target || target === "all") {
    return Object.values(REPOSITORIES);
  }

  const normalized = target.toLowerCase();
  const repository = Object.values(REPOSITORIES).find((item) => item.aliases.includes(normalized));
  if (!repository) {
    throw new Error(`Unknown target: ${target}`);
  }

  return [repository];
}

async function syncRepository(repository, flags) {
  const targetDir = path.join(repoRoot, repository.dirName);

  logStep(`${flags.reclone ? "Recloning" : "Syncing"} ${repository.dirName}`);

  if (flags.reclone && fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }

  if (!fs.existsSync(targetDir)) {
    await cloneRepository(repository);
    return;
  }

  if (!fs.existsSync(path.join(targetDir, ".git"))) {
    console.warn(`${repository.dirName} exists but is not an initialized git repository. Replacing it with a fresh clone.`);
    fs.rmSync(targetDir, { recursive: true, force: true });
    await cloneRepository(repository);
    return;
  }

  await updateRepository(repository);
}

async function cloneRepository(repository) {
  const url = resolveRepositoryUrl(repository);
  console.log(`Cloning ${redactUrl(url)}`);
  await runCommand("git", ["clone", url, repository.dirName], {
    cwd: repoRoot,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
    },
  });
}

async function updateRepository(repository) {
  const targetDir = path.join(repoRoot, repository.dirName);

  await runCommand("git", ["-C", targetDir, "fetch", "--all", "--prune"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
    },
  });
  await runCommand("git", ["-C", targetDir, "pull", "--ff-only"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
    },
  });
}

function resolveRepositoryUrl(repository) {
  const override = process.env[repository.urlEnvVar];
  if (override && override.trim()) {
    return override.trim();
  }

  const token =
    process.env[repository.tokenEnvVar]
    || process.env.GH_TOKEN
    || process.env.GITHUB_TOKEN;
  if (!token || !token.trim()) {
    return repository.url;
  }

  const parsed = new URL(repository.url);
  parsed.username = "x-access-token";
  parsed.password = token.trim();
  return parsed.toString();
}

function redactUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = "***";
    }
    return parsed.toString();
  } catch {
    return url.replace(/:\/\/([^:@]+):([^@]+)@/, "://$1:***@");
  }
}

main().catch((error) => {
  console.error(`\nPrepare failed: ${error.message}`);
  process.exitCode = 1;
});

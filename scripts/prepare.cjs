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
  - with --reclone removes the local copy first and clones from scratch

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
    throw new Error(
      `${repository.dirName} exists but is not a git repository. Re-run with --reclone to replace it.`,
    );
  }

  await updateRepository(repository);
}

async function cloneRepository(repository) {
  console.log(`Cloning ${repository.url}`);
  await runCommand("git", ["clone", repository.url, repository.dirName], {
    cwd: repoRoot,
  });
}

async function updateRepository(repository) {
  const targetDir = path.join(repoRoot, repository.dirName);

  await runCommand("git", ["-C", targetDir, "fetch", "--all", "--prune"], {
    cwd: repoRoot,
  });
  await runCommand("git", ["-C", targetDir, "pull", "--ff-only"], {
    cwd: repoRoot,
  });
}

main().catch((error) => {
  console.error(`\nPrepare failed: ${error.message}`);
  process.exitCode = 1;
});

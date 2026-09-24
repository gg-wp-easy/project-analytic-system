const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { test } = require("node:test");

function loadScript(name) {
  const filename = path.resolve(__dirname, "..", name);
  const localRequire = createRequire(filename);
  const calls = [];
  const context = vm.createContext({
    require(id) {
      if (id === "./lib/runtime.cjs") {
        return {
          ...localRequire(id),
          logStep() {},
          async runCommand(command, args) { calls.push({ command, args }); },
        };
      }
      return localRequire(id);
    },
    module: { exports: {} },
    __dirname: path.dirname(filename),
    console: { log() {}, warn() {} },
    process,
  });
  vm.runInContext(fs.readFileSync(filename, "utf8"), context);
  return { context, calls };
}

test("local build packages one host architecture without ASAR backup", async () => {
  const { context, calls } = loadScript("electron.cjs");
  await vm.runInContext(`runBuild(parseArgs([
    'build', '--profile=local', '--version-mode=package',
    '--skip-server-install', '--clean'
  ]).options)`, context);
  const server = calls.find(({ args }) => args[0].endsWith("servers.cjs"));
  assert.ok(server.args.includes("--skip-install"));
  assert.ok(server.args.includes("--clean"));
  const builder = calls.find(({ args }) => args[0].endsWith("electron-builder/cli.js"));
  assert.ok(builder.args.includes("--dir"));
  assert.ok(builder.args.includes(`--${process.arch}`));
  assert.ok(builder.args.includes("--config.compression=store"));
  assert.equal(calls.some(({ args }) => args[0].endsWith("protect-asar.cjs")), false);
});

test("release targets remain unchanged", () => {
  const { context } = loadScript("electron.cjs");
  assert.equal(vm.runInContext("resolveBuilderArgs('win', 'standard').join(' ')", context), "--win nsis portable");
  assert.equal(vm.runInContext("resolveBuilderArgs('linux', 'standard').join(' ')", context), "--linux");
  assert.equal(vm.runInContext("parseArgs(['build']).options.clean", context), false);
});

test("server clean flag works with and without an explicit target", () => {
  const { context } = loadScript("servers.cjs");
  for (const args of [["build", "--clean"], ["build", "all", "--clean"]]) {
    context.args = args;
    assert.equal(vm.runInContext("parseArgs(args).flags.clean", context), true);
  }
  assert.equal(vm.runInContext("parseArgs(['build']).flags.clean", context), false);
});

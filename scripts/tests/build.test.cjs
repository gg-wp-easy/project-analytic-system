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
          async runCommand(command, args, options) { calls.push({ command, args, options }); },
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
  delete process.env.VITE_PLATFORM_URL;
  await vm.runInContext(`runBuild(parseArgs([
    'build', '--profile=local', '--version-mode=package', '--clean'
  ]).options)`, context);
  const vite = calls.find(({ args }) => args[0].endsWith("vite.js"));
  assert.equal(vite.options.env.VITE_PLATFORM_URL, "http://127.0.0.1:8000");
  const builder = calls.find(({ args }) => args[0].endsWith("electron-builder/cli.js"));
  assert.ok(builder.args.includes("--dir"));
  assert.ok(builder.args.includes(`--${process.arch}`));
  assert.ok(builder.args.includes("--config.compression=store"));
  assert.equal(calls.some(({ args }) => args[0].endsWith("protect-asar.cjs")), false);
});

test("release build needs an https platform address", async () => {
  const { context } = loadScript("electron.cjs");
  delete process.env.VITE_PLATFORM_URL;
  await assert.rejects(
    vm.runInContext("runBuild(parseArgs(['build', '--skip-builder']).options)", context),
    /VITE_PLATFORM_URL/,
  );
  process.env.VITE_PLATFORM_URL = "http://api.example.com";
  await assert.rejects(
    vm.runInContext("runBuild(parseArgs(['build', '--skip-builder']).options)", context),
    /https/,
  );
  process.env.VITE_PLATFORM_URL = "https://api.example.com/";
  assert.equal(vm.runInContext("resolvePlatformUrl(false)", context), "https://api.example.com");
  delete process.env.VITE_PLATFORM_URL;
});

test("release targets remain unchanged", () => {
  const { context } = loadScript("electron.cjs");
  assert.equal(vm.runInContext("resolveBuilderArgs('win', 'standard').join(' ')", context), "--win nsis portable");
  assert.equal(vm.runInContext("resolveBuilderArgs('linux', 'standard').join(' ')", context), "--linux");
  assert.equal(vm.runInContext("parseArgs(['build']).options.clean", context), false);
});

#!/usr/bin/env node
"use strict";

const path = require("path");
const fs = require("fs");

const args = process.argv.slice(2);
const commandName = args[0];

// Global flags
if (args.includes("--verbose")) process.env.VERBOSE = "1";

function usage() {
  const cmdDir = path.join(__dirname, "..", "cli", "cmds");
  const files = fs.readdirSync(cmdDir).filter((f) => f.endsWith(".js"));

  const pkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
  );

  console.log(`\n  ${pkg.name} v${pkg.version}\n`);
  console.log("  Usage: cli <command> [options]\n");
  console.log("  Commands:\n");

  for (const file of files) {
    const mod = require(path.join(cmdDir, file));
    const name = path.basename(file, ".js").padEnd(12);
    const desc = mod.description || "";
    const alias = mod.alias ? ` (${mod.alias})` : "";
    console.log(`    ${name}${desc}${alias}`);
  }

  console.log(
    "\n  Options:\n" +
      "    --port <n>    Node HTTP port (default: $HTTP_PORT or 8080)\n" +
      "    --verbose     Show request details\n" +
      "    --help        Show this help\n"
  );
}

if (!commandName || commandName === "--help" || commandName === "-h") {
  usage();
  process.exit(0);
}

// Resolve command by name or alias
const cmdDir = path.join(__dirname, "..", "cli", "cmds");
let cmdPath = path.join(cmdDir, commandName + ".js");

if (!fs.existsSync(cmdPath)) {
  // search by alias
  const files = fs.readdirSync(cmdDir).filter((f) => f.endsWith(".js"));
  for (const file of files) {
    const mod = require(path.join(cmdDir, file));
    if (mod.alias === commandName) {
      cmdPath = path.join(cmdDir, file);
      break;
    }
  }
}

if (!fs.existsSync(cmdPath)) {
  console.error(`  Unknown command: ${commandName}\n  Run 'cli --help' for usage.`);
  process.exit(1);
}

const cmd = require(cmdPath);

// Parse simple --key value flags into an object
function parseArgs(argv) {
  const opts = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        opts[key] = true;
      } else {
        opts[key] = /^\d+$/.test(next) ? Number(next) : next;
        i++;
      }
    } else {
      positional.push(argv[i]);
    }
  }
  opts._ = positional;
  return opts;
}

const opts = parseArgs(args.slice(1));
opts.port = opts.port || Number(process.env.HTTP_PORT) || 8080;

Promise.resolve(cmd.run(opts)).catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});

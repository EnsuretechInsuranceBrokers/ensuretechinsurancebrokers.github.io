// Runs every test file. node tests/all.js
const { execFileSync } = require("child_process"); const fs = require("fs"); const path = require("path");
let failed = 0; for (const f of fs.readdirSync(__dirname).filter((f) => f.endsWith(".test.js")).sort()) {
  try { process.stdout.write(execFileSync("node", [path.join(__dirname, f)], { encoding: "utf8" })); } catch (e) { failed++; process.stdout.write("FAIL " + f + "\n" + (e.stdout || "") + (e.stderr || "")); } }
process.exit(failed ? 1 : 0);

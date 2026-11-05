import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "module.json"), "utf8"));
assert.equal(manifest.id, "telys-gacha-studio-hsr-overwrite");
assert(manifest.relationships.requires.some(entry => entry.id === "gacha-banner"));
assert.equal(manifest.compatibility.minimum, "14");
assert.equal(manifest.version, JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version);
for (const entry of [...manifest.esmodules, ...manifest.styles]) assert(fs.statSync(path.join(root, entry)).isFile(), entry);
for (const directory of ["scripts", "tests", "tools"]) for (const entry of fs.readdirSync(path.join(root, directory))) {
  if (!/\.m?js$/.test(entry)) continue;
  const checked = spawnSync(process.execPath, ["--check", path.join(root, directory, entry)], {encoding: "utf8"});
  assert.equal(checked.status, 0, checked.stderr);
}
for (const file of ["star.png", "starfield.png", "aura-gold.mp4", "aura-purple.mp4", "aura-blue.mp4"]) assert(fs.statSync(path.join(root, "assets", file)).size > 0);
for (const file of fs.readdirSync(path.join(root, "scripts"))) {
  const source = fs.readFileSync(path.join(root, "scripts", file), "utf8");
  assert(!/\bMath\.random\b|\.sort\(\s*\(\)\s*=>/.test(source), "Production must not randomize the selected rewards");
}
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8")), manifest);
console.log("Syntax, module dependencies, assets, manifest aliases, and production reward-order checks passed.");

// Vendor the 12-Node Theory instrument into this site.
//
// The instrument's source lives in ../unfaithfulcyborgs (src/wheel, src/data,
// src/mark). GitHub Pages builds this repository alone and cannot see that one,
// so the instrument is built there and its output copied here, into
// instruments/12-node-theory/. That output is committed: the one deliberate
// exception to "no build output in git", and PROVENANCE.md beside it records the
// exact source commit so the copy can always be traced back and rebuilt.
//
//   node tools/vendor-wheel.mjs
//
// Only the files the wheel actually loads are copied -- the Cyborgs build also
// emits its threshold, mark, essays and appendix, none of which belong here.

import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(here, "..");
const source = resolve(site, "../unfaithfulcyborgs");
const base = "/instruments/12-node-theory/";
const dest = join(site, "instruments/12-node-theory");

if (!existsSync(join(source, "wheel.html"))) {
  console.error(`No wheel.html in ${source}. The instrument's source repository must sit beside this one.`);
  process.exit(1);
}

function run(cmd, args, cwd) {
  // shell: true is needed on Windows to find npx; arguments are fixed strings, not user input.
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", shell: process.platform === "win32" });
  if (r.status !== 0) { console.error(r.stdout, r.stderr); process.exit(r.status ?? 1); }
  return r.stdout.trim();
}

// 1. What is being vendored, exactly.
const commit = run("git", ["rev-parse", "HEAD"], source);
const dirty = run("git", ["status", "--porcelain", "--", "wheel.html", "src"], source);

// 2. Build the Cyborgs site under this site's subpath, into a temp directory.
const out = mkdtempSync(join(tmpdir(), "wheel-"));
run("npx", ["vite", "build", `--base=${base}`, `--outDir=${out}`, "--emptyOutDir"], source);

// 3. Follow the wheel's imports from its HTML so only what it loads is copied.
let html = readFileSync(join(out, "wheel.html"), "utf8");
const need = new Set();
const pending = [...html.matchAll(/(?:src|href)="\/instruments\/12-node-theory\/(assets\/[^"]+)"/g)].map((m) => m[1]);
while (pending.length) {
  const rel = pending.pop();
  if (need.has(rel)) continue;
  need.add(rel);
  if (!rel.endsWith(".js")) continue;
  const js = readFileSync(join(out, rel), "utf8");
  for (const m of js.matchAll(/["']\.\/([\w.-]+\.(?:js|css))["']/g)) pending.push("assets/" + m[1]);
}

// 4. The page's one outbound link says "Threshold" and points at "/". Here it
//    returns to the instrument's about page, and targets the top window: the
//    instrument also runs embedded in that page, where a plain link would load
//    the whole site inside the frame.
const back = '<a class="back" href="/">&larr; Threshold</a>';
if (!html.includes(back)) {
  console.error("The wheel's back link has changed; update step 4 of this script before vendoring.");
  process.exit(1);
}
html = html.replace(back, '<a class="back" href="/work/12-node-theory/" target="_top">&larr; Thomas J Graves</a>');

// 5. Replace the vendored copy wholesale, so nothing stale survives.
rmSync(dest, { recursive: true, force: true });
mkdirSync(join(dest, "assets"), { recursive: true });
writeFileSync(join(dest, "index.html"), html);
for (const rel of need) cpSync(join(out, rel), join(dest, rel));
rmSync(out, { recursive: true, force: true });

writeFileSync(join(dest, "PROVENANCE.md"), `# 12-Node Theory — vendored build

Built from \`unfaithfulcyborgs\` at commit \`${commit}\`${dirty ? " **with uncommitted changes to the wheel's source**" : ""},
by \`tools/vendor-wheel.mjs\`, under the base path \`${base}\`.

Do not edit these files. Change the source in \`unfaithfulcyborgs/src/wheel\` (and
\`src/data\`, \`src/mark\`), then re-run the script.

One change is made to the built page: its back link, which read "← Threshold" and
pointed at the Cyborgs front page, reads "← Thomas J Graves", points at
/work/12-node-theory/, and targets the top window (the page also runs embedded there).

Files: index.html (built from wheel.html), ${[...need].sort().join(", ")}.
`);

console.log(`Vendored 12-Node Theory from ${commit.slice(0, 7)}${dirty ? " (dirty)" : ""}: ${need.size} assets -> ${dest}`);

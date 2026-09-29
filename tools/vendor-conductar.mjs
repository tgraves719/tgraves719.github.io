// Vendor ConductAR into this site.
//
// ConductAR's source lives in D:/Projects/tools/ConductorAR (../../tools/ConductorAR
// from here). GitHub Pages builds this repository alone and cannot see that one,
// so the app is built there and its output copied here, into instruments/conductar/.
// That output is committed, like the 12-Node wheel; PROVENANCE.md beside it
// records a fingerprint of the source it was built from.
//
//   node tools/vendor-conductorar.mjs
//
// The MediaPipe runtime and both landmark models are copied too, so the app runs
// from this site alone: camera frames never leave the browser, and nothing is
// fetched from Google. The runtime's "module" variant is left out; the app loads
// only the classic SIMD and non-SIMD builds.

import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve, dirname, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(here, "..");
const source = resolve(process.argv[2] || resolve(site, "../../tools/ConductorAR"));
const base = "/instruments/conductar/";
const dest = join(site, "instruments/conductar");

if (!existsSync(join(source, "src/App.tsx"))) {
  console.error(`No src/App.tsx in ${source}. Pass ConductAR's folder as the first argument.`);
  process.exit(1);
}

function run(cmd, args, cwd) {
  // shell: true is needed on Windows to find npx; arguments are fixed strings, not user input.
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", shell: process.platform === "win32" });
  if (r.status !== 0) { console.error(r.stdout, r.stderr); process.exit(r.status ?? 1); }
  return r.stdout.trim();
}

// 1. What is being vendored. The source is not a git repository, so fingerprint it:
//    one hash over every file in src/ plus the lockfile.
function files(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}
const hash = createHash("sha256");
for (const f of [...files(join(source, "src")), join(source, "package-lock.json")].sort()) {
  hash.update(relative(source, f).replaceAll("\\", "/")).update(readFileSync(f));
}
const fingerprint = hash.digest("hex").slice(0, 16);

// 2. Build under this site's subpath, into a temp directory.
const out = mkdtempSync(join(tmpdir(), "conductorar-"));
run("npx", ["vite", "build", `--base=${base}`, `--outDir=${out}`, "--emptyOutDir"], source);

// 3. Replace the vendored copy wholesale, so nothing stale survives, leaving out
//    the runtime variant the app never loads.
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(out, dest, { recursive: true, filter: (p) => !/vision_wasm_module_internal/.test(p) });
rmSync(out, { recursive: true, force: true });

// The site's audio guard runs first, so the site's mute reaches the app in its frame.
const page = join(dest, "index.html");
writeFileSync(page, readFileSync(page, "utf8").replace(/<meta charset="utf-8" \/>/i, (m) => `${m}
    <script src="/assets/js/audio-guard.js"></script>`));

const listed = files(dest).map((f) => relative(dest, f).replaceAll("\\", "/")).sort();
writeFileSync(join(dest, "PROVENANCE.md"), `# ConductAR — vendored build

Built from \`${source.replaceAll("\\", "/")}\` (source fingerprint \`${fingerprint}\`: sha256 over
src/ and package-lock.json), by \`tools/vendor-conductorar.mjs\`, under the base path \`${base}\`,
on ${new Date().toISOString().slice(0, 10)}.

Do not edit these files. Change the source, then re-run the script.

One line is added to the built page: the site's audio guard (\`/assets/js/audio-guard.js\`),
first in its head, so the site's mute reaches the app when it runs in a frame. The MediaPipe runtime's module variant
(vision_wasm_module_internal.*) is left out because the app does not load it.

Files: ${listed.join(", ")}.
`);

console.log(`Vendored ConductAR (${fingerprint}): ${listed.length} files -> ${dest}`);

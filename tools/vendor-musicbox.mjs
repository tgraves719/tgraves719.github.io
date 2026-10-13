// Vendor the Modular Music Box into this site, from ../modular-music-box.
//
// It is a single self-contained file (Tone.js and Tailwind from CDN), so this is a
// copy plus a provenance note -- the same arrangement as vendor-wheel.mjs.
//
//   node tools/vendor-musicbox.mjs

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const site = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(site, "../modular-music-box");
const dest = join(site, "instruments/modular-music-box");

if (!existsSync(join(source, "index.html"))) {
  console.error(`No index.html in ${source}.`);
  process.exit(1);
}
const git = (...a) => execFileSync("git", a, { cwd: source, encoding: "utf8" }).trim();
const commit = git("rev-parse", "HEAD");
const dirty = git("status", "--porcelain", "--", "index.html");

mkdirSync(dest, { recursive: true });
// The site's audio guard runs first, so the site's mute reaches the box in its frame.
const html = readFileSync(join(source, "index.html"), "utf8")
  .replace(/<meta charset="utf-8">/i, (m) => `${m}
<script src="/assets/js/audio-guard.js"></script>`);
writeFileSync(join(dest, "index.html"), html);
writeFileSync(join(dest, "PROVENANCE.md"), `# The Modular Music Box — vendored copy

Copied from \`modular-music-box\` at commit \`${commit}\`${dirty ? " **with uncommitted changes**" : ""}
by \`tools/vendor-musicbox.mjs\`. Do not edit here; change the source and re-run.

The site's audio guard (\`/assets/js/audio-guard.js\`) is added as the first script in
the page's head, so the site's mute reaches the instrument when it runs in a frame.
`);
console.log(`Vendored the Modular Music Box from ${commit.slice(0, 7)}${dirty ? " (dirty)" : ""}`);

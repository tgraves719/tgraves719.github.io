// The particle field, listening to an instrument in a frame.
//
// The hosted instruments (12-Node Theory, the Modular Music Box, ConductAR) share this
// site's origin, and audio-guard.js inside each one offers the analyser it already
// keeps on the instrument's output. Here those are read with the same listener the
// site's songs are read with (SiteListener, in site-audio.js), and whichever
// instrument is sounding is handed to the field in the same shape: notes, level,
// bands, attacks and a 12-Node color. It hears the instrument even when the site is
// muted, as the field hears muted music; it hears nothing when nothing sounds.

(function () {
  const F = {
    playing: false,
    notes: new Float32Array(84), level: 0, bands: { low: 0, mid: 0, high: 0 },
    onset: 0, onsetId: 0, onsetNote: -1, color: [255, 255, 255],
  };
  const listeners = new WeakMap(), seen = new WeakMap();
  let lastHeard = 0;

  function ears() {
    const out = [];
    document.querySelectorAll("iframe").forEach((f) => {
      try { const e = f.contentWindow && f.contentWindow.__siteEars; if (e) e.forEach((c) => out.push(c)); } catch (err) {}
    });
    return out;
  }

  function tick(now) {
    requestAnimationFrame(tick);
    if (!window.SiteListener) return;
    let best = null;
    for (const c of ears()) {
      if (c.ctx.state !== "running") continue;
      let L = listeners.get(c.ear);
      if (!L) { L = SiteListener(c.ear); listeners.set(c.ear, L); seen.set(L, 0); }
      L.update();
      if (!best || L.level > best.level) best = L;
    }
    // sounding: audible now, or within the last half second (a rest is not an ending)
    if (best && best.level > 0.01) lastHeard = now;
    F.playing = !!best && now - lastHeard < 500;
    if (!F.playing) { F.level = 0; F.notes.fill(0); return; }
    F.notes.set(best.notes); F.level = best.level; F.color = best.color;
    F.bands.low = best.bands.low; F.bands.mid = best.bands.mid; F.bands.high = best.bands.high;
    // attacks, counted across whichever instrument they came from
    if (best.onsetId !== seen.get(best)) {
      seen.set(best, best.onsetId);
      F.onset = best.onset; F.onsetNote = best.onsetNote; F.onsetId++;
    }
  }
  requestAnimationFrame(tick);

  window.FrameListen = F;
})();

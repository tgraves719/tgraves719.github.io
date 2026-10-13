// The site's one audio owner.
//
// The site is a single page that swaps its <main> as you move around it, so anything
// that lives outside <main> lives for the whole visit. This is that thing for sound:
// one <audio> element, the queue it is playing from, the mute, and the 12-Node
// reading of whatever is playing. The players on the pages (player.js) are views of
// it, the header's now-playing control is a view of it, and the particle field
// listens to it. Music a visitor starts keeps playing while they read; nothing plays
// that they did not start.
//
// The mute is unconditional over everything the site can reach: this audio, the
// MIDI synth (music-field.js), the hosted instruments in
// frames (audio-guard.js runs inside each), and YouTube players (through their API).
// A Facebook video cannot be reached from outside its frame.
//
// Mute is not pause. Muted music keeps its place, the bar keeps painting and the
// field keeps listening; unmute and it is where the song is.

(function () {
  // The 12-Node RGB table (research portfolio, 2021), pitch class 0 = C.
  const NODES = [
    [255, 0, 0], [255, 128, 0], [255, 255, 0], [128, 255, 0], [0, 255, 0], [0, 255, 128],
    [0, 255, 255], [0, 128, 255], [0, 0, 255], [128, 0, 255], [255, 0, 255], [255, 0, 128],
  ];
  const BUCKETS = 1200;            // resolution of a track's painted strip
  const KEY = "site-muted";        // per-visit, so a full reload keeps the choice

  const audio = new Audio();
  audio.preload = "none";

  let ctx, analyser, out, lastBucket = null, raf = 0;
  const listeners = new Set();
  const paints = new Map();

  function readMuted() {
    try { const v = sessionStorage.getItem(KEY); return v === null ? true : v === "1"; } catch (e) { return true; }
  }

  const S = {
    audio,
    queue: null,        // { key, url, artist, album, cover, tracks: [{ title, src, seconds, image }] }
    index: 0,
    playing: false,
    muted: readMuted(),
    color: [255, 255, 255],
    level: 0,
    chroma: new Float32Array(12),
    notes: null,        // set by the listener once something has played
    onset: 0, onsetId: 0, onsetNote: -1,
    bands: { low: 0, mid: 0, high: 0 },

    get track() { return S.queue ? S.queue.tracks[S.index] : null; },
    get duration() { return audio.duration || (S.track ? S.track.seconds : 0); },
    get currentTime() { return audio.currentTime; },

    /** Play track `index` of `queue`. The same track of the same queue resumes. */
    play(queue, index = 0) {
      const same = S.queue && S.queue.key === queue.key && S.index === index && audio.src;
      if (!same) {
        S.queue = queue;
        S.index = (index + queue.tracks.length) % queue.tracks.length;
        audio.src = S.track.src;
        lastBucket = null;
        session();
        emit("track");
      }
      start();
    },
    toggle() { if (!S.queue) return; audio.paused ? start() : audio.pause(); },
    pause() { audio.pause(); },
    next() { if (S.queue) S.play(S.queue, S.index + 1); },
    prev() {
      if (!S.queue) return;
      if (audio.currentTime > 3) { S.seek(0); start(); } else S.play(S.queue, S.index - 1);
    },
    seek(fraction) {
      if (!S.queue) return;
      audio.currentTime = Math.max(0, Math.min(1, fraction)) * S.duration;
      lastBucket = null;                  // a jump is not a stroke: don't paint across it
    },

    /** The painted strip of one track of one queue: BUCKETS colors, and which are set. */
    paint(key, index) {
      const id = key + "|" + index;
      if (!paints.has(id)) paints.set(id, { rgb: new Uint8ClampedArray(BUCKETS * 3), set: new Uint8Array(BUCKETS), version: 0 });
      return paints.get(id);
    },
    BUCKETS,

    setMuted(m) {
      m = !!m;
      if (m === S.muted) return;
      S.muted = m;
      try { sessionStorage.setItem(KEY, m ? "1" : "0"); } catch (e) {}
      if (out) out.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.02);
      reach();
      emit("mute");
    },

    /** Something the visitor started is sounding elsewhere (a video, an instrument). */
    yieldTo() {
      audio.pause();
      if (S.muted) S.setMuted(false);    // they asked for sound
    },

    /** Send the mute to every frame on the page; called again after each page swap. */
    reach,

    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };

  function emit(type) { listeners.forEach((fn) => { try { fn(type, S); } catch (e) { console.error(e); } }); }

  function start() {
    if (!ctx) {
      // Built on the first press: browsers only allow audio after a gesture.
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0.7;
      out = ctx.createGain();
      out.gain.value = S.muted ? 0 : 1;
      // The analyser sits before the mute, so the field still hears muted music.
      ctx.createMediaElementSource(audio).connect(analyser);
      analyser.connect(out);
      out.connect(ctx.destination);
      L = makeListener(analyser);
    }
    // Pressing play is asking for sound.
    if (S.muted) S.setMuted(false);
    ctx.resume();
    audio.play().catch(() => {});
  }

  // The reading of a sound, shared by everything the field hears: this page's songs,
  // and the instruments in frames (frame-listen.js hands it their analysers). It is
  // made from one AnalyserNode and read once a frame with update().
  //   chroma -- pitch classes from spectral peaks only (drums and noise are broad,
  //             notes are peaks), smoothed over about a second, the pace harmony moves at
  //   color  -- the additive mix of the sounding nodes, as 12-Node Theory mixes them
  //   level  -- loudness, 0..1
  //   notes  -- energy at each of 84 notes, C1 to B7, from spectral peaks, 0..1
  //   onset  -- an attack: spectral flux over its own recent average; onsetId counts
  //             them so a reader never misses one, onsetNote is where it landed
  //   bands  -- low, mid and high energy, each against its own recent peak
  const LOW_MIDI = 24, NOTES = 84;
  function makeListener(analyser) {
    const sr = analyser.context.sampleRate, hz = sr / analyser.fftSize;
    const freq = new Float32Array(analyser.frequencyBinCount), wave = new Float32Array(analyser.fftSize);
    const L = {
      chroma: new Float32Array(12), color: [255, 255, 255], level: 0,
      notes: new Float32Array(NOTES), onset: 0, onsetId: 0, onsetNote: -1, bands: { low: 0, mid: 0, high: 0 },
    };
    const lo = Math.ceil(65 / hz), hi = Math.min(freq.length - 1, Math.floor(2100 / hz));
    const binPc = new Uint8Array(hi);
    for (let b = lo; b < hi; b++) binPc[b] = ((Math.round(69 + 12 * Math.log2((b * hz) / 440)) % 12) + 12) % 12;
    const noteBins = [];
    for (let n = 0; n < NOTES; n++) {
      const f = 440 * Math.pow(2, (LOW_MIDI + n - 69) / 12);
      const a = Math.max(1, Math.floor((f * Math.pow(2, -1 / 24)) / hz)), b = Math.max(a, Math.ceil((f * Math.pow(2, 1 / 24)) / hz));
      noteBins.push([a, Math.min(freq.length - 1, b)]);
    }
    const fluxLo = Math.ceil(30 / hz), fluxHi = Math.min(freq.length - 1, Math.floor(5000 / hz));
    const bandBins = {};
    for (const [k, lo2, hi2] of [["low", 20, 150], ["mid", 150, 2000], ["high", 2000, 8000]]) bandBins[k] = [Math.ceil(lo2 / hz), Math.min(freq.length - 1, Math.floor(hi2 / hz))];
    const prevDb = new Float32Array(freq.length).fill(-140), raw = new Float32Array(NOTES), prevRaw = new Float32Array(NOTES);
    const fluxHist = [], bandMax = { low: 1e-6, mid: 1e-6, high: 1e-6 };
    let noteMax = 1e-6, sinceOnset = 0;
    const lin = (b) => Math.pow(10, Math.max(-140, freq[b]) / 20);

    L.update = function () {
      analyser.getFloatFrequencyData(freq);

      // chroma and color
      const m = new Float32Array(hi - lo);
      for (let k = 0; k < m.length; k++) m[k] = lin(lo + k);
      const med0 = Float32Array.from(m).sort()[m.length >> 1];
      const now = new Float32Array(12);
      for (let k = 1; k < m.length - 1; k++) {
        if (m[k] > m[k - 1] && m[k] > m[k + 1] && m[k] > 2.5 * med0) now[binPc[lo + k]] += m[k] * m[k];
      }
      const peak = Math.max(...now);
      if (peak > 0) for (let k = 0; k < 12; k++) L.chroma[k] = 0.985 * L.chroma[k] + 0.015 * (now[k] / peak);
      const ctop = Math.max(...L.chroma) || 1;
      let r = 0, g = 0, bl = 0;
      for (let k = 0; k < 12; k++) { const w = (L.chroma[k] / ctop) ** 2; r += w * NODES[k][0]; g += w * NODES[k][1]; bl += w * NODES[k][2]; }
      const mx = Math.max(r, g, bl) || 1;
      L.color = [r / mx * 255, g / mx * 255, bl / mx * 255].map(Math.round);

      // level
      analyser.getFloatTimeDomainData(wave);
      let e = 0; for (const v of wave) e += v * v;
      L.level = Math.min(1, Math.sqrt(e / wave.length) * 4);

      // notes: the loudest bin within half a semitone of each note, above the noise floor
      const ms = []; for (let b = noteBins[0][0]; b <= noteBins[NOTES - 1][1]; b += 3) ms.push(lin(b));
      ms.sort((x, y) => x - y);
      const med = ms[ms.length >> 1];
      let top = 0;
      prevRaw.set(raw);
      for (let n = 0; n < NOTES; n++) {
        let e2 = 0;
        for (let b = noteBins[n][0]; b <= noteBins[n][1]; b++) e2 = Math.max(e2, lin(b));
        raw[n] = Math.max(0, e2 - 3 * med);
        top = Math.max(top, raw[n]);
      }
      noteMax = Math.max(noteMax * 0.996, top, 1e-6);
      for (let n = 0; n < NOTES; n++) {
        const t = Math.pow(raw[n] / noteMax, 1.6);   // contrast: the notes that stand out
        L.notes[n] += (t - L.notes[n]) * (t > L.notes[n] ? 0.55 : 0.1);
      }

      // onset: positive change in the log spectrum, against its last ~0.7 s
      let flux = 0;
      for (let b = fluxLo; b <= fluxHi; b++) {
        const d = Math.max(-140, freq[b]);
        if (d > prevDb[b]) flux += d - prevDb[b];
        prevDb[b] = d;
      }
      flux /= fluxHi - fluxLo + 1;
      fluxHist.push(flux); if (fluxHist.length > 43) fluxHist.shift();
      const mean = fluxHist.reduce((x, y) => x + y, 0) / fluxHist.length;
      const sd = Math.sqrt(fluxHist.reduce((x, y) => x + (y - mean) ** 2, 0) / fluxHist.length);
      sinceOnset++;
      L.onset = 0;
      if (fluxHist.length > 10 && flux > mean + 1.4 * sd && flux > 0.6 && sinceOnset > 6) {
        sinceOnset = 0;
        L.onset = Math.min(1, (flux - mean) / (3 * sd + 1e-3));
        let best = -1, gain = 0;
        for (let n = 0; n < NOTES; n++) { const g2 = raw[n] - prevRaw[n]; if (g2 > gain) { gain = g2; best = n; } }
        if (best < 0) { let m2 = 0; for (let n = 0; n < NOTES; n++) if (raw[n] > m2) { m2 = raw[n]; best = n; } }
        L.onsetNote = best < 0 ? -1 : LOW_MIDI + best;
        L.onsetId++;
      }

      // bands
      for (const k of ["low", "mid", "high"]) {
        const [a, b] = bandBins[k];
        let s2 = 0; for (let x = a; x <= b; x++) { const l = lin(x); s2 += l * l; }
        const rr = Math.sqrt(s2 / (b - a + 1));
        bandMax[k] = Math.max(bandMax[k] * 0.997, rr, 1e-6);
        L.bands[k] += (rr / bandMax[k] - L.bands[k]) * 0.3;
      }
    };
    L.quiet = function () { L.level = 0; L.notes.fill(0); L.onset = 0; L.bands.low = L.bands.mid = L.bands.high = 0; };
    return L;
  }
  window.SiteListener = makeListener;
  let L = null;

  function listen() {
    L.update();
    S.color = L.color; S.level = L.level; S.chroma = L.chroma; S.notes = L.notes; S.bands = L.bands;
    S.onset = L.onset; S.onsetId = L.onsetId; S.onsetNote = L.onsetNote;
  }

  // While a track plays: read it, and paint its strip at the playhead.
  function frame() {
    raf = 0;
    if (audio.paused) return;
    raf = requestAnimationFrame(frame);
    listen();
    const dur = S.duration;
    if (!dur) return;
    const p = S.paint(S.queue.key, S.index);
    const b = Math.min(BUCKETS - 1, Math.floor((audio.currentTime / dur) * BUCKETS));
    const from = lastBucket !== null && b >= lastBucket && b - lastBucket < 40 ? lastBucket : b;
    for (let k = from; k <= b; k++) {
      p.rgb[k * 3] = S.color[0]; p.rgb[k * 3 + 1] = S.color[1]; p.rgb[k * 3 + 2] = S.color[2];
      p.set[k] = 1;
    }
    p.version++;
    lastBucket = b;
  }

  audio.addEventListener("play", () => {
    S.playing = true;
    if (!raf) raf = requestAnimationFrame(frame);
    emit("state");
  });
  audio.addEventListener("pause", () => { S.playing = false; S.level = 0; if (L) L.quiet(); emit("state"); });
  audio.addEventListener("ended", () => {
    if (S.queue && S.index < S.queue.tracks.length - 1) S.play(S.queue, S.index + 1);
    else { S.playing = false; S.level = 0; emit("state"); }
  });
  audio.addEventListener("seeking", () => { lastBucket = null; });

  // The lock screen and the media keys.
  function session() {
    if (!("mediaSession" in navigator) || !S.track) return;
    const t = S.track, q = S.queue, art = t.image || q.cover;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title, artist: q.artist || "", album: q.album || "",
      artwork: art ? [{ src: art, sizes: t.image ? "360x360" : "200x200", type: "image/jpeg" }] : [],
    });
    const many = q.tracks.length > 1;
    navigator.mediaSession.setActionHandler("play", start);
    navigator.mediaSession.setActionHandler("pause", () => audio.pause());
    navigator.mediaSession.setActionHandler("previoustrack", many ? S.prev : null);
    navigator.mediaSession.setActionHandler("nexttrack", many ? S.next : null);
  }

  // Frames: our own instruments hear the mute through audio-guard.js; YouTube
  // players through their iframe API (the embeds ask for it with enablejsapi=1).
  function reach() {
    document.querySelectorAll("iframe").forEach((f) => {
      let origin;
      try { origin = new URL(f.src, location.href).origin; } catch (e) { return; }
      try {
        if (origin === location.origin) f.contentWindow.postMessage({ type: "site-mute", muted: S.muted }, location.origin);
        else if (/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(origin)) {
          f.contentWindow.postMessage(JSON.stringify({ event: "command", func: S.muted ? "mute" : "unMute", args: [] }), origin);
        }
      } catch (e) {}
    });
  }

  // An instrument in a frame has started sounding: let it have the room.
  window.addEventListener("message", (e) => {
    if (e.origin === location.origin && e.data && e.data.type === "site-audio-start") S.yieldTo();
  });

  window.SiteAudio = S;
})();

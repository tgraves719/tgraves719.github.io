// The 12-Node player: a playlist (the Safeway Strike recordings) or a single
// track (the KARL proposal as a song). Markup: _includes/player.njk.
//
// The bar is colored by 12-Node Theory: the analyser estimates which pitch classes
// are sounding, and their node colors are mixed additively -- one note shows its
// own color, a chord shows its mixture, a tritone pair tends toward white. As a
// track plays, the bar paints itself with that color at the playhead, so each song
// leaves a strip of its own harmony behind it.
//
// Progressive enhancement: without this script every title is a plain link to its
// mp3.

// The 12-Node RGB table (research portfolio, 2021), pitch class 0 = C.
const NODES = [
  [255, 0, 0], [255, 128, 0], [255, 255, 0], [128, 255, 0], [0, 255, 0], [0, 255, 128],
  [0, 255, 255], [0, 128, 255], [0, 0, 255], [128, 0, 255], [255, 0, 255], [255, 0, 128],
];

const fmt = (s) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

for (const root of document.querySelectorAll("[data-player]")) {
  const audio = root.querySelector("audio");
  const links = [...root.querySelectorAll("[data-track]")];
  const tracks = links.map((a) => ({ title: a.dataset.title, src: a.getAttribute("href"), seconds: +a.dataset.seconds }));
  const $ = (s) => root.querySelector(s);
  const now = $("[data-now]"), time = $("[data-time]"), seek = $("[data-seek]"), play = $("[data-play]");
  const canvas = $("[data-paint]"), g = canvas.getContext("2d"), head = $("[data-head]");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let i = 0, ctx, analyser, freq, wave, lastX = null, dragging = false;
  const chroma = new Float32Array(12);
  let color = [255, 255, 255];

  function sizeCanvas() {
    const r = canvas.getBoundingClientRect(), d = devicePixelRatio || 1;
    if (canvas.width !== Math.round(r.width * d)) { canvas.width = Math.round(r.width * d); canvas.height = Math.round(r.height * d); lastX = null; }
  }

  function load(n, autoplay) {
    i = (n + tracks.length) % tracks.length;
    const t = tracks[i];
    audio.src = t.src;
    if (now) now.textContent = t.title;
    time.textContent = `0:00 / ${fmt(t.seconds)}`;
    links.forEach((a, k) => a.toggleAttribute("aria-current", k === i));
    // keep the playing track in view inside the list, without scrolling the page
    const list = $("[data-list]"), li = links[i].parentElement;
    if (list && list.offsetParent && (li.offsetTop < list.scrollTop || li.offsetTop + li.offsetHeight > list.scrollTop + list.clientHeight)) {
      list.scrollTop = li.offsetTop - list.clientHeight / 2;
    }
    sizeCanvas(); g.clearRect(0, 0, canvas.width, canvas.height); lastX = null; seek.value = 0;
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title, artist: root.dataset.artist, album: root.dataset.album,
        artwork: root.dataset.cover ? [{ src: root.dataset.cover, sizes: "200x200", type: "image/jpeg" }] : [],
      });
    }
    if (autoplay) start();
  }

  function start() {
    if (!ctx) {
      // Built on the first press: browsers only allow audio after a gesture.
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0.7;
      ctx.createMediaElementSource(audio).connect(analyser);
      analyser.connect(ctx.destination);
      freq = new Float32Array(analyser.frequencyBinCount);
      wave = new Float32Array(analyser.fftSize);
      requestAnimationFrame(frame);
    }
    ctx.resume();
    audio.play();
  }

  // Pitch classes are read from spectral peaks only -- drums and noise are broad,
  // notes are peaks -- and smoothed over about a second, the pace harmony moves at.
  // (Tested offline on the tracks: per-frame colors flickered like a barcode; this
  // shows a song's sections.)
  let binPc, lo, hi;
  function listen() {
    if (!binPc) {
      const hz = ctx.sampleRate / analyser.fftSize;
      lo = Math.ceil(65 / hz); hi = Math.min(freq.length - 1, Math.floor(2100 / hz));
      binPc = new Uint8Array(hi);
      for (let b = lo; b < hi; b++) binPc[b] = ((Math.round(69 + 12 * Math.log2((b * hz) / 440)) % 12) + 12) % 12;
    }
    analyser.getFloatFrequencyData(freq);
    const m = new Float32Array(hi - lo);
    for (let k = 0; k < m.length; k++) m[k] = Math.pow(10, freq[lo + k] / 20);
    const med = Float32Array.from(m).sort()[m.length >> 1];
    const now = new Float32Array(12);
    for (let k = 1; k < m.length - 1; k++) {
      if (m[k] > m[k - 1] && m[k] > m[k + 1] && m[k] > 2.5 * med) now[binPc[lo + k]] += m[k] * m[k];
    }
    const peak = Math.max(...now);
    if (peak > 0) for (let k = 0; k < 12; k++) chroma[k] = 0.985 * chroma[k] + 0.015 * (now[k] / peak);
    // Additive mixture of the sounding nodes, as 12-Node Theory mixes them.
    const top = Math.max(...chroma) || 1;
    let r = 0, gr = 0, b = 0;
    for (let k = 0; k < 12; k++) { const w = (chroma[k] / top) ** 2; r += w * NODES[k][0]; gr += w * NODES[k][1]; b += w * NODES[k][2]; }
    const mx = Math.max(r, gr, b) || 1;
    color = [r / mx * 255, gr / mx * 255, b / mx * 255].map(Math.round);
    analyser.getFloatTimeDomainData(wave);
    let e = 0; for (const v of wave) e += v * v;
    return Math.min(1, Math.sqrt(e / wave.length) * 4);
  }

  function frame() {
    requestAnimationFrame(frame);
    if (audio.paused) return;
    if (!canvas.width) sizeCanvas();
    const level = listen(), c = `rgb(${color.join(",")})`;
    root.style.setProperty("--c", c);
    root.style.setProperty("--glow", reduced ? "0.35" : (0.15 + level * 0.85).toFixed(2));
    const dur = audio.duration || tracks[i].seconds, x = Math.floor((audio.currentTime / dur) * canvas.width);
    g.fillStyle = c;
    const from = lastX === null ? x : Math.min(lastX, x);
    g.fillRect(from, 0, Math.max(1, x - from + 1), canvas.height);
    lastX = x;
    head.style.left = `${(audio.currentTime / dur) * 100}%`;
  }

  play.addEventListener("click", () => (audio.paused ? start() : audio.pause()));
  $("[data-prev]")?.addEventListener("click", () => load(audio.currentTime > 3 ? i : i - 1, true));
  $("[data-next]")?.addEventListener("click", () => load(i + 1, true));
  links.forEach((a, k) => a.addEventListener("click", (e) => { e.preventDefault(); load(k, true); }));
  audio.addEventListener("play", () => root.toggleAttribute("data-playing", true));
  audio.addEventListener("pause", () => root.toggleAttribute("data-playing", false));
  audio.addEventListener("ended", () => { if (i < tracks.length - 1) load(i + 1, true); });
  audio.addEventListener("timeupdate", () => {
    const dur = audio.duration || tracks[i].seconds;
    time.textContent = `${fmt(audio.currentTime)} / ${fmt(dur)}`;
    if (!dragging) seek.value = Math.round((audio.currentTime / dur) * 1000);
  });
  seek.addEventListener("input", () => {
    dragging = true;
    const dur = audio.duration || tracks[i].seconds;
    audio.currentTime = (seek.value / 1000) * dur;
    lastX = null;                       // a jump is not a stroke: don't paint across it
    head.style.left = `${seek.value / 10}%`;
  });
  seek.addEventListener("change", () => (dragging = false));
  addEventListener("resize", sizeCanvas);
  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", start);
    navigator.mediaSession.setActionHandler("pause", () => audio.pause());
    const many = tracks.length > 1;
    navigator.mediaSession.setActionHandler("previoustrack", many ? () => load(i - 1, true) : null);
    navigator.mediaSession.setActionHandler("nexttrack", many ? () => load(i + 1, true) : null);
  }
  root.classList.add("is-enhanced");
  load(0, false);
}

// The particle field, listening to a YouTube video.
//
// A YouTube player's sound is sealed in YouTube's frame; no page can hear it. So the
// field reads ahead instead: for Thomas's own videos, tools/fourier-videos.py has read
// the audio on disk the way site-audio.js reads a song, into assets/fourier/<id>.json.
// Here the player's clock (YouTube's iframe API, over postMessage) is followed, and the
// reading at that moment is handed to the field in the same shape SiteAudio gives it:
// notes, level, bands, attacks and a 12-Node color. Pause, seek or leave the page, and
// the field follows.
//
// A video without a reading on disk simply is not heard -- the field does not pretend.

(function () {
  const YT = "https://www.youtube-nocookie.com";
  const NODES = [
    [255, 0, 0], [255, 128, 0], [255, 255, 0], [128, 255, 0], [0, 255, 0], [0, 255, 128],
    [0, 255, 255], [0, 128, 255], [0, 0, 255], [128, 0, 255], [255, 0, 255], [255, 0, 128],
  ];

  const V = {
    id: null, playing: false,
    notes: new Float32Array(84), level: 0, bands: { low: 0, mid: 0, high: 0 },
    onset: 0, onsetId: 0, onsetNote: -1, color: [255, 255, 255],
  };

  let index = null, data = null, player = null, heard = false;
  let time = 0, stamp = 0, rate = 1, next = 0, raf = 0;

  const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  async function readings() {
    if (!index) {
      try { index = new Set(await (await fetch("/assets/fourier/index.json")).json()); } catch (e) { index = new Set(); }
    }
    return index;
  }

  /** A player was made for video `id`: follow it, if its music has been read. */
  V.attach = async function (iframe, id) {
    player = iframe; V.id = id; data = null; heard = false; stop();
    if (!(await readings()).has(id)) return;
    try {
      const d = await (await fetch(`/assets/fourier/${id}.json`)).json();
      data = { fps: d.fps, frames: d.frames, k: d.k, low: d.lowMidi, notes: bytes(d.notes), level: bytes(d.level),
               lo: bytes(d.low), mid: bytes(d.mid), hi: bytes(d.high), onsets: d.onsets };
    } catch (e) { return; }
    if (player !== iframe) return;                 // another video was chosen meanwhile
    // Ask the player to report to us; it answers once it is ready.
    let tries = 0;
    const ask = setInterval(() => {
      if (heard || !iframe.isConnected || tries++ > 60) return clearInterval(ask);
      try { iframe.contentWindow.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), YT); } catch (e) {}
    }, 250);
  };

  window.addEventListener("message", (e) => {
    if (e.origin !== YT || !player || e.source !== player.contentWindow) return;
    let m; try { m = JSON.parse(e.data); } catch (err) { return; }
    heard = true;
    const info = m.info;
    if (m.event === "onStateChange" && typeof info === "number") return state(info);
    if (!info || typeof info !== "object") return;
    if (typeof info.currentTime === "number") { time = info.currentTime; stamp = performance.now(); }
    if (typeof info.playbackRate === "number") rate = info.playbackRate;
    if (typeof info.playerState === "number") state(info.playerState);
  });

  function state(s) {
    const playing = s === 1 && !!data;
    if (playing === V.playing) return;
    V.playing = playing;
    if (playing) { next = onsetAt(now()); if (!raf) raf = requestAnimationFrame(tick); }
    else stop();
  }

  function stop() { V.playing = false; V.level = 0; V.notes.fill(0); V.bands.low = V.bands.mid = V.bands.high = 0; }

  const now = () => time + ((performance.now() - stamp) / 1000) * rate;
  function onsetAt(t) { let i = 0; while (data && i < data.onsets.length && data.onsets[i][0] < t) i++; return i; }

  function tick() {
    raf = 0;
    if (!V.playing || !data) return;
    if (!player.isConnected) return stop();       // the page with the video was left
    raf = requestAnimationFrame(tick);
    const t = now(), f = Math.max(0, Math.min(data.frames - 1, Math.floor(t * data.fps)));

    V.notes.fill(0);
    const chroma = new Float32Array(12);
    for (let k = 0; k < data.k; k++) {
      const n = data.notes[(f * data.k + k) * 2], v = data.notes[(f * data.k + k) * 2 + 1] / 255;
      if (n === 255) break;
      V.notes[n] = v;
      chroma[(data.low + n) % 12] += v;
    }
    V.level = data.level[f] / 255;
    V.bands.low = data.lo[f] / 255; V.bands.mid = data.mid[f] / 255; V.bands.high = data.hi[f] / 255;

    // attacks, as they pass; a seek re-finds its place
    if (next > 0 && data.onsets[next - 1][0] > t + 0.5) next = onsetAt(t);
    while (next < data.onsets.length && data.onsets[next][0] <= t) {
      const [ot, midi, s] = data.onsets[next++];
      if (t - ot < 0.25) { V.onset = s; V.onsetNote = midi; V.onsetId++; }
    }

    // the 12-Node color of the moment, as site-audio.js mixes it
    const top = Math.max(...chroma) || 1;
    let r = 0, g = 0, b = 0;
    for (let k = 0; k < 12; k++) { const w = (chroma[k] / top) ** 2; r += w * NODES[k][0]; g += w * NODES[k][1]; b += w * NODES[k][2]; }
    const mx = Math.max(r, g, b) || 1;
    V.color = [r / mx * 255, g / mx * 255, b / mx * 255].map(Math.round);
  }

  window.VideoListen = V;
})();

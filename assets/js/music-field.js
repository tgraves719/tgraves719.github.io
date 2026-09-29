// The particle field: a space made of music.
//
// Music space here is the pitch helix, seen down its axis. Each octave is a 12-Node
// wheel -- C at the top, the chromatic scale clockwise, as the 12-Node Theory
// instrument draws it -- and the octaves recede into depth, so looking at the
// background is looking down a tunnel of wheels, low notes near, high notes far.
//
// Every star is a note, C1 to B7. It lights in its own node color when that note
// sounds, whatever makes it sound:
//   - the music the visitor is playing, read note by note from its spectrum
//     (site-audio.js: per-note energy, attacks, bands),
//   - a MIDI keyboard, if the visitor connects one,
//   - the site's page transitions (base.njk hands their notes here, as light only),
//   - the pointer, passing through the stars.
//
// The rest follows from the notes, by physics rather than animation:
//   network   the helix is threaded faintly, semitone to semitone and octave to
//             octave; notes sounding together are joined, so a chord draws its own
//             figure in each wheel and links across octaves, in the additive mix of
//             its colors -- 12-Node Theory's own geometry, drawn by the music
//   physics   each star is sprung to its place and damped; an attack kicks the
//             struck note outward and rings out a shock wave; notes of one chord pull
//             toward each other; the bass breathes the whole space; the pointer pushes
//   turning   the wheels turn, on a spring, to face the harmony's center of gravity
//   flight    dust drifts through the space toward the viewer, faster when louder
//   radiance  every star is light, added: a core and a wide halo, and waves
//
// It runs behind every page, and not at all for a visitor who has asked their system
// for less motion.

(function () {
  const NODES = [
    [255, 0, 0], [255, 128, 0], [255, 255, 0], [128, 255, 0], [0, 255, 0], [0, 255, 128],
    [0, 255, 255], [0, 128, 255], [0, 0, 255], [128, 0, 255], [255, 0, 255], [255, 0, 128],
  ].map((c) => c.map((v) => v / 255));
  const LOW = 24, N = 84;               // C1 .. B7
  const R = 5.2;                        // wheel radius
  const DEPTH = 6.5;                    // one octave, into the screen
  const MAX_EDGES = 420, RINGS = 14, DUST = 1400;

  const F = {
    ready: false,
    pageOffset: null,                   // a THREE.Vector3 the site animates between pages
    onFrame: null,                      // the site's own per-frame work (the rainbow borders)
    act: new Float32Array(N),           // how lit each note is, 0..1
    events: new Float32Array(N),        // the part of that from note events, decaying
  };

  let THREE_, scene, camera, renderer, group, nodePts, halo, edges, dustPts, projScale = 1;
  let pos, vel, home, colors, sizes, alphas, edgeCount = 0;
  let rings = [], dust, dustSpeed = 0.6;
  let phi = 0, phiVel = 0, breathe = 0, t0 = performance.now(), last = t0;
  const lastOnset = { song: 0, video: 0, frame: 0 };
  const mouse = { x: 0, y: 0, px: -1e4, py: -1e4, seen: 0 }, strummed = new Float32Array(N);
  const cam = { x: 0, y: 0, z: 9 };

  const pc = (n) => (LOW + n) % 12;
  const place = (n, out) => {
    const m = LOW + n, th = ((m % 12) / 12) * Math.PI * 2;
    out[0] = R * Math.sin(th); out[1] = R * Math.cos(th); out[2] = 2 - ((m - LOW) / 12) * DEPTH;
    return out;
  };

  const VERT = `
    attribute vec3 acolor; attribute float asize; attribute float aalpha;
    uniform float uScale; uniform float uGrow; uniform float uNear; uniform float uFar;
    varying vec3 vColor; varying float vAlpha;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float depth = max(-mv.z, 0.1);
      vColor = acolor;
      vAlpha = aalpha * (1.0 - smoothstep(uNear, uFar, depth));
      gl_PointSize = asize * uGrow * uScale / depth;
      gl_Position = projectionMatrix * mv;
    }`;
  const FRAG = `
    uniform float uSoft;
    varying vec3 vColor; varying float vAlpha;
    void main() {
      float d = length(gl_PointCoord - 0.5) * 2.0;
      if (d > 1.0) discard;
      float core = exp(-d * d * 7.0);
      float glow = exp(-d * d * 2.2) * (1.0 - d);
      gl_FragColor = vec4(vColor, mix(core, glow, uSoft) * vAlpha);
    }`;

  function points(count, grow, soft, near, far) {
    const g = new THREE_.BufferGeometry();
    g.setAttribute("position", new THREE_.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("acolor", new THREE_.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("asize", new THREE_.BufferAttribute(new Float32Array(count), 1));
    g.setAttribute("aalpha", new THREE_.BufferAttribute(new Float32Array(count), 1));
    const m = new THREE_.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: THREE_.AdditiveBlending,
      uniforms: { uScale: { value: 1 }, uGrow: { value: grow }, uSoft: { value: soft }, uNear: { value: near }, uFar: { value: far } },
    });
    const p = new THREE_.Points(g, m);
    p.frustumCulled = false;
    return p;
  }

  F.init = function (canvas, options = {}) {
    if (F.ready || !window.THREE || !canvas) return false;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    THREE_ = window.THREE;
    Object.assign(F, options);

    renderer = new THREE_.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    scene = new THREE_.Scene();
    scene.fog = new THREE_.Fog(0x000000, 12, 58);   // lines fade to nothing with depth
    camera = new THREE_.PerspectiveCamera(62, 1, 0.1, 200);
    F.scene = scene; F.camera = camera; F.renderer = renderer;

    group = new THREE_.Group();
    scene.add(group);

    // the notes: a core and a halo per star, both added light
    pos = new Float32Array(N * 3); vel = new Float32Array(N * 3); home = new Float32Array(N * 3);
    for (let n = 0; n < N; n++) { place(n, home.subarray(n * 3, n * 3 + 3)); pos.set(home.subarray(n * 3, n * 3 + 3), n * 3); }
    nodePts = points(N, 1, 0, 6, 62);
    halo = points(N, 5.5, 1, 6, 62);
    halo.geometry.setAttribute("position", nodePts.geometry.getAttribute("position"));
    halo.geometry.setAttribute("acolor", nodePts.geometry.getAttribute("acolor"));
    colors = nodePts.geometry.getAttribute("acolor").array;
    sizes = nodePts.geometry.getAttribute("asize").array;
    alphas = nodePts.geometry.getAttribute("aalpha").array;
    halo.geometry.setAttribute("asize", nodePts.geometry.getAttribute("asize"));
    halo.userData.alpha = halo.geometry.getAttribute("aalpha").array;
    group.add(halo, nodePts);

    // the network
    const eg = new THREE_.BufferGeometry();
    eg.setAttribute("position", new THREE_.BufferAttribute(new Float32Array(MAX_EDGES * 6), 3));
    eg.setAttribute("color", new THREE_.BufferAttribute(new Float32Array(MAX_EDGES * 6), 3));
    edges = new THREE_.LineSegments(eg, new THREE_.LineBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false, blending: THREE_.AdditiveBlending,
    }));
    edges.frustumCulled = false;
    group.add(edges);

    // shock waves
    for (let i = 0; i < RINGS; i++) {
      const g = new THREE_.BufferGeometry(), seg = 64, a = new Float32Array(seg * 3);
      for (let k = 0; k < seg; k++) { const th = (k / seg) * Math.PI * 2; a[k * 3] = Math.cos(th); a[k * 3 + 1] = Math.sin(th); }
      g.setAttribute("position", new THREE_.BufferAttribute(a, 3));
      const ring = new THREE_.LineLoop(g, new THREE_.LineBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE_.AdditiveBlending }));
      ring.visible = false; ring.userData = { age: 1, life: 1, color: new THREE_.Color() };
      rings.push(ring); group.add(ring);
    }

    // dust, drifting through the space
    dustPts = points(DUST, 1, 0, 2, 70);
    dust = dustPts.geometry.getAttribute("position").array;
    const dc = dustPts.geometry.getAttribute("acolor").array, ds = dustPts.geometry.getAttribute("asize").array, da = dustPts.geometry.getAttribute("aalpha").array;
    for (let i = 0; i < DUST; i++) {
      const r = 2 + Math.pow(Math.random(), 0.7) * 26, th = Math.random() * Math.PI * 2;
      dust[i * 3] = r * Math.cos(th); dust[i * 3 + 1] = r * Math.sin(th); dust[i * 3 + 2] = 8 - Math.random() * 68;
      const v = 0.55 + Math.random() * 0.45;
      dc[i * 3] = dc[i * 3 + 1] = dc[i * 3 + 2] = v;
      ds[i] = 0.035 + Math.random() * 0.05; da[i] = 0.25 + Math.random() * 0.5;
    }
    dustPts.userData.base = Float32Array.from(dc);
    scene.add(dustPts);

    resize();
    addEventListener("resize", resize);
    addEventListener("pointermove", (e) => {
      mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1;
      mouse.px = e.clientX; mouse.py = e.clientY; mouse.seen = performance.now();
    }, { passive: true });

    F.ready = true;
    requestAnimationFrame(frame);
    return true;
  };

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    projScale = (h * renderer.getPixelRatio()) / 2 / Math.tan((camera.fov * Math.PI) / 360);
    for (const p of [nodePts, halo, dustPts]) p.material.uniforms.uScale.value = projScale;
  }

  /** A note sounded (MIDI number, velocity 0..1): it lights, is struck, and rings. */
  F.note = function (midi, velocity = 0.7) {
    if (!F.ready) return;
    let n = Math.round(midi) - LOW;
    while (n < 0) n += 12; while (n >= N) n -= 12;
    const v = Math.max(0, Math.min(1, velocity));
    F.events[n] = Math.max(F.events[n], v);
    strike(n, v);
  };
  /** The same, by name: 'C#4', 'G5'. */
  F.noteName = function (name, velocity) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(String(name).trim());
    if (!m) return;
    const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
    F.note(12 * (+m[3] + 1) + base, velocity);
  };

  function strike(n, v) {
    // kicked outward from the axis, and a wave rings out from it
    const x = pos[n * 3], y = pos[n * 3 + 1], r = Math.hypot(x, y) || 1;
    vel[n * 3] += (x / r) * 2.2 * v; vel[n * 3 + 1] += (y / r) * 2.2 * v; vel[n * 3 + 2] += 0.8 * v;
    // neighbors feel it: a semitone either side, an octave either side
    for (const d of [-1, 1, -12, 12]) {
      const k = n + d; if (k < 0 || k >= N) continue;
      const kx = pos[k * 3], ky = pos[k * 3 + 1], kr = Math.hypot(kx, ky) || 1;
      vel[k * 3] += (kx / kr) * 0.6 * v; vel[k * 3 + 1] += (ky / kr) * 0.6 * v;
    }
    if (v < 0.25) return;
    const ring = rings.reduce((a, b) => (b.userData.age / b.userData.life > a.userData.age / a.userData.life ? b : a));
    ring.userData.age = 0; ring.userData.life = 0.9 + v * 0.8; ring.userData.n = n; ring.userData.v = v;
    ring.userData.color.setRGB(...NODES[pc(n)]);
    ring.visible = true;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = (now - t0) / 1000;
    // What the field hears, in order: the song the visitor started, a video of theirs
    // that is playing (video-listen.js reads it ahead), an instrument sounding in a
    // frame (frame-listen.js) -- each in the same shape.
    const S = window.SiteAudio, Vd = window.VideoListen, Fr = window.FrameListen;
    const A = S && S.playing && S.notes ? S : Vd && Vd.playing ? Vd : Fr && Fr.playing ? Fr : null, playing = !!A;
    const source = A === S ? "song" : A === Vd ? "video" : "frame";
    if (F.onFrame) F.onFrame();

    // ---- what is sounding
    const bands = playing ? A.bands : { low: 0, mid: 0, high: 0 };
    const level = playing ? A.level : 0;
    if (playing && A.onsetId !== lastOnset[source]) {
      lastOnset[source] = A.onsetId;
      if (A.onsetNote >= 0) F.note(A.onsetNote, 0.35 + 0.65 * A.onset);
    }
    const ev = F.events, act = F.act;
    const decay = Math.exp(-dt / 0.9);
    for (let n = 0; n < N; n++) {
      ev[n] *= decay;
      const a = Math.max(playing ? A.notes[n] : 0, ev[n]);
      act[n] += (a - act[n]) * (a > act[n] ? 0.5 : 0.08);
    }

    // ---- turning: toward the harmony's center of gravity on the wheel
    let cx = 0, cy = 0, sum = 0;
    for (let n = 0; n < N; n++) {
      const th = (pc(n) / 12) * Math.PI * 2;
      cx += act[n] * Math.sin(th); cy += act[n] * Math.cos(th); sum += act[n];
    }
    const focus = sum > 0.3 ? Math.hypot(cx, cy) / sum : 0;
    let target = phi + 0.02 * dt;                       // idle: a slow drift
    if (focus > 0.15) {
      // turn so the harmony's center sits at the top, the way C sits in the wheel
      let want = Math.atan2(cx, cy), d = want - phi;
      d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      target = phi + d * Math.min(1, focus * 1.5);
    }
    phiVel += ((target - phi) * 0.9 - phiVel * 1.6) * dt;
    phi += phiVel * dt;
    group.rotation.z = phi;

    // ---- physics
    breathe += ((1 + 0.14 * bands.low + 0.05 * level) - breathe) * 0.1;
    // the pointer, in the group's frame
    const pointerLive = now - mouse.seen < 1500;
    if (pointerLive) group.updateMatrixWorld();
    const v3 = pointerLive ? new THREE_.Vector3() : null;
    for (let n = 0; n < N; n++) {
      const i = n * 3;
      let fx = -12 * (pos[i] - home[i] * breathe), fy = -12 * (pos[i + 1] - home[i + 1] * breathe), fz = -12 * (pos[i + 2] - home[i + 2]);
      fx -= 3.4 * vel[i]; fy -= 3.4 * vel[i + 1]; fz -= 3.4 * vel[i + 2];
      // a quiet life of its own
      fx += Math.sin(t * 0.7 + n * 1.3) * 0.25; fy += Math.cos(t * 0.6 + n * 0.7) * 0.25;
      if (pointerLive) {
        v3.set(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(group.matrixWorld).project(camera);
        const sx = (v3.x * 0.5 + 0.5) * innerWidth, sy = (-v3.y * 0.5 + 0.5) * innerHeight;
        const dx = sx - mouse.px, dy = sy - mouse.py, d2 = dx * dx + dy * dy;
        if (d2 < 140 * 140 && v3.z < 1) {
          const push = (1 - Math.sqrt(d2) / 140) * 9;
          // screen push, turned back into the group's frame
          const c = Math.cos(-phi), s = Math.sin(-phi), ux = dx / (Math.sqrt(d2) + 1), uy = -dy / (Math.sqrt(d2) + 1);
          fx += (ux * c - uy * s) * push; fy += (ux * s + uy * c) * push;
          // passing through a star sounds it, in light only
          if (d2 < 22 * 22 && now - strummed[n] > 400) { strummed[n] = now; F.events[n] = Math.max(F.events[n], 0.55); strike(n, 0.3); }
        }
      }
      vel[i] += fx * dt; vel[i + 1] += fy * dt; vel[i + 2] += fz * dt;
    }
    // chord tones pull together: the figure tightens while it sounds
    const lit = [];
    for (let n = 0; n < N; n++) if (act[n] > 0.3) lit.push(n);
    lit.sort((a, b) => act[b] - act[a]); lit.length = Math.min(lit.length, 10);
    // the more that sounds at once, the finer each line, so a dense mix stays legible
    const density = Math.min(1, 5 / Math.max(1, lit.length));
    for (let a = 0; a < lit.length; a++) for (let b = a + 1; b < lit.length; b++) {
      const i = lit[a] * 3, j = lit[b] * 3, w = act[lit[a]] * act[lit[b]] * 0.3;
      const dx = pos[j] - pos[i], dy = pos[j + 1] - pos[i + 1], dz = pos[j + 2] - pos[i + 2];
      vel[i] += dx * w * dt; vel[i + 1] += dy * w * dt; vel[i + 2] += dz * w * dt * 0.3;
      vel[j] -= dx * w * dt; vel[j + 1] -= dy * w * dt; vel[j + 2] -= dz * w * dt * 0.3;
    }
    for (let i = 0; i < N * 3; i++) pos[i] += vel[i] * dt;

    // ---- how each star looks
    const halpha = halo.userData.alpha;
    for (let n = 0; n < N; n++) {
      const a = act[n], c = NODES[pc(n)];
      const grey = 0.5 * (1 - a);
      colors[n * 3] = grey + c[0] * a; colors[n * 3 + 1] = grey + c[1] * a; colors[n * 3 + 2] = grey + c[2] * a;
      sizes[n] = 0.12 + 0.36 * a + 0.05 * bands.high * a;
      alphas[n] = 0.4 + 0.6 * a;
      halpha[n] = 0.06 + 0.32 * a * a;
    }
    nodePts.geometry.getAttribute("position").array.set(pos);
    for (const k of ["position", "acolor", "asize", "aalpha"]) nodePts.geometry.getAttribute(k).needsUpdate = true;
    halo.geometry.getAttribute("aalpha").needsUpdate = true;

    // ---- the network
    const ep = edges.geometry.getAttribute("position").array, ec = edges.geometry.getAttribute("color").array;
    edgeCount = 0;
    const edge = (i, j, r, g, b) => {
      if (edgeCount >= MAX_EDGES) return;
      const o = edgeCount * 6;
      ep[o] = pos[i * 3]; ep[o + 1] = pos[i * 3 + 1]; ep[o + 2] = pos[i * 3 + 2];
      ep[o + 3] = pos[j * 3]; ep[o + 4] = pos[j * 3 + 1]; ep[o + 5] = pos[j * 3 + 2];
      ec[o] = ec[o + 3] = r; ec[o + 1] = ec[o + 4] = g; ec[o + 2] = ec[o + 5] = b;
      edgeCount++;
    };
    // the thread of the helix, semitone to semitone, and octave to octave
    for (let n = 0; n < N - 1; n++) {
      const w = 0.1 + 0.55 * Math.sqrt(act[n] * act[n + 1]), c1 = NODES[pc(n)], c2 = NODES[pc(n + 1)];
      const lit2 = Math.sqrt(act[n] * act[n + 1]);
      edge(n, n + 1, (0.5 * (1 - lit2) + (c1[0] + c2[0]) * 0.5 * lit2) * w, (0.5 * (1 - lit2) + (c1[1] + c2[1]) * 0.5 * lit2) * w, (0.5 * (1 - lit2) + (c1[2] + c2[2]) * 0.5 * lit2) * w);
    }
    for (let n = 0; n < N - 12; n++) {
      const a = Math.sqrt(act[n] * act[n + 12]), c = NODES[pc(n)], w = 0.03 + 0.7 * a;
      edge(n, n + 12, (0.5 * (1 - a) + c[0] * a) * w, (0.5 * (1 - a) + c[1] * a) * w, (0.5 * (1 - a) + c[2] * a) * w);
    }
    // what sounds together: every pair of lit notes within an octave and a half,
    // in the additive mix of their colors, as bright as both are lit
    for (let a = 0; a < lit.length; a++) for (let b = a + 1; b < lit.length; b++) {
      const i = lit[a], j = lit[b];
      if (Math.abs(i - j) > 18 || Math.abs(i - j) === 1 || Math.abs(i - j) === 12) continue;
      const w = Math.sqrt(act[i] * act[j]) * 0.6 * density, c1 = NODES[pc(i)], c2 = NODES[pc(j)];
      const r = c1[0] + c2[0], g = c1[1] + c2[1], bl = c1[2] + c2[2], mx = Math.max(r, g, bl, 1e-3);
      edge(i, j, (r / mx) * w, (g / mx) * w, (bl / mx) * w);
    }
    edges.geometry.setDrawRange(0, edgeCount * 2);
    edges.geometry.getAttribute("position").needsUpdate = true;
    edges.geometry.getAttribute("color").needsUpdate = true;

    // ---- waves
    for (const ring of rings) {
      const u = ring.userData;
      if (!ring.visible) continue;
      u.age += dt;
      const k = u.age / u.life;
      if (k >= 1) { ring.visible = false; continue; }
      ring.position.set(pos[u.n * 3], pos[u.n * 3 + 1], pos[u.n * 3 + 2]);
      ring.scale.setScalar(0.2 + (1 - Math.pow(1 - k, 3)) * (1.4 + 2.6 * u.v));
      ring.material.color.copy(u.color).multiplyScalar((1 - k) * (1 - k) * (0.25 + 0.45 * u.v));
    }

    // ---- flight: the dust comes toward the viewer, faster when the music is louder
    dustSpeed += ((0.5 + 7 * level + 5 * bands.low) - dustSpeed) * 0.05;
    for (let i = 0; i < DUST; i++) {
      dust[i * 3 + 2] += dustSpeed * dt;
      if (dust[i * 3 + 2] > 9) dust[i * 3 + 2] -= 68;
    }
    dustPts.geometry.getAttribute("position").needsUpdate = true;
    if (playing) {
      // the dust takes a little of the music's color
      const dc = dustPts.geometry.getAttribute("acolor").array, base = dustPts.userData.base, m = A.color, k = 0.25 * level;
      for (let i = 0; i < DUST * 3; i += 3) {
        dc[i] = base[i] * (1 - k) + (m[0] / 255) * k; dc[i + 1] = base[i + 1] * (1 - k) + (m[1] / 255) * k; dc[i + 2] = base[i + 2] * (1 - k) + (m[2] / 255) * k;
      }
      dustPts.geometry.getAttribute("acolor").needsUpdate = true;
    }

    // ---- the viewer: the page's place in the space, the pointer's parallax, a slow sway
    const off = F.pageOffset || { x: 0, y: 0, z: 2 };
    const want = {
      x: off.x * 1.1 + mouse.x * 0.8 + Math.sin(t * 0.07) * 0.6,
      y: off.y * 1.1 - mouse.y * 0.5 + Math.cos(t * 0.05) * 0.4,
      z: 9 + (off.z - 2) * 0.9,
    };
    for (const k of ["x", "y", "z"]) cam[k] += (want[k] - cam[k]) * 0.03;
    camera.position.set(cam.x, cam.y, cam.z);
    camera.lookAt(0, 0, -16);

    renderer.render(scene, camera);
  }

  // ---- MIDI: a visitor with a keyboard can play the space
  F.midi = { inputs: 0, connected: false, synth: null };
  F.connectMidi = async function () {
    if (!navigator.requestMIDIAccess) return false;
    const access = await navigator.requestMIDIAccess();
    // The synth that sounds a visitor's keys is Tone.js, fetched only now: nothing
    // else on the site needs it. Its master follows the site's mute.
    if (!window.Tone) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/tone/14.7.77/Tone.js";
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
      const follow = () => { Tone.Destination.mute = !!(window.SiteAudio && SiteAudio.muted); };
      follow();
      if (window.SiteAudio) SiteAudio.on((type) => type === "mute" && follow());
    }
    await Tone.start();
    const bind = () => {
      let count = 0;
      access.inputs.forEach((input) => { count++; input.onmidimessage = onMidi; });
      F.midi.inputs = count;
      document.dispatchEvent(new CustomEvent("site:midi", { detail: F.midi }));
    };
    access.onstatechange = bind;
    F.midi.connected = true;
    bind();
    return true;
  };
  function onMidi(e) {
    const [st, note, vel] = e.data, type = st & 0xf0;
    if (type === 0x90 && vel > 0) {
      F.note(note, vel / 127);
      const synth = midiSynth();
      if (synth && window.SiteAudio && !SiteAudio.muted) synth.triggerAttack(Tone.Frequency(note, "midi"), undefined, vel / 127);
    } else if (type === 0x80 || (type === 0x90 && vel === 0)) {
      const synth = midiSynth();
      if (synth) synth.triggerRelease(Tone.Frequency(note, "midi"));
    }
  }
  function midiSynth() {
    if (!window.Tone) return null;
    if (!F.midi.synth) {
      const verb = new Tone.Reverb(2.5).toDestination();
      verb.wet.value = 0.3;
      F.midi.synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle8" }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 1.2 }, volume: -12,
      }).connect(verb);
    }
    return F.midi.synth;
  }

  window.MusicField = F;
})();

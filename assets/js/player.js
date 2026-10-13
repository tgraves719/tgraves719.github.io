// The 12-Node player: a playlist (the Safeway Strike recordings) or a single
// track (the KARL proposal as a song). Markup: _includes/player.njk.
//
// The sound itself belongs to the site (site-audio.js), so a song keeps playing when
// the visitor moves to another page; this is a view of it. Come back and the player
// picks up where the song is, its bar still painted.
//
// The bar is colored by 12-Node Theory: the site's analyser estimates which pitch
// classes are sounding and mixes their node colors additively -- one note shows its
// own color, a chord shows its mixture, a tritone pair tends toward white. As a
// track plays, the bar paints itself with that color at the playhead, so each song
// leaves a strip of its own harmony behind it.
//
// Progressive enhancement: without this script every title is a plain link to its
// mp3.

(function () {
  const A = window.SiteAudio;
  const fmt = (s) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function mount(root) {
    if (root.dataset.mounted) return;
    root.dataset.mounted = "1";

    const links = [...root.querySelectorAll("[data-track]")];
    const queue = {
      // A player is known by its page and its id, so returning to it finds its song.
      key: location.pathname + "#" + root.id,
      url: location.pathname + "#" + root.id,
      artist: root.dataset.artist, album: root.dataset.album, cover: root.dataset.cover,
      tracks: links.map((a) => ({ title: a.dataset.title, src: a.getAttribute("href"), seconds: +a.dataset.seconds, image: a.dataset.image })),
    };
    const $ = (s) => root.querySelector(s);
    const cover = $("[data-cover]"), now = $("[data-now]"), time = $("[data-time]"), seek = $("[data-seek]"), play = $("[data-play]");
    const canvas = $("[data-paint]"), g = canvas.getContext("2d"), head = $("[data-head]"), list = $("[data-list]");
    const mine = () => A.queue && A.queue.key === queue.key;

    let shown = -1, drawn = -1, dragging = false;

    function sizeCanvas() {
      const r = canvas.getBoundingClientRect(), d = devicePixelRatio || 1;
      if (r.width && canvas.width !== Math.round(r.width * d)) { canvas.width = Math.round(r.width * d); canvas.height = Math.round(r.height * d); drawn = -1; }
    }

    // Which track the view shows: the playing one if this player's song is playing,
    // else the first.
    function show(i) {
      if (i === shown) return;
      shown = i;
      const t = queue.tracks[i];
      if (now) now.textContent = t.title;
      const art = t.image || queue.cover;
      if (cover && art) cover.src = art;
      links.forEach((a, k) => a.toggleAttribute("aria-current", k === i && mine()));
      // keep the playing track in view inside the list, without scrolling the page
      const li = links[i].parentElement;
      if (list && list.offsetParent && (li.offsetTop < list.scrollTop || li.offsetTop + li.offsetHeight > list.scrollTop + list.clientHeight)) {
        list.scrollTop = li.offsetTop - list.clientHeight / 2;
      }
      drawn = -1;
    }

    // Repaint the strip from the site's record of it, only when it has changed.
    function paint(i) {
      sizeCanvas();
      const p = A.paint(queue.key, i);
      const key = p.version * 1000 + i;
      if (key === drawn || !canvas.width) return;
      drawn = key;
      g.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width / A.BUCKETS;
      for (let k = 0; k < A.BUCKETS; k++) {
        if (!p.set[k]) continue;
        g.fillStyle = `rgb(${p.rgb[k * 3]},${p.rgb[k * 3 + 1]},${p.rgb[k * 3 + 2]})`;
        g.fillRect(Math.floor(k * w), 0, Math.ceil(w) + 1, canvas.height);
      }
    }

    function frame() {
      if (!root.isConnected) return;       // the page was swapped away; the song plays on
      requestAnimationFrame(frame);
      const active = mine();
      const i = active ? A.index : 0;
      show(i);
      paint(i);
      const dur = active ? A.duration : queue.tracks[i].seconds;
      const t = active ? A.currentTime : 0;
      time.textContent = `${fmt(t)} / ${fmt(dur)}`;
      if (!dragging) seek.value = dur ? Math.round((t / dur) * 1000) : 0;
      head.style.left = `${dur ? (t / dur) * 100 : 0}%`;
      root.toggleAttribute("data-playing", active && A.playing);
      links.forEach((a, k) => a.toggleAttribute("aria-current", active && k === i));
      if (active && A.playing) {
        root.style.setProperty("--c", `rgb(${A.color.join(",")})`);
        root.style.setProperty("--glow", reduced ? "0.35" : (0.15 + A.level * 0.85).toFixed(2));
      }
    }

    play.addEventListener("click", () => (mine() ? A.toggle() : A.play(queue, 0)));
    $("[data-prev]")?.addEventListener("click", () => (mine() ? A.prev() : A.play(queue, 0)));
    $("[data-next]")?.addEventListener("click", () => (mine() ? A.next() : A.play(queue, 1)));
    links.forEach((a, k) => a.addEventListener("click", (e) => { e.preventDefault(); A.play(queue, k); }));
    seek.addEventListener("input", () => {
      if (!mine()) { seek.value = 0; return; }
      dragging = true;
      A.seek(seek.value / 1000);
    });
    seek.addEventListener("change", () => (dragging = false));
    addEventListener("resize", sizeCanvas);

    root.classList.add("is-enhanced");
    requestAnimationFrame(frame);
  }

  function mountAll() { document.querySelectorAll("[data-player]").forEach(mount); }
  // First load, and every page the site swaps in afterwards.
  document.addEventListener("site:page", mountAll);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
  else mountAll();
})();

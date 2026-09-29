// The site's mute, inside a hosted instrument.
//
// The instruments (12-Node Theory, the Modular Music Box, ConductAR) run in frames
// on their pages and make their own sound with the Web Audio API. This runs first in
// each of them, before any of their code, so that every connection to a speaker goes
// through one gain the site controls: the header's mute silences them too, without
// stopping or pausing anything.
//
// Its listener is also offered to the site, so the particle field can hear the
// instrument the way it hears a song (frame-listen.js).
//
// It also tells the site when an instrument is really sounding, so the site can
// pause its own music rather than play over it, and lift the mute. "Really" is
// strict: the visitor has pressed or clicked inside this instrument, and sound is
// actually coming out of it. An engine that is merely running -- ConductAR builds
// one on load, silent -- is not an instrument playing, and must not stop a song.
//
// Opened on its own (full screen), with no site around it, it does nothing.
(function () {
  if (window.parent === window) return;
  var site;
  try { site = window.parent.SiteAudio; } catch (e) { return; }  // not our site
  var Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx || !window.AudioNode) return;

  var muted = !!(site && site.muted);
  var chains = [];
  // The site's particle field listens to the instrument through these (frame-listen.js).
  window.__siteEars = chains;
  var connect = AudioNode.prototype.connect;

  // Per context: everything bound for the speakers meets at `input`; a listener
  // hangs off it (before the mute, so it hears even muted sound), and `mute` sits
  // between it and the speakers.
  function chainFor(ctx) {
    for (var i = 0; i < chains.length; i++) if (chains[i].ctx === ctx) return chains[i];
    var input = ctx.createGain(), mute = ctx.createGain(), ear = ctx.createAnalyser(), hush = ctx.createGain();
    mute.gain.value = muted ? 0 : 1;
    hush.gain.value = 0;
    ear.fftSize = 8192;              // the resolution the site's listener reads notes at
    ear.smoothingTimeConstant = 0.7;
    connect.call(input, mute); connect.call(mute, ctx.destination);
    connect.call(input, ear); connect.call(ear, hush); connect.call(hush, ctx.destination);
    var c = { ctx: ctx, input: input, mute: mute, ear: ear, buf: new Float32Array(ear.fftSize) };
    chains.push(c);
    return c;
  }

  AudioNode.prototype.connect = function (dest) {
    if (dest instanceof AudioDestinationNode) {
      var args = Array.prototype.slice.call(arguments);
      args[0] = chainFor(dest.context).input;
      return connect.apply(this, args);
    }
    return connect.apply(this, arguments);
  };

  // A disconnection from the speakers is a disconnection from the chain that stands in
  // for them (Tone.js does this with its clock), or it would throw.
  var disconnect = AudioNode.prototype.disconnect;
  AudioNode.prototype.disconnect = function (dest) {
    if (dest instanceof AudioDestinationNode) {
      var args = Array.prototype.slice.call(arguments);
      args[0] = chainFor(dest.context).input;
      try { return disconnect.apply(this, args); } catch (e) { return; }
    }
    return disconnect.apply(this, arguments);
  };

  function apply() {
    chains.forEach(function (c) { c.mute.gain.setTargetAtTime(muted ? 0 : 1, c.ctx.currentTime, 0.02); });
    var media = document.querySelectorAll("audio, video");
    for (var i = 0; i < media.length; i++) media[i].muted = muted;
  }

  function touched() {
    var ua = navigator.userActivation;
    return ua ? ua.hasBeenActive : true;        // this frame's own activation, not the page's
  }

  var told = 0;
  function tell() {
    if (!touched() || Date.now() - told < 1500) return;
    told = Date.now();
    window.parent.postMessage({ type: "site-audio-start" }, location.origin);
  }

  // Listen for real sound, a few times a second.
  var loud = 0;
  setInterval(function () {
    var heard = false;
    chains.forEach(function (c) {
      if (c.ctx.state !== "running") return;
      c.ear.getFloatTimeDomainData(c.buf);
      var e = 0; for (var i = 0; i < c.buf.length; i++) e += c.buf[i] * c.buf[i];
      if (Math.sqrt(e / c.buf.length) > 0.004) heard = true;
    });
    loud = heard ? loud + 1 : 0;
    if (loud >= 2) tell();                     // sustained, not a click
  }, 250);

  document.addEventListener("play", function (e) { e.target.muted = muted; tell(); }, true);
  window.addEventListener("message", function (e) {
    if (e.origin !== location.origin || !e.data || e.data.type !== "site-mute") return;
    muted = !!e.data.muted;
    apply();
  });
})();

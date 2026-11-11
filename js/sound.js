/* sound.js - the air of the place, built from noise and a few sine waves.
 * The baths have water and drips, the field has wind, the chapel has a choir of tones,
 * the sky has almost nothing. It is on from the first touch, unless the visitor turns it off. */

export function createSound() {
  let ac = null, master = null, verb = null, noiseBuf = null, on = false;
  const G = {};
  const TAU = Math.PI * 2;

  function noise() {
    if (noiseBuf) return noiseBuf;
    const n = ac.sampleRate * 3;
    noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  function loopNoise(offset) {
    const s = ac.createBufferSource(); s.buffer = noise(); s.loop = true; s.start(0, offset || 0); return s;
  }
  function gain(v) { const g = ac.createGain(); g.gain.value = v; return g; }
  function filter(type, f, q) { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q || 0.7; return b; }

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    master = gain(0);
    const comp = ac.createDynamicsCompressor();
    master.connect(comp); comp.connect(ac.destination);
    // a long, soft echo: a delay feeding itself through a dull filter
    verb = gain(1);
    const d1 = ac.createDelay(2), d2 = ac.createDelay(2), fb = gain(0.55), lp = filter('lowpass', 2200), wet = gain(0.5);
    d1.delayTime.value = 0.37; d2.delayTime.value = 0.61;
    verb.connect(d1); d1.connect(lp); lp.connect(d2); d2.connect(fb); fb.connect(d1); d2.connect(wet); d1.connect(wet); wet.connect(master);

    // air of a big room
    G.air = gain(0);
    loopNoise(0).connect(filter('lowpass', 520)).connect(G.air); G.air.connect(master);
    // water lapping in the pool: band of noise that swells slowly
    G.water = gain(0);
    const wsrc = loopNoise(1.1), wbp = filter('bandpass', 950, 1.4), wamp = gain(0.5);
    wsrc.connect(wbp); wbp.connect(wamp); wamp.connect(G.water); G.water.connect(master); G.water.connect(verb);
    const wl = ac.createOscillator(), wlg = gain(0.45); wl.frequency.value = 0.23; wl.connect(wlg); wlg.connect(wamp.gain); wl.start();
    // wind over the field
    G.wind = gain(0);
    const vsrc = loopNoise(2.2), vbp = filter('bandpass', 420, 0.6), vamp = gain(0.6);
    vsrc.connect(vbp); vbp.connect(vamp); vamp.connect(G.wind); G.wind.connect(master);
    const vl = ac.createOscillator(), vlg = gain(0.5); vl.frequency.value = 0.09; vl.connect(vlg); vlg.connect(vamp.gain); vl.start();
    const vf = ac.createOscillator(), vfg = gain(180); vf.frequency.value = 0.05; vf.connect(vfg); vfg.connect(vbp.frequency); vf.start();
    // a held chord, everywhere, quietly
    G.pad = gain(0);
    [220, 329.63, 493.88, 554.37].forEach(function (f, i) {
      [-4, 4].forEach(function (cents) {
        const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = cents + i;
        const g = gain(0.085 / (1 + i * 0.3)); o.connect(g); g.connect(G.pad); o.start();
      });
    });
    const trem = ac.createOscillator(), tg = gain(0.3); trem.frequency.value = 0.07; trem.connect(tg); tg.connect(G.pad.gain); trem.start();
    G.pad.connect(verb); G.pad.connect(master);
    // the chapel: higher tones that come and go, like voices far off
    G.choir = gain(0);
    [659.25, 739.99, 987.77, 1108.73].forEach(function (f, i) {
      const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = gain(0), l = ac.createOscillator(), lg = gain(0.012);
      l.frequency.value = 0.05 + i * 0.031; l.connect(lg); lg.connect(g.gain); l.start();
      g.gain.value = 0.012;
      o.connect(filter('lowpass', 1800)).connect(g); g.connect(G.choir); o.start();
    });
    G.choir.connect(verb); G.choir.connect(master);
    return true;
  }

  function setZone(w) {
    if (!ac || !on) return;
    const t = ac.currentTime, k = 0.8;
    G.air.gain.setTargetAtTime(0.09 + w.baths * 0.07 + w.chapel * 0.05, t, k);
    G.water.gain.setTargetAtTime(w.baths * 0.3, t, k);
    G.wind.gain.setTargetAtTime(w.field * 0.32 + w.sky * 0.1, t, k);
    G.pad.gain.setTargetAtTime(0.75 + w.chapel * 0.3 - w.sky * 0.2, t, k);
    G.choir.gain.setTargetAtTime(w.chapel * 1.4 + w.sky * 0.4, t, k);
  }

  function blip(dur, fill, vol, wetToo) {
    if (!ac || !on) return;
    const sr = ac.sampleRate, n = Math.max(1, Math.round(dur * sr)), b = ac.createBuffer(1, n, sr), d = b.getChannelData(0);
    fill(d, sr, n);
    const f = Math.min(n, Math.round(sr * 0.004));
    for (let i = 0; i < f; i++) { d[i] *= i / f; d[n - 1 - i] *= i / f; }
    const s = ac.createBufferSource(), g = gain(vol); s.buffer = b; s.connect(g); g.connect(master);
    if (wetToo) g.connect(verb);
    s.start();
  }
  // a drop falling into the pool
  function drip() {
    const f0 = 900 + Math.random() * 1300;
    blip(0.32, function (d, sr) {
      for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = Math.sin(TAU * f0 * t * (1 - t * 0.9)) * Math.exp(-t * 18); }
    }, 0.09, true);
  }
  // the place glitching: chopped data at low bit depth and a burst of hiss
  function glitch(strength) {
    blip(0.08 + strength * 0.22, function (d, sr, n) {
      let i = 0;
      while (i < n) {
        const len = Math.round(sr * (0.008 + Math.random() * 0.04)), kind = Math.random();
        const f = 160 * Math.pow(2, Math.random() * 5), hold = 1 << (1 + ((Math.random() * 4) | 0)), q = 4 + ((Math.random() * 3) | 0) * 4;
        let v = 0;
        for (let k = 0; k < len && i < n; k++, i++) {
          if (k % hold === 0) {
            v = kind < 0.45 ? (((k * f / sr) % 1) < 0.5 ? 0.7 : -0.7) : kind < 0.85 ? Math.random() * 1.4 - 0.7 : 0;
            v = Math.round(v * q) / q;
          }
          d[i] = v;
        }
      }
    }, 0.16 + strength * 0.12, false);
  }

  // falling asleep: three soft bells going down, in the long echo
  function chime() {
    if (!ac || !on) return;
    [1318.5, 987.8, 830.6].forEach(function (f, i) {
      const t0 = ac.currentTime + 0.05 + i * 0.32, o = ac.createOscillator(), o2 = ac.createOscillator(), g = gain(0);
      o.frequency.value = f; o2.frequency.value = f * 2.01;
      const g2 = gain(0.25); o2.connect(g2); g2.connect(g); o.connect(g);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.16, t0 + 0.012); g.gain.setTargetAtTime(0, t0 + 0.02, 0.5);
      g.connect(master); g.connect(verb);
      o.start(t0); o2.start(t0); o.stop(t0 + 3); o2.stop(t0 + 3);
    });
  }

  // an iPhone with the ring switch on silent mutes sound made in the page, unless the page says
  // it is playing something on purpose, or a sound element has played once from a touch
  let unlocked = false, trying = false;
  function unlockPhone() {
    if (unlocked || trying) return;
    trying = true;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* older phones */ }
    try {
      const sr = 8000, n = 800, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
      const str = function (o, s) { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true);
      v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
      const el = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
      el.setAttribute('playsinline', '');
      const pr = el.play();
      if (pr && pr.then) pr.then(function () { unlocked = true; trying = false; }, function () { trying = false; });
      else unlocked = true;
    } catch (e) { unlocked = true; }
  }

  let chimed = false;
  function setOn(v) {
    if (v) unlockPhone();
    if (!ac && !build()) return false;
    if (ac.state !== 'running') ac.resume();
    on = v;
    master.gain.setTargetAtTime(on ? 1 : 0, ac.currentTime, 0.4);
    if (on && !chimed) { chimed = true; chime(); }
    return on;
  }
  return {
    // call from inside a touch or a key press: browsers only let sound start there
    start: function () { if (!ac || ac.state !== 'running' || !on) setOn(true); },
    toggle: function () { return setOn(!on); },
    isOn: function () { return on; },
    setZone: setZone, drip: drip, glitch: glitch
  };
}

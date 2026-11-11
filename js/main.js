/* main.js - waking up, walking (the scroll), looking (the mouse), holding still
 * (the ascii view), touching things, the glitches, the secrets, the readouts, the air. */
import * as THREE from '../vendor/three.module.min.js';
import { createWorld } from './world.js?v=5';
import { createPost } from './post.js?v=2';
import { createSound } from './sound.js?v=2';

const $ = function (s) { return document.querySelector(s); };
const $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
const html = document.documentElement;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand = function (a, b) { return a + Math.random() * (b - a); };
const pad = function (n, w) { return String(n).padStart(w, '0'); };

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

/* ---------- it remembers you ---------- */
let visits = 1;
try { visits = (parseInt(localStorage.getItem('limbo-visits'), 10) || 0) + 1; localStorage.setItem('limbo-visits', String(visits)); } catch (e) { visits = 1; }
const visitorsEl = $('#visitors');
if (visitorsEl && visits > 1) visitorsEl.textContent = 'visitors today: 1. it is always you.';

/* ---------- waking up ---------- */
const veil = $('#veil'), vlog = $('#veil-log');
const LINES = ['> sleep detected', '> looking for the way back ........ none', '> loading layer 0', '> there is no layer 1'];
if (visits > 1) LINES.push('> visit ' + visits, '> welcome back'); else LINES.push('> welcome');
let veilDone = false;
function liftVeil() {
  if (veilDone) return;
  veilDone = true;
  veil.classList.add('off');
  setTimeout(function () { veil.classList.add('gone'); }, 1600);
}
(function type(i) {
  if (veilDone) return;
  if (i >= LINES.length) { const p = document.createElement('span'); p.className = 'veil-go'; p.textContent = '> touch to fall asleep'; vlog.appendChild(p); return; }
  vlog.textContent += LINES[i] + '\n';
  setTimeout(function () { type(i + 1); }, i === 1 ? 640 : rand(200, 340));
})(0);
veil.addEventListener('pointerdown', liftVeil);

/* ---------- sound ---------- */
// on unless it was turned off on an earlier visit; it can only begin at the first touch or key
const sound = createSound();
const sndBtn = $('#snd');
let soundWanted = true;
try { soundWanted = localStorage.getItem('limbo-sound') !== 'off'; } catch (e) { soundWanted = true; }
function showSound(on) {
  sndBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  sndBtn.querySelector('span').textContent = on ? 'on' : 'off';
}
showSound(soundWanted);
function wakeSound(e) {
  if (!soundWanted || (e && e.target && e.target.closest && e.target.closest('#snd'))) return;
  sound.start();
}
['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'].forEach(function (ev) { window.addEventListener(ev, wakeSound, true); });
sndBtn.addEventListener('click', function () {
  let on;
  if (soundWanted && sound.isOn()) on = sound.toggle();
  else { sound.start(); on = true; }
  soundWanted = on;
  try { localStorage.setItem('limbo-sound', on ? 'on' : 'off'); } catch (e) { /* not remembered */ }
  showSound(on);
});

/* ---------- words ---------- */
const SCR = '!<>-_\\/[]{}=+*^?#01';
// the words go inside a span that carries the white, line by line
function hl(el) {
  let s = el.querySelector(':scope > .hl');
  if (!s) { s = document.createElement('span'); s.className = 'hl'; s.textContent = el.textContent; el.textContent = ''; el.appendChild(s); }
  return s;
}
$$('.frag, .sub, .note, .whisper').forEach(hl);
function scramble(el) {
  const text = el.getAttribute('data-text') || el.textContent;
  const into = el.classList.contains('title') ? el : hl(el);
  if (el.__busy) return;
  el.__busy = true;
  const n = text.length, start = performance.now(), dur = 500 + n * 14;
  (function step(now) {
    const p = (now - start) / dur;
    let out = '';
    for (let i = 0; i < n; i++) {
      const c = text[i];
      out += c === ' ' || c === '\n' || i / n < p * 1.2 - 0.2 ? c : SCR[(Math.random() * SCR.length) | 0];
    }
    into.textContent = out;
    if (p < 1) requestAnimationFrame(step); else { into.textContent = text; el.__busy = false; }
  })(start);
}
const words = $$('.frag, .title, .note');
words.forEach(function (el) { el.setAttribute('data-text', el.textContent); });
const seen = new WeakSet();
const io = new IntersectionObserver(function (es) {
  es.forEach(function (e) {
    if (e.isIntersecting && !seen.has(e.target)) { seen.add(e.target); scramble(e.target); }
    else if (!e.isIntersecting) seen.delete(e.target);
  });
}, { threshold: 0.6 });
words.forEach(function (el) { io.observe(el); });
function glitchWords() {
  const vis = words.filter(function (el) { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
  if (!vis.length) return;
  const el = vis[(Math.random() * vis.length) | 0];
  el.classList.add('glitch');
  setTimeout(function () { el.classList.remove('glitch'); }, rand(260, 620));
}

// a line that appears for a moment and goes
const whisperEl = $('#whisper');
let whisperTimer = 0;
function whisper(text, ms) {
  hl(whisperEl).textContent = text;
  whisperEl.setAttribute('data-text', text);
  whisperEl.classList.add('on');
  scramble(whisperEl);
  clearTimeout(whisperTimer);
  whisperTimer = setTimeout(function () { whisperEl.classList.remove('on'); }, ms || 3200);
}

/* ---------- the readouts ---------- */
const whereEl = $('#where'), sinceEl = $('#since'), hint = $('#hint');
const born = performance.now();
let lastInput = performance.now();
window.addEventListener('scroll', function () {
  lastInput = performance.now();
  if (window.scrollY > 40) hint.classList.add('gone');
}, { passive: true });
setTimeout(function () { hint.classList.add('gone'); }, 14000);

let flash = 0;
const secrets = { wake: null };
$$('.door.stay').forEach(function (a) {
  a.addEventListener('click', function (e) {
    e.preventDefault();
    flash = 1;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });
});
// the name in the corner takes you up; five quick taps on it and something tries to wake you
const mark = $('.mark');
let markTaps = [];
mark.addEventListener('click', function (e) {
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  const now = performance.now();
  markTaps = markTaps.filter(function (x) { return now - x < 2500; });
  markTaps.push(now);
  if (markTaps.length >= 5 && secrets.wake) { markTaps = []; secrets.wake(); }
});

/* ---------- the world ---------- */
const canvas = $('#world');
let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, powerPreference: 'high-performance' }); }
catch (e) { renderer = null; }

if (!renderer) {
  html.classList.add('no-gl');
  liftVeil();
} else {
  start();
}

async function start() {
  try { await Promise.race([document.fonts.load('400 40px "IBM Plex Mono"'), new Promise(function (r) { setTimeout(r, 2500); })]); } catch (e) { /* draw with a fallback font */ }

  const world = createWorld();
  const rt = new THREE.WebGLRenderTarget(2, 2, { magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter, depthBuffer: true });
  const post = createPost(rt.texture);
  const size = new THREE.Vector2();
  let quality = 1;

  function resize() {
    const w = window.innerWidth, h = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, quality < 0.8 ? 1 : 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    const sh = Math.round(Math.min(400, Math.max(220, h / 2.3)) * quality), sw = Math.max(2, Math.round(sh * w / h));
    rt.setSize(sw, sh);
    world.camera.aspect = w / h;
    world.camera.fov = w < h ? 78 : 62;
    world.camera.updateProjectionMatrix();
    renderer.getDrawingBufferSize(size);
    post.setSize(size.x, size.y, sw, sh, Math.round((w < 600 ? 10 : 12.5) * dpr), Math.max(4, Math.round(5 * dpr)));
  }
  resize();
  window.addEventListener('resize', resize);

  /* looking around with the mouse; on touch the gaze drifts by itself */
  const look = { x: 0, y: 0 }, lookT = { x: 0, y: 0 };
  let mouse = false;
  window.addEventListener('pointermove', function (e) {
    lastInput = performance.now();
    if (e.pointerType !== 'mouse') return;
    mouse = true;
    lookT.x = (e.clientX / window.innerWidth - 0.5) * 2;
    lookT.y = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  /* the glitch: by itself now and then, or on a touch */
  let glitch = 0, nextGlitch = rand(6, 10), asciiUntil = 0, eyesUntil = 0, ghostUntil = 0, t = 0, zoneName = 'the baths';
  function kick(s, auto) {
    glitch = Math.max(glitch, s);
    if (sound.isOn()) sound.glitch(s);
    glitchWords();
    if (auto && Math.random() < 0.35) asciiUntil = t + rand(0.4, 0.8);
    if (zoneName === 'the chapel' && Math.random() < (auto ? 0.65 : 0.3)) eyesUntil = t + rand(1.1, 1.8);
    if (Math.random() < (auto ? 0.45 : 0.2)) ghostUntil = t + rand(0.5, 1.4);
  }

  let wakeT0 = -1, wakeNext = 0;
  const clock = function () { return performance.now() / 1000; };

  /* ---- someone tries to wake you ---- */
  const wakeEl = $('#wake');
  function startWake() {
    if (wakeT0 >= 0 || !veilDone) return;
    wakeT0 = clock(); wakeNext = 0;
    wakeEl.textContent = '';
    for (let i = 0; i < 18; i++) { const s = document.createElement('span'); s.textContent = 'WAKE UP'; wakeEl.appendChild(s); }
    wakeEl.hidden = false;
  }
  secrets.wake = startWake;

  /* ---- touching things ---- */
  const WATER = ['too warm to leave.', 'it never gets cold.', 'the water remembers you.', 'it does not get deeper. it does not need to.'];
  const ANGEL = ['she will not turn around.', 'she has been crying since before you came.', 'do not wait for her face.', 'it was never your fault.'];
  let u = 0, angelLine = 0;
  function goThroughDoor() {
    flash = 1;
    if (sound.isOn()) sound.glitch(0.6);
    setTimeout(function () { window.scrollTo(0, 0); u = 0; whisper('it opened onto the beginning.', 3600); }, 380);
  }
  function tap(x, y, el) {
    const hit = world.pick(x, y);
    if (hit) {
      if (hit.name === 'angel') { if (sound.isOn()) sound.glitch(0.3); whisper(ANGEL[angelLine++ % ANGEL.length], 3600); return; }
      if (hit.name === 'door') { goThroughDoor(); return; }
      if (hit.name === 'tv') { world.tvClick(); if (sound.isOn()) sound.glitch(0.5); whisper('ch.07. nobody is watching.'); return; }
      if (hit.name === 'water') { world.ripple(hit.point); if (sound.isOn()) sound.drip(); whisper(WATER[(Math.random() * WATER.length) | 0]); return; }
    }
    kick(rand(0.5, 0.85), false);
  }

  /* hold still to see what it is made of; a short touch touches */
  let holding = false, holdTimer = 0, down = null;
  function isUI(el) { return el && el.closest && el.closest('a, button, input, textarea, label'); }
  window.addEventListener('pointerdown', function (e) {
    lastInput = performance.now();
    if (!veilDone) return;
    if (isUI(e.target) || wakeT0 >= 0) return;
    down = { x: e.clientX, y: e.clientY, t: performance.now(), el: e.target };
    clearTimeout(holdTimer);
    holdTimer = setTimeout(function () { holding = true; if (sound.isOn()) sound.glitch(0.3); }, 320);
  });
  window.addEventListener('pointermove', function (e) {
    if (down && !holding && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) { clearTimeout(holdTimer); down = null; }
  }, { passive: true });
  window.addEventListener('pointerup', function () {
    clearTimeout(holdTimer);
    if (holding) holding = false;
    else if (down && performance.now() - down.t < 320) tap(down.x, down.y, down.el);
    down = null;
  });
  window.addEventListener('pointercancel', function () { clearTimeout(holdTimer); holding = false; down = null; });
  window.addEventListener('contextmenu', function (e) { if (holding || down) e.preventDefault(); });

  /* words typed into the place */
  let typed = '';
  window.addEventListener('keydown', function (e) {
    lastInput = performance.now();
    if (!veilDone) { liftVeil(); return; }
    if (e.key.length === 1 && /[a-z]/i.test(e.key)) {
      typed = (typed + e.key.toLowerCase()).slice(-12);
      if (typed.endsWith('wakeup')) { typed = ''; startWake(); }
    }
  });

  let last = performance.now(), whiteIntro = 1, ascii = 0, nextDrip = 3, hudAt = 0, slow = 0, slowN = 0, idleShown = false;
  // ?debug in the address: handles for looking at the rare moments on purpose
  if (/[?&]debug\b/.test(location.search)) {
    window.__limbo = {
      kick: function (s) { kick(s, false); },
      ascii: function (d) { asciiUntil = t + d; },
      eyes: function (d) { eyesUntil = t + d; },
      ghost: function (d) { ghostUntil = t + d; },
      still: function () { nextGlitch = 1e9; },
      wake: startWake, door: goThroughDoor,
      tap: function (x, y) { tap(x, y, document.elementFromPoint(x, y)); },
      pick: function (x, y) { const h = world.pick(x, y); return h && h.name; },
      idle: function () { lastInput = performance.now() - 60000; }
    };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now; t += dt;

    // if this machine struggles, draw fewer pixels
    slow += dt; slowN++;
    if (slowN >= 90) {
      if (slow / slowN > 0.03 && quality > 0.6) { quality -= 0.15; resize(); }
      slow = 0; slowN = 0;
    }

    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    u += (p - u) * (1 - Math.exp(-dt * 2.6));
    if (!mouse) { lookT.x = Math.sin(t * 0.13) * 0.25; lookT.y = Math.sin(t * 0.09) * 0.1; }
    const k = 1 - Math.exp(-dt * 3);
    look.x += (lookT.x - look.x) * k; look.y += (lookT.y - look.y) * k;

    const info = world.update(u, t, dt, look);
    zoneName = info.zone.name;

    // waking up is not possible
    if (wakeT0 >= 0) {
      const lt = clock() - wakeT0;
      Array.prototype.forEach.call(wakeEl.children, function (s) { s.style.visibility = Math.random() < 0.25 ? 'hidden' : ''; s.style.translate = (Math.random() < 0.3 ? rand(-30, 30) : 0) + 'px 0'; });
      if (lt > wakeNext) { wakeNext = lt + rand(0.12, 0.28); kick(rand(0.6, 1), false); }
      if (lt > 2.6) { wakeT0 = -1; wakeEl.hidden = true; flash = 0.7; whisper("you can't.", 3000); }
    }

    if (veilDone && wakeT0 < 0 && t > nextGlitch) {
      kick(reduced ? rand(0.3, 0.6) : rand(0.45, 1), true);
      nextGlitch = t + (reduced ? rand(16, 30) : rand(8, 16));
    }
    glitch = Math.max(0, glitch - dt * 1.6);
    ascii += ((holding || t < asciiUntil ? 1 : 0) - ascii) * (1 - Math.exp(-dt * 6));

    // if you stay without moving for long enough, someone comes closer
    const idle = veilDone && now - lastInput > 40000;
    if (idle && !idleShown) { idleShown = true; whisper('are you still there?', 4200); }
    if (!idle) idleShown = false;
    world.setEyes(t < eyesUntil);
    world.setPresence((t < ghostUntil && Math.sin(t * 37) > -0.5) || idle, zoneName, idle ? 7 : 17);

    if (veilDone) whiteIntro = Math.max(0, whiteIntro - dt / 2.4);
    flash = Math.max(0, flash - dt * 0.7);
    const passing = Math.exp(-Math.pow((info.z + 215) / 4, 2));
    const U = post.uniforms;
    U.uWhite.value = Math.min(1, Math.max(whiteIntro, flash, passing * 0.92));
    U.uTime.value = t; U.uGlitch.value = glitch; U.uAscii.value = ascii; U.uDots.value = info.zone.dots;

    renderer.setRenderTarget(rt);
    renderer.render(world.scene, world.camera);
    renderer.setRenderTarget(null);
    renderer.render(post.scene, post.camera);

    // the air follows where you are
    if (sound.isOn()) {
      const w = { baths: 0, field: 0, chapel: 0, sky: 0 }, z = info.zone;
      w[z.a.name.slice(4)] += 1 - z.t; w[z.b.name.slice(4)] += z.t;
      sound.setZone(w);
      if (w.baths > 0.4 && t > nextDrip) { sound.drip(); nextDrip = t + rand(1.4, 5); }
    }
    if (now - hudAt > 120) {
      hudAt = now;
      whereEl.textContent = zoneName + ' · ' + pad(info.walked.toFixed(1), 5) + ' m';
      const s = Math.floor((now - born) / 1000);
      sinceEl.textContent = 'here for ' + pad(Math.floor(s / 3600), 2) + ':' + pad(Math.floor(s / 60) % 60, 2) + ':' + pad(s % 60, 2);
    }
  }
  requestAnimationFrame(frame);
}

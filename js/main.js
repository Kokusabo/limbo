/* main.js - waking up, walking (the scroll), looking (the mouse), holding still
 * (the ascii view), the glitches, the readouts, and the air. */
import * as THREE from '../vendor/three.module.min.js';
import { createWorld } from './world.js?v=1';
import { createPost } from './post.js?v=1';
import { createSound } from './sound.js?v=1';

const $ = function (s) { return document.querySelector(s); };
const $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand = function (a, b) { return a + Math.random() * (b - a); };
const pad = function (n, w) { return String(n).padStart(w, '0'); };

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

/* ---------- waking up ---------- */
const veil = $('#veil'), vlog = $('#veil-log');
const LINES = ['> sleep detected', '> looking for the way back ........ none', '> loading layer 0', '> there is no layer 1', '> welcome'];
let veilDone = false;
function liftVeil() {
  if (veilDone) return;
  veilDone = true;
  veil.classList.add('off');
  setTimeout(function () { veil.classList.add('gone'); }, 1600);
}
(function type(i) {
  if (veilDone) return;
  if (i >= LINES.length) { setTimeout(liftVeil, 600); return; }
  vlog.textContent += LINES[i] + '\n';
  setTimeout(function () { type(i + 1); }, i === 1 ? 640 : rand(200, 340));
})(0);
window.addEventListener('keydown', liftVeil);
veil.addEventListener('pointerdown', liftVeil);

/* ---------- sound ---------- */
const sound = createSound();
const sndBtn = $('#snd');
sndBtn.addEventListener('click', function () {
  const on = sound.toggle();
  sndBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  sndBtn.querySelector('span').textContent = on ? 'on' : 'off';
});

/* ---------- words ---------- */
const SCR = '!<>-_\\/[]{}=+*^?#01';
function scramble(el) {
  const text = el.getAttribute('data-text') || el.textContent;
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
    el.textContent = out;
    if (p < 1) requestAnimationFrame(step); else { el.textContent = text; el.__busy = false; }
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

/* ---------- the doors at the end ---------- */
let flash = 0;
$$('a[href="#top"]').forEach(function (a) {
  a.addEventListener('click', function (e) {
    e.preventDefault();
    flash = 1;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });
});

/* ---------- the readouts ---------- */
const whereEl = $('#where'), sinceEl = $('#since'), hint = $('#hint');
const born = performance.now();
window.addEventListener('scroll', function () { if (window.scrollY > 40) hint.classList.add('gone'); }, { passive: true });
setTimeout(function () { hint.classList.add('gone'); }, 14000);

/* ---------- the world ---------- */
const canvas = $('#world');
let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, powerPreference: 'high-performance' }); }
catch (e) { renderer = null; }

if (!renderer) {
  document.documentElement.classList.add('no-gl');
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
    if (e.pointerType !== 'mouse') return;
    mouse = true;
    lookT.x = (e.clientX / window.innerWidth - 0.5) * 2;
    lookT.y = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  /* the glitch: by itself now and then, or on a click */
  let glitch = 0, nextGlitch = rand(6, 10), asciiUntil = 0, eyesUntil = 0, ghostUntil = 0, t = 0, zoneName = 'the baths';
  function kick(s, auto) {
    glitch = Math.max(glitch, s);
    if (sound.isOn()) sound.glitch(s);
    glitchWords();
    if (auto && Math.random() < 0.35) asciiUntil = t + rand(0.4, 0.8);
    if (zoneName === 'the chapel' && Math.random() < (auto ? 0.65 : 0.3)) eyesUntil = t + rand(1.1, 1.8);
    if (Math.random() < (auto ? 0.45 : 0.2)) ghostUntil = t + rand(0.5, 1.4);
  }

  /* hold still to see what it is made of */
  let holding = false, holdTimer = 0, down = null;
  function isUI(el) { return el && el.closest && el.closest('a, button, input, textarea, label'); }
  window.addEventListener('pointerdown', function (e) {
    if (isUI(e.target) || !veilDone) return;
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
    clearTimeout(holdTimer);
    holdTimer = setTimeout(function () { holding = true; if (sound.isOn()) sound.glitch(0.3); }, 320);
  });
  window.addEventListener('pointermove', function (e) {
    if (down && !holding && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) { clearTimeout(holdTimer); down = null; }
  }, { passive: true });
  window.addEventListener('pointerup', function () {
    clearTimeout(holdTimer);
    if (holding) holding = false;
    else if (down && performance.now() - down.t < 320) kick(rand(0.5, 0.85), false);
    down = null;
  });
  window.addEventListener('pointercancel', function () { clearTimeout(holdTimer); holding = false; down = null; });
  window.addEventListener('contextmenu', function (e) { if (holding || down) e.preventDefault(); });

  let u = 0, last = performance.now(), whiteIntro = 1, ascii = 0, nextDrip = 3, hudAt = 0, slow = 0, slowN = 0;
  // ?debug in the address: handles for looking at the rare moments on purpose
  if (/[?&]debug\b/.test(location.search)) {
    window.__limbo = {
      kick: function (s) { kick(s, false); },
      ascii: function (d) { asciiUntil = t + d; },
      eyes: function (d) { eyesUntil = t + d; },
      ghost: function (d) { ghostUntil = t + d; },
      still: function () { nextGlitch = 1e9; }
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

    if (veilDone && t > nextGlitch) {
      kick(reduced ? rand(0.3, 0.6) : rand(0.45, 1), true);
      nextGlitch = t + (reduced ? rand(16, 30) : rand(8, 16));
    }
    glitch = Math.max(0, glitch - dt * 1.6);
    ascii += ((holding || t < asciiUntil ? 1 : 0) - ascii) * (1 - Math.exp(-dt * 6));
    world.setEyes(t < eyesUntil);
    world.setPresence(t < ghostUntil && Math.sin(t * 37) > -0.5, zoneName);

    if (veilDone) whiteIntro = Math.max(0, whiteIntro - dt / 2.4);
    flash = Math.max(0, flash - dt * 0.7);
    const passing = Math.exp(-Math.pow((info.z + 215) / 4, 2));
    const settle = Math.min(1, Math.max(0, (u - 0.94) / 0.06)) * 0.5; // at the very end the sky pales so the last words can be read
    const U = post.uniforms;
    U.uWhite.value = Math.min(1, Math.max(whiteIntro, flash, passing * 0.92, settle));
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

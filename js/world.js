/* world.js - the place itself. Everything here is built from code: boxes, cylinders,
 * a few curves, and textures painted pixel by pixel on small canvases, so it looks
 * like a level from an old 3D game that was never finished.
 *
 * The walk goes along one path: the baths -> the field -> the chapel -> the sky.
 */
import * as THREE from '../vendor/three.module.min.js';
import { featherTexture } from './angel.js?v=5';
import { buildProps, grassField } from './props.js?v=5';

const TAU = Math.PI * 2;
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const R = rng(20261111);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ---------- textures: tiny canvases, nearest filtering, so every texel shows ---------- */
function canvasTexture(w, h, draw, opts) {
  opts = opts || {};
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  draw(x, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = opts.linear ? THREE.LinearFilter : THREE.NearestFilter;
  t.minFilter = opts.linear ? THREE.LinearMipmapLinearFilter : THREE.NearestMipmapNearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function rgba(r, g, b, a) { return 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + a + ')'; }
function specks(x, w, h, n, f) { for (let i = 0; i < n; i++) { x.fillStyle = f(); x.fillRect((R() * w) | 0, (R() * h) | 0, 1, 1); } }
// a random wandering line, drawn nine times so the texture tiles without a seam
function vein(x, w, h, color, steps, len) {
  let px = R() * w, py = R() * h, a = R() * TAU;
  const pts = [[px, py]];
  for (let s = 0; s < steps; s++) { a += (R() - 0.5) * 0.9; px += Math.cos(a) * len; py += Math.sin(a) * len; pts.push([px, py]); }
  x.strokeStyle = color; x.lineWidth = 1;
  for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
    x.beginPath();
    pts.forEach(function (p, i) { if (i) x.lineTo(p[0] + ox, p[1] + oy); else x.moveTo(p[0] + ox, p[1] + oy); });
    x.stroke();
  }
}

function makeTextures() {
  const T = {};
  T.marble = canvasTexture(64, 64, function (x, w, h) {
    x.fillStyle = '#eef2f6'; x.fillRect(0, 0, w, h);
    specks(x, w, h, 900, function () { const v = R(); return rgba(150 + v * 40, 165 + v * 35, 185 + v * 30, 0.05 + R() * 0.09); });
    for (let k = 0; k < 4; k++) vein(x, w, h, rgba(140, 156, 178, 0.22 + R() * 0.3), 18, 5);
  });
  T.flute = canvasTexture(64, 64, function (x, w, h) {
    for (let px = 0; px < w; px++) {
      const f = (px % 8) / 8, s = 0.84 + 0.16 * Math.sin(f * Math.PI);
      x.fillStyle = rgba(238 * s, 242 * s, 246 * s, 1); x.fillRect(px, 0, 1, h);
    }
    specks(x, w, h, 300, function () { return rgba(150, 165, 185, 0.06 + R() * 0.08); });
    vein(x, w, h, rgba(140, 156, 178, 0.25), 14, 5);
  });
  T.pool = canvasTexture(64, 64, function (x, w, h) {
    for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) {
      const v = R() * 18 - 9;
      x.fillStyle = rgba(104 + v, 206 + v, 212 + v, 1); x.fillRect(tx * 16, ty * 16, 16, 16);
      x.fillStyle = rgba(255, 255, 255, 0.08); x.fillRect(tx * 16 + 2, ty * 16 + 2, 12, 5);
    }
    specks(x, w, h, 260, function () { return rgba(40, 120, 130, 0.12); });
    x.fillStyle = '#2f7f88';
    for (let i = 0; i < 4; i++) { x.fillRect(i * 16 + 15, 0, 1, h); x.fillRect(0, i * 16 + 15, w, 1); }
  });
  T.stone = canvasTexture(64, 64, function (x, w, h) {
    for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) {
      const v = R() * 22 - 11;
      x.fillStyle = rgba(166 + v, 170 + v, 168 + v, 1); x.fillRect(tx * 16, ty * 16, 16, 16);
    }
    specks(x, w, h, 1100, function () { const v = R() * 60 - 30; return rgba(150 + v, 154 + v, 152 + v, 0.5); });
    x.fillStyle = '#63686a';
    for (let i = 0; i < 4; i++) { x.fillRect(i * 16 + 15, 0, 1, h); x.fillRect(0, i * 16 + 15, w, 1); }
  });
  T.grass = canvasTexture(64, 64, function (x, w, h) {
    const P = ['#7f9a5a', '#86a35f', '#77924f', '#90aa66', '#9aaf6e', '#6e8a4a', '#a2b675'];
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      x.fillStyle = P[(R() * R() * P.length * 1.6) % P.length | 0]; x.fillRect(px, py, 1, 1);
    }
  });
  T.wall = canvasTexture(64, 64, function (x, w, h) {
    x.fillStyle = '#eef1f4'; x.fillRect(0, 0, w, h);
    specks(x, w, h, 500, function () { return rgba(170, 182, 196, 0.1 + R() * 0.08); });
    x.fillStyle = 'rgba(186,196,208,0.55)';
    for (let r = 0; r < 4; r++) {
      x.fillRect(0, r * 16 + 15, w, 1);
      const off = r % 2 ? 16 : 0;
      for (let b = 0; b < 3; b++) x.fillRect((off + b * 32) % w + 31 > w ? w - 1 : (off + b * 32) % w + 31, r * 16, 1, 16);
    }
  });
  T.bark = canvasTexture(32, 32, function (x, w, h) {
    for (let px = 0; px < w; px++) { const v = R() * 30; x.fillStyle = rgba(92 + v, 74 + v * 0.8, 56 + v * 0.6, 1); x.fillRect(px, 0, 1, h); }
    specks(x, w, h, 120, function () { return rgba(40, 30, 22, 0.4); });
  });
  T.leaves = canvasTexture(32, 32, function (x, w, h) {
    const P = ['#4f7a2c', '#5e8c35', '#3f6524', '#6f9a3f', '#86a84a'];
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) { x.fillStyle = P[(R() * P.length) | 0]; x.fillRect(px, py, 1, 1); }
  });
  // a window: pale glass with lead lines and a little tracery in the arch
  T.window = canvasTexture(64, 128, function (x, w, h) {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#eef5fc');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(150,170,195,0.95)'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(w / 2 + 0.5, 30); x.lineTo(w / 2 + 0.5, h); x.stroke();
    for (let y = 40; y < h; y += 14) { x.beginPath(); x.moveTo(0, y + 0.5); x.lineTo(w, y + 0.5); x.stroke(); }
    x.beginPath(); x.arc(w / 2, 20, 9, 0, TAU); x.stroke();
    x.beginPath(); x.arc(w / 2 - 12, 34, 6, 0, TAU); x.arc(w / 2 + 12, 34, 6, 0, TAU); x.stroke();
    x.strokeStyle = 'rgba(120,140,170,0.9)'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, w - 3, h - 3);
  }, { linear: true });
  // the light in the shafts: bright at the window, gone at the floor, soft at both sides
  T.shaft = canvasTexture(32, 64, function (x, w, h) {
    const d = x.createImageData(w, h);
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const u = px / (w - 1), v = py / (h - 1), a = Math.pow(Math.sin(u * Math.PI), 2) * (1 - v * 0.85);
      const o = (py * w + px) * 4; d.data[o] = d.data[o + 1] = d.data[o + 2] = 255; d.data[o + 3] = a * 255;
    }
    x.putImageData(d, 0, 0);
  }, { linear: true });
  return T;
}

// an eye, painted into a window shape: used when the place looks back
export function paintEye(look) {
  return canvasTexture(64, 128, function (x, w, h) {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
    const cx = w / 2, cy = 64, ew = 26, eh = 11;
    x.beginPath();
    x.moveTo(cx - ew, cy);
    x.bezierCurveTo(cx - ew * 0.5, cy - eh * 1.5, cx + ew * 0.5, cy - eh * 1.5, cx + ew, cy - 1);
    x.bezierCurveTo(cx + ew * 0.5, cy + eh * 1.2, cx - ew * 0.5, cy + eh * 1.2, cx - ew, cy);
    x.closePath();
    x.fillStyle = '#f2f6fa'; x.fill();
    x.save(); x.clip();
    const ix = cx + look * 9, iy = cy + 1;
    const g = x.createRadialGradient(ix, iy, 1, ix, iy, 11);
    g.addColorStop(0, '#a9cdf0'); g.addColorStop(0.7, '#5d8fc4'); g.addColorStop(1, '#2c4a6e');
    x.fillStyle = g; x.beginPath(); x.arc(ix, iy, 11, 0, TAU); x.fill();
    x.fillStyle = '#18222e'; x.beginPath(); x.arc(ix, iy, 4.5, 0, TAU); x.fill();
    x.fillStyle = '#ffffff'; x.fillRect(ix - 4, iy - 5, 2, 2);
    x.restore();
    x.strokeStyle = '#2a3644'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(cx - ew, cy); x.bezierCurveTo(cx - ew * 0.5, cy - eh * 1.5, cx + ew * 0.5, cy - eh * 1.5, cx + ew, cy - 1); x.stroke();
    x.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const t = 0.1 + i * 0.1, px = cx - ew + t * 2 * ew, py = cy - eh * 1.5 * Math.sin(t * Math.PI) * 0.75;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + (t - 0.5) * 8, py - 5 - Math.sin(t * Math.PI) * 3); x.stroke();
    }
    x.strokeStyle = 'rgba(42,54,68,0.5)';
    x.beginPath(); x.moveTo(cx + ew, cy - 1); x.bezierCurveTo(cx + ew * 0.5, cy + eh * 1.2, cx - ew * 0.5, cy + eh * 1.2, cx - ew, cy); x.stroke();
  }, { linear: true });
}

/* ---------- geometry helpers ---------- */
// a quad from four points; flipped if needed so it faces `face`; uv from (u, v) per corner
function quad(p, uv, face) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([].concat(p[0], p[1], p[2], p[3]), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([].concat(uv[0], uv[1], uv[2], uv[3]), 2));
  const a = new THREE.Vector3().fromArray(p[0]), b = new THREE.Vector3().fromArray(p[1]), c = new THREE.Vector3().fromArray(p[2]);
  const n = b.sub(a).cross(c.sub(a));
  g.setIndex(n.dot(new THREE.Vector3().fromArray(face)) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
  g.computeVertexNormals();
  return g;
}
// a floor rectangle with uvs in world units (s = repeats per unit)
function floor(x0, x1, z0, z1, y, s) {
  return quad([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]],
    [[x0 * s, z0 * s], [x1 * s, z0 * s], [x1 * s, z1 * s], [x0 * s, z1 * s]], [0, 1, 0]);
}
// a vertical wall from (ax, az) to (bx, bz), facing `face`
function wall(ax, az, bx, bz, y0, y1, s, face) {
  const len = Math.hypot(bx - ax, bz - az);
  return quad([[ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]],
    [[0, y0 * s], [len * s, y0 * s], [len * s, y1 * s], [0, y1 * s]], face);
}
// a pointed arch window, uvs stretched over the whole shape
function arch(w, h, peak) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h);
  s.quadraticCurveTo(w / 2, h + peak * 0.72, 0, h + peak);
  s.quadraticCurveTo(-w / 2, h + peak * 0.72, -w / 2, h); s.lineTo(-w / 2, 0);
  const g = new THREE.ShapeGeometry(s, 10), pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, pos.getY(i) / (h + peak));
  return g;
}
function instanced(geo, mat, places, y) {
  const im = new THREE.InstancedMesh(geo, mat, places.length), m = new THREE.Matrix4();
  places.forEach(function (p, i) { m.makeTranslation(p[0], (p[2] || 0) + y, p[1]); im.setMatrixAt(i, m); });
  im.instanceMatrix.needsUpdate = true;
  im.frustumCulled = false;
  return im;
}

/* ---------- the zones: fog, sky and light change as you walk (keyed by depth along z) ---------- */
const ZONES = [
  { z: 12, name: 'the baths', fog: '#dce8f1', near: 5, far: 64, hor: '#e8f0f6', zen: '#c3d6e6', cloud: 0.25, ccol: '#f3f7fa', glow: 0.15, dots: 0, hemi: 2.7, sun: 1.6 },
  { z: -52, name: 'the baths', fog: '#dce8f1', near: 5, far: 64, hor: '#e8f0f6', zen: '#c3d6e6', cloud: 0.25, ccol: '#f3f7fa', glow: 0.15, dots: 0, hemi: 2.7, sun: 1.6 },
  { z: -70, name: 'the field', fog: '#c9cdcd', near: 14, far: 120, hor: '#c9cdce', zen: '#737a80', cloud: 0.9, ccol: '#e9ecec', glow: 0.55, dots: 0, hemi: 2.1, sun: 1.2 },
  { z: -140, name: 'the field', fog: '#c9cdcd', near: 14, far: 120, hor: '#c9cdce', zen: '#737a80', cloud: 0.9, ccol: '#e9ecec', glow: 0.55, dots: 0, hemi: 2.1, sun: 1.2 },
  { z: -154, name: 'the chapel', fog: '#eef3f8', near: 6, far: 72, hor: '#f2f6fa', zen: '#dfe8f1', cloud: 0.3, ccol: '#ffffff', glow: 0.45, dots: 0, hemi: 2.9, sun: 1.4 },
  { z: -207, name: 'the chapel', fog: '#eef3f8', near: 6, far: 72, hor: '#f2f6fa', zen: '#dfe8f1', cloud: 0.3, ccol: '#ffffff', glow: 0.45, dots: 0, hemi: 2.9, sun: 1.4 },
  { z: -224, name: 'the sky', fog: '#f6f9fc', near: 30, far: 260, hor: '#dbe8fa', zen: '#3a77d6', cloud: 0, ccol: '#ffffff', glow: 0.2, dots: 1, hemi: 3, sun: 1.6 }
];
const COLOR_KEYS = ['fog', 'hor', 'zen', 'ccol'];
ZONES.forEach(function (k) { COLOR_KEYS.forEach(function (c) { k[c] = new THREE.Color(k[c]); }); });
function zoneAt(z) {
  let i = 0;
  while (i < ZONES.length - 2 && z < ZONES[i + 1].z) i++;
  const a = ZONES[i], b = ZONES[i + 1], t = smooth(a.z, b.z, z), out = { name: t < 0.5 ? a.name : b.name, t: t, a: a, b: b };
  ['near', 'far', 'cloud', 'glow', 'dots', 'hemi', 'sun'].forEach(function (k) { out[k] = a[k] + (b[k] - a[k]) * t; });
  COLOR_KEYS.forEach(function (k) { out[k] = a[k].clone().lerp(b[k], t); });
  return out;
}

/* ---------- the sky: overcast, a bright patch, and at the end a sky of dots ---------- */
const SKY_VERT = `
varying vec3 vDir;
void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FRAG = `
uniform vec3 uHor, uZen, uCloudCol;
uniform float uCloud, uGlow, uDots, uTime;
varying vec3 vDir;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
  vec3 d = normalize(vDir);
  float up = clamp(d.y, -0.2, 1.0);
  vec3 col = mix(uHor, uZen, smoothstep(0.0, 0.75, up));
  vec2 sp = d.xz / max(0.14, d.y + 0.28);
  float n = fbm(vec3(sp * 1.3, uTime * 0.015));
  col = mix(col, uCloudCol, smoothstep(0.38, 0.82, n) * uCloud);
  float g = pow(max(dot(d, normalize(vec3(0.0, 0.18, -1.0))), 0.0), 5.0);
  col += vec3(1.0) * g * uGlow;
  if (uDots > 0.001) {
    // a blue sky with heaped white clouds; the screen of dots is added afterwards, in post.js
    vec3 blue = mix(vec3(0.16, 0.42, 0.92), vec3(0.08, 0.27, 0.8), smoothstep(0.2, 1.0, up));
    float c2 = smoothstep(0.42, 0.7, fbm(d * 2.4 + vec3(uTime * 0.012, 0.0, 0.0)));
    col = mix(col, mix(blue, vec3(0.95), c2), uDots);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

/* ---------- the pool floor: tiles seen through moving water, with caustics ---------- */
const WATER_VERT = `
#include <fog_pars_vertex>
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const WATER_FRAG = `
uniform sampler2D map;
uniform float uTime;
uniform vec3 uTint;
uniform vec3 uRip;
#include <fog_pars_fragment>
varying vec3 vW;
float caus(vec2 p, float t) {
  float a = sin(p.x * 2.1 + t) + sin(p.y * 2.4 - t * 0.8);
  float b = sin((p.x + p.y) * 1.7 + t * 0.6) + sin((p.x - p.y) * 1.9 - t * 0.9);
  return pow(clamp(1.0 - abs(a + b * 0.8) * 0.5, 0.0, 1.0), 6.0);
}
void main() {
  vec2 p = vW.xz;
  vec2 wob = vec2(sin(p.y * 1.3 + uTime * 1.1), cos(p.x * 1.1 + uTime * 0.9)) * 0.07;
  // a ring spreading from where the water was touched
  float age = uTime - uRip.z, rd = distance(p, uRip.xy);
  float ring = (age > 0.0 && rd < age * 3.0) ? sin(rd * 6.0 - age * 8.0) * exp(-age * 1.2) * exp(-rd * 0.25) : 0.0;
  wob += normalize(p - uRip.xy + 0.0001) * ring * 0.14;
  vec3 tile = texture2D(map, (p + wob) * 0.25).rgb;
  float c = caus(p * 0.9 + wob * 3.0, uTime * 0.8) + caus(p * 1.7 - wob * 2.0 + 3.0, uTime * 1.1) * 0.6;
  vec3 col = tile * uTint + vec3(0.85, 1.0, 1.0) * (c * 0.32 + max(ring, 0.0) * 0.12);
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`;

export function createWorld() {
  const T = makeTextures();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
  scene.fog = new THREE.Fog(0xdce8f1, 5, 64);

  const hemi = new THREE.HemisphereLight(0xf3f8ff, 0x9aa6b2, 2.7);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-30, 60, 20);
  scene.add(hemi, sun);

  const M = {
    marble: new THREE.MeshLambertMaterial({ map: T.marble }),
    flute: new THREE.MeshLambertMaterial({ map: T.flute }),
    pool: new THREE.MeshLambertMaterial({ map: T.pool }),
    stone: new THREE.MeshLambertMaterial({ map: T.stone }),
    grass: new THREE.MeshLambertMaterial({ map: T.grass }),
    wall: new THREE.MeshLambertMaterial({ map: T.wall, side: THREE.DoubleSide }),
    bark: new THREE.MeshLambertMaterial({ map: T.bark }),
    leaves: new THREE.MeshLambertMaterial({ map: T.leaves, flatShading: true }),
    window: new THREE.MeshBasicMaterial({ map: T.window, fog: false }),
    glow: new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }),
    ghost: new THREE.MeshBasicMaterial({ color: 0x8c9db0 }),
    feather: new THREE.MeshLambertMaterial({ map: featherTexture(), alphaTest: 0.5, side: THREE.DoubleSide })
  };
  T.flute.repeat.set(2, 1);

  // the sky follows the camera
  const skyU = {
    uHor: { value: new THREE.Color() }, uZen: { value: new THREE.Color() }, uCloudCol: { value: new THREE.Color() },
    uCloud: { value: 0 }, uGlow: { value: 0 }, uDots: { value: 0 }, uTime: { value: 0 }
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16),
    new THREE.ShaderMaterial({ uniforms: skyU, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.renderOrder = -1;
  scene.add(sky);

  // grass everywhere, except where the pool goes down
  scene.add(grassField([[-340, -7, 80, -300], [7, 340, 80, -300], [-7, 7, 80, -6], [-7, 7, -50, -300]],
    new THREE.MeshLambertMaterial({ map: T.grass, vertexColors: true })));

  /* ---- the baths ---- */
  const PX = 7, PZ0 = -6, PZ1 = -50, DEPTH = -1.6;
  [[-26, -PX, 12, -66], [PX, 26, 12, -66], [-PX, PX, 12, PZ0], [-PX, PX, PZ1, -66]].forEach(function (r) {
    scene.add(new THREE.Mesh(floor(r[0], r[1], r[2], r[3], 0, 0.25), M.marble));
  });
  // pool walls, tiled, facing in
  scene.add(new THREE.Mesh(wall(-PX, PZ0, -PX, PZ1, DEPTH, 0, 0.25, [1, 0, 0]), M.pool));
  scene.add(new THREE.Mesh(wall(PX, PZ0, PX, PZ1, DEPTH, 0, 0.25, [-1, 0, 0]), M.pool));
  scene.add(new THREE.Mesh(wall(-PX, PZ0, PX, PZ0, DEPTH, 0, 0.25, [0, 0, -1]), M.pool));
  scene.add(new THREE.Mesh(wall(-PX, PZ1, PX, PZ1, DEPTH, 0, 0.25, [0, 0, 1]), M.pool));
  // the bottom, with water light moving over it
  const waterU = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uTint: { value: new THREE.Color('#c4f0ee') }, uRip: { value: new THREE.Vector3(0, 0, -100) } }]);
  waterU.map = { value: T.pool };
  const waterMat = new THREE.ShaderMaterial({ uniforms: waterU, vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, fog: true });
  scene.add(new THREE.Mesh(floor(-PX, PX, PZ0, PZ1, DEPTH, 1), waterMat));
  const surface = new THREE.Mesh(floor(-PX, PX, PZ0, PZ1, -0.22, 1),
    new THREE.MeshBasicMaterial({ color: 0xe8f8f8, transparent: true, opacity: 0.2, depthWrite: false }));
  surface.userData.pick = 'water';
  scene.add(surface);
  // the coping round the pool
  const coping = new THREE.BoxGeometry(1, 0.12, 1);
  [[0, PZ0 - 0.3, 2 * PX + 1.2, 0.6], [0, PZ1 + 0.3, 2 * PX + 1.2, 0.6], [-PX - 0.3, (PZ0 + PZ1) / 2, 0.6, PZ0 - PZ1], [PX + 0.3, (PZ0 + PZ1) / 2, 0.6, PZ0 - PZ1]].forEach(function (c) {
    const m = new THREE.Mesh(coping, M.marble); m.position.set(c[0], 0.06, c[1]); m.scale.set(c[2], 1, c[3]); scene.add(m);
  });
  // two rows of columns carrying a beam, open to the mist on both sides
  const cols = [];
  for (let z = 4; z >= -60; z -= 8) { cols.push([-12.5, z], [12.5, z]); }
  [[new THREE.BoxGeometry(1.7, 0.35, 1.7), M.marble, 0.175],
   [new THREE.CylinderGeometry(0.72, 0.8, 0.3, 14), M.marble, 0.5],
   [new THREE.CylinderGeometry(0.5, 0.56, 6.6, 14, 1, true), M.flute, 3.95],
   [new THREE.CylinderGeometry(0.82, 0.52, 0.5, 14), M.marble, 7.5],
   [new THREE.BoxGeometry(1.8, 0.35, 1.8), M.marble, 7.925]].forEach(function (p) { scene.add(instanced(p[0], p[1], cols, p[2])); });
  [-12.5, 12.5].forEach(function (x) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.2, 66), M.marble); beam.position.set(x, 8.7, -28); scene.add(beam);
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 66.6), M.marble); cornice.position.set(x, 9.45, -28); scene.add(cornice);
  });
  // urns at the corners of the pool
  const urn = new THREE.LatheGeometry([[0, 0], [0.45, 0], [0.5, 0.1], [0.32, 0.25], [0.3, 0.5], [0.55, 0.9], [0.62, 1.2], [0.5, 1.55], [0.36, 1.7], [0.48, 1.85], [0.48, 1.95], [0, 1.95]].map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 14);
  const plinth = new THREE.BoxGeometry(1, 1.2, 1);
  [[-9, -3], [9, -3]].forEach(function (p) {
    const b = new THREE.Mesh(plinth, M.marble); b.position.set(p[0], 0.6, p[1]); scene.add(b);
    const u = new THREE.Mesh(urn, M.marble); u.position.set(p[0], 1.2, p[1]); scene.add(u);
  });

  /* ---- the field ---- */
  scene.add(new THREE.Mesh(floor(-12, 12, -88, -112, 0.02, 0.25), M.stone));
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.5, 5, 7), M.bark); trunk.position.set(17, 2.5, -118); scene.add(trunk);
  [[17, 5.8, -118, 2.7], [15.6, 6.9, -117, 1.9], [18.6, 6.6, -119.2, 2.1], [17.2, 8.1, -118.3, 1.6]].forEach(function (f) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(f[3], 0), M.leaves); m.position.set(f[0], f[1], f[2]); m.rotation.set(R() * 3, R() * 3, 0); scene.add(m);
  });
  // two broken columns, one fallen
  const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 2.6, 14, 1, true), M.flute); stub.position.set(-13, 1.3, -92); stub.rotation.z = 0.06; scene.add(stub);
  const stubBase = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.35, 1.7), M.marble); stubBase.position.set(-13, 0.175, -92); scene.add(stubBase);
  const fallen = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3.4, 14), M.flute); fallen.position.set(-10.6, 0.5, -96.5); fallen.rotation.set(0, 0.5, Math.PI / 2); scene.add(fallen);
  // a door standing on its own in the grass, full of light
  const door = new THREE.Group();
  const post = new THREE.BoxGeometry(0.3, 4.3, 0.3);
  const l = new THREE.Mesh(post, M.marble); l.position.set(-1.1, 2.15, 0);
  const r = new THREE.Mesh(post, M.marble); r.position.set(1.1, 2.15, 0);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.32, 0.32), M.marble); lintel.position.set(0, 4.36, 0);
  const light = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 4.2), M.glow); light.position.set(0, 2.1, 0);
  door.add(l, r, lintel, light);
  door.position.set(-21, 0, -121); door.rotation.y = 0.55;
  door.userData.pick = 'door';
  door.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(4, 5.2, 2), new THREE.MeshBasicMaterial({ visible: false })), { visible: false }));
  door.children[door.children.length - 1].position.y = 2.4;
  scene.add(door);

  /* ---- the chapel ---- */
  const CX = 11, CZ0 = -150, CZ1 = -216;
  scene.add(new THREE.Mesh(floor(-CX, CX, CZ0, CZ1, 0.015, 0.25), M.marble));
  scene.add(new THREE.Mesh(wall(-CX, CZ0, -CX, CZ1, 0, 22, 0.25, [1, 0, 0]), M.wall));
  scene.add(new THREE.Mesh(wall(CX, CZ0, CX, CZ1, 0, 22, 0.25, [-1, 0, 0]), M.wall));
  scene.add(new THREE.Mesh(wall(-CX, CZ1, CX, CZ1, 0, 22, 0.25, [0, 0, 1]), M.wall));
  const piers = [];
  const winZ = [-158, -172, -186, -200];
  const windows = [];
  const sideArch = arch(3, 9, 2.6), backArch = arch(6.4, 11, 4.4);
  winZ.forEach(function (z) {
    [-1, 1].forEach(function (side) {
      const w = new THREE.Mesh(sideArch, M.window);
      w.position.set(side * (CX - 0.03), 3.6, z); w.rotation.y = -side * Math.PI / 2;
      scene.add(w); windows.push(w);
      // a shaft of light from the window down to the floor
      const top = side * (CX - 0.1), y1 = 12.5, y0 = 4.5;
      const g = quad([[top, y1, z - 1.4], [top, y1, z + 1.4], [side * 2.5, 0.05, z + 1.4 + 6], [side * 2.5, 0.05, z - 1.4 + 6]],
        [[0, 1], [1, 1], [1, 0], [0, 0]], [0, 1, 0]);
      const shaft = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: T.shaft, color: 0xe4f0ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
      shaft.userData.y0 = y0;
      scene.add(shaft);
    });
    piers.push([-CX + 0.4, z - 7], [CX - 0.4, z - 7]);
  });
  piers.push([-CX + 0.4, -151], [CX - 0.4, -151], [-CX + 0.4, -207], [CX - 0.4, -207]);
  scene.add(instanced(new THREE.BoxGeometry(0.9, 22, 1), M.wall, piers, 11));
  const back = new THREE.Mesh(backArch, M.window); back.position.set(0, 3, CZ1 + 0.03); scene.add(back); windows.push(back);
  // dust in the light
  const DUST = 340, dustPos = new Float32Array(DUST * 3), dustSeed = [];
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3] = (R() - 0.5) * 2 * (CX - 1); dustPos[i * 3 + 1] = R() * 14; dustPos[i * 3 + 2] = CZ0 - R() * (CZ0 - CZ1);
    dustSeed.push(R() * TAU);
  }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false }));
  dust.frustumCulled = false;
  scene.add(dust);

  /* ---- everything that fills the place ---- */
  const props = buildProps(scene, M, T, R);
  // feathers drifting down here and there, wherever you are
  const drift = [], dfGeo = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < 14; i++) {
    const f = new THREE.Mesh(dfGeo, M.feather);
    f.scale.set(0.09, 0.3, 1); f.visible = false;
    f.userData = { v: 0.25 + R() * 0.3, p: R() * TAU, live: false };
    scene.add(f); drift.push(f);
  }

  /* ---- someone, sometimes ---- */
  const figure = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.0, 4, 8), M.ghost); body.position.y = 0.95;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), M.ghost); head.position.y = 1.95;
  figure.add(body, head); figure.visible = false;
  scene.add(figure);

  /* ---- the walk ---- */
  const path = new THREE.CatmullRomCurve3([
    [0, 2.3, 8], [3.6, 2.1, -12], [-3.2, 2.2, -32], [0.5, 2.0, -56], [2.5, 1.9, -78], [-4, 1.9, -100],
    [3, 1.8, -124], [0, 2.1, -152], [0, 2.5, -178], [0, 4.2, -200], [0, 7.4, -214], [0, 16, -232], [0, 28, -252]
  ].map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }), false, 'centripetal');
  const total = path.getLength();

  let eyesOn = false;
  const eyeMats = [];
  function setEyes(on) {
    if (on === eyesOn) return;
    eyesOn = on;
    windows.forEach(function (w, i) {
      if (on && (i === windows.length - 1 || R() < 0.45)) {
        const m = new THREE.MeshBasicMaterial({ map: paintEye(R() * 2 - 1), fog: false });
        eyeMats.push(m); w.material = m;
      } else w.material = M.window;
    });
    if (!on) { eyeMats.forEach(function (m) { m.map.dispose(); m.dispose(); }); eyeMats.length = 0; }
  }
  // someone stands a little way ahead, where you are walking; on the water if that is where it lands
  const fwd = new THREE.Vector3();
  function setPresence(on, zoneName, dist) {
    dist = dist || 17;
    if (on && !figure.visible && zoneName !== 'the sky') {
      camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
      const x = camera.position.x + fwd.x * dist, z = camera.position.z + fwd.z * dist;
      const inPool = x > -PX && x < PX && z < PZ0 && z > PZ1;
      figure.position.set(x, inPool ? -0.22 : 0, z);
    }
    figure.visible = !!on && zoneName !== 'the sky';
  }

  const tmp = new THREE.Vector3(), target = new THREE.Vector3();
  let zone = zoneAt(12), nowT = 0;

  // what is under the pointer: an angel, the door, the television, the water
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), pickable = props.targets.concat([door, surface]);
  ray.far = 70;
  function pick(cx, cy) {
    ndc.set(cx / window.innerWidth * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(pickable, true);
    let water = null;
    for (let i = 0; i < hits.length; i++) {
      let o = hits[i].object;
      while (o && !o.userData.pick) o = o.parent;
      if (!o) continue;
      // the water lies in front of everything at the baths, so anything else along the ray wins
      if (o.userData.pick === 'water') { if (!water) water = { name: 'water', point: hits[i].point }; continue; }
      return { name: o.userData.pick, point: hits[i].point };
    }
    return water;
  }

  function update(u, time, dt, look) {
    const p = path.getPointAt(u), tan = path.getTangentAt(u);
    const end = smooth(0.86, 1, u);
    camera.position.copy(p);
    camera.position.y += Math.sin(time * 0.9) * 0.05;
    target.copy(p).addScaledVector(tan, 10);
    target.y += end * 26;
    target.x += Math.sin(time * 0.21) * 0.5;
    camera.lookAt(target);
    camera.rotateY(-look.x * 0.4);
    camera.rotateX(-look.y * 0.22);
    sky.position.copy(camera.position);

    zone = zoneAt(p.z);
    scene.fog.color.copy(zone.fog); scene.fog.near = zone.near; scene.fog.far = zone.far;
    skyU.uHor.value.copy(zone.hor); skyU.uZen.value.copy(zone.zen); skyU.uCloudCol.value.copy(zone.ccol);
    skyU.uCloud.value = zone.cloud; skyU.uGlow.value = zone.glow; skyU.uDots.value = zone.dots; skyU.uTime.value = time;
    hemi.intensity = zone.hemi; sun.intensity = zone.sun;
    waterU.uTime.value = time;
    nowT = time;
    props.update(time, dt);
    // feathers fall in front of you and are replaced when they are gone
    const side = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    side.set(-fwd.z, 0, fwd.x).normalize();
    drift.forEach(function (f) {
      const d = f.userData;
      if (!d.live || f.position.y < camera.position.y - 4 || f.position.distanceTo(camera.position) > 26) {
        f.position.copy(camera.position).addScaledVector(fwd, 5 + R() * 12).addScaledVector(side, (R() - 0.5) * 12);
        f.position.y = camera.position.y + (d.live ? 3 + R() * 4 : R() * 7 - 2);
        d.live = true;
      }
      f.position.y -= d.v * dt;
      f.position.x += Math.sin(time * 0.9 + d.p) * dt * 0.3;
      f.rotation.set(Math.sin(time + d.p) * 0.6, time * 0.4 + d.p, Math.cos(time * 0.7 + d.p) * 0.8);
      f.visible = zone.dots < 0.5;
    });

    for (let i = 0; i < DUST; i++) {
      dustPos[i * 3 + 1] += Math.sin(time * 0.3 + dustSeed[i]) * dt * 0.08 + dt * 0.05;
      dustPos[i * 3] += Math.cos(time * 0.2 + dustSeed[i]) * dt * 0.05;
      if (dustPos[i * 3 + 1] > 14) dustPos[i * 3 + 1] = 0;
    }
    dustGeo.attributes.position.needsUpdate = true;
    if (figure.visible) { tmp.copy(camera.position); tmp.y = figure.position.y; figure.lookAt(tmp); }
    return { zone: zone, walked: u * total, end: end, z: p.z };
  }

  return {
    scene: scene, camera: camera, update: update, setEyes: setEyes, setPresence: setPresence,
    zoneNameAt: function () { return zone.name; },
    pick: pick,
    ripple: function (p) { waterU.uRip.value.set(p.x, p.z, nowT); },
    tvClick: function () { props.tvClick(nowT); }
  };
}

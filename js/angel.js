/* angel.js - a tall, slender marble angel: a long robe falling in deep folds with a band under
 * the breast and a mantle across the back, a bowed head with a carved face, long hair, hands
 * clasped low in front, and two tall wings of layered feathers. The shapes are built once and
 * shared by every statue. In limbo she always faces away. */
import * as THREE from '../vendor/three.module.min.js';

const TAU = Math.PI * 2;
const V = function (x, y, z) { return new THREE.Vector3(x, y, z); };
function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
function sm(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function ga(d, s) { return Math.exp(-d * d / (2 * s * s)); }
function rng(seed) {
  let s = seed >>> 0 || 1;
  return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function pixelTexture(c) {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function geo(pos, col, idx, uv) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function grid(idx, rows, cols) {
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = i * (cols + 1) + j, b = a + cols + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
}
function paint(g, f) {
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const v = f(p.getX(i), p.getY(i), p.getZ(i), i); c[i * 3] = v; c[i * 3 + 1] = v; c[i * 3 + 2] = v * 1.01; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

// a tube whose radius may change along it and around it (r(t, dir) gets the outward direction)
function tube(curve, segs, radial, r) {
  const fr = curve.computeFrenetFrames(segs, false), pos = [], col = [], idx = [], dir = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, P = curve.getPointAt(t), N = fr.normals[i], B = fr.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * TAU;
      dir.set(0, 0, 0).addScaledVector(N, Math.cos(a)).addScaledVector(B, Math.sin(a));
      const k = r(t, dir, a);
      pos.push(P.x + dir.x * k, P.y + dir.y * k, P.z + dir.z * k);
      col.push(1, 1, 1);
    }
  }
  grid(idx, segs, radial);
  return geo(pos, col, idx);
}

/* ---------- the body under the cloth ---------- */
// height, half width, half depth, forward shift
const PROF = [
  [0.00, 0.33, 0.30, 0.03], [0.03, 0.31, 0.28, 0.025], [0.10, 0.275, 0.235, 0.02], [0.30, 0.228, 0.188, 0.012],
  [0.55, 0.196, 0.156, 0.008], [0.80, 0.176, 0.136, 0.004], [1.00, 0.166, 0.126, 0], [1.15, 0.146, 0.11, 0],
  [1.25, 0.13, 0.1, 0.002], [1.38, 0.134, 0.104, 0.006], [1.42, 0.14, 0.11, 0.01], [1.47, 0.15, 0.114, 0.014],
  [1.52, 0.16, 0.104, 0.008], [1.57, 0.172, 0.088, 0], [1.60, 0.158, 0.078, 0], [1.625, 0.1, 0.064, 0], [1.648, 0.044, 0.042, 0.004]
];
function prof(y) {
  let i = 0;
  while (i < PROF.length - 2 && PROF[i + 1][0] < y) i++;
  const a = PROF[i], b = PROF[i + 1], t = clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
  const p0 = PROF[Math.max(0, i - 1)], p3 = PROF[Math.min(PROF.length - 1, i + 2)], out = [];
  for (let k = 1; k < 4; k++) {
    // a cubic through the neighbours, so the outline has no corners
    const m1 = (b[k] - p0[k]) / Math.max(1e-3, b[0] - p0[0]) * (b[0] - a[0]);
    const m2 = (p3[k] - a[k]) / Math.max(1e-3, p3[0] - a[0]) * (b[0] - a[0]);
    const t2 = t * t, t3 = t2 * t;
    out.push((2 * t3 - 3 * t2 + 1) * a[k] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * b[k] + (t3 - t2) * m2);
  }
  return out;
}
function folds(th, y) {
  const f = 0.62 * Math.sin(th * 13 + 0.7 * Math.sin(th * 3 + y * 1.7) + y * 0.35) + 0.38 * Math.sin(th * 7 + 1.9 + y * 0.9);
  const amp = 0.017 * sm(1.4, 1.02, y) + 0.008 * sm(0.35, 0, y);
  return f * amp;
}
// the surface of the robe at an angle and a height
function bodyR(th, y) {
  const p = prof(y), c = Math.cos(th), s = Math.sin(th);
  return { r: p[0] * p[1] / Math.sqrt(p[1] * p[1] * c * c + p[0] * p[0] * s * s), cz: p[2] };
}
function sway(y) { return 0.014 * Math.sin(y * 1.9 - 0.4); }

function robeGeometry() {
  const NY = 120, NT = 84, top = 1.648, pos = [], col = [], idx = [];
  for (let i = 0; i <= NY; i++) {
    const y = top * Math.pow(i / NY, 0.92), p = prof(y);
    for (let j = 0; j <= NT; j++) {
      const th = j / NT * TAU, c = Math.cos(th), s = Math.sin(th);
      let d = folds(th, y);
      // fine gathers above the band, the band itself, a knee pressing through
      d += Math.sin(th * 30) * 0.0024 * sm(1.4, 1.44, y) * sm(1.56, 1.48, y);
      d += 0.006 * ga(y - 1.395, 0.009);
      d += 0.024 * ga(th - (Math.PI / 2 - 0.4), 0.38) * ga(y - 0.56, 0.13);
      const rx = p[0] + d, rz = p[1] + d;
      pos.push(c * rx + sway(y), y, s * rz + p[2]);
      let ao = 0.95 + clamp(d * 3, -0.06, 0.04) - clamp(-d, 0, 0.03) * 7;
      ao -= 0.12 * ga(y - 1.378, 0.01);                 // under the band
      ao *= 0.8 + 0.2 * sm(0, 0.12, y);                 // the floor
      ao -= 0.06 * sm(1.6, 1.64, y);
      col.push(ao, ao, ao * 1.01);
    }
  }
  grid(idx, NY, NT);
  return geo(pos, col, idx);
}

// a mantle: over the left shoulder, across the back, round to the right hip, then hanging down
function mantleGeometry() {
  const NT = 90, NW = 14, pos = [], col = [], idx = [];
  const th0 = Math.PI / 2 + 1.28, th1 = TAU + Math.PI / 2 - 0.62;
  for (let i = 0; i <= NT; i++) {
    const t = i / NT * 1.38, wrap = Math.min(1, t), hang = Math.max(0, t - 1);
    const th = th0 + (th1 - th0) * (sm(0, 1, wrap) * 0.15 + wrap * 0.85);
    const yc = 1.55 - 0.52 * sm(0, 1, wrap) - hang * 1.7;
    const w = 0.1 + 0.2 * sm(0, 0.9, wrap) - 0.1 * sm(0, 0.38, hang);
    for (let j = 0; j <= NW; j++) {
      const v = j / NW * 2 - 1, y = clamp(yc + v * w * 0.5, 0.05, 1.62);
      const ripple = 0.5 + 0.5 * Math.sin(v * Math.PI * 2.6 + t * 9 + Math.sin(t * 4) * 1.5);
      const b = bodyR(th, y), r = b.r + 0.02 + 0.014 * ripple + 0.007 * Math.pow(Math.abs(v), 6) + hang * 0.05;
      pos.push(Math.cos(th) * r + sway(y), y, Math.sin(th) * r + b.cz);
      const ao = 0.82 + 0.16 * ripple - 0.08 * Math.pow(Math.abs(v), 8);
      col.push(ao, ao, ao * 1.01);
    }
  }
  grid(idx, NT, NW);
  return geo(pos, col, idx);
}

/* ---------- the head ---------- */
// the face is carved into a sphere: sockets, closed lids looking down, a long nose, lips, a small chin
function faceD(X, Y) {
  let d = 0;
  for (let s = -1; s <= 1; s += 2) {
    const ex = X - s * 0.0295, inner = sm(0.012, -0.008, s * ex);      // inner: towards the nose
    d += 0.0042 * ga(Y - (0.025 + 0.004 * inner - 8 * ex * ex), 0.0045) * sm(0.032, 0.014, Math.abs(ex));   // the brow, raised inside: sorrow
    d -= 0.015 * ga(ex, 0.0118) * ga(Y - 0.0075, 0.0092);                                 // the socket
    d += 0.0112 * ga(ex, 0.0094) * ga(Y - 0.0035, 0.0056);                               // the closed lid
    d -= 0.0021 * ga(Y - (0.0116 - 3 * ex * ex), 0.001) * ga(ex, 0.0098);              // the crease above it
    d -= 0.0028 * ga(Y - (-0.0014 + 9 * ex * ex), 0.0009) * ga(ex, 0.0088);            // the lashes, closed
    d += 0.003 * ga(ex, 0.012) * ga(Y + 0.0135, 0.005);                                  // under the eye
    d += 0.0042 * ga(X - s * 0.046, 0.012) * ga(Y + 0.014, 0.009);                       // the cheekbone
    d -= 0.0028 * ga(X - s * 0.047, 0.011) * ga(Y + 0.048, 0.012);                       // the hollow of the cheek
    d += 0.005 * ga(X - s * 0.0108, 0.0043) * ga(Y + 0.0355, 0.0038);                    // the nostril wings
    d -= 0.0015 * ga(X - s * 0.021, 0.0042) * ga(Y + 0.047 - 0.25 * Math.abs(X - s * 0.02), 0.0075);  // the fold by the mouth
    d += 0.001 * ga(X - s * 0.0042, 0.0016) * ga(Y + 0.046, 0.0035);                     // the philtrum
  }
  d -= 0.002 * ga(X, 0.006) * ga(Y - 0.016, 0.006);                                       // between the brows
  const nt = sm(0.02, -0.032, Y);
  d += (0.003 + 0.019 * nt * nt) * ga(X, 0.0046 + 0.004 * nt) * sm(-0.042, -0.033, Y) * sm(0.034, 0.014, Y);
  d += 0.0035 * ga(X, 0.0066) * ga(Y + 0.032, 0.005) * sm(-0.042, -0.035, Y);           // the tip
  d += 0.0052 * ga(X, 0.0112) * ga(Y + 0.0532 + 12 * X * X - 0.0012 * ga(X, 0.004), 0.0035);
  d -= 0.004 * ga(X, 0.015) * ga(Y + 0.0588 + 24 * X * X, 0.0017);                      // the mouth, its corners down
  d += 0.0058 * ga(X, 0.0102) * ga(Y + 0.065, 0.004);
  d -= 0.0022 * ga(X, 0.014) * ga(Y + 0.0745, 0.0032);
  d += 0.0035 * ga(X, 0.0135) * ga(Y + 0.088, 0.0075);
  return d;
}
// the face as a relief: a profile down the middle, curving back to the sides
const MID = [[0.1, 0.04], [0.085, 0.066], [0.068, 0.08], [0.045, 0.087], [0.028, 0.089], [0.013, 0.085], [-0.01, 0.087], [-0.035, 0.09],
  [-0.05, 0.092], [-0.065, 0.09], [-0.08, 0.085], [-0.093, 0.087], [-0.104, 0.077], [-0.114, 0.045]];
function mid(y) {
  if (y >= MID[0][0]) return MID[0][1];
  for (let i = 0; i < MID.length - 1; i++) {
    const a = MID[i], b = MID[i + 1];
    if (y <= a[0] && y >= b[0]) { const t = (a[0] - y) / (a[0] - b[0]); return a[1] + (b[1] - a[1]) * t * t * (3 - 2 * t); }
  }
  return MID[MID.length - 1][1];
}
function faceZ(x, y) {
  const c2 = 3.6 + 4.2 * sm(-0.015, -0.08, y) + 1.5 * sm(0.03, 0.07, y), c4 = 700 + 1000 * sm(-0.03, -0.09, y);
  return mid(y) - c2 * x * x - c4 * x * x * x * x;
}
function headGeometry() {
  const g = new THREE.SphereGeometry(1, 160, 170), p = g.attributes.position, ao = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const nx = p.getX(i), ny = p.getY(i), nz = p.getZ(i);
    let x = nx * 0.065, y = ny * 0.106, z = nz * 0.09;
    const low = sm(0.1, -0.92, ny);
    x *= 1 - 0.36 * low;
    if (nz < 0) z *= 1.1;
    let d = 0;
    if (nz > 0) {
      const w = sm(0.07, 0.036, Math.abs(x)) * sm(-0.122, -0.098, y) * sm(0.08, 0.05, y) * sm(0.05, 0.45, nz);
      z += (faceZ(x, y) - z) * w;
      d = faceD(x, y) * w;
      z += d;
    }
    p.setXYZ(i, x, y, z);
    ao[i] = 0.97 + clamp(d * 4, -0.08, 0.03) - clamp(-d, 0, 0.014) * 5;
  }
  g.computeVertexNormals();
  return paint(g, function (x, y, z, i) { return ao[i]; });
}
function hairCapGeometry() {
  const g = new THREE.SphereGeometry(1, 96, 64), p = g.attributes.position;
  const ao = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const nx = p.getX(i), ny = p.getY(i), nz = p.getZ(i), a = Math.atan2(nx, nz);
    // the face stays bare: the hair parts at the middle and falls back past the temples
    const face = sm(0.1, 0.42, nz) * sm(0.6, 0.38, ny + Math.abs(nx) * 0.2);
    const groove = Math.sin(a * 30 + ny * 4 + Math.sin(a * 3) * 2) * 0.5 + 0.5;
    const k = (1 + 0.03 * groove - 0.035 * ga(a, 0.05) * sm(0.3, 0.8, ny)) * (1 - 0.24 * face);
    p.setXYZ(i, nx * 0.0715 * k, ny * 0.113 * k + 0.007, nz * 0.099 * k - 0.009);
    ao[i] = 0.74 + 0.24 * groove;
  }
  g.computeVertexNormals();
  return paint(g, function (x, y, z, i) { return ao[i]; });
}

/* ---------- feathers ---------- */
let barbTex = null;
function barbTexture() {
  if (barbTex) return barbTex;
  const w = 32, h = 128, c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), R = rng(23);
  x.fillStyle = '#f4f6f8'; x.fillRect(0, 0, w, h);
  for (let y = -40; y < h + 40; y += 3) {
    x.strokeStyle = 'rgba(120,132,150,' + (0.14 + R() * 0.12) + ')'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(w / 2, y); x.lineTo(0, y - 12); x.moveTo(w / 2, y); x.lineTo(w, y - 12); x.stroke();
  }
  x.fillStyle = 'rgba(110,120,138,0.55)'; x.fillRect(w / 2 - 1, 0, 2, h);
  // a few splits in the vanes
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) {
    const y = 20 + R() * 100, side = R() < 0.5 ? 0 : 1;
    x.beginPath(); x.moveTo(side ? w : 0, y); x.lineTo(side ? w - 8 - R() * 6 : 8 + R() * 6, y - 5); x.lineTo(side ? w : 0, y - 2.5); x.fill();
  }
  barbTex = new THREE.CanvasTexture(c);
  barbTex.colorSpace = THREE.SRGBColorSpace;
  return barbTex;
}
// one feather, its base at the origin, its tip at y = 1, one unit wide, curled a little
function featherGeometry() {
  const NL = 14, NW = 4, pos = [], col = [], uv = [], idx = [];
  for (let i = 0; i <= NL; i++) {
    const l = i / NL;
    const hw = l < 0.55 ? 0.05 + 0.45 * sm(0.0, 0.48, l) : 0.5 * Math.sqrt(Math.max(0, 1 - Math.pow((l - 0.55) / 0.45, 2)));
    for (let j = 0; j <= NW; j++) {
      const s = j / NW * 2 - 1, x = s * hw * (s < 0 ? 0.7 : 1);
      const z = 0.05 * (1 - Math.abs(s)) - 0.05 * s * s - 0.35 * l * l;
      pos.push(x, l, z);
      const ao = (0.8 + 0.2 * sm(0, 0.35, l)) * (1 - 0.06 * Math.abs(s));
      col.push(ao, ao, ao * 1.01);
      uv.push(j / NW, l);
    }
  }
  grid(idx, NL, NW);
  return geo(pos, col, idx, uv);
}

// the wing in its own plane: x out from the shoulder, y up, the back of the wing towards -z
const EDGE = [V(0, 0, 0), V(0.21, 0.19, 0), V(0.41, 0.63, 0), V(0.5, 0.9, 0)];
function cup(p) { p.z -= 0.16 * p.x * p.x + 0.03 * Math.max(0, p.y); return p; }
function edgeAt(g) {  // g in [0, 3]: shoulder to elbow, elbow to wrist, wrist to tip
  const k = Math.min(2, Math.floor(g)), u = g - k;
  return { p: new THREE.Vector3().lerpVectors(EDGE[k], EDGE[k + 1], u), k: k, u: u };
}
function flight(k, u) {  // angle out from straight down, and where the tip ends
  if (k === 0) return { ang: -0.14 + 0.06 * u, tip: -0.32 - 0.2 * u };
  if (k === 1) return { ang: -0.06 + 0.1 * u, tip: -0.55 - 0.45 * u };
  return { ang: 0.05 + 0.3 * u, tip: -1.02 - 0.22 * u };
}
function wingMatrices(R) {
  const list = [], m = new THREE.Matrix4(), bx = new THREE.Vector3(), by = new THREE.Vector3(), bz = new THREE.Vector3();
  function put(p, ang, len, wid, z, shade, tilt) {
    by.set(Math.sin(ang), -Math.cos(ang), tilt).normalize();
    bz.set(0, 0, 1); bx.crossVectors(by, bz).normalize(); bz.crossVectors(bx, by).normalize();
    m.makeBasis(bx.multiplyScalar(wid), by.multiplyScalar(len), bz.multiplyScalar(wid * (z < 0 ? -1 : 1)));
    const q = cup(p.clone()); q.z += z;
    m.setPosition(q);
    list.push({ m: m.clone(), c: shade });
  }
  // the long feathers, from the body out to the tip
  [[0, 6, 0.11, 0.9], [1, 14, 0.1, 0.88], [2, 11, 0.085, 0.86]].forEach(function (row) {
    for (let i = 0; i < row[1]; i++) {
      const u = (i + 0.5) / row[1], e = edgeAt(row[0] + u), f = flight(row[0], u);
      const ang = f.ang + (R() - 0.5) * 0.03, len = (e.p.y - f.tip) / Math.cos(ang) * (0.97 + R() * 0.06);
      put(e.p, ang, len, row[2] * (0.92 + R() * 0.16), 0, row[3], 0.02);
    }
  });
  // the coverts, in rows over the bases of the long ones, like scales
  const COV = [[30, 0.42, 0.09, 0.012, 0.93, 0.03], [32, 0.27, 0.08, 0.02, 0.96, 0.05], [34, 0.15, 0.07, 0.027, 0.98, 0.065], [38, 0.08, 0.06, 0.033, 1, 0.075]];
  COV.forEach(function (row) {
    for (let i = 0; i < row[0]; i++) {
      const g = 3 * (i + 0.3 + R() * 0.4) / row[0], e = edgeAt(Math.min(2.999, g)), f = flight(e.k, e.u);
      const p = e.p.clone(); p.y -= row[5] * 0.3; p.x -= Math.sin(f.ang) * row[5] * 0.3;
      const len = row[1] * (e.k === 2 ? 1.25 : 1) * (0.9 + R() * 0.2);
      put(p, f.ang + (R() - 0.5) * 0.08, len, row[2] * (0.9 + R() * 0.2), -row[3], row[4], 0.12);
    }
  });
  return list;
}

/* ---------- everything shared ---------- */
function mergeAll(list) {
  let n = 0, m = 0;
  list.forEach(function (g) { n += g.attributes.position.count; m += g.index.count; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), idx = new Uint32Array(m);
  let o = 0, oi = 0;
  list.forEach(function (g) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3);
    const ix = g.index.array; for (let i = 0; i < ix.length; i++) idx[oi + i] = ix[i] + o;
    o += g.attributes.position.count; oi += ix.length;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}
let SHARED = null;
function shared() {
  if (SHARED) return SHARED;
  const stone = new THREE.MeshStandardMaterial({ color: 0xf2f4f7, vertexColors: true, roughness: 0.56, metalness: 0 });
  const cloth = stone.clone(); cloth.side = THREE.DoubleSide;
  const plume = new THREE.MeshStandardMaterial({ map: barbTexture(), color: 0xf6f8fa, vertexColors: true, roughness: 0.66, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.5 });
  const S = { stone: stone, cloth: cloth, plume: plume };

  S.robe = robeGeometry();
  S.mantle = mantleGeometry();
  S.neck = paint(new THREE.CylinderGeometry(0.034, 0.042, 0.15, 24, 1, true), function () { return 0.9; });
  S.head = headGeometry();
  S.cap = hairCapGeometry();
  S.feather = featherGeometry();

  // the head bows to the left and down; the hair is laid out from where it will be
  S.headPivot = new THREE.Object3D();
  S.headPivot.position.set(0.004, 1.738, 0.012);
  S.headPivot.rotation.set(0.42, 0.1, 0.12);
  S.headPivot.updateMatrixWorld(true);
  S.headOffset = V(0, 0.088, 0.014);
  const hm = new THREE.Matrix4().makeTranslation(S.headOffset.x, S.headOffset.y, S.headOffset.z).premultiply(S.headPivot.matrixWorld);

  // long hair: locks from round the back of the head, falling over the shoulders and down the back
  const R = rng(5), locks = [];
  function lock(a, yy, endY, front) {
    const start = V(Math.sin(a) * 0.078, yy, Math.cos(a) * 0.096 - 0.009).applyMatrix4(hm);
    const side = Math.sign(Math.sin(a)) || 1, ph = R() * TAU, pts = [start];
    const n = 9;
    for (let i = 1; i <= n; i++) {
      const k = i / n, y = start.y + (endY - start.y) * k;
      let x = start.x * (1 + 0.9 * sm(0, 0.45, k)) + side * 0.02 * sm(0, 0.5, k);
      x += 0.012 * Math.sin(k * 7 + ph);
      const th = Math.atan2(front ? 1 : -1, x / 0.12);
      const b = bodyR(th, clamp(y, 0.05, 1.64));
      let z = front ? b.r * Math.sin(th) + b.cz + 0.015 : -(b.r * 0.95) + 0.002;
      if (y > 1.6) z = start.z + (z - start.z) * sm(0, 0.5, k);
      if (!front) z -= 0.004 + R() * 0.01;
      pts.push(V(x + sway(y), y, z));
    }
    const c = new THREE.CatmullRomCurve3(pts), r0 = (front ? 0.0075 : 0.0105) + R() * 0.004;
    locks.push(paint(tube(c, 36, 6, function (t, dir, a) { return r0 * (1 - 0.8 * t) * (1 + 0.15 * Math.sin(a * 2)); }), function (x, y) { return 0.86 + 0.1 * R(); }));
  }
  for (let i = 0; i < 46; i++) {
    const a = Math.PI * (0.4 + 1.2 * (i + R() * 0.7) / 46);
    lock(a, -0.015 + R() * 0.055, 1.22 + R() * 0.16, false);
  }
  for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 5; i++) lock(s * (0.98 + i * 0.09), -0.03 + i * 0.01, 1.4 + R() * 0.08, true);
  S.hair = mergeAll(locks);

  // sleeves falling open from the elbow, hands joined at the breast
  const arms = [];
  for (let s = -1; s <= 1; s += 2) {
    const c = new THREE.CatmullRomCurve3([V(s * 0.164, 1.578, -0.014), V(s * 0.19, 1.45, -0.012), V(s * 0.186, 1.3, 0.025), V(s * 0.12, 1.17, 0.11), V(s * 0.05, 1.11, 0.158)]);
    arms.push(paint(tube(c, 44, 16, function (t, dir, a) {
      const r = 0.034 + 0.004 * sm(0, 0.5, t) + 0.016 * sm(0.6, 1, t);
      return (r + 0.03 * sm(0.55, 1, t) * Math.max(0, -dir.y)) * (1 + 0.08 * Math.sin(a * 6 + t * 7));
    }), function (x, y, z) { return 0.84 + 0.12 * sm(1.1, 1.5, y); }));
    const hand = new THREE.SphereGeometry(1, 16, 12);
    hand.scale(0.022, 0.05, 0.016); hand.rotateZ(s * 1.15); hand.rotateX(0.25); hand.translate(s * 0.022, 1.085, 0.178);
    arms.push(paint(hand, function () { return 0.95; }));
  }
  S.arms = mergeAll(arms);

  SHARED = S;
  return S;
}

/* ---------- one angel ---------- */
export function makeAngel(opts) {
  opts = opts || {};
  const S = shared(), g = new THREE.Group(), R = rng(opts.seed || 3);
  g.add(new THREE.Mesh(S.robe, S.stone));
  g.add(new THREE.Mesh(S.mantle, S.cloth));
  g.add(new THREE.Mesh(S.arms, S.cloth));
  g.add(new THREE.Mesh(S.hair, S.stone));
  const neck = new THREE.Mesh(S.neck, S.stone); neck.position.set(0.002, 1.69, 0.008); neck.rotation.x = 0.16; g.add(neck);

  const pivot = new THREE.Group();
  pivot.position.copy(S.headPivot.position); pivot.rotation.copy(S.headPivot.rotation);
  const head = new THREE.Group(); head.position.copy(S.headOffset); pivot.add(head);
  head.add(new THREE.Mesh(S.head, S.stone));
  head.add(new THREE.Mesh(S.cap, S.stone));
  g.add(pivot);

  // wings
  const list = wingMatrices(R), wings = [];
  [1, -1].forEach(function (side) {
    const im = new THREE.InstancedMesh(S.feather, S.plume, list.length), c = new THREE.Color(), mir = new THREE.Matrix4().makeScale(side, 1, 1);
    list.forEach(function (f, i) { im.setMatrixAt(i, f.m.clone().premultiply(mir)); im.setColorAt(i, c.setScalar(f.c)); });
    im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
    // the bone along the front edge, so the wing has a rounded edge
    const pts = []; for (let i = 0; i <= 12; i++) { const e = edgeAt(i / 12 * 2.999); pts.push(cup(e.p.clone()).multiply(V(side, 1, 1))); }
    const bone = new THREE.Mesh(paint(tube(new THREE.CatmullRomCurve3(pts), 30, 8, function (t) { return 0.028 * (1 - 0.55 * t); }), function () { return 0.93; }), S.stone);
    const w = new THREE.Group(); w.add(im, bone);
    w.position.set(side * 0.07, 1.47, -0.085);
    w.userData.side = side;
    g.add(w); wings.push(w);
  });
  function spread(k) {  // 0: folded back, 1: open
    wings.forEach(function (w) {
      const s = w.userData.side;
      w.rotation.set(-0.05 - 0.1 * k, s * (1.0 - 0.78 * k), s * (-0.06 - 0.12 * k));
    });
  }
  spread(0);

  const out = { group: g, wings: wings, spread: spread, head: head, pivot: pivot };
  return out;
}

// a drifting feather, flat, for the air
let featherTex = null;
export function featherTexture() {
  if (featherTex) return featherTex;
  const w = 16, h = 64, c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), d = x.createImageData(w, h), rnd = rng(7);
  for (let py = 0; py < h; py++) {
    const t = 1 - (py + 0.5) / h;
    const hw = 6.8 * Math.pow(Math.sin(Math.PI * Math.min(0.97, 0.06 + t * 0.9)), 0.55) * Math.min(1, t / 0.1);
    for (let px = 0; px < w; px++) {
      const dx = px + 0.5 - 8, edge = hw * (dx < 0 ? 0.78 : 1) - rnd() * 0.9, o = (py * w + px) * 4;
      if (Math.abs(dx) > edge || t < 0.02) { d.data[o + 3] = 0; continue; }
      let v = 0.88 + 0.1 * (1 - Math.abs(dx) / (hw + 0.01)) + 0.04 * Math.sin(py * 1.7 + Math.abs(dx) * 2.4);
      if (Math.abs(dx) < 0.7) v = 0.8;
      d.data[o] = Math.min(255, 236 * v + 10); d.data[o + 1] = Math.min(255, 240 * v + 10); d.data[o + 2] = Math.min(255, 248 * v + 7); d.data[o + 3] = 255;
    }
  }
  x.putImageData(d, 0, 0);
  featherTex = pixelTexture(c);
  return featherTex;
}

/* angel.js - a kneeling marble angel with her face in her hands and her wings let down,
 * built from a lathe, a few capsules and some hundred feather planes; and the quiet room
 * where she can be seen from the front. Everywhere else in limbo she faces away. */
import * as THREE from '../vendor/three.module.min.js';

const TAU = Math.PI * 2;
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

// one feather: base at the bottom of the image, tip at the top, a darker shaft down the middle
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

function limb(a, b, r, mat) {
  const v = new THREE.Vector3().subVectors(b, a), len = v.length();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len), 4, 10), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
  return m;
}
const V = function (x, y, z) { return new THREE.Vector3(x, y, z); };

export function makeAngel(stone, feather, seed) {
  const R = rng(seed || 3), g = new THREE.Group();
  const lean = function (y) { return Math.max(0, y - 0.55) * 0.3; };

  // the robe: kneeling, spread on the floor, folds running down, bowed forward
  const prof = [[0, 0], [0.6, 0], [0.66, 0.05], [0.6, 0.13], [0.5, 0.3], [0.38, 0.55], [0.3, 0.72], [0.27, 0.86], [0.3, 1.0], [0.33, 1.1], [0.3, 1.18], [0.15, 1.25], [0.08, 1.29], [0, 1.3]];
  const robe = new THREE.LatheGeometry(prof.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 32);
  const pos = robe.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), z = pos.getZ(i);
    const y = pos.getY(i), th = Math.atan2(z, x);
    const k = 1 + 0.08 * Math.sin(th * 9 + y * 3) * Math.pow(Math.max(0, 1 - y / 1.25), 1.2);
    x *= k; z *= k;
    pos.setXYZ(i, x, y, z + lean(y));
  }
  robe.computeVertexNormals();
  g.add(new THREE.Mesh(robe, stone));

  // the head, under a fall of hair, bowed into the hands
  const hair = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), stone);
  hair.scale.set(0.135, 0.15, 0.14); hair.position.set(0, 1.4, lean(1.4) + 0.06);
  g.add(hair);
  [-1, 1].forEach(function (s) {
    g.add(limb(V(s * 0.1, 1.46, 0.3), V(s * 0.12, 1.16, 0.41), 0.045, stone));
    const S = V(s * 0.27, 1.13, lean(1.13)), E = V(s * 0.23, 0.92, 0.48), H = V(s * 0.07, 1.34, 0.49);
    g.add(limb(S, E, 0.072, stone));
    g.add(limb(E, H, 0.058, stone));
    const hand = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), stone);
    hand.scale.set(0.062, 0.085, 0.045); hand.position.set(s * 0.06, 1.37, 0.5);
    g.add(hand);
  });

  // the wings: a bone curving up and out, then letting go; three rows of feathers hanging from it
  const bone = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0.3, 0.4, -0.14), V(0.72, 0.32, -0.32), V(1.0, -0.12, -0.4), V(1.06, -0.62, -0.34)]);
  const ROWS = [[26, 0.4, 0.72, 0.13, 0], [18, 0.26, 0.46, 0.12, 0.014], [14, 0.13, 0.24, 0.11, 0.028]];
  const plane = new THREE.PlaneGeometry(1, 1); plane.translate(0, 0.5, 0);
  const count = ROWS.reduce(function (a, r) { return a + r[0]; }, 0);
  function wing(side) {
    const im = new THREE.InstancedMesh(plane, feather, count);
    const m = new THREE.Matrix4(), sc = new THREE.Matrix4(), mir = new THREE.Matrix4().makeScale(-1, 1, 1);
    const bx = new THREE.Vector3(), by = new THREE.Vector3(), bz = new THREE.Vector3(), down = new THREE.Vector3();
    let k = 0;
    ROWS.forEach(function (row) {
      for (let i = 0; i < row[0]; i++) {
        const s = 0.04 + 0.96 * (i + 0.5) / row[0];
        const p = bone.getPointAt(s), tan = bone.getTangentAt(s);
        by.copy(down.set(0.12, -1, 0.2).normalize()).lerp(tan, Math.pow(s, 2.2) * 0.75).normalize();
        bz.crossVectors(tan, by).normalize(); if (bz.z < 0) bz.negate();
        bx.crossVectors(by, bz).normalize();
        const len = (row[1] + (row[2] - row[1]) * Math.pow(s, 1.3)) * (0.9 + R() * 0.2);
        m.makeBasis(bx, by, bz);
        m.multiply(sc.makeScale(row[3] * (0.85 + R() * 0.3), len, 1));
        m.setPosition(p.x + bz.x * row[4], p.y + bz.y * row[4], p.z + bz.z * row[4]);
        if (side < 0) m.premultiply(mir);
        im.setMatrixAt(k++, m);
      }
    });
    im.instanceMatrix.needsUpdate = true;
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.1, 1.12, lean(1.12) - 0.24);
    pivot.rotation.y = side * -0.25;
    pivot.add(im);
    g.add(pivot);
    return pivot;
  }
  const wings = [wing(1), wing(-1)];
  return { group: g, wings: wings, tears: [V(0.065, 1.27, 0.5), V(-0.065, 1.27, 0.5)] };
}

/* ---------- the room where she can be seen ---------- */
export function makeShrine(M, shaftTex) {
  const g = new THREE.Group(), R = rng(11);
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d');
  x.fillStyle = '#f2f5f8'; x.fillRect(0, 0, 32, 32);
  for (let i = 0; i < 160; i++) { x.fillStyle = 'rgba(160,175,195,' + (0.05 + R() * 0.1) + ')'; x.fillRect((R() * 32) | 0, (R() * 32) | 0, 1, 1); }
  x.fillStyle = 'rgba(160,175,195,0.75)';
  x.fillRect(0, 15, 32, 1); x.fillRect(15, 0, 1, 32); x.fillRect(0, 31, 32, 1); x.fillRect(31, 0, 1, 32);
  const tile = pixelTexture(c); tile.wrapS = tile.wrapT = THREE.RepeatWrapping;
  const fg = new THREE.CircleGeometry(40, 48); fg.rotateX(-Math.PI / 2);
  const uv = fg.attributes.uv, fp = fg.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, fp.getX(i) * 0.5, fp.getZ(i) * 0.5);
  g.add(new THREE.Mesh(fg, new THREE.MeshLambertMaterial({ map: tile, color: 0x8fa2bd })));
  // a ring of columns fading into the mist
  const colGeo = new THREE.CylinderGeometry(0.45, 0.5, 9, 14, 1, true);
  for (let k = 0; k < 10; k++) {
    const a = k / 10 * TAU + 0.3, col = new THREE.Mesh(colGeo, M.flute);
    col.position.set(Math.cos(a) * 10, 4.5, Math.sin(a) * 10 - 2);
    g.add(col);
  }
  const angel = makeAngel(M.marble, M.feather, 11), S = 1.35;
  angel.group.scale.setScalar(S);
  g.add(angel.group);
  // light coming down on her
  const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTex, color: 0xe8f2ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
  [0, Math.PI / 2].forEach(function (a) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 16).translate(0, 8, 0), shaftMat);
    s.rotation.y = a; g.add(s);
  });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x9cc4f0, transparent: true, opacity: 0.12, depthWrite: false }));
  pool.position.set(0, 0.012, 0.45); g.add(pool);

  // tears
  const N = 48, tp = new Float32Array(N * 3), tv = new Float32Array(N), alive = new Uint8Array(N);
  for (let i = 0; i < N; i++) tp[i * 3 + 1] = -10;
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(tp, 3));
  const tears = new THREE.Points(tg, new THREE.PointsMaterial({ color: 0x6fa6e6, size: 3, sizeAttenuation: false, transparent: true, opacity: 0.95, depthWrite: false, fog: false }));
  tears.frustumCulled = false; g.add(tears);
  const spots = angel.tears.map(function (v) { return v.clone().multiplyScalar(S); });

  // feathers coming down
  const fl = [], fgeo = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < 22; i++) {
    const f = new THREE.Mesh(fgeo, M.feather), a = R() * TAU, r = 1 + R() * 6;
    f.scale.set(0.1, 0.32, 1); f.position.set(Math.cos(a) * r, R() * 9, Math.sin(a) * r);
    f.userData.v = 0.2 + R() * 0.3; f.userData.p = R() * TAU;
    g.add(f); fl.push(f);
  }

  let next = 0, landedTotal = 0;
  function update(t, dt) {
    let landed = 0;
    if (t > next) {
      for (let i = 0; i < N; i++) {
        if (alive[i]) continue;
        const s = spots[(R() * 2) | 0];
        tp[i * 3] = s.x + (R() - 0.5) * 0.04; tp[i * 3 + 1] = s.y; tp[i * 3 + 2] = s.z + R() * 0.02;
        tv[i] = -0.05; alive[i] = 1;
        break;
      }
      next = t + 0.12 + R() * 0.35;
    }
    for (let i = 0; i < N; i++) {
      if (!alive[i]) continue;
      tv[i] -= 3.5 * dt;
      tp[i * 3 + 1] += tv[i] * dt; tp[i * 3 + 2] += 0.02 * dt;
      if (tp[i * 3 + 1] < 0.03) { alive[i] = 0; tp[i * 3 + 1] = -10; landed++; }
    }
    tg.attributes.position.needsUpdate = true;
    landedTotal += landed;
    pool.material.opacity = Math.min(0.4, 0.12 + landedTotal * 0.004);
    fl.forEach(function (f) {
      f.position.y -= f.userData.v * dt;
      f.position.x += Math.sin(t * 0.9 + f.userData.p) * dt * 0.25;
      if (f.position.y < 0.05) f.position.y = 9 + R() * 2;
      f.rotation.set(Math.sin(t + f.userData.p) * 0.6, t * 0.4 + f.userData.p, Math.cos(t * 0.7 + f.userData.p) * 0.8);
    });
    angel.wings[0].rotation.z = Math.sin(t * 0.5) * 0.035;
    angel.wings[1].rotation.z = -Math.sin(t * 0.5) * 0.035;
    angel.group.position.y = Math.pow(Math.max(0, Math.sin(t * 2.1)), 10) * 0.012; // a sob, now and then
    return landed;
  }
  return { group: g, update: update, reset: function () { landedTotal = 0; } };
}

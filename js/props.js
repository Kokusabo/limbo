/* props.js - what fills the place: grass with patches, tufts and white flowers, trees and
 * hedges, a ruined wall with tall windows, a broken arcade, stairs that go nowhere, cubes
 * that float, columns too big to belong here, an old television, pews, and the angels. */
import * as THREE from '../vendor/three.module.min.js';
import { makeAngel } from './angel.js?v=4';

const TAU = Math.PI * 2;

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function hash2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// how pale the grass is at a point: patches of lush green and patches of pale, dry grass
function paleness(x, z) { const n = vnoise(x * 0.035, z * 0.035) * 0.65 + vnoise(x * 0.11, z * 0.11) * 0.35; return Math.min(1, Math.max(0, (n - 0.3) / 0.45)); }
const LUSH = new THREE.Color(0.78, 0.9, 0.76), PALE = new THREE.Color(1.0, 0.98, 0.86);

// the ground: [x0, x1, z0, z1] rectangles, subdivided so every vertex can take its own tint
export function grassField(rects, mat) {
  const group = new THREE.Group(), c = new THREE.Color();
  rects.forEach(function (r) {
    const w = r[1] - r[0], d = Math.abs(r[3] - r[2]);
    const g = new THREE.PlaneGeometry(w, d, Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(d / 6)));
    g.rotateX(-Math.PI / 2); g.translate((r[0] + r[1]) / 2, -0.02, (r[2] + r[3]) / 2);
    const pos = g.attributes.position, uv = g.attributes.uv, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      uv.setXY(i, x * 0.5, -z * 0.5);
      c.copy(LUSH).lerp(PALE, paleness(x, z));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    group.add(new THREE.Mesh(g, mat));
  });
  return group;
}

// two crossed quads, wound both ways, all normals pointing up so they light like the ground
function crossQuads(w, h) {
  const P = [], U = [], N = [], I = [];
  [[1, 0], [0, 1]].forEach(function (a) {
    const b = P.length / 3, hx = a[0] * w / 2, hz = a[1] * w / 2;
    P.push(-hx, 0, -hz, hx, 0, hz, hx, h, hz, -hx, h, -hz);
    U.push(0, 0, 1, 0, 1, 1, 0, 1);
    N.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    I.push(b, b + 1, b + 2, b, b + 2, b + 3, b, b + 2, b + 1, b, b + 3, b + 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setIndex(I);
  return g;
}
// grass and flowers lean a little in a wind that never stops
function swayMat(map, timeU, amp) {
  const m = new THREE.MeshLambertMaterial({ map: map, alphaTest: 0.5 });
  m.onBeforeCompile = function (sh) {
    sh.uniforms.uTime = timeU;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n#ifdef USE_INSTANCING\n vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);\n#else\n vec4 ip = vec4(0.0);\n#endif\n' +
      ' float hh = max(position.y, 0.0);\n' +
      ' transformed.x += sin(uTime * 1.3 + ip.x * 0.37 + ip.z * 0.21) * hh * ' + amp.toFixed(3) + ';\n' +
      ' transformed.z += cos(uTime * 1.1 + ip.z * 0.33) * hh * ' + (amp * 0.6).toFixed(3) + ';');
  };
  return m;
}
function scatter(geo, mat, places) {
  const im = new THREE.InstancedMesh(geo, mat, places.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const p = new THREE.Vector3(), s = new THREE.Vector3();
  places.forEach(function (a, i) {
    q.setFromEuler(e.set(0, a[2], 0));
    m.compose(p.set(a[0], a[5] || 0, a[1]), q, s.set(a[3], a[3], a[3]));
    im.setMatrixAt(i, m);
    if (a[4]) im.setColorAt(i, a[4]);
  });
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.frustumCulled = false;
  return im;
}
// rectangles to keep clear: [x0, x1, zMax, zMin]
const KEEP_CLEAR = [
  [-26.5, 26.5, 12.5, -66.5],   // the bath hall
  [-12.6, 12.6, -87.6, -112.4], // the stone square
  [-11.8, 11.8, -149.5, -216.5],// the chapel
  [-33.5, -30, -88, -120],      // the ruined wall
  [25.5, 29.5, -85, -114],      // the arcade
  [17.5, 26.5, -126, -130.5],   // the stairs
  [-11, -7, -130, -134]         // the angel in the grass
];
function clear(x, z) {
  for (let i = 0; i < KEEP_CLEAR.length; i++) { const r = KEEP_CLEAR[i]; if (x > r[0] && x < r[1] && z < r[2] && z > r[3]) return false; }
  return true;
}

export function buildProps(scene, M, T, R) {
  const timeU = { value: 0 }, targets = [], updaters = [];
  const c = new THREE.Color();

  /* ---- tufts of grass and white flowers ---- */
  const tuftTex = canvasTex(16, 16, function (x, w, h) {
    const P = ['#6f8f45', '#7fa24f', '#8db15b', '#9cbe68', '#a9c873'];
    for (let k = 0; k < 11; k++) {
      const bx = 1 + R() * 13, len = 6 + R() * 10, lean = (R() - 0.5) * 0.5;
      for (let j = 0; j < len; j++) { x.fillStyle = P[Math.min(P.length - 1, (j / len * P.length) | 0)]; x.fillRect(Math.round(bx + lean * j), h - 1 - j, 1, 1); }
    }
  });
  const flowerTex = canvasTex(16, 16, function (x, w, h) {
    for (let k = 0; k < 4; k++) {
      const fx = 2 + ((R() * 12) | 0), top = 3 + ((R() * 7) | 0);
      x.fillStyle = '#7a9a4e'; x.fillRect(fx, top + 1, 1, h - top - 1);
      x.fillStyle = R() < 0.3 ? '#dbe8f8' : '#f6f8fb';
      x.fillRect(fx - 1, top, 3, 1); x.fillRect(fx, top - 1, 1, 3);
      x.fillStyle = '#e9e3b6'; x.fillRect(fx, top, 1, 1);
    }
  });
  const tufts = [], flowers = [];
  function addTuft(x, z) {
    if (!clear(x, z)) return;
    const pl = paleness(x, z);
    tufts.push([x, z, R() * TAU, 0.7 + R() * 0.8, c.copy(LUSH).lerp(PALE, pl).multiplyScalar(0.92 + R() * 0.16).clone()]);
  }
  for (let i = 0; i < 2600; i++) addTuft(-75 + R() * 150, -60 - R() * 92);
  for (let i = 0; i < 900; i++) { const s = R() < 0.5 ? -1 : 1; addTuft(s * (27 + R() * 40), 14 - R() * 76); }
  for (let i = 0; i < 400; i++) addTuft(-60 + R() * 120, -150 - R() * 70);
  // flowers grow in patches
  for (let k = 0; k < 34; k++) {
    const cx = -62 + R() * 124, cz = -64 - R() * 86, rad = 1.5 + R() * 3;
    for (let i = 0; i < 22; i++) {
      const a = R() * TAU, r = Math.sqrt(R()) * rad, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (clear(x, z)) flowers.push([x, z, R() * TAU, 0.8 + R() * 0.5, null]);
    }
  }
  for (let i = 0; i < 40; i++) { const a = i / 40 * TAU, r = 2 + R() * 0.6; flowers.push([-9 + Math.cos(a) * r, -132 + Math.sin(a) * r, R() * TAU, 0.9 + R() * 0.3, null]); }
  scene.add(scatter(crossQuads(0.75, 0.6), swayMat(tuftTex, timeU, 0.18), tufts));
  scene.add(scatter(crossQuads(0.38, 0.42), swayMat(flowerTex, timeU, 0.12), flowers));

  /* ---- trees, chunky like an old game ---- */
  function tree(x, z, s) {
    const g = new THREE.Group();
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.26 * s, 0.42 * s, 4.2 * s, 7), M.bark); tr.position.y = 2.1 * s; g.add(tr);
    const n = 3 + ((R() * 2) | 0);
    for (let k = 0; k < n; k++) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), M.leaves), sz = (1.8 + R() * 1.4) * s;
      box.scale.setScalar(sz);
      box.position.set((R() - 0.5) * 1.6 * s, (4.4 + R() * 1.8) * s, (R() - 0.5) * 1.6 * s);
      box.rotation.set(R() * 0.8, R() * 3, R() * 0.8);
      g.add(box);
    }
    g.position.set(x, 0, z);
    scene.add(g);
  }
  [[-40, -80, 1.1], [35, -74, 1.0], [-55, -112, 1.3], [48, -106, 1.2], [-26, -140, 0.9], [40, -136, 1.1], [62, -90, 1.4], [-66, -96, 1.2],
   [-34, -22, 1.0], [36, -42, 1.1], [-45, -50, 1.2], [30, 2, 0.9]].forEach(function (p) { tree(p[0], p[1], p[2]); });

  /* ---- hedges round the stone square ---- */
  const hedgeTex = T.leaves.clone(); hedgeTex.repeat.set(5, 1); hedgeTex.needsUpdate = true;
  const hedgeMat = new THREE.MeshLambertMaterial({ map: hedgeTex });
  [[-14, -88.5, -95.5], [-14, -98, -104], [-14, -106.5, -111.5], [14, -88.5, -96], [14, -101, -111.5]].forEach(function (h) {
    const len = Math.abs(h[2] - h[1]), m = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.25, len), hedgeMat);
    m.position.set(h[0], 0.62, (h[1] + h[2]) / 2); scene.add(m);
  });

  /* ---- a ruined wall with tall windows, standing in the grass ---- */
  const ruinTex = T.wall.clone(); ruinTex.repeat.set(0.25, 0.25); ruinTex.needsUpdate = true;
  const ruinMat = new THREE.MeshLambertMaterial({ map: ruinTex });
  const wallShape = new THREE.Shape();
  wallShape.moveTo(-15, 0); wallShape.lineTo(15, 0);
  [[15, 7], [13.6, 9.2], [12, 12.5], [9, 11.8], [6, 13.4], [2, 12.2], [-1, 13], [-4, 11.5], [-8, 12.8], [-11, 10.4], [-13, 9], [-15, 7]].forEach(function (p) { wallShape.lineTo(p[0], p[1]); });
  wallShape.lineTo(-15, 0);
  [[-10, 2.4, 7.2], [-5, 2.4, 7.2], [0, 3.2, 8.6], [5, 2.4, 7.2], [10, 2.4, 6.4]].forEach(function (wnd) {
    const cx = wnd[0], w = wnd[1], top = wnd[2], hole = new THREE.Path();
    hole.moveTo(cx - w / 2, 2); hole.lineTo(cx + w / 2, 2); hole.lineTo(cx + w / 2, top);
    hole.quadraticCurveTo(cx + w / 2, top + w * 0.55, cx, top + w * 0.75);
    hole.quadraticCurveTo(cx - w / 2, top + w * 0.55, cx - w / 2, top); hole.lineTo(cx - w / 2, 2);
    wallShape.holes.push(hole);
  });
  const ruin = new THREE.Mesh(new THREE.ExtrudeGeometry(wallShape, { depth: 1.4, bevelEnabled: false, curveSegments: 10 }), ruinMat);
  ruin.rotation.y = Math.PI / 2; ruin.position.set(-31, 0, -104);
  scene.add(ruin);
  for (let i = 0; i < 9; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), M.marble), s = 0.5 + R() * 1.2;
    b.scale.set(s * (1 + R()), s, s); b.position.set(-27 - R() * 6, s / 2, -92 - R() * 26); b.rotation.set(R() * 0.3, R() * 3, R() * 0.3);
    scene.add(b);
  }

  /* ---- an arcade of pointed arches, one fallen ---- */
  function archShape(full) {
    const s = new THREE.Shape();
    s.moveTo(-2.2, 0); s.lineTo(-1.4, 0); s.lineTo(-1.4, 6);
    if (full) {
      s.quadraticCurveTo(-1.4, 7.6, 0, 8.4); s.quadraticCurveTo(1.4, 7.6, 1.4, 6);
    } else { s.lineTo(-1.4, 6.8); s.lineTo(-0.6, 7.3); s.lineTo(-0.4, 6.6); s.lineTo(1.4, 6.6); }
    s.lineTo(1.4, 0); s.lineTo(2.2, 0); s.lineTo(2.2, full ? 6 : 4.5);
    if (full) { s.quadraticCurveTo(2.2, 8.7, 0, 9.6); s.quadraticCurveTo(-2.2, 8.7, -2.2, 6); }
    else { s.lineTo(1.6, 5.2); s.lineTo(1.4, 6.6); s.lineTo(-0.4, 6.6); s.lineTo(-1.1, 8.2); s.lineTo(-2.2, 7.4); }
    s.lineTo(-2.2, 0);
    return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 10 });
  }
  const archFull = archShape(true), archBroken = archShape(false);
  [-88, -92.4, -96.8, -101.2, -105.6, -110].forEach(function (z, i) {
    const a = new THREE.Mesh(i === 4 ? archBroken : archFull, ruinMat);
    a.rotation.y = Math.PI / 2; a.position.set(27, 0, z); scene.add(a);
  });

  /* ---- stairs that go nowhere ---- */
  for (let i = 0; i < 10; i++) {
    const h = (i + 1) * 0.28, st = new THREE.Mesh(new THREE.BoxGeometry(0.6, h, 3), M.marble);
    st.position.set(18 + i * 0.6 + 0.3, h / 2, -128); scene.add(st);
  }

  /* ---- marble cubes that float above the field ---- */
  const cubes = [];
  [[-14, 9, -100, 1.6], [12, 13, -92, 2.2], [-4, 15, -118, 1.2], [22, 8, -122, 1.8], [-22, 12, -126, 2.6], [6, 10, -136, 1.0], [-30, 16, -84, 1.4]].forEach(function (p) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(p[3], p[3], p[3]), M.marble);
    m.position.set(p[0], p[1], p[2]); m.userData.y = p[1]; m.userData.p = R() * TAU;
    scene.add(m); cubes.push(m);
  });
  updaters.push(function (t) {
    cubes.forEach(function (m) {
      m.position.y = m.userData.y + Math.sin(t * 0.4 + m.userData.p) * 0.5;
      m.rotation.set(t * 0.05 + m.userData.p, t * 0.08, t * 0.03);
    });
  });

  /* ---- columns far too big for this place, standing in the mist ---- */
  [[-85, -40], [90, -70], [-95, -120], [80, -150], [-75, -175], [100, -110], [-110, -70]].forEach(function (p) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.3, 52, 16, 1, true), M.flute);
    col.position.set(p[0], 26, p[1]); scene.add(col);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(8, 1.6, 8), M.marble);
    cap.position.set(p[0], 52.8, p[1]); scene.add(cap);
  });

  /* ---- pews in the chapel ---- */
  for (let z = -160; z >= -196; z -= 5) {
    [-1, 1].forEach(function (s) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.45, 0.55), M.marble);
      seat.position.set(s * 4.1, 0.45, z); scene.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.95, 0.12), M.marble);
      back.position.set(s * 4.1, 0.9, z + 0.3); scene.add(back);
    });
  }
  const altar = new THREE.Mesh(new THREE.BoxGeometry(7, 0.4, 4), M.marble); altar.position.set(0, 0.2, -211); scene.add(altar);

  /* ---- the angels: they all face away from you ---- */
  // an invisible, larger box to catch taps, so small things far away are easy to touch
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  function proxy(w, h, d, y) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), proxyMat); m.position.y = y; m.visible = false; return m; }
  function statue(x, y, z, s, plinth) {
    if (plinth) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(1.15 * s, 1.25 * s, plinth, 18), M.marble);
      p.position.set(x, plinth / 2, z); scene.add(p);
    }
    const a = makeAngel(M.marble, M.feather, (x * 13 + z * 7) | 0);
    a.group.scale.setScalar(s); a.group.position.set(x, y, z); a.group.rotation.y = Math.PI;
    a.group.userData.pick = 'angel';
    a.group.add(proxy(2.8, 2.6, 2.8, 1.2));
    scene.add(a.group); targets.push(a.group);
  }
  [[-9, -53], [9, -53]].forEach(function (p) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), M.marble); b.position.set(p[0], 0.6, p[1]); scene.add(b);
    statue(p[0], 1.2, p[1], 0.72, 0);
  });
  statue(-9, 0.45, -132, 0.95, 0.45);
  statue(0, 0.4, -211, 1.15, 0);

  /* ---- an old television in the grass ---- */
  const tvc = document.createElement('canvas'); tvc.width = 40; tvc.height = 30;
  const tx = tvc.getContext('2d'), tvTex = new THREE.CanvasTexture(tvc);
  tvTex.magFilter = THREE.NearestFilter; tvTex.minFilter = THREE.NearestFilter; tvTex.generateMipmaps = false; tvTex.colorSpace = THREE.SRGBColorSpace;
  const tv = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.74, 0.72), new THREE.MeshLambertMaterial({ color: 0x41464e }));
  body.position.y = 0.37; tv.add(body);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.52), new THREE.MeshBasicMaterial({ map: tvTex }));
  screen.position.set(-0.07, 0.4, 0.361); tv.add(screen);
  [0.14, -0.02].forEach(function (y) { const k = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.04), new THREE.MeshLambertMaterial({ color: 0x9aa0a8 })); k.position.set(0.37, 0.4 + y, 0.37); tv.add(k); });
  [-0.5, 0.5].forEach(function (a) {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.7, 4), new THREE.MeshLambertMaterial({ color: 0x8c929a }));
    ant.position.set(Math.sin(a) * 0.3, 0.74 + Math.cos(a) * 0.3, 0); ant.rotation.z = -a; tv.add(ant);
  });
  tv.position.set(-15.5, 0, -117.5); tv.rotation.y = Math.PI / 2 - 0.35;
  tv.userData.pick = 'tv';
  tv.add(proxy(2.4, 2, 2.4, 0.6));
  scene.add(tv); targets.push(tv);
  let tvMode = 'static', tvUntil = 0, tvNextEye = 18 + R() * 12, tvLast = 0;
  const img = tx.createImageData(40, 30);
  function drawTV(t) {
    if (tvMode === 'static') {
      const bar = (t * 14) % 40;
      for (let i = 0; i < 1200; i++) {
        const y = (i / 40) | 0, v = Math.random() * 200 * (Math.abs(y - bar) < 3 ? 0.45 : 1);
        img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v + 12; img.data[i * 4 + 3] = 255;
      }
      tx.putImageData(img, 0, 0);
    } else if (tvMode === 'eye') {
      tx.fillStyle = '#0a0c10'; tx.fillRect(0, 0, 40, 30);
      tx.fillStyle = '#eef3f8'; tx.beginPath(); tx.ellipse(20, 15, 14, 6.5, 0, 0, TAU); tx.fill();
      const lx = 20 + Math.sin(t * 2) * 3;
      tx.fillStyle = '#5d8fc4'; tx.beginPath(); tx.arc(lx, 15, 5, 0, TAU); tx.fill();
      tx.fillStyle = '#0a0c10'; tx.beginPath(); tx.arc(lx, 15, 2.2, 0, TAU); tx.fill();
      tx.fillStyle = '#ffffff'; tx.fillRect(lx - 2, 12, 1, 1);
      tx.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = 0; y < 30; y += 2) tx.fillRect(0, y, 40, 1);
    } else {
      tx.fillStyle = '#0a0c10'; tx.fillRect(0, 0, 40, 30);
      tx.fillStyle = '#dfe8f4'; tx.font = '8px monospace'; tx.textAlign = 'center'; tx.textBaseline = 'middle';
      tx.fillText('ch.07', 20, 15);
    }
    tvTex.needsUpdate = true;
  }
  updaters.push(function (t) {
    if (t > tvUntil && tvMode !== 'static') {
      if (tvMode === 'eye' && tvUntil > 0 && t - tvUntil < 0.1) { tvMode = 'text'; tvUntil = t + 0.9; }
      else tvMode = 'static';
    }
    if (tvMode === 'static' && t > tvNextEye) { tvMode = 'eye'; tvUntil = t + 0.7; tvNextEye = t + 25 + R() * 20; }
    if (t - tvLast > 0.07) { tvLast = t; drawTV(t); }
  });

  return {
    proxy: proxy,
    timeU: timeU,
    targets: targets,
    tvClick: function (t) { tvMode = 'eye'; tvUntil = t + 1.3; },
    update: function (t, dt) { timeU.value = t; updaters.forEach(function (f) { f(t, dt); }); }
  };
}

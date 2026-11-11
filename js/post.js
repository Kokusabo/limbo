/* post.js - what the eye gets: the world is drawn small, then blown up here with
 * hard pixels, a little banding, a soft glow, white mist at the edges, the glitch,
 * and the ascii view where every cell of the screen becomes one character. */
import * as THREE from '../vendor/three.module.min.js';

const CANDIDATES = " .'`,:;-~=+*<>!ilcxvzoaunesOQ0#%&8@$MW";

// characters sorted by how much ink they put on screen in this font
function glyphAtlas() {
  const size = 40, font = '400 ' + size + 'px "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace';
  const m = document.createElement('canvas').getContext('2d');
  m.font = font;
  const cw = Math.ceil(m.measureText('M').width), ch = Math.ceil(size * 1.25);
  const probe = document.createElement('canvas'); probe.width = cw; probe.height = ch;
  const px = probe.getContext('2d', { willReadFrequently: true });
  const list = [];
  for (const c of CANDIDATES) {
    px.clearRect(0, 0, cw, ch); px.font = font; px.fillStyle = '#fff'; px.textBaseline = 'middle';
    px.fillText(c, 0, ch / 2);
    const d = px.getImageData(0, 0, cw, ch).data;
    let s = 0; for (let i = 3; i < d.length; i += 4) s += d[i];
    list.push([c, s]);
  }
  list.sort(function (a, b) { return a[1] - b[1]; });
  const max = list[list.length - 1][1] || 1, N = 18;
  let chars = ' ';
  for (let k = 1; k < N; k++) {
    const target = k / (N - 1) * max;
    let best = null, bd = 1e18;
    for (let i = 1; i < list.length; i++) {
      const d = Math.abs(list[i][1] - target);
      if (d < bd && chars.indexOf(list[i][0]) < 0) { bd = d; best = list[i][0]; }
    }
    if (best) chars += best;
  }
  const c = document.createElement('canvas'); c.width = cw * chars.length; c.height = ch;
  const x = c.getContext('2d'); x.font = font; x.fillStyle = '#fff'; x.textBaseline = 'middle';
  for (let i = 0; i < chars.length; i++) x.fillText(chars[i], i * cw, ch / 2);
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.NoColorSpace;
  return { tex: t, count: chars.length, aspect: cw / ch };
}

const VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = `
uniform sampler2D tScene, tGlyph;
uniform vec2 uRes, uSceneRes;
uniform float uTime, uGlitch, uAscii, uCell, uGlyphN, uGlyphAspect, uWhite, uDots, uDotPx, uEdge;
varying vec2 vUv;
float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 sceneAt(vec2 uv) { return linearToOutputTexel(texture2D(tScene, clamp(uv, 0.001, 0.999))).rgb; }
float bayer2(vec2 a) { a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
void main() {
  vec2 uv = vUv;
  float g = uGlitch, tick = floor(uTime * 18.0), band = 0.0;
  if (g > 0.001) {
    // rows torn sideways, and now and then a whole block of the picture lands somewhere else
    float rows = mix(8.0, 44.0, h1(vec2(tick, 1.0)));
    float row = floor(uv.y * rows);
    if (h1(vec2(row, tick)) < g * 0.45) {
      uv.x += (h1(vec2(row, tick + 7.0)) - 0.5) * 0.32 * g;
      band = step(0.55, h1(vec2(row, tick + 3.0)));
    }
    vec2 blk = floor(uv * vec2(5.0, 7.0));
    if (h1(blk + tick * 0.37) < g * 0.14) uv += (vec2(h1(blk + 1.0), h1(blk + 2.0)) - 0.5) * 0.25;
  }
  float split = g * 0.014 + 0.0008;
  vec3 col = vec3(sceneAt(uv + vec2(split, 0.0)).r, sceneAt(uv).g, sceneAt(uv - vec2(split, 0.0)).b);
  // a soft glow around everything bright
  vec2 gr = 2.5 / uSceneRes;
  vec3 glow = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    glow += max(sceneAt(uv + vec2(cos(a), sin(a)) * gr * (1.0 + mod(float(i), 2.0))) - 0.8, 0.0);
  }
  col += glow * 0.17;
  // old hardware: fewer shades, ordered dither in the small picture's own pixels
  col = floor(col * 30.0 + bayer4(floor(uv * uSceneRes))) / 30.0;
  // up in the sky the picture turns into a screen of little round lamps
  if (uDots > 0.001) {
    vec2 f = fract(gl_FragCoord.xy / uDotPx) - 0.5;
    float lamp = smoothstep(0.5, 0.2, length(f));
    col = mix(col, col * (0.6 + 0.48 * lamp), uDots);
  }
  // the ascii view: every cell of the screen becomes one character
  float showAscii = max(uAscii, band);
  if (showAscii > 0.001) {
    vec2 size = vec2(uCell * uGlyphAspect, uCell);
    vec2 cell = floor(gl_FragCoord.xy / size), local = fract(gl_FragCoord.xy / size);
    vec2 cuv = (cell + 0.5) * size / uRes + vec2(uv.x - vUv.x, 0.0);
    vec3 sc = sceneAt(cuv);
    float lum = dot(sc, vec3(0.299, 0.587, 0.114));
    float ink = clamp((1.0 - lum) * 1.5 - 0.04, 0.0, 1.0);
    float idx = floor(ink * (uGlyphN - 1.0) + 0.5);
    float a = texture2D(tGlyph, vec2((idx + local.x) / uGlyphN, local.y)).a;
    vec3 paper = mix(vec3(0.965, 0.976, 0.99), sc, 0.12);
    vec3 inkc = mix(vec3(0.14, 0.2, 0.29), sc * 0.55, 0.3);
    col = mix(col, mix(paper, inkc, a), step(h1(cell * 0.73 + 3.1), showAscii));
  }
  // white mist at the edges, a little grain, and the white of waking up
  vec2 q = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  col = mix(col, vec3(0.97, 0.982, 0.995), smoothstep(0.5, 1.15, length(q)) * uEdge);
  col += (h1(gl_FragCoord.xy + tick) - 0.5) * 0.016;
  col = mix(col, vec3(0.975, 0.985, 0.996), uWhite);
  gl_FragColor = vec4(col, 1.0);
}`;

export function createPost(sceneTexture) {
  const glyph = glyphAtlas();
  const uniforms = {
    tScene: { value: sceneTexture }, tGlyph: { value: glyph.tex },
    uRes: { value: new THREE.Vector2(1, 1) }, uSceneRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 }, uGlitch: { value: 0 }, uAscii: { value: 0 }, uWhite: { value: 1 },
    uCell: { value: 12 }, uGlyphN: { value: glyph.count }, uGlyphAspect: { value: glyph.aspect },
    uDots: { value: 0 }, uDotPx: { value: 6 }, uEdge: { value: 0.5 }
  };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ uniforms: uniforms, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false }));
  mesh.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(mesh);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    scene: scene, camera: camera, uniforms: uniforms,
    setSize: function (w, h, sw, sh, cell, dotPx) { uniforms.uRes.value.set(w, h); uniforms.uSceneRes.value.set(sw, sh); uniforms.uCell.value = cell; uniforms.uDotPx.value = dotPx; }
  };
}

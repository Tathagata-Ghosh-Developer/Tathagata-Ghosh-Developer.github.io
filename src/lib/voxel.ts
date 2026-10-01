// Voxels from layered ASCII maps. A layer is a list of rows (back to front); a row is a string of palette
// characters ('.' or ' ' = empty). A number repeats the previous layer that many more times. Symmetric
// buildings are written as their left half plus the centre column and mirrored with m().
// Used three ways: the 3D campuses (one InstancedMesh each), the 2D pixel-art sprite on the terminal when
// there is no WebGL, and the pixel timeline and India map that `ssh` draws.
import s from '../data/site.json';

export const PAL: Record<string, string> = {
  g: '#3d7a3a', p: '#b9ad94', s: '#d9c49b', S: '#b39a6c', a: '#4a3b2b', w: '#2c3a4c', r: '#7d5f4a',
  t: '#5b4030', T: '#2f6b34', L: '#4c9a47', c: '#f1ead2', b: '#a8442e', k: '#ece4cf', B: '#6e2a1f',
  h: '#2f6db0', H: '#5b95d6',
};
export type Vox = { x: number; y: number; z: number; c: string };

const m = (h: string) => h + [...h.slice(0, -1)].reverse().join('');
const rep = (row: string, n: number) => Array(n).fill(row);

// The helper: layers -> voxels at an offset; hidden voxels (all six neighbours filled) are dropped later.
export function parse(layers: (string[] | number)[], ox = 0, oy = 0, oz = 0, out: Vox[] = []) {
  let y = oy, last: string[] = [];
  for (const L of layers) {
    for (let n = 0, k = typeof L === 'number' ? L : 1; n < k; n++, y++) {
      if (typeof L !== 'number') last = L;
      last.forEach((row, z) => [...row].forEach((ch, x) => { if (PAL[ch]) out.push({ x: x + ox, y, z: z + oz, c: PAL[ch] }); }));
    }
  }
  return out;
}
export function cull(v: Vox[]) {
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`, has = new Set(v.map((p) => key(p.x, p.y, p.z)));
  return v.filter(({ x, y, z }) => y === 0 || ![[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].every(([a, b, c]) => has.has(key(x + a, y + b, z + c))));
}

const TREE = [['...', '.t.', '...'], 1, ['TTT', 'TLT', 'TTT'], ['LTL', 'TTT', 'LTL'], ['...', '.L.', '...']];
const trees = (out: Vox[], at: number[][]) => at.forEach(([x, z]) => parse(TREE, x - 1, 1, z - 1, out));

// IISc Main Building: symmetric sandstone block, arcades and windows, two wings ending in pavilions,
// a central block and a tall, narrow clock tower with a spire. Lawn, a path, trees.
function iisc() {
  const v: Vox[] = [];
  parse([[...rep(m('g'.repeat(23)), 12), ...rep(m('g'.repeat(21) + 'pp'), 5)]], 0, 0, 0, v); // ground 45 x 17
  const C = '               ', W = '          ';
  parse([
    [m(C + 'SSSSSS'), ...rep(m('S'.repeat(21)), 6), ...rep(m('SSSSS' + W + 'SSSSSS'), 2)], // plinth
    [m(C + 'ssssss'), ...rep(m('s'.repeat(21)), 5), m('sssss' + 'asasasasas' + 'ssssss'), m('sssss' + W + 'ssssss'), m('sasas' + W + 'aSaSaS')], 1, // arcade
    [m(C + 'ssssss'), ...rep(m('s'.repeat(21)), 5), m('sssss' + 'wswswswsws' + 'ssssss'), m('sssss' + W + 'ssssss'), m('swsws' + W + 'wswsws')], 2, // windows
    [m(C + 'ssssss'), ...rep(m('sssss' + 'rrrrrrrrrr' + 'ssssss'), 6), m('sssss' + W + 'ssssss'), m('swsws' + W + 'wswsws')], // wing roofs
    [m(C + 'ssssss'), ...rep(m('rrrrr' + W + 'ssssss'), 7), m('rrrrr' + W + 'wswsws')], // pavilion roofs
    [...rep(m(C + 'SSSSSS'), 9)], // cornice
    [...rep(m(C + 'rrrrrr'), 2), ...rep(m(C + 'rrrsss'), 5), ...rep(m(C + 'rrrrrr'), 2)], // central roof, tower base
    ['', '', ...rep(m(C + '   sss'), 4), m(C + '   sws')], 5, // tower shaft
    ['', '', ...rep(m(C + '   sss'), 4), m(C + '   scc')], 1, // clock
    ['', '', ...rep(m(C + '   SSS'), 5)], // cornice
    ['', '', '', ...rep(m(C + '    rr'), 3)], 1, ['', '', '', '', m(C + '     r')], 1, // spire
  ], 2, 1, 3, v);
  trees(v, [[3, 1], [11, 1], [33, 1], [41, 1], [0, 7], [44, 7], [5, 14], [13, 15], [31, 15], [39, 14]]);
  return v;
}

// IIEST Shibpur Main Building: red brick with white bands, an arched verandah, a portico and the central
// clock tower with a pyramid roof; a road and a blue strip for the Hooghly in front.
function iiest() {
  const v: Vox[] = [];
  parse([[...rep(m('g'.repeat(23)), 13), m('p'.repeat(23)), ...rep(m('h'.repeat(23)), 1), m('hH'.repeat(11) + 'h'), m('h'.repeat(23))]], 0, 0, 0, v);
  const P = '                ';
  parse([
    [...rep(m('b'.repeat(21)), 6), m('babababababababa' + 'bbbbb'), m(P + 'bbbbb'), m(P + 'babab')], 1, // verandah arches
    [...rep(m('k'.repeat(21)), 7), m(P + 'kkkkk'), m(P + 'kkkkk')], // white band
    [...rep(m('b'.repeat(21)), 6), m('bwbwbwbwbwbwbwbw' + 'bbbbb'), m(P + 'bbbbb'), m(P + 'bwbwb')], 1, // first floor
    [...rep(m('k'.repeat(21)), 7), m(P + 'kkkkk'), m(P + 'kkkkk')], // cornice
    ['', ...rep(m(' ' + 'B'.repeat(20)), 5), '', m(P + ' BBBB'), m(P + ' BBBB')], // roof, pediment
    ['', '', ...rep(m(P + '  bbb'), 3), m(P + '  bwb'), '', m(P + '   BB'), m(P + '   BB')], // tower
    ['', '', ...rep(m(P + '  bbb'), 3), m(P + '  bwb')], 2,
    ['', '', ...rep(m(P + '  kkk'), 4)],
    ['', '', ...rep(m(P + '  bbb'), 3), m(P + '  bcc')], 1, // clock
    ['', '', ...rep(m(P + '  kkk'), 4)],
    ['', '', ...rep(m(P + '  BBB'), 4)], ['', '', '', ...rep(m(P + '   BB'), 2)], ['', '', '', m(P + '    B')], // pyramid roof
  ], 2, 1, 3, v);
  trees(v, [[2, 1], [10, 1], [34, 1], [42, 1], [2, 11], [42, 11], [8, 12], [36, 12]]);
  return v;
}

const cache: Record<string, Vox[]> = {};
export const campus = (id: 'iisc' | 'iiest') => (cache[id] ??= cull(id === 'iisc' ? iisc() : iiest()));

// One InstancedMesh for a campus. Each voxel flies from a random point on the CRT screen (aStart, in the
// mesh's local voxel units) to its slot; uP (0..1) drives it on the GPU, uWob wobbles it.
export function mesh(THREE: any, vox: Vox[], start: (i: number) => number[]) {
  const geo = new THREE.BoxGeometry(0.94, 0.94, 0.94);
  const st = new Float32Array(vox.length * 3), dl = new Float32Array(vox.length);
  const top = Math.max(...vox.map((p) => p.y));
  vox.forEach((p, i) => { st.set(start(i), i * 3); dl[i] = (p.y / top) * 0.6 + Math.random() * 0.25; });
  geo.setAttribute('aStart', new THREE.InstancedBufferAttribute(st, 3));
  geo.setAttribute('aDelay', new THREE.InstancedBufferAttribute(dl, 1));
  const mat = new THREE.MeshLambertMaterial();
  const u = { uP: { value: 0 }, uWob: { value: 0 }, uTime: { value: 0 } };
  mat.onBeforeCompile = (sh: any) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'attribute vec3 aStart; attribute float aDelay; uniform float uP, uWob, uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 slot = instanceMatrix[3].xyz;
      float e = smoothstep(0.0, 1.0, clamp((uP * 1.85 - aDelay) / 1.0, 0.0, 1.0));
      transformed = transformed * e + (aStart - slot) * (1.0 - e);
      transformed.y += uWob * sin(uTime * 9.0 + slot.x * 0.45 + slot.z * 0.3) * 0.6;`);
  };
  const im = new THREE.InstancedMesh(geo, mat, vox.length);
  const o = new THREE.Object3D(), c = new THREE.Color();
  vox.forEach((p, i) => { o.position.set(p.x, p.y, p.z); o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, c.set(p.c)); });
  im.frustumCulled = false;
  return { im, u };
}

// ---------- 2D drawings (terminal canvas, timeline texture) ----------
type Th = { bg: string; fg: string; dim: string; hi: string };
const ym = (d: string | number) => (typeof d === 'number' ? d : +d.slice(0, 4) + (+d.slice(5, 7) - 1) / 12);

// Pixel art front view of a campus: the front-most voxel of each column.
export function sprite(c: CanvasRenderingContext2D, id: 'iisc' | 'iiest', x: number, y: number, w: number, h: number) {
  const v = campus(id), W = 1 + Math.max(...v.map((p) => p.x)), H = 1 + Math.max(...v.map((p) => p.y));
  const px = Math.max(1, Math.floor(Math.min(w / W, h / H))), front = new Map<string, Vox>();
  for (const p of v) { const k = p.x + ',' + p.y, f = front.get(k); if (!f || p.z > f.z) front.set(k, p); }
  const x0 = x + Math.floor((w - W * px) / 2), y0 = y + h - H * px;
  front.forEach((p) => { c.fillStyle = p.c; c.fillRect(x0 + p.x * px, y0 + (H - 1 - p.y) * px, px, px); });
}

// The pixel timeline: 2020 to 2027, IIEST and IISc spans, RMES and IBM ticks; `at` is lit.
export function timeline(c: CanvasRenderingContext2D, at: 'iisc' | 'iiest' | null, x: number, y: number, w: number, f: number, th: Th) {
  const y0 = 2020, y1 = 2027.5, X = (t: number) => x + ((t - y0) / (y1 - y0)) * w, px = Math.max(2, Math.round(f / 4));
  c.font = `${f}px ui-monospace, Consolas, monospace`; c.textBaseline = 'top';
  for (const [id, cp] of Object.entries(s.campuses) as [string, any][]) {
    const on = id === at;
    for (let t = cp.from; t < cp.to + (id === 'iisc' ? 0.5 : 0); t += 0.125) { c.fillStyle = on ? th.fg : th.dim; c.fillRect(Math.round(X(t)), y + px, Math.max(1, Math.round(X(t + 0.125) - X(t)) - 1), px * 2); }
    c.fillStyle = on ? th.hi : th.dim;
    c.fillText(`${cp.name.split(' ')[0]} ${cp.from}–${String(cp.to).slice(2)}`, X(cp.from), y + px * 4);
  }
  s.ticks.forEach((k, i) => { const tx = X(ym(k.at)); c.fillStyle = th.hi; c.fillRect(Math.round(tx), y - px, px, px * 4); c.fillStyle = th.dim; c.fillText(k.label, tx - f * 2, y - px * 2 - f * (i % 2 ? 2 : 1)); });
}

// India, as a coarse outline (longitude, latitude), and the two cities of the hop.
const INDIA = [[74, 37], [77.8, 35.5], [79, 34.3], [78.8, 32.5], [79.5, 30.9], [81, 30.2], [80.1, 28.8], [83.3, 27.4], [85.5, 26.7], [88, 26.4], [88.8, 27.9], [89.8, 26.7], [92, 26.9], [95.5, 28.2], [97.3, 28.2], [96.5, 27], [95, 25.7], [94.5, 24], [93.3, 23], [92.6, 22], [91.8, 23.3], [91.3, 24.5], [92, 25.1], [89.9, 25.3], [88.4, 24.3], [88.7, 23], [89, 21.6], [87, 21.5], [86.5, 20.2], [85, 19.3], [84, 18.2], [82.3, 16.6], [80.3, 15.6], [80.2, 13.4], [79.8, 11.5], [79.3, 10.3], [78.2, 8.9], [77.5, 8.1], [76.5, 9.5], [75.8, 11.5], [74.8, 13], [74.1, 15], [73.4, 16.5], [72.8, 19], [72.6, 21.2], [70.4, 20.8], [69, 22.3], [68.4, 23.6], [71, 24.5], [70.3, 25.6], [69.6, 27], [70.8, 27.9], [72.8, 30], [74.6, 31], [74.5, 32.7], [73.8, 34], [74, 37]];
const CITY: Record<string, number[]> = { iiest: [88.36, 22.57], iisc: [77.59, 12.97] };

// The map hop: the outline draws itself, then a dotted hop runs from `from` to `to`. k in 0..1.
export function hop(c: CanvasRenderingContext2D, from: string, to: string, k: number, x: number, y: number, w: number, h: number, th: Th) {
  const sc = Math.min(w / 30, h / 30), px = Math.max(2, Math.round(sc * 0.55));
  const P = ([lo, la]: number[]) => [x + (w - 30 * sc) / 2 + (lo - 68) * sc, y + (h - 30 * sc) / 2 + (37.5 - la) * sc];
  const dot = (p: number[], col: string, r = px) => { c.fillStyle = col; c.fillRect(Math.round(p[0] - r / 2), Math.round(p[1] - r / 2), r, r); };
  const draw = Math.min(1, k / 0.45) * (INDIA.length - 1);
  for (let i = 0; i < draw; i++) {
    const a = P(INDIA[i]), b = P(INDIA[i + 1]), n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (px * 1.6)));
    for (let j = 0; j < n; j++) dot([a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n], th.dim);
  }
  if (k < 0.45 || !CITY[from] || !CITY[to] || from === to) { if (CITY[to] && k >= 0.45) dot(P(CITY[to]), th.hi, px * 2); return; }
  const a = P(CITY[from]), b = P(CITY[to]), q = Math.min(1, (k - 0.45) / 0.45), mx = (a[0] + b[0]) / 2 - sc * 3, my = (a[1] + b[1]) / 2;
  const bez = (t: number) => [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * mx + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * my + t * t * b[1]];
  for (let t = 0; t <= q; t += 0.04) dot(bez(t), th.fg);
  dot(a, th.hi, px * 2); dot(bez(q), th.hi, px * 2.5);
  c.fillStyle = th.fg; c.font = `${Math.round(sc * 1.3)}px ui-monospace, Consolas, monospace`; c.textBaseline = 'middle';
  c.fillText((s.campuses as any)[from].city, a[0] + px * 2, a[1]);
  if (q >= 1) c.fillText((s.campuses as any)[to].city, b[0] + px * 2, b[1]);
}

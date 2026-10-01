// The room: one persistent react-three-fiber canvas behind the terminal. A desk, a CRT whose screen is the
// terminal's 2D canvas (a CanvasTexture on a slightly curved plane), a keyboard, a chai cup, a bicycle and a
// window with a moon. Primitives only, Lambert materials, no shadows, no GLTF.
// One full-screen post shader does barrel distortion, scanlines, vignette, grain and a cheap bloom.
// The CRT look (barrel curvature, sin() scanlines, flicker) is adapted from ThreeUI "Void Protocol" and its
// vignette and grain from "Matrix Field" (Meng To, MIT, https://github.com/MengTo/threeui).
//
// Three.js and fiber load by dynamic import only after first paint, the load event and idle (the v1
// painted() gate), and only when: no reduced motion, not plain mode, more than 4 cores, WebGL 2.
// The terminal keeps working in 2D whenever this does not run or the WebGL context is lost.
import { useEffect, useRef, useState } from 'react';
import { scene } from '../lib/store';
import { campus, mesh, timeline } from '../lib/voxel';

const host = () => document.getElementById('hero-visual');
const live = (on: boolean) => host()?.toggleAttribute('data-live', on);
const nextTask = () => new Promise((r) => setTimeout(r, 0));

function allowed() {
  try {
    const h = document.documentElement;
    if (h.dataset.motion === 'reduce' || h.hasAttribute('data-plain')) return false;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    if (!(navigator.hardwareConcurrency > 4)) return false;
    const gl = document.createElement('canvas').getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

export default function Scene() {
  const [lib, setLib] = useState<any>(null);
  const lost = useRef(false);
  useEffect(() => {
    if (!allowed()) return;
    let term: any;
    import('../lib/term')
      .then((m) => { term = m.term; return m.painted(); })
      .then(() => Promise.all([import('three'), import('@react-three/fiber')]))
      .then(async ([THREE, fiber]) => {
        await nextTask(); // build the room in its own task, before React mounts the canvas
        term.texture(true);
        setLib({ THREE, fiber, term, w: build(THREE, term) });
      })
      .catch(() => {});
  }, []);
  if (!lib || lost.current) return null;
  const { Canvas } = lib.fiber;
  const coarse = matchMedia('(pointer: coarse)').matches;
  return (
    <Canvas
      dpr={coarse ? [1, 1.25] : [1, 1.5]}
      flat
      gl={async (defaults: any) => {
        await nextTask(); // create the WebGL context in its own task
        return new lib.THREE.WebGLRenderer({ ...defaults, antialias: false, alpha: false, powerPreference: 'low-power' });
      }}
      camera={{ fov: 40, near: 0.05, far: 30, position: [0, 1.1, 1.4] }}
      onCreated={({ gl }: any) => gl.domElement.addEventListener('webglcontextlost', () => {
        lost.current = true; live(false); lib.term.texture(false); setLib({ ...lib });
      })}
    >
      <World lib={lib} />
    </Canvas>
  );
}

// ---------- the room ----------
const SH = 0.42; // CRT screen height (m); width follows the terminal's aspect
const SCREEN_Y = 1.07, SCREEN_Z = -0.05;

function build(THREE: any, term: any) {
  const root = new THREE.Group();
  const mats: Record<string, any> = {};
  const L = (c: string) => (mats[c] ??= new THREE.MeshLambertMaterial({ color: c }));
  const add = (geo: any, mat: any, x: number, y: number, z: number, parent = root) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const box = (w: number, h: number, d: number, c: string, x: number, y: number, z: number, parent = root) => add(new THREE.BoxGeometry(w, h, d), L(c), x, y, z, parent);
  // a cylinder from a to b (for bicycle tubes)
  const up = new THREE.Vector3(0, 1, 0);
  const tube = (a: number[], b: number[], r: number, c: string, parent: any) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
    const m = add(new THREE.CylinderGeometry(r, r, d.length(), 8), L(c), 0, 0, 0, parent);
    m.position.copy(A).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(up, d.normalize());
    return m;
  };

  // floor and walls
  const floor = add(new THREE.PlaneGeometry(8, 8), L('#15171b'), 0, 0, 0); floor.rotation.x = -Math.PI / 2;
  add(new THREE.PlaneGeometry(8, 3.2), L('#121820'), 0, 1.6, -0.95);
  const left = add(new THREE.PlaneGeometry(8, 3.2), L('#10151c'), -1.85, 1.6, 0); left.rotation.y = Math.PI / 2;

  // desk and keyboard
  box(1.7, 0.05, 0.85, '#3a2c22', 0, 0.725, 0);
  for (const [x, z] of [[-0.8, -0.38], [0.8, -0.38], [-0.8, 0.38], [0.8, 0.38]]) box(0.05, 0.7, 0.05, '#2a2019', x, 0.35, z);
  box(0.46, 0.022, 0.15, '#9d968a', 0, 0.761, 0.22);
  box(0.42, 0.008, 0.11, '#6f6a61', 0, 0.775, 0.22);

  // window with the moon (on the back wall, right of the desk)
  const sky = new THREE.MeshBasicMaterial({ color: '#0c1a33' });
  add(new THREE.PlaneGeometry(0.8, 0.9), sky, 1.05, 1.55, -0.945);
  const moonMat = new THREE.MeshBasicMaterial({ color: '#d9d5c3' });
  const moon = add(new THREE.SphereGeometry(0.07, 20, 12), moonMat, 1.2, 1.72, -0.93);
  for (const [w, h, x, y] of [[0.86, 0.04, 1.05, 2.02], [0.86, 0.04, 1.05, 1.08], [0.04, 0.94, 0.63, 1.55], [0.04, 0.94, 1.47, 1.55], [0.02, 0.9, 1.05, 1.55], [0.8, 0.02, 1.05, 1.55]])
    box(w, h, 0.03, '#2b313a', x, y, -0.92);

  // chai cup (steam comes in the off-duty step)
  const cup = new THREE.Group(); cup.position.set(0.52, 0.75, 0.16); root.add(cup);
  add(new THREE.CylinderGeometry(0.042, 0.035, 0.09, 20, 1, true), new THREE.MeshLambertMaterial({ color: '#e8e2d4', side: THREE.DoubleSide }), 0, 0.045, 0, cup);
  add(new THREE.CircleGeometry(0.035, 20), L('#e8e2d4'), 0, 0.002, 0, cup).rotation.x = -Math.PI / 2;
  add(new THREE.CircleGeometry(0.04, 20), L('#9a6a3a'), 0, 0.075, 0, cup).rotation.x = -Math.PI / 2;
  add(new THREE.TorusGeometry(0.022, 0.006, 6, 14), L('#e8e2d4'), 0.046, 0.048, 0, cup);

  // bicycle leaning against the left wall: two torus wheels with spokes, tubes from cylinders
  const bikeOuter = new THREE.Group(); bikeOuter.position.set(-1.7, 0, 0.05); bikeOuter.rotation.y = Math.PI / 2; root.add(bikeOuter);
  const bike = new THREE.Group(); bike.rotation.x = -0.1; bikeOuter.add(bike);
  const wheels = [-0.5, 0.5].map((x) => {
    const g = new THREE.Group(); g.position.set(x, 0.33, 0); bike.add(g);
    add(new THREE.TorusGeometry(0.31, 0.02, 8, 36), L('#5a606a'), 0, 0, 0, g);
    for (let i = 0; i < 3; i++) box(0.6, 0.006, 0.006, '#8a9099', 0, 0, 0, g).rotation.z = (i * Math.PI) / 3;
    return g;
  });
  const red = '#b8433a';
  for (const [a, b] of [[[-0.5, 0.33, 0], [-0.05, 0.3, 0]], [[-0.5, 0.33, 0], [-0.18, 0.82, 0]], [[-0.05, 0.3, 0], [-0.18, 0.82, 0]], [[-0.18, 0.82, 0], [0.32, 0.84, 0]], [[-0.05, 0.3, 0], [0.35, 0.74, 0]], [[0.35, 0.74, 0], [0.5, 0.33, 0]], [[0.32, 0.84, 0], [0.35, 0.74, 0]], [[0.32, 0.84, 0], [0.3, 0.95, 0]]] as number[][][])
    tube(a, b, 0.016, red, bike);
  tube([0.3, 0.95, -0.22], [0.3, 0.95, 0.22], 0.012, '#2a2d31', bike);
  box(0.16, 0.03, 0.06, '#1c1f24', -0.2, 0.86, 0, bike);

  // CRT and its screen (rebuilt when the terminal's aspect changes)
  const crt = new THREE.Group(); root.add(crt);
  const map = new THREE.CanvasTexture(term.canvas);
  map.colorSpace = THREE.SRGBColorSpace; map.minFilter = THREE.LinearFilter; map.generateMipmaps = false;
  const screenMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, uTime: { value: 0 }, uDim: { value: 1 }, uDream: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D map; uniform float uTime, uDim, uDream; varying vec2 vUv; float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 c = vUv - 0.5; vec2 uv = vUv + c * dot(c, c) * 0.1;            // tube curvature
        vec3 t = texture2D(map, uv).rgb;
        float edge = smoothstep(0.0, 0.012, uv.x) * smoothstep(1.0, 0.988, uv.x) * smoothstep(0.0, 0.012, uv.y) * smoothstep(1.0, 0.988, uv.y);
        vec3 col = t * 1.35 + vec3(0.004, 0.014, 0.008);                   // phosphor glow on a dark tube
        col *= 1.0 - 0.45 * smoothstep(0.25, 0.75, length(c));
        col *= 0.96 + 0.04 * sin(uTime * 60.0);                              // mains flicker
        col *= 1.0 - 0.85 * step(hash(floor(uv * vec2(96.0, 72.0))), uDream * 1.05); // the text dissolves into the dream
        gl_FragColor = vec4(col * edge * uDim, 1.0);
      }`,
  });
  const led = new THREE.MeshBasicMaterial({ color: '#2a7a4a' });
  const w: any = { THREE, root, crt, map, screenMat, led, moon, moonMat, wheels, cup, aspect: 0, sw: 0, lights: null };
  w.makeCRT = (aspect: number) => {
    crt.clear();
    const sw = SH * aspect, bw = sw + 0.14, bh = SH + 0.16;
    w.aspect = aspect; w.sw = sw;
    box(bw, bh, 0.36, '#b5ad99', 0, SCREEN_Y - 0.005, SCREEN_Z - 0.185, crt);
    box(bw * 0.78, bh * 0.82, 0.26, '#a39b88', 0, SCREEN_Y + 0.005, SCREEN_Z - 0.48, crt);
    box(0.32, 0.04, 0.26, '#a39b88', 0, 0.77, SCREEN_Z - 0.2, crt);
    box(sw + 0.035, SH + 0.035, 0.012, '#1a1c1e', 0, SCREEN_Y, SCREEN_Z + 0.001, crt);
    const g = new THREE.PlaneGeometry(sw, SH, 24, 18), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (sw / 2), y = p.getY(i) / (SH / 2); p.setZ(i, 0.018 * (1 - x * x * 0.6) * (1 - y * y * 0.6)); }
    add(g, screenMat, 0, SCREEN_Y, SCREEN_Z + 0.004, crt);
    add(new THREE.BoxGeometry(0.014, 0.014, 0.01), led, sw / 2 + 0.03, SCREEN_Y - SH / 2 - 0.05, SCREEN_Z + 0.002, crt);
  };
  w.makeCRT(term.aspect());

  // The dream: each campus is one InstancedMesh of voxels (0.02 m each) above the desk, in front of the
  // screen; its voxels start at random points on the screen and fly to their slots (on the GPU).
  const V = 0.02, BASE = new THREE.Vector3(0, 0.8, 0.16);
  w.campuses = {};
  w.buildCampus = (id: 'iisc' | 'iiest') => {
    const vox = campus(id), W = 1 + Math.max(...vox.map((p) => p.x)), D = 1 + Math.max(...vox.map((p) => p.z));
    const g = new THREE.Group(); g.position.copy(BASE); g.scale.setScalar(V); g.visible = false; root.add(g);
    const off = new THREE.Vector3(-W / 2, 0, -D / 2);
    const { im, u } = mesh(THREE, vox, () => {
      const p = new THREE.Vector3((Math.random() - 0.5) * w.sw, SCREEN_Y + (Math.random() - 0.5) * SH, SCREEN_Z + 0.01);
      return p.sub(BASE).divideScalar(V).sub(off).toArray();
    });
    im.position.copy(off); g.add(im);
    return (w.campuses[id] = { g, u, p: 0, n: vox.length });
  };
  // the pixel timeline under the campus: a canvas texture on a tilted plane
  const tl = document.createElement('canvas'); tl.width = 1024; tl.height = 150;
  const tlMap = new THREE.CanvasTexture(tl); tlMap.colorSpace = THREE.SRGBColorSpace;
  const tlMat = new THREE.MeshBasicMaterial({ map: tlMap, transparent: true, opacity: 0, depthWrite: false });
  const tlMesh = add(new THREE.PlaneGeometry(0.92, 0.135), tlMat, 0, 0.79, 0.46); tlMesh.rotation.x = -0.9; tlMesh.visible = false;
  w.drawTimeline = (id: 'iisc' | 'iiest') => {
    const c = tl.getContext('2d')!;
    c.clearRect(0, 0, tl.width, tl.height); c.fillStyle = 'rgba(2,10,5,0.75)'; c.fillRect(0, 0, tl.width, tl.height);
    timeline(c, id, 30, 78, tl.width - 60, 22, { bg: '#020a05', fg: '#5cf29a', dim: '#3f9c6c', hi: '#d2ffe6' });
    tlMap.needsUpdate = true;
  };
  Object.assign(w, { tlMat, tlMesh });

  // HYDRA: a voxel graph on the desk (left of the CRT); the shortest path between two nodes pulses.
  const nodes: number[][] = [];
  let sd = 5; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 12; i++) nodes.push([-0.78 + rnd() * 0.42, 0.775 + rnd() * 0.07, -0.28 + rnd() * 0.62]);
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const edges: number[][] = [];
  nodes.forEach((a, i) => nodes.map((b, j) => [j, dist(a, b)]).filter(([j]) => j !== i).sort((x, y) => x[1] - y[1]).slice(0, 3)
    .forEach(([j]) => { if (!edges.some(([p, q]) => (p === i && q === j) || (p === j && q === i))) edges.push([i, j as number]); }));
  const cells: { e: number; t: number }[] = [], gm = new THREE.Object3D();
  edges.forEach(([i, j], e) => { const n = Math.ceil(dist(nodes[i], nodes[j]) / 0.016); for (let k = 1; k < n; k++) cells.push({ e, t: k / n }); });
  const graph = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), nodes.length + cells.length);
  nodes.forEach((p, i) => { gm.position.set(p[0], p[1], p[2]); gm.scale.setScalar(0.022); gm.updateMatrix(); graph.setMatrixAt(i, gm.matrix); });
  cells.forEach(({ e, t }, k) => {
    const [i, j] = edges[e], a = nodes[i], b = nodes[j];
    gm.position.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t); gm.scale.setScalar(0.007); gm.updateMatrix();
    graph.setMatrixAt(nodes.length + k, gm.matrix);
  });
  graph.visible = false; graph.frustumCulled = false; root.add(graph);
  // Dijkstra on the 12 nodes; returns the path as a list of [edge, forward?] in order.
  const route = (s0: number, t0: number) => {
    const d = nodes.map(() => Infinity), prev: number[] = nodes.map(() => -1), seen = new Set<number>(); d[s0] = 0;
    while (seen.size < nodes.length) {
      let u = -1; d.forEach((x, i) => { if (!seen.has(i) && (u < 0 || x < d[u])) u = i; });
      if (d[u] === Infinity) break; seen.add(u);
      edges.forEach(([i, j]) => { const v = i === u ? j : j === u ? i : -1; if (v >= 0 && d[u] + dist(nodes[u], nodes[v]) < d[v]) { d[v] = d[u] + dist(nodes[u], nodes[v]); prev[v] = u; } });
    }
    const path: [number, boolean][] = [];
    for (let v = t0; prev[v] >= 0; v = prev[v]) { const u = prev[v]; path.unshift([edges.findIndex(([i, j]) => (i === u && j === v) || (i === v && j === u)), edges[edges.findIndex(([i, j]) => (i === u && j === v) || (i === v && j === u))][0] === u]); }
    return path;
  };
  w.hydra = { graph, nodes, cells, edges, route, path: route(0, 7), ends: [0, 7], routeAt: 0, c: new THREE.Color() };

  // lights: ambient, the screen's glow, a warm lamp for chai, moonlight through the window
  const amb = new THREE.AmbientLight('#4a5566', 1.3);
  const glow = new THREE.PointLight('#5cf29a', 1.6, 3, 2); glow.position.set(0, SCREEN_Y - 0.1, 0.75);
  const lamp = new THREE.PointLight('#ffb06a', 0, 4, 2); lamp.position.set(0.7, 1.45, 0.25);
  const moonLight = new THREE.DirectionalLight('#8fa6ff', 0.35); moonLight.position.set(1, 1.6, -1);
  const key = new THREE.DirectionalLight('#fff4e0', 0); key.position.set(0.6, 2.2, 1.6); // fades in with the dream so the campus shows its colours
  root.add(amb, glow, lamp, moonLight, key);
  w.lights = { amb, glow, lamp, moonLight, key };

  // post pass: one full-screen triangle
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: matchMedia('(pointer: coarse)').matches ? 0 : 4 });
  const post = new THREE.ShaderMaterial({
    uniforms: { tScene: { value: rt.texture }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uDive: { value: 0 }, uFlick: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D tScene; uniform vec2 uRes; uniform float uTime, uDive, uFlick; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 c = vUv - 0.5;
        vec2 uv = vUv + c * dot(c, c) * (0.06 + 0.3 * uDive);               // barrel, stronger as the camera dives in
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
        vec3 col = texture2D(tScene, uv).rgb;
        vec2 px = 1.0 / uRes; vec3 b = vec3(0.0);                           // bloom-lite: 8 taps at two radii
        for (int i = 0; i < 8; i++) {
          float a = float(i) * 0.7854; vec2 o = vec2(cos(a), sin(a)) * px;
          b += max(texture2D(tScene, uv + o * 5.0).rgb - 0.5, 0.0) + 0.6 * max(texture2D(tScene, uv + o * 12.0).rgb - 0.5, 0.0);
        }
        col += b * 0.16;
        col *= 0.94 + 0.06 * sin(gl_FragCoord.y * 3.14159);                // scanlines
        col *= 1.0 - smoothstep(0.45, 0.95, length(c * vec2(1.0, 0.9)) * 1.25); // vignette
        col *= 1.0 - uFlick * 0.12;
        col += (hash(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * 0.006;   // grain
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false,
  });
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const postMesh = new THREE.Mesh(tri, post); postMesh.frustumCulled = false;
  const postScene = new THREE.Scene(); postScene.add(postMesh);
  Object.assign(w, { rt, post, postScene, postCam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) });
  return w;
}

// Camera views: [position, target]. 'seat' fits the screen to the viewport.
function view(name: string, w: any, cam: any): [number[], number[]] {
  const t = Math.tan((cam.fov * Math.PI) / 360), a = cam.aspect;
  const fit = (W: number, H: number) => Math.max(H / 2 / t, W / 2 / (t * a));
  const far = (p: number[], q: number[]) => { const k = a < 1.2 ? Math.min(1.9, 1.1 / a) : 1; return [p.map((v, i) => q[i] + (v - q[i]) * k), q]; };
  switch (name) {
    case 'desk': return far([0, 1.3, 1.25], [0, 0.88, 0]) as any;
    case 'campus': return far([0, 1.45, 1.55], [0, 1.08, 0.1]) as any;
    case 'room': return far([0.55, 1.45, 2.3], [-0.15, 0.9, -0.2]) as any;
    case 'chai': return far([0.72, 1.02, 0.62], [0.5, 0.84, 0.14]) as any;
    case 'bike': return far([-0.35, 1.2, 1.55], [-1.6, 0.5, 0.05]) as any;
    default: return [[0, SCREEN_Y + 0.01, SCREEN_Z + fit(w.sw * 1.22, SH * 1.25)], [0, SCREEN_Y, SCREEN_Z]];
  }
}

function World({ lib }: { lib: any }) {
  const { THREE, fiber, term, w } = lib;
  const get = fiber.useThree((s: any) => s.get);
  const st = useRef({ frames: 0, ready: false, tex: -1, px: 0, py: 0, pos: null as any, tgt: null as any, buf: new THREE.Vector2() });

  useEffect(() => {
    const { gl, camera, scene: s3 } = get();
    let alive = true;
    st.current.pos = camera.position.clone();
    st.current.tgt = new THREE.Vector3(0, SCREEN_Y, SCREEN_Z);
    s3.background = new THREE.Color('#05070a');
    nextTask()
      .then(() => alive && gl.compileAsync(w.root, camera, s3))
      .catch(() => {})
      .then(() => { if (alive) { s3.add(w.root); st.current.ready = true; } })
      // then build and compile the two campuses, each in its own task, so `ssh` never stalls a frame
      .then(async () => {
        for (const id of ['iiest', 'iisc'] as const) {
          await nextTask(); if (!alive) return;
          const cp = w.buildCampus(id); cp.g.visible = true;
          await gl.compileAsync(cp.g, camera, s3).catch(() => {});
          cp.g.visible = cp.p > 0;
        }
      });
    const move = (e: PointerEvent) => { st.current.px = e.clientX / innerWidth - 0.5; st.current.py = e.clientY / innerHeight - 0.5; };
    addEventListener('pointermove', move, { passive: true });
    return () => { alive = false; s3.remove(w.root); removeEventListener('pointermove', move); live(false); term.texture(false); };
  }, []);

  fiber.useFrame((state: any, delta: number) => {
    const c = st.current, { gl, camera, scene: s3 } = state, dt = Math.min(delta, 0.1), t = state.clock.elapsedTime, now = performance.now();
    if (!c.ready) return;
    // the transcript covers the stage at the end of the page: skip the work
    if (document.getElementById('track')!.getBoundingClientRect().bottom < 0) return;

    // terminal texture: re-upload when the canvas changed; rebuild the CRT if its aspect changed
    if (c.tex !== scene.tex) {
      c.tex = scene.tex;
      if (Math.abs(term.aspect() - w.aspect) > 0.01) { w.map.dispose(); w.makeCRT(term.aspect()); }
      w.map.needsUpdate = true;
    }

    // camera rig: ease toward the view of the last command, plus a little pointer parallax
    const [p, q] = view(scene.view, w, camera), k = 1 - Math.exp(-dt * 2.2);
    c.pos.lerp(new THREE.Vector3(p[0] + c.px * 0.06, p[1] - c.py * 0.04, p[2]), k);
    c.tgt.lerp(new THREE.Vector3(...q), k);
    camera.position.copy(c.pos); camera.lookAt(c.tgt);

    // screen, LED and lights
    const sleep = scene.sleep ? 1 : 0;
    w.dim = (w.dim ?? 1) + ((sleep ? 0.35 : 1) - (w.dim ?? 1)) * k;
    w.screenMat.uniforms.uTime.value = t;
    w.screenMat.uniforms.uDim.value = w.dim;
    const load = Math.max(0, 1 - (now - scene.loadAt) / 4000);
    const pulse = load > 0 ? 0.5 + 0.5 * Math.sin(t * 14) : 0.5 + 0.5 * Math.sin(t * 2);
    w.led.color.setRGB(0.1 + 0.25 * pulse * (1 + load), 0.35 + 0.65 * pulse, 0.2 + 0.3 * pulse);
    w.lights.glow.color.set(scene.amber ? '#f2b35c' : '#5cf29a');
    w.lights.glow.intensity = 1.1 * w.dim;
    w.lights.amb.intensity = 1.3 * (0.4 + 0.6 * w.dim);
    w.lights.lamp.intensity += ((scene.warm && !sleep ? 1.4 : 0) - w.lights.lamp.intensity) * k;
    w.moonMat.color.setScalar(0.85 + 0.15 * sleep);
    w.lights.moonLight.intensity = 0.35 + 0.5 * sleep;

    // the dream: after the map hop the campus assembles out of the screen; any other command sends it back
    let dream = 0;
    for (const id of ['iiest', 'iisc'] as const) {
      const cp = w.campuses[id], want = scene.campus === id && now - scene.hopAt > 1900 ? 1 : 0;
      if (!cp) continue;
      cp.p = Math.max(0, Math.min(1, cp.p + ((want ? 1 : -1) * dt) / 1.3));
      cp.g.visible = cp.p > 0;
      cp.u.uP.value = cp.p; cp.u.uTime.value = t; cp.u.uWob.value = Math.max(0, 1 - (now - scene.dragAt) / 700);
      if (want && w.tlFor !== id) { w.drawTimeline(id); w.tlFor = id; }
      dream = Math.max(dream, cp.p);
    }
    w.screenMat.uniforms.uDream.value = dream;
    w.lights.key.intensity = 2.2 * dream; w.lights.glow.intensity *= 1 - 0.75 * dream;
    w.tlMesh.visible = dream > 0; w.tlMat.opacity = dream;

    // HYDRA graph: a click picks two new endpoints; the shortest path pulses from one end to the other
    const H = w.hydra;
    H.graph.visible = scene.graph;
    if (scene.graph) {
      if (scene.routeAt !== H.routeAt) {
        H.routeAt = scene.routeAt;
        const a = Math.floor(Math.random() * 12); let b = a; while (b === a) b = Math.floor(Math.random() * 12);
        H.ends = [a, b]; H.path = H.route(a, b);
      }
      const on = new Map(H.path.map(([e, fwd]: [number, boolean], i: number) => [e, [i, fwd]]));
      const wave = (t * 0.6) % 1.3;
      H.nodes.forEach((_: any, i: number) => H.graph.setColorAt(i, H.c.set(H.ends.includes(i) ? '#d2ffe6' : '#3f9c6c')));
      H.cells.forEach(({ e, t: f }: any, k: number) => {
        const hit: any = on.get(e);
        if (!hit) { H.graph.setColorAt(H.nodes.length + k, H.c.setRGB(0.05, 0.16, 0.1)); return; }
        const sPos = (hit[0] + (hit[1] ? f : 1 - f)) / H.path.length, g = Math.max(0, 1 - Math.abs(sPos - wave) * 6);
        H.graph.setColorAt(H.nodes.length + k, H.c.setRGB(0.15 + 0.7 * g, 0.55 + 0.45 * g, 0.3 + 0.55 * g));
      });
      H.graph.instanceColor.needsUpdate = true;
    }

    // post pass
    gl.getDrawingBufferSize(c.buf);
    if (w.rt.width !== c.buf.x || w.rt.height !== c.buf.y) { w.rt.setSize(c.buf.x, c.buf.y); w.post.uniforms.uRes.value.copy(c.buf); }
    w.post.uniforms.uTime.value = t;
    w.post.uniforms.uFlick.value = now - scene.keyAt < 70 ? 1 : 0;
    w.post.uniforms.uDive.value = scene.view === 'campus' ? 0.35 : 0;
    gl.setRenderTarget(w.rt); gl.render(s3, camera);
    gl.setRenderTarget(null); gl.render(w.postScene, w.postCam);

    // the second rendered frame with the room in it is on screen: hide the 2D canvas
    if (++c.frames === 2) live(true);
  }, 1);

  return null;
}

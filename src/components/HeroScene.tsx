// Hero scene: a 12x12x12 tensor of instanced cubes that factorises into three thinner slabs as you
// scroll, while 16 cubes (the 16 GPUs) light up in the accent colour.
//
// Adapted from ThreeUI's "Topology Field" by Meng To (MIT licence, https://github.com/MengTo/threeui,
// src/shaders/neuform-isolated/sources/nexus-topology.html): a fogged group of nodes with a slow
// compound idle rotation and a per-node sine pulse. Here the nodes are instanced cubes, the pulse
// drives the lit cubes, and the slabs, scroll, pointer parallax and gating are new.
//
// Three.js, react-three-fiber and GSAP are loaded with dynamic import() only after every gate passes,
// so the static HTML (and its SVG poster) paints first. The poster stays when there is no WebGL 2,
// reduced motion is asked for (OS setting or the site's toggle), the device has 4 cores or fewer,
// or the WebGL context is lost.
import { useEffect, useRef, useState } from 'react';

const N = 12, SLAB = 4, LIT = 16;
const BG = '#0b0d10', BASE = '#3b4756', ACCENT = '#5cf29a';

const live = (on: boolean) => document.getElementById('hero-visual')?.toggleAttribute('data-live', on);
const nextTask = () => new Promise((r) => setTimeout(r, 0));
// Resolves once the browser has painted the static page (or after 3 s where paint timing is missing).
const painted = () => new Promise<void>((r) => {
  setTimeout(r, 3000);
  try { new PerformanceObserver((_, o) => { o.disconnect(); r(); }).observe({ type: 'paint', buffered: true }); } catch { r(); }
});

let webgl: boolean | undefined;
function allowed() {
  try {
    if (document.documentElement.dataset.motion === 'reduce') return false;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    if (!(navigator.hardwareConcurrency > 4)) return false;
    if (webgl === undefined) {
      const gl = document.createElement('canvas').getContext('webgl2');
      webgl = !!gl;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    }
    return webgl;
  } catch {
    return false;
  }
}

export default function HeroScene() {
  const box = useRef<HTMLDivElement>(null);
  const lost = useRef(false);
  const [on, setOn] = useState(false);
  const [lib, setLib] = useState<any>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const check = () => setOn(!lost.current && allowed());
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener('change', check);
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting));
    io.observe(box.current!);
    return () => { mo.disconnect(); mq.removeEventListener('change', check); io.disconnect(); };
  }, []);

  useEffect(() => {
    if (!on) { live(false); return; }
    if (!lib) {
      painted()
        .then(() => Promise.all([import('three'), import('@react-three/fiber'), import('gsap'), import('gsap/ScrollTrigger')]))
        .then(async ([THREE, fiber, g, st]) => {
          await nextTask(); // build the tensor in its own task, before React mounts the canvas
          setLib({ THREE, fiber, gsap: g.gsap, ScrollTrigger: st.ScrollTrigger, t: build(THREE) });
        })
        .catch(() => {});
    }
  }, [on]);

  const Canvas = on && lib ? lib.fiber.Canvas : null;
  return (
    <div ref={box} className="hero-scene" aria-hidden="true">
      {Canvas && (
        <Canvas
          dpr={[1, 1.5]}
          flat
          frameloop={inView ? 'always' : 'demand'}
          gl={async (defaults: any) => {
            await nextTask(); // create the WebGL context in its own task, apart from React's mount work
            return new lib.THREE.WebGLRenderer({ ...defaults, antialias: true, alpha: true, powerPreference: 'low-power' });
          }}
          camera={{ position: [0, 0, 42], fov: 35 }}
          style={{ pointerEvents: 'none' }}
          onCreated={({ gl }: any) => gl.domElement.addEventListener('webglcontextlost', () => { lost.current = true; setOn(false); })}
        >
          <Tensor lib={lib} />
        </Canvas>
      )}
    </div>
  );
}

function build(THREE: any) {
  const geo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
  const mat = new THREE.MeshLambertMaterial();
  const base = new THREE.Color(BASE), accent = new THREE.Color(ACCENT);
  const root = new THREE.Group(), tilt = new THREE.Group(), spin = new THREE.Group();
  root.add(tilt);
  tilt.add(spin);
  spin.rotation.y = Math.PI / 4; // start corner-on and tilted, like the SVG poster
  tilt.rotation.x = 0.7;
  root.add(new THREE.AmbientLight(0xffffff, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 3.4);
  key.position.set(5, 10, 8);
  const fill = new THREE.DirectionalLight(0x9db0c4, 1);
  fill.position.set(-8, -3, 5);
  root.add(key, fill);

  // Three slabs of 12 x 4 x 12 cubes stacked along y; each is one InstancedMesh (3 draw calls in all).
  const o = new THREE.Object3D(), shell: number[][] = [];
  const slabs = [0, 1, 2].map((s) => {
    const m = new THREE.InstancedMesh(geo, mat, N * SLAB * N);
    m.frustumCulled = false; // always on screen; skips a 576-instance bounding-sphere pass and per-frame culling
    let n = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < SLAB; j++) for (let k = 0; k < N; k++, n++) {
      o.position.set(i - (N - 1) / 2, j - (SLAB - 1) / 2, k - (N - 1) / 2);
      o.updateMatrix();
      m.setMatrixAt(n, o.matrix);
      m.setColorAt(n, base);
      if (i === 0 || k === 0 || i === N - 1 || k === N - 1 || j === SLAB - 1) shell.push([s, n]);
    }
    spin.add(m);
    return m;
  });

  // 16 lit cubes on the visible shell of the slabs, picked with the same seeded generator as the SVG poster.
  let seed = 11;
  const picked = new Set<number>();
  while (picked.size < LIT) picked.add((seed = (seed * 16807) % 2147483647) % shell.length);
  const lit = [...picked].map((p, i) => ({ mesh: slabs[shell[p][0]], n: shell[p][1], speed: 0.9 + ((i * 7) % 16) * 0.075, phase: i * 2.4 }));
  return { root, tilt, spin, slabs, lit, geo, mat, base, accent, c: new THREE.Color(), glow: 0 };
}

function Tensor({ lib }: { lib: any }) {
  const { THREE, fiber, gsap, ScrollTrigger } = lib;
  const t = lib.t;
  const get = fiber.useThree((s: any) => s.get);
  const s = useRef({ goal: 0, p: 0, x: 0, y: 0, frames: 0, ready: false });

  useEffect(() => {
    const { gl, camera, scene } = get();
    scene.fog = new THREE.Fog(BG, 36, 60);
    let alive = true, st: any;
    // Shader compile and the scroll trigger each run in their own task, apart from React's mount work.
    // compileAsync uses KHR_parallel_shader_compile, so the tensor joins the scene once its program is ready.
    nextTask()
      .then(() => alive && gl.compileAsync(t.root, camera, scene))
      .catch(() => {})
      .then(() => { if (alive) { scene.add(t.root); s.current.ready = true; } });
    nextTask().then(() => {
      if (!alive) return;
      gsap.registerPlugin(ScrollTrigger);
      st = ScrollTrigger.create({
        trigger: '#hero-visual',
        start: 'clamp(top 60%)',
        end: 'clamp(bottom 35%)',
        onUpdate: (e: any) => { s.current.goal = e.progress; },
      });
      s.current.goal = s.current.p = st.progress;
    });
    const move = (e: PointerEvent) => { s.current.x = e.clientX / innerWidth - 0.5; s.current.y = e.clientY / innerHeight - 0.5; };
    addEventListener('pointermove', move, { passive: true });
    return () => {
      alive = false;
      scene.remove(t.root);
      st?.kill();
      removeEventListener('pointermove', move);
      t.geo.dispose();
      t.mat.dispose();
      live(false);
    };
  }, []);

  fiber.useFrame((state: any, delta: number) => {
    const c = s.current, time = state.clock.elapsedTime, dt = Math.min(delta, 0.1);
    c.p += (c.goal - c.p) * Math.min(1, dt * 5);
    const e = c.p * c.p * (3 - 2 * c.p);

    // Idle: Topology Field turns its group 0.0018 rad per frame about y (0.108 rad/s at 60 fps).
    t.spin.rotation.y += dt * 0.108;
    t.spin.rotation.z = Math.sin(time * 0.2) * 0.06;
    // Gentle pointer parallax, eased.
    const k = Math.min(1, dt * 3);
    t.tilt.rotation.x += (0.7 + c.y * 0.2 - t.tilt.rotation.x) * k;
    t.tilt.rotation.y += (c.x * 0.3 - t.tilt.rotation.y) * k;

    // Factorise: the slabs move apart, thin to half height and fan out slightly.
    t.slabs.forEach((m: any, i: number) => {
      m.position.y = (i - 1) * SLAB * (1 + 0.8 * e);
      m.scale.y = 1 - 0.5 * e;
      m.rotation.y = (i - 1) * 0.35 * e;
    });

    // Light the 16 cubes, each with its own slow pulse.
    const glow = Math.min(1, Math.max(0, (e - 0.15) / 0.6));
    if (glow > 0 || t.glow > 0) {
      for (const l of t.lit) l.mesh.setColorAt(l.n, t.c.lerpColors(t.base, t.accent, glow * (0.8 + 0.2 * Math.sin(time * l.speed + l.phase))));
      t.slabs.forEach((m: any) => { m.instanceColor.needsUpdate = true; });
    }
    t.glow = glow;

    // useFrame runs before each render, so its second call with the tensor in the scene means that frame is on screen.
    if (c.ready && ++c.frames === 2) live(true);
  });

  return null;
}

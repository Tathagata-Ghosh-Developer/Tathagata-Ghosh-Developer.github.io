// The terminal: a tiny monospace renderer on a 2D canvas, the shell, and the scroll replay.
// Works on its own (no WebGL needed); when the 3D room runs, the same canvas becomes the CRT's texture.
// Boot progress bar adapted from ThreeUI "Uplink Loader" (Meng To, MIT): a tick bar filling to 100 %
// with a glowing readout. `top` gauges follow ThreeUI "Diagnostics Panel" (segmented bars, value + label).
import s from '../data/site.json';
import { scene, set } from './store';

const html = document.documentElement;
const plain = () => html.hasAttribute('data-plain');
const still = () => !html.classList.contains('anim'); // reduced motion: no blink, no typing, no animation
const $ = (id: string) => document.getElementById(id)!;

// Resolves once the browser has painted, the load event has fired and the main thread is idle (from v1).
export const painted = () => new Promise<void>((r) => {
  setTimeout(r, 3000);
  try { new PerformanceObserver((_, o) => { o.disconnect(); r(); }).observe({ type: 'paint', buffered: true }); } catch { r(); }
})
  .then(() => new Promise<void>((r) => (document.readyState === 'complete' ? r() : addEventListener('load', () => r(), { once: true }))))
  .then(() => new Promise<void>((r) => ('requestIdleCallback' in window ? (window as any).requestIdleCallback(() => r(), { timeout: 1500 }) : setTimeout(r, 300))));

// ---------- renderer ----------
type Text = string | ((now: number) => string);
type Line = { t: Text; st: number; ind?: string; pl?: number }; // st: 0 text, 1 dim, 2 bright, 3 prompt
const THEME = {
  green: { bg: '#020a05', fg: '#5cf29a', dim: '#3f9c6c', hi: '#d2ffe6' },
  amber: { bg: '#0b0602', fg: '#f2b35c', dim: '#aa7a3e', hi: '#ffecd0' },
};
export type Geom = { c: CanvasRenderingContext2D; ox: number; oy: number; cw: number; ch: number; cols: number; rows: number; W: number; H: number; th: typeof THEME.green };

export const canvas = $('term') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const FONT = '"SF Mono", Menlo, Consolas, "Liberation Mono", "DejaVu Sans Mono", monospace';
let cols = 80, rows = 30, cw = 10, ch = 20, f = 16, ox = 0, oy = 0, glow = true, tex = false;
let lines: Line[] = [];
let overlay: null | ((g: Geom, now: number) => boolean) = null;
let blink = true, typed = '', booting = false;

function grid() {
  cols = innerWidth < 640 ? 40 : innerWidth < 1000 ? 60 : 80;
  rows = innerHeight < 560 ? 20 : cols === 60 ? 28 : 30;
}
// DOM mode: fill the canvas box at device resolution. Texture mode: a fixed size for the CRT.
function fit() {
  grid();
  let W: number, H: number;
  if (tex) { W = cols * 15 + 48; H = rows * 30 + 48; }
  else {
    const r = canvas.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width * d)); H = Math.max(1, Math.round(r.height * d));
  }
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  f = Math.floor(Math.min((W - 24) / cols / 0.6, (H - 24) / rows / 1.25));
  ctx.font = `${f}px ${FONT}`;
  cw = ctx.measureText('M').width;
  if (cw * cols > W - 24) { f = Math.floor(f * (W - 24) / (cw * cols)); ctx.font = `${f}px ${FONT}`; cw = ctx.measureText('M').width; }
  ch = Math.round(f * 1.25);
  ox = Math.round((W - cw * cols) / 2); oy = Math.round((H - ch * rows) / 2);
  kick();
}

function wrap(t: string, w: number, ind = '') {
  const out: string[] = [];
  while (t.length > w) {
    let cut = t.lastIndexOf(' ', w);
    if (cut <= ind.length) cut = w;
    out.push(t.slice(0, cut).trimEnd());
    t = ind + t.slice(cut).trimStart();
  }
  out.push(t);
  return out;
}
const txt = (l: Line, now: number) => (typeof l.t === 'function' ? l.t(now) : l.t);

function draw(now: number) {
  const th = scene.amber ? THEME.amber : THEME.green, c = ctx;
  c.globalAlpha = 1; c.shadowBlur = 0;
  c.fillStyle = th.bg; c.fillRect(0, 0, canvas.width, canvas.height);
  c.font = `${f}px ${FONT}`; c.textBaseline = 'top';
  const pr = prompt(), input = booting ? [] : wrap(pr + typed, cols).slice(-rows);
  const vis: { s: string; st: number; pl?: number }[] = [];
  for (let i = lines.length - 1; i >= 0 && vis.length < rows - input.length; i--) {
    const L = lines[i], w = wrap(txt(L, now), cols, L.ind);
    for (let j = w.length - 1; j >= 0 && vis.length < rows - input.length; j--) vis.unshift({ s: w[j], st: L.st === 3 && j ? 0 : L.st, pl: L.pl });
  }
  input.forEach((r, j) => vis.push({ s: r, st: j ? 0 : 3, pl: pr.length }));
  c.globalAlpha = scene.sleep ? 0.3 : now - scene.keyAt < 70 ? 0.8 : 1;
  if (glow) { c.shadowColor = th.fg; c.shadowBlur = f * 0.35; }
  const col = [th.fg, th.dim, th.hi, th.fg];
  vis.forEach((r, i) => {
    const y = oy + i * ch + (ch - f) / 2;
    if (r.st === 3 && r.pl) {
      c.fillStyle = th.hi; c.fillText(r.s.slice(0, r.pl), ox, y);
      c.fillStyle = th.fg; c.fillText(r.s.slice(r.pl), ox + r.pl * cw, y);
    } else { c.fillStyle = col[r.st]; c.fillText(r.s, ox, y); }
  });
  // block cursor at the caret of the input line
  if (!booting && (blink || still())) {
    const at = pr.length + (document.activeElement === inp ? inp.selectionStart ?? typed.length : typed.length);
    const last = input.length - 1, r0 = vis.length - input.length;
    const row = Math.min(r0 + Math.floor(at / cols), r0 + last), x = ox + (at % cols) * cw, y = oy + row * ch;
    c.shadowBlur = 0; c.fillStyle = th.fg; c.fillRect(x, y + 2, cw, ch - 4);
  }
  c.shadowBlur = 0; c.globalAlpha = 1;
  const more = overlay ? overlay({ c, ox, oy, cw, ch, cols, rows, W: canvas.width, H: canvas.height, th }, now) : false;
  scene.tex++;
  return more;
}

let dirty = true, until = 0, raf = 0;
export function kick(ms = 0) {
  dirty = true;
  until = Math.max(until, performance.now() + ms);
  if (!raf) raf = requestAnimationFrame(tick);
}
function tick(now: number) {
  raf = 0;
  if (dirty || now < until) { dirty = false; if (draw(now)) until = Math.max(until, now + 40); }
  if (now < until) raf = requestAnimationFrame(tick);
}

// ---------- shell ----------
let cwd = '~', host = 'iisc', quiet = false, addaK = -1;
const hist: string[] = [];
let hi = 0;
const prompt = () => `nasamajh@${host}:${cwd}$ `;
const say = (t: Text, st = 0, ind?: string) => { lines.push({ t, st, ind }); if (lines.length > 400) lines.splice(0, 100); };
const short = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
const born = () => (quiet || still() ? -1e9 : performance.now()); // start time of an animated line
const ease = (t0: number, now: number, ms: number) => { const k = Math.min(1, Math.max(0, (now - t0) / ms)); return 1 - (1 - k) ** 3; };
const bar = (k: number, w: number) => '[' + '#'.repeat(Math.round(k * w)) + '.'.repeat(w - Math.round(k * w)) + ']';
const proj = (q = '') => { q = q.toLowerCase().replace(/^projects\//, '').replace(/\.md$/, ''); return q && s.projects.find((p) => p.id === q || p.id.startsWith(q) || p.name.toLowerCase().startsWith(q)); };
const files = ['projects/', 'thesis.md', 'skills.txt', 'ranks.txt', 'offduty/'];
const offFiles = ['Makefile', 'bicycle/', 'pillow', 'adda.log'];

export const setOverlay = (o: typeof overlay) => { overlay = o; kick(); };
// Hooks the voxel/off-duty steps fill in (map hop and campus sprite on the 2D screen).
export const hooks = { ssh: (_c: 'iiest' | 'iisc', _from: string, _t0: number) => {} };

const linkBox = $('term-links');
function links(list: [string, string][]) {
  linkBox.replaceChildren(...list.map(([label, href]) => Object.assign(document.createElement('a'), { className: 'btn', href, textContent: label })));
  linkBox.hidden = !list.length;
}
const contact = () => links([['GitHub', s.links.github], ['LinkedIn', s.links.linkedin]]);

const HELP = [
  'commands:',
  '  whoami      top         nvidia-smi',
  '  ls          open <p>    cat <file>',
  '  history     ssh iiest   ssh iisc',
  '  cd ~/offduty make chai  ride',
  '  adda        sleep       clear',
  '  sudo hire tathagata     exit',
  'Tab completes, up/down recalls, Esc leaves.',
];

function card(id: string) {
  const p = proj(id);
  if (!p) { say(`open: no such project: ${id || '(none)'}. try 'ls projects/'`, 1); return; }
  say(`┌ ${p.name}${p.size !== '-' ? '  ' + p.size : ''}`, 2);
  say(`│ ${p.line}`, 0, '│ ');
  p.bullets.forEach((b) => say(`│ - ${b}`, 0, '│   '));
  say('│ ' + p.chips.map((c) => `[${c}]`).join(' '), 1, '│ ');
  if (p.cond) say(`│ ${p.cond}`, 1, '│ ');
  say(`└ proof: ${short(p.proof)}`, 1, '  ');
  links([[`Proof: ${p.proofLabel} (${p.name})`, p.proof]]);
  if (p.id === 'hydra') set({ graph: true, view: 'desk' });
}

function cat(f: string) {
  if (f === 'thesis.md') s.thesis.lines.forEach((l, i) => say(i ? l : '# ' + l, i ? 0 : 2, '  '));
  else if (f === 'skills.txt') s.skills.forEach((g) => say(`${g.label}: ${g.items.join(', ')}`, 0, '  '));
  else if (f === 'ranks.txt') s.ranks.forEach((r) => say(`${r.n.padEnd(14)}${r.label}`, 0, ' '.repeat(14)));
  else if (f === '/etc/motd') say(s.facts[Math.floor(Math.random() * s.facts.length)], 2);
  else if (f.startsWith('projects/')) card(f);
  else if (f === 'adda.log' && cwd !== '~') adda();
  else say(`cat: ${f || '(nothing)'}: No such file. try 'ls'`, 1);
}

function ssh(to: string) {
  const c = (s.campuses as any)[to];
  if (!c) { say(`ssh: Could not resolve hostname ${to || '(none)'}. try iiest or iisc`, 1); return; }
  const from = host;
  say(`connecting to ${to} (${c.city}) ...`, 1);
  c.lines.forEach((l: string, i: number) => say(i ? l : `${c.name} · ${l}`, i ? 0 : 2, '  '));
  say('(the screen is dreaming; any command wakes it)', 1);
  host = to;
  const t0 = born();
  set({ campus: to as 'iiest' | 'iisc', view: 'campus', hopAt: t0 });
  hooks.ssh(to as 'iiest' | 'iisc', from, t0);
}

function adda(next = false) {
  if (!next) { addaK = 0; say("adda: pull up a chair. Enter = next, anything else leaves.", 1); }
  else addaK = (addaK + 1) % s.facts.length;
  const fact = s.facts[addaK];
  say(`  > ${fact}`, 2, '    ');
  set({ adda: fact, addaAt: performance.now(), view: 'chai' });
}

function exec(cmd: string) {
  const [name, ...a] = cmd.split(/\s+/), arg = a.join(' ');
  switch (name) {
    case 'help': case '?': HELP.forEach((l, i) => say(l, i ? 0 : 2)); break;
    case 'whoami': s.whoami.forEach((l, i) => say(l, i ? (i === 3 ? 1 : 0) : 2)); break;
    case 'pwd': say(cwd === '~' ? '/home/nasamajh' : '/home/nasamajh/offduty'); break;
    case 'ls': {
      const d = arg.replace(/^-l\s*/, '').replace(/^~\/?/, '');
      if (/^projects\/?$/.test(d)) {
        say(`total ${s.projects.length}  (size = speedup)`, 1);
        s.projects.forEach((p) => say(`${p.size.padStart(7)}  ${p.id}.md`));
      } else if (d === 'offduty' || d === 'offduty/' || (!d && cwd !== '~')) say(offFiles.join('  '));
      else if (!d) say(files.join('  '));
      else say(`ls: cannot access '${d}': No such file or directory`, 1);
      break;
    }
    case 'open': card(arg); break;
    case 'cat': cat(arg.replace(/^~\//, '')); break;
    case 'top': {
      const t0 = born(), lv = [1, 0.888, 1, 0], w = cols >= 60 ? 20 : 10;
      say(`top · ${s.gauges.length} gauges · 16 GPUs busy`, 2);
      s.gauges.forEach((g, i) => {
        say((now) => `${g.n.padEnd(8)}${bar(lv[i] * ease(t0 + i * 90, now, 700), w)} ${g.label}`, 0, ' '.repeat(8));
        say(`${' '.repeat(8)}${g.cond}`, 1, ' '.repeat(8));
      });
      set({ loadAt: performance.now() });
      kick(1100);
      break;
    }
    case 'nvidia-smi': {
      const t0 = born(), u = (parseFloat(s.gauges[1].n) * 100).toFixed(1), w = cols >= 60 ? 20 : 8;
      say(`NVIDIA-SMI · tSVDm · ${s.gpus}`, 2, '  ');
      say('GPU  NODE  UTIL', 1);
      for (let i = 0; i < 16; i++) say((now) => `${String(i).padStart(3)}  n${i >> 3}    ${u}%  ${bar(0.888 * ease(t0 + i * 30, now, 500), w)}`);
      say(`util = 16-GPU scaling efficiency (${s.gauges[1].n}).`, 1);
      say('a joke, not a reading.', 1);
      set({ loadAt: performance.now() });
      kick(1100);
      break;
    }
    case 'history': s.history.forEach(([d, l]) => say(`${d}  ${l}`, 0, ' '.repeat(9))); break;
    case 'ssh': ssh(arg); break;
    case 'cd': {
      const d = arg.replace(/\/$/, '');
      if (d === '~/offduty' || (d === 'offduty' && cwd === '~')) { cwd = '~/offduty'; set({ amber: true, view: 'room' }); say('off duty. try: make chai, ride, adda, sleep', 1); }
      else if (!d || d === '~' || d === '..' || d === '/home/nasamajh') { cwd = '~'; set({ amber: false, warm: false, view: 'seat' }); }
      else say(`cd: ${d}: No such directory`, 1);
      break;
    }
    case 'make':
      if (arg !== 'chai') say(arg ? `make: *** No rule to make target '${arg}'.` : 'make: *** No targets. try make chai', 1);
      else if (cwd === '~') say("make: *** No rule to make target 'chai'. (cd ~/offduty first)", 1);
      else { ['boiling water, milk, tea leaves ... ok', 'adding ginger and elaichi ... ok', 'chai ready. steam is on the desk.'].forEach((l, i) => say(l, i === 2 ? 2 : 0)); set({ warm: true, burstAt: performance.now(), view: 'chai' }); }
      break;
    case 'ride': say('pedalling. scroll faster, the wheels follow.', 0); set({ ride: true, view: 'bike' }); break;
    case 'sleep': say('sleeping. any key or scroll wakes the room.', 1); set({ sleep: true, view: 'room' }); break;
    case 'adda': adda(); break;
    case 'sudo':
      if (arg === 'hire tathagata') { say('[sudo] password for recruiter: ********', 1); say('permission granted.', 2); say('pick a channel below.'); contact(); }
      else say('nasamajh is not in the sudoers file. try: sudo hire tathagata', 1);
      break;
    case 'rm': say('nice try. the cluster is still up.', 2); break;
    case 'exit': case 'logout': case 'contact':
      say('logout', 1); say(`GitHub    ${short(s.links.github)}`, 0, '          '); say(`LinkedIn  ${short(s.links.linkedin)}`, 0, '          ');
      say('No email here by design; LinkedIn messages reach me.', 2); contact(); set({ view: 'room' });
      host = 'iisc';
      break;
    case 'echo': say(arg); break;
    case 'clear': lines = []; break;
    default: say(`${name}: command not found. try 'help'`, 1);
  }
}

const live = $('term-log');
export function run(cmd: string, user = false) {
  cmd = cmd.trim();
  if (addaK >= 0 && !cmd) { lines.push({ t: prompt(), st: 3, pl: prompt().length }); adda(true); kick(); return; }
  addaK = -1;
  lines.push({ t: prompt() + cmd, st: 3, pl: prompt().length });
  const from = lines.length;
  if (cmd) {
    set({ view: cwd === '~' ? 'seat' : 'room', graph: false, campus: null, ride: false, adda: '' });
    links([]);
    overlay = null;
    exec(cmd);
    if (user) {
      if (hist[hist.length - 1] !== cmd) hist.push(cmd);
      hi = hist.length;
      const p = document.createElement('p');
      p.textContent = lines.slice(from).map((l) => txt(l, 1e12)).join(' / ') || cmd;
      live.append(p);
      while (live.childElementCount > 4) live.firstElementChild!.remove();
    }
  }
  kick();
}

// ---------- completion ----------
const words = () => [
  'help', 'whoami', 'ls', 'ls projects/', 'top', 'nvidia-smi', 'history', 'ssh iiest', 'ssh iisc', 'cd ~/offduty', 'cd ~', 'make chai', 'ride', 'sleep', 'adda',
  'cat thesis.md', 'cat skills.txt', 'cat ranks.txt', 'cat /etc/motd', 'sudo hire tathagata', 'rm -rf /', 'exit', 'clear', 'pwd',
  ...s.projects.flatMap((p) => [`open ${p.id}`, `cat projects/${p.id}.md`]),
];
let lastTab = 0;
function complete() {
  const v = inp.value, m = words().filter((w) => w.startsWith(v));
  if (!m.length) return;
  let pre = m[0];
  for (const w of m) while (!w.startsWith(pre)) pre = pre.slice(0, -1);
  if (pre.length > v.length) inp.value = pre;
  else if (m.length > 1 && performance.now() - lastTab < 600) { lines.push({ t: prompt() + v, st: 3, pl: prompt().length }); say(m.map((w) => w.slice(w.lastIndexOf(' ') + 1)).join('  '), 1); }
  lastTab = performance.now();
}

// ---------- input ----------
export const inp = $('term-in') as HTMLInputElement;
let paused = false, typer = 0, lastType = 0;
const wake = () => { if (scene.sleep) { set({ sleep: false }); say('woke up. chai?', 1); } };
function touched() { set({ lastInput: performance.now() }); wake(); }

inp.addEventListener('input', () => { paused = true; lastType = performance.now(); typed = inp.value; kick(); });
inp.addEventListener('keydown', (e) => {
  touched(); set({ keyAt: performance.now() }); blink = true;
  if (booting) finishBoot();
  if (e.key === 'Enter') { e.preventDefault(); clearInterval(typer); const v = inp.value; inp.value = ''; typed = ''; paused = true; run(v, true); }
  else if (e.key === 'Tab' && !e.shiftKey && inp.value) { e.preventDefault(); complete(); }
  else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault();
    hi = Math.max(0, Math.min(hist.length, hi + (e.key === 'ArrowUp' ? -1 : 1)));
    inp.value = hist[hi] ?? '';
  } else if (e.key === 'Escape') { inp.blur(); (document.querySelector('.cmds button') as HTMLElement)?.focus(); }
  else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); lines = []; }
  typed = inp.value;
  kick(30);
});
for (const ev of ['keyup', 'select', 'focus', 'blur']) inp.addEventListener(ev, () => { typed = paused ? inp.value : typed; kick(); });

// Command chips: type the command out, then run it.
document.querySelectorAll<HTMLButtonElement>('[data-cmd]').forEach((b) => b.addEventListener('click', () => {
  const cmd = b.dataset.cmd!;
  touched(); paused = true; lastType = performance.now(); clearInterval(typer);
  if (booting) finishBoot();
  if (still()) { run(cmd, true); return; }
  let k = 0;
  typer = window.setInterval(() => {
    inp.value = typed = cmd.slice(0, ++k); kick();
    if (k >= cmd.length) { clearInterval(typer); inp.value = typed = ''; run(cmd, true); }
  }, 26);
}));

// Tap or click on the screen focuses the hidden input (and opens the keyboard on phones).
const stage = $('hero-visual');
let px = 0, py = 0;
stage.addEventListener('pointerdown', (e) => { px = e.clientX; py = e.clientY; touched(); });
stage.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - px, e.clientY - py) < 8 && !(e.target as Element).closest('a, button')) inp.focus({ preventScroll: true });
});
// Typing anywhere on the page (outside links and buttons) goes to the shell.
addEventListener('keydown', (e) => {
  touched();
  const t = e.target as HTMLElement;
  if (t === inp || plain() || t.closest('a, button, input, textarea')) return;
  if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) inp.focus({ preventScroll: true });
});

// ---------- boot ----------
let bootK = 0, bootT: number[] = [];
const BOOT: [string, number][] = [
  [`compiling nasamajh ... ok`, 1], [`mounting ~/projects (${s.projects.length} files) ... ok`, 1], ['16 GPUs online.', 1],
  [`${s.name} · M.Tech CDS, IISc Bangalore`, 2], ["type 'help', or scroll to replay a session.", 0],
];
function boot() {
  booting = true;
  const t0 = performance.now(), dur = still() ? 0 : 1100, N = cols >= 60 ? 30 : 20;
  say('SYS.LINK uplink · nasamajh shell v3', 1);
  say((now) => { const k = bootK || Math.min(1, Math.max(0, (now - t0) / (dur || 1))); const n = Math.round(k * N); return `[${'|'.repeat(n)}${' '.repeat(N - n)}] ${String(Math.round(k * 100)).padStart(3)}%`; }, 2);
  kick(dur);
  BOOT.forEach((l, i) => bootT.push(window.setTimeout(() => { say(...l); kick(); }, dur * 0.55 + i * 110)));
  bootT.push(window.setTimeout(finishBoot, dur * 0.55 + BOOT.length * 110));
}
function finishBoot() {
  if (!booting) return;
  bootT.forEach(clearTimeout);
  const n = lines.length - 2; // lines pushed so far after the two header lines
  BOOT.slice(n).forEach((l) => say(...l));
  bootK = 1; booting = false; kick();
}

// ---------- scroll replay ----------
const SESSION = ['whoami', 'top', 'ls projects/', 'open hydra', 'ssh iiest', 'ssh iisc', 'cat thesis.md', 'cd ~/offduty', 'make chai', 'ride', 'adda', 'exit'];
let done = 0, partial = '';
function reset() { lines = []; cwd = '~'; host = 'iisc'; set({ amber: false, warm: false, sleep: false }); links([]); overlay = null; }
function replay(p: number) {
  if (plain() || paused) return;
  if (booting) finishBoot();
  const n = SESSION.length, x = Math.min(p, 0.99999) * n, i = Math.floor(x), fr = x - i, target = i + (fr >= 0.45 ? 1 : 0);
  if (target < done) { reset(); quiet = true; SESSION.slice(0, target).forEach((c) => run(c)); quiet = false; done = target; }
  while (done < target) run(SESSION[done++]);
  partial = target === i && i < n && p > 0 ? SESSION[i].slice(0, Math.ceil((fr / 0.45) * SESSION[i].length)) : '';
  typed = partial;
  kick();
}
addEventListener('scroll', () => { if (paused && performance.now() - lastType > 400 && !plain()) { paused = false; inp.value = ''; wake(); touched(); } }, { passive: true });

// ---------- start ----------
export const term = {
  canvas,
  // The 3D room calls this: the canvas then draws at a fixed texture size, without the 2D glow.
  texture(on: boolean) { tex = on; glow = !on; fit(); },
  aspect: () => canvas.width / canvas.height,
};

fit();
addEventListener('resize', () => fit());
boot();
if (!still()) setInterval(() => { if (!document.hidden) { blink = !blink; kick(); } }, 530);
// Idle: after a minute without input the room falls asleep, as you do.
setInterval(() => { if (!plain() && !still() && !scene.sleep && performance.now() - scene.lastInput > 60000) { set({ sleep: true }); say('(idle) the room fell asleep. any key wakes it.', 1); kick(); } }, 5000);

// The replay: GSAP ScrollTrigger scrubs a progress value over the tall #track, after first paint and idle.
painted().then(() => {
  if (plain()) return;
  return Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([g, st]) => {
    const { gsap } = g, { ScrollTrigger } = st;
    gsap.registerPlugin(ScrollTrigger);
    const o = { p: 0 };
    gsap.to(o, {
      p: 1, ease: 'none', onUpdate: () => replay(o.p),
      scrollTrigger: { trigger: '#track', start: 'top top', end: 'bottom bottom', scrub: 0.4, onUpdate: (e: any) => set({ vel: e.getVelocity() }) },
    });
  });
});

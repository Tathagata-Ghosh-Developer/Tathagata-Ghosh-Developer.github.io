// The one scene store. The terminal writes it; the 3D room (when it runs) reads it every frame.
// Plain state, no subscriptions: one-shot effects are timestamps (performance.now()).
export type View = 'seat' | 'desk' | 'campus' | 'room' | 'chai' | 'bike';

export const scene = {
  view: 'seat' as View,
  campus: null as null | 'iiest' | 'iisc', // the voxel campus the CRT is dreaming of
  graph: false, // HYDRA's voxel graph on the desk
  amber: false, // ~/offduty: warm terminal
  warm: false, // `make chai`: lights warm up
  ride: false, // `ride`: camera at the bicycle
  sleep: false,
  adda: '', // the current adda bubble text
  addaAt: 0,
  burstAt: 0, // steam burst
  loadAt: 0, // `top`: the LED pulses with "load"
  keyAt: 0, // phosphor flicker on keypress
  hopAt: 0, // ssh: the map hop starts
  dragAt: 0, // dragging on the screen: the campus voxels wobble
  routeAt: 0, // a click with the HYDRA graph out: pick a new shortest path
  vel: 0, // scroll velocity (px/s), for the bicycle wheels
  lastInput: 0, // for the moon and the idle sleep
  tex: 0, // bumped whenever the terminal canvas changes (CanvasTexture upload)
};

export const set = (patch: Partial<typeof scene>) => Object.assign(scene, patch);

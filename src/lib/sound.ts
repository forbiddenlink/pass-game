/**
 * PASS sound — a tiny WebAudio synth. No assets, no deps. All diegetic to the
 * 1952 room: a low drone that detunes as the light fails, a key tick, a soft
 * chime when a line resolves, a verdict sting, and the switch-off.
 *
 * Lazily created on the first user gesture (autoplay policy). Every method is a
 * no-op until init() and while muted, so callers never need to guard.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let drone: { osc: OscillatorNode[]; gain: GainNode } | null = null;
let muted = false;

function now() {
  return ctx ? ctx.currentTime : 0;
}

export const sound = {
  init() {
    if (ctx || typeof window === 'undefined') return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  },

  get muted() {
    return muted;
  },
  toggleMute() {
    muted = !muted;
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, now(), 0.05);
    return muted;
  },
  /** Restore a persisted mute preference; safe to call before init(). */
  setMuted(m: boolean) {
    muted = m;
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, now(), 0.05);
  },

  /** Ambient drone; call once, then ambient(ratio) to bend it as light fails. */
  startDrone() {
    if (!ctx || !master || drone) return;
    const gain = ctx.createGain();
    gain.gain.value = 0.06;
    const a = ctx.createOscillator();
    a.type = 'sine';
    a.frequency.value = 55;
    const b = ctx.createOscillator();
    b.type = 'sine';
    b.frequency.value = 55.4; // slow beat
    a.connect(gain);
    b.connect(gain);
    gain.connect(master);
    a.start();
    b.start();
    drone = { osc: [a, b], gain };
  },
  ambient(ratio: number) {
    if (!ctx || !drone) return;
    const r = Math.max(0, Math.min(1, ratio));
    // as light fails, the drone sinks and the two voices drift further apart (unease)
    drone.osc[0].frequency.setTargetAtTime(44 + r * 14, now(), 0.4);
    drone.osc[1].frequency.setTargetAtTime(44 + r * 14 + (1 - r) * 3 + 0.4, now(), 0.4);
    drone.gain.gain.setTargetAtTime(0.05 + (1 - r) * 0.05, now(), 0.4);
  },

  tick() {
    blip(1400, 0.02, 0.05, 'square');
  },
  clock() {
    blip(1700, 0.003, 0.022, 'sine'); // a faint, dry tick — the night moving
  },
  key() {
    blip(900, 0.015, 0.04, 'square');
  },
  resolved() {
    // soft rising third — a line snaps into sense
    chime([523.25, 659.25], 0.4);
  },
  verdict(good: boolean) {
    if (good) chime([587.33, 880], 0.5);
    else chord([146.83, 155.56], 0.6); // minor-second dread
  },
  /** The stamp coming down: a low, punchy impact under the verdict. */
  thud() {
    if (!ctx || !master) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(165, now());
    o.frequency.exponentialRampToValueAtTime(46, now() + 0.18);
    g.gain.setValueAtTime(0.0001, now());
    g.gain.linearRampToValueAtTime(0.42, now() + 0.008); // near-instant attack = the slam
    g.gain.exponentialRampToValueAtTime(0.0001, now() + 0.34);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(now() + 0.36);
  },
  /** The hard one takes the chair: a gritty downward scrape of wood on floor. */
  chairScrape() {
    if (!ctx || !master) return;
    const o = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(240, now());
    o.frequency.exponentialRampToValueAtTime(68, now() + 0.4);
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(820, now());
    lp.frequency.exponentialRampToValueAtTime(180, now() + 0.4);
    g.gain.setValueAtTime(0.0001, now());
    g.gain.linearRampToValueAtTime(0.13, now() + 0.03);
    g.gain.linearRampToValueAtTime(0.1, now() + 0.28);
    g.gain.exponentialRampToValueAtTime(0.0001, now() + 0.45);
    o.connect(lp);
    lp.connect(g);
    g.connect(master);
    o.start();
    o.stop(now() + 0.47);
  },
  switchOff() {
    blip(120, 0.06, 0.25, 'sawtooth');
    if (drone && ctx) {
      drone.gain.gain.setTargetAtTime(0, now(), 0.15);
    }
  },
};

function blip(freq: number, attack: number, dur: number, type: OscillatorType) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, now());
  g.gain.linearRampToValueAtTime(0.18, now() + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now() + dur);
  o.connect(g);
  g.connect(master);
  o.start();
  o.stop(now() + dur + 0.02);
}

function chime(freqs: number[], dur: number) {
  freqs.forEach((f, i) => window.setTimeout(() => blip(f, 0.01, dur, 'triangle'), i * 80));
}
function chord(freqs: number[], dur: number) {
  freqs.forEach((f) => blip(f, 0.02, dur, 'sine'));
}

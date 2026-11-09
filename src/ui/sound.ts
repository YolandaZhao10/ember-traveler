/** 用 WebAudio 合成的轻量音效，无需外部资源。 */
export type SfxName = 'click' | 'play' | 'swing' | 'hit' | 'block' | 'draw' | 'ember' | 'death' | 'win' | 'lose' | 'heal' | 'gold' | 'intent';

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(v: boolean) {
  enabled = v;
}

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.08, slide = 0, delay = 0) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  const t = c.currentTime + delay;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, gain = 0.06, delay = 0) {
  const c = ac();
  if (!c) return;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = gain;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  src.connect(f).connect(g).connect(c.destination);
  src.start(c.currentTime + delay);
}

export function sfx(name: SfxName) {
  if (!enabled) return;
  switch (name) {
    case 'click':
      tone(520, 0.05, 'triangle', 0.04);
      break;
    case 'play':
      tone(330, 0.09, 'triangle', 0.06, 180);
      break;
    case 'hit':
      noise(0.14, 0.11);
      tone(140, 0.12, 'sawtooth', 0.05, -80);
      tone(85, 0.16, 'sine', 0.1, -45);
      break;
    case 'swing':
      noise(0.12, 0.045);
      tone(460, 0.12, 'triangle', 0.035, -340);
      break;
    case 'block':
      tone(260, 0.12, 'square', 0.03);
      tone(390, 0.1, 'triangle', 0.04, 0, 0.03);
      break;
    case 'draw':
      tone(700, 0.04, 'sine', 0.03, 200);
      break;
    case 'ember':
      tone(880, 0.12, 'sine', 0.04, 260);
      noise(0.08, 0.02);
      break;
    case 'death':
      noise(0.3, 0.08);
      tone(120, 0.35, 'sawtooth', 0.05, -90);
      break;
    case 'win':
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.06, 0, i * 0.11));
      break;
    case 'lose':
      [330, 262, 196].forEach((f, i) => tone(f, 0.4, 'sawtooth', 0.04, -20, i * 0.25));
      break;
    case 'heal':
      [440, 660].forEach((f, i) => tone(f, 0.18, 'sine', 0.05, 0, i * 0.08));
      break;
    case 'gold':
      tone(1200, 0.08, 'square', 0.03);
      tone(1600, 0.1, 'square', 0.03, 0, 0.06);
      break;
    case 'intent':
      tone(220, 0.1, 'triangle', 0.03, -40);
      break;
  }
}

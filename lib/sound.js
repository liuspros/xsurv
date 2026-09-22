import { tryLoadAudioBuffer } from "./assets";

// Real files, if present, go in /public/sounds with these exact names.
// Any missing file silently falls back to a synthesized placeholder sound,
// so the game always works even before you add real audio.
const SOUND_FILES = {
  shot: "/sounds/gunshot.mp3",
  reload: "/sounds/reload.mp3",
  hit: "/sounds/hit.mp3",
  kill: "/sounds/kill.mp3",
  damage: "/sounds/damage.mp3",
  empty: "/sounds/empty.mp3",
};

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.ready = false;
  }

  ensureContext() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  async load() {
    const ctx = this.ensureContext();
    const entries = Object.entries(SOUND_FILES);
    const results = await Promise.all(
      entries.map(([, url]) => tryLoadAudioBuffer(ctx, url))
    );
    entries.forEach(([key], i) => {
      this.buffers[key] = results[i]; // null if not supplied yet
    });
    this.ready = true;
  }

  playBuffer(key, volume) {
    const ctx = this.ensureContext();
    const buf = this.buffers[key];
    if (!buf) return false;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = volume != null ? volume : 1;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    return true;
  }

  playClick(freq, dur, type) {
    const c = this.ensureContext();
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, t);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(t); osc.stop(t + dur);
  }

  shot() {
    if (this.playBuffer("shot", 0.9)) return;
    const c = this.ensureContext();
    const t = c.currentTime;

    const crack = c.createBuffer(1, c.sampleRate * 0.09, c.sampleRate);
    const cd = crack.getChannelData(0);
    for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / cd.length, 1.5);
    const crackSrc = c.createBufferSource(); crackSrc.buffer = crack;
    const crackFilt = c.createBiquadFilter(); crackFilt.type = "highpass"; crackFilt.frequency.setValueAtTime(900, t);
    const crackGain = c.createGain(); crackGain.gain.setValueAtTime(0.55, t); crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    crackSrc.connect(crackFilt); crackFilt.connect(crackGain); crackGain.connect(c.destination);
    crackSrc.start(t); crackSrc.stop(t + 0.1);

    const thump = c.createOscillator(); thump.type = "sine";
    thump.frequency.setValueAtTime(140, t); thump.frequency.exponentialRampToValueAtTime(45, t + 0.09);
    const thumpGain = c.createGain(); thumpGain.gain.setValueAtTime(0.6, t); thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    thump.connect(thumpGain); thumpGain.connect(c.destination);
    thump.start(t); thump.stop(t + 0.11);

    const tail = c.createBuffer(1, c.sampleRate * 0.22, c.sampleRate);
    const td = tail.getChannelData(0);
    for (let j = 0; j < td.length; j++) td[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / td.length, 3);
    const tailSrc = c.createBufferSource(); tailSrc.buffer = tail;
    const tailFilt = c.createBiquadFilter(); tailFilt.type = "lowpass"; tailFilt.frequency.setValueAtTime(1400, t);
    const tailGain = c.createGain(); tailGain.gain.setValueAtTime(0.12, t + 0.02); tailGain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    tailSrc.connect(tailFilt); tailFilt.connect(tailGain); tailGain.connect(c.destination);
    tailSrc.start(t + 0.02); tailSrc.stop(t + 0.25);
  }

  reload() {
    if (this.playBuffer("reload", 0.8)) return;
    this.playClick(220, 0.05, "square");
    setTimeout(() => this.playClick(320, 0.05, "square"), 450);
  }

  hit() {
    if (this.playBuffer("hit", 0.8)) return;
    this.playClick(140, 0.08, "triangle");
  }

  kill() {
    if (this.playBuffer("kill", 0.8)) return;
    const c = this.ensureContext();
    const t = c.currentTime;
    const osc = c.createOscillator(); osc.type = "sawtooth";
    osc.frequency.setValueAtTime(500, t); osc.frequency.exponentialRampToValueAtTime(80, t + 0.25);
    const gain = c.createGain(); gain.gain.setValueAtTime(0.22, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(t); osc.stop(t + 0.3);
  }

  damage() {
    if (this.playBuffer("damage", 0.8)) return;
    this.playClick(90, 0.15, "sawtooth");
  }

  empty() {
    if (this.playBuffer("empty", 0.7)) return;
    this.playClick(500, 0.03, "square");
  }
}

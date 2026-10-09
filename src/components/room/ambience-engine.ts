import { TRACKS, SFX, type SynthSpec } from "@/lib/ambience-tracks";

const FADE = 2; // seconds of crossfade

type Voice = { gain: GainNode; stop: () => void; timer?: ReturnType<typeof setTimeout> };

/** Browser-only audio engine: one music bus with crossfaded voices + one effects bus. */
export class AmbienceEngine {
  ctx: AudioContext;
  music: GainNode;
  fx: GainNode;
  current: { key: string; voice: Voice } | null = null;
  private noiseBuf: AudioBuffer;

  constructor() {
    const C = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new C();
    this.music = this.ctx.createGain();
    this.fx = this.ctx.createGain();
    this.music.connect(this.ctx.destination);
    this.fx.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const ch = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  }

  get unlocked() { return this.ctx.state === "running"; }
  unlock() { return this.ctx.resume(); }

  setLevels(music: number, fx: number) {
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(music, t, 0.1);
    this.fx.gain.setTargetAtTime(fx, t, 0.05);
  }

  /** Crossfade to `key` (or to silence). `loop=false` fades the track out after 30 s. */
  play(key: string, loop: boolean) {
    if (this.current?.key === key) return;
    this.fadeOutCurrent();
    const def = TRACKS.find((t) => t.key === key);
    if (!def || (!def.url && !def.synth)) return;
    const voice = def.url ? this.fileVoice(def.url, loop) : this.synthVoice(def.synth!);
    const t = this.ctx.currentTime;
    voice.gain.gain.setValueAtTime(0, t);
    voice.gain.gain.linearRampToValueAtTime(1, t + FADE);
    if (!loop) voice.timer = setTimeout(() => { if (this.current?.voice === voice) this.stop(); }, 30_000);
    this.current = { key, voice };
  }
  stop() { this.fadeOutCurrent(); }

  private fadeOutCurrent() {
    const cur = this.current;
    if (!cur) return;
    this.current = null;
    clearTimeout(cur.voice.timer);
    const t = this.ctx.currentTime;
    cur.voice.gain.gain.cancelScheduledValues(t);
    cur.voice.gain.gain.setValueAtTime(cur.voice.gain.gain.value, t);
    cur.voice.gain.gain.linearRampToValueAtTime(0, t + FADE);
    setTimeout(() => cur.voice.stop(), FADE * 1000 + 100);
  }

  private fileVoice(url: string, loop: boolean): Voice {
    const el = new Audio(url);
    el.crossOrigin = "anonymous";
    el.loop = loop;
    const src = this.ctx.createMediaElementSource(el);
    const gain = this.ctx.createGain();
    src.connect(gain).connect(this.music);
    el.play().catch(() => undefined);
    return { gain, stop: () => { el.pause(); gain.disconnect(); } };
  }

  private synthVoice(s: SynthSpec): Voice {
    const c = this.ctx;
    const gain = c.createGain();
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = s.cutoff;
    filter.connect(gain).connect(this.music);
    const nodes: AudioScheduledSourceNode[] = [];
    for (const f of s.freqs) {
      const o = c.createOscillator();
      o.type = s.wave; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 12;
      const g = c.createGain(); g.gain.value = 0.18 / s.freqs.length;
      o.connect(g).connect(filter); o.start(); nodes.push(o);
    }
    if (s.noise > 0) {
      const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
      const g = c.createGain(); g.gain.value = s.noise * 0.15;
      n.connect(g).connect(filter); n.start(); nodes.push(n);
    }
    const lfo = c.createOscillator(); lfo.frequency.value = s.lfo;
    const lg = c.createGain(); lg.gain.value = s.cutoff * 0.4;
    lfo.connect(lg).connect(filter.frequency); lfo.start(); nodes.push(lfo);
    if (s.pulse) {
      const p = c.createOscillator(); p.type = "square"; p.frequency.value = s.pulse.freq;
      const gate = c.createGain(); gate.gain.value = 0;
      const pl = c.createOscillator(); pl.type = "square"; pl.frequency.value = s.pulse.rate;
      const pg = c.createGain(); pg.gain.value = 0.04;
      pl.connect(pg).connect(gate.gain);
      p.connect(gate).connect(gain); p.start(); pl.start(); nodes.push(p, pl);
    }
    return { gain, stop: () => { nodes.forEach((n) => { try { n.stop(); } catch { /* noop */ } }); gain.disconnect(); } };
  }

  sfx(key: string) {
    const def = SFX.find((s) => s.key === key);
    if (def?.url) { const a = new Audio(def.url); const src = this.ctx.createMediaElementSource(a); src.connect(this.fx); a.play().catch(() => undefined); return; }
    const c = this.ctx, t = c.currentTime;
    const env = c.createGain(); env.connect(this.fx);
    const osc = (type: OscillatorType, f0: number, f1: number, dur: number, start = 0) => {
      const o = c.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0, t + start); o.frequency.exponentialRampToValueAtTime(f1, t + start + dur);
      o.connect(env); o.start(t + start); o.stop(t + start + dur);
    };
    const noise = (dur: number, cutoff: number) => {
      const n = c.createBufferSource(); n.buffer = this.noiseBuf;
      const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(cutoff, t); f.frequency.exponentialRampToValueAtTime(60, t + dur);
      n.connect(f).connect(env); n.start(t); n.stop(t + dur);
    };
    const shape = (peak: number, dur: number) => { env.gain.setValueAtTime(peak, t); env.gain.exponentialRampToValueAtTime(0.001, t + dur); };
    switch (key) {
      case "porte": shape(0.5, 1.2); noise(1.2, 900); osc("sawtooth", 90, 50, 1.1); break;
      case "alarme": env.gain.value = 0.15; for (let i = 0; i < 4; i++) osc("square", i % 2 ? 660 : 880, i % 2 ? 660 : 880, 0.25, i * 0.25); setTimeout(() => env.disconnect(), 1200); break;
      case "laser": shape(0.3, 0.35); osc("sawtooth", 1800, 120, 0.3); break;
      case "explosion": shape(0.9, 1.8); noise(1.8, 2500); osc("sine", 80, 30, 1.2); break;
      case "coffre": shape(0.3, 0.9); noise(0.08, 3000); osc("triangle", 784, 784, 0.25, 0.1); osc("triangle", 1175, 1175, 0.4, 0.25); break;
    }
  }

  dispose() { this.stop(); setTimeout(() => this.ctx.close().catch(() => undefined), FADE * 1000 + 200); }
}

/**
 * Ambience catalogue. Each track/effect can point to a real audio file (`url`, e.g. a public
 * Lovable Cloud storage URL, .mp3/.ogg). While `url` is null, a procedural Web Audio
 * placeholder is played instead — never a broken player.
 */
export type SynthSpec = {
  freqs: number[]; // drone partials (Hz)
  wave: OscillatorType;
  noise: number; // 0..1 filtered noise level
  cutoff: number; // low-pass Hz
  lfo: number; // tremolo/filter speed (Hz)
  pulse?: { freq: number; rate: number }; // gated beeps (alarm, combat drums)
};
export type TrackDef = { key: string; label: string; url: string | null; source: string; synth: SynthSpec | null };

const PLACEHOLDER = "Boucle procédurale générée en direct (Web Audio) pour Bastion — libre de droits (CC0).";

export const TRACKS: TrackDef[] = [
  { key: "silence", label: "Silence", url: null, source: "—", synth: null },
  { key: "forteresse", label: "Forteresse vide", url: null, source: PLACEHOLDER, synth: { freqs: [55, 82.4], wave: "sine", noise: 0.25, cutoff: 400, lfo: 0.07 } },
  { key: "alerte", label: "Alerte rouge", url: null, source: PLACEHOLDER, synth: { freqs: [73.4], wave: "sawtooth", noise: 0.05, cutoff: 600, lfo: 0.5, pulse: { freq: 880, rate: 1.2 } } },
  { key: "couloirs", label: "Couloirs industriels", url: null, source: PLACEHOLDER, synth: { freqs: [41.2, 61.7], wave: "square", noise: 0.4, cutoff: 300, lfo: 0.25, pulse: { freq: 110, rate: 0.8 } } },
  { key: "laboratoire", label: "Laboratoire abandonné", url: null, source: PLACEHOLDER, synth: { freqs: [220, 277, 330], wave: "triangle", noise: 0.1, cutoff: 1200, lfo: 0.13 } },
  { key: "combat", label: "Combat", url: null, source: PLACEHOLDER, synth: { freqs: [65.4, 98], wave: "sawtooth", noise: 0.15, cutoff: 900, lfo: 2, pulse: { freq: 60, rate: 4 } } },
  { key: "boss", label: "Boss", url: null, source: PLACEHOLDER, synth: { freqs: [36.7, 55, 77.8], wave: "sawtooth", noise: 0.3, cutoff: 700, lfo: 1, pulse: { freq: 45, rate: 2 } } },
  { key: "victoire", label: "Victoire", url: null, source: PLACEHOLDER, synth: { freqs: [261.6, 329.6, 392], wave: "triangle", noise: 0, cutoff: 3000, lfo: 0.5 } },
  { key: "defaite", label: "Défaite", url: null, source: PLACEHOLDER, synth: { freqs: [110, 130.8, 155.6], wave: "sine", noise: 0.1, cutoff: 800, lfo: 0.1 } },
];
export const TRACK_KEYS = TRACKS.map((t) => t.key) as [string, ...string[]];

export const SFX = [
  { key: "porte", label: "Porte", url: null as string | null },
  { key: "alarme", label: "Alarme", url: null as string | null },
  { key: "laser", label: "Tir laser", url: null as string | null },
  { key: "explosion", label: "Explosion", url: null as string | null },
  { key: "coffre", label: "Coffre", url: null as string | null },
] as const;
export const SFX_KEYS = SFX.map((s) => s.key) as unknown as [string, ...string[]];

export function trackLabel(key: string) {
  return TRACKS.find((t) => t.key === key)?.label ?? key;
}

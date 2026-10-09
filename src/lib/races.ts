export const RACES = {
  Humain: { speed: 70, strength: 70, endurance: 70 },
  Insecte: { speed: 95, strength: 55, endurance: 40 },
  Reptile: { speed: 35, strength: 65, endurance: 90 },
  "Crustacé": { speed: 20, strength: 75, endurance: 100 },
  Oiseau: { speed: 100, strength: 60, endurance: 35 },
} as const;

export type RaceName = keyof typeof RACES;
export const RACE_NAMES = Object.keys(RACES) as RaceName[];

export function hpFor(race: RaceName) {
  return 10 + Math.round(RACES[race].endurance / 10);
}

export const SCENARIOS = [
  { key: "tresor", label: "Défendre le trésor" },
  { key: "survie", label: "Survivre jusqu'à l'aube" },
  { key: "quete", label: "Quête du relais perdu" },
] as const;

export function scenarioLabel(key: string) {
  return SCENARIOS.find((s) => s.key === key)?.label ?? key;
}

export const STATUS_LABEL: Record<string, string> = {
  waiting: "En attente",
  playing: "En cours",
  finished: "Terminé",
};

export const ROLE_LABEL: Record<string, string> = {
  narrator: "Narrateur",
  adventurer: "Aventurier",
};

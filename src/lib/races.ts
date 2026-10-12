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
  return key === "a-definir" ? "Scénario à définir" : SCENARIOS.find((s) => s.key === key)?.label ?? key;
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

/** Zones of the parcours, shared by every scenario. `door` zones expose "Ouvrir la porte". */
export const ZONES = [
  { key: "entree", label: "Entrée du Bastion", door: false },
  { key: "couloir-a", label: "Couloir A", door: false },
  { key: "salle-machines", label: "Salle des machines", door: false },
  { key: "porte-scellee", label: "Porte scellée", door: true },
  { key: "laboratoire", label: "Laboratoire abandonné", door: true },
  { key: "coeur", label: "Cœur du Bastion", door: false },
] as const;
export const ZONE_KEYS = ZONES.map((z) => z.key) as [string, ...string[]];
export function zoneLabel(key: string | null | undefined) {
  return ZONES.find((z) => z.key === key)?.label ?? key ?? "—";
}

export const TRIGGER_LABEL: Record<string, string> = { entree: "À l'entrée dans la zone", porte: "À l'ouverture d'une porte", manuel: "Manuel" };
export const ENEMY_STATUS_LABEL: Record<string, string> = { cache: "Caché", revele: "Révélé", vaincu: "Vaincu" };
export const THREAT_PER_PLAYER = 3;
/** Treasure type → inventory category. */
export function inventoryCategory(type: string): "arme" | "consommable" | "cle" {
  if (type === "arme" || type === "equipement") return "arme";
  if (type === "consommable") return "consommable";
  return "cle";
}

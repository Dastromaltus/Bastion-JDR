import { PREBUILT_MAPS } from "./map-grid";
import type { ScenarioStep } from "./scenario-steps";

// Authored placements reference stable, shared catalogue rows, never salon-private content.
const zombie = "d25f0e90-6a3f-4e89-84ac-aecc51b9aa6f";
const drone = "3723db85-427d-492f-b281-a479464ece8c";
const mutant = "85bd7306-38bc-4dc4-a5ff-79b4daa0f0f9";
const sentry = "f5eda2e5-af73-4a4b-85be-5c5795dbd862";
const boss = "5c93b20e-8327-40dd-a149-0db456c4d5c0";
const heal = "e7eef20b-d39f-40a8-b92d-c18ebb7a52b8";
const energy = "55b30cd4-ddba-41d1-b50e-db40e13f86f8";
const reward = "61e43a6d-6056-479b-8c48-49eb42f94e04";
const core = "200ac194-02cd-4529-9a47-52c3c03bea9a";
const at = (catalogId: string, x: number, y: number) => ({ catalogId, x, y });

export const READY_CONTENT = {
  "le-sas": { difficulty: "Initiation", summary: "Un poste d'entrée occupé par des zombies et une patrouille mécanique.", objective: "Atteindre le dépôt et récupérer la caisse de récompense.", enemies: [at(zombie, 17, 19), at(zombie, 29, 12), at(drone, 31, 28)], treasures: [at(heal, 9, 22), at(energy, 34, 14), at(reward, 33, 32)], track: "forteresse", intro: "Le sas grince derrière vous. Deux silhouettes errent dans les couloirs ; le dépôt au sud-est abrite encore des provisions." },
  "salle-des-machines": { difficulty: "Intermédiaire", summary: "Des ateliers reliés par des coursives, entre caisses et circuits de refroidissement.", objective: "Neutraliser la sentinelle et récupérer la réserve d'énergie.", enemies: [at(drone, 22, 5), at(drone, 30, 7), at(zombie, 10, 28), at(sentry, 27, 33)], treasures: [at(heal, 11, 8), at(energy, 31, 19), at(reward, 32, 34)], track: "couloirs", intro: "Les machines vibrent encore. Des drones balayent les passerelles et une sentinelle garde la réserve au sud." },
  "le-reliquaire": { difficulty: "Intermédiaire", summary: "Des archives moussues et des bassins abandonnés, envahis par les mutants.", objective: "Traverser les archives et récupérer la relique dans le jardin inférieur.", enemies: [at(zombie, 8, 16), at(mutant, 20, 20), at(mutant, 30, 20), at(zombie, 18, 33)], treasures: [at(heal, 11, 21), at(energy, 34, 13), at(reward, 23, 35)], track: "laboratoire", intro: "La mousse recouvre les archives. Quelque chose remue derrière les bassins ; un coffre scintille au fond du jardin." },
  "coeur-du-bastion": { difficulty: "Difficile", summary: "Une ascension vers la grande salle du Mécha-colosse, entre deux postes de garde.", objective: "Vaincre le Mécha-colosse et récupérer le Noyau du Bastion.", enemies: [at(sentry, 8, 19), at(sentry, 31, 19), at(drone, 17, 12), at(boss, 20, 8)], treasures: [at(heal, 18, 27), at(energy, 32, 21), at(core, 20, 4)], track: "boss", intro: "Au sommet des coursives, le Mécha-colosse s'éveille. Le Noyau brille derrière lui. Les postes de garde surveillent les deux flancs." },
} satisfies Record<string, { difficulty: string; summary: string; objective: string; enemies: { catalogId: string; x: number; y: number }[]; treasures: { catalogId: string; x: number; y: number }[]; track: string; intro: string }>;

export function readyMapStep(key: string): ScenarioStep {
  const map = PREBUILT_MAPS[key];
  const content = READY_CONTENT[key as keyof typeof READY_CONTENT];
  if (!map || !content) throw new Error("Carte prête à jouer introuvable.");
  return structuredClone({ ...map, source: `prebuilt:${key}`, enemies: content.enemies, treasures: content.treasures, track: content.track, intro: content.intro });
}
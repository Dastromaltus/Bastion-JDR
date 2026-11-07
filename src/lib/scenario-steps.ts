/** Browser- and server-safe helpers for the GM scenario builder (ordered steps = maps). */
import { cellWalkable, GRID, paintBrush, type GridMap } from "./map-grid";

export const MAX_STEPS = 12;
export const MAX_MOBS = 60;
export type StepMob = { catalogId: string; x: number; y: number };
export type ScenarioStep = GridMap & { source: string; enemies: StepMob[]; treasures?: StepMob[]; track: string | null; intro: string };

export function moveStep<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const n = [...list];
  const a = n[i], b = n[j];
  if (a === undefined || b === undefined) return list;
  [n[i], n[j]] = [b, a];
  return n;
}

/** Place a mob, or move mob `index` to (x, y). Returns an error string when refused. */
export function putMob(step: ScenarioStep, x: number, y: number, catalogId: string | null, index?: number): ScenarioStep | string {
  if (x < 0 || y < 0 || x >= GRID || y >= GRID) return "Case hors de la grille 160 × 160.";
  if (!cellWalkable(step, x, y)) return "Un mob ne peut pas être posé sur un mur ou une barrière.";
  if (step.enemies.some((e, i) => i !== index && e.x === x && e.y === y)) return "Un mob occupe déjà cette case.";
  if (index !== undefined) return { ...step, enemies: step.enemies.map((e, i) => (i === index ? { ...e, x, y } : e)) };
  if (!catalogId) return "Choisis d'abord un mob dans la liste.";
  if (step.enemies.length >= MAX_MOBS) return `${MAX_MOBS} mobs maximum par étape.`;
  return { ...step, enemies: [...step.enemies, { catalogId, x, y }] };
}

/** Repainting tiles drops mobs that would end up inside a wall. `keep` cells (the spawn) are never overwritten. */
export function paintTile(step: ScenarioStep, x: number, y: number, code: number, size = 1, keep?: { x: number; y: number }[]): ScenarioStep {
  const tiles = paintBrush(step.tiles, x, y, code, size, keep);
  const next = { ...step, tiles };
  return { ...next, enemies: next.enemies.filter((e) => cellWalkable(next, e.x, e.y)), treasures: (next.treasures ?? []).filter((e) => cellWalkable(next, e.x, e.y)) };
}

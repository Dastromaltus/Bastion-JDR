import { cellWalkable, GRID, type GridMap } from "./map-grid";

export type MapPassage = { x: number; y: number };
export function passageError(map: GridMap, passage?: MapPassage | null): string | null {
  if (!passage) return null;
  if (![passage.x, passage.y].every((v) => Number.isInteger(v) && v >= 0 && v < GRID)) return "Point de passage hors de la carte.";
  if (!cellWalkable(map, passage.x, passage.y)) return "Le point de passage doit être sur une case praticable.";
  return null;
}
export function onPassage(position: MapPassage, passage?: MapPassage | null): boolean {
  return !!passage && position.x === passage.x && position.y === passage.y;
}
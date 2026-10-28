import { cellWalkable, GRID, type GridMap } from "./map-grid";

export type MapEnemyPlacement = { catalogId: string; x: number; y: number };

/** Enemy overlays never change the underlying 40×40 terrain. */
export function placeMapEnemy<T extends GridMap & { enemies?: MapEnemyPlacement[] }>(map: T, enemy: MapEnemyPlacement): T | string {
  if (!Number.isInteger(enemy.x) || !Number.isInteger(enemy.y) || enemy.x < 0 || enemy.y < 0 || enemy.x >= GRID || enemy.y >= GRID) return "Case hors de la grille 40 × 40.";
  if (!cellWalkable(map, enemy.x, enemy.y)) return "Un ennemi ne peut pas être posé sur un mur ou une barrière.";
  if (!enemy.catalogId) return "Choisis d'abord un ennemi dans la liste.";
  const enemies = map.enemies ?? [];
  const existing = enemies.findIndex((e) => e.x === enemy.x && e.y === enemy.y);
  if (existing < 0 && enemies.length >= 60) return "60 ennemis maximum par carte.";
  return { ...map, enemies: existing < 0 ? [...enemies, enemy] : enemies.map((e, i) => i === existing ? enemy : e) };
}

export function blockedMapEnemies(map: GridMap & { enemies?: MapEnemyPlacement[] }) {
  return (map.enemies ?? []).filter((e) => !Number.isInteger(e.x) || !Number.isInteger(e.y) || !cellWalkable(map, e.x, e.y));
}
/** Shared 40×40 tile grid used by every salon map (browser- and server-safe). */
export const GRID = 40;
export const CELLS = GRID * GRID;

/** Tile codes 1..10 match frames 0..9 of src/assets/map-sprites.png. 0 = vide (infranchissable). */
export const SPRITES = [
  { code: 1, label: "Eau", walk: false },
  { code: 2, label: "Caisses", walk: false },
  { code: 3, label: "Pavés", walk: true },
  { code: 4, label: "Pierre moussue", walk: true },
  { code: 5, label: "Dalle fissurée", walk: true },
  { code: 6, label: "Dalle claire", walk: true },
  { code: 7, label: "Mur de briques", walk: false },
  { code: 8, label: "Mur moussu", walk: false },
  { code: 9, label: "Gouffre", walk: false },
  { code: 10, label: "Herbe sombre", walk: true },
] as const;
const WALK = new Set<number>(SPRITES.filter((s) => s.walk).map((s) => s.code));
// Codes 11–20 keep the original texture (1–10) but always block movement.
export const MAX_TILE_CODE = 20;
export const barrierTile = (texture: number) => texture >= 1 && texture <= 10 ? texture + 10 : 0;
export const tileTexture = (code: number) => code > 10 ? code - 10 : code;
export const tileWalkable = (t: number | undefined) => t !== undefined && WALK.has(t);

export type GridMap = { name: string; tiles: number[]; spawn: { x: number; y: number } };

export function cellWalkable(map: GridMap, x: number, y: number) {
  if (x < 0 || y < 0 || x >= GRID || y >= GRID) return false;
  return tileWalkable(map.tiles[y * GRID + x]);
}

/** Nearest walkable cell to (x, y), spiralling outward; falls back to spawn. */
export function nearestWalkable(map: GridMap, x: number, y: number) {
  for (let r = 0; r < GRID; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++)
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r && cellWalkable(map, x + dx, y + dy)) return { x: x + dx, y: y + dy };
  return map.spawn;
}

export function validateGrid(tiles: unknown, spawn: { x: number; y: number }): string | null {
  if (!Array.isArray(tiles) || tiles.length !== CELLS) return "La carte doit compter exactement 40 × 40 cases.";
  if (tiles.some((t) => !Number.isInteger(t) || t < 0 || t > MAX_TILE_CODE)) return "Case inconnue dans la carte.";
  if (!tileWalkable(tiles[spawn.y * GRID + spawn.x])) return "Le point de départ doit être sur une case praticable.";
  return null;
}

// ---------- Prebuilt maps (generated from the same sprites) ----------
type Rect = [number, number, number, number]; // x, y, w, h
function build(name: string, floor: number, wall: number, rooms: Rect[], extras: (t: number[]) => void, spawn: { x: number; y: number }): GridMap {
  const t = Array<number>(CELLS).fill(9);
  const set = (x: number, y: number, v: number) => { if (x >= 0 && y >= 0 && x < GRID && y < GRID) t[y * GRID + x] = v; };
  for (const [x, y, w, h] of rooms) {
    for (let j = y - 1; j <= y + h; j++) for (let i = x - 1; i <= x + w; i++) if (t[j * GRID + i] === 9) set(i, j, wall);
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, floor);
  }
  // corridors between consecutive room centers (L-shaped, width 2)
  for (let k = 1; k < rooms.length; k++) {
    const a = rooms[k - 1]!, b = rooms[k]!;
    const ax = a[0] + (a[2] >> 1), ay = a[1] + (a[3] >> 1), bx = b[0] + (b[2] >> 1), by = b[1] + (b[3] >> 1);
    for (let i = Math.min(ax, bx); i <= Math.max(ax, bx); i++) for (let w = 0; w < 2; w++) { set(i, ay + w, 3); }
    for (let j = Math.min(ay, by); j <= Math.max(ay, by); j++) for (let w = 0; w < 2; w++) { set(bx + w, j, 3); }
  }
  // wall ring around corridors
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) if (tileWalkable(t[j * GRID + i])) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (t[(j + dy) * GRID + i + dx] === 9 && i + dx >= 0 && i + dx < GRID && j + dy >= 0 && j + dy < GRID) set(i + dx, j + dy, wall);
  extras(t);
  // outer border always blocked
  for (let i = 0; i < GRID; i++) { if (tileWalkable(t[i])) set(i, 0, wall); if (tileWalkable(t[(GRID - 1) * GRID + i])) set(i, GRID - 1, wall); if (tileWalkable(t[i * GRID])) set(0, i, wall); if (tileWalkable(t[i * GRID + GRID - 1])) set(GRID - 1, i, wall); }
  return { name, tiles: t, spawn };
}
const fill = (t: number[], [x, y, w, h]: Rect, v: number) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) t[j * GRID + i] = v; };

export const PREBUILT_MAPS: Record<string, GridMap> = {
  "le-sas": build("Le Sas", 6, 7, [[3, 16, 8, 8], [14, 17, 10, 4], [27, 8, 9, 8], [28, 26, 8, 9]], (t) => { fill(t, [5, 18, 2, 1], 2); fill(t, [30, 10, 2, 2], 2); fill(t, [32, 13, 2, 1], 2); }, { x: 6, y: 20 }),
  "salle-des-machines": build("La Salle des Machines", 5, 7, [[3, 3, 10, 8], [17, 3, 18, 6], [20, 14, 12, 12], [4, 20, 10, 14], [20, 30, 15, 6]], (t) => { fill(t, [22, 16, 8, 1], 2); fill(t, [22, 22, 8, 1], 2); fill(t, [6, 24, 1, 6], 1); }, { x: 7, y: 6 }),
  "le-reliquaire": build("Le Reliquaire", 4, 8, [[17, 3, 7, 6], [4, 12, 10, 10], [17, 14, 7, 10], [27, 12, 10, 10], [15, 29, 11, 8]], (t) => { fill(t, [6, 14, 6, 1], 10); fill(t, [6, 19, 6, 1], 10); fill(t, [29, 15, 6, 4], 1); fill(t, [19, 31, 7, 3], 10); }, { x: 20, y: 5 }),
  "coeur-du-bastion": build("Le Cœur du Bastion", 3, 7, [[16, 33, 8, 5], [15, 24, 10, 6], [4, 16, 9, 7], [27, 16, 9, 7], [10, 3, 20, 11]], (t) => { fill(t, [12, 5, 2, 7], 9); fill(t, [26, 5, 2, 7], 9); fill(t, [18, 7, 4, 2], 6); }, { x: 19, y: 35 }),
};
export const DEFAULT_MAP_KEY = "le-sas";
export const PREBUILT_KEYS = Object.keys(PREBUILT_MAPS);

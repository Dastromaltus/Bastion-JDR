import { DEFAULT_MAP_KEY, PREBUILT_MAPS, cellWalkable, type GridMap } from "./map-grid";

export type WorldDirection = "up" | "down" | "left" | "right";
const DEFAULT_MAP = PREBUILT_MAPS[DEFAULT_MAP_KEY]!;
export const WORLD_SPAWN = DEFAULT_MAP.spawn;
export const WORLD_DELTAS: Record<WorldDirection, readonly [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export function worldWalkable(x: number, y: number, map: GridMap = DEFAULT_MAP) {
  return cellWalkable(map, x, y);
}
/** Saved position when it belongs to this zone and is walkable on the current map; otherwise the map start. */
export function worldPosition(player: { world_x?: number; world_y?: number; world_zone?: string | null }, zone: string, map: GridMap = DEFAULT_MAP) {
  if (player.world_zone === zone && player.world_x !== undefined && player.world_y !== undefined && cellWalkable(map, player.world_x, player.world_y)) return { x: player.world_x, y: player.world_y };
  return map.spawn;
}

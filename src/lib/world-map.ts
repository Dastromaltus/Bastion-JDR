import map from "@/data/salon-world.json";

export type WorldDirection = "up" | "down" | "left" | "right";
export const WORLD_SPAWN = { x: 12, y: 9 };
export const WORLD_DELTAS: Record<WorldDirection, readonly [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export function worldWalkable(x: number, y: number) {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const tile = map.layers[0]?.data[y * map.width + x];
  return tile === 1 || tile === 2 || tile === 3 || tile === 7;
}
export function worldPosition(player: { world_x?: number; world_y?: number; world_zone?: string | null }, zone: string) {
  return player.world_zone === zone ? { x: player.world_x ?? WORLD_SPAWN.x, y: player.world_y ?? WORLD_SPAWN.y } : WORLD_SPAWN;
}
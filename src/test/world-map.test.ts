import { describe, expect, it } from "vitest";
import map from "@/data/salon-world.json";
import { WORLD_DELTAS, WORLD_SPAWN, worldPosition, worldWalkable } from "@/lib/world-map";

describe("salon tile movement", () => {
  it("has a complete Tiled grid and a walkable spawn", () => {
    expect(map.layers[0]?.data).toHaveLength(map.width * map.height);
    expect(map.tilewidth).toBe(16);
    expect(worldWalkable(WORLD_SPAWN.x, WORLD_SPAWN.y)).toBe(true);
  });
  it("blocks bounds, trees, cliffs and water", () => {
    for (const [x, y] of [[-1, 9], [25, 9], [12, -1], [12, 17], [1, 2], [0, 0], [4, 4]]) expect(worldWalkable(x, y)).toBe(false);
  });
  it("supports four one-tile directions", () => {
    for (const [dx, dy] of Object.values(WORLD_DELTAS)) expect(Math.abs(dx) + Math.abs(dy)).toBe(1);
  });
  it("keeps persisted coordinates in the same room and resets stale coordinates", () => {
    expect(worldPosition({ world_x: 5, world_y: 9, world_zone: "entree" }, "entree")).toEqual({ x: 5, y: 9 });
    expect(worldPosition({ world_x: 5, world_y: 9, world_zone: "entree" }, "coeur")).toEqual(WORLD_SPAWN);
    expect(worldPosition({}, "entree")).toEqual(WORLD_SPAWN);
  });
});
import { describe, expect, it } from "vitest";
import { CELLS, GRID, PREBUILT_MAPS, cellWalkable, validateGrid } from "@/lib/map-grid";
import { WORLD_DELTAS, WORLD_SPAWN, worldPosition, worldWalkable } from "@/lib/world-map";

describe("40×40 salon maps", () => {
  it("every prebuilt map is 40 × 40 with a walkable start", () => {
    expect(GRID).toBe(40);
    for (const m of Object.values(PREBUILT_MAPS)) {
      expect(m.tiles).toHaveLength(CELLS);
      expect(validateGrid(m.tiles, m.spawn)).toBeNull();
    }
  });
  it("prebuilt map rooms are all reachable from the start", () => {
    for (const m of Object.values(PREBUILT_MAPS)) {
      const seen = new Set<number>([m.spawn.y * GRID + m.spawn.x]); const q = [m.spawn];
      while (q.length) { const c = q.pop()!; for (const [dx, dy] of Object.values(WORLD_DELTAS)) { const x = c.x + dx, y = c.y + dy, k = y * GRID + x; if (!seen.has(k) && cellWalkable(m, x, y)) { seen.add(k); q.push({ x, y }); } } }
      const walk = m.tiles.filter((_, i) => cellWalkable(m, i % GRID, Math.floor(i / GRID))).length;
      expect(seen.size, m.name).toBe(walk);
    }
  });
  it("rejects maps that are not 40 × 40 or start on a wall", () => {
    expect(validateGrid(Array(25 * 17).fill(3), { x: 1, y: 1 })).not.toBeNull();
    expect(validateGrid(Array(CELLS).fill(7), { x: 1, y: 1 })).not.toBeNull();
  });
  it("blocks outside the grid", () => {
    expect(worldWalkable(-1, 5)).toBe(false);
    expect(worldWalkable(40, 5)).toBe(false);
    expect(worldWalkable(WORLD_SPAWN.x, WORLD_SPAWN.y)).toBe(true);
  });
  it("resets stale or blocked positions to the map start", () => {
    expect(worldPosition({ world_x: WORLD_SPAWN.x + 1, world_y: WORLD_SPAWN.y, world_zone: "entree" }, "entree")).toEqual({ x: WORLD_SPAWN.x + 1, y: WORLD_SPAWN.y });
    expect(worldPosition({ world_x: 0, world_y: 0, world_zone: "entree" }, "entree")).toEqual(WORLD_SPAWN);
    expect(worldPosition({ world_x: WORLD_SPAWN.x, world_y: WORLD_SPAWN.y, world_zone: "entree" }, "coeur")).toEqual(WORLD_SPAWN);
  });
});

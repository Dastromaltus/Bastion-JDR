import { expect, it } from "vitest";
import { CELLS, GRID, barrierTile, placeMapSpawn, validateGrid } from "@/lib/map-grid";

it("allows departure on any blocked cell, including the last grid cell", () => {
  for (const tile of [0, 1, 2, 7, 8, 9]) {
    const map = { name: "T", tiles: Array<number>(CELLS).fill(tile), spawn: { x: 80, y: 80 }, enemies: [{ x: 10, y: 10 }] };
    const next = placeMapSpawn(map, 159, 159);
    expect(next.spawn).toEqual({ x: 159, y: 159 });
    expect(next.tiles[CELLS - 1]).toBe(6);
    expect(validateGrid(next.tiles, next.spawn)).toBeNull();
    expect(next.tiles[0]).toBe(tile);
    expect(map.tiles[CELLS - 1]).toBe(tile);
    expect(next.enemies).toBe(map.enemies);
  }
});

it("removes barrier blocking while retaining a walkable brush texture", () => {
  const map = { name: "T", tiles: Array<number>(CELLS).fill(barrierTile(10)), spawn: { x: 80, y: 80 } };
  expect(placeMapSpawn(map, 12, 20).tiles[20 * GRID + 12]).toBe(10);
});

it("keeps existing walkable terrain unchanged", () => {
  const map = { name: "T", tiles: Array<number>(CELLS).fill(4), spawn: { x: 80, y: 80 } };
  expect(placeMapSpawn(map, 0, 0).tiles).toBe(map.tiles);
});

it("does not allow departure outside the map", () => {
  const map = { name: "T", tiles: Array<number>(CELLS).fill(6), spawn: { x: 80, y: 80 } };
  expect(placeMapSpawn(map, 160, 0)).toBe(map);
  expect(placeMapSpawn(map, -1, 0)).toBe(map);
});
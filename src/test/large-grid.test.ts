import { expect, it } from "vitest";
import { CELLS, GRID, cellWalkable, expandLegacyTiles, validateGrid } from "@/lib/map-grid";
import { placeMapEnemy } from "@/lib/map-enemies";

it("maps contain exactly 160 × 160 cells", () => {
  expect(GRID).toBe(160);
  expect(CELLS).toBe(25600);
  expect(validateGrid(Array(25600).fill(6), { x: 159, y: 159 })).toBeNull();
  expect(validateGrid(Array(1600).fill(6), { x: 1, y: 1 })).not.toBeNull();
  expect(validateGrid(Array(25600).fill(6), { x: 160, y: 0 })).not.toBeNull();
});

it("legacy terrain keeps identical coordinates rather than being stretched", () => {
  const tiles = Array<number>(1600).fill(6);
  tiles[39 * 40 + 39] = 17;
  const expanded = expandLegacyTiles(tiles);
  expect(expanded).toHaveLength(25600);
  expect(expanded[39 * 160 + 39]).toBe(17);
  expect(expanded[40]).toBe(0);
  expect(expanded[40 * 160]).toBe(0);
  expect(tiles).toHaveLength(1600);
  expect(expandLegacyTiles(expanded)).toBe(expanded);
});

it("enemies can occupy the new bottom-right cell but not coordinates outside 160 × 160", () => {
  const map = { name: "Grande carte", tiles: Array<number>(25600).fill(6), spawn: { x: 80, y: 80 } };
  const placed = placeMapEnemy(map, { catalogId: "slime", x: 159, y: 159 });
  expect(typeof placed).not.toBe("string");
  if (typeof placed === "string") throw new Error(placed);
  expect(placed.enemies).toEqual([{ catalogId: "slime", x: 159, y: 159 }]);
  expect(cellWalkable(map, 159, 159)).toBe(true);
  expect(cellWalkable(map, 160, 159)).toBe(false);
  expect(typeof placeMapEnemy(map, { catalogId: "slime", x: 160, y: 159 })).toBe("string");
});
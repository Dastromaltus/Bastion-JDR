import { expect, it } from "vitest";
import { BRUSH_SIZES, CELLS, GRID, barrierTile, brushCells, fillMapTiles, paintBrush } from "@/lib/map-grid";
import { paintTile, type ScenarioStep } from "@/lib/scenario-steps";

it("offers larger brushes up to 80 × 80", () => {
  expect([...BRUSH_SIZES]).toEqual([1, 2, 3, 4, 5, 8, 10, 16, 20, 32, 40, 80]);
});

it("paints 6400 cells with the largest brush", () => {
  expect(paintBrush(Array<number>(CELLS).fill(6), 80, 80, 3, 80).filter((t) => t === 3)).toHaveLength(6400);
});

it("fills all 160 × 160 cells with a selected walkable texture", () => {
  const tiles = Array<number>(CELLS).fill(7);
  const next = fillMapTiles(tiles, 10, [{ x: 80, y: 80 }]);
  expect(next).toHaveLength(25600);
  expect(next.every((t) => t === 10)).toBe(true);
  expect(tiles[0]).toBe(7);
});

it("preserves spawn and enemy cells when filling with blocking terrain", () => {
  const next = fillMapTiles(Array<number>(CELLS).fill(6), barrierTile(3), [{ x: 80, y: 80 }, { x: 10, y: 20 }]);
  expect(next[80 * GRID + 80]).toBe(6);
  expect(next[20 * GRID + 10]).toBe(6);
  expect(next.filter((t) => t === 13)).toHaveLength(25598);
});

it("a 3 × 3 brush covers nine cells centred on the cursor and clips at the border", () => {
  expect(brushCells(20, 20, 3)).toHaveLength(9);
  expect(brushCells(20, 20, 3)).toEqual(expect.arrayContaining([{ x: 19, y: 19 }, { x: 21, y: 21 }]));
  expect(brushCells(0, 0, 3)).toHaveLength(4);
});

it("a 5 × 5 brush paints twenty-five cells and leaves the rest untouched", () => {
  const tiles = Array<number>(CELLS).fill(6);
  const next = paintBrush(tiles, 20, 20, 7, 5);
  expect(next.filter((t) => t === 7)).toHaveLength(25);
  expect(next[18 * GRID + 18]).toBe(7);
  expect(next[17 * GRID + 20]).toBe(6);
});

it("repainting the same square changes nothing and returns the very same array", () => {
  const tiles = Array<number>(CELLS).fill(6);
  const next = paintBrush(tiles, 10, 10, 7, 3);
  expect(paintBrush(next, 10, 10, 7, 3)).toBe(next);
});

it("a wide brush keeps the point of départ walkable", () => {
  const step: ScenarioStep = { name: "T", tiles: Array<number>(CELLS).fill(6), spawn: { x: 20, y: 20 }, source: "test", enemies: [], track: null, intro: "" };
  const next = paintTile(step, 20, 20, barrierTile(7), 3, [step.spawn]);
  expect(next.tiles[20 * GRID + 20]).toBe(6);
  expect(next.tiles[19 * GRID + 19]).toBe(barrierTile(7));
});

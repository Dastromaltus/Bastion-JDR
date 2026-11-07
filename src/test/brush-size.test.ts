import { expect, it } from "vitest";
import { BRUSH_SIZES, CELLS, GRID, barrierTile, brushCells, paintBrush } from "@/lib/map-grid";
import { paintTile, type ScenarioStep } from "@/lib/scenario-steps";

it("offers brush sizes from 1 × 1 up to 5 × 5", () => {
  expect([...BRUSH_SIZES]).toEqual([1, 2, 3, 4, 5]);
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

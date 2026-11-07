import { expect, it } from "vitest";
import { CELLS } from "@/lib/map-grid";
import { passageError, onPassage } from "@/lib/map-passages";

const map = { name: "Test", tiles: Array<number>(CELLS).fill(6), spawn: { x: 80, y: 80 } };
it("allows a passage on a walkable cell of the 160×160 map", () => {
  expect(passageError(map, { x: 159, y: 159 })).toBeNull();
  expect(passageError(map, { x: 160, y: 159 })).not.toBeNull();
});
it("refuses a passage on blocked terrain", () => {
  const tiles = [...map.tiles]; tiles[81 * 160 + 80] = 7;
  expect(passageError({ ...map, tiles }, { x: 80, y: 81 })).not.toBeNull();
});
it("requires the adventurer to stand exactly on the passage", () => {
  expect(onPassage({ x: 80, y: 81 }, { x: 80, y: 81 })).toBe(true);
  expect(onPassage({ x: 80, y: 80 }, { x: 80, y: 81 })).toBe(false);
  expect(onPassage({ x: 80, y: 81 }, null)).toBe(false);
});
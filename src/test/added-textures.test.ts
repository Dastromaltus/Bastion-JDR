import { expect, it } from "vitest";
import { barrierTile, CELLS, SPRITES, tileFrame, tileTexture, tileWalkable, validateGrid } from "@/lib/map-grid";

it("adds all ten textures with distinct frames and blocking variants", () => {
  expect(SPRITES).toHaveLength(30);
  for (let code = 21; code <= 30; code++) {
    expect(tileFrame(code)).toBe(code - 11);
    expect(tileWalkable(code)).toBe(true);
    expect(barrierTile(code)).toBe(code + 10);
    expect(tileTexture(barrierTile(code))).toBe(code);
    expect(tileFrame(barrierTile(code))).toBe(tileFrame(code));
    expect(tileWalkable(barrierTile(code))).toBe(false);
    const tiles = Array<number>(CELLS).fill(code);
    tiles[1] = barrierTile(code);
    expect(validateGrid(tiles, { x: 80, y: 80 })).toBeNull();
  }
});

it("adds the next ten textures without overwriting previously saved terrain", () => {
  for (let code = 41; code <= 50; code++) {
    expect(tileFrame(code)).toBe(code - 21);
    expect(barrierTile(code)).toBe(code + 10);
    expect(tileTexture(code + 10)).toBe(code);
    expect(tileFrame(code + 10)).toBe(code - 21);
    expect(tileWalkable(code)).toBe(true);
    expect(tileWalkable(code + 10)).toBe(false);
    const tiles = Array<number>(CELLS).fill(code);
    tiles[1] = barrierTile(code);
    expect(validateGrid(tiles, { x: 80, y: 80 })).toBeNull();
  }
});

it("keeps the artwork and collision codes of existing maps", () => {
  for (let code = 1; code <= 10; code++) {
    expect(barrierTile(code)).toBe(code + 10);
    expect(tileFrame(code)).toBe(code - 1);
    expect(tileFrame(code + 10)).toBe(code - 1);
    expect(tileWalkable(code + 10)).toBe(false);
  }
});
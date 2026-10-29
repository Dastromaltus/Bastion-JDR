import { expect, it } from "vitest";
import { barrierTile, tileTexture, tileWalkable, validateGrid, CELLS } from "@/lib/map-grid";
import { placeMapEnemy } from "@/lib/map-enemies";
it("all ten brush textures can form impassable barriers without changing their art", () => {
  for (let texture = 1; texture <= 10; texture++) {
    expect(tileTexture(barrierTile(texture))).toBe(texture);
    expect(tileWalkable(barrierTile(texture))).toBe(false);
  }
});
it("40×40 maps preserve textured barriers and refuse enemy placement on them", () => {
  const tiles = Array<number>(CELLS).fill(6); tiles[41] = barrierTile(6);
  expect(validateGrid(tiles, { x: 20, y: 20 })).toBeNull();
  expect(typeof placeMapEnemy({ name: "Test", tiles, spawn: { x: 20, y: 20 }, enemies: [] }, { catalogId: "enemy", x: 1, y: 1 })).toBe("string");
});
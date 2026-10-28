import { describe, expect, it } from "vitest";
import { blockedMapEnemies, placeMapEnemy } from "@/lib/map-enemies";
import { CELLS, type GridMap } from "@/lib/map-grid";

const map = (): GridMap => ({ name: "Carte personnelle", tiles: Array(CELLS).fill(6), spawn: { x: 20, y: 20 } });

describe("personal map enemy overlays", () => {
  it("places two enemies above the textures without changing any of the 1600 tiles", () => {
    const original = map();
    const first = placeMapEnemy(original, { catalogId: "zombie", x: 0, y: 0 });
    if (typeof first === "string") throw new Error(first);
    const second = placeMapEnemy(first, { catalogId: "zombie", x: 39, y: 39 });
    if (typeof second === "string") throw new Error(second);
    expect(second.tiles).toEqual(original.tiles);
    expect(second.tiles).toHaveLength(1600);
    expect(second.enemies).toEqual([{ catalogId: "zombie", x: 0, y: 0 }, { catalogId: "zombie", x: 39, y: 39 }]);
  });
  it.each([[-1, 0], [40, 0], [0, 40], [1.5, 1]])("rejects coordinates (%s, %s) outside the 40×40 cells", (x, y) => {
    expect(placeMapEnemy(map(), { catalogId: "zombie", x, y })).toBe("Case hors de la grille 40 × 40.");
  });
  it("identifies enemies blocked by repainting without removing their saved placements", () => {
    const original = map();
    const placed = placeMapEnemy(original, { catalogId: "zombie", x: 5, y: 5 });
    if (typeof placed === "string") throw new Error(placed);
    const changed = { ...placed, tiles: placed.tiles.map((t, i) => i === 205 ? 7 : t) };
    expect(blockedMapEnemies(changed)).toEqual([{ catalogId: "zombie", x: 5, y: 5 }]);
    expect(changed.enemies).toHaveLength(1);
  });
});
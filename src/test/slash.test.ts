import { describe, expect, it } from "vitest";
import { SLASH_DAMAGE, SLASH_RANGE, slashInRange, slashKeyPressed, slashTarget } from "../lib/slash";
import { readFileSync } from "node:fs";

describe("Slash", () => {
  it("deals exactly 2 damage on the server without class bonuses", () => {
    expect(SLASH_DAMAGE).toBe(2);
    const sql = readFileSync("drizzle/migrations/0045_slash_fixed_damage.sql", "utf8");
    expect(sql).toContain("IF p_action=''slash'' THEN damage:=2; ELSE");
  });
  it("uses the 7 key including French keyboard and numpad", () => {
    expect(slashKeyPressed("7", "Digit7", false, false)).toBe(true);
    expect(slashKeyPressed("è", "Digit7", false, false)).toBe(true);
    expect(slashKeyPressed("7", "Numpad7", false, false)).toBe(true);
    expect(slashKeyPressed("8", "Digit8", false, false)).toBe(false);
  });
  it("ignores repeats and text entry", () => {
    expect(slashKeyPressed("7", "Digit7", true, false)).toBe(false);
    expect(slashKeyPressed("7", "Digit7", false, true)).toBe(false);
  });
  it("targets a selected living enemy or the nearest visible one", () => {
    const enemies = [{ id: "a", zone: "entree", hp: 10, status: "revele", tile_x: 4, tile_y: 2 }, { id: "b", zone: "entree", hp: 10, status: "revele", tile_x: 2, tile_y: 2 }, { id: "c", zone: "autre", hp: 10, status: "revele", tile_x: 1, tile_y: 2 }];
    expect(slashTarget(enemies, "a", "entree", { x: 1, y: 2 })?.id).toBe("b");
    expect(slashTarget(enemies, null, "entree", { x: 1, y: 2 })?.id).toBe("b");
    expect(slashTarget(enemies.map((e) => ({ ...e, hp: 0 })), null, "entree", { x: 1, y: 2 })).toBeUndefined();
  });
  it("has exactly one cell of range, including adjacent diagonal cells", () => {
    expect(SLASH_RANGE).toBe(1);
    expect(slashInRange({ x: 80, y: 80 }, { x: 81, y: 80 })).toBe(true);
    expect(slashInRange({ x: 80, y: 80 }, { x: 81, y: 81 })).toBe(true);
    expect(slashInRange({ x: 80, y: 80 }, { x: 82, y: 80 })).toBe(false);
    expect(slashTarget([{ id: "far", zone: "entree", hp: 10, status: "revele", tile_x: 82, tile_y: 80 }], "far", "entree", { x: 80, y: 80 })).toBeUndefined();
  });
});
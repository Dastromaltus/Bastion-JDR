import { describe, expect, it } from "vitest";
import { WORLD_DECOR_ROWS, worldDecorFrame } from "@/lib/world-decor";

describe("zone scenery", () => {
  it("gives the six zones distinct tileset rows", () => {
    expect(new Set(Object.values(WORLD_DECOR_ROWS)).size).toBe(6);
    expect(new Set(Object.keys(WORLD_DECOR_ROWS).map((zone) => worldDecorFrame(1, zone))).size).toBe(6);
  });
  it("preserves tile identities and uses the entrance as a fallback", () => {
    for (const zone of Object.keys(WORLD_DECOR_ROWS)) {
      for (let tile = 1; tile <= 7; tile++) expect(worldDecorFrame(tile, zone) % 16).toBe(tile - 1);
    }
    expect(worldDecorFrame(3, "unknown")).toBe(worldDecorFrame(3, "entree"));
  });
});
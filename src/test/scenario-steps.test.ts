import { describe, expect, it } from "vitest";
import { PREBUILT_MAPS, GRID } from "@/lib/map-grid";
import { moveStep, putMob, paintTile, type ScenarioStep } from "@/lib/scenario-steps";

const base = (): ScenarioStep => ({ ...structuredClone(Object.values(PREBUILT_MAPS)[0]!), source: "prebuilt:x", enemies: [], track: null, intro: "" });

describe("scenario steps", () => {
  it("reorders steps", () => { expect(moveStep(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]); expect(moveStep(["a"], 0, -1)).toEqual(["a"]); });
  it("places a mob on the spawn cell and refuses a second on the same cell", () => {
    const s = base(); const r = putMob(s, s.spawn.x, s.spawn.y, "m1") as ScenarioStep;
    expect(r.enemies).toEqual([{ catalogId: "m1", x: s.spawn.x, y: s.spawn.y }]);
    expect(typeof putMob(r, s.spawn.x, s.spawn.y, "m1")).toBe("string");
  });
  it("refuses coordinates outside the 40x40 grid", () => { expect(typeof putMob(base(), GRID, 0, "m1")).toBe("string"); });
  it("painting a wall under a mob removes it", () => {
    const s = base(); const r = putMob(s, s.spawn.x, s.spawn.y, "m1") as ScenarioStep;
    expect(paintTile(r, s.spawn.x, s.spawn.y, 7).enemies).toHaveLength(0);
  });
});

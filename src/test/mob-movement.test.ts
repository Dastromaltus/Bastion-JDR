import { describe, expect, it } from "vitest";
import { mobMovementAllowed } from "@/lib/world-movement";

const base = { status: "playing", role: "narrator", controlledId: "m1" };

describe("narrator mob ZQSD (free movement)", () => {
  it("moves the selected mob", () => expect(mobMovementAllowed(base)).toBe(true));
  it("moves it even while an adventurer has the combat turn", () => expect(mobMovementAllowed({ ...base, combat: { active: true, current: { id: "p1", kind: "player" } } })).toBe(true));
  it("needs a selected mob", () => expect(mobMovementAllowed({ ...base, controlledId: null })).toBe(false));
  it("refuses adventurers", () => expect(mobMovementAllowed({ ...base, role: "adventurer" })).toBe(false));
});

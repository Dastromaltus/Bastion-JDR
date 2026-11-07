import { describe, expect, it } from "vitest";
import { mobMovementAllowed } from "@/lib/world-movement";

const base = { status: "playing", role: "narrator", controlledId: "m1", combat: { active: true, current: { id: "m1", kind: "enemy" } } };

describe("narrator mob ZQSD", () => {
  it("moves the controlled mob on its combat turn", () => expect(mobMovementAllowed(base)).toBe(true));
  it("waits while an adventurer plays", () => expect(mobMovementAllowed({ ...base, combat: { active: true, current: { id: "p1", kind: "player" } } })).toBe(false));
  it("refuses another mob's turn", () => expect(mobMovementAllowed({ ...base, controlledId: "m2" })).toBe(false));
  it("refuses adventurers", () => expect(mobMovementAllowed({ ...base, role: "adventurer" })).toBe(false));
});

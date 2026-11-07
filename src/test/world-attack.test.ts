import { describe, expect, it } from "vitest";
import { worldAttackAllowed } from "../lib/world-attack";

const ready = { status: "playing", role: "adventurer", hp: 12, enemyVisible: true, enemyAlive: true, busy: false };
describe("direct map attacks", () => {
  it("allows a visible enemy attack without a combat turn", () => expect(worldAttackAllowed(ready)).toBe(true));
  it("refuses undisclosed enemies", () => expect(worldAttackAllowed({ ...ready, enemyVisible: false })).toBe(false));
  it("refuses defeated enemies", () => expect(worldAttackAllowed({ ...ready, enemyAlive: false })).toBe(false));
  it("refuses narrator attacks as an adventurer", () => expect(worldAttackAllowed({ ...ready, role: "narrator" })).toBe(false));
  it("refuses a defeated adventurer", () => expect(worldAttackAllowed({ ...ready, hp: 0 })).toBe(false));
  it("refuses attacks before play", () => expect(worldAttackAllowed({ ...ready, status: "waiting" })).toBe(false));
  it("serializes clicks", () => expect(worldAttackAllowed({ ...ready, busy: true })).toBe(false));
});
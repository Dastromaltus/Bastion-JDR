import { describe, expect, it } from "vitest";
import { worldMovementAllowed } from "../lib/world-movement";

const state = { status: "playing", role: "adventurer", hp: 14, sameZone: true, explorationTurn: true };
describe("free world movement", () => {
  it("lets the adventurer move on their turn", () => expect(worldMovementAllowed(state)).toBe(true));
  it("lets the adventurer move outside their turn", () => expect(worldMovementAllowed({ ...state, explorationTurn: false })).toBe(true));
  it("lets the adventurer move during another combatant's turn", () => expect(worldMovementAllowed({ ...state, combat: { active: true, isMine: false } })).toBe(true));
  it("blocks a knocked-out adventurer", () => expect(worldMovementAllowed({ ...state, hp: 0 })).toBe(false));
  it("does not give a narrator an adventurer", () => expect(worldMovementAllowed({ ...state, role: "narrator" })).toBe(false));
});

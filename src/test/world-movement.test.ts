import { describe, expect, it } from "vitest";
import { worldMovementAllowed } from "../lib/world-movement";

const state = { status: "playing", role: "adventurer", hp: 14, sameZone: true, explorationTurn: true };
describe("world movement eligibility", () => {
  it("permits the adventurer to move on their exploration turn", () => expect(worldMovementAllowed(state)).toBe(true));
  it("permits movement on their combat turn", () => expect(worldMovementAllowed({ ...state, explorationTurn: false, combat: { active: true, isMine: true } })).toBe(true));
  it("blocks movement on another combatant's turn", () => expect(worldMovementAllowed({ ...state, combat: { active: true, isMine: false } })).toBe(false));
  it("does not give a narrator an adventurer", () => expect(worldMovementAllowed({ ...state, role: "narrator" })).toBe(false));
  it("blocks exploration outside their turn", () => expect(worldMovementAllowed({ ...state, explorationTurn: false })).toBe(false));
});
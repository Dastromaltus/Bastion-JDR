import { describe, expect, it } from "vitest";
import { characterStepped } from "@/lib/movement-sound";
import type { WorldActor } from "@/lib/world-actors";

const actor: WorldActor = { id: "a", name: "A", x: 10, y: 11, frame: 7, sprite: "human" };
describe("movement sound", () => {
  it("plays for adventurer movement", () => expect(characterStepped(actor, { x: 10, y: 10 })).toBe(true));
  it("plays for enemy movement", () => expect(characterStepped({ ...actor, sprite: "zombie" }, { x: 9, y: 11 })).toBe(true));
  it("does not play on arrival or unchanged confirmation", () => {
    expect(characterStepped(actor)).toBe(false);
    expect(characterStepped(actor, actor)).toBe(false);
  });
  it("does not play for treasures or dead characters", () => {
    expect(characterStepped({ ...actor, sprite: "treasure" }, { x: 9, y: 11 })).toBe(false);
    expect(characterStepped({ ...actor, dead: true }, { x: 9, y: 11 })).toBe(false);
  });
});
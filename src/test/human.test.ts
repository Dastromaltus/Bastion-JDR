import { describe, expect, it } from "vitest";
import { RACE_NAMES, RACES } from "@/lib/races";
import { DEFAULT_LOOK } from "@/lib/character";
import { participantActors } from "@/lib/world-actors";

describe("default human adventurers", () => {
  it("offers only Human", () => {
    expect(RACE_NAMES).toEqual(["Humain"]);
    expect(Object.keys(RACES)).toEqual(["Humain"]);
  });
  it("defaults new characters to Human", () => {
    expect(DEFAULT_LOOK.race).toBe("Humain");
  });
  it("uses Human artwork even for a retired race without changing health", () => {
    const actors = participantActors([{ id: "a", display_name: "A", role: "adventurer", race: "Oiseau", hp: 8, max_hp: 14 }], "entree", "a");
    expect(actors[0]).toMatchObject({ sprite: "human", hp: 8, maxHp: 14 });
  });
});
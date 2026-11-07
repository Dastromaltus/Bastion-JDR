import { describe, expect, it } from "vitest";
import { RACE_NAMES, RACES, normalizeRace } from "@/lib/races";
import { DEFAULT_LOOK } from "@/lib/character";
import { participantActors } from "@/lib/world-actors";

describe("default human adventurers", () => {
  it("offers Human then Dwarf", () => {
    expect(RACE_NAMES).toEqual(["Humain", "Nain"]);
    expect(Object.keys(RACES)).toEqual(["Humain", "Nain"]);
  });
  it("defaults new characters to Human", () => {
    expect(DEFAULT_LOOK.race).toBe("Humain");
  });
  it("retains the selected dwarf race while falling back to Human for retired races", () => {
    expect(normalizeRace("Nain")).toBe("Nain");
    expect(normalizeRace("Oiseau")).toBe("Humain");
  });
  it("renders dwarf adventurers without changing health or class", () => {
    const actors = participantActors([{ id: "d", display_name: "N", role: "adventurer", race: "Nain", hp: 8, max_hp: 14 }], "entree", "d");
    expect(actors[0]).toMatchObject({ sprite: "dwarf", hp: 8, maxHp: 14 });
  });
  it("uses Human artwork even for a retired race without changing health", () => {
    const actors = participantActors([{ id: "a", display_name: "A", role: "adventurer", race: "Oiseau", hp: 8, max_hp: 14 }], "entree", "a");
    expect(actors[0]).toMatchObject({ sprite: "human", hp: 8, maxHp: 14 });
  });
});
import { describe, expect, it } from "vitest";
import { adventurerHealth, readDamageRecord } from "../lib/health-history";

describe("adventurer health tracking", () => {
  it("excludes the characterless narrator", () => {
    const base = { display_name: "Mat", hp: 12, max_hp: 16 };
    expect(adventurerHealth([{ ...base, id: "a", role: "adventurer" }, { ...base, id: "n", role: "narrator" }]).map((p) => p.id)).toEqual(["a"]);
  });
  it("reads the actual HP lost, including a lethal hit", () => {
    expect(readDamageRecord({ player_id: "a", player_name: "Mat", hp_before: 2, hp_after: 0, max_hp: 16, damage: 2 })?.damage).toBe(2);
  });
  it("rejects nominal damage that exceeds the actual HP change", () => {
    expect(readDamageRecord({ player_id: "a", player_name: "Mat", hp_before: 2, hp_after: 0, max_hp: 16, damage: 5 })).toBeNull();
  });
  it("does not invent damage from an old dice log or a healing event", () => {
    expect(readDamageRecord({ rolls: [6], successes: 1 })).toBeNull();
    expect(readDamageRecord({ player_id: "a", player_name: "Mat", hp_before: 2, hp_after: 5, max_hp: 16, damage: -3 })).toBeNull();
  });
});
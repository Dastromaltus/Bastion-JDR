import { describe, expect, it } from "vitest";
import { CLASSES, classHp, classOf } from "@/lib/classes";
import { hpFor } from "@/lib/races";

describe("classes", () => {
  it("guerrier has the most HP", () => expect(classHp("Humain", "guerrier")).toBe(hpFor("Humain") + 6));
  it("mage trades HP for damage", () => {
    expect(classHp("Humain", "mage")).toBe(hpFor("Humain") - 2);
    expect(CLASSES.mage.damageBonus).toBe(2);
  });
  it("voleur gets +2 HP", () => expect(classHp("Humain", "voleur")).toBe(hpFor("Humain") + 2));
  it("unknown class falls back to guerrier", () => expect(classOf("paladin")).toBe("guerrier"));
});

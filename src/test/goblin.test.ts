import { expect, it } from "vitest";
import { monsterSprite } from "@/lib/world-actors";

it("makes the uploaded goblin placeable while preserving the other enemies", () => {
  for (const name of ["Gobelin", "Gobelin vert", "Goblin"]) expect(monsterSprite(name)).toBe("goblin");
  expect(monsterSprite("Orc")).toBe("orc");
  expect(monsterSprite("Loup")).toBe("wolf");
  expect(monsterSprite("Yéti")).toBe("yeti");
  expect(monsterSprite("Zombie")).toBe("zombie");
  expect(monsterSprite("Slime vert")).toBe("slime");
  expect(monsterSprite("Dragon")).toBeUndefined();
});
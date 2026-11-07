import { expect, it } from "vitest";
import { monsterSprite } from "@/lib/world-actors";

it("makes the uploaded cyclops placeable without removing existing enemies", () => {
  for (const name of ["Cyclope", "Cyclope géant", "Cyclop", "Cyclops"]) expect(monsterSprite(name)).toBe("cyclops");
  expect(monsterSprite("Gobelin")).toBe("goblin");
  expect(monsterSprite("Orc")).toBe("orc");
  expect(monsterSprite("Loup")).toBe("wolf");
  expect(monsterSprite("Yéti")).toBe("yeti");
  expect(monsterSprite("Zombie")).toBe("zombie");
  expect(monsterSprite("Slime vert")).toBe("slime");
  expect(monsterSprite("Dragon")).toBeUndefined();
});
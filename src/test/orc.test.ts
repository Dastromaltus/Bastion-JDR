import { expect, it } from "vitest";
import { monsterSprite } from "@/lib/world-actors";

it("makes the uploaded orc placeable alongside existing monsters", () => {
  for (const name of ["Orc", "Orc sauvage", "Orque", "WildOrc"]) expect(monsterSprite(name)).toBe("orc");
  expect(monsterSprite("Loup")).toBe("wolf");
  expect(monsterSprite("Yéti")).toBe("yeti");
  expect(monsterSprite("Zombie")).toBe("zombie");
  expect(monsterSprite("Slime vert")).toBe("slime");
  expect(monsterSprite("Sorcier")).toBeUndefined();
});
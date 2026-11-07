import { expect, it } from "vitest";
import { monsterSprite } from "@/lib/world-actors";
it("recognizes the uploaded wolf without removing existing monsters", () => {
  expect(monsterSprite("Loup")).toBe("wolf");
  expect(monsterSprite("Wolf")).toBe("wolf");
  expect(monsterSprite("Loup gris")).toBe("wolf");
  expect(monsterSprite("Zombie")).toBe("zombie");
  expect(monsterSprite("Slime vert")).toBe("slime");
  expect(monsterSprite("Yéti")).toBe("yeti");
  expect(monsterSprite("Drone")).toBeUndefined();
});
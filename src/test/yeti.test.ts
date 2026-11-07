import { expect, it } from "vitest";
import { monsterSprite } from "@/lib/world-actors";
it("allows the uploaded Yeti alongside zombies and slimes only", () => {
  expect(monsterSprite("Yéti")).toBe("yeti");
  expect(monsterSprite("Yeti des neiges")).toBe("yeti");
  expect(monsterSprite("Zombie")).toBe("zombie");
  expect(monsterSprite("Slime vert")).toBe("slime");
  expect(monsterSprite("Drone")).toBeUndefined();
});
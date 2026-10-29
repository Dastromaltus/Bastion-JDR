import { expect, it } from "vitest";
import { usableMapEnemy, personalEnemySchema } from "@/lib/map-catalog";
it("accepts only own personal enemies, shared enemies or the target salon's enemies", () => {
  expect(usableMapEnemy({ owner_id: "me", game_id: null }, "me")).toBe(true);
  expect(usableMapEnemy({ owner_id: "other", game_id: null }, "me")).toBe(false);
  expect(usableMapEnemy({ owner_id: null, game_id: null }, "me")).toBe(true);
  expect(usableMapEnemy({ game_id: "other-salon" }, "me", "salon")).toBe(false);
  expect(usableMapEnemy({ game_id: "salon" }, "me", "salon")).toBe(true);
});
it("validates personal enemy statistics between 1 and 5", () => {
  const enemy = { name: "Zombie personnel", category: "créature", icon: "☠", speed: 2, strength: 3, endurance: 3 };
  expect(personalEnemySchema.safeParse(enemy).success).toBe(true);
  expect(personalEnemySchema.safeParse({ ...enemy, speed: 6 }).success).toBe(false);
  expect(personalEnemySchema.safeParse({ ...enemy, strength: 0 }).success).toBe(false);
});
import { z } from "zod";
export const personalEnemySchema = z.object({
  name: z.string().trim().min(1, "Nom requis.").max(40),
  category: z.enum(["créature", "robot", "boss", "humanoïde"]),
  icon: z.string().trim().min(1).max(4),
  speed: z.number().int().min(1).max(5), strength: z.number().int().min(1).max(5), endurance: z.number().int().min(1).max(5),
  ability: z.string().trim().max(120).default(""),
});
export type PersonalEnemyInput = z.input<typeof personalEnemySchema>;
export function usableMapEnemy(c: { owner_id?: string | null; game_id?: string | null }, userId: string, gameId?: string) {
  if (c.owner_id) return c.owner_id === userId && !c.game_id;
  return !c.game_id || (gameId !== undefined && c.game_id === gameId);
}
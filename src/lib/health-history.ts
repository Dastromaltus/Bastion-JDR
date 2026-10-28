import { z } from "zod";

export const damageRecordSchema = z.object({
  player_id: z.string(), player_name: z.string(),
  hp_before: z.number().int().nonnegative(), hp_after: z.number().int().nonnegative(),
  max_hp: z.number().int().positive(), damage: z.number().int().positive(),
}).refine((r) => r.hp_before - r.hp_after === r.damage && r.hp_after <= r.max_hp);

export type DamageRecord = z.infer<typeof damageRecordSchema>;
export function readDamageRecord(payload: unknown): DamageRecord | null {
  const parsed = damageRecordSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

export type HealthPlayer = { id: string; display_name: string; role: string; hp: number; max_hp: number };
export function adventurerHealth(players: HealthPlayer[]) {
  return players.filter((p) => p.role === "adventurer");
}
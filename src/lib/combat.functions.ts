import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { worldWalkable } from "./world-map";

export const combatAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: z.string().uuid(), revision: z.number().int().default(0), action: z.enum(["control", "attack", "ability", "move", "pass"]), enemyId: z.string().uuid().optional(), targetId: z.string().uuid().optional(), x: z.number().int().optional(), y: z.number().int().optional(), effect: z.enum(["attaque", "soin", "protection"]).default("attaque") }).parse(d))
  .handler(async ({ data, context }) => {
    const { salonGrid } = await import("./maps.functions");
    if (data.action === "move" && (data.x === undefined || data.y === undefined || !worldWalkable(data.x, data.y, await salonGrid(context.supabase, data.gameId)))) throw new Error("Cette case est bloquée.");
    const { data: result, error } = await context.supabase.rpc("salon_combat_action", { p_game_id: data.gameId, p_revision: data.revision, p_action: data.action, ...(data.enemyId ? { p_enemy_id: data.enemyId } : {}), ...(data.targetId ? { p_target: data.targetId } : {}), ...(data.x !== undefined ? { p_x: data.x } : {}), ...(data.y !== undefined ? { p_y: data.y } : {}), p_effect: data.effect });
    if (error) throw new Error(error.message);
    return result as { ok: boolean; rolls?: number[]; successes?: number; damage?: number };
  });
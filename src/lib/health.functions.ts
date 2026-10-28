import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readDamageRecord } from "./health-history";

export const getDamageHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ gameId: z.string().uuid(), before: z.number().int().positive().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: member, error: memberError } = await context.supabase.from("game_players")
      .select("id").eq("game_id", data.gameId).eq("user_id", context.userId).maybeSingle();
    if (memberError || !member) throw new Error("Tu n'es pas membre de ce salon.");
    let query = context.supabase.from("game_events").select("id, created_at, payload")
      .eq("game_id", data.gameId).eq("kind", "pv").order("id", { ascending: false }).limit(51);
    if (data.before !== undefined) query = query.lt("id", data.before);
    const { data: rows, error } = await query;
    if (error) throw new Error("Impossible de charger l'historique des dégâts.");
    const page = (rows ?? []).slice(0, 50);
    return {
      entries: page.flatMap((event) => {
        const record = readDamageRecord(event.payload);
        return record ? [{ id: event.id, created_at: event.created_at, ...record }] : [];
      }),
      nextCursor: (rows ?? []).length > 50 ? page.at(-1)?.id ?? null : null,
    };
  });
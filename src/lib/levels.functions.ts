import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ZONE_KEYS, zoneLabel } from "./races";
import { TRACK_KEYS } from "./ambience-tracks";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function requireNarrator(ctx: { supabase: any; userId: string }, gameId: string) {
  const { data } = await ctx.supabase.from("game_players").select("role").eq("game_id", gameId).eq("user_id", ctx.userId).maybeSingle();
  if (data?.role !== "narrator") throw new Error("Seul le narrateur de ce salon peut préparer les niveaux.");
}

export const getLevels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireNarrator(context, data.gameId);
    const { data: rows, error } = await context.supabase.from("game_levels").select("*").eq("game_id", data.gameId).order("position");
    if (error) throw new Error("Niveaux indisponibles.");
    return rows ?? [];
  });

export const saveLevels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      gameId: z.string().uuid(),
      levels: z.array(z.object({
        zone: z.enum(ZONE_KEYS),
        track: z.enum(TRACK_KEYS).nullable(),
        introText: z.string().trim().max(1000),
      })).max(ZONE_KEYS.length),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireNarrator(context, data.gameId);
    const a = await db();
    const { data: g } = await a.from("games").select("status").eq("id", data.gameId).single();
    if (g?.status !== "waiting") throw new Error("Les niveaux se préparent avant le lancement de la partie.");
    if (new Set(data.levels.map((l) => l.zone)).size !== data.levels.length) throw new Error("Chaque carte ne peut apparaître qu'une fois.");
    await a.from("game_levels").delete().eq("game_id", data.gameId);
    if (data.levels.length) {
      const { error } = await a.from("game_levels").insert(data.levels.map((l, i) => ({
        game_id: data.gameId, zone: l.zone, position: i, track: l.track, intro_text: l.introText,
      })));
      if (error) throw new Error("Niveaux non enregistrés.");
    }
    return { ok: true };
  });

/** Server-only hook: first time adventurers reach a level, play its music and show its text. */
export async function enterLevel(gameId: string, zone: string) {
  const a = await db();
  const { data: lvl } = await a.from("game_levels").update({ entered: true }).eq("game_id", gameId).eq("zone", zone).eq("entered", false).select("*").maybeSingle();
  if (!lvl) return;
  if (lvl.track) {
    await a.from("game_ambience").upsert({ game_id: gameId, track: lvl.track, state: "lecture", updated_at: new Date().toISOString() }, { onConflict: "game_id" });
  }
  await a.from("game_events").insert({
    game_id: gameId, actor_id: null, kind: "niveau", important: true, secret: false, payload: { zone, level: lvl.position + 1 },
    message: `Niveau ${lvl.position + 1} — ${zoneLabel(zone)}${lvl.intro_text ? ` : ${lvl.intro_text}` : ""}`,
  });
}

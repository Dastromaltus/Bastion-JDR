import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Campaign } from "./campaign-model";

export const getCampaignWorkspace = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: narratorRows } = await context.supabase.from("game_players").select("game_id,games(*)").eq("user_id", context.userId).eq("role", "narrator");
  if (!narratorRows?.length) { const { data: myCampaigns } = await context.supabase.from("campaigns").select("id").eq("owner_id", context.userId).limit(1); if (!myCampaigns?.length) return { allowed: false, campaigns: [], operations: [], enemies: [], treasures: [], salons: [] }; }
  const [{ data: campaigns }, { data: templates }, { data: rooms }] = await Promise.all([
    context.supabase.from("campaigns").select("*").order("updated_at", { ascending: false }),
    context.supabase.from("dungeon_templates").select("*").order("position"),
    context.supabase.from("dungeon_rooms").select("*").order("position"),
  ]);
  // Private catalogue access after narrator verification; do not expose other authors' catalogues.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: enemies }, { data: treasures }] = await Promise.all([
    supabaseAdmin.from("enemy_catalog").select("*").or(`game_id.is.null,created_by.eq.${context.userId}`),
    supabaseAdmin.from("treasure_catalog").select("*").or(`game_id.is.null,created_by.eq.${context.userId}`),
  ]);
  return { allowed: true, campaigns: campaigns ?? [], operations: (templates ?? []).map((t) => ({ ...t, rooms: (rooms ?? []).filter((r) => r.template_id === t.id) })), enemies: enemies ?? [], treasures: treasures ?? [], salons: (narratorRows ?? []).map((r) => r.games).filter((g) => g?.status === "waiting") };
});

export const getCampaign = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d)).handler(async ({ data, context }) => {
  const { data: c, error } = await context.supabase.from("campaigns").select("*").eq("id", data.id).single();
  if (error || !c) throw new Error("Campagne inaccessible.");
  const { data: stages } = await context.supabase.from("campaign_stages").select("*").eq("campaign_id", c.id).order("position");
  const ids = (stages ?? []).map((s) => s.id);
  const { data: placements } = ids.length ? await context.supabase.from("campaign_placements").select("*").in("stage_id", ids) : { data: [] };
  return { ...c, stages: (stages ?? []).map((s) => ({ ...s, placements: (placements ?? []).filter((p) => p.stage_id === s.id) })) } as unknown as Campaign;
});

const placement = z.object({ id: z.string(), room_key: z.string().max(60), kind: z.enum(["mob", "treasure"]), catalog_id: z.string().uuid(), hidden: z.boolean(), trigger: z.enum(["entree", "porte", "manuel"]), tile_x: z.number().int().min(0).max(24), tile_y: z.number().int().min(0).max(16), overrides: z.record(z.string(), z.number().int().min(1).max(5)) });
const documentSchema = z.object({ id: z.string().uuid().optional(), revision: z.number().int().nonnegative(), name: z.string().trim().min(1).max(80), summary: z.string().max(2000), difficulty: z.enum(["initiation", "moyenne", "difficile"]), recommended_players: z.number().int().min(3).max(5), is_template: z.boolean(), status: z.string(), stages: z.array(z.object({ template_id: z.string().uuid(), position: z.number().int().min(0), objective: z.string().max(1000), objective_room: z.string().max(60), exit_room: z.string().max(60), intro_text: z.string().max(2000), track: z.string().max(40), placements: z.array(placement).max(150) })).max(20) });
export const saveCampaign = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => z.object({ document: documentSchema, publish: z.boolean().default(false) }).parse(d)).handler(async ({ data, context }) => {
  const { data: result, error } = await context.supabase.rpc("save_private_campaign", { p_document: data.document, p_publish: data.publish });
  if (error) throw new Error(error.message);
  return result as { id: string; revision: number; status: string };
});

export const deleteCampaign = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d)).handler(async ({ data, context }) => {
  const { error } = await context.supabase.from("campaigns").delete().eq("id", data.id).eq("owner_id", context.userId);
  if (error) throw new Error("Suppression impossible.");
  return { ok: true };
});

export const loadCampaignInSalon = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => z.object({ campaignId: z.string().uuid(), gameId: z.string().uuid() }).parse(d)).handler(async ({ data, context }) => {
  const { data: result, error } = await context.supabase.rpc("load_private_campaign", { p_campaign_id: data.campaignId, p_game_id: data.gameId });
  if (error) throw new Error(error.message);
  return result;
});

export const advanceCampaign = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => z.object({ gameId: z.string().uuid() }).parse(d)).handler(async ({ data, context }) => {
  const { data: result, error } = await context.supabase.rpc("advance_private_campaign", { p_game_id: data.gameId });
  if (error) throw new Error(error.message);
  const { openDungeon } = await import("./operations.functions");
  const { data: game } = await context.supabase.from("games").select("status").eq("id", data.gameId).single();
  if (game?.status === "playing") await openDungeon(data.gameId);
  return result;
});

export const startCampaignTest = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => z.object({ campaignId: z.string().uuid() }).parse(d)).handler(async ({ data, context }) => {
  const { data: result, error } = await context.supabase.rpc("create_campaign_playtest", { p_campaign_id: data.campaignId });
  if (error) throw new Error(error.message);
  const test = result as { gameId: string; code: string };
  const { openDungeon } = await import("./operations.functions");
  await openDungeon(test.gameId);
  return test;
});
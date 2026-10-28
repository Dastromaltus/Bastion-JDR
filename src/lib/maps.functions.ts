import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CELLS, DEFAULT_MAP_KEY, GRID, PREBUILT_MAPS, nearestWalkable, validateGrid, type GridMap } from "./map-grid";

const tilesSchema = z.array(z.number().int().min(0).max(10)).length(CELLS);
const coord = z.number().int().min(0).max(GRID - 1);

/** Server helper: the salon's 40×40 map (loaded copy, else the Operation's prebuilt map, else default). */
export async function salonGrid(supabase: any, gameId: string): Promise<GridMap> {
  const { data } = await supabase.from("game_world_maps").select("name, tiles, spawn_x, spawn_y").eq("game_id", gameId).maybeSingle();
  if (data) return { name: data.name, tiles: data.tiles, spawn: { x: data.spawn_x, y: data.spawn_y } };
  const { data: dg } = await supabase.from("game_dungeons").select("template_id").eq("game_id", gameId).maybeSingle();
  if (dg) {
    const { data: tpl } = await supabase.from("dungeon_templates").select("slug").eq("id", dg.template_id).maybeSingle();
    if (tpl && PREBUILT_MAPS[tpl.slug]) return PREBUILT_MAPS[tpl.slug]!;
  }
  return PREBUILT_MAPS[DEFAULT_MAP_KEY]!;
}

export const getSalonMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase.from("game_players").select("id").eq("game_id", data.gameId).eq("user_id", context.userId).maybeSingle();
    if (!me) throw new Error("Tu n'es pas membre de ce salon.");
    return salonGrid(context.supabase, data.gameId);
  });

export const listMyMaps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("custom_maps").select("id, name, tiles, spawn_x, spawn_y, updated_at").eq("owner_id", context.userId).order("updated_at", { ascending: false });
    if (error) throw new Error("Impossible de charger tes cartes.");
    return (data ?? []).map((m: any) => ({ id: m.id as string, name: m.name as string, tiles: m.tiles as number[], spawn: { x: m.spawn_x, y: m.spawn_y }, updated_at: m.updated_at as string }));
  });

export const saveMyMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(60), tiles: tilesSchema, spawn: z.object({ x: coord, y: coord }) }).parse(d))
  .handler(async ({ data, context }) => {
    const err = validateGrid(data.tiles, data.spawn);
    if (err) throw new Error(err);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = { name: data.name, tiles: data.tiles, spawn_x: data.spawn.x, spawn_y: data.spawn.y, updated_at: new Date().toISOString() };
    if (data.id) {
      const { data: upd, error } = await supabaseAdmin.from("custom_maps").update(row).eq("id", data.id).eq("owner_id", context.userId).select("id").maybeSingle();
      if (error || !upd) throw new Error("Enregistrement impossible.");
      return { id: upd.id as string };
    }
    const { data: ins, error } = await supabaseAdmin.from("custom_maps").insert({ ...row, owner_id: context.userId }).select("id").single();
    if (error) throw new Error("Enregistrement impossible.");
    return { id: ins.id as string };
  });

export const deleteMyMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("custom_maps").delete().eq("id", data.id).eq("owner_id", context.userId);
    if (error) throw new Error("Suppression impossible.");
    return { ok: true };
  });

async function assertNarrator(supabase: any, gameId: string, userId: string) {
  const { data: me } = await supabase.from("game_players").select("role").eq("game_id", gameId).eq("user_id", userId).maybeSingle();
  if (me?.role !== "narrator") throw new Error("Seul le narrateur de ce salon peut changer la carte.");
}

async function resolveMap(supabase: any, userId: string, ref: { prebuilt?: string | undefined; mapId?: string | undefined }): Promise<{ map: GridMap; source: string }> {
  let map: GridMap | undefined; let source = "";
  if (ref.mapId) {
    const { data: m } = await supabase.from("custom_maps").select("name, tiles, spawn_x, spawn_y").eq("id", ref.mapId).eq("owner_id", userId).maybeSingle();
    if (m) { map = { name: m.name, tiles: m.tiles, spawn: { x: m.spawn_x, y: m.spawn_y } }; source = `custom:${ref.mapId}`; }
  } else if (ref.prebuilt && PREBUILT_MAPS[ref.prebuilt]) { map = PREBUILT_MAPS[ref.prebuilt]; source = `prebuilt:${ref.prebuilt}`; }
  if (!map) throw new Error("Carte introuvable.");
  const err = validateGrid(map.tiles, map.spawn);
  if (err) throw new Error(err);
  return { map, source };
}

async function installMap(gameId: string, userId: string, map: GridMap, source: string, label = "Nouvelle carte") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("game_world_maps").upsert({ game_id: gameId, name: map.name, source, tiles: map.tiles, spawn_x: map.spawn.x, spawn_y: map.spawn.y, updated_at: new Date().toISOString() });
  if (error) throw new Error("Chargement de la carte impossible.");
  await supabaseAdmin.from("game_players").update({ world_x: map.spawn.x, world_y: map.spawn.y }).eq("game_id", gameId).eq("role", "adventurer");
  const { data: mobs } = await supabaseAdmin.from("game_enemies").select("id, tile_x, tile_y").eq("game_id", gameId).neq("status", "vaincu");
  for (const m of mobs ?? []) {
    const p = nearestWalkable(map, Math.min(GRID - 1, m.tile_x ?? map.spawn.x), Math.min(GRID - 1, m.tile_y ?? map.spawn.y));
    if (p.x !== m.tile_x || p.y !== m.tile_y) await supabaseAdmin.from("game_enemies").update({ tile_x: p.x, tile_y: p.y }).eq("id", m.id);
  }
  await supabaseAdmin.from("game_events").insert({ game_id: gameId, actor_id: userId, kind: "carte", message: `${label} : ${map.name}.`, payload: {}, important: true, secret: false });
}

/** Narrator-only: copy a prebuilt or personal map into the salon and move adventurers to its start. */
export const loadSalonMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: z.string().uuid(), prebuilt: z.string().max(40).optional(), mapId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertNarrator(context.supabase, data.gameId, context.userId);
    const { map, source } = await resolveMap(context.supabase, context.userId, data);
    await installMap(data.gameId, context.userId, map, source);
    return { name: map.name };
  });

const refSchema = z.object({ prebuilt: z.string().max(40).optional(), mapId: z.string().uuid().optional() });

/** Narrator-only: ordered list of maps for the salon and the current step. */
export const getMapSequence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertNarrator(context.supabase, data.gameId, context.userId);
    const { data: rows } = await context.supabase.from("game_map_sequence").select("position, name, source").eq("game_id", data.gameId).order("position");
    const { data: prog } = await context.supabase.from("game_map_progress").select("current_index").eq("game_id", data.gameId).maybeSingle();
    return { items: (rows ?? []).map((r: any) => ({ name: r.name as string, source: r.source as string })), current: (prog?.current_index as number | undefined) ?? -1 };
  });

export const saveMapSequence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: z.string().uuid(), items: z.array(refSchema).max(12) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertNarrator(context.supabase, data.gameId, context.userId);
    const resolved = [];
    for (const ref of data.items) resolved.push(await resolveMap(context.supabase, context.userId, ref));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("game_map_sequence").delete().eq("game_id", data.gameId);
    if (resolved.length) {
      const { error } = await supabaseAdmin.from("game_map_sequence").insert(resolved.map((r, i) => ({ game_id: data.gameId, position: i, name: r.map.name, source: r.source, tiles: r.map.tiles, spawn_x: r.map.spawn.x, spawn_y: r.map.spawn.y })));
      if (error) throw new Error("Enregistrement de l'ordre impossible.");
    }
    await supabaseAdmin.from("game_map_progress").upsert({ game_id: data.gameId, current_index: -1, updated_at: new Date().toISOString() });
    return { count: resolved.length };
  });

/** Narrator-only: install the map at `index` of the sequence (next step). */
export const goToSequenceMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: z.string().uuid(), index: z.number().int().min(0).max(11) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertNarrator(context.supabase, data.gameId, context.userId);
    const { data: row } = await context.supabase.from("game_map_sequence").select("name, source, tiles, spawn_x, spawn_y").eq("game_id", data.gameId).eq("position", data.index).maybeSingle();
    if (!row) throw new Error("Aucune carte à cette étape.");
    const map: GridMap = { name: row.name, tiles: row.tiles, spawn: { x: row.spawn_x, y: row.spawn_y } };
    await installMap(data.gameId, context.userId, map, row.source, `Carte ${data.index + 1}`);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("game_map_progress").upsert({ game_id: data.gameId, current_index: data.index, updated_at: new Date().toISOString() });
    return { name: map.name, index: data.index };
  });

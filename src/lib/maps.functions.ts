import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readyMapStep } from "./ready-maps";
import { TRACK_KEYS } from "./ambience-tracks";
import { blockedMapEnemies } from "./map-enemies";
import { cellWalkable, CELLS, DEFAULT_MAP_KEY, GRID, PREBUILT_MAPS, nearestWalkable, validateGrid, type GridMap } from "./map-grid";

const tilesSchema = z.array(z.number().int().min(0).max(10)).length(CELLS);
const coord = z.number().int().min(0).max(GRID - 1);
const mapEnemies = z.array(z.object({ catalogId: z.string().uuid(), x: coord, y: coord })).max(60).default([]);
export type MapEnemy = { catalogId: string; x: number; y: number };

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
    const { data, error } = await context.supabase.from("custom_maps").select("id, name, tiles, spawn_x, spawn_y, enemies, updated_at").eq("owner_id", context.userId).order("updated_at", { ascending: false });
    if (error) throw new Error("Impossible de charger tes cartes.");
    return (data ?? []).map((m: any) => ({ id: m.id as string, name: m.name as string, tiles: m.tiles as number[], spawn: { x: m.spawn_x, y: m.spawn_y }, enemies: (m.enemies ?? []) as MapEnemy[], updated_at: m.updated_at as string }));
  });

export const saveMyMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(60), tiles: tilesSchema, spawn: z.object({ x: coord, y: coord }), enemies: mapEnemies }).parse(d))
  .handler(async ({ data, context }) => {
    const err = validateGrid(data.tiles, data.spawn);
    if (err) throw new Error(err);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const g = { name: data.name, tiles: data.tiles, spawn: data.spawn };
    if (blockedMapEnemies({ ...g, enemies: data.enemies }).length) throw new Error("Un ennemi est placé sur un mur ou une barrière.");
    const row = { enemies: data.enemies, name: data.name, tiles: data.tiles, spawn_x: data.spawn.x, spawn_y: data.spawn.y, updated_at: new Date().toISOString() };
    if (data.id) {
      const { data: upd, error } = await supabaseAdmin.from("custom_maps").update(row).eq("id", data.id).eq("owner_id", context.userId).select("id").maybeSingle();
      if (error || !upd) throw new Error("Enregistrement impossible.");
      return { id: upd.id as string };
    }
    const { data: ins, error } = await supabaseAdmin.from("custom_maps").insert({ ...row, owner_id: context.userId }).select("id").single();
    if (error) throw new Error("Enregistrement impossible.");
    return { id: ins.id as string };
  });

/** Shared enemy catalog for the map editor (salon-specific custom enemies excluded). */
export const listMapEnemyCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("enemy_catalog").select("id, name, icon, category").is("game_id", null).order("name");
    if (error) throw new Error("Impossible de charger le catalogue d'ennemis.");
    return (data ?? []) as { id: string; name: string; icon: string; category: string }[];
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

async function resolveMap(supabase: any, userId: string, ref: { prebuilt?: string | undefined; mapId?: string | undefined }): Promise<{ map: GridMap; source: string; enemies: MapEnemy[]; treasures: MapEnemy[]; track: string | null }> {
  let map: GridMap | undefined; let source = ""; let enemies: MapEnemy[] = []; let treasures: MapEnemy[] = []; let track: string | null = null;
  if (ref.mapId) {
    const { data: m } = await supabase.from("custom_maps").select("name, tiles, spawn_x, spawn_y, enemies").eq("id", ref.mapId).eq("owner_id", userId).maybeSingle();
    if (m) { map = { name: m.name, tiles: m.tiles, spawn: { x: m.spawn_x, y: m.spawn_y } }; source = `custom:${ref.mapId}`; enemies = (m.enemies ?? []) as MapEnemy[]; }
  } else if (ref.prebuilt && PREBUILT_MAPS[ref.prebuilt]) { const ready = readyMapStep(ref.prebuilt); map = ready; source = ready.source; enemies = ready.enemies; treasures = ready.treasures ?? []; track = ready.track; }
  if (!map) throw new Error("Carte introuvable.");
  const err = validateGrid(map.tiles, map.spawn);
  if (err) throw new Error(err);
  return { map, source, enemies, treasures, track };
}

async function installMap(gameId: string, userId: string, map: GridMap, source: string, label = "Nouvelle carte", enemies: MapEnemy[] = [], treasures: MapEnemy[] = []) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const invalidGrid = validateGrid(map.tiles, map.spawn);
  if (invalidGrid) throw new Error(invalidGrid);
  for (const [table, placements] of [["enemy_catalog", enemies], ["treasure_catalog", treasures]] as const) {
    if (!placements.length) continue;
    const { data: catalogue, error } = await supabaseAdmin.from(table).select("id,game_id").in("id", placements.map((p) => p.catalogId));
    if (error || placements.some((p) => !cellWalkable(map, p.x, p.y) || !catalogue?.some((c: any) => c.id === p.catalogId && (!c.game_id || c.game_id === gameId)))) throw new Error("Un élément de la carte est inconnu ou sur une case bloquée.");
  }
  const { data: existingMap } = await supabaseAdmin.from("game_world_maps").select("source").eq("game_id", gameId).maybeSingle();
  // Only remove overlays authored by the outgoing map, never manually placed content or inventory.
  if (existingMap) {
    await supabaseAdmin.from("game_mob_control").update({ enemy_id: null }).eq("game_id", gameId);
    await supabaseAdmin.from("game_combats").update({ active: false }).eq("game_id", gameId);
    await supabaseAdmin.from("game_treasures").delete().eq("game_id", gameId).not("map_source", "is", null).eq("status", "cache");
    await supabaseAdmin.from("game_enemies").delete().eq("game_id", gameId).not("map_source", "is", null);
  }
  // Publish terrain before inserting mobs: collision triggers check the salon's current copy.
  const { error: mapError } = await supabaseAdmin.from("game_world_maps").upsert({ game_id: gameId, name: map.name, source, tiles: map.tiles, spawn_x: map.spawn.x, spawn_y: map.spawn.y, updated_at: new Date().toISOString() });
  if (mapError) throw new Error("Chargement de la carte impossible.");
  if (treasures.length) {
    const { data: adv } = await supabaseAdmin.from("game_players").select("current_zone").eq("game_id", gameId).eq("role", "adventurer").limit(1);
    const zone = adv?.[0]?.current_zone ?? "entree";
    const { data: cats, error } = await supabaseAdmin.from("treasure_catalog").select("*").in("id", [...new Set(treasures.map((t) => t.catalogId))]);
    if (error) throw new Error("Catalogue de trésors indisponible.");
    const rows = treasures.map((t) => {
      const c = cats?.find((c: any) => c.id === t.catalogId && (!c.game_id || c.game_id === gameId));
      if (!c || !cellWalkable(map, t.x, t.y)) throw new Error("Trésor inconnu ou sur une case bloquée.");
      return { game_id: gameId, map_source: source, catalog_id: c.id, name: c.name, type: c.type, rarity: c.rarity, effect: c.effect, value: c.value, placement: "coffre", zone, tile_x: t.x, tile_y: t.y };
    });
    const { error: inserted } = await supabaseAdmin.from("game_treasures").insert(rows);
    if (inserted) throw new Error("Placement des trésors impossible.");
  }
  if (enemies.length) {
    // Map-authored enemies arrive hidden in the zone the adventurers are in.
    const { data: adv } = await supabaseAdmin.from("game_players").select("current_zone").eq("game_id", gameId).eq("role", "adventurer");
    const zone = adv?.[0]?.current_zone ?? "entree";
    const ids = [...new Set(enemies.map((e) => e.catalogId))];
    const { data: cats, error: catalogError } = await supabaseAdmin.from("enemy_catalog").select("*").in("id", ids);
    if (catalogError) throw new Error("Impossible de charger les ennemis de cette carte.");
    const rows = enemies.flatMap((e) => {
      const c = (cats ?? []).find((k: any) => k.id === e.catalogId && (!k.game_id || k.game_id === gameId));
      if (!c || !cellWalkable(map, e.x, e.y)) return [];
      const hp = 10 + 2 * c.endurance;
      return [{ game_id: gameId, map_source: source, catalog_id: c.id, name: c.name, category: c.category, icon: c.icon, ability: c.ability, speed: c.speed, strength: c.strength, endurance: c.endurance, hp, max_hp: hp, threat_cost: c.threat_cost, zone, trigger: "entree", tile_x: e.x, tile_y: e.y }];
    });
    if (rows.length !== enemies.length) throw new Error("Un ennemi de cette carte est introuvable ou sur une case bloquée.");
    if (rows.length) {
      const { error: enemyError } = await supabaseAdmin.from("game_enemies").insert(rows);
      if (enemyError) throw new Error("Impossible de placer les ennemis de cette carte dans le salon.");
    }
  }
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
    const { map, source, enemies, treasures, track } = await resolveMap(context.supabase, context.userId, data);
    await installMap(data.gameId, context.userId, map, source, "Nouvelle carte", enemies, treasures);
    if (track) { const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); await supabaseAdmin.from("game_ambience").upsert({ game_id: data.gameId, track, state: "lecture" }, { onConflict: "game_id" }); }
    return { name: map.name };
  });

const refSchema = z.object({ prebuilt: z.string().max(40).optional(), mapId: z.string().uuid().optional() });

/** Narrator-only: ordered list of maps for the salon and the current step. */
export const getMapSequence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertNarrator(context.supabase, data.gameId, context.userId);
    const { data: rows } = await context.supabase.from("game_map_sequence").select("position, name, source, tiles, spawn_x, spawn_y, enemies, treasures, track, intro_text").eq("game_id", data.gameId).order("position");
    const { data: prog } = await context.supabase.from("game_map_progress").select("current_index").eq("game_id", data.gameId).maybeSingle();
    return {
      items: (rows ?? []).map((r: any) => ({ name: r.name as string, source: r.source as string, tiles: r.tiles as number[], spawn: { x: r.spawn_x as number, y: r.spawn_y as number }, enemies: (r.enemies ?? []) as MapEnemy[], treasures: (r.treasures ?? []) as MapEnemy[], track: (r.track ?? null) as string | null, intro: (r.intro_text ?? "") as string })),
      current: (prog?.current_index as number | undefined) ?? -1,
    };
  });

const stepSchema = z.object({
  name: z.string().trim().min(1).max(60), source: z.string().max(80), tiles: tilesSchema, spawn: z.object({ x: coord, y: coord }),
  enemies: mapEnemies, treasures: mapEnemies, track: z.enum(TRACK_KEYS).nullable(), intro: z.string().trim().max(1000),
});

/** Narrator-only: save every step (map copy, mobs, music, intro) of the salon's scenario at once. */
export const saveScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: z.string().uuid(), steps: z.array(stepSchema).max(12) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertNarrator(context.supabase, data.gameId, context.userId);
    data.steps.forEach((s, i) => {
      const err = validateGrid(s.tiles, s.spawn);
      if (err) throw new Error(`Étape ${i + 1} : ${err}`);
      if ([...s.enemies, ...s.treasures].some((e) => !cellWalkable(s, e.x, e.y))) throw new Error(`Étape ${i + 1} : un mob est sur un mur ou une barrière.`);
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids = [...new Set(data.steps.flatMap((s) => s.enemies.map((e) => e.catalogId)))];
    if (ids.length) {
      const { data: cats } = await supabaseAdmin.from("enemy_catalog").select("id, game_id").in("id", ids);
      const ok = new Set((cats ?? []).filter((c: any) => !c.game_id || c.game_id === data.gameId).map((c: any) => c.id));
      if (ids.some((id) => !ok.has(id))) throw new Error("Un mob du parcours est introuvable.");
    }
    const treasureIds = [...new Set(data.steps.flatMap((s) => s.treasures.map((t) => t.catalogId)))];
    if (treasureIds.length) {
      const { data: cats } = await supabaseAdmin.from("treasure_catalog").select("id,game_id").in("id", treasureIds);
      if (treasureIds.some((id) => !cats?.some((c: any) => c.id === id && (!c.game_id || c.game_id === data.gameId)))) throw new Error("Trésor du parcours introuvable.");
    }
    await supabaseAdmin.from("game_map_sequence").delete().eq("game_id", data.gameId);
    if (data.steps.length) {
      const { error } = await supabaseAdmin.from("game_map_sequence").insert(data.steps.map((s, i) => ({ game_id: data.gameId, position: i, name: s.name, source: s.source, tiles: s.tiles, spawn_x: s.spawn.x, spawn_y: s.spawn.y, enemies: s.enemies, treasures: s.treasures, track: s.track, intro_text: s.intro })));
      if (error) throw new Error("Enregistrement du parcours impossible.");
    }
    const { data: prog } = await supabaseAdmin.from("game_map_progress").select("current_index").eq("game_id", data.gameId).maybeSingle();
    const cur = (prog?.current_index as number | undefined) ?? -1;
    await supabaseAdmin.from("game_map_progress").upsert({ game_id: data.gameId, current_index: cur < data.steps.length ? cur : -1, updated_at: new Date().toISOString() });
    return { count: data.steps.length };
  });

/** Narrator-only: install the map at `index` of the sequence (next step), with its music and intro text. */
export const goToSequenceMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: z.string().uuid(), index: z.number().int().min(0).max(11) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertNarrator(context.supabase, data.gameId, context.userId);
    return activateSequenceMap(data.gameId, context.userId, data.index);
  });

/** Called after membership/role validation, including the salon start handler. */
export async function activateSequenceMap(gameId: string, userId: string, index: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin.from("game_map_sequence").select("*").eq("game_id", gameId).eq("position", index).maybeSingle();
  if (!row) throw new Error("Aucune carte à cette étape.");
  const map: GridMap = { name: row.name, tiles: row.tiles, spawn: { x: row.spawn_x, y: row.spawn_y } };
  await installMap(gameId, userId, map, row.source, `Étape ${index + 1}`, row.enemies as MapEnemy[], (row.treasures ?? []) as MapEnemy[]);
  await supabaseAdmin.from("game_map_progress").upsert({ game_id: gameId, current_index: index, updated_at: new Date().toISOString() });
  if (row.track) await supabaseAdmin.from("game_ambience").upsert({ game_id: gameId, track: row.track, state: "lecture", updated_at: new Date().toISOString() }, { onConflict: "game_id" });
  if (row.intro_text) await supabaseAdmin.from("game_events").insert({ game_id: gameId, actor_id: userId, kind: "niveau", message: row.intro_text, payload: { step: index + 1 }, important: true, secret: false });
  return { name: map.name, index };
}

export const listReadyMapSalons = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from("game_players").select("games(id,name,code,status,solo)").eq("user_id", context.userId).eq("role", "narrator");
  if (error) throw new Error("Salons indisponibles.");
  return (data ?? []).map((r: any) => r.games).filter((g: any) => g && g.status === "waiting" && !g.solo) as { id: string; name: string; code: string }[];
});

export const addReadyMap = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: z.string().uuid(), key: z.string().max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertNarrator(context.supabase, data.gameId, context.userId);
    const { data: game } = await context.supabase.from("games").select("status").eq("id", data.gameId).single();
    if (game?.status !== "waiting") throw new Error("Choisis un salon en préparation.");
    const { data: rows, error } = await context.supabase.from("game_map_sequence").select("position").eq("game_id", data.gameId).order("position");
    if (error) throw new Error("Parcours indisponible.");
    const position = rows?.length ?? 0;
    if (position >= 12) throw new Error("Le parcours contient déjà 12 cartes.");
    const step = readyMapStep(data.key);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: saved } = await supabaseAdmin.from("game_map_sequence").insert({ game_id: data.gameId, position, name: step.name, source: step.source, tiles: step.tiles, spawn_x: step.spawn.x, spawn_y: step.spawn.y, enemies: step.enemies, treasures: step.treasures ?? [], track: step.track, intro_text: step.intro });
    if (saved) throw new Error("Ajout de la carte impossible.");
    return { name: step.name, index: position };
  });

const userIdOrNull = (id: string) => id || null;

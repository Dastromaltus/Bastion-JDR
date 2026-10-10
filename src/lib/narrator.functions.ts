import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ZONES, ZONE_KEYS, zoneLabel, THREAT_PER_PLAYER, inventoryCategory } from "./races";
import { TRACK_KEYS, SFX_KEYS } from "./ambience-tracks";

type Ctx = { userId: string; supabase: any };

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
export function rollDie(sides = 6) {
  const buf = crypto.getRandomValues(new Uint32Array(1));
  return ((buf[0] ?? 0) % sides) + 1;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function membership(ctx: Ctx, gameId: string) {
  const { data } = await ctx.supabase.from("game_players").select("*").eq("game_id", gameId).eq("user_id", ctx.userId).maybeSingle();
  if (!data) throw new Error("Tu n'es pas membre de ce salon.");
  return data as any;
}
async function requireNarrator(ctx: Ctx, gameId: string) {
  const m = await membership(ctx, gameId);
  if (m.role !== "narrator") throw new Error("Seul le narrateur de ce salon peut faire ça.");
  return m;
}
export async function log(gameId: string, actorId: string | null, kind: string, message: string, payload: Record<string, unknown> = {}, important = false, secret = false) {
  const db = await admin();
  await db.from("game_events").insert({ game_id: gameId, actor_id: actorId, kind, message, payload, important, secret });
}
async function loadEnemy(ctx: Ctx, enemyId: string) {
  const db = await admin();
  const { data } = await db.from("game_enemies").select("*").eq("id", enemyId).maybeSingle();
  if (!data) throw new Error("Ennemi introuvable.");
  return data as any;
}

const uuid = z.string().uuid();
const stat = z.number().int().min(1, "Les stats vont de 1 à 5.").max(5, "Les stats vont de 1 à 5.");
const zone = z.enum(ZONE_KEYS, { message: "Cette zone n'existe pas dans le salon." });

/* ---------------- Ambience ---------------- */

export const setAmbience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      gameId: uuid,
      track: z.enum(TRACK_KEYS).optional(),
      state: z.enum(["lecture", "pause", "arret"]).optional(),
      volume: z.number().int().min(0).max(100).optional(),
      loop: z.boolean().optional(),
      sfx: z.enum(SFX_KEYS).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireNarrator(context, data.gameId);
    const { gameId, sfx, ...rest } = data;
    const patch: any = { game_id: gameId, updated_by: context.userId, updated_at: new Date().toISOString(), ...rest };
    if (sfx) { patch["sfx"] = sfx; patch["sfx_at"] = new Date().toISOString(); }
    // Written with the caller's client: RLS re-checks that they narrate this salon.
    const { error } = await context.supabase.from("game_ambience").upsert(patch, { onConflict: "game_id" });
    if (error) throw new Error("Ambiance non modifiée : seul le narrateur peut la changer.");
    return { ok: true };
  });

/* ---------------- Catalog ---------------- */

export const getNarratorCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await requireNarrator(context, data.gameId);
    const sb = context.supabase;
    const [e, t] = await Promise.all([
      sb.from("enemy_catalog").select("*").or(`game_id.is.null,game_id.eq.${data.gameId}`).order("threat_cost").order("name"),
      sb.from("treasure_catalog").select("*").or(`game_id.is.null,game_id.eq.${data.gameId}`).order("value"),
    ]);
    if (e.error || t.error) throw new Error("Catalogue indisponible, réessaie.");
    return { enemies: e.data ?? [], treasures: t.data ?? [] };
  });

export const createCustomEnemy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      gameId: uuid,
      name: z.string().trim().min(1, "Nom requis").max(40),
      category: z.string().trim().min(1, "Catégorie requise").max(40),
      description: z.string().trim().max(300).default(""),
      speed: stat, strength: stat, endurance: stat,
      ability: z.string().trim().max(120).default(""),
      threatCost: z.number().int().min(1).max(5),
      icon: z.string().trim().min(1).max(4).default("☠"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireNarrator(context, data.gameId);
    const db = await admin();
    const { error } = await db.from("enemy_catalog").insert({
      game_id: data.gameId, name: data.name, category: data.category, description: data.description,
      speed: data.speed, strength: data.strength, endurance: data.endurance, ability: data.ability,
      threat_cost: data.threatCost, icon: data.icon, created_by: context.userId,
    });
    if (error) throw new Error("Ennemi personnalisé non enregistré.");
    return { ok: true };
  });

export const createCustomTreasure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      gameId: uuid,
      name: z.string().trim().min(1, "Nom requis").max(40),
      type: z.enum(["consommable", "equipement", "arme", "cle", "quete"]),
      rarity: z.enum(["commun", "rare", "epique", "legendaire"]),
      description: z.string().trim().max(300).default(""),
      effect: z.string().trim().max(200).default(""),
      value: z.number().int().min(0).max(100000).default(0),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireNarrator(context, data.gameId);
    const db = await admin();
    const { gameId, ...rest } = data;
    const { error } = await db.from("treasure_catalog").insert({ game_id: gameId, created_by: context.userId, ...rest });
    if (error) throw new Error("Trésor personnalisé non enregistré.");
    return { ok: true };
  });

/* ---------------- Enemies ---------------- */

async function threatUsage(gameId: string) {
  const db = await admin();
  const [{ data: enemies }, { count }] = await Promise.all([
    db.from("game_enemies").select("threat_cost").eq("game_id", gameId),
    db.from("game_players").select("id", { count: "exact", head: true }).eq("game_id", gameId).eq("role", "adventurer"),
  ]);
  const used = (enemies ?? []).reduce((a: number, e: any) => a + e.threat_cost, 0);
  return { used, budget: (count ?? 0) * THREAT_PER_PLAYER };
}

export const placeEnemy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      gameId: uuid, catalogId: uuid, zone,
      trigger: z.enum(["entree", "porte", "manuel"]),
      speed: stat, strength: stat, endurance: stat,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireNarrator(context, data.gameId);
    const { requireSalonTurn } = await import("./turns.server");
    await requireSalonTurn(context, data.gameId, false);
    const db = await admin();
    const { data: cat } = await db.from("enemy_catalog").select("*").eq("id", data.catalogId).maybeSingle();
    if (!cat || (cat.game_id && cat.game_id !== data.gameId)) throw new Error("Cet ennemi n'est pas dans ton catalogue.");
    const { used, budget } = await threatUsage(data.gameId);
    if (budget === 0) throw new Error("Aucun aventurier dans le salon : budget de menace nul.");
    if (used + cat.threat_cost > budget)
      throw new Error(`Budget de menace dépassé : ${cat.name} coûte ${cat.threat_cost}, il ne reste que ${budget - used} point(s) sur ${budget}.`);
    const hp = 10 + 2 * data.endurance;
    const { error } = await db.from("game_enemies").insert({
      game_id: data.gameId, catalog_id: cat.id, name: cat.name, category: cat.category, icon: cat.icon, ability: cat.ability,
      speed: data.speed, strength: data.strength, endurance: data.endurance, hp, max_hp: hp, threat_cost: cat.threat_cost,
      zone: data.zone, trigger: data.trigger,
    });
    if (error) throw new Error("Placement impossible, réessaie.");
    await log(data.gameId, context.userId, "placement", `[Secret] ${cat.name} est caché dans ${zoneLabel(data.zone)}.`, { zone: data.zone }, false, true);
    return { ok: true };
  });

export const enemyAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ gameId: uuid, enemyId: uuid, action: z.enum(["reveal", "move", "remove", "defeat"]), zone: zone.optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireNarrator(context, data.gameId);
    const { requireSalonTurn } = await import("./turns.server");
    await requireSalonTurn(context, data.gameId, false);
    const enemy = await loadEnemy(context, data.enemyId);
    if (enemy.game_id !== data.gameId) throw new Error("Ennemi introuvable.");
    const db = await admin();
    switch (data.action) {
      case "reveal":
        if (enemy.status !== "cache") throw new Error("Cet ennemi est déjà révélé.");
        await revealEnemies(data.gameId, [enemy], null);
        break;
      case "move":
        if (!data.zone) throw new Error("Choisis une zone.");
        await db.from("game_enemies").update({ zone: data.zone }).eq("id", enemy.id);
        await log(data.gameId, context.userId, "placement", `[Secret] ${enemy.name} est déplacé vers ${zoneLabel(data.zone)}.`, {}, false, enemy.status === "cache");
        break;
      case "remove":
        await db.from("game_enemies").delete().eq("id", enemy.id);
        await log(data.gameId, context.userId, "placement", `[Secret] ${enemy.name} est retiré du parcours.`, {}, false, enemy.status === "cache");
        break;
      case "defeat":
        await defeatEnemy(data.gameId, enemy, null);
        break;
    }
    return { ok: true };
  });

export async function revealEnemies(gameId: string, enemies: any[], trigger: { by: string; zone: string } | null, label: (k: string) => string = zoneLabel) {
  const db = await admin();
  if (trigger) {
    await log(gameId, null, "declencheur", `Déclencheur : ${trigger.by} active ${enemies.map((e) => e.name).join(", ")} dans ${zoneLabel(trigger.zone)}.`, { zone: trigger.zone }, true, true);
    await log(gameId, null, "menace", "Quelque chose bouge dans l'ombre…", { zone: trigger.zone }, true);
    await sleep(1500);
  }
  const ids = enemies.map((e) => e.id);
  await db.from("game_enemies").update({ status: "revele", revealed_at: new Date().toISOString() }).in("id", ids);
  const { data: players } = await db.from("game_players").select("display_name, speed, current_zone").eq("game_id", gameId).eq("role", "adventurer");
  for (const e of enemies) {
    await log(gameId, null, "revelation", `${e.icon} ${e.name} surgit dans ${label(e.zone)} ! (Vit ${e.speed} · For ${e.strength} · End ${e.endurance} · ${e.hp} PV — ${e.ability})`, { enemy: e.name }, true);
    const fighters = (players ?? []).filter((p: any) => p.current_zone === e.zone);
    const order = [
      ...(fighters.length ? fighters : players ?? []).map((p: any) => { const r = rollDie(); return { name: p.display_name, roll: r, bonus: Math.floor(p.speed / 20), total: r + Math.floor(p.speed / 20) }; }),
      (() => { const r = rollDie(); return { name: e.name, roll: r, bonus: e.speed, total: r + e.speed }; })(),
    ].sort((a, b) => b.total - a.total);
    await log(gameId, null, "jet", `Initiative (Vitesse) : ${order.map((o) => `${o.name} ${o.roll}+${o.bonus}=${o.total}`).join(" > ")}.`, { stat: "vitesse", dice: 1, initiative: order }, true);
  }
}

export async function defeatEnemy(gameId: string, enemy: any, winner: { user_id: string; display_name: string } | null) {
  const db = await admin();
  await db.from("game_enemies").update({ status: "vaincu", hp: 0 }).eq("id", enemy.id);
  await log(gameId, winner?.user_id ?? null, "defaite-ennemi", `${enemy.name} est vaincu${winner ? ` par ${winner.display_name}` : ""} !`, {}, true);
  const { data: loot } = await db.from("game_treasures").select("*").eq("enemy_id", enemy.id).eq("status", "cache");
  if (loot?.length) {
    let to = winner;
    if (!to) {
      const { data: p } = await db.from("game_players").select("user_id, display_name").eq("game_id", gameId).eq("role", "adventurer").eq("current_zone", enemy.zone).limit(1).maybeSingle();
      to = p;
    }
    if (to) for (const t of loot) await discover(gameId, t, to, `sur ${enemy.name}`);
  }
  // Operation hook: defeating the boss of a "vaincre un boss" Operation ends the game.
  if (enemy.category === "boss") {
    const { data: dg } = await db.from("game_dungeons").select("id, status, dungeon_templates(objective_type)").eq("game_id", gameId).maybeSingle();
    if (dg && dg.status === "en_cours" && dg.dungeon_templates?.objective_type === "boss") {
      await db.from("game_dungeons").update({ status: "termine" }).eq("id", dg.id);
      await db.from("games").update({ status: "finished", ended_at: new Date().toISOString(), result: "victoire" }).eq("id", gameId);
      await log(gameId, null, "fin", "Objectif atteint : le boss est vaincu. Victoire des aventuriers !", { result: "victoire" }, true);
    }
  }
}

export async function discover(gameId: string, t: any, to: { user_id: string; display_name: string }, where: string) {
  const db = await admin();
  await db.from("game_inventory").insert({ game_id: gameId, owner_id: to.user_id, name: t.name, category: inventoryCategory(t.type), effect: t.effect, rarity: t.rarity });
  await db.from("game_treasures").update({ status: "decouvert", found_by: to.user_id, found_at: new Date().toISOString() }).eq("id", t.id);
  await log(gameId, to.user_id, "tresor", `✦ ${to.display_name} découvre ${t.name} (${t.rarity}) ${where}.`, { treasure: t.name, rarity: t.rarity }, true);
}

/* ---------------- Treasures ---------------- */

export const placeTreasure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      gameId: uuid, catalogId: uuid,
      placement: z.enum(["zone", "coffre", "ennemi", "direct"]),
      zone: zone.optional(), enemyId: uuid.optional(), targetUserId: uuid.optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireNarrator(context, data.gameId);
    const { requireSalonTurn } = await import("./turns.server");
    await requireSalonTurn(context, data.gameId, false);
    const db = await admin();
    const { data: cat } = await db.from("treasure_catalog").select("*").eq("id", data.catalogId).maybeSingle();
    if (!cat || (cat.game_id && cat.game_id !== data.gameId)) throw new Error("Ce trésor n'est pas dans ton catalogue.");
    const row: any = { game_id: data.gameId, catalog_id: cat.id, name: cat.name, type: cat.type, rarity: cat.rarity, effect: cat.effect, value: cat.value, placement: data.placement };
    if (data.placement === "zone" || data.placement === "coffre") {
      if (!data.zone) throw new Error("Choisis une zone.");
      row.zone = data.zone;
    }
    if (data.placement === "ennemi") {
      if (!data.enemyId) throw new Error("Choisis un ennemi placé.");
      const e = await loadEnemy(context, data.enemyId);
      if (e.game_id !== data.gameId || e.status === "vaincu") throw new Error("Cet ennemi n'est pas disponible.");
      row.enemy_id = e.id; row.zone = e.zone;
    }
    let target: any = null;
    if (data.placement === "direct") {
      if (!data.targetUserId) throw new Error("Choisis un joueur.");
      target = (await db.from("game_players").select("user_id, display_name").eq("game_id", data.gameId).eq("user_id", data.targetUserId).maybeSingle()).data;
      if (!target) throw new Error("Ce joueur n'est pas dans le salon.");
    }
    const { data: inserted, error } = await db.from("game_treasures").insert(row).select("*").single();
    if (error) throw new Error("Placement du trésor impossible.");
    if (target) await discover(data.gameId, inserted, target, "remis par le narrateur");
    else await log(data.gameId, context.userId, "placement", `[Secret] ${cat.name} placé (${data.placement}) — ${zoneLabel(row.zone)}.`, {}, false, true);
    return { ok: true };
  });

export const removeTreasure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: uuid, treasureId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await requireNarrator(context, data.gameId);
    const { requireSalonTurn } = await import("./turns.server");
    await requireSalonTurn(context, data.gameId, false);
    const db = await admin();
    await db.from("game_treasures").delete().eq("id", data.treasureId).eq("game_id", data.gameId).eq("status", "cache");
    return { ok: true };
  });

/* ---------------- Adventurer actions (triggers run server-side) ---------------- */

async function requireAdventurer(ctx: Ctx, gameId: string) {
  const me = await membership(ctx, gameId);
  if (me.role !== "adventurer") throw new Error("Seuls les aventuriers explorent le parcours.");
  const db = await admin();
  const { data: g } = await db.from("games").select("status").eq("id", gameId).single();
  if (g?.status !== "playing") throw new Error("La partie n'est pas en cours.");
  return me;
}

/** Boss rule: under 50 % HP it overheats (+1 Speed, takes +1 damage). */
export async function checkOverheat(gameId: string, e: any) {
  if (e.category !== "boss" || e.overheated || e.hp * 2 >= e.max_hp) return;
  const db = await admin();
  await db.from("game_enemies").update({ overheated: true, speed: Math.min(5, e.speed + 1) }).eq("id", e.id);
  await log(gameId, null, "revelation", `🔥 ${e.name} passe en SURCHAUFFE : +1 Vitesse, mais subit +1 dégât !`, { enemy: e.name }, true);
}

export const exploreAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: uuid, action: z.enum(["enter", "door", "chest"]), zone: zone.optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const me = await requireAdventurer(context, data.gameId);
    const { requireSalonTurn } = await import("./turns.server");
    await requireSalonTurn(context, data.gameId);
    const db = await admin();
    const { data: dg } = await db.from("game_dungeons").select("status").eq("game_id", data.gameId).maybeSingle();
    if (dg?.status === "en_cours") throw new Error("Une Opération est en cours : c'est le narrateur qui fait avancer la table de salle en salle.");
    let where = me.current_zone as string;
    if (data.action === "enter") {
      if (!data.zone) throw new Error("Choisis une zone.");
      where = data.zone;
      await db.from("game_players").update({ current_zone: where }).eq("id", me.id);
      await log(data.gameId, context.userId, "deplacement", `${me.display_name} entre dans ${zoneLabel(where)}.`, { zone: where });
    }
    if (data.action === "door") {
      if (!ZONES.find((z) => z.key === where)?.door) throw new Error("Il n'y a pas de porte ici.");
      await log(data.gameId, context.userId, "deplacement", `${me.display_name} ouvre la porte de ${zoneLabel(where)}.`, { zone: where });
    }
    // Treasures
    const placement = data.action === "chest" ? "coffre" : data.action === "enter" ? "zone" : null;
    let found = 0;
    if (placement) {
      const { data: loot } = await db.from("game_treasures").select("*").eq("game_id", data.gameId).eq("zone", where).eq("placement", placement).eq("status", "cache");
      for (const t of loot ?? []) { await discover(data.gameId, t, me, placement === "coffre" ? "dans un coffre" : `dans ${zoneLabel(where)}`); found++; }
      if (data.action === "chest" && !found) await log(data.gameId, context.userId, "deplacement", `${me.display_name} fouille un coffre vide.`);
    }
    // Hidden enemy triggers
    const trig = data.action === "enter" ? "entree" : data.action === "door" ? "porte" : null;
    let ambush = 0;
    if (trig) {
      const { data: hidden } = await db.from("game_enemies").select("*").eq("game_id", data.gameId).eq("zone", where).eq("trigger", trig).eq("status", "cache");
      if (hidden?.length) { await revealEnemies(data.gameId, hidden, { by: me.display_name, zone: where }); ambush = hidden.length; }
    }
    return { found, ambush };
  });

export const attackEnemy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: uuid, enemyId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const me = await requireAdventurer(context, data.gameId);
    const { requireSalonTurn } = await import("./turns.server");
    await requireSalonTurn(context, data.gameId);
    const db = await admin();
    const { data: e } = await context.supabase.from("game_enemies").select("*").eq("id", data.enemyId).eq("game_id", data.gameId).maybeSingle();
    if (!e || e.status !== "revele") throw new Error("Aucun ennemi visible à attaquer.");
    if (e.zone !== me.current_zone) throw new Error(`Rejoins ${zoneLabel(e.zone)} pour attaquer.`);
    if (me.hp <= 0) throw new Error("Tu es à terre.");
    const r = rollDie(), bonus = Math.floor(me.strength / 20), total = r + bonus, difficulty = 3 + e.speed;
    const hit = total >= difficulty;
    const shield = /bouclier/i.test(e.ability) ? 1 : 0;
    const dmg = hit ? Math.max(1, 1 + Math.floor(me.strength / 25) + rollDie(3) - shield + (e.overheated ? 1 : 0)) : 0;
    await log(data.gameId, context.userId, "jet", `${me.display_name} attaque ${e.name} : 1d6 ${r}+${bonus}=${total} vs ${difficulty} → ${hit ? `touché, ${dmg} dégâts` : "raté"}.`, { stat: "force", dice: 1, rolls: [r], bonus, total, difficulty, success: hit }, true);
    const hp = e.hp - dmg;
    if (hp <= 0) { await defeatEnemy(data.gameId, e, me); return { hit, dmg, defeated: true }; }
    await db.from("game_enemies").update({ hp }).eq("id", e.id);
    await checkOverheat(data.gameId, { ...e, hp });
    // Riposte
    const er = rollDie(), etotal = er + e.strength, edef = 3 + Math.floor(me.endurance / 25);
    const ehit = etotal >= edef;
    const edmg = ehit ? e.strength : 0;
    if (ehit) await db.from("game_players").update({ hp: Math.max(0, me.hp - edmg) }).eq("id", me.id);
    await log(data.gameId, null, "jet", `${e.name} riposte : 1d6 ${er}+${e.strength}=${etotal} vs ${edef} → ${ehit ? `${me.display_name} perd ${edmg} PV` : "esquivé"}.`, { stat: "force", dice: 1, rolls: [er], bonus: e.strength, total: etotal, difficulty: edef, success: ehit }, true);
    return { hit, dmg, defeated: false };
  });

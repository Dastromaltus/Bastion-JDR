import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RACES, RACE_NAMES, hpFor, THREAT_PER_PLAYER, type RaceName } from "./races";
import { admin, log, rollDie, revealEnemies, defeatEnemy, discover, checkOverheat } from "./narrator.functions";

type Ctx = { userId: string; supabase: any };
const uuid = z.string().uuid();

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

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

/** Stat on the 20–100 sheet scale → number of d6 (1 to 5). */
export function statDice(value: number) {
  return Math.max(1, Math.min(5, Math.round(value / 20)));
}
/** Reference rule: X d6, each 5 or 6 is a success. */
function pool(dice: number) {
  const rolls = Array.from({ length: dice }, () => rollDie(6));
  return { rolls, successes: rolls.filter((r) => r >= 5).length };
}

async function loadTemplate(templateId: string, gameId?: string) {
  const db = await admin();
  if (gameId) {
    const { data: copy } = await db.from("game_campaigns").select("snapshot,stage_index").eq("game_id", gameId).maybeSingle();
    const stage = copy?.snapshot?.stages?.[copy.stage_index];
    if (stage) return { t: stage.t, rooms: stage.rooms as any[], roomEnemies: [] as any[], roomTreasures: [] as any[], events: stage.events as any[] };
  }
  const { data: t } = await db.from("dungeon_templates").select("*").eq("id", templateId).maybeSingle();
  if (!t) throw new Error("Opération introuvable.");
  const { data: rooms } = await db.from("dungeon_rooms").select("*").eq("template_id", t.id).order("position");
  const ids = (rooms ?? []).map((r: any) => r.id);
  const [{ data: re }, { data: rt }, { data: ev }] = await Promise.all([
    db.from("dungeon_room_enemies").select("*, enemy_catalog(*)").in("room_id", ids),
    db.from("dungeon_room_treasures").select("*, treasure_catalog(*)").in("room_id", ids),
    db.from("dungeon_events").select("*").eq("template_id", t.id).order("threshold"),
  ]);
  return { t, rooms: (rooms ?? []) as any[], roomEnemies: (re ?? []) as any[], roomTreasures: (rt ?? []) as any[], events: (ev ?? []) as any[] };
}

async function budgetOf(gameId: string) {
  const db = await admin();
  const [{ data: enemies }, { count }, { data: g }] = await Promise.all([
    db.from("game_enemies").select("threat_cost, status").eq("game_id", gameId),
    db.from("game_players").select("id", { count: "exact", head: true }).eq("game_id", gameId).eq("role", "adventurer"),
    db.from("games").select("solo").eq("id", gameId).single(),
  ]);
  const used = (enemies ?? []).filter((e: any) => e.status !== "vaincu").reduce((a: number, e: any) => a + e.threat_cost, 0);
  const players = count ?? 0;
  return { used, budget: players * THREAT_PER_PLAYER, players, solo: !!g?.solo };
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = rollDie(i + 1) - 1; [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

/** Copies an Operation template into a salon (enemies, treasures, pending events). */
async function copyTemplate(gameId: string, templateId: string, opts: { reshuffle: boolean; status: "preparation" | "en_cours" }) {
  const db = await admin();
  const tpl = await loadTemplate(templateId);
  const { budget, players } = await budgetOf(gameId);
  await Promise.all([
    db.from("game_treasures").delete().eq("game_id", gameId).eq("status", "cache"),
    db.from("game_dungeon_events").delete().eq("game_id", gameId),
  ]);
  await db.from("game_enemies").delete().eq("game_id", gameId);

  let enemies = tpl.roomEnemies;
  let treasures = tpl.roomTreasures;
  if (opts.reshuffle) {
    const cap = Math.max(budget, THREAT_PER_PLAYER);
    const mustKeep = enemies.filter((e) => tpl.t.objective_type === "boss" && e.enemy_catalog.category === "boss");
    let used = mustKeep.reduce((a, e) => a + e.enemy_catalog.threat_cost, 0);
    const kept = [...mustKeep];
    for (const e of shuffle(enemies.filter((x) => !mustKeep.includes(x)))) {
      if (rollDie(4) === 1) continue; // random gaps even when budget allows
      if (used + e.enemy_catalog.threat_cost <= cap) { kept.push(e); used += e.enemy_catalog.threat_cost; }
    }
    enemies = kept;
    treasures = treasures.filter((t) => ["quete", "cle"].includes(t.treasure_catalog.type) || rollDie(5) > 2);
  }

  const firstByRoom = new Map<string, string>();
  for (const re of enemies) {
    const room = tpl.rooms.find((r) => r.id === re.room_id)!;
    const c = re.enemy_catalog;
    const hp = 10 + 2 * c.endurance;
    const { data: ins } = await db.from("game_enemies").insert({
      game_id: gameId, catalog_id: c.id, name: c.name, category: c.category, icon: c.icon, ability: c.ability,
      speed: c.speed, strength: c.strength, endurance: c.endurance, hp, max_hp: hp, threat_cost: c.threat_cost,
      zone: room.key, trigger: re.trigger,
    }).select("id").single();
    if (ins && !firstByRoom.has(room.key)) firstByRoom.set(room.key, ins.id);
  }
  for (const rt of treasures) {
    const room = tpl.rooms.find((r) => r.id === rt.room_id)!;
    const c = rt.treasure_catalog;
    const copies = rt.per_player ? Math.max(1, players) : 1;
    const enemyId = rt.container === "ennemi" ? firstByRoom.get(room.key) : undefined;
    const placement = rt.container === "ennemi" && enemyId ? "ennemi" : rt.container === "sol" ? "zone" : "coffre";
    for (let i = 0; i < copies; i++)
      await db.from("game_treasures").insert({
        game_id: gameId, catalog_id: c.id, name: c.name, type: c.type, rarity: c.rarity, effect: c.effect, value: c.value,
        placement, zone: room.key, enemy_id: enemyId ?? null,
      });
  }
  if (tpl.events.length)
    await db.from("game_dungeon_events").insert(tpl.events.map((e) => ({ game_id: gameId, threshold: e.threshold, effect: e.effect, text: e.text })));
  const first = tpl.rooms[0]!;
  await db.from("game_dungeons").upsert({
    game_id: gameId, template_id: tpl.t.id, status: opts.status, tension: 0, current_room: first.key, current_turn: 1,
    explored: [first.key], core_taken: false, door_locked: false, updated_at: new Date().toISOString(),
  }, { onConflict: "game_id" });
  return tpl;
}

async function getDungeonRow(gameId: string) {
  const db = await admin();
  const { data } = await db.from("game_dungeons").select("*").eq("game_id", gameId).maybeSingle();
  return data as any;
}

async function finish(gameId: string, result: "victoire" | "defaite", why: string) {
  const db = await admin();
  await db.from("game_dungeons").update({ status: "termine" }).eq("game_id", gameId);
  await db.from("games").update({ status: "finished", ended_at: new Date().toISOString(), result }).eq("id", gameId);
  await log(gameId, null, "fin", `${why} ${result === "victoire" ? "Victoire des aventuriers !" : "Défaite des aventuriers."}`, { result }, true);
}

async function fireEvent(gameId: string, ev: any, dg: any) {
  const db = await admin();
  await db.from("game_dungeon_events").update({ status: "declenche", triggered_at: new Date().toISOString() }).eq("id", ev.id);
  await log(gameId, null, "evenement", `⚠ Tension ${ev.threshold} — ${ev.text}`, { threshold: ev.threshold, effect: ev.effect }, true);
  if (ev.effect === "renforts" || ev.effect === "alarme") {
    const { data: c } = await db.from("enemy_catalog").select("*").is("game_id", null).eq("name", "Drone de patrouille").maybeSingle();
    if (c) {
      const hp = 10 + 2 * c.endurance;
      await db.from("game_enemies").insert({
        game_id: gameId, catalog_id: c.id, name: c.name, category: c.category, icon: c.icon, ability: c.ability, speed: c.speed, strength: c.strength,
        endurance: c.endurance, hp, max_hp: hp, threat_cost: c.threat_cost, zone: dg.current_room, trigger: "manuel", status: "revele", revealed_at: new Date().toISOString(),
      });
      await log(gameId, null, "revelation", `${c.icon} Un ${c.name} rejoint la salle (renfort).`, {}, true);
    }
  }
  if (ev.effect === "effondrement") {
    const { data: ps } = await db.from("game_players").select("id, hp").eq("game_id", gameId).eq("role", "adventurer");
    for (const p of ps ?? []) await db.from("game_players").update({ hp: Math.max(0, p.hp - 1) }).eq("id", p.id);
  }
}

async function setTension(gameId: string, dg: any, next: number) {
  const db = await admin();
  const value = Math.max(0, Math.min(20, next));
  await db.from("game_dungeons").update({ tension: value, updated_at: new Date().toISOString() }).eq("id", dg.id);
  await log(gameId, null, "tension", `Tension : ${dg.tension} → ${value}.`, { from: dg.tension, to: value }, false, true);
  if (value > dg.tension) {
    const { data: pending } = await db.from("game_dungeon_events").select("*").eq("game_id", gameId).eq("status", "a_venir").gt("threshold", dg.tension).lte("threshold", value).order("threshold");
    for (const ev of pending ?? []) await fireEvent(gameId, ev, dg);
  }
  return value;
}

async function markCore(gameId: string, dg: any, treasureNames: string[]) {
  if (dg.core_taken || !treasureNames.includes("Noyau du Bastion")) return;
  const db = await admin();
  await db.from("game_dungeons").update({ core_taken: true }).eq("id", dg.id);
  dg.core_taken = true;
  await log(gameId, null, "objectif", "Le Noyau est pris ! Le Bastion se réveille : la tension montera à chaque tour.", {}, true);
}

/** Enters a room: validates the connection, moves the table, resolves traps, treasures, triggers and objective. */
async function enterRoom(gameId: string, dg: any, roomKey: string, by: string) {
  const db = await admin();
  const tpl = await loadTemplate(dg.template_id, gameId);
  const from = tpl.rooms.find((r) => r.key === dg.current_room);
  const room = tpl.rooms.find((r) => r.key === roomKey);
  if (!room) throw new Error("Cette salle n'existe pas dans l'Opération.");
  if (!from?.connections.includes(roomKey)) throw new Error(`${room.name} n'est pas reliée à ${from?.name ?? "la salle actuelle"}.`);
  if (/carte d'accès rouge/i.test(room.hazard ?? "")) {
    const { count } = await db.from("game_inventory").select("id", { count: "exact", head: true }).eq("game_id", gameId).eq("name", "Carte d'accès rouge");
    if (!count) throw new Error(`${room.name} est verrouillé : il faut la carte d'accès rouge.`);
  }
  const blockers = (await db.from("game_enemies").select("name").eq("game_id", gameId).eq("zone", dg.current_room).eq("status", "revele")).data ?? [];
  if (blockers.length) throw new Error(`Impossible de quitter la salle : ${blockers.map((b: any) => b.name).join(", ")} bloque le passage.`);

  const explored = Array.from(new Set([...(dg.explored ?? []), roomKey]));
  await db.from("game_dungeons").update({ current_room: roomKey, explored, updated_at: new Date().toISOString() }).eq("id", dg.id);
  Object.assign(dg, { current_room: roomKey, explored });
  const { data: adv } = await db.from("game_players").select("*").eq("game_id", gameId).eq("role", "adventurer").order("joined_at");
  await db.from("game_players").update({ current_zone: roomKey }).eq("game_id", gameId).eq("role", "adventurer");
  await log(gameId, null, "salle", `${by} : la table entre dans ${room.name}. ${room.description}`, { room: roomKey }, true);
  if (room.lore) await log(gameId, null, "lore", `Fragment : ${room.lore}`, { room: roomKey });
  if (room.hazard_kind === "piege" && room.hazard) await log(gameId, null, "piege", `Piège : ${room.hazard}.`, { room: roomKey }, true);
  if (room.is_rest) {
    for (const p of adv ?? []) await db.from("game_players").update({ hp: p.max_hp }).eq("id", p.id);
    await log(gameId, null, "repos", "Salle de repos : tous les aventuriers récupèrent leurs PV et peuvent partager leur équipement.", {}, true);
  }
  const label = (k: string) => tpl.rooms.find((r) => r.key === k)?.name ?? k;
  // Floor treasures go to a random adventurer present.
  const { data: floor } = await db.from("game_treasures").select("*").eq("game_id", gameId).eq("zone", roomKey).eq("placement", "zone").eq("status", "cache");
  const names: string[] = [];
  for (const t of floor ?? []) {
    const p = (adv ?? [])[rollDie(Math.max(1, adv?.length ?? 1)) - 1];
    if (p) { await discover(gameId, t, p, `dans ${room.name}`); names.push(t.name); }
  }
  await markCore(gameId, dg, names);
  const { data: hidden } = await db.from("game_enemies").select("*").eq("game_id", gameId).eq("zone", roomKey).eq("trigger", "entree").eq("status", "cache");
  if (hidden?.length) await revealEnemies(gameId, hidden, { by, zone: roomKey }, label);
  // Objectives
  const last = tpl.rooms[tpl.rooms.length - 1]!;
  if (tpl.t.objective_type === "sortie" && roomKey === last.key) await finish(gameId, "victoire", `Objectif atteint : ${room.name} est atteint.`);
  if (tpl.t.objective_type === "objet" && dg.core_taken && roomKey === tpl.rooms[0]!.key) await finish(gameId, "victoire", "Objectif atteint : le Noyau est ramené au Hall central.");
  return room;
}

/** Turn mechanics shared by narrator and solo. */
async function advanceTurn(gameId: string, dg: any, tpl: Awaited<ReturnType<typeof loadTemplate>>) {
  const db = await admin();
  const turn = dg.current_turn + 1;
  await db.from("game_dungeons").update({ current_turn: turn }).eq("id", dg.id);
  dg.current_turn = turn;
  await log(gameId, null, "tour", `Tour ${turn}.`, { turn }, true);
  if (tpl.t.slug === "salle-des-machines" && turn % 2 === 0) {
    await db.from("game_dungeons").update({ door_locked: true }).eq("id", dg.id);
    await log(gameId, null, "verrou", "Une porte se verrouille ! Jet de Force ou de Vitesse, difficulté 3, pour la rouvrir.", {}, true);
  }
  if (dg.core_taken) dg.tension = await setTension(gameId, dg, dg.tension + 1);
  if (tpl.t.objective_type === "survie" && turn > tpl.t.target_turns) await finish(gameId, "victoire", `Objectif atteint : la table a survécu ${tpl.t.target_turns} tours.`);
}

/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

export const listOperations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [{ data: t, error }, { data: rooms }, { data: re }, { data: rt }, { data: ev }] = await Promise.all([
      sb.from("dungeon_templates").select("*").order("position"),
      sb.from("dungeon_rooms").select("*").order("position"),
      sb.from("dungeon_room_enemies").select("*, enemy_catalog(name, icon, category, speed, strength, endurance, ability, threat_cost)"),
      sb.from("dungeon_room_treasures").select("*, treasure_catalog(name, rarity, type, effect)"),
      sb.from("dungeon_events").select("*").order("threshold"),
    ]);
    if (error) throw new Error("Catalogue d'Opérations indisponible, réessaie.");
    const { data: mine } = await sb.from("game_players").select("role, games(id, code, name, status, solo)").eq("user_id", context.userId).eq("role", "narrator");
    return {
      operations: (t ?? []).map((tp: any) => {
        const rs = (rooms ?? []).filter((r: any) => r.template_id === tp.id);
        const ids = new Set(rs.map((r: any) => r.id));
        const enemies = (re ?? []).filter((e: any) => ids.has(e.room_id));
        return {
          ...tp,
          rooms: rs,
          enemies,
          treasures: (rt ?? []).filter((x: any) => ids.has(x.room_id)),
          events: (ev ?? []).filter((x: any) => x.template_id === tp.id),
          threat: enemies.reduce((a: number, e: any) => a + (e.enemy_catalog?.threat_cost ?? 0), 0),
        };
      }),
      mySalons: (mine ?? []).map((m: any) => m.games).filter((g: any) => g && g.status === "waiting" && !g.solo),
    };
  });

/* ------------------------------------------------------------------ */
/* Narrator: load, prepare, reshuffle                                  */
/* ------------------------------------------------------------------ */

export const loadOperation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: uuid, templateId: uuid, reshuffle: z.boolean().default(false) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireNarrator(context, data.gameId);
    const db = await admin();
    const { data: g } = await db.from("games").select("status").eq("id", data.gameId).single();
    if (g?.status !== "waiting") throw new Error("On ne charge une Opération qu'avant de lancer la partie.");
    await db.from("game_campaigns").delete().eq("game_id", data.gameId);
    if (data.reshuffle) {
      const dg = await getDungeonRow(data.gameId);
      if (!dg || dg.template_id !== data.templateId) throw new Error("Charge d'abord cette Opération.");
    }
    const tpl = await copyTemplate(data.gameId, data.templateId, { reshuffle: data.reshuffle, status: "preparation" });
    const b = await budgetOf(data.gameId);
    await log(data.gameId, context.userId, "operation", data.reshuffle ? `Opération « ${tpl.t.name} » remélangée.` : `Opération chargée : « ${tpl.t.name} ». Objectif : ${tpl.t.objective_text}.`, { template: tpl.t.slug }, true);
    await log(data.gameId, context.userId, "placement", `[Secret] Menace préplacée : ${b.used} / ${b.budget} points.`, b, false, true);
    return { ...b, over: b.used > b.budget };
  });

const prepSchema = z.object({
  gameId: uuid,
  op: z.enum(["swapEnemy", "removeEnemy", "addEnemy", "swapTreasure", "removeTreasure", "addTreasure"]),
  id: uuid.optional(),
  catalogId: uuid.optional(),
  room: z.string().max(40).optional(),
  trigger: z.enum(["entree", "porte", "manuel"]).optional(),
  container: z.enum(["coffre", "sol"]).optional(),
});

export const prepareOperation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => prepSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireNarrator(context, data.gameId);
    const db = await admin();
    const dg = await getDungeonRow(data.gameId);
    if (!dg || dg.status !== "preparation") throw new Error("Les modifications ne sont possibles qu'en préparation.");
    const tpl = await loadTemplate(dg.template_id, data.gameId);
    const room = data.room ? tpl.rooms.find((r) => r.key === data.room) : undefined;
    if (data.room && !room) throw new Error("Cette salle n'existe pas dans l'Opération.");
    const cat = async (table: "enemy_catalog" | "treasure_catalog") => {
      if (!data.catalogId) throw new Error("Choisis un élément du catalogue.");
      const { data: c } = await db.from(table).select("*").eq("id", data.catalogId).maybeSingle();
      if (!c || (c.game_id && c.game_id !== data.gameId)) throw new Error("Cet élément n'est pas dans ton catalogue.");
      if (table === "enemy_catalog" && [c.speed, c.strength, c.endurance].some((s: number) => s < 1 || s > 5)) throw new Error("Les stats vont de 1 à 5.");
      return c;
    };
    const ownEnemy = async () => {
      const { data: e } = await db.from("game_enemies").select("*").eq("id", data.id).eq("game_id", data.gameId).maybeSingle();
      if (!e) throw new Error("Ennemi introuvable.");
      return e;
    };
    const checkBudget = async (delta: number) => {
      const b = await budgetOf(data.gameId);
      if (b.used + delta > b.budget) throw new Error(`Budget de menace dépassé : +${delta} point(s) alors qu'il reste ${Math.max(0, b.budget - b.used)} point(s) sur ${b.budget}.`);
    };
    const enemyRow = (c: any, zone: string, trigger: string) => {
      const hp = 10 + 2 * c.endurance;
      return { catalog_id: c.id, name: c.name, category: c.category, icon: c.icon, ability: c.ability, speed: c.speed, strength: c.strength, endurance: c.endurance, hp, max_hp: hp, threat_cost: c.threat_cost, zone, trigger };
    };
    switch (data.op) {
      case "addEnemy": {
        if (!room) throw new Error("Choisis une salle.");
        const c = await cat("enemy_catalog");
        await checkBudget(c.threat_cost);
        await db.from("game_enemies").insert({ game_id: data.gameId, ...enemyRow(c, room.key, data.trigger ?? "entree") });
        await log(data.gameId, context.userId, "placement", `[Secret] ${c.name} ajouté dans ${room.name}.`, {}, false, true);
        break;
      }
      case "swapEnemy": {
        const e = await ownEnemy();
        const c = await cat("enemy_catalog");
        await checkBudget(c.threat_cost - e.threat_cost);
        await db.from("game_enemies").update(enemyRow(c, e.zone, e.trigger)).eq("id", e.id);
        await log(data.gameId, context.userId, "placement", `[Secret] ${e.name} remplacé par ${c.name}.`, {}, false, true);
        break;
      }
      case "removeEnemy": {
        const e = await ownEnemy();
        await db.from("game_treasures").update({ placement: "coffre", enemy_id: null }).eq("enemy_id", e.id);
        await db.from("game_enemies").delete().eq("id", e.id);
        await log(data.gameId, context.userId, "placement", `[Secret] ${e.name} retiré.`, {}, false, true);
        break;
      }
      case "addTreasure": {
        if (!room) throw new Error("Choisis une salle.");
        const c = await cat("treasure_catalog");
        await db.from("game_treasures").insert({ game_id: data.gameId, catalog_id: c.id, name: c.name, type: c.type, rarity: c.rarity, effect: c.effect, value: c.value, placement: data.container === "sol" ? "zone" : "coffre", zone: room.key });
        await log(data.gameId, context.userId, "placement", `[Secret] ${c.name} ajouté dans ${room.name}.`, {}, false, true);
        break;
      }
      case "swapTreasure": {
        const c = await cat("treasure_catalog");
        const { error } = await db.from("game_treasures").update({ catalog_id: c.id, name: c.name, type: c.type, rarity: c.rarity, effect: c.effect, value: c.value }).eq("id", data.id).eq("game_id", data.gameId).eq("status", "cache");
        if (error) throw new Error("Trésor introuvable.");
        break;
      }
      case "removeTreasure":
        await db.from("game_treasures").delete().eq("id", data.id).eq("game_id", data.gameId).eq("status", "cache");
        break;
    }
    return { ok: true };
  });

/** Called by narratorAction("start"): blocks over-budget launches and opens the first room. */
export async function startDungeonIfAny(gameId: string) {
  const dg = await getDungeonRow(gameId);
  if (!dg) return;
  const b = await budgetOf(gameId);
  if (b.used > b.budget) throw new Error(`Budget de menace dépassé : ${b.used} / ${b.budget} points (${THREAT_PER_PLAYER} par aventurier). Retire des ennemis ou clique « Remélanger » avant de lancer.`);
  return dg;
}
export async function openDungeon(gameId: string) {
  const dg = await getDungeonRow(gameId);
  if (!dg) return;
  const db = await admin();
  const tpl = await loadTemplate(dg.template_id, gameId);
  const first = tpl.rooms.find((r) => r.key === dg.current_room);
  if (!first) throw new Error("Salle initiale introuvable.");
  if (tpl.t.default_track) await db.from("game_ambience").upsert({ game_id: gameId, track: tpl.t.default_track, state: "lecture" }, { onConflict: "game_id" });
  await db.from("game_dungeons").update({ status: "en_cours" }).eq("id", dg.id);
  await db.from("game_players").update({ current_zone: first.key }).eq("game_id", gameId).eq("role", "adventurer");
  await log(gameId, null, "salle", `Opération « ${tpl.t.name} » : la table entre dans ${first.name}. ${first.description}`, { room: first.key }, true);
  const { data: hidden } = await db.from("game_enemies").select("*").eq("game_id", gameId).eq("zone", first.key).eq("trigger", "entree").eq("status", "cache");
  if (hidden?.length) await revealEnemies(gameId, hidden, null, (k) => tpl.rooms.find((r) => r.key === k)?.name ?? k);
}

/* ------------------------------------------------------------------ */
/* Narrator: live controls                                             */
/* ------------------------------------------------------------------ */

export const operationControl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      gameId: uuid,
      action: z.enum(["tension_up", "tension_down", "advance", "trigger_event", "next_turn", "reveal", "finish"]),
      room: z.string().max(40).optional(),
      eventId: uuid.optional(),
      enemyId: uuid.optional(),
      result: z.enum(["victoire", "defaite"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const me = await requireNarrator(context, data.gameId);
    const { requireSalonTurn } = await import("./turns.server");
    const game = await requireSalonTurn(context, data.gameId, false);
    const db = await admin();
    const dg = await getDungeonRow(data.gameId);
    if (!dg || dg.status !== "en_cours") throw new Error("Aucune Opération en cours dans ce salon.");
    const tpl = await loadTemplate(dg.template_id, data.gameId);
    switch (data.action) {
      case "tension_up": await setTension(data.gameId, dg, dg.tension + 1); break;
      case "tension_down": await setTension(data.gameId, dg, dg.tension - 1); break;
      case "advance":
        if (!data.room) throw new Error("Choisis une salle reliée.");
        await enterRoom(data.gameId, dg, data.room, me.display_name);
        break;
      case "trigger_event": {
        const { data: ev } = await db.from("game_dungeon_events").select("*").eq("id", data.eventId).eq("game_id", data.gameId).eq("status", "a_venir").maybeSingle();
        if (!ev) throw new Error("Événement introuvable ou déjà déclenché.");
        await fireEvent(data.gameId, ev, dg);
        break;
      }
      case "next_turn": {
        if (!game) throw new Error("Partie indisponible.");
        const { data: result, error } = await context.supabase.rpc("end_salon_turn", { p_game_id: data.gameId, p_revision: game.turn_revision });
        if (error) throw new Error(error.message);
        if ((result as { wrapped?: boolean } | null)?.wrapped) await advanceTurn(data.gameId, dg, tpl);
        break;
      }
      case "reveal": {
        const { data: e } = await db.from("game_enemies").select("*").eq("id", data.enemyId).eq("game_id", data.gameId).eq("status", "cache").maybeSingle();
        if (!e) throw new Error("Cet ennemi est déjà révélé.");
        await revealEnemies(data.gameId, [e], null, (k) => tpl.rooms.find((r) => r.key === k)?.name ?? k);
        break;
      }
      case "finish": await finish(data.gameId, data.result ?? "defaite", "Le narrateur clôt l'Opération."); break;
    }
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Read model (filtered on the server for players)                     */
/* ------------------------------------------------------------------ */

export const getSalonDungeon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const me = await membership(context, data.gameId);
    // RLS: members can read their salon's game_dungeons row.
    const { data: dg } = await context.supabase.from("game_dungeons").select("*").eq("game_id", data.gameId).maybeSingle();
    if (!dg) return null;
    const db = await admin();
    const tpl = await loadTemplate(dg.template_id, data.gameId);
    const t = tpl.t, rooms = tpl.rooms;
    const { data: campaignCopy } = await db.from("game_campaigns").select("stage_index,snapshot").eq("game_id", data.gameId).maybeSingle();
    const isNarr = me.role === "narrator";
    if (isNarr) {
      const [{ data: events }, b] = await Promise.all([
        context.supabase.from("game_dungeon_events").select("*").eq("game_id", data.gameId).order("threshold"),
        budgetOf(data.gameId),
      ]);
      return { campaign: campaignCopy ? { name: campaignCopy.snapshot.name, stage: campaignCopy.stage_index + 1, total: campaignCopy.snapshot.stages.length } : null, role: "narrator" as const, template: t, dungeon: dg, rooms: rooms ?? [], events: events ?? [], budget: b };
    }
    // Players: only the layout (greyed), explored names, current room details, triggered events. No tension, no hidden content.
    const explored = new Set<string>(dg.explored ?? []);
    const cur = (rooms ?? []).find((r: any) => r.key === dg.current_room);
    const { data: triggered } = await context.supabase.from("game_dungeon_events").select("id, text, triggered_at, status").eq("game_id", data.gameId);
    return {
      role: "adventurer" as const,
      template: { name: t.name, objective_text: t.objective_text, map_type: t.map_type, solo: t.solo },
      dungeon: { status: dg.status, current_room: dg.current_room, current_turn: dg.current_turn, door_locked: dg.door_locked, core_taken: dg.core_taken, explored: [...explored] },
      rooms: (rooms ?? []).map((r: any) => {
        const known = explored.has(r.key);
        return { key: r.key, grid_x: r.grid_x, grid_y: r.grid_y, connections: known ? r.connections : r.connections.filter((c: string) => explored.has(c)), name: known ? r.name : "???", explored: known };
      }),
      current: cur ? { key: cur.key, name: cur.name, description: cur.description, lore: cur.lore, hazard: cur.hazard, is_rest: cur.is_rest, connections: cur.connections } : null,
      events: (triggered ?? []).filter((e: any) => e.status === "declenche"),
    };
  });

/* ------------------------------------------------------------------ */
/* Adventurers in an Operation                                          */
/* ------------------------------------------------------------------ */

export const operationPlayerAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: uuid, action: z.enum(["search", "unlock_door"]), stat: z.enum(["force", "vitesse"]).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const me = await membership(context, data.gameId);
    if (me.role !== "adventurer") throw new Error("Seuls les aventuriers agissent dans les salles.");
    const { requireSalonTurn } = await import("./turns.server");
    await requireSalonTurn(context, data.gameId);
    const dg = await getDungeonRow(data.gameId);
    if (!dg || dg.status !== "en_cours") throw new Error("Aucune Opération en cours.");
    return playerAct(data.gameId, dg, me, data.action, data.stat ?? "force");
  });

export async function completeDungeonRound(gameId: string) {
  const dg = await getDungeonRow(gameId);
  if (!dg || dg.status !== "en_cours") return;
  await advanceTurn(gameId, dg, await loadTemplate(dg.template_id, gameId));
}

async function playerAct(gameId: string, dg: any, me: any, action: "search" | "unlock_door", stat: "force" | "vitesse") {
  const db = await admin();
  const tpl = await loadTemplate(dg.template_id, gameId);
  const room = tpl.rooms.find((r) => r.key === dg.current_room)!;
  if (action === "search") {
    const { data: loot } = await db.from("game_treasures").select("*").eq("game_id", gameId).eq("zone", room.key).eq("placement", "coffre").eq("status", "cache");
    for (const t of loot ?? []) await discover(gameId, t, me, `dans un coffre de ${room.name}`);
    if (!loot?.length) await log(gameId, me.user_id, "deplacement", `${me.display_name} fouille ${room.name} : rien.`);
    await markCore(gameId, dg, (loot ?? []).map((t: any) => t.name));
    return { found: loot?.length ?? 0 };
  }
  if (!dg.door_locked) throw new Error("Aucune porte verrouillée.");
  const dice = statDice(stat === "force" ? me.strength : me.speed);
  const r = pool(dice);
  const ok = r.successes >= 3;
  await log(gameId, me.user_id, "jet", `${me.display_name} force la porte (${stat === "force" ? "Force" : "Vitesse"}) : ${dice}d6 [${r.rolls.join(", ")}] → ${r.successes} réussite(s) / difficulté 3 → ${ok ? "porte rouverte" : "échec"}.`, { stat, dice, rolls: r.rolls, total: r.successes, difficulty: 3, success: ok }, true);
  if (ok) {
    await db.from("game_dungeons").update({ door_locked: false }).eq("id", dg.id);
    const { data: hidden } = await db.from("game_enemies").select("*").eq("game_id", gameId).eq("zone", room.key).eq("trigger", "porte").eq("status", "cache");
    if (hidden?.length) await revealEnemies(gameId, hidden, { by: me.display_name, zone: room.key }, (k) => tpl.rooms.find((x) => x.key === k)?.name ?? k);
  }
  return { success: ok };
}

/* ------------------------------------------------------------------ */
/* Solo mode (Operation 1, automatic enemies)                          */
/* ------------------------------------------------------------------ */

const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export const startSolo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ displayName: z.string().trim().min(1, "Nom requis").max(40), race: z.enum(RACE_NAMES as [RaceName, ...RaceName[]]) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: t } = await db.from("dungeon_templates").select("id, name").eq("solo", true).order("position").limit(1).single();
    if (!t) throw new Error("Aucune Opération solo disponible.");
    let game: any = null;
    for (let i = 0; i < 6 && !game; i++) {
      const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => CODE_ALPHABET[b % 36]).join("");
      const res = await db.from("games").insert({ code, name: `Solo — ${t.name}`, max_players: 1, scenario: "quete", status: "playing", locked: true, solo: true, started_at: new Date().toISOString(), created_by: context.userId }).select("*").single();
      if (res.data) game = res.data;
      else if (res.error?.code !== "23505") throw new Error("Impossible de créer la partie solo.");
    }
    if (!game) throw new Error("Impossible de générer un code, réessaie.");
    const race = data.race;
    await db.from("game_players").insert({ game_id: game.id, user_id: context.userId, display_name: data.displayName, role: "adventurer", race, ...RACES[race], hp: hpFor(race), max_hp: hpFor(race) });
    await log(game.id, context.userId, "systeme", `Mode solo : ${data.displayName} (${race}) affronte « ${t.name} ». Les ennemis sont automatiques.`, {}, true);
    await copyTemplate(game.id, t.id, { reshuffle: false, status: "preparation" });
    await openDungeon(game.id);
    return { code: game.code };
  });

export const soloAct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: uuid, action: z.enum(["move", "attack", "search", "wait"]), room: z.string().max(40).optional(), enemyId: uuid.optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const me = await membership(context, data.gameId);
    const db = await admin();
    const { data: g } = await db.from("games").select("solo, status").eq("id", data.gameId).single();
    if (!g?.solo) throw new Error("Cette action n'existe qu'en mode solo.");
    if (g.status !== "playing") throw new Error("La partie est terminée.");
    const dg = await getDungeonRow(data.gameId);
    if (!dg || dg.status !== "en_cours") throw new Error("Aucune Opération en cours.");
    if (me.hp <= 0) throw new Error("Tu es à terre.");
    const tpl = await loadTemplate(dg.template_id, data.gameId);
    const label = (k: string) => tpl.rooms.find((r) => r.key === k)?.name ?? k;

    // 1. Player action
    if (data.action === "move") {
      if (!data.room) throw new Error("Choisis une salle.");
      await enterRoom(data.gameId, dg, data.room, me.display_name);
    } else if (data.action === "search") {
      await playerAct(data.gameId, dg, me, "search", "force");
    } else if (data.action === "attack") {
      const { data: e } = await db.from("game_enemies").select("*").eq("id", data.enemyId).eq("game_id", data.gameId).eq("status", "revele").maybeSingle();
      if (!e || e.zone !== dg.current_room) throw new Error("Aucun ennemi visible à attaquer ici.");
      const dice = statDice(me.strength);
      const r = pool(dice);
      const shield = /bouclier/i.test(e.ability) ? 1 : 0;
      const dmg = r.successes ? Math.max(1, r.successes + 1 - shield + (e.overheated ? 1 : 0)) : 0;
      await log(data.gameId, me.user_id, "jet", `${me.display_name} attaque ${e.name} : Force ${dice}d6 [${r.rolls.join(", ")}] → ${r.successes} réussite(s) / difficulté 1 → ${dmg ? `${dmg} dégâts` : "raté"}.`, { stat: "force", dice, rolls: r.rolls, total: r.successes, difficulty: 1, success: dmg > 0 }, true);
      const hp = e.hp - dmg;
      if (hp <= 0) await defeatEnemy(data.gameId, e, me);
      else if (dmg) { await db.from("game_enemies").update({ hp }).eq("id", e.id); await checkOverheat(data.gameId, { ...e, hp }); }
    } else {
      await log(data.gameId, me.user_id, "deplacement", `${me.display_name} attend et reprend son souffle.`);
    }
    const { data: g2 } = await db.from("games").select("status").eq("id", data.gameId).single();
    if (g2?.status !== "playing") return { over: true };

    // 2. Enemy phase: simple rules — closest target, drones act every other turn.
    const turn = dg.current_turn;
    const { data: foes } = await db.from("game_enemies").select("*").eq("game_id", data.gameId).eq("status", "revele");
    const here = tpl.rooms.find((r) => r.key === dg.current_room)!;
    let hp = (await db.from("game_players").select("hp").eq("id", me.id).single()).data?.hp ?? me.hp;
    for (const e of foes ?? []) {
      const isDrone = /drone/i.test(e.name);
      if (isDrone && turn % 2 === 1) { await log(data.gameId, null, "ia", `${e.name} recalibre ses capteurs (agit un tour sur deux).`); continue; }
      if (e.zone !== here.key) {
        if (here.connections.includes(e.zone)) {
          await db.from("game_enemies").update({ zone: here.key }).eq("id", e.id);
          await log(data.gameId, null, "ia", `${e.name} quitte ${label(e.zone)} et fonce vers ${me.display_name} (cible la plus proche).`, {}, true);
        }
        continue;
      }
      const r = pool(e.strength);
      const dmg = r.successes;
      hp = Math.max(0, hp - dmg);
      await log(data.gameId, null, "jet", `${e.name} attaque ${me.display_name} : Force ${e.strength}d6 [${r.rolls.join(", ")}] → ${dmg ? `${dmg} PV perdus` : "raté"}.`, { stat: "force", dice: e.strength, rolls: r.rolls, total: r.successes, difficulty: 1, success: dmg > 0 }, true);
      if (hp <= 0) break;
    }
    await db.from("game_players").update({ hp }).eq("id", me.id);
    if (hp <= 0) { await finish(data.gameId, "defaite", `${me.display_name} tombe au combat.`); return { over: true }; }
    // 3. End of turn: tension rises every 2 turns in solo to showcase events.
    if (turn % 2 === 0) dg.tension = await setTension(data.gameId, dg, dg.tension + 1);
    await advanceTurn(data.gameId, dg, tpl);
    return { over: false };
  });

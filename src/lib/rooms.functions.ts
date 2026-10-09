import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RACES, RACE_NAMES, hpFor, SCENARIOS, type RaceName } from "./races";

const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % 36]).join("");
}

function toHex(buf: ArrayBuffer | Uint8Array) {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
function fromHex(hex: string) {
  return new Uint8Array(hex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
}

async function pbkdf2(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" }, key, 256);
  return toHex(bits);
}

async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${toHex(salt)}$${await pbkdf2(password, salt)}`;
}

async function verifyPassword(password: string, stored: string) {
  const [, saltHex, hash] = stored.split("$");
  const candidate = await pbkdf2(password, fromHex(saltHex));
  if (candidate.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

function rollDie(sides: number) {
  const buf = crypto.getRandomValues(new Uint32Array(1));
  return (buf[0] % sides) + 1;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Ctx = { userId: string; supabase: any };

async function membership(ctx: Ctx, gameId: string) {
  const { data } = await ctx.supabase
    .from("game_players")
    .select("id, role, display_name, user_id")
    .eq("game_id", gameId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!data) throw new Error("Tu n'es pas membre de ce salon.");
  return data as { id: string; role: string; display_name: string; user_id: string };
}

async function requireNarrator(ctx: Ctx, gameId: string) {
  const m = await membership(ctx, gameId);
  if (m.role !== "narrator") throw new Error("Seul le narrateur de ce salon peut faire ça.");
  return m;
}

async function logEvent(gameId: string, actorId: string | null, kind: string, message: string, payload: Record<string, unknown> = {}, important = false) {
  const db = await admin();
  await db.from("game_events").insert({ game_id: gameId, actor_id: actorId, kind, message, payload: payload as any, important });
}

const nameSchema = z.string().trim().min(1, "Nom requis").max(40);

/* ---------- Salons ---------- */

export const createRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().trim().min(1, "Nom du salon requis").max(60),
        maxPlayers: z.number().int().min(3).max(5),
        password: z.string().max(64).optional(),
        scenario: z.enum(SCENARIOS.map((s) => s.key) as [string, ...string[]]),
        displayName: nameSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    let code = "";
    let gameId = "";
    for (let i = 0; i < 6; i++) {
      code = randomCode();
      const { data: g, error } = await db
        .from("games")
        .insert({
          code,
          name: data.name,
          max_players: data.maxPlayers,
          scenario: data.scenario,
          has_password: !!data.password,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (!error && g) {
        gameId = g.id;
        break;
      }
      if (error && error.code !== "23505") throw new Error("Impossible de créer le salon.");
    }
    if (!gameId) throw new Error("Impossible de générer un code unique, réessaie.");
    if (data.password) {
      await db.from("game_secrets").insert({ game_id: gameId, password_hash: await hashPassword(data.password) });
    }
    await db.from("game_players").insert({
      game_id: gameId,
      user_id: context.userId,
      display_name: data.displayName,
      role: "narrator",
      ...RACES.Humain,
      hp: hpFor("Humain"),
      max_hp: hpFor("Humain"),
    });
    await logEvent(gameId, context.userId, "systeme", `${data.displayName} ouvre le salon « ${data.name} » et devient narrateur.`, {}, true);
    return { code };
  });

export const joinRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/, "Code invalide (6 caractères)"),
        password: z.string().max(64).optional(),
        displayName: nameSchema,
        race: z.enum(RACE_NAMES as [RaceName, ...RaceName[]]).default("Humain"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: game } = await db.from("games").select("*").eq("code", data.code).maybeSingle();
    if (!game) return { ok: false as const, error: "Aucun salon ne correspond à ce code." };
    const { data: existing } = await db
      .from("game_players")
      .select("id")
      .eq("game_id", game.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) return { ok: true as const, code: game.code };
    if (game.status !== "waiting") return { ok: false as const, error: "Cette partie a déjà commencé : impossible de la rejoindre." };
    if (game.locked) return { ok: false as const, error: "Le narrateur a verrouillé ce salon." };
    const { count } = await db.from("game_players").select("id", { count: "exact", head: true }).eq("game_id", game.id);
    if ((count ?? 0) >= game.max_players) return { ok: false as const, error: `Salon complet (${game.max_players} joueurs maximum).` };
    if (game.has_password) {
      const { data: secret } = await db.from("game_secrets").select("password_hash").eq("game_id", game.id).single();
      if (!data.password || !secret || !(await verifyPassword(data.password, secret.password_hash))) {
        return { ok: false as const, error: "Mot de passe incorrect.", needsPassword: true };
      }
    }
    const race = data.race;
    const { error } = await db.from("game_players").insert({
      game_id: game.id,
      user_id: context.userId,
      display_name: data.displayName,
      role: "adventurer",
      race,
      ...RACES[race],
      hp: hpFor(race),
      max_hp: hpFor(race),
    });
    if (error) return { ok: false as const, error: "Impossible de rejoindre le salon." };
    await logEvent(game.id, context.userId, "systeme", `${data.displayName} (${race}) rejoint le salon.`);
    return { ok: true as const, code: game.code };
  });

export const getRoomPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: z.string().trim().toUpperCase() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: game } = await db
      .from("games")
      .select("id, name, max_players, has_password, status, locked, scenario")
      .eq("code", data.code)
      .maybeSingle();
    if (!game) return null;
    const { count } = await db.from("game_players").select("id", { count: "exact", head: true }).eq("game_id", game.id);
    return { name: game.name, maxPlayers: game.max_players, hasPassword: game.has_password, status: game.status, locked: game.locked, scenario: game.scenario, players: count ?? 0 };
  });

export const listMyRooms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("game_players")
      .select("role, games(id, code, name, status, scenario, max_players, created_by, created_at, result)")
      .eq("user_id", context.userId);
    if (error) throw new Error("Impossible de charger tes salons.");
    return (data ?? [])
      .filter((r: any) => r.games)
      .map((r: any) => ({ role: r.role as string, ...r.games, isCreator: r.games.created_by === context.userId }))
      .sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));
  });

export const getRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: z.string().trim().toUpperCase() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: game } = await context.supabase.from("games").select("*").eq("code", data.code).maybeSingle();
    if (!game) return null;
    const [{ data: players }, { data: events }, { data: messages }, { data: inventory }] = await Promise.all([
      context.supabase.from("game_players").select("*").eq("game_id", game.id).order("joined_at"),
      context.supabase.from("game_events").select("*").eq("game_id", game.id).order("created_at", { ascending: false }).limit(80),
      context.supabase.from("game_messages").select("*").eq("game_id", game.id).order("created_at", { ascending: false }).limit(80),
      context.supabase.from("game_inventory").select("*").eq("game_id", game.id).order("created_at"),
    ]);
    const me = (players ?? []).find((p: any) => p.user_id === context.userId);
    let notes: any[] = [];
    let hiddenEnemies: any[] = [];
    if (me?.role === "narrator") {
      const [n, h] = await Promise.all([
        context.supabase.from("narrator_notes").select("*").eq("game_id", game.id).order("created_at", { ascending: false }),
        context.supabase.from("game_hidden_enemies").select("*").eq("game_id", game.id).order("created_at"),
      ]);
      notes = n.data ?? [];
      hiddenEnemies = h.data ?? [];
    }
    return {
      game,
      players: players ?? [],
      me: me ?? null,
      events: (events ?? []).reverse(),
      messages: (messages ?? []).reverse(),
      inventory: inventory ?? [],
      notes,
      hiddenEnemies,
    };
  });

export const narratorAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        gameId: z.string().uuid(),
        action: z.enum(["kick", "lock", "unlock", "start", "finish", "transfer"]),
        targetUserId: z.string().uuid().optional(),
        result: z.enum(["victoire", "defaite"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const me = await requireNarrator(context, data.gameId);
    const db = await admin();
    const target = data.targetUserId
      ? (await db.from("game_players").select("*").eq("game_id", data.gameId).eq("user_id", data.targetUserId).maybeSingle()).data
      : null;
    switch (data.action) {
      case "kick": {
        if (!target || target.user_id === context.userId) throw new Error("Joueur introuvable.");
        await db.from("game_players").delete().eq("id", target.id);
        await db.from("game_inventory").delete().eq("game_id", data.gameId).eq("owner_id", target.user_id);
        await logEvent(data.gameId, context.userId, "systeme", `${target.display_name} a été expulsé par le narrateur.`, {}, true);
        break;
      }
      case "lock":
      case "unlock":
        await db.from("games").update({ locked: data.action === "lock" }).eq("id", data.gameId);
        await logEvent(data.gameId, context.userId, "systeme", data.action === "lock" ? "Le salon est verrouillé." : "Le salon est déverrouillé.");
        break;
      case "start":
        await db.from("games").update({ status: "playing", started_at: new Date().toISOString(), locked: true }).eq("id", data.gameId).eq("status", "waiting");
        await logEvent(data.gameId, context.userId, "systeme", "La partie commence. Tour 1.", { turn: 1 }, true);
        break;
      case "finish":
        await db.from("games").update({ status: "finished", ended_at: new Date().toISOString(), result: data.result ?? "defaite" }).eq("id", data.gameId);
        await logEvent(data.gameId, context.userId, "fin", `Fin de partie : ${data.result === "victoire" ? "victoire des aventuriers" : "défaite des aventuriers"}.`, { result: data.result }, true);
        break;
      case "transfer": {
        if (!target || target.user_id === context.userId) throw new Error("Choisis un autre joueur du salon.");
        await db.from("game_players").update({ role: "adventurer" }).eq("id", me.id);
        await db.from("game_players").update({ role: "narrator" }).eq("id", target.id);
        await logEvent(data.gameId, context.userId, "systeme", `${me.display_name} transmet le rôle de narrateur à ${target.display_name}.`, {}, true);
        break;
      }
    }
    return { ok: true };
  });

export const leaveRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const me = await membership(context, data.gameId);
    const db = await admin();
    if (me.role === "narrator") {
      const { data: next } = await db
        .from("game_players")
        .select("id, display_name")
        .eq("game_id", data.gameId)
        .neq("user_id", context.userId)
        .order("joined_at")
        .limit(1)
        .maybeSingle();
      if (next) {
        await db.from("game_players").update({ role: "narrator" }).eq("id", next.id);
        await logEvent(data.gameId, null, "systeme", `${next.display_name} devient narrateur.`, {}, true);
      }
    }
    await db.from("game_players").delete().eq("id", me.id);
    await logEvent(data.gameId, context.userId, "systeme", `${me.display_name} quitte le salon.`);
    return { ok: true };
  });

export const updateCharacter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ gameId: z.string().uuid(), race: z.enum(RACE_NAMES as [RaceName, ...RaceName[]]), displayName: nameSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const me = await membership(context, data.gameId);
    const db = await admin();
    const { data: game } = await db.from("games").select("status").eq("id", data.gameId).single();
    if (game?.status !== "waiting") throw new Error("La fiche ne peut plus changer une fois la partie lancée.");
    await db
      .from("game_players")
      .update({ race: data.race, display_name: data.displayName, ...RACES[data.race], hp: hpFor(data.race), max_hp: hpFor(data.race) })
      .eq("id", me.id);
    return { ok: true };
  });

/* ---------- Dés ---------- */

export const rollCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        gameId: z.string().uuid(),
        stat: z.enum(["vitesse", "force", "endurance"]),
        dice: z.number().int().min(1).max(6),
        difficulty: z.number().int().min(1).max(60),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const me = await membership(context, data.gameId);
    const db = await admin();
    const { data: p } = await db.from("game_players").select("*").eq("id", me.id).single();
    const statValue = data.stat === "vitesse" ? p!.speed : data.stat === "force" ? p!.strength : p!.endurance;
    const rolls = Array.from({ length: data.dice }, () => rollDie(6));
    const bonus = Math.floor(statValue / 20);
    const total = rolls.reduce((a, b) => a + b, 0) + bonus;
    const success = total >= data.difficulty;
    const { count } = await db.from("game_events").select("id", { count: "exact", head: true }).eq("game_id", data.gameId).eq("kind", "tour");
    await logEvent(
      data.gameId,
      context.userId,
      "jet",
      `${me.display_name} lance ${data.dice}d6 en ${data.stat} : ${rolls.join("+")} +${bonus} = ${total} vs ${data.difficulty} → ${success ? "réussite" : "échec"}.`,
      { stat: data.stat, dice: data.dice, rolls, bonus, total, difficulty: data.difficulty, success, turn: (count ?? 0) + 1 },
      true,
    );
    return { rolls, bonus, total, success };
  });

export const nextTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireNarrator(context, data.gameId);
    const db = await admin();
    const { count } = await db.from("game_events").select("id", { count: "exact", head: true }).eq("game_id", data.gameId).eq("kind", "tour");
    const turn = (count ?? 0) + 2;
    await logEvent(data.gameId, context.userId, "tour", `Début du tour ${turn}.`, { turn }, true);
    return { turn };
  });

/* ---------- Inventaire ---------- */

const itemSchema = z.object({ gameId: z.string().uuid(), itemId: z.string().uuid() });

async function loadItem(gameId: string, itemId: string) {
  const db = await admin();
  const { data } = await db.from("game_inventory").select("*").eq("id", itemId).eq("game_id", gameId).maybeSingle();
  if (!data) throw new Error("Objet introuvable.");
  return data;
}

export const inventoryAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    itemSchema.extend({ action: z.enum(["use", "equip", "give", "discard"]), targetUserId: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const me = await membership(context, data.gameId);
    const item = await loadItem(data.gameId, data.itemId);
    if (item.owner_id !== context.userId && me.role !== "narrator") throw new Error("Cet objet ne t'appartient pas.");
    const db = await admin();
    switch (data.action) {
      case "use": {
        if (item.category !== "consommable") throw new Error("Seuls les consommables s'utilisent.");
        const heal = /(\d+)\s*PV/i.exec(item.effect)?.[1];
        if (heal) {
          const { data: p } = await db.from("game_players").select("id, hp, max_hp").eq("game_id", data.gameId).eq("user_id", item.owner_id).single();
          if (p) await db.from("game_players").update({ hp: Math.min(p.max_hp, p.hp + Number(heal)) }).eq("id", p.id);
        }
        if (item.quantity <= 1) await db.from("game_inventory").delete().eq("id", item.id);
        else await db.from("game_inventory").update({ quantity: item.quantity - 1 }).eq("id", item.id);
        await logEvent(data.gameId, context.userId, "objet", `${me.display_name} utilise ${item.name}${heal ? ` (+${heal} PV)` : ""}.`);
        break;
      }
      case "equip": {
        if (item.category !== "arme") throw new Error("Seules les armes s'équipent.");
        if (!item.equipped) await db.from("game_inventory").update({ equipped: false }).eq("game_id", data.gameId).eq("owner_id", item.owner_id).eq("category", "arme");
        await db.from("game_inventory").update({ equipped: !item.equipped }).eq("id", item.id);
        await logEvent(data.gameId, context.userId, "objet", `${me.display_name} ${item.equipped ? "range" : "équipe"} ${item.name}.`);
        break;
      }
      case "give": {
        if (!data.targetUserId || data.targetUserId === item.owner_id) throw new Error("Choisis un autre joueur.");
        const { data: target } = await db.from("game_players").select("display_name").eq("game_id", data.gameId).eq("user_id", data.targetUserId).maybeSingle();
        if (!target) throw new Error("Ce joueur n'est pas dans le salon.");
        await db.from("game_inventory").update({ owner_id: data.targetUserId, equipped: false }).eq("id", item.id);
        await logEvent(data.gameId, context.userId, "objet", `${me.display_name} donne ${item.name} à ${target.display_name}.`, {}, true);
        break;
      }
      case "discard":
        await db.from("game_inventory").delete().eq("id", item.id);
        await logEvent(data.gameId, context.userId, "objet", `${me.display_name} jette ${item.name}.`);
        break;
    }
    return { ok: true };
  });

export const narratorAddItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        gameId: z.string().uuid(),
        ownerId: z.string().uuid(),
        name: z.string().trim().min(1).max(40),
        category: z.enum(["arme", "consommable", "cle"]),
        effect: z.string().max(200).default(""),
        rarity: z.enum(["commun", "rare", "epique", "legendaire"]).default("commun"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireNarrator(context, data.gameId);
    const db = await admin();
    const { data: owner } = await db.from("game_players").select("display_name").eq("game_id", data.gameId).eq("user_id", data.ownerId).maybeSingle();
    if (!owner) throw new Error("Ce joueur n'est pas dans le salon.");
    await db.from("game_inventory").insert({ game_id: data.gameId, owner_id: data.ownerId, name: data.name, category: data.category, effect: data.effect, rarity: data.rarity });
    await logEvent(data.gameId, context.userId, "objet", `Le narrateur remet ${data.name} à ${owner.display_name}.`);
    return { ok: true };
  });

/* ---------- Social ---------- */

export const sendSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        gameId: z.string().uuid(),
        kind: z.enum(["reaction", "ping"]),
        value: z.enum(["Attention", "Besoin d'aide", "OK", "Attendre", "Ping"]),
        targetUserId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const me = await membership(context, data.gameId);
    let targetName = "";
    if (data.targetUserId) {
      const db = await admin();
      const { data: t } = await db.from("game_players").select("display_name").eq("game_id", data.gameId).eq("user_id", data.targetUserId).maybeSingle();
      if (!t) throw new Error("Ce joueur n'est pas dans le salon.");
      targetName = t.display_name;
    }
    const message = data.kind === "ping" ? `${me.display_name} ping ${targetName || "le groupe"}.` : `${me.display_name} : ${data.value}`;
    await logEvent(data.gameId, context.userId, data.kind, message, { value: data.value, target: data.targetUserId ?? null });
    return { ok: true };
  });

/* ---------- Rapport ---------- */

export const getReportData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const me = await membership(context, data.gameId);
    const sb = context.supabase;
    const [{ data: game }, { data: players }, { data: events }] = await Promise.all([
      sb.from("games").select("*").eq("id", data.gameId).single(),
      sb.from("game_players").select("display_name, race, role, speed, strength, endurance, hp, max_hp").eq("game_id", data.gameId).order("joined_at"),
      sb.from("game_events").select("kind, message, payload, important, created_at").eq("game_id", data.gameId).neq("kind", "reaction").neq("kind", "ping").order("created_at").limit(2000),
    ]);
    let notes: { body: string; created_at: string }[] = [];
    if (me.role === "narrator") {
      const { data: n } = await sb.from("narrator_notes").select("body, created_at").eq("game_id", data.gameId).order("created_at");
      notes = n ?? [];
    }
    return { game, players: players ?? [], events: events ?? [], notes, viewerRole: me.role };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import sectorMap from "@/data/sector-01.json";

const raceSchema = z.enum(["Humain", "Insecte", "Reptile", "Crustacé", "Oiseau"]);
const directionSchema = z.enum(["up", "down", "left", "right"]);
const SESSION_SLUG = "porte-rouge";

type MapLayer = { data: number[] };

function tileAt(x: number, y: number) {
  const layer = sectorMap.layers[0] as MapLayer | undefined;
  if (!layer || x < 0 || y < 0 || x >= sectorMap.width || y >= sectorMap.height) return 2;
  return layer.data[y * sectorMap.width + x] ?? 2;
}

function canCross(tile: number, race: z.infer<typeof raceSchema>) {
  if (tile === 2) return false;
  if (tile === 3) return race === "Oiseau";
  if (tile === 4) return race === "Reptile";
  if (tile === 5) return race === "Insecte";
  return true;
}

export const getExplorationState = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: session, error } = await supabaseAdmin
    .from("exploration_sessions")
    .select("id, name, objective, status")
    .eq("slug", SESSION_SLUG)
    .single();
  if (error || !session) throw new Error("Secteur indisponible");
  const [{ data: players }, { data: entities }, { data: events }] = await Promise.all([
    supabaseAdmin.from("exploration_players").select("id, client_key, name, race, tile_x, tile_y, hp").eq("session_id", session.id),
    supabaseAdmin.from("exploration_entities").select("id, kind, label, tile_x, tile_y, hp, locked, active").eq("session_id", session.id).eq("active", true),
    supabaseAdmin.from("exploration_events").select("id, event_type, message, payload, created_at").eq("session_id", session.id).order("created_at", { ascending: false }).limit(200),
  ]);
  const { data: saves } = await supabaseAdmin.from("exploration_saves").select("id, label, created_at").eq("session_id", session.id).order("created_at", { ascending: false }).limit(10);
  return { session, saves: saves ?? [], players: players ?? [], entities: entities ?? [], events: events ?? [] };
});

export const moveExplorer = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ clientKey: z.string().min(8).max(80), race: raceSchema, direction: directionSchema }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session } = await supabaseAdmin.from("exploration_sessions").select("id").eq("slug", SESSION_SLUG).single();
    if (!session) throw new Error("Secteur indisponible");
    const { data: existing } = await supabaseAdmin.from("exploration_players").select("id, tile_x, tile_y").eq("session_id", session.id).eq("client_key", data.clientKey).maybeSingle();
    const current = existing ?? { id: null, tile_x: 2, tile_y: 8 };
    const deltas: Record<z.infer<typeof directionSchema>, readonly [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const [deltaX, deltaY] = deltas[data.direction];
    const nextX = current.tile_x + deltaX;
    const nextY = current.tile_y + deltaY;
    const tile = tileAt(nextX, nextY);
    const { data: blocking } = await supabaseAdmin.from("exploration_entities").select("id, kind, label, locked").eq("session_id", session.id).eq("tile_x", nextX).eq("tile_y", nextY).eq("active", true);
    const door = blocking?.find((entity) => entity.kind === "door" && entity.locked);
    if (!canCross(tile, data.race) || door) return { moved: false, x: current.tile_x, y: current.tile_y, message: door ? "La porte est verrouillée." : "Passage impossible pour ce peuple." };
    if (tile === 6 && data.race === "Crustacé") {
      await supabaseAdmin.from("exploration_events").insert({ session_id: session.id, event_type: "ability", message: "Le Crustacé pulvérise la paroi fissurée." });
    }
    const playerData = { session_id: session.id, client_key: data.clientKey, race: data.race, tile_x: nextX, tile_y: nextY, updated_at: new Date().toISOString() };
    if (current.id) await supabaseAdmin.from("exploration_players").update(playerData).eq("id", current.id);
    else await supabaseAdmin.from("exploration_players").insert({ ...playerData, name: "Éclaireur" });
    await supabaseAdmin.from("exploration_events").insert({ session_id: session.id, event_type: "move", message: `${data.race} se déplace en (${nextX}, ${nextY}).`, payload: { x: nextX, y: nextY, race: data.race } });
    const encounter = blocking?.find((entity) => entity.kind === "enemy" || (entity.kind === "trap" && data.race !== "Oiseau"));
    const objective = blocking?.find((entity) => entity.kind === "objective");
    if (encounter) await supabaseAdmin.from("exploration_events").insert({ session_id: session.id, event_type: "combat", message: `${encounter.label} déclenche un affrontement !`, payload: { entityId: encounter.id } });
    if (objective) {
      await supabaseAdmin.from("exploration_sessions").update({ status: "objectif-atteint" }).eq("id", session.id);
      await supabaseAdmin.from("exploration_events").insert({ session_id: session.id, event_type: "objective", message: `Objectif atteint : ${objective.label}.` });
    }
    if (objective && data.race === "Humain") await supabaseAdmin.from("exploration_events").insert({ session_id: session.id, event_type: "ability", message: "L’Humain décrypte le relais et obtient un bonus d’interaction." });
    return { moved: true, x: nextX, y: nextY, encounter: encounter ? { id: encounter.id, label: encounter.label, kind: encounter.kind } : null, message: encounter ? `${encounter.label} vous barre la route.` : objective && data.race === "Humain" ? "Interaction réussie : bonus humain obtenu." : "Progression validée." };
  });

export const resolveCombatTurn = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ entityId: z.string().uuid(), action: z.enum(["Attaquer", "Compétence", "Objet", "Fuir"]), speed: z.number().int().min(1).max(100) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const randomValues = crypto.getRandomValues(new Uint32Array(2));
    const playerRoll = (randomValues[0] ?? 0) % 6 + 1;
    const enemyRoll = (randomValues[1] ?? 0) % 6 + 1;
    const initiative = data.speed + playerRoll >= 45 + enemyRoll ? "player" : "enemy";
    const damage = data.action === "Attaquer" ? playerRoll + 2 : data.action === "Compétence" ? playerRoll + 4 : 0;
    const { data: enemy } = await supabaseAdmin.from("exploration_entities").select("hp, label").eq("id", data.entityId).single();
    if (!enemy) throw new Error("Adversaire introuvable");
    const { data: ent } = await supabaseAdmin.from("exploration_entities").select("session_id").eq("id", data.entityId).single();
    const log = (message: string) => ent ? supabaseAdmin.from("exploration_events").insert({ session_id: ent.session_id, event_type: "dice", message, payload: { action: data.action, playerRoll, enemyRoll, initiative } }) : Promise.resolve();
    if (data.action === "Fuir") { await log(`Fuite face à ${enemy.label} — dés ${playerRoll} / ${enemyRoll} : ${playerRoll >= 4 ? "réussie" : "échouée"}.`); return { finished: true, won: false, text: playerRoll >= 4 ? "Retraite réussie." : "L’ennemi bloque la fuite !", enemyHp: enemy.hp ?? 1, rolls: [playerRoll, enemyRoll] }; }
    const nextHp = Math.max(0, (enemy.hp ?? 1) - damage);
    await supabaseAdmin.from("exploration_entities").update({ hp: nextHp, active: nextHp > 0 }).eq("id", data.entityId);
    await log(`${data.action} contre ${enemy.label} — dés ${playerRoll} / ${enemyRoll}, initiative ${initiative === "player" ? "joueur" : "ennemi"}, ${damage} dégâts${nextHp === 0 ? ", ennemi vaincu" : ""}.`);
    return { finished: nextHp === 0, won: nextHp === 0, text: `${initiative === "player" ? "Vous avez l’initiative" : "L’ennemi agit d’abord"}. ${damage} dégâts infligés.`, enemyHp: nextHp, rolls: [playerRoll, enemyRoll] };
  });

export const placeNarratorEntity = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ kind: z.enum(["enemy", "trap", "door", "event"]), x: z.number().int().min(1).max(17), y: z.number().int().min(1).max(9) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session } = await supabaseAdmin.from("exploration_sessions").select("id").eq("slug", SESSION_SLUG).single();
    if (!session || tileAt(data.x, data.y) === 2) throw new Error("Placement interdit");
    const labels = { enemy: "Ombre invoquée", trap: "Piège du narrateur", door: "Porte condamnée", event: "Événement inconnu" };
    const { data: entity, error } = await supabaseAdmin.from("exploration_entities").insert({ session_id: session.id, kind: data.kind, label: labels[data.kind], tile_x: data.x, tile_y: data.y, hp: data.kind === "enemy" ? 10 : null, locked: data.kind === "door" }).select("id").single();
    if (error) throw new Error("Placement refusé");
    await supabaseAdmin.from("exploration_events").insert({ session_id: session.id, event_type: "narration", message: `Le narrateur place : ${labels[data.kind]}.` });
    return { ok: true, id: entity.id };
  });
export const saveGame = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ label: z.string().trim().min(1).max(60) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session } = await supabaseAdmin.from("exploration_sessions").select("id, status").eq("slug", SESSION_SLUG).single();
    if (!session) throw new Error("Secteur indisponible");
    const [{ data: players }, { data: entities }] = await Promise.all([
      supabaseAdmin.from("exploration_players").select("*").eq("session_id", session.id),
      supabaseAdmin.from("exploration_entities").select("*").eq("session_id", session.id),
    ]);
    await supabaseAdmin.from("exploration_saves").insert({ session_id: session.id, label: data.label, snapshot: { status: session.status, players: players ?? [], entities: entities ?? [] } });
    await supabaseAdmin.from("exploration_events").insert({ session_id: session.id, event_type: "save", message: `Partie enregistrée : ${data.label}.` });
    return { ok: true };
  });

export const loadGame = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ saveId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: save } = await supabaseAdmin.from("exploration_saves").select("session_id, label, snapshot").eq("id", data.saveId).single();
    if (!save) throw new Error("Sauvegarde introuvable");
    const snap = save.snapshot as { status: string; players: never[]; entities: never[] };
    await supabaseAdmin.from("exploration_players").delete().eq("session_id", save.session_id);
    await supabaseAdmin.from("exploration_entities").delete().eq("session_id", save.session_id);
    if (snap.players.length) await supabaseAdmin.from("exploration_players").insert(snap.players);
    if (snap.entities.length) await supabaseAdmin.from("exploration_entities").insert(snap.entities);
    await supabaseAdmin.from("exploration_sessions").update({ status: snap.status }).eq("id", save.session_id);
    await supabaseAdmin.from("exploration_events").insert({ session_id: save.session_id, event_type: "load", message: `Partie reprise : ${save.label}.` });
    return { ok: true };
  });

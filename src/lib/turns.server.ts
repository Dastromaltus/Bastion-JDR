import { salonTurn } from "./turn-order";

// Used only inside authenticated server handlers, with the caller's RLS client.
export async function requireSalonTurn(ctx: { supabase: any; userId: string }, gameId: string, playingOnly = true) {
  const { data: game, error } = await ctx.supabase.from("games").select("status, solo, turn_player_id, turn_round, turn_revision").eq("id", gameId).maybeSingle();
  if (error || !game) throw new Error("Salon inaccessible.");
  if (game.status !== "playing") {
    if (playingOnly) throw new Error("La partie n’est pas en cours.");
    return;
  }
  const { data: players, error: rosterError } = await ctx.supabase.from("game_players").select("id, user_id, role, display_name, joined_at, hp").eq("game_id", gameId);
  if (rosterError || !players?.some((p: any) => p.user_id === ctx.userId)) throw new Error("Tu n’es pas membre de ce salon.");
  const turn = salonTurn(game, players, ctx.userId);
  if (!turn.isMine) throw new Error(turn.label);
  return game;
}
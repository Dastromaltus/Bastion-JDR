export type TurnPlayer = { id: string; user_id: string; role: string; display_name: string; joined_at: string; hp: number };
export type TurnGame = { solo?: boolean; turn_player_id?: string | null; turn_round?: number; turn_revision?: number };

export function turnOrder(players: TurnPlayer[]) {
  return [...players].sort((a, b) => Number(a.role === "narrator") - Number(b.role === "narrator") || a.joined_at.localeCompare(b.joined_at) || a.id.localeCompare(b.id));
}
export function salonTurn(game: TurnGame, players: TurnPlayer[], userId: string) {
  const order = turnOrder(players);
  const available = order.filter((p) => p.role === "narrator" || p.hp > 0);
  const active = available.find((p) => p.id === game.turn_player_id) ?? available[0];
  const number = active?.role === "adventurer" ? order.filter((p) => p.role === "adventurer").findIndex((p) => p.id === active.id) + 1 : null;
  const label = active ? active.role === "narrator" ? `Tour du narrateur · ${active.display_name}` : `Tour de joueur ${number} · ${active.display_name}` : "Aucun participant disponible";
  const isMine = !!game.solo || active?.user_id === userId;
  return { order, active, isMine, label, message: isMine ? "C’est à ton tour !" : label };
}
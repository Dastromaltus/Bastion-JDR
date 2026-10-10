import { worldPosition } from "./world-map";

export type WorldParticipant = {
  id: string; display_name: string; role: string; race: string;
  current_zone?: string | null; world_x?: number; world_y?: number; world_zone?: string | null;
};
export type WorldActor = { id: string; name: string; x: number; y: number; frame: number };
const FRAMES: Record<string, number> = { Humain: 7, Insecte: 8, Reptile: 9, Crustacé: 10, Oiseau: 11 };

/** The narrator is an observer, not a movable adventurer. */
export function participantActors(players: WorldParticipant[], zone: string, ownId: string): WorldActor[] {
  return players.filter((p) => p.role === "adventurer" && (p.current_zone ?? "entree") === zone).map((p) => ({
    id: p.id,
    name: `${p.display_name}${p.role === "narrator" ? " · narrateur" : ""}${p.id === ownId ? " · toi" : ""}`,
    ...(p.role === "narrator" ? { x: 12, y: 6 } : worldPosition(p, zone)),
    frame: p.role === "narrator" ? 7 : FRAMES[p.race] ?? 7,
  }));
}
import { worldPosition } from "./world-map";
import type { GridMap } from "./map-grid";

export type WorldParticipant = {
  id: string; display_name: string; role: string; race: string;
  current_zone?: string | null; world_x?: number; world_y?: number; world_zone?: string | null;
};
export type WorldActor = { id: string; name: string; x: number; y: number; frame: number; hp?: number; sprite?: "zombie"; dead?: boolean };
/** Monsters named "Zombie…" use the animated zombie sprite sheet. */
export const isZombie = (name: string) => /zombie/i.test(name);
const FRAMES: Record<string, number> = { Humain: 7, Insecte: 8, Reptile: 9, Crustacé: 10, Oiseau: 11 };

/** The narrator is an observer, not a movable adventurer. */
export function participantActors(players: WorldParticipant[], zone: string, ownId: string, map?: GridMap): WorldActor[] {
  return players.filter((p) => p.role === "adventurer" && (p.current_zone ?? "entree") === zone).map((p) => ({
    id: p.id,
    name: `${p.display_name}${p.role === "narrator" ? " · narrateur" : ""}${p.id === ownId ? " · toi" : ""}`,
    ...(p.role === "narrator" ? { x: 12, y: 6 } : worldPosition(p, zone, map)),
    frame: p.role === "narrator" ? 7 : FRAMES[p.race] ?? 7,
  }));
}
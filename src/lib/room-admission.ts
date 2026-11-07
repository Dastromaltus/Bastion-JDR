type Admission = { status: string; locked: boolean; players: number; maxPlayers: number };

/** Shared by invitation UI and server; password verification remains server-only. */
export function roomAdmissionError(room: Admission): string | null {
  if (room.status !== "waiting" && room.status !== "playing") return "Cette partie est terminée : impossible de la rejoindre.";
  if (room.locked) return "Le narrateur a verrouillé ce salon.";
  if (room.players >= room.maxPlayers) return `Salon complet (${room.maxPlayers} joueurs maximum).`;
  return null;
}
type MovementState = { status: string; role: string; hp: number; sameZone: boolean; explorationTurn: boolean; combat?: { active?: boolean; isMine?: boolean } | null };

export function worldMovementAllowed(state: MovementState): boolean {
  if (state.status !== "playing" || state.role !== "adventurer" || state.hp <= 0 || !state.sameZone) return false;
  return state.combat?.active ? state.combat.isMine === true : state.explorationTurn;
}
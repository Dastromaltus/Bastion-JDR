type MovementState = { status: string; role: string; hp: number; sameZone: boolean; explorationTurn: boolean; combat?: { active?: boolean; isMine?: boolean } | null };

export function worldMovementAllowed(state: MovementState): boolean {
  if (state.status !== "playing" || state.role !== "adventurer" || state.hp <= 0 || !state.sameZone) return false;
  return state.combat?.active ? state.combat.isMine === true : state.explorationTurn;
}
type MobState = { status: string; role: string; controlledId?: string | null; combat?: { active?: boolean; current?: { id?: string; kind?: string } | null } | null };

/** The narrator moves the controlled mob with ZQSD only during that mob's combat turn. */
export function mobMovementAllowed(state: MobState): boolean {
  if (state.status !== "playing" || state.role !== "narrator" || !state.controlledId || !state.combat?.active) return false;
  return state.combat.current?.kind === "enemy" && state.combat.current.id === state.controlledId;
}

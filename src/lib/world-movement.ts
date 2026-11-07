type MovementState = { status: string; role: string; hp: number; sameZone: boolean; explorationTurn?: boolean; combat?: unknown };

/** Free movement: a living adventurer moves whenever the game is playing; turns only gate attacks and abilities. */
export function worldMovementAllowed(state: MovementState): boolean {
  return state.status === "playing" && state.role === "adventurer" && state.hp > 0 && state.sameZone;
}

type MobState = { status: string; role: string; controlledId?: string | null; combat?: unknown };

/** The narrator moves the selected (or current-turn) mob with ZQSD at any time during play. */
export function mobMovementAllowed(state: MobState): boolean {
  return state.status === "playing" && state.role === "narrator" && !!state.controlledId;
}

/** The server rechecks visibility and membership before applying damage. */
export function worldAttackAllowed(input: { status: string; role: string; hp: number; enemyVisible: boolean; enemyAlive: boolean; busy: boolean }) {
  return input.status === "playing" && input.role === "adventurer" && input.hp > 0 && input.enemyVisible && input.enemyAlive && !input.busy;
}
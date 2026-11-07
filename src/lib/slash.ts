export const SLASH_DAMAGE = 2;

export function slashKeyPressed(key: string, code: string, repeat: boolean, editing: boolean) {
  return !repeat && !editing && (key === "7" || code === "Digit7" || code === "Numpad7");
}

export function slashTarget<T extends { id: string; zone: string; hp: number; status: string; tile_x: number | null; tile_y: number | null }>(enemies: T[], selectedId: string | null, zone: string, position: { x: number; y: number }) {
  const visible = enemies.filter((e) => e.zone === zone && e.hp > 0 && e.status !== "vaincu" && e.tile_x !== null && e.tile_y !== null);
  return visible.find((e) => e.id === selectedId) ?? visible.sort((a, b) => Math.abs((a.tile_x ?? 0) - position.x) + Math.abs((a.tile_y ?? 0) - position.y) - Math.abs((b.tile_x ?? 0) - position.x) - Math.abs((b.tile_y ?? 0) - position.y))[0];
}
/** Visual frame offsets only: the authoritative Tiled collision map stays unchanged. */
export const WORLD_DECOR_ROWS: Record<string, number> = {
  entree: 1,
  "couloir-a": 2,
  "salle-machines": 3,
  "porte-scellee": 4,
  laboratoire: 5,
  coeur: 6,
};

export function worldDecorFrame(tile: number, zone: string) {
  return (WORLD_DECOR_ROWS[zone] ?? WORLD_DECOR_ROWS["entree"] ?? 1) * 16 + tile - 1;
}
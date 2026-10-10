export type Placement = { id: string; room_key: string; kind: "mob" | "treasure"; catalog_id: string; hidden: boolean; trigger: "entree" | "porte" | "manuel"; tile_x: number; tile_y: number; overrides: Record<string, number> };
export type Stage = { template_id: string; position: number; objective: string; objective_room: string; exit_room: string; intro_text: string; track: string; placements: Placement[] };
export type Campaign = { id?: string; revision: number; name: string; summary: string; difficulty: string; recommended_players: number; is_template: boolean; status: string; stages: Stage[] };
export function campaignIssues(c: Campaign, operations: any[], enemies: any[]) {
  const issues: string[] = [];
  if (!c.name.trim()) issues.push("Nom de campagne manquant.");
  if (!c.stages.length) issues.push("Ajoute une étape.");
  c.stages.forEach((s, i) => {
    const op = operations.find((o) => o.id === s.template_id);
    if (!op) { issues.push(`Étape ${i + 1} : map inconnue.`); return; }
    const seen = new Set<string>(); const queue = [op.rooms[0]?.key];
    while (queue.length) { const k = queue.shift(); if (!k || seen.has(k)) continue; seen.add(k); const room = op.rooms.find((r: any) => r.key === k); if (room) queue.push(...room.connections); }
    if (op.rooms.some((r: any) => !seen.has(r.key))) issues.push(`Étape ${i + 1} : salle inaccessible.`);
    if (!s.objective.trim() || !seen.has(s.objective_room)) issues.push(`Étape ${i + 1} : objectif impossible ou manquant.`);
    if (!seen.has(s.exit_room)) issues.push(`Étape ${i + 1} : map sans sortie accessible.`);
    if (s.placements.some((p) => !op.rooms.some((r: any) => r.key === p.room_key))) issues.push(`Étape ${i + 1} : placement hors de la map.`);
    const used = s.placements.filter((p) => p.kind === "mob").reduce((sum, p) => sum + (enemies.find((e) => e.id === p.catalog_id)?.threat_cost ?? 0), 0);
    if (used > c.recommended_players * 3) issues.push(`Étape ${i + 1} : menace ${used}/${c.recommended_players * 3}.`);
  });
  return issues;
}
export const playerPlacements = (placements: Placement[]) => placements.filter((p) => !p.hidden);
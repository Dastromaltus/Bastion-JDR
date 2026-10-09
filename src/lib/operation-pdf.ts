const DUR: Record<number, string> = { 30: "30 min", 60: "60 min", 90: "90 min" };
const MAP: Record<string, string> = { lineaire: "Lineaire", boucle: "Boucle", etoile: "Etoile" };
const CONT: Record<string, string> = { coffre: "Coffre", sol: "Au sol", ennemi: "Recompense d'ennemi" };

function latin1(s: string) {
  return s.replace(/[’‘]/g, "'").replace(/[“”«»]/g, '"').replace(/[—–]/g, "-").replace(/→/g, "->").replace(/…/g, "...").replace(/[^\x00-\xFF]/g, "");
}
function slug(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Printable A4 sheet of an Operation: map, enemies, events, treasures (white background). */
export async function downloadOperationPdf(op: any) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 15, bottom = H - M - 8;
  const RED: [number, number, number] = [190, 20, 30], BLACK: [number, number, number] = [15, 15, 15], GREY: [number, number, number] = [110, 110, 110];
  let y = M;
  const ensure = (h: number) => { if (y + h > bottom) { doc.addPage(); y = M + 6; } };
  const text = (s: string, size = 10, color = BLACK, bold = false, x = M, width = W - 2 * M) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(...color);
    for (const l of doc.splitTextToSize(latin1(s), width) as string[]) { ensure(size * 0.45); doc.text(l, x, y + size * 0.36); y += size * 0.45; }
  };
  const heading = (s: string) => { ensure(14); y += 3; doc.setFillColor(...RED); doc.rect(M, y, 3, 7, "F"); text(s.toUpperCase(), 13, BLACK, true, M + 6); y += 3; };
  const rows = (cols: { label: string; w: number }[], data: string[][]) => {
    const head = () => { ensure(8); doc.setFillColor(...BLACK); doc.rect(M, y, W - 2 * M, 7, "F"); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
      let x = M + 2; for (const c of cols) { doc.text(latin1(c.label), x, y + 5); x += c.w; } y += 8; };
    head();
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    for (const r of data) {
      const cells = r.map((v, i) => doc.splitTextToSize(latin1(v), cols[i]!.w - 3) as string[]);
      const h = Math.max(...cells.map((c) => c.length)) * 4 + 2;
      if (y + h > bottom) { doc.addPage(); y = M + 6; head(); doc.setFont("helvetica", "normal"); doc.setFontSize(9); }
      doc.setTextColor(...BLACK);
      let x = M + 2; cells.forEach((c, i) => { c.forEach((l, j) => doc.text(l, x, y + 4 + j * 4)); x += cols[i]!.w; });
      y += h; doc.setDrawColor(...GREY); doc.line(M, y, W - M, y);
    }
  };

  // Title block
  doc.setFillColor(...RED); doc.rect(M, y, W - 2 * M, 2, "F"); y += 6;
  text("BASTION - OPERATION", 10, RED, true);
  text(op.name, 24, BLACK, true); y += 2;
  text(`${DUR[op.duration] ?? op.duration + " min"} · ${op.difficulty_label || op.difficulty} · Carte ${MAP[op.map_type] ?? op.map_type} · ${op.rooms.length} salles`, 10, GREY);
  text(`Objectif : ${op.objective_text}`, 11, BLACK, true);
  y += 1; text(op.story, 10);
  if (op.mechanic) { y += 1; text(`Mecanique : ${op.mechanic}`, 10, RED); }
  text(`Menace preplacee : ${op.threat} points (budget : 3 par joueur, soit 9 a 15).`, 9, GREY);

  // Map
  heading("Carte");
  const maxX = Math.max(...op.rooms.map((r: any) => r.grid_x)), maxY = Math.max(...op.rooms.map((r: any) => r.grid_y));
  const cw = Math.min(30, (W - 2 * M) / (maxX + 1)), ch = 18, bw = cw - 6, bh = 11;
  ensure((maxY + 1) * ch + 4);
  const ox = M + ((W - 2 * M) - (maxX + 1) * cw) / 2, oy = y;
  const pos = (r: any) => ({ x: ox + r.grid_x * cw + 3, y: oy + r.grid_y * ch + 3 });
  const byKey = new Map(op.rooms.map((r: any) => [r.key, r]));
  doc.setDrawColor(...BLACK); doc.setLineWidth(0.8);
  for (const r of op.rooms) for (const c of r.connections) { const o: any = byKey.get(c); if (!o) continue; const a = pos(r), b = pos(o); doc.line(a.x + bw / 2, a.y + bh / 2, b.x + bw / 2, b.y + bh / 2); }
  doc.setLineWidth(0.5);
  op.rooms.forEach((r: any, i: number) => {
    const p = pos(r);
    doc.setFillColor(255, 255, 255); doc.setDrawColor(...(i === 0 ? RED : BLACK)); doc.rect(p.x, p.y, bw, bh, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); doc.setTextColor(...BLACK);
    const ls = doc.splitTextToSize(latin1(`${r.position}. ${r.name}`), bw - 2) as string[];
    ls.slice(0, 2).forEach((l, j) => doc.text(l, p.x + 1, p.y + 4 + j * 3));
  });
  y = oy + (maxY + 1) * ch + 4;

  heading("Salles");
  rows([{ label: "#", w: 8 }, { label: "Salle", w: 38 }, { label: "Description", w: 70 }, { label: "Piege / verrou", w: 64 }],
    op.rooms.map((r: any) => [String(r.position), r.name + (r.is_rest ? " (repos)" : ""), r.description + (r.lore ? ` Lore : ${r.lore}` : ""), r.hazard ?? "-"]));

  const roomName = (id: string) => op.rooms.find((r: any) => r.id === id)?.name ?? "-";
  heading("Ennemis");
  rows([{ label: "Ennemi", w: 40 }, { label: "Salle", w: 36 }, { label: "Vit/For/End", w: 24 }, { label: "PV", w: 12 }, { label: "Menace", w: 16 }, { label: "Cache / declencheur", w: 52 }],
    op.enemies.map((e: any) => { const c = e.enemy_catalog; return [c.name, roomName(e.room_id), `${c.speed}/${c.strength}/${c.endurance}`, String(10 + 2 * c.endurance), String(c.threat_cost), `${e.hidden ? "Cache" : "Visible"} · ${e.trigger}`]; }));
  heading("Evenements de tension");
  rows([{ label: "Seuil", w: 16 }, { label: "Effet", w: 30 }, { label: "Texte affiche", w: 134 }], op.events.map((e: any) => [String(e.threshold), e.effect, e.text]));
  heading("Tresors");
  rows([{ label: "Tresor", w: 46 }, { label: "Rarete", w: 22 }, { label: "Salle", w: 38 }, { label: "Contenant", w: 34 }, { label: "Effet", w: 40 }],
    op.treasures.map((t: any) => [t.treasure_catalog.name + (t.per_player ? " (x1 par joueur)" : ""), t.treasure_catalog.rarity, roomName(t.room_id), CONT[t.container] ?? t.container, t.treasure_catalog.effect]));

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...GREY);
    doc.text(latin1(`Bastion - ${op.name}`), M, H - M + 2); doc.text(`Page ${i} / ${n}`, W - M, H - M + 2, { align: "right" });
  }
  doc.save(`bastion-operation-${slug(op.name)}.pdf`);
}

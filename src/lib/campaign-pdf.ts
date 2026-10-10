import type { Campaign } from "./campaign-model";
export async function downloadCampaignPdf(c: Campaign, operations: any[], enemies: any[], treasures: any[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  let y = 18;
  const text = (value: string, size = 10) => {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(value.replace(/[→]/g, "->"), 178) as string[];
    for (const line of lines) { if (y > 278) { doc.addPage(); y = 18; } doc.text(line, 16, y); y += size === 18 ? 9 : 5; }
  };
  text(`BASTION — ${c.name}`, 18); text(c.summary); text(`${c.difficulty} · ${c.recommended_players} aventuriers · document privé du narrateur`);
  for (const [i, s] of c.stages.entries()) {
    const op = operations.find((o) => o.id === s.template_id);
    doc.addPage(); y = 18;
    text(`${i + 1}. ${op?.name ?? "Map"}`, 18); text(`Objectif : ${s.objective}`); text(`Objectif en ${s.objective_room} · sortie ${s.exit_room} · ambiance ${s.track}`); text(s.intro_text);
    for (const room of op?.rooms ?? []) {
      text(`${room.name} → ${room.connections.join(", ")}`, 12);
      text(room.description ?? "");
      for (const p of s.placements.filter((p) => p.room_key === room.key)) {
        const item = (p.kind === "mob" ? enemies : treasures).find((e) => e.id === p.catalog_id);
        text(`${p.kind === "mob" ? "Mob" : "Trésor"} : ${item?.name ?? "?"} · ${p.hidden ? "caché" : "visible"} · ${p.trigger}`);
        if (p.kind === "mob") text(`V ${p.overrides["speed"] ?? item?.speed} / F ${p.overrides["strength"] ?? item?.strength} / E ${p.overrides["endurance"] ?? item?.endurance} · ${item?.ability ?? ""}`);
      }
    }
  }
  doc.save(`bastion-campagne-${c.name.replace(/[^a-zA-Z0-9]+/g, "-")}.pdf`);
}
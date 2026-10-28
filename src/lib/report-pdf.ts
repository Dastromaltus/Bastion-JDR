import { ROLE_LABEL } from "./races";

export type ReportData = {
  game: any;
  players: { display_name: string; race: string; role: string; speed: number; strength: number; endurance: number; hp: number; max_hp: number }[];
  events: { kind: string; message: string; payload: any; important: boolean; created_at: string }[];
  notes: { body: string; created_at: string }[];
  viewerRole: string;
};

const MAX_ENTRIES = 500;
const KIND_LABEL: Record<string, string> = {
  systeme: "Système", jet: "Jet", tour: "Tour", objet: "Objet", fin: "Fin", combat: "Combat", evenement: "Événement",
};

function slug(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "salon";
}
// jsPDF core fonts only support Latin-1: replace characters outside it.
function latin1(s: string) {
  return s.replace(/[’‘]/g, "'").replace(/[“”«»]/g, '"').replace(/[—–]/g, "-").replace(/→/g, "->").replace(/…/g, "...").replace(/✔/g, "OK").replace(/[^\x00-\xFF]/g, "");
}
function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : "-";
}
function duration(a?: string | null, b?: string | null) {
  if (!a) return "-";
  const ms = (b ? new Date(b) : new Date()).getTime() - new Date(a).getTime();
  const m = Math.max(0, Math.round(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

export async function downloadReportPdf(data: ReportData) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 15;
  const RED: [number, number, number] = [190, 20, 30];
  const BLACK: [number, number, number] = [15, 15, 15];
  const GREY: [number, number, number] = [110, 110, 110];
  const top = M + 10, bottom = H - M - 8;
  let y = top;
  const g = data.game;

  const newPage = () => { doc.addPage(); y = top; };
  const ensure = (h: number) => { if (y + h > bottom) newPage(); };
  const text = (s: string, size: number, color = BLACK, bold = false, width = W - 2 * M, lh = 0.45) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(latin1(s), width) as string[];
    const step = size * lh;
    for (const l of lines) { ensure(step); doc.text(l, M + (W - 2 * M - width), y + step * 0.8); y += step; }
  };
  const heading = (s: string) => {
    ensure(16);
    y += 3;
    doc.setFillColor(...RED); doc.rect(M, y, 3, 7, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(...BLACK);
    doc.text(latin1(s.toUpperCase()), M + 6, y + 5.5);
    y += 11;
  };

  // Cover
  doc.setFillColor(...BLACK); doc.rect(M, 40, W - 2 * M, 34, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(44); doc.setTextColor(255, 255, 255);
  doc.text("BASTION", M + 8, 66);
  doc.setFillColor(...RED); doc.rect(M + 8 + doc.getTextWidth("BASTION") + 2, 60, 6, 6, "F");
  y = 92;
  text("Rapport de partie", 12, RED, true);
  y += 2;
  text(g.name, 26, BLACK, true);
  y += 6;
  const victory = g.result === "victoire";
  const rows: [string, string][] = [
    ["Code du salon", g.code],
    ["Date", fmtDate(g.started_at ?? g.created_at)],
    ["Durée", duration(g.started_at, g.ended_at)],
    ["Résultat", g.status === "finished" ? (victory ? "Victoire" : "Défaite") : "Partie non terminée"],
    ["Exporté par", ROLE_LABEL[data.viewerRole] ?? data.viewerRole],
  ];
  for (const [k, v] of rows) {
    ensure(9);
    doc.setDrawColor(...BLACK); doc.setLineWidth(0.3); doc.line(M, y, W - M, y);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...GREY); doc.text(latin1(k.toUpperCase()), M, y + 6);
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...(k === "Résultat" ? RED : BLACK)); doc.text(latin1(v), M + 55, y + 6);
    y += 9;
  }
  if (data.events.length > MAX_ENTRIES) {
    y += 4;
    text(`Journal long : seules les ${MAX_ENTRIES} dernières entrées sur ${data.events.length} sont reproduites.`, 9, GREY);
  }

  // Participants
  newPage();
  heading("Participants");
  const cols = [M, M + 48, M + 76, M + 106, M + 148];
  const head = ["Nom", "Race", "Rôle", "Vit / For / End", "PV"];
  doc.setFillColor(...BLACK); doc.rect(M, y, W - 2 * M, 7, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
  head.forEach((h, i) => doc.text(latin1(h.toUpperCase()), (cols[i] ?? M) + 2, y + 5));
  y += 7;
  for (const p of data.players) {
    ensure(8);
    const narr = p.role === "narrator";
    doc.setFont("helvetica", narr ? "bold" : "normal"); doc.setFontSize(10); doc.setTextColor(...(narr ? RED : BLACK));
    const vals = [p.display_name.slice(0, 24), p.race, ROLE_LABEL[p.role] ?? p.role, `${p.speed} / ${p.strength} / ${p.endurance}`, `${p.hp} / ${p.max_hp}`];
    vals.forEach((v, i) => doc.text(latin1(v), (cols[i] ?? M) + 2, y + 5.5));
    doc.setDrawColor(200, 200, 200); doc.line(M, y + 8, W - M, y + 8);
    y += 8;
  }
  y += 3;
  text("En rouge : narrateur de la partie.", 8, GREY);

  // Journal
  heading("Journal chronologique");
  const events = data.events.slice(-MAX_ENTRIES);
  for (const e of events) {
    const time = new Date(e.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const label = KIND_LABEL[e.kind] ?? e.kind;
    let msg = e.message;
    if (e.kind === "jet" && e.payload?.stat) {
      msg += `  [stat ${e.payload.stat} · ${e.payload.dice}d6 · résultat ${e.payload.total} · difficulté ${e.payload.difficulty}]`;
    }
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(latin1(msg), W - 2 * M - 34) as string[];
    const h = lines.length * 4.2 + 2;
    ensure(h);
    if (e.kind === "tour") { doc.setFillColor(245, 230, 230); doc.rect(M, y - 0.5, W - 2 * M, h, "F"); }
    doc.setFont("helvetica", "bold"); doc.setTextColor(...GREY); doc.text(time, M, y + 3.4);
    doc.setTextColor(...(e.important ? RED : BLACK)); doc.text(latin1(label.toUpperCase()), M + 12, y + 3.4);
    doc.setFont("helvetica", e.important ? "bold" : "normal"); doc.setTextColor(...BLACK);
    lines.forEach((l, i) => doc.text(l, M + 34, y + 3.4 + i * 4.2));
    y += h;
  }
  if (!events.length) text("Aucun événement enregistré.", 10, GREY);

  // Notes
  if (data.viewerRole === "narrator") {
    heading("Notes privées du narrateur");
    if (!data.notes.length) text("Aucune note.", 10, GREY);
    for (const n of data.notes) { text(`• ${n.body}`, 10); y += 1.5; }
  }

  // Summary
  heading("Résumé final");
  const rolls = data.events.filter((e) => e.kind === "jet");
  const ok = rolls.filter((e) => e.payload?.success).length;
  const turns = data.events.filter((e) => e.kind === "tour").length + (g.started_at ? 1 : 0);
  const stats: [string, string][] = [
    ["Objectif atteint", victory ? "Oui" : "Non"],
    ["Tours joués", String(turns)],
    ["Jets de dés", `${rolls.length} (${ok} réussites, ${rolls.length - ok} échecs)`],
    ["Événements consignés", String(data.events.length)],
    ["Aventuriers encore debout", String(data.players.filter((p) => p.role !== "narrator" && p.hp > 0).length)],
  ];
  for (const [k, v] of stats) { ensure(7); doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...GREY); doc.text(latin1(k), M, y + 5); doc.setTextColor(...BLACK); doc.text(latin1(v), M + 70, y + 5); y += 7; }

  // Header & footer
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...RED); doc.setLineWidth(0.8); doc.line(M, M + 4, W - M, M + 4);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...BLACK);
    doc.text("BASTION", M, M + 2);
    doc.setFont("helvetica", "normal"); doc.setTextColor(...GREY);
    doc.text(latin1(g.name), W - M, M + 2, { align: "right" });
    doc.setDrawColor(...BLACK); doc.setLineWidth(0.3); doc.line(M, H - M - 4, W - M, H - M - 4);
    doc.text(latin1(`Rapport de partie - ${g.code}`), M, H - M);
    doc.setTextColor(...BLACK); doc.text(`Page ${i} / ${total}`, W - M, H - M, { align: "right" });
  }

  const date = new Date().toISOString().slice(0, 10);
  const filename = `bastion-rapport-${slug(g.name)}-${date}.pdf`;
  doc.save(filename);
  return filename;
}

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { placeEncounter, suggestEncounter, type Encounter } from "@/lib/encounter.functions";

function defaultParty(d: any) {
  const adv = (d.players ?? []).filter((p: any) => p.role !== "narrator");
  if (!adv.length) return "";
  return `${adv.length} aventuriers : ` + adv.map((p: any) => [p.character_name ?? p.name, p.race].filter(Boolean).join(" — ")).join(", ");
}

export function EncounterPanel({ d }: { d: any }) {
  const suggest = useServerFn(suggestEncounter);
  const [scenario, setScenario] = useState("");
  const [party, setParty] = useState(() => defaultParty(d));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enc, setEnc] = useState<Encounter | null>(null);
  const place = useServerFn(placeEncounter);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<string | null>(null);

  async function doPlace() {
    if (!enc) return;
    setPlacing(true); setError(null); setPlaced(null);
    try {
      const r = await place({ data: { gameId: d.game.id, zone: enc.zone, enemies: enc.enemies.slice(0, 6).map((e) => ({ name: e.name, count: Math.min(4, Math.max(1, Math.round(e.count))) })), treasures: (enc.treasures ?? []).slice(0, 4).map((t) => ({ name: t.name })) } });
      setPlaced(`Placé dans ${r.zone} : ${r.enemies} ennemi(s) caché(s), ${r.treasures} trésor(s).${r.skipped.length ? ` Ignorés (hors catalogue) : ${r.skipped.join(", ")}.` : ""}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Placement impossible."); }
    finally { setPlacing(false); }
  }

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { setPlaced(null); setEnc((await suggest({ data: { gameId: d.game.id, scenario, party } })).encounter); }
    catch (err) { setError(err instanceof Error ? err.message : "Échec, réessaie."); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={go} className="space-y-3">
        <label className="block text-xs font-black uppercase">Scénario
          <Textarea required value={scenario} onChange={(e) => setScenario(e.target.value)} rows={3} maxLength={1500} placeholder="Ex. : le groupe doit couper l'alarme de la fonderie avant l'arrivée des renforts…" className="mt-1 rounded-none font-normal normal-case" />
        </label>
        <label className="block text-xs font-black uppercase">Groupe d'aventuriers
          <Textarea required value={party} onChange={(e) => setParty(e.target.value)} rows={3} maxLength={1500} placeholder="Ex. : 4 aventuriers — un Reptile costaud, un Oiseau rapide, deux Insectes, peu de soins." className="mt-1 rounded-none font-normal normal-case" />
        </label>
        {error && <p role="alert" className="text-sm font-bold text-primary">{error}</p>}
        <Button type="submit" disabled={busy} className="h-11 w-full rounded-none font-black uppercase">
          {busy ? <span className="anim-loading">Réflexion…</span> : "Proposer une rencontre"}
        </Button>
        <p className="text-xs opacity-70">Proposition générée par IA, visible uniquement par toi. Rien n'est placé tant que tu ne cliques pas sur « Placer sur la carte ».</p>
      </form>

      {enc && (
        <article data-motion-enter className="space-y-3 border-2 border-foreground p-4">
          <h3 className="font-display text-sm uppercase">{enc.title}</h3>
          <p className="text-sm">{enc.pitch}</p>
          <p className="text-xs font-bold uppercase">Zone : {enc.zone}</p>
          <div>
            <h4 className="text-xs font-black uppercase">Objectifs</h4>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{enc.objectives.map((o, i) => <li key={i}><b>{o.label}</b> — {o.detail}</li>)}</ul>
          </div>
          <div>
            <h4 className="text-xs font-black uppercase">Ennemis</h4>
            <ul className="mt-1 space-y-1 text-sm">{enc.enemies.map((e, i) => <li key={i} className="border border-foreground/30 p-2"><b>{e.count}× {e.name}</b> · {e.role}<br /><span className="opacity-80">{e.tactic}</span></li>)}</ul>
          </div>
          {!!enc.treasures?.length && (
            <div>
              <h4 className="text-xs font-black uppercase">Trésors</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{enc.treasures.map((t, i) => <li key={i}><b>{t.name}</b> — {t.reason}</li>)}</ul>
            </div>
          )}
          <p className="text-sm"><b>Rebondissement :</b> {enc.twist}</p>
          <p className="text-sm"><b>Équilibrage :</b> {enc.balance}</p>
          <Button type="button" onClick={doPlace} disabled={placing || !!placed} className="h-11 w-full rounded-none font-black uppercase">
            {placing ? <span className="anim-loading">Placement…</span> : placed ? "Rencontre placée" : "Placer sur la carte"}
          </Button>
          {placed && <p role="status" className="anim-enter text-sm font-bold">{placed}</p>}
        </article>
      )}
    </div>
  );
}

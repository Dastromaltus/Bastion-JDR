import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { MapCanvas } from "@/components/maps/MapCanvas";
import { PREBUILT_MAPS, type GridMap } from "@/lib/map-grid";
import { getMapSequence, goToSequenceMap, listMyMaps, loadSalonMap, saveMapSequence } from "@/lib/maps.functions";

export function MapPanel({ d }: { d: any }) {
  const gameId = d.game.id as string;
  const qc = useQueryClient();
  const list = useServerFn(listMyMaps);
  const load = useServerFn(loadSalonMap);
  const getSeq = useServerFn(getMapSequence);
  const saveSeq = useServerFn(saveMapSequence);
  const goTo = useServerFn(goToSequenceMap);
  const mine = useQuery({ queryKey: ["my-maps"], queryFn: () => list() });
  const seq = useQuery({ queryKey: ["map-sequence", gameId], queryFn: () => getSeq({ data: { gameId } }) });
  const [choice, setChoice] = useState<string>("prebuilt:le-sas");
  const [order, setOrder] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (seq.data) setOrder(seq.data.items.map((i) => i.source)); }, [seq.data]);

  const options: { key: string; map: GridMap }[] = [
    ...Object.entries(PREBUILT_MAPS).map(([k, m]) => ({ key: `prebuilt:${k}`, map: m })),
    ...(mine.data ?? []).map((m) => ({ key: `custom:${m.id}`, map: m })),
  ];
  const selected = options.find((o) => o.key === choice) ?? options[0]!;
  const nameOf = (key: string) => options.find((o) => o.key === key)?.map.name ?? seq.data?.items.find((i) => i.source === key)?.name ?? "Carte";
  const toRef = (key: string) => { const [kind, id] = key.split(":") as [string, string]; return kind === "custom" ? { mapId: id } : { prebuilt: id }; };
  const current = seq.data?.current ?? -1;
  const saved = JSON.stringify(order) === JSON.stringify(seq.data?.items.map((i) => i.source) ?? []);

  async function run(fn: () => Promise<string>) {
    setBusy(true); setMsg(null);
    try { setMsg(await fn()); await qc.invalidateQueries({ queryKey: ["map-sequence", gameId] }); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Action impossible."); }
    finally { setBusy(false); }
  }
  const move = (i: number, dir: -1 | 1) => setOrder((o) => { const n = [...o]; const j = i + dir; if (j < 0 || j >= n.length) return o; [n[i], n[j]] = [n[j]!, n[i]!]; return n; });

  return (
    <div className="space-y-3">
      <label className="block text-xs font-black uppercase">Carte (40 × 40)
        <select value={selected.key} onChange={(e) => setChoice(e.target.value)} className="mt-1 h-11 w-full border-2 border-foreground bg-background px-2 font-normal normal-case">
          <optgroup label="Préconstruites">{options.filter((o) => o.key.startsWith("prebuilt")).map((o) => <option key={o.key} value={o.key}>{o.map.name}</option>)}</optgroup>
          {!!mine.data?.length && <optgroup label="Mes cartes">{options.filter((o) => o.key.startsWith("custom")).map((o) => <option key={o.key} value={o.key}>{o.map.name}</option>)}</optgroup>}
        </select>
      </label>
      <div className="mx-auto max-w-xs border-2 border-foreground"><MapCanvas tiles={selected.map.tiles} spawn={selected.map.spawn} label={`Aperçu de ${selected.map.name}`} /></div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={busy || order.length >= 12} onClick={() => setOrder((o) => [...o, selected.key])} className="h-11 rounded-none font-black uppercase">+ Ajouter au parcours</Button>
        <Button disabled={busy} onClick={() => run(async () => { const r = await load({ data: { gameId, ...toRef(selected.key) } }); return `Carte « ${r.name} » chargée.`; })} className="h-11 rounded-none font-black uppercase">Utiliser maintenant</Button>
      </div>

      <section className="space-y-2 border-2 border-foreground p-2">
        <h4 className="text-xs font-black uppercase">Ordre de passage des cartes</h4>
        {order.length === 0 ? <p className="text-sm">Aucune carte dans le parcours. Ajoute-en avec « + Ajouter au parcours ».</p> : (
          <ol className="space-y-1">
            {order.map((key, i) => (
              <li key={`${key}-${i}`} className={`flex items-center gap-1 border-2 border-foreground px-2 py-1 text-sm ${saved && i === current ? "bg-primary text-primary-foreground" : ""}`}>
                <span className="w-6 font-black">{i + 1}.</span>
                <span className="flex-1 truncate">{nameOf(key)}{saved && i === current ? " — en cours" : ""}</span>
                <Button size="sm" variant="ghost" aria-label="Monter" disabled={busy || i === 0} onClick={() => move(i, -1)}>↑</Button>
                <Button size="sm" variant="ghost" aria-label="Descendre" disabled={busy || i === order.length - 1} onClick={() => move(i, 1)}>↓</Button>
                <Button size="sm" variant="ghost" aria-label="Retirer" disabled={busy} onClick={() => setOrder((o) => o.filter((_, j) => j !== i))}>✕</Button>
                {saved && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => { const r = await goTo({ data: { gameId, index: i } }); return `Carte ${r.index + 1} « ${r.name} » chargée.`; })}>Aller</Button>}
              </li>
            ))}
          </ol>
        )}
        {!saved && <Button disabled={busy} onClick={() => run(async () => { const r = await saveSeq({ data: { gameId, items: order.map(toRef) } }); return `Parcours enregistré (${r.count} carte${r.count > 1 ? "s" : ""}).`; })} className="h-11 w-full rounded-none font-black uppercase">Enregistrer l'ordre</Button>}
        {saved && order.length > 0 && current < order.length - 1 && (
          <Button disabled={busy} onClick={() => run(async () => { const r = await goTo({ data: { gameId, index: current + 1 } }); return `Carte ${r.index + 1} « ${r.name} » chargée. Les aventuriers repartent du point de départ.`; })} className="h-11 w-full rounded-none font-black uppercase">
            {current < 0 ? "Lancer la carte 1" : `Passer à la carte ${current + 2}`}
          </Button>
        )}
        {saved && order.length > 0 && current >= order.length - 1 && <p className="text-sm font-bold">Dernière carte du parcours atteinte.</p>}
      </section>

      {msg && <p role="status" className="anim-enter text-sm font-bold">{msg}</p>}
      <Link to="/cartes" className="inline-flex min-h-11 items-center text-sm underline">Créer ou modifier mes cartes</Link>
    </div>
  );
}

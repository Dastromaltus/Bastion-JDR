import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { MapCanvas } from "@/components/maps/MapCanvas";
import { PREBUILT_MAPS, type GridMap } from "@/lib/map-grid";
import { listMyMaps, loadSalonMap } from "@/lib/maps.functions";

export function MapPanel({ d }: { d: any }) {
  const list = useServerFn(listMyMaps);
  const load = useServerFn(loadSalonMap);
  const mine = useQuery({ queryKey: ["my-maps"], queryFn: () => list() });
  const [choice, setChoice] = useState<string>("prebuilt:le-sas");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const options: { key: string; map: GridMap }[] = [
    ...Object.entries(PREBUILT_MAPS).map(([k, m]) => ({ key: `prebuilt:${k}`, map: m })),
    ...(mine.data ?? []).map((m) => ({ key: `custom:${m.id}`, map: m })),
  ];
  const selected = options.find((o) => o.key === choice) ?? options[0]!;

  async function apply() {
    setBusy(true); setMsg(null);
    try {
      const [kind, id] = selected.key.split(":") as [string, string];
      const r = await load({ data: { gameId: d.game.id, ...(kind === "custom" ? { mapId: id } : { prebuilt: id }) } });
      setMsg(`Carte « ${r.name} » chargée. Les aventuriers repartent du point de départ.`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Chargement impossible."); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs font-black uppercase">Carte du salon (40 × 40)
        <select value={selected.key} onChange={(e) => setChoice(e.target.value)} className="mt-1 h-11 w-full border-2 border-foreground bg-background px-2 font-normal normal-case">
          <optgroup label="Préconstruites">{options.filter((o) => o.key.startsWith("prebuilt")).map((o) => <option key={o.key} value={o.key}>{o.map.name}</option>)}</optgroup>
          {!!mine.data?.length && <optgroup label="Mes cartes">{options.filter((o) => o.key.startsWith("custom")).map((o) => <option key={o.key} value={o.key}>{o.map.name}</option>)}</optgroup>}
        </select>
      </label>
      <div className="mx-auto max-w-xs border-2 border-foreground"><MapCanvas tiles={selected.map.tiles} spawn={selected.map.spawn} label={`Aperçu de ${selected.map.name}`} /></div>
      <Button onClick={apply} disabled={busy} className="h-11 w-full rounded-none font-black uppercase">{busy ? <span className="anim-loading">Chargement…</span> : "Utiliser cette carte"}</Button>
      {msg && <p role="status" className="anim-enter text-sm font-bold">{msg}</p>}
      <Link to="/cartes" className="inline-flex min-h-11 items-center text-sm underline">Créer ou modifier mes cartes</Link>
    </div>
  );
}

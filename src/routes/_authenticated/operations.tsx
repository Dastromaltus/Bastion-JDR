import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { MapPlus, Swords, Gem, Music } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MapCanvas } from "@/components/maps/MapCanvas";
import { addReadyMap, listReadyMapSalons } from "@/lib/maps.functions";
import { READY_CONTENT, readyMapStep } from "@/lib/ready-maps";
import { trackLabel } from "@/lib/ambience-tracks";

const salonsOptions = queryOptions({ queryKey: ["ready-map-salons"], queryFn: () => listReadyMapSalons() });
export const Route = createFileRoute("/_authenticated/operations")({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Cartes prêtes à jouer — Bastion" },
    { name: "description", content: "Quatre cartes Bastion de 40 × 40 cases avec ennemis, trésors et musique, à ajouter au parcours de votre salon." },
    { property: "og:title", content: "Cartes prêtes à jouer — Bastion" },
    { property: "og:description", content: "Le Sas, les Machines, le Reliquaire et le Cœur : des cartes équipées pour votre prochaine partie." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(salonsOptions),
  component: ReadyMapsPage,
});

function ReadyMapsPage() {
  const { data: salons } = useSuspenseQuery(salonsOptions);
  const add = useServerFn(addReadyMap);
  const qc = useQueryClient();
  const [salonId, setSalonId] = useState(salons[0]?.id ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const salon = salons.find((s) => s.id === salonId);
  async function load(key: string) {
    if (!salon) return;
    setBusy(key);
    try {
      const r = await add({ data: { gameId: salon.id, key } });
      toast.success(`${r.name} ajoutée à l'étape ${r.index + 1}.`);
      setAdded((list) => [...list, `${salon.id}:${key}`]);
      await qc.invalidateQueries({ queryKey: ["map-sequence", salon.id] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Ajout impossible."); }
    finally { setBusy(null); }
  }
  return <main className="mx-auto min-h-screen max-w-7xl px-4 pb-16 pt-8 md:px-10">
    <p className="section-label">Bibliothèque de cartes</p>
    <h1 className="mt-6 break-words font-display text-xl leading-relaxed sm:text-3xl">Cartes prêtes à jouer</h1>
    <div className="my-6 flex flex-wrap items-end gap-3 border-y-2 border-foreground py-4">
      {salons.length ? <label className="w-full max-w-md text-sm font-bold">Salon en préparation<select aria-label="Salon en préparation" className="mt-2 h-11 w-full border-2 border-foreground bg-background px-2" value={salonId} onChange={(e) => setSalonId(e.target.value)}>{salons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label> : <Button asChild><Link to="/salons">Créer un salon</Link></Button>}
      {salon && <Button asChild variant="outline"><Link to="/salon/$code" params={{ code: salon.code }}>Ouvrir le salon</Link></Button>}
    </div>
    <ul className="grid gap-6 md:grid-cols-2">
      {Object.entries(READY_CONTENT).map(([key, content]) => {
        const map = readyMapStep(key);
        const markers = [...map.enemies.map((e) => ({ ...e, glyph: "☠", zombie: e.catalogId === "d25f0e90-6a3f-4e89-84ac-aecc51b9aa6f" })), ...(map.treasures ?? []).map((t) => ({ ...t, glyph: "✦" }))];
        return <li key={key} data-motion-enter className="min-w-0 space-y-3 border-2 border-foreground bg-card p-4 shadow-game">
          <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="font-display text-base leading-relaxed">{map.name}</h2><span className="text-xs font-bold text-muted-foreground">40 × 40 · {content.difficulty}</span></div>
          <MapCanvas tiles={map.tiles} spawn={map.spawn} markers={markers} label={`Carte prête à jouer : ${map.name}`} />
          <p className="text-sm">{content.summary}</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold"><li className="flex items-center gap-1"><Swords className="size-4" />{map.enemies.length} mobs</li><li className="flex items-center gap-1"><Gem className="size-4" />{map.treasures?.length} trésors</li><li className="flex items-center gap-1"><Music className="size-4" />{trackLabel(content.track)}</li></ul>
          <p className="text-sm"><b>Objectif :</b> {content.objective}</p>
          <Button className="min-h-11 w-full whitespace-normal" disabled={!salon || busy !== null} onClick={() => void load(key)}><MapPlus />{busy === key ? "Ajout…" : "Ajouter au parcours du salon"}</Button>
          {salon && added.includes(`${salon.id}:${key}`) && <p role="status" className="text-xs font-bold text-primary">Carte ajoutée à {salon.name}.</p>}
        </li>;
      })}
    </ul>
  </main>;
}

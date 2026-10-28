import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Heart, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDamageHistory } from "@/lib/health.functions";
import { adventurerHealth, type HealthPlayer } from "@/lib/health-history";
import { HealthFill } from "./MotionBits";

export function HealthPanel({ gameId, players }: { gameId: string; players: HealthPlayer[] }) {
  const [filter, setFilter] = useState("all");
  const fetchHistory = useServerFn(getDamageHistory);
  const history = useInfiniteQuery({
    queryKey: ["health-history", gameId],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) => fetchHistory({ data: { gameId, before: pageParam } }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    refetchInterval: 2500,
  });
  const adventurers = adventurerHealth(players);
  const entries = (history.data?.pages.flatMap((p) => p.entries) ?? []).filter((e) => filter === "all" || e.player_id === filter);

  return <section aria-labelledby="health-title" className="space-y-4 border-t-2 border-foreground pt-4">
    <h2 id="health-title" className="section-label flex items-center gap-2"><Heart size={18} /> Suivi des PV</h2>
    {adventurers.length === 0 ? <p className="text-sm text-muted-foreground">Aucun aventurier dans le salon.</p> : <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {adventurers.map((p) => <li key={p.id} className="border-2 border-foreground/50 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="min-w-0 break-words font-bold">{p.display_name}</span>
          <span className={`shrink-0 font-pixel text-xl ${p.hp <= 0 ? "text-destructive" : "text-foreground"}`}>{p.hp}/{p.max_hp} PV</span>
        </div>
        <div role="progressbar" aria-label={`PV de ${p.display_name}`} aria-valuemin={0} aria-valuemax={p.max_hp} aria-valuenow={p.hp} className="mt-2 h-2 overflow-hidden bg-muted">
          <HealthFill hp={p.hp} maxHp={p.max_hp} className={p.hp <= p.max_hp / 4 ? "bg-destructive" : "bg-primary"} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{p.hp <= 0 ? "À terre" : p.hp <= p.max_hp / 4 ? "PV faibles" : "En vie"}</p>
      </li>)}
    </ul>}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-sm font-bold"><History size={16} /> Historique des dégâts</h3>
      <select aria-label="Filtrer les dégâts par aventurier" className="h-11 w-full border border-input bg-background px-2 text-sm sm:w-auto sm:max-w-64" value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="all">Tous les aventuriers</option>
        {adventurers.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
      </select>
    </div>
    <p className="text-xs text-muted-foreground">Les pertes de PV sont enregistrées depuis l’activation du suivi ; les anciens dégâts ne sont pas reconstitués.</p>
    {history.isPending ? <p role="status" className="text-sm">Chargement des dégâts…</p> : history.isError ? <div role="alert" className="space-y-2 text-sm"><p>Historique indisponible.</p><Button variant="outline" className="min-h-11" onClick={() => history.refetch()}>Réessayer</Button></div> : <>
      {entries.length === 0 ? <p className="text-sm text-muted-foreground">Aucun dégât enregistré{filter !== "all" ? " pour cet aventurier" : ""}.</p> : <ol className="max-h-72 space-y-2 overflow-y-auto pr-2">
        {entries.map((entry) => <li key={entry.id} className="flex items-start justify-between gap-3 border-b border-foreground/20 pb-2 text-sm">
          <div className="min-w-0"><p className="break-words font-bold">{entry.player_name}</p><p className="text-xs text-muted-foreground"><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString("fr-FR")}</time> · {entry.hp_before} → {entry.hp_after}/{entry.max_hp} PV</p></div>
          <span className="shrink-0 font-pixel text-xl text-destructive">−{entry.damage} PV</span>
        </li>)}
      </ol>}
      {history.hasNextPage && <Button variant="outline" disabled={history.isFetchingNextPage} className="min-h-11" onClick={() => history.fetchNextPage()}>{history.isFetchingNextPage ? "Chargement…" : "Dégâts plus anciens"}</Button>}
    </>}
  </section>;
}
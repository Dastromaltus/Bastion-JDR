import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nextTurn } from "@/lib/rooms.functions";
import { salonTurn } from "@/lib/turn-order";

export function TurnBanner({ d, onChange }: { d: any; onChange: () => void }) {
  const end = useServerFn(nextTurn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const turn = salonTurn(d.game, d.players, d.me.user_id);
  if (d.game.status !== "playing" || d.game.solo || d.combat) return null;
  return <section aria-label="Ordre des tours" className="space-y-3 border-y-2 border-foreground bg-secondary px-4 py-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="status" aria-live="polite" aria-atomic="true">
        <p className="text-xs font-bold uppercase text-muted-foreground">Manche {d.game.turn_round ?? 1}</p>
        <p key={turn.active?.id} className="anim-enter font-pixel text-xl">{turn.message}</p>
        {turn.isMine && <p className="text-sm text-muted-foreground">{turn.label}</p>}
      </div>
      <Button disabled={busy || !turn.isMine} className="min-h-11" onClick={async () => {
        if (busy) return;
        setBusy(true); setError("");
        try { await end({ data: { gameId: d.game.id, revision: d.game.turn_revision ?? 0 } }); }
        catch (e) { setError(e instanceof Error ? e.message : "Impossible de terminer le tour."); }
        finally { onChange(); setBusy(false); }
      }}>{busy ? <LoaderCircle className="anim-loading" /> : <ArrowRight />}{busy ? "Passage du tour…" : "Terminer mon tour"}</Button>
    </div>
    <ol className="flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="Participants dans l’ordre">
      {turn.order.map((p, i) => <li key={p.id} aria-current={p.id === turn.active?.id ? "step" : undefined} className={p.id === turn.active?.id ? "anim-active px-2 py-1 font-bold text-primary" : "px-2 py-1 text-muted-foreground"}>
        {p.role === "narrator" ? "Narrateur" : `Joueur ${i + 1}`} · {p.display_name}{p.hp <= 0 && p.role !== "narrator" ? " (à terre)" : ""}{p.id === turn.active?.id ? " ◀" : ""}
      </li>)}
    </ol>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
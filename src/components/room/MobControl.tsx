import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Swords, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { combatAction } from "@/lib/combat.functions";

export function MobControl({ d, onChange }: { d: any; onChange: () => void }) {
  const act = useServerFn(combatAction);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState("");
  const [effect, setEffect] = useState<"attaque" | "soin" | "protection">("attaque");
  const [last, setLast] = useState<number[]>([]);
  const narr = d.me.role === "narrator";
  const mob = d.enemies.find((e: any) => e.id === d.controlledEnemyId);
  const combat = d.combat;
  async function run(action: "control" | "attack" | "ability" | "move" | "pass", enemyId?: string, x?: number, y?: number) {
    if (busy) return;
    setBusy(true);
    try { const r = await act({ data: { gameId: d.game.id, revision: combat?.revision ?? 0, action, enemyId, targetId: target || undefined, x, y, effect } }); setLast(r.rolls ?? []); onChange(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Action impossible."); }
    finally { setBusy(false); }
  }
  if (!narr && !combat) return null;
  return <section className="space-y-3 border-2 border-primary p-4">
    <h2 className="section-label">{combat ? `Combat · manche ${combat.round}` : "Contrôle des mobs"}</h2>
    {combat && <><p role="status" className="font-bold">{combat.isMine ? "C’est à ton tour !" : combat.label}</p><ol className="flex flex-wrap gap-3 text-sm">{combat.fighters.map((f: any) => <li key={f.id} className={f.id === combat.current?.id ? "font-bold text-primary" : "text-muted-foreground"}>{f.name} · V{f.speed}</li>)}</ol></>}
    {narr && <>
      <ul className="grid gap-2 sm:grid-cols-2">{d.enemies.map((e: any) => <li key={e.id} className={`border-2 p-3 ${e.id === mob?.id ? "border-accent bg-secondary" : "border-foreground"}`}>
        <p className="font-bold">{e.icon} {e.name}</p><p className="text-sm">{e.status === "cache" ? "Caché" : e.status === "vaincu" ? "Vaincu" : "Révélé"} · {e.hp}/{e.max_hp} PV</p>
        <Button variant="outline" className="mt-2 min-h-11" disabled={busy || e.status === "vaincu"} onClick={() => run("control", e.id)}>{e.id === mob?.id ? "Contrôlé" : "Contrôler"}</Button>
      </li>)}</ul>
      {!d.enemies.length && <p className="text-sm text-muted-foreground">Aucun mob placé.</p>}
      {mob && <div className="space-y-3 border-t border-foreground pt-3"><h3 className="font-bold">{mob.name}</h3><p className="text-sm">Vitesse {mob.speed} · Force {mob.strength} · Endurance {mob.endurance} · {mob.hp}/{mob.max_hp} PV</p><p>{mob.ability || "Aucune capacité"}</p>
        <label className="block text-sm">Cible<select className="h-11 w-full border border-input bg-background px-2" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Choisir…</option>{d.players.filter((p: any) => p.role === "adventurer" && p.current_zone === mob.zone && p.hp > 0).map((p: any) => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label>
        <fieldset disabled={busy || !combat?.isMine || combat.current?.id !== mob.id} className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">{([[0,-1,ChevronUp,"Monter"],[-1,0,ChevronLeft,"Gauche"],[1,0,ChevronRight,"Droite"],[0,1,ChevronDown,"Descendre"]] as const).map(([dx,dy,Icon,label]) => <Button key={label} variant="outline" size="icon" aria-label={`Mob : ${label}`} title={label} className="h-11 w-11" onClick={() => run("move",mob.id,mob.tile_x+dx,mob.tile_y+dy)}><Icon /></Button>)}</div>
          <div className="flex flex-wrap gap-2"><Button disabled={!target} className="min-h-11" onClick={() => run("attack",mob.id)}><Swords />Attaquer</Button><select aria-label="Effet de capacité" className="h-11 border border-input bg-background px-2" value={effect} onChange={(e) => setEffect(e.target.value as typeof effect)}><option value="attaque">Attaque</option><option value="soin">Soin</option><option value="protection">Protection</option></select><Button variant="outline" disabled={!mob.ability || (effect === "attaque" && !target)} className="min-h-11" onClick={() => run("ability",mob.id)}>Utiliser une capacité</Button><Button variant="secondary" className="min-h-11" onClick={() => run("pass",mob.id)}><SkipForward />Passer son tour</Button></div>
        </fieldset>
      </div>}
    </>}
    {!narr && combat?.isMine && <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => run("pass")}>Passer mon tour de combat</Button>}
    {busy && <p role="status">Résolution…</p>}{last.length > 0 && <p role="status">Dés : {last.join(" · ")} → {last.filter((r) => r >= 5).length} réussite(s)</p>}
  </section>;
}
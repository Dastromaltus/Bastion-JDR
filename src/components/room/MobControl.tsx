import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Swords, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { combatAction } from "@/lib/combat.functions";
import { CombatDice, HealthFill, RollingDice } from "./MotionBits";

export function MobControl({ d, onChange }: { d: any; onChange: () => void }) {
  const act = useServerFn(combatAction);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState("");
  const [effect, setEffect] = useState<"attaque" | "soin" | "protection">("attaque");
  const [last, setLast] = useState<number[]>([]);
  const narr = d.me.role === "narrator";
  const mob = d.enemies.find((e: any) => e.id === d.controlledEnemyId);
  const combat = d.combat;
  useEffect(() => {
    const select = (event: Event) => {
      if (!narr || busy || !(event instanceof CustomEvent) || typeof event.detail !== "string") return;
      if (d.enemies.some((e: any) => e.id === event.detail && e.status !== "vaincu")) void run("control", event.detail);
    };
    window.addEventListener("bastion-select-mob", select);
    return () => window.removeEventListener("bastion-select-mob", select);
  }, [narr, busy, d.enemies, combat?.revision]);
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
    {combat && <><p key={combat.current?.id} role="status" className="anim-enter font-pixel text-xl">{combat.isMine ? "C’est à ton tour !" : combat.label}</p><ol className="flex flex-wrap gap-3 text-sm" aria-label="Initiative de combat">{combat.fighters.map((f: any) => <li key={f.id} aria-current={f.id === combat.current?.id ? "step" : undefined} className={f.id === combat.current?.id ? "anim-active px-2 py-1 font-bold text-primary" : "px-2 py-1 text-muted-foreground"}>{f.id === combat.current?.id ? "▶ " : ""}{f.name} · V{f.speed}{(() => { const u = d.players.find((p: any) => p.id === f.id || p.user_id === f.id) ?? d.enemies?.find((e: any) => e.id === f.id); return u ? ` · ${Math.max(0, u.hp)}/${u.max_hp} PV` : ""; })()}</li>)}</ol></>}
    {narr && <>
      <ul className="grid gap-2 sm:grid-cols-2">{d.enemies.map((e: any) => <li key={e.id} className={`border-2 p-3 ${e.id === mob?.id ? "border-accent bg-secondary" : "border-foreground"}`}>
        <p className="font-bold">{e.icon} {e.name}</p><p className="text-sm">{e.status === "cache" ? "Caché" : e.status === "vaincu" ? "Vaincu" : "Révélé"} · {e.hp}/{e.max_hp} PV</p>
        <div className="mt-2 h-2 w-full overflow-hidden bg-muted" role="meter" aria-label={`PV de ${e.name}`} aria-valuemin={0} aria-valuemax={e.max_hp} aria-valuenow={Math.max(0, e.hp)}><HealthFill hp={e.hp} maxHp={e.max_hp} className="bg-primary" /></div>
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
    {busy && <p role="status" className="flex items-center gap-2"><RollingDice rolling />Résolution…</p>}<CombatDice rolls={last} />
  </section>;
}
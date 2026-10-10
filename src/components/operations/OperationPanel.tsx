import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getSalonDungeon, loadOperation, prepareOperation, operationControl, operationPlayerAction, soloAct } from "@/lib/operations.functions";
import { getNarratorCatalog, attackEnemy } from "@/lib/narrator.functions";
import { DungeonMap } from "./DungeonMap";
import { SalonWorld } from "@/components/room/SalonWorld";
import { salonTurn } from "@/lib/turn-order";
import { AnimatedCount, HealthFill } from "@/components/room/MotionBits";
import { motionFeedback } from "@/lib/motion";

const SEL = "h-11 w-full min-w-0 border-2 border-foreground bg-background px-2 text-sm";
const RARITY: Record<string, string> = { commun: "Commun", rare: "Rare", epique: "Épique", legendaire: "Légendaire" };
const EFFECT: Record<string, string> = { renforts: "Renforts", alarme: "Alarme", effondrement: "Effondrement", panne: "Panne de lumière" };

function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  async function run(key: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(key);
    try { await fn(); if (ok) toast.success(ok); return true; }
    catch (e) { toast.error(e instanceof Error ? e.message : "Action impossible, réessaie."); return false; }
    finally { setBusy(null); }
  }
  return { busy, run };
}

export function OperationSection({ d, onChange }: { d: any; onChange: () => void }) {
  const gameId = d.game.id as string;
  const fetchDg = useServerFn(getSalonDungeon);
  const q = useQuery({ queryKey: ["dungeon", gameId], queryFn: () => fetchDg({ data: { gameId } }) });
  useEffect(() => {
    const ch = supabase.channel(`dungeon-${gameId}`);
    ch.on("postgres_changes", { event: "*", schema: "public", table: "game_dungeons", filter: `game_id=eq.${gameId}` }, () => q.refetch());
    ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "game_events", filter: `game_id=eq.${gameId}` }, () => q.refetch());
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);
  const refresh = () => { q.refetch(); onChange(); };

  if (q.isLoading) return <section className="border-2 border-foreground p-4"><p>Chargement de l'Opération…</p></section>;
  if (q.error) return <section className="border-2 border-foreground p-4"><p role="alert" className="font-bold text-primary">Opération indisponible. <button className="underline" onClick={() => q.refetch()}>Réessayer</button></p></section>;
  const v: any = q.data;
  const isNarr = d.me.role === "narrator";
  if (!v) {
    if (!isNarr || d.game.status !== "waiting") return null;
    return (
      <section className="border-2 border-foreground bg-card p-4 shadow-game">
        <p className="section-label">Opération</p>
        <p className="mt-2 text-sm">Aucun donjon chargé. Choisis une Opération préconstruite : ennemis, trésors et événements seront préplacés.</p>
        <Button asChild className="mt-3 min-h-11 rounded-none font-black uppercase"><Link to="/operations">Catalogue d'Opérations</Link></Button>
      </section>
    );
  }
  if (v.role === "narrator") return <NarratorOperation d={d} v={v} refresh={refresh} />;
  return <PlayerOperation d={d} v={v} refresh={refresh} />;
}

/* ============================== Narrator ============================== */

function NarratorOperation({ d, v, refresh }: { d: any; v: any; refresh: () => void }) {
  const gameId = d.game.id;
  const { busy, run } = useAction();
  const sLoad = useServerFn(loadOperation);
  const myTurn = salonTurn(d.game, d.players, d.me.user_id).isMine;
  const sCtl = useServerFn(operationControl);
  const ctl = (action: string, extra: Record<string, unknown> = {}, ok?: string) =>
    run(action + String(extra["eventId"] ?? extra["enemyId"] ?? extra["room"] ?? ""), async () => { await sCtl({ data: { gameId, action, ...extra } as any }); refresh(); }, ok);
  const { dungeon: dg, template: t, rooms, events, budget } = v;
  const name = (k: string) => rooms.find((r: any) => r.key === k)?.name ?? k;
  const cur = rooms.find((r: any) => r.key === dg.current_room);
  const adventurers = d.players.filter((p: any) => p.role === "adventurer");
  const over = budget.used > budget.budget;

  return (
    <section className="space-y-4 border-2 border-primary bg-card p-4 shadow-game">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="section-label">Opération · {dg.status === "preparation" ? "préparation" : dg.status === "en_cours" ? "en cours" : "terminée"}</p>
          <h2 className="mt-1 font-display text-xl uppercase">{t.name}</h2>
          <p className="text-sm"><b>Objectif :</b> {t.objective_text}</p>
          {t.mechanic && <p className="text-xs text-muted-foreground">{t.mechanic}</p>}
        </div>
      </div>

      {/* Threat budget */}
      <div>
        <p className="text-xs font-black uppercase">Menace : {budget.used} / {budget.budget} points ({adventurers.length} aventurier{adventurers.length > 1 ? "s" : ""} × 3)</p>
        <div className="mt-1 h-4 w-full border-2 border-foreground bg-muted" role="meter" aria-valuemin={0} aria-valuemax={budget.budget} aria-valuenow={budget.used}>
          <div className={`h-full ${over ? "bg-destructive" : "bg-accent"}`} style={{ width: `${Math.min(100, budget.budget ? (budget.used / budget.budget) * 100 : 100)}%` }} />
        </div>
        {over && <p role="alert" className="mt-1 text-sm font-bold text-destructive">Budget dépassé de {budget.used - budget.budget} point(s) : retire des ennemis ou remélange avant de lancer la partie.</p>}
        {!adventurers.length && <p className="mt-1 text-sm text-muted-foreground">Aucun aventurier pour l'instant : le budget est de 0 tant que personne n'a rejoint.</p>}
      </div>

      {dg.status === "preparation" && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={!!busy} className="min-h-11 rounded-none font-bold uppercase"
              onClick={() => run("shuffle", async () => { const r = await sLoad({ data: { gameId, templateId: dg.template_id, reshuffle: true } }); refresh(); toast(r.over ? `Remélangé — encore au-dessus du budget (${r.used}/${r.budget})` : `Remélangé — menace ${r.used}/${r.budget}`); })}>
              {busy === "shuffle" ? "Mélange…" : "Remélanger"}
            </Button>
            <Button variant="outline" disabled={!!busy} className="min-h-11 rounded-none"
              onClick={() => run("reload", async () => { await sLoad({ data: { gameId, templateId: dg.template_id, reshuffle: false } }); refresh(); }, "Opération rechargée telle quelle")}>Recharger l'original</Button>
            <Button asChild variant="outline" className="min-h-11 rounded-none"><Link to="/operations">Changer d'Opération</Link></Button>
          </div>
          <DungeonMap rooms={rooms} current={dg.current_room} label="Carte de l'Opération" />
          <PrepEditor d={d} rooms={rooms} refresh={refresh} />
          <p className="text-sm text-muted-foreground">Quand tout est prêt, utilise « Lancer la partie » dans les commandes du narrateur.</p>
        </>
      )}

      {dg.status === "en_cours" && (
        <fieldset disabled={!myTurn || !!busy} className="min-w-0 space-y-4">
          <TensionGauge value={dg.tension} events={events} />
           <SalonWorld d={d} zone={dg.current_room} name={cur?.name} onChange={refresh} />
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" disabled={!!busy} className="min-h-11 rounded-none font-black" onClick={() => ctl("tension_down")} aria-label="Tension moins 1">−1</Button>
            <Button disabled={!!busy} className="min-h-11 rounded-none font-black" onClick={() => ctl("tension_up")} aria-label="Tension plus 1">+1</Button>
            <Button variant="secondary" disabled={!!busy} className="min-h-11 rounded-none text-xs font-bold uppercase" onClick={() => ctl("next_turn", {}, "Tour suivant")}>{busy === "next_turn" ? "…" : `Tour ${dg.current_turn} → ${dg.current_turn + 1}`}</Button>
          </div>
          <div className="border-2 border-foreground bg-background p-2">
            <DungeonMap rooms={rooms} current={dg.current_room} selectable={cur?.connections ?? []} playersHere={adventurers.length}
              onSelect={(k) => ctl("advance", { room: k }, `Table déplacée vers ${name(k)}`)} label="Carte : touche une salle reliée pour y faire entrer la table" />
          </div>
          <p className="text-sm"><b>Salle actuelle :</b> {cur?.name} — {cur?.description}{cur?.hazard ? ` · ${cur.hazard}` : ""}</p>
          <p className="text-xs text-muted-foreground">Aventuriers : {adventurers.map((p: any) => `${p.display_name} (${p.hp}/${p.max_hp} PV)`).join(", ") || "aucun"}</p>
          <div className="flex flex-wrap gap-2">
            {(() => {
              const next = (cur?.connections ?? []).map((k: string) => rooms.find((r: any) => r.key === k)).filter((r: any) => r && r.position > (cur?.position ?? 0)).sort((a: any, b: any) => a.position - b.position)[0];
              return next ? <Button disabled={!!busy} className="min-h-11 rounded-none font-black uppercase" onClick={() => ctl("advance", { room: next.key }, `Table déplacée vers ${next.name}`)}>Passer à la salle suivante ({next.name})</Button> : null;
            })()}
            <Button variant="destructive" disabled={!!busy} className="min-h-11 rounded-none" onClick={() => ctl("finish", { result: "defaite" }, "Opération close")}>Clore (défaite)</Button>
            <Button variant="outline" disabled={!!busy} className="min-h-11 rounded-none" onClick={() => ctl("finish", { result: "victoire" }, "Opération close")}>Clore (victoire)</Button>
          </div>

          <div>
            <p className="text-xs font-black uppercase">Événements</p>
            <ul className="mt-2 space-y-2">
              {events.map((e: any) => (
                <li key={e.id} className={`flex items-center justify-between gap-2 border-2 p-2 text-sm ${e.status === "declenche" ? "border-muted-foreground/40 text-muted-foreground" : "border-foreground"}`}>
                  <span><b>Seuil {e.threshold}</b> · {EFFECT[e.effect]} — {e.text}</span>
                  {e.status === "a_venir"
                    ? <Button size="sm" disabled={!!busy} className="min-h-11 shrink-0 rounded-none" onClick={() => ctl("trigger_event", { eventId: e.id }, "Événement déclenché")}>Déclencher l'événement</Button>
                    : <span className="shrink-0 text-xs uppercase">Déclenché</span>}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-black uppercase">Ennemis cachés (toi seul les vois)</p>
            <ul className="mt-2 space-y-2">
              {d.enemies.filter((e: any) => e.status === "cache").map((e: any) => (
                <li key={e.id} className="flex items-center justify-between gap-2 border border-foreground p-2 text-sm">
                  <span>{e.icon} {e.name} · {name(e.zone)}</span>
                  <Button size="sm" disabled={!!busy} className="min-h-11 rounded-none" onClick={() => ctl("reveal", { enemyId: e.id }, "Ennemi révélé")}>Révéler</Button>
                </li>
              ))}
              {!d.enemies.some((e: any) => e.status === "cache") && <li className="text-sm text-muted-foreground">Plus aucun ennemi caché.</li>}
            </ul>
          </div>
        </fieldset>
      )}
    </section>
  );
}

function TensionGauge({ value, events }: { value: number; events: any[] }) {
  const previous = useRef(value);
  useEffect(() => {
    if (value > previous.current) motionFeedback("alarm");
    previous.current = value;
  }, [value]);
  const max = 10;
  return (
    <div>
      <p className="text-xs font-black uppercase">Tension : <AnimatedCount value={value} /> (visible par toi seul)</p>
      <div className="mt-1 grid grid-cols-10 gap-1" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label="Jauge de tension">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
          const ev = events.find((e: any) => e.threshold === n);
          return (
            <div key={n} className={`flex h-8 items-center justify-center border-2 border-foreground text-[10px] font-black ${n <= value ? "bg-primary text-primary-foreground" : "bg-background"}`}>
              {ev ? (ev.status === "declenche" ? "✓" : "⚠") : n}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PrepEditor({ d, rooms, refresh }: { d: any; rooms: any[]; refresh: () => void }) {
  const gameId = d.game.id;
  const fetchCat = useServerFn(getNarratorCatalog);
  const cat = useQuery({ queryKey: ["narrator-catalog", gameId], queryFn: () => fetchCat({ data: { gameId } }) });
  const sPrep = useServerFn(prepareOperation);
  const { busy, run } = useAction();
  const prep = (key: string, data: Record<string, unknown>, ok?: string) => run(key, async () => { await sPrep({ data: { gameId, ...data } as any }); refresh(); }, ok);
  if (cat.isLoading) return <p className="text-sm">Chargement du catalogue…</p>;
  if (cat.error) return <p role="alert" className="text-sm font-bold text-primary">Catalogue indisponible. <button className="underline" onClick={() => cat.refetch()}>Réessayer</button></p>;
  const enemies = cat.data?.enemies ?? [], treasures = cat.data?.treasures ?? [];
  return (
    <ol className="space-y-3">
      {rooms.map((r: any) => {
        const es = d.enemies.filter((e: any) => e.zone === r.key);
        const ts = d.treasures.filter((t: any) => t.zone === r.key && t.status === "cache");
        return (
          <li key={r.key} className="border-2 border-foreground p-3">
            <p className="font-display text-sm uppercase">{r.position}. {r.name}{r.is_rest ? " · repos" : ""}</p>
            <p className="text-xs text-muted-foreground">{r.description}{r.hazard ? ` · ${r.hazard}` : ""}</p>
            <ul className="mt-2 space-y-2">
              {es.map((e: any) => (
                <li key={e.id} className="grid grid-cols-[1fr_auto] gap-2">
                  <select aria-label={`Changer ${e.name}`} className={SEL} value={e.catalog_id ?? ""} disabled={!!busy}
                    onChange={(ev) => prep("swap" + e.id, { op: "swapEnemy", id: e.id, catalogId: ev.target.value }, "Ennemi remplacé")}>
                    {enemies.map((c: any) => <option key={c.id} value={c.id}>{c.icon} {c.name} · menace {c.threat_cost} · V{c.speed}/F{c.strength}/E{c.endurance}</option>)}
                  </select>
                  <Button size="sm" variant="outline" disabled={!!busy} className="min-h-11 rounded-none" onClick={() => prep("rm" + e.id, { op: "removeEnemy", id: e.id }, "Ennemi retiré")}>Retirer</Button>
                </li>
              ))}
              {ts.map((t: any) => (
                <li key={t.id} className="grid grid-cols-[1fr_auto] gap-2">
                  <select aria-label={`Changer ${t.name}`} className={SEL} value={t.catalog_id ?? ""} disabled={!!busy}
                    onChange={(ev) => prep("swapt" + t.id, { op: "swapTreasure", id: t.id, catalogId: ev.target.value }, "Trésor remplacé")}>
                    {treasures.map((c: any) => <option key={c.id} value={c.id}>✦ {c.name} · {RARITY[c.rarity]} ({t.placement === "ennemi" ? "sur ennemi" : t.placement === "zone" ? "au sol" : "coffre"})</option>)}
                  </select>
                  <Button size="sm" variant="outline" disabled={!!busy} className="min-h-11 rounded-none" onClick={() => prep("rmt" + t.id, { op: "removeTreasure", id: t.id }, "Trésor retiré")}>Retirer</Button>
                </li>
              ))}
              {!es.length && !ts.length && <li className="text-xs text-muted-foreground">Salle vide.</li>}
            </ul>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <select aria-label={`Ajouter un ennemi dans ${r.name}`} className={SEL} value="" disabled={!!busy}
                onChange={(ev) => ev.target.value && prep("add" + r.key, { op: "addEnemy", room: r.key, catalogId: ev.target.value, trigger: "entree" }, "Ennemi ajouté")}>
                <option value="">+ Ajouter un ennemi caché…</option>
                {enemies.map((c: any) => <option key={c.id} value={c.id}>{c.icon} {c.name} (menace {c.threat_cost})</option>)}
              </select>
              <select aria-label={`Ajouter un trésor dans ${r.name}`} className={SEL} value="" disabled={!!busy}
                onChange={(ev) => ev.target.value && prep("addt" + r.key, { op: "addTreasure", room: r.key, catalogId: ev.target.value, container: "coffre" }, "Trésor ajouté")}>
                <option value="">+ Ajouter un trésor (coffre)…</option>
                {treasures.map((c: any) => <option key={c.id} value={c.id}>✦ {c.name} ({RARITY[c.rarity]})</option>)}
              </select>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ============================== Players ============================== */

function PlayerOperation({ d, v, refresh }: { d: any; v: any; refresh: () => void }) {
  const gameId = d.game.id;
  const solo = !!d.game.solo;
  const myTurn = salonTurn(d.game, d.players, d.me.user_id).isMine;
  const { busy, run } = useAction();
  const sAct = useServerFn(operationPlayerAction);
  const sSolo = useServerFn(soloAct);
  const sAttack = useServerFn(attackEnemy);
  const [stat, setStat] = useState<"force" | "vitesse">("force");
  const { dungeon: dg, template: t, current, rooms } = v;
  if (dg.status === "preparation") {
    return (
      <section className="border-2 border-foreground bg-card p-4 shadow-game">
        <p className="section-label">Opération</p>
        <h2 className="mt-1 font-display text-xl uppercase">{t.name}</h2>
        <p className="text-sm"><b>Objectif :</b> {t.objective_text}</p>
        <p className="mt-2 text-sm text-muted-foreground">Le narrateur prépare le donjon…</p>
      </section>
    );
  }
  const foes = d.enemies.filter((e: any) => e.status === "revele" && e.zone === dg.current_room);
  const live = dg.status === "en_cours" && d.game.status === "playing" && myTurn;
  const act = (key: string, fn: () => Promise<unknown>, ok?: string) => run(key, async () => { await fn(); refresh(); }, ok);
  return (
    <section className="space-y-3 border-2 border-foreground bg-card p-4 shadow-game">
      <p className="section-label">Opération{solo ? " solo" : ""} · tour {dg.current_turn}</p>
      <h2 className="font-display text-xl uppercase">{t.name}</h2>
      <p className="text-sm"><b>Objectif :</b> {t.objective_text}{dg.core_taken ? " · Noyau en votre possession !" : ""}</p>
      <SalonWorld d={d} zone={dg.current_room} name={current?.name} onChange={refresh} />
      {current && (
        <div className="border-2 border-primary bg-background p-3">
          <p className="text-xs font-black uppercase text-primary">Salle actuelle</p>
          <p className="font-display text-lg uppercase">{current.name}</p>
          <p className="text-sm">{current.description}</p>
          {current.hazard && <p className="text-sm font-bold">⚠ {current.hazard}</p>}
          {current.lore && <p className="mt-1 text-xs italic text-muted-foreground">« {current.lore} »</p>}
        </div>
      )}
      <div className="border-2 border-foreground bg-background p-2">
        <DungeonMap rooms={rooms} current={dg.current_room} fog playersHere={d.players.filter((p: any) => p.role === "adventurer").length}
          selectable={solo && live && !foes.length ? current?.connections ?? [] : []}
          onSelect={solo ? (k) => act("move" + k, () => sSolo({ data: { gameId, action: "move", room: k } })) : undefined}
          label={solo ? "Carte : touche une salle reliée pour t'y rendre" : "Carte des salles explorées"} />
      </div>

      {foes.length > 0 && (
        <ul className="space-y-2">
          {foes.map((e: any) => (
             <li key={e.id} data-motion-reveal="true" className="flex items-center justify-between gap-2 border-2 border-destructive p-2">
              <div className="min-w-0">
                <p className="font-bold">{e.icon} {e.name}{e.overheated ? " 🔥" : ""}</p>
                <div className="mt-1 h-2 w-40 max-w-full bg-muted"><HealthFill hp={e.hp} maxHp={e.max_hp} className="bg-destructive" /></div>
                <p className="text-[11px] text-muted-foreground">{e.hp}/{e.max_hp} PV · {e.ability}</p>
              </div>
              {live && (
                <Button disabled={!!busy} className="min-h-11 shrink-0 rounded-none font-black uppercase"
                  onClick={() => act("atk" + e.id, () => solo ? sSolo({ data: { gameId, action: "attack", enemyId: e.id } }) : sAttack({ data: { gameId, enemyId: e.id } }))}>
                  {busy === "atk" + e.id ? "…" : "Attaquer"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {live && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!!busy} className="min-h-11 rounded-none" onClick={() => act("search", () => solo ? sSolo({ data: { gameId, action: "search" } }) : sAct({ data: { gameId, action: "search" } }))}>
            {busy === "search" ? "Fouille…" : "Fouiller un coffre"}
          </Button>
          {solo && <Button variant="outline" disabled={!!busy} className="min-h-11 rounded-none" onClick={() => act("wait", () => sSolo({ data: { gameId, action: "wait" } }))}>Attendre</Button>}
          {dg.door_locked && (
            <div className="flex gap-2">
              <select aria-label="Stat pour forcer la porte" className={SEL + " w-32"} value={stat} onChange={(e) => setStat(e.target.value as any)}>
                <option value="force">Force</option><option value="vitesse">Vitesse</option>
              </select>
              <Button disabled={!!busy} className="min-h-11 rounded-none font-bold" onClick={() => act("door", () => sAct({ data: { gameId, action: "unlock_door", stat } }))}>Rouvrir la porte (diff. 3)</Button>
            </div>
          )}
        </div>
      )}
      {solo && live && <p className="text-xs text-muted-foreground">Mode solo : les ennemis jouent après toi. Ils attaquent la cible la plus proche ; les drones n'agissent qu'un tour sur deux. On ne quitte pas une salle tant qu'un ennemi la bloque.</p>}
      {!solo && live && <p className="text-xs text-muted-foreground">C'est le narrateur qui fait avancer la table de salle en salle.</p>}
      {v.events.length > 0 && <p className="text-xs"><b>Événements survenus :</b> {v.events.map((e: any) => e.text).join(" · ")}</p>}
    </section>
  );
}

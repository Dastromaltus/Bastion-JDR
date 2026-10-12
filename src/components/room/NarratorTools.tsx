import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Play, Pause, Square, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { TRACKS, SFX } from "@/lib/ambience-tracks";
import { ZONES, zoneLabel, TRIGGER_LABEL, ENEMY_STATUS_LABEL } from "@/lib/races";
import {
  setAmbience, getNarratorCatalog, placeEnemy, enemyAction, placeTreasure, removeTreasure, createCustomEnemy, createCustomTreasure, exploreAction, attackEnemy,
} from "@/lib/narrator.functions";
import type { AmbienceRow } from "./Ambience";
import { salonTurn } from "@/lib/turn-order";
import { HealthFill } from "./MotionBits";
import { CatalogArtwork } from "@/components/operations/CatalogArtwork";

const SEL = "h-11 w-full border border-input bg-background px-2 focus-visible:outline-2 focus-visible:outline-primary";
const RARITY: Record<string, string> = { commun: "Commun", rare: "Rare", epique: "Épique", legendaire: "Légendaire" };
const TYPE: Record<string, string> = { consommable: "Consommable", equipement: "Équipement", arme: "Arme", cle: "Clé", quete: "Quête" };

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

/* ======================= Ambience (narrator) ======================= */

export function AmbiencePanel({ gameId, row }: { gameId: string; row: AmbienceRow }) {
  const set = useServerFn(setAmbience);
  const { busy, run } = useAction();
  const [track, setTrack] = useState(row?.track ?? "forteresse");
  const [vol, setVol] = useState(row?.volume ?? 70);
  const call = (key: string, patch: Record<string, unknown>, ok?: string) => run(key, () => set({ data: { gameId, ...patch } as any }), ok);
  const state = row?.state ?? "arret";
  return (
    <div className="space-y-3">
      <p className="text-xs font-black uppercase">Ambiance — entendue par toute la table</p>
      <p className="text-sm" aria-live="polite">État : <b>{state === "lecture" ? `▶ ${TRACKS.find((t) => t.key === row?.track)?.label}` : state === "pause" ? "⏸ Pause" : "■ Arrêt"}</b></p>
      <label className="block text-sm font-bold">Piste
        <select className={SEL + " mt-1"} value={track} onChange={(e) => { setTrack(e.target.value); if (state === "lecture") call("track", { track: e.target.value, state: "lecture" }); }}>
          {TRACKS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-3 gap-2">
        <Button disabled={!!busy} className="min-h-11 rounded-none" onClick={() => call("play", { track, state: "lecture" })} aria-label="Lecture"><Play /> {busy === "play" ? "…" : "Lecture"}</Button>
        <Button variant="outline" disabled={!!busy} className="min-h-11 rounded-none" onClick={() => call("pause", { state: "pause" })} aria-label="Pause"><Pause /> Pause</Button>
        <Button variant="outline" disabled={!!busy} className="min-h-11 rounded-none" onClick={() => call("stop", { state: "arret" })} aria-label="Arrêt"><Square /> Arrêt</Button>
      </div>
      <label className="block text-sm font-bold">Volume de la table : {vol}%
        <Slider className="mt-2 py-3" min={0} max={100} step={5} value={[vol]} onValueChange={(v) => setVol(v[0] ?? 0)} onValueCommit={(v) => call("vol", { volume: v[0] })} />
      </label>
      <label className="flex min-h-11 items-center justify-between text-sm font-bold"><span className="flex items-center gap-2"><Repeat size={16} /> Boucle</span>
        <Switch checked={row?.loop ?? true} disabled={!!busy} onCheckedChange={(v) => call("loop", { loop: v })} />
      </label>
      <div>
        <p className="text-xs font-black uppercase">Effets ponctuels</p>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {SFX.map((s) => <Button key={s.key} variant="outline" disabled={busy === "sfx" + s.key} className="min-h-11 rounded-none text-xs font-bold uppercase" onClick={() => call("sfx" + s.key, { sfx: s.key })}>{s.label}</Button>)}
        </div>
      </div>
    </div>
  );
}

/* ======================= Enemies (narrator) ======================= */

function Stat({ label, value }: { label: string; value: number | string }) {
  return <div className="border border-foreground/60 p-1 text-center"><p className="text-[5.4px] font-black uppercase">{label}</p><p className="font-display text-sm">{value}</p></div>;
}

export function EnemyPanel({ d, initialZone }: { d: any; initialZone?: string | undefined }) {
  const gameId = d.game.id;
  const fetchCat = useServerFn(getNarratorCatalog);
  const cat = useQuery({ queryKey: ["catalog", gameId], queryFn: () => fetchCat({ data: { gameId } }) });
  const place = useServerFn(placeEnemy);
  const act = useServerFn(enemyAction);
  const custom = useServerFn(createCustomEnemy);
  const { busy, run } = useAction();
  const [category, setCategory] = useState("");
  const [enemyId, setEnemyId] = useState("");
  const [zone, setZone] = useState<string>(initialZone ?? ZONES[1].key);
  const [trigger, setTrigger] = useState("entree");
  const [stats, setStats] = useState<{ speed: number; strength: number; endurance: number } | null>(null);
  const [moving, setMoving] = useState<Record<string, string>>({});
  const [showCustom, setShowCustom] = useState(false);
  const [c, setC] = useState({ name: "", category: "", ability: "", speed: 3, strength: 3, endurance: 3, threatCost: 2, icon: "☠" });

  const list = cat.data?.enemies ?? [];
  const categories = useMemo(() => [...new Set(list.map((e: any) => e.category))], [list]);
  const filtered = list.filter((e: any) => !category || e.category === category);
  const selected = list.find((e: any) => e.id === enemyId);
  const s = stats ?? (selected ? { speed: selected.speed, strength: selected.strength, endurance: selected.endurance } : null);
  const statInput = (k: "speed" | "strength" | "endurance", label: string) => (
    <label className="text-xs font-bold uppercase">{label}
      <select className={SEL} value={s?.[k] ?? 1} disabled={!s} onChange={(e) => setStats({ ...(s as any), [k]: Number(e.target.value) })}>
        {[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}
      </select>
    </label>
  );

  return (
    <div className="space-y-4">
      {cat.isLoading && <p className="text-sm">Chargement du catalogue…</p>}
      {cat.error && <p role="alert" className="text-sm font-bold text-primary">Catalogue indisponible. <button className="underline" onClick={() => cat.refetch()}>Réessayer</button></p>}
      {cat.data && (
        <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); if (!selected || !s) { toast.error("Choisis un ennemi."); return; }
          void run("place", () => place({ data: { gameId, catalogId: selected.id, zone, trigger: trigger as any, ...s } }), `${selected.name} placé en secret`).then((ok) => { if (ok) { setEnemyId(""); setStats(null); } }); }}>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-bold uppercase">Catégorie
              <select className={SEL} value={category} onChange={(e) => { setCategory(e.target.value); setEnemyId(""); setStats(null); }}>
                <option value="">Toutes</option>{categories.map((k: any) => <option key={k}>{k}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold uppercase">Ennemi
              <select className={SEL} value={enemyId} onChange={(e) => { setEnemyId(e.target.value); setStats(null); }}>
                <option value="">Choisir…</option>
                {filtered.map((e: any) => <option key={e.id} value={e.id}>{e.icon} {e.name}{e.game_id ? " (perso)" : ""}</option>)}
              </select>
            </label>
          </div>
          {selected && s && (
            <div className="border-2 border-foreground p-2">
              <CatalogArtwork kind="mob" item={selected} /><p className="text-sm"><b>{selected.icon} {selected.name}</b> · {selected.category} — {selected.ability}</p>
              {selected.description && <p className="text-xs text-muted-foreground">{selected.description}</p>}
              <div className="mt-2 grid grid-cols-4 gap-2">{statInput("speed", "Vit")}{statInput("strength", "For")}{statInput("endurance", "End")}<Stat label="PV" value={10 + 2 * s.endurance} /></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-bold uppercase">Emplacement
              <select className={SEL} value={zone} onChange={(e) => setZone(e.target.value)}>{ZONES.map((z) => <option key={z.key} value={z.key}>{z.label}</option>)}</select>
            </label>
            <label className="text-xs font-bold uppercase">Déclencheur
              <select className={SEL} value={trigger} onChange={(e) => setTrigger(e.target.value)}>{Object.entries(TRIGGER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
          </div>
          <Button disabled={busy === "place" || !selected} className="min-h-11 rounded-none font-black uppercase">{busy === "place" ? "Placement…" : "Placer l'ennemi"}</Button>
        </form>
      )}

      <div>
        <p className="text-xs font-black uppercase">Ennemis placés ({d.enemies.length})</p>
        {!d.enemies.length && <p className="mt-1 text-sm text-muted-foreground">Aucun ennemi sur le parcours.</p>}
        <ul className="mt-2 space-y-2">
          {d.enemies.map((e: any) => (
            <li key={`${e.id}-${e.status}`} data-motion-reveal={e.status === "revele" ? "true" : undefined} className={`border-2 p-2 text-sm ${e.status === "cache" ? "border-dashed border-foreground/60" : e.status === "vaincu" ? "border-foreground/30 opacity-60" : "border-primary"}`}>
              <p><b>{e.icon} {e.name}</b> — {zoneLabel(e.zone)} · <span className="uppercase">{ENEMY_STATUS_LABEL[e.status]}</span> · {e.hp}/{e.max_hp} PV · {TRIGGER_LABEL[e.trigger]}</p>
              {e.status !== "vaincu" && (
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {e.status === "cache" && <Button size="sm" disabled={!!busy} className="min-h-11 rounded-none" onClick={() => run("rev" + e.id, () => act({ data: { gameId, enemyId: e.id, action: "reveal" } }), "Ennemi révélé")}>{busy === "rev" + e.id ? "…" : "Révéler"}</Button>}
                  {e.status === "revele" && <Button size="sm" disabled={!!busy} className="min-h-11 rounded-none" onClick={() => run("def" + e.id, () => act({ data: { gameId, enemyId: e.id, action: "defeat" } }), "Ennemi vaincu")}>Vaincu</Button>}
                  <select aria-label="Nouvelle zone" className={SEL} value={moving[e.id] ?? e.zone} onChange={(ev) => setMoving({ ...moving, [e.id]: ev.target.value })}>{ZONES.map((z) => <option key={z.key} value={z.key}>{z.label}</option>)}</select>
                  <Button size="sm" variant="outline" disabled={!!busy || (moving[e.id] ?? e.zone) === e.zone} className="min-h-11 rounded-none" onClick={() => run("mv" + e.id, () => act({ data: { gameId, enemyId: e.id, action: "move", zone: moving[e.id] as any } }), "Ennemi déplacé")}>Déplacer</Button>
                  <Button size="sm" variant="destructive" disabled={!!busy} className="min-h-11 rounded-none" onClick={() => run("rm" + e.id, () => act({ data: { gameId, enemyId: e.id, action: "remove" } }), "Ennemi retiré")}>Retirer</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <Button variant="outline" className="min-h-11 w-full rounded-none font-bold uppercase" aria-expanded={showCustom} onClick={() => setShowCustom(!showCustom)}>{showCustom ? "Fermer" : "Créer un ennemi personnalisé"}</Button>
      {showCustom && (
        <form className="grid gap-2 border-2 border-foreground p-2" onSubmit={(e) => { e.preventDefault(); run("custom", async () => { await custom({ data: { gameId, ...c } }); await cat.refetch(); setShowCustom(false); }, "Ennemi ajouté au catalogue du salon"); }}>
          <Input required maxLength={40} className="h-11 rounded-none" placeholder="Nom" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
          <div className="grid grid-cols-[1fr_5rem] gap-2">
            <Input required maxLength={40} className="h-11 rounded-none" placeholder="Catégorie (robot, alien…)" value={c.category} onChange={(e) => setC({ ...c, category: e.target.value })} />
            <Input maxLength={4} aria-label="Icône" className="h-11 rounded-none text-center" value={c.icon} onChange={(e) => setC({ ...c, icon: e.target.value })} />
          </div>
          <Input maxLength={120} className="h-11 rounded-none" placeholder="Capacité spéciale" value={c.ability} onChange={(e) => setC({ ...c, ability: e.target.value })} />
          <div className="grid grid-cols-4 gap-2">
            {([["speed", "Vit"], ["strength", "For"], ["endurance", "End"]] as const).map(([k, l]) => (
              <label key={k} className="text-xs font-bold uppercase">{l}<select className={SEL} value={c[k]} onChange={(e) => setC({ ...c, [k]: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></label>
            ))}
          </div>
          <Button disabled={busy === "custom"} className="min-h-11 rounded-none font-bold uppercase">{busy === "custom" ? "Ajout…" : `Ajouter (${10 + 2 * c.endurance} PV)`}</Button>
        </form>
      )}
    </div>
  );
}

/* ======================= Treasures (narrator) ======================= */

export function TreasurePanel({ d }: { d: any }) {
  const gameId = d.game.id;
  const fetchCat = useServerFn(getNarratorCatalog);
  const cat = useQuery({ queryKey: ["catalog", gameId], queryFn: () => fetchCat({ data: { gameId } }) });
  const place = useServerFn(placeTreasure);
  const remove = useServerFn(removeTreasure);
  const custom = useServerFn(createCustomTreasure);
  const { busy, run } = useAction();
  const [rarity, setRarity] = useState("");
  const [tid, setTid] = useState("");
  const [where, setWhere] = useState("zone:" + ZONES[1].key);
  const [showCustom, setShowCustom] = useState(false);
  const [c, setC] = useState({ name: "", type: "consommable", rarity: "commun", effect: "", value: 10 });
  const list = (cat.data?.treasures ?? []).filter((t: any) => !rarity || t.rarity === rarity);
  const selected = (cat.data?.treasures ?? []).find((t: any) => t.id === tid);
  const liveEnemies = d.enemies.filter((e: any) => e.status !== "vaincu");
  const adventurers = d.players.filter((p: any) => p.role === "adventurer");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) { toast.error("Choisis un trésor."); return; }
    const [kind, ref] = where.split(":");
    const payload: any = { gameId, catalogId: selected.id, placement: kind };
    if (kind === "zone" || kind === "coffre") payload.zone = ref;
    if (kind === "ennemi") payload.enemyId = ref;
    if (kind === "direct") payload.targetUserId = ref;
    void run("tplace", () => place({ data: payload }), kind === "direct" ? "Trésor remis" : "Trésor caché").then((ok) => { if (ok) setTid(""); });
  }

  return (
    <div className="space-y-4">
      {cat.isLoading && <p className="text-sm">Chargement du catalogue…</p>}
      {cat.error && <p role="alert" className="text-sm font-bold text-primary">Catalogue indisponible. <button className="underline" onClick={() => cat.refetch()}>Réessayer</button></p>}
      {cat.data && (
        <form className="grid gap-2" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-bold uppercase">Rareté
              <select className={SEL} value={rarity} onChange={(e) => { setRarity(e.target.value); setTid(""); }}>
                <option value="">Toutes</option>{Object.entries(RARITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold uppercase">Trésor
              <select className={SEL} value={tid} onChange={(e) => setTid(e.target.value)}>
                <option value="">Choisir…</option>{list.map((t: any) => <option key={t.id} value={t.id}>{t.name} ({RARITY[t.rarity]}){t.game_id ? " (perso)" : ""}</option>)}
              </select>
            </label>
          </div>
          {selected && <CatalogArtwork kind="treasure" item={selected} />}
          {selected && <p className="border-2 border-foreground p-2 text-sm"><b>{selected.name}</b> · {TYPE[selected.type]} · {RARITY[selected.rarity]} · {selected.value} cr<br />Effet : {selected.effect || "—"}</p>}
          <label className="text-xs font-bold uppercase">Placer
            <select className={SEL} value={where} onChange={(e) => setWhere(e.target.value)}>
              <optgroup label="Au sol dans une zone">{ZONES.map((z) => <option key={z.key} value={"zone:" + z.key}>{z.label}</option>)}</optgroup>
              <optgroup label="Dans un coffre">{ZONES.map((z) => <option key={z.key} value={"coffre:" + z.key}>Coffre — {z.label}</option>)}</optgroup>
              {liveEnemies.length > 0 && <optgroup label="Récompense sur un ennemi">{liveEnemies.map((e: any) => <option key={e.id} value={"ennemi:" + e.id}>{e.name} ({zoneLabel(e.zone)})</option>)}</optgroup>}
              {adventurers.length > 0 && <optgroup label="Donner directement à un joueur">{adventurers.map((p: any) => <option key={p.user_id} value={"direct:" + p.user_id}>{p.display_name}</option>)}</optgroup>}
            </select>
          </label>
          <Button disabled={busy === "tplace" || !selected} className="min-h-11 rounded-none font-black uppercase">{busy === "tplace" ? "…" : where.startsWith("direct") ? "Donner au joueur" : "Placer le trésor"}</Button>
        </form>
      )}

      <div>
        <p className="text-xs font-black uppercase">Trésors placés ({d.treasures.length})</p>
        {!d.treasures.length && <p className="mt-1 text-sm text-muted-foreground">Aucun trésor sur le parcours.</p>}
        <ul className="mt-2 space-y-1 text-sm">
          {d.treasures.map((t: any) => (
            <li key={t.id} className="flex min-h-11 items-center justify-between gap-2 border-b border-foreground/20">
              <span><b>{t.name}</b> · {t.placement === "ennemi" ? "sur un ennemi" : t.placement === "coffre" ? `coffre, ${zoneLabel(t.zone)}` : t.placement === "direct" ? "remis" : zoneLabel(t.zone)} · {t.status === "cache" ? "caché" : "découvert"}</span>
              {t.status === "cache" && <Button size="sm" variant="outline" disabled={!!busy} className="min-h-11 rounded-none" onClick={() => run("trm" + t.id, () => remove({ data: { gameId, treasureId: t.id } }), "Trésor retiré")}>Retirer</Button>}
            </li>
          ))}
        </ul>
      </div>

      <Button variant="outline" className="min-h-11 w-full rounded-none font-bold uppercase" aria-expanded={showCustom} onClick={() => setShowCustom(!showCustom)}>{showCustom ? "Fermer" : "Créer un trésor personnalisé"}</Button>
      {showCustom && (
        <form className="grid gap-2 border-2 border-foreground p-2" onSubmit={(e) => { e.preventDefault(); run("tcustom", async () => { await custom({ data: { gameId, ...c } as any }); await cat.refetch(); setShowCustom(false); }, "Trésor ajouté au catalogue du salon"); }}>
          <Input required maxLength={40} className="h-11 rounded-none" placeholder="Nom" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
          <div className="grid grid-cols-3 gap-2">
            <select aria-label="Type" className={SEL} value={c.type} onChange={(e) => setC({ ...c, type: e.target.value })}>{Object.entries(TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <select aria-label="Rareté" className={SEL} value={c.rarity} onChange={(e) => setC({ ...c, rarity: e.target.value })}>{Object.entries(RARITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <Input type="number" min={0} max={100000} aria-label="Valeur" className="h-11 rounded-none" value={c.value} onChange={(e) => setC({ ...c, value: Number(e.target.value) })} />
          </div>
          <Input maxLength={200} className="h-11 rounded-none" placeholder="Effet (ex : rend 5 PV)" value={c.effect} onChange={(e) => setC({ ...c, effect: e.target.value })} />
          <Button disabled={busy === "tcustom"} className="min-h-11 rounded-none font-bold uppercase">{busy === "tcustom" ? "Ajout…" : "Ajouter au catalogue"}</Button>
        </form>
      )}
    </div>
  );
}

/* ======================= Adventurer: parcours ======================= */

export function ExplorePanel({ d }: { d: any }) {
  const gameId = d.game.id;
  const explore = useServerFn(exploreAction);
  const attack = useServerFn(attackEnemy);
  const { busy, run } = useAction();
  const here = d.me.current_zone as string;
  const [target, setTarget] = useState(here);
  const hereDef = ZONES.find((z) => z.key === here);
  const visible = d.enemies.filter((e: any) => e.status === "revele");
  const myTurn = salonTurn(d.game, d.players, d.me.user_id).isMine;
  return (
    <fieldset disabled={!myTurn || !!busy} className="min-w-0 space-y-3 border-2 border-foreground p-4">
      <p className="section-label">Parcours — tu es dans : {zoneLabel(here)}</p>
      <div className="flex gap-2">
        <select aria-label="Zone de destination" className={SEL} value={target} onChange={(e) => setTarget(e.target.value)}>{ZONES.map((z) => <option key={z.key} value={z.key}>{z.label}{z.key === here ? " (ici)" : ""}</option>)}</select>
        <Button disabled={!!busy || target === here} className="min-h-11 shrink-0 rounded-none font-black uppercase" onClick={() => run("enter", () => explore({ data: { gameId, action: "enter", zone: target as any } }))}>{busy === "enter" ? "…" : "Entrer"}</Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={!!busy || !hereDef?.door} className="min-h-11 rounded-none font-bold uppercase" onClick={() => run("door", () => explore({ data: { gameId, action: "door" } }))}>{busy === "door" ? "…" : "Ouvrir la porte"}</Button>
        <Button variant="outline" disabled={!!busy} className="min-h-11 rounded-none font-bold uppercase" onClick={() => run("chest", () => explore({ data: { gameId, action: "chest" } }))}>{busy === "chest" ? "…" : "Fouiller un coffre"}</Button>
      </div>
      {visible.length > 0 && (
        <ul className="space-y-2">
          {visible.map((e: any) => (
            <li key={e.id} data-motion-reveal="true" className="retro-dialog border-2 border-primary p-2 text-sm">
              <p><b>{e.icon} {e.name}</b> — {zoneLabel(e.zone)} · Vit {e.speed} · For {e.strength} · End {e.endurance} — {e.ability}</p>
              <div className="mt-1 h-2 w-full bg-muted"><HealthFill hp={e.hp} maxHp={e.max_hp} className="bg-primary" /></div>
              <Button disabled={!!busy || e.zone !== here} className="mt-2 min-h-11 w-full rounded-none font-black uppercase" onClick={() => run("atk" + e.id, () => attack({ data: { gameId, enemyId: e.id } }))}>
                {busy === "atk" + e.id ? "Jet…" : e.zone === here ? `Attaquer (${e.hp}/${e.max_hp} PV)` : `Rejoins ${zoneLabel(e.zone)}`}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Trash2, Copy, Download, ArrowUp, ArrowDown, Eye, EyeOff, Swords, Gem } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DungeonMap } from "./DungeonMap";
import { CatalogArtwork, EnvironmentPreview } from "./CatalogArtwork";
import { roomIcon } from "@/lib/map-identity";
import { TRACKS } from "@/lib/ambience-tracks";
import { getCampaign, saveCampaign, deleteCampaign, loadCampaignInSalon, startCampaignTest } from "@/lib/campaigns.functions";
import { campaignIssues, playerPlacements, type Campaign, type Placement } from "@/lib/campaign-model";

const SEL = "h-11 w-full border-2 border-foreground bg-background px-2";
const empty = (): Campaign => ({ revision: 0, name: "Nouvelle campagne", summary: "", difficulty: "initiation", recommended_players: 3, is_template: false, status: "draft", stages: [] });
export function CampaignEditor({ workspace, refresh }: { workspace: any; refresh: () => void }) {
  const fetchOne = useServerFn(getCampaign), save = useServerFn(saveCampaign), remove = useServerFn(deleteCampaign), load = useServerFn(loadCampaignInSalon);
  const test = useServerFn(startCampaignTest), navigate = useNavigate();
  const [c, setC] = useState<Campaign>(empty);
  const [index, setIndex] = useState(0), [room, setRoom] = useState(""), [kind, setKind] = useState<"mob" | "treasure">("mob"), [catalog, setCatalog] = useState(""), [selected, setSelected] = useState("");
  const [preview, setPreview] = useState(false), [busy, setBusy] = useState(false), [status, setStatus] = useState(""), [dirty, setDirty] = useState(false), [failed, setFailed] = useState(false), [salon, setSalon] = useState("");
  const current = useRef(c); current.current = c;
  const lock = useRef(false);
  const stage = c.stages[index], op = workspace.operations.find((o: any) => o.id === stage?.template_id);
  const issues = campaignIssues(c, workspace.operations, workspace.enemies);
  function change(next: Campaign) { setC(next); setDirty(true); setFailed(false); setStatus("Modifications non enregistrées"); }
  function patchStage(patch: any) { change({ ...c, stages: c.stages.map((s, i) => i === index ? { ...s, ...patch } : s) }); }
  async function persist(publish = false) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setStatus("Enregistrement…");
    const snapshot = current.current;
    try {
      const r = await save({ data: { document: snapshot as any, publish } });
      setC((value) => ({ ...value, id: r.id, revision: r.revision, status: r.status }));
      if (current.current === snapshot) setDirty(false);
      setStatus(publish ? "Publiée · privée et prête à charger" : "Brouillon enregistré"); refresh();
    } catch (e) { setStatus(e instanceof Error ? e.message : "Enregistrement impossible."); setFailed(true); }
    finally { lock.current = false; setBusy(false); }
  }
  useEffect(() => { if (!dirty || busy || failed) return; const timer = setTimeout(() => { void persist(); }, 1200); return () => clearTimeout(timer); }, [c, dirty, busy, failed]);
  async function open(id: string) {
    if (dirty && !window.confirm("Ouvrir une autre campagne sans conserver les dernières modifications ?")) return;
    setBusy(true);
    try { setC(await fetchOne({ data: { id } })); setDirty(false); setFailed(false); setIndex(0); setStatus("Campagne ouverte"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Ouverture impossible."); }
    finally { setBusy(false); }
  }
  function addStage(templateId: string) {
    const o = workspace.operations.find((o: any) => o.id === templateId); if (!o) return;
    change({ ...c, stages: [...c.stages, { template_id: o.id, position: c.stages.length, objective: o.objective_text, objective_room: o.rooms.at(-1)?.key ?? "", exit_room: o.rooms.at(-1)?.key ?? "", intro_text: o.story, track: o.default_track, placements: [] }] }); setIndex(c.stages.length); setRoom(o.rooms[0]?.key ?? "");
  }
  function place(roomKey: string) {
    if (!stage || !catalog || !roomKey || !op.rooms.some((r: any) => r.key === roomKey)) return;
    const p: Placement = { id: crypto.randomUUID(), room_key: roomKey, kind, catalog_id: catalog, hidden: true, trigger: "entree", tile_x: 16, tile_y: 9, overrides: {} };
    patchStage({ placements: [...stage.placements, p] }); setSelected(p.id);
  }
  const item = stage?.placements.find((p) => p.id === selected);
  const itemCat = item && (item.kind === "mob" ? workspace.enemies : workspace.treasures).find((e: any) => e.id === item.catalog_id);

  function patchItem(patch: Partial<Placement>) { if (item && stage) patchStage({ placements: stage.placements.map((p) => p.id === item.id ? { ...p, ...patch } : p) }); }
  function reorder(i: number, dx: number) { const arr = [...c.stages]; const a = arr[i], b = arr[i + dx]; if (!a || !b) return; arr[i] = b; arr[i + dx] = a; change({ ...c, stages: arr.map((s, n) => ({ ...s, position: n })) }); setIndex(i + dx); }
  async function playtest() {
    if (busy) return;
    setBusy(true);
    try {
      const saved = await save({ data: { document: current.current as any, publish: true } });
      setC((value) => ({ ...value, id: saved.id, revision: saved.revision, status: saved.status }));
      setDirty(false);
      const result = await test({ data: { campaignId: saved.id } });
      await navigate({ to: "/salon/$code", params: { code: result.code } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Test indisponible."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => { if (!dirty || window.confirm("Abandonner les modifications non enregistrées ?")) { setC(empty()); setDirty(false); setIndex(0); } }}><Plus />Nouvelle campagne</Button><select aria-label="Mes campagnes" className={SEL + " max-w-sm"} value={c.id ?? ""} disabled={busy} onChange={(e) => void open(e.target.value)}><option value="">Mes campagnes privées</option>{workspace.campaigns.map((a: any) => <option key={a.id} value={a.id}>{a.is_template ? "Modèle · " : ""}{a.name} · {a.status === "published" ? "publiée" : "brouillon"}</option>)}</select></div>
    <section className="grid gap-3 sm:grid-cols-2">
      <label>Nom<Input className="h-11" maxLength={80} value={c.name} onChange={(e) => change({ ...c, name: e.target.value })} /></label>
      <label>Difficulté<select className={SEL} value={c.difficulty} onChange={(e) => change({ ...c, difficulty: e.target.value })}><option value="initiation">Initiation</option><option value="moyenne">Moyenne</option><option value="difficile">Difficile</option></select></label>
      <label className="sm:col-span-2">Résumé<textarea className="min-h-24 w-full border-2 border-foreground bg-background p-2" maxLength={2000} value={c.summary} onChange={(e) => change({ ...c, summary: e.target.value })} /></label>
      <label>Aventuriers recommandés<select className={SEL} value={c.recommended_players} onChange={(e) => change({ ...c, recommended_players: Number(e.target.value) })}>{[3,4,5].map((n) => <option key={n}>{n}</option>)}</select></label>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={c.is_template} onChange={(e) => change({ ...c, is_template: e.target.checked })} />Modèle personnel</label>
    </section>
    <section className="space-y-3 border-y-2 border-foreground py-4"><h2 className="section-label">Étapes de campagne</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{workspace.operations.map((o: any) => <article key={o.id} className="min-w-0 space-y-3 border-2 border-foreground p-3"><EnvironmentPreview track={o.default_track} name={o.name} /><h3 className="font-bold">{o.name}</h3><DungeonMap rooms={o.rooms} label={`Plan de ${o.name}`} /><Button variant="outline" className="min-h-11 w-full whitespace-normal" onClick={() => addStage(o.id)}><Plus />Ajouter cette map</Button></article>)}</div>
      <select aria-label="Ajouter une map" className={SEL} value="" onChange={(e) => addStage(e.target.value)}><option value="">Ajouter une map…</option>{workspace.operations.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
      <ol className="space-y-2">{c.stages.map((s, i) => <li key={i} className="flex gap-2"><Button variant={i === index ? "secondary" : "outline"} className="min-h-11 min-w-0 flex-1 justify-start whitespace-normal text-left" onClick={() => { setIndex(i); setRoom(""); setSelected(""); }}>{i + 1}. {workspace.operations.find((o: any) => o.id === s.template_id)?.name}</Button><Button size="icon" variant="outline" className="h-11 w-11" title="Monter" aria-label={`Monter l’étape ${i + 1}`} disabled={!i} onClick={() => reorder(i,-1)}><ArrowUp /></Button><Button size="icon" variant="outline" className="h-11 w-11" title="Descendre" aria-label={`Descendre l’étape ${i + 1}`} disabled={i === c.stages.length - 1} onClick={() => reorder(i,1)}><ArrowDown /></Button><Button size="icon" variant="outline" className="h-11 w-11" title="Retirer" aria-label={`Retirer l’étape ${i + 1}`} onClick={() => { change({ ...c, stages: c.stages.filter((_, n) => i !== n).map((s, n) => ({ ...s, position: n })) }); setIndex(0); }}><Trash2 /></Button></li>)}</ol>
    </section>
    {stage && op && <section className="space-y-4">
      <h2 className="font-display text-xl">{op.name}</h2>
      <div className="grid gap-3 sm:grid-cols-2"><label className="sm:col-span-2">Objectif<Input className="h-11" value={stage.objective} onChange={(e) => patchStage({ objective: e.target.value })} /></label>{([['objective_room','Salle d’objectif'],['exit_room','Sortie']] as const).map(([key,label]) => <label key={key}>{label}<select className={SEL} value={stage[key]} onChange={(e) => patchStage({ [key]: e.target.value })}>{op.rooms.map((r: any) => <option key={r.key} value={r.key}>{r.name}</option>)}</select></label>)}<label>Ambiance<select className={SEL} value={stage.track} onChange={(e) => patchStage({ track: e.target.value })}>{TRACKS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></label><label className="sm:col-span-2">Texte à l’entrée<textarea className="min-h-24 w-full border-2 border-foreground bg-background p-2" value={stage.intro_text} maxLength={2000} onChange={(e) => patchStage({ intro_text: e.target.value })} /></label></div>
      <EnvironmentPreview track={stage.track} name={op.name} />
      <Button variant="outline" className="min-h-11" onClick={() => setPreview(!preview)}>{preview ? <EyeOff /> : <Eye />}{preview ? "Revenir au narrateur" : "Prévisualiser comme un joueur"}</Button>
      <DungeonMap rooms={op.rooms} placements={preview ? playerPlacements(stage.placements) : stage.placements} current={room || op.rooms[0]?.key} selectable={op.rooms.map((r: any) => r.key)} onSelect={setRoom} />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{op.rooms.map((r: any) => { const Icon = roomIcon(r.key); const visible = preview ? playerPlacements(stage.placements) : stage.placements; return <div key={r.key} className="border-2 border-foreground p-3" onDragOver={(e) => { if (!preview) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); if (!preview) place(r.key); }}><Button variant={r.key === room ? "secondary" : "ghost"} className="min-h-11 w-full justify-start whitespace-normal text-left" onClick={() => setRoom(r.key)}><Icon />{r.name}</Button><p className="text-xs text-muted-foreground">{r.connections.join(" · ")}</p><ul>{visible.filter((p) => p.room_key === r.key).map((p) => { const cat = (p.kind === "mob" ? workspace.enemies : workspace.treasures).find((e: any) => e.id === p.catalog_id); return <li key={p.id}><Button variant="ghost" className="h-auto min-h-28 w-full justify-start gap-3 whitespace-normal text-left" disabled={preview} onClick={() => setSelected(p.id)}>{cat && <span className="w-24 shrink-0"><CatalogArtwork kind={p.kind} item={cat} /></span>}{cat?.name}{p.hidden && <EyeOff className="shrink-0" />}</Button></li>; })}</ul><p className="text-xs text-muted-foreground">{workspace.operations.find((o: any) => o.id === stage.template_id)?.events?.map((e: any) => e.text).join(" · ")}</p></div>; })}</div>
      {!preview && <><div className="grid gap-2 sm:grid-cols-4"><select aria-label="Type de placement" className={SEL} value={kind} onChange={(e) => { setKind(e.target.value as typeof kind); setCatalog(""); }}><option value="mob">Mob</option><option value="treasure">Trésor</option></select><select aria-label="Catalogue" className={SEL} value={catalog} onChange={(e) => setCatalog(e.target.value)}><option value="">Choisir…</option>{(kind === "mob" ? workspace.enemies : workspace.treasures).map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}</select><select aria-label="Salle de placement" className={SEL} value={room} onChange={(e) => setRoom(e.target.value)}><option value="">Salle…</option>{op.rooms.map((r: any) => <option key={r.key} value={r.key}>{r.name}</option>)}</select><Button className="min-h-11" disabled={!catalog || !room} draggable={!!catalog} onDragStart={(e) => e.dataTransfer.setData("text/plain",catalog)} onClick={() => place(room)}><Plus />Placer</Button></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(kind === "mob" ? workspace.enemies : workspace.treasures).map((entry: any) => <Button key={entry.id} variant={catalog === entry.id ? "secondary" : "outline"} aria-pressed={catalog === entry.id} className="h-auto min-h-44 flex-col items-stretch whitespace-normal rounded-none p-3 text-left" onClick={() => setCatalog(entry.id)}><CatalogArtwork kind={kind} item={entry} /><span className="font-bold">{entry.name}</span><span className="text-xs text-muted-foreground">{kind === "mob" ? `Vitesse ${entry.speed} · Force ${entry.strength} · Endurance ${entry.endurance}` : entry.effect}</span></Button>)}</div>
      {item && <div className="space-y-3 border-2 border-primary p-4">{itemCat && <CatalogArtwork kind={item.kind} item={itemCat} />}<h3 className="font-bold">{itemCat?.name}</h3><p>{itemCat?.ability ?? itemCat?.effect}</p><div className="grid gap-3 sm:grid-cols-2"><label>Déplacer vers<select className={SEL} value={item.room_key} onChange={(e) => patchItem({ room_key: e.target.value })}>{op.rooms.map((r: any) => <option key={r.key} value={r.key}>{r.name}</option>)}</select></label><label>Déclencheur<select className={SEL} value={item.trigger} onChange={(e) => patchItem({ trigger: e.target.value as Placement['trigger'] })}><option value="entree">À l’entrée</option><option value="porte">À l’ouverture d’une porte</option><option value="manuel">Manuel</option></select></label><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={item.hidden} onChange={(e) => patchItem({ hidden: e.target.checked })} />Caché</label>{item.kind === "mob" && ['speed','strength','endurance'].map((key) => <label key={key}>{({ speed: 'Vitesse', strength: 'Force', endurance: 'Endurance' } as any)[key]}<Input className="h-11" type="number" min={1} max={5} value={item.overrides[key] ?? itemCat?.[key] ?? 1} onChange={(e) => patchItem({ overrides: { ...item.overrides, [key]: Math.max(1,Math.min(5,Number(e.target.value))) } })} /></label>)}</div><Button variant="outline" onClick={() => { patchStage({ placements: stage.placements.filter((p) => p.id !== item.id) }); setSelected(""); }}><Trash2 />Retirer</Button></div>}</>}
    </section>}
    {issues.length > 0 && <ul role="status" className="space-y-1 text-sm text-destructive">{issues.map((s) => <li key={s}>{s}</li>)}</ul>}
    <p role="status" className="text-sm">{status || "Brouillon privé"}</p>
    <div className="flex flex-wrap gap-2"><Button disabled={busy || issues.length > 0} onClick={() => void persist(true)}>Publier</Button><Button variant="outline" disabled={busy} onClick={() => void persist()}>Enregistrer</Button><Button variant="outline" disabled={busy} onClick={() => { const { id: _, ...rest } = c; change({ ...rest, name: `${c.name} (copie)`.slice(0,80), revision: 0, status: "draft" }); }}><Copy />Dupliquer</Button><Button variant="outline" onClick={async () => { try { const { downloadCampaignPdf } = await import("@/lib/campaign-pdf"); await downloadCampaignPdf(c,workspace.operations,workspace.enemies,workspace.treasures); } catch { toast.error("PDF indisponible."); } }}><Download />PDF A4</Button><Button variant="secondary" disabled={busy || issues.length > 0} onClick={() => void playtest()}>Tester la campagne</Button>{c.id && <Button variant="outline" disabled={busy} onClick={async () => { if (!c.id || !window.confirm("Supprimer cette campagne privée ?")) return; await remove({ data: { id: c.id } }); setC(empty()); setDirty(false); refresh(); }}><Trash2 />Supprimer</Button>}</div>
    <div className="flex flex-col gap-2 sm:flex-row"><select aria-label="Salon cible" className={SEL} value={salon} onChange={(e) => setSalon(e.target.value)}><option value="">Choisir un salon en attente…</option>{workspace.salons.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><Button className="min-h-11 shrink-0" disabled={busy || dirty || c.status !== "published" || !salon || !c.id} onClick={async () => { if (!c.id) return; setBusy(true); try { await load({ data: { campaignId: c.id, gameId: salon } }); toast.success("Copie indépendante chargée dans le salon."); } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible."); } finally { setBusy(false); } }}>Charger dans le salon</Button></div>
  </div>;
}
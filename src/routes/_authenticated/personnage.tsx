import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CharacterPreview } from "@/components/CharacterPreview";
import { ACCESSORIES, DEFAULT_LOOK, OUTFIT_COLORS, SKIN_COLORS, loadCharacter, saveCharacter, type CharacterLook } from "@/lib/character";
import { RACES, RACE_NAMES, hpFor } from "@/lib/races";

export const Route = createFileRoute("/_authenticated/personnage")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Mon personnage — Bastion" },
      { name: "description", content: "Crée et personnalise ton aventurier Bastion." },
      { property: "og:title", content: "Mon personnage — Bastion" },
      { property: "og:description", content: "Crée et personnalise ton aventurier Bastion." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CharacterPage,
});

function Swatches({ label, colors, value, onChange }: { label: string; colors: readonly string[]; value: string; onChange: (c: string) => void }) {
  return <fieldset><legend className="section-label">{label}</legend><div className="mt-2 flex flex-wrap gap-2">
    {colors.map((c) => <button key={c} type="button" aria-label={`${label} ${c}`} aria-pressed={value === c} onClick={() => onChange(c)} className={`h-11 w-11 border-2 ${value === c ? "border-foreground ring-2 ring-primary" : "border-border"}`} style={{ background: c }} />)}
  </div></fieldset>;
}

function CharacterPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string>();
  const [look, setLook] = useState<CharacterLook>(DEFAULT_LOOK);
  const [isNew, setIsNew] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      const c = await loadCharacter(data.user.id);
      if (c) { setLook(c); setIsNew(false); }
    });
  }, []);
  const set = (p: Partial<CharacterLook>) => setLook((l) => ({ ...l, ...p }));
  const stats = RACES[look.race];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    try { await saveCharacter(userId, { ...look, name: look.name.trim() }); toast.success("Personnage enregistré"); if (isNew) navigate({ to: "/salons" }); setIsNew(false); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Erreur"); }
    finally { setSaving(false); }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <p className="section-label">{isNew ? "Bienvenue · étape finale" : "Profil"}</p>
      <h1 className="mt-2 font-display text-2xl uppercase">{isNew ? "Crée ton aventurier" : "Mon personnage"}</h1>
      <form onSubmit={submit} className="mt-6 grid gap-8 md:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <label className="block"><span className="section-label">Nom d'aventurier</span><Input required maxLength={40} className="mt-2 h-11 rounded-none" value={look.name} onChange={(e) => set({ name: e.target.value })} /></label>
          <fieldset><legend className="section-label">Race</legend><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {RACE_NAMES.map((r) => <button key={r} type="button" aria-pressed={look.race === r} onClick={() => set({ race: r })} className={`min-h-11 border-2 p-2 text-sm font-bold ${look.race === r ? "border-primary bg-secondary" : "border-border"}`}>{r}</button>)}
          </div></fieldset>
          <Swatches label="Peau / carapace" colors={SKIN_COLORS} value={look.skin} onChange={(skin) => set({ skin })} />
          <Swatches label="Tenue" colors={OUTFIT_COLORS} value={look.outfit} onChange={(outfit) => set({ outfit })} />
          <fieldset><legend className="section-label">Accessoire</legend><div className="mt-2 flex flex-wrap gap-2">
            {ACCESSORIES.map((a) => <button key={a.key} type="button" aria-pressed={look.accessory === a.key} onClick={() => set({ accessory: a.key })} className={`min-h-11 border-2 px-3 text-sm font-bold ${look.accessory === a.key ? "border-primary bg-secondary" : "border-border"}`}>{a.label}</button>)}
          </div></fieldset>
        </div>
        <aside className="h-fit border-2 border-foreground p-4 md:sticky md:top-4">
          <div className="flex justify-center bg-secondary p-4"><CharacterPreview look={look} size={200} /></div>
          <p className="mt-3 font-pixel text-sm">{look.name || "Sans nom"}</p>
          <p className="text-sm text-muted-foreground">{look.race}</p>
          <dl className="mt-3 grid grid-cols-2 gap-1 text-sm">
            <dt>Vitesse</dt><dd className="font-bold">{stats.speed}</dd>
            <dt>Force</dt><dd className="font-bold">{stats.strength}</dd>
            <dt>Endurance</dt><dd className="font-bold">{stats.endurance}</dd>
            <dt>PV</dt><dd className="font-bold">{hpFor(look.race)}</dd>
          </dl>
          <Button disabled={saving || !userId} className="mt-4 min-h-11 w-full rounded-none font-black uppercase">{saving ? "Enregistrement…" : isNew ? "Commencer l'aventure" : "Enregistrer"}</Button>
        </aside>
      </form>
    </main>
  );
}

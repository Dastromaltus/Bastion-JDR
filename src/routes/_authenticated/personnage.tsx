import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CharacterPreview } from "@/components/CharacterPreview";
import { DEFAULT_LOOK, loadCharacter, saveCharacter, type CharacterLook } from "@/lib/character";
import { RACES, hpFor } from "@/lib/races";

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
  const set = (p: Partial<CharacterLook>) => setLook((l) => ({ ...l, ...p, race: "Humain" }));
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
          <div><p className="section-label">Race d’aventurier par défaut</p><p className="mt-2 font-bold">Humain</p></div>
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

import { createFileRoute, Link } from "@tanstack/react-router";
import { TRACKS, SFX } from "@/lib/ambience-tracks";

export const Route = createFileRoute("/credits")({
  head: () => ({
    meta: [
      { title: "Crédits audio — Bastion" },
      { name: "description", content: "Sources et licences des ambiances sonores et effets du jeu Bastion." },
      { property: "og:title", content: "Crédits audio — Bastion" },
      { property: "og:description", content: "Sources et licences des ambiances sonores et effets du jeu Bastion." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Credits,
});

function Credits() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-background px-4 py-8">
      <Link to="/" className="font-display text-xl uppercase">Bastion<span className="text-primary">.</span></Link>
      <h1 className="mt-6 font-display text-5xl uppercase">Crédits audio</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Chaque ambiance est pour l'instant une boucle générée en direct par le navigateur, libre de droits. Chaque emplacement peut être remplacé par un fichier .mp3 ou .ogg libre de droits.
      </p>
      <h2 className="section-label mt-8">Ambiances</h2>
      <ul className="mt-3 divide-y divide-foreground/20 border-2 border-foreground">
        {TRACKS.filter((t) => t.key !== "silence").map((t) => (
          <li key={t.key} className="p-3 text-sm"><b>{t.label}</b><br /><span className="text-muted-foreground">{t.url ? <a className="underline" href={t.url}>{t.source}</a> : t.source}</span></li>
        ))}
      </ul>
      <h2 className="section-label mt-8">Effets</h2>
      <ul className="mt-3 divide-y divide-foreground/20 border-2 border-foreground">
        {SFX.map((s) => <li key={s.key} className="p-3 text-sm"><b>{s.label}</b> — {s.url ?? "Synthèse procédurale Web Audio (CC0)"}</li>)}
      </ul>
    </main>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getRoomPreview, joinRoom } from "@/lib/rooms.functions";
import { RACE_NAMES, scenarioLabel } from "@/lib/races";

export const Route = createFileRoute("/_authenticated/rejoindre/$code")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Rejoindre un salon — Bastion" },
      { name: "description", content: "Invitation à rejoindre un salon privé Bastion." },
      { property: "og:title", content: "Rejoindre un salon — Bastion" },
      { property: "og:description", content: "Invitation à rejoindre un salon privé Bastion." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const preview = useServerFn(getRoomPreview);
  const join = useServerFn(joinRoom);
  const room = useQuery({ queryKey: ["preview", code], queryFn: () => preview({ data: { code } }) });
  const [name, setName] = useState("");
  const [race, setRace] = useState<(typeof RACE_NAMES)[number]>("Humain");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await join({ data: { code, displayName: name, race, password: password || undefined } });
      if (r.ok) navigate({ to: "/salon/$code", params: { code: r.code } });
      else setError(r.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de rejoindre.");
    } finally {
      setLoading(false);
    }
  }

  const r = room.data;
  const closed = r && (r.status !== "waiting" || r.locked || r.players >= r.maxPlayers);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md border-2 border-foreground p-6">
        <p className="section-label">Invitation · <span className="font-pixel">{code}</span></p>
        {room.isLoading && <p className="mt-4">Recherche du salon…</p>}
        {room.data === null && <p role="alert" className="mt-4 font-bold text-primary">Aucun salon ne correspond à ce code.</p>}
        {r && (
          <>
            <h1 className="mt-3 font-display text-2xl uppercase">{r.name}</h1>
            <p className="text-sm text-muted-foreground">{scenarioLabel(r.scenario)} · {r.players}/{r.maxPlayers} joueurs</p>
            {closed ? (
              <p role="alert" className="mt-6 font-bold text-primary">
                {r.status !== "waiting" ? "La partie a déjà commencé : les nouvelles arrivées sont refusées." : r.locked ? "Le narrateur a verrouillé ce salon." : "Ce salon est complet."}
              </p>
            ) : null}
            <form data-motion-enter onSubmit={submit} className="mt-6 space-y-3">
              <Input required maxLength={40} className="h-11 rounded-none" placeholder="Ton nom d'aventurier" value={name} onChange={(e) => setName(e.target.value)} />
              <select className="h-11 w-full border border-input bg-background px-2" value={race} onChange={(e) => setRace(e.target.value as any)}>
                {RACE_NAMES.map((n) => <option key={n}>{n}</option>)}
              </select>
              {r.hasPassword && <Input type="password" required className="h-11 rounded-none" placeholder="Mot de passe du salon" value={password} onChange={(e) => setPassword(e.target.value)} />}
              {error && <p role="alert" className="text-sm font-bold text-primary">{error}</p>}
              <Button disabled={loading} className="min-h-11 w-full rounded-none font-black uppercase">{loading ? "Connexion…" : "Rejoindre le salon"}</Button>
            </form>
          </>
        )}
        <Link to="/salons" className="mt-6 inline-flex min-h-11 items-center underline">Retour à mes salons</Link>
      </div>
    </main>
  );
}

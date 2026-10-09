import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Connexion — Bastion" },
      { name: "description", content: "Connecte-toi pour créer ou rejoindre un salon Bastion." },
      { property: "og:title", content: "Connexion — Bastion" },
      { property: "og:description", content: "Connecte-toi pour créer ou rejoindre un salon Bastion." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function safePath(p?: string) {
  return p && p.startsWith("/") && !p.startsWith("//") ? p : "/salons";
}

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const target = safePath(redirect);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const stored = sessionStorage.getItem("bastion-after-auth");
        sessionStorage.removeItem("bastion-after-auth");
        navigate({ to: safePath(stored ?? redirect) });
      }
    });
  }, [navigate, redirect]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const res =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + target } });
    setLoading(false);
    if (res.error) {
      setError(res.error.message.includes("Invalid login") ? "E-mail ou mot de passe incorrect." : res.error.message);
      return;
    }
    if (mode === "up" && !res.data.session) {
      setInfo("Compte créé. Vérifie ta boîte mail pour confirmer ton adresse.");
      return;
    }
    navigate({ to: target });
  }

  async function google() {
    setError(null);
    sessionStorage.setItem("bastion-after-auth", target);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) setError("Connexion Google impossible. Réessaie.");
    else if (!("redirected" in r && r.redirected)) navigate({ to: target });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm border-2 border-foreground p-6">
        <a href="/" className="font-display text-xl uppercase">Bastion<span className="text-primary">.</span></a>
        <h1 className="mt-6 font-display text-lg uppercase">{mode === "in" ? "Connexion" : "Créer un compte"}</h1>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <Input type="email" required placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-none" />
          <Input type="password" required minLength={6} placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-none" />
          {error && <p role="alert" className="text-sm font-bold text-primary">{error}</p>}
          {info && <p className="text-sm">{info}</p>}
          <Button type="submit" disabled={loading} className="h-11 w-full rounded-none font-black uppercase">
            {loading ? "Patiente…" : mode === "in" ? "Se connecter" : "Créer le compte"}
          </Button>
        </form>
        <Button variant="outline" onClick={google} className="mt-3 h-11 w-full rounded-none font-bold uppercase">Continuer avec Google</Button>
        <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-5 min-h-11 text-sm underline">
          {mode === "in" ? "Pas de compte ? Inscris-toi" : "Déjà un compte ? Connecte-toi"}
        </button>
      </div>
    </main>
  );
}

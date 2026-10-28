import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Grid3x3, LogOut, Map, Swords, User, Users } from "lucide-react";
import bastionEmblem from "@/assets/bastion-emblem.png";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const destinations = [
  { to: "/salons", label: "Mes salons", icon: Users },
  { to: "/campagnes", label: "Mes campagnes", icon: Map },
  { to: "/cartes", label: "Mes cartes", icon: Grid3x3 },
  { to: "/operations", label: "Opérations", icon: Swords },
  { to: "/personnage", label: "Mon personnage", icon: User },
  { to: "/", label: "Règles du jeu", icon: BookOpen },
] as const;

export function SiteNavigation() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const workspace = ["/salons", "/campagnes", "/cartes", "/operations"].includes(pathname);
  if (!workspace && pathname !== "/" && pathname !== "/credits") return null;

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error("Déconnexion impossible. Réessaie.");
  }

  return (
    <header className="border-b-2 border-foreground bg-background px-4 py-4 md:px-10">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <Link to="/" aria-label="Bastion — accueil" className="flex min-h-11 items-center gap-3 font-display text-base uppercase">
          <img src={bastionEmblem} alt="" aria-hidden="true" className="size-9 shrink-0" loading="lazy" />Bastion<span className="text-primary">.</span>
        </Link>
        <Button variant="ghost" className="min-h-11" asChild={!workspace} onClick={workspace ? signOut : undefined}>
          {workspace ? <><LogOut aria-hidden="true" /><span>Déconnexion</span></> : <Link to="/salons"><Users aria-hidden="true" />Jouer</Link>}
        </Button>
        <nav aria-label="Navigation principale" className="grid w-full grid-cols-2 gap-2 border-t border-border pt-3 sm:flex sm:flex-wrap">
          {destinations.map(({ to, label, icon: Icon }) => (
            <Button key={to} asChild variant={pathname === to ? "secondary" : "ghost"} className="min-h-11 justify-start rounded-none px-3 font-bold sm:justify-center">
              <Link to={to} aria-current={pathname === to ? "page" : undefined}><Icon aria-hidden="true" />{label}</Link>
            </Button>
          ))}
        </nav>
      </div>
    </header>
  );
}
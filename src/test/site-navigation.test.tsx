import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SiteNavigation } from "@/components/SiteNavigation";

const state = vi.hoisted(() => ({ pathname: "/salons" }));
vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) => select({ location: { pathname: state.pathname } }),
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => <a href={to} {...props}>{children}</a>,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut: vi.fn(async () => ({ error: null })) } } }));
afterEach(cleanup);

describe("shared site navigation", () => {
  it("links to each existing workspace and marks the current page", () => {
    state.pathname = "/salons";
    render(<SiteNavigation />);
    expect(screen.getByRole("link", { name: "Mes salons" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Mes campagnes" }).getAttribute("href")).toBe("/campagnes");
    expect(screen.getByRole("link", { name: "Cartes prêtes à jouer" }).getAttribute("href")).toBe("/operations");
    expect(screen.getByRole("link", { name: "Règles du jeu" }).getAttribute("href")).toBe("/");
  });
  it("keeps the active game free of workspace controls", () => {
    state.pathname = "/salon/ABC123";
    render(<SiteNavigation />);
    expect(screen.queryByRole("navigation")).toBeNull();
  });
  it("offers playing rather than sign-out on the public rulebook", () => {
    state.pathname = "/";
    render(<SiteNavigation />);
    expect(screen.getByRole("link", { name: "Jouer" }).getAttribute("href")).toBe("/salons");
    expect(screen.queryByRole("button", { name: "Déconnexion" })).toBeNull();
  });
});
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/campagnes")({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Cartes personnelles — Bastion" },
    { name: "description", content: "Retrouvez vos cartes personnelles Bastion de 160 × 160 cases." },
    { property: "og:title", content: "Cartes personnelles — Bastion" },
    { property: "og:description", content: "Vos cartes créées personnellement pour préparer vos salons Bastion." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: () => { throw redirect({ to: "/cartes", replace: true }); },
});

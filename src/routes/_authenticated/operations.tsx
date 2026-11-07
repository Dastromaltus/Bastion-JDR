import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/operations")({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Bibliothèque personnelle — Bastion" },
    { name: "description", content: "Retrouvez vos cartes personnelles Bastion de 40 × 40 cases." },
    { property: "og:title", content: "Bibliothèque personnelle — Bastion" },
    { property: "og:description", content: "Vos cartes créées personnellement pour préparer vos salons Bastion." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: () => { throw redirect({ to: "/cartes", replace: true }); },
});

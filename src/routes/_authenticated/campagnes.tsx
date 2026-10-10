import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getCampaignWorkspace } from "@/lib/campaigns.functions";
import { CampaignEditor } from "@/components/operations/CampaignEditor";
import { Button } from "@/components/ui/button";
const workspaceOptions = queryOptions({ queryKey: ["campaign-workspace"], queryFn: () => getCampaignWorkspace() });
export const Route = createFileRoute("/_authenticated/campagnes")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "Concevoir une campagne privée — Bastion" }, { name: "description", content: "Préparer les maps, mobs, trésors et objectifs de ta campagne privée Bastion." }, { property: "og:title", content: "Concevoir une campagne privée — Bastion" }, { property: "og:description", content: "Éditeur privé de campagnes Bastion pour les narrateurs." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(workspaceOptions),
  component: CampaignPage,
});
function CampaignPage() {
  const q = useSuspenseQuery(workspaceOptions);
  return <main className="mx-auto min-h-screen max-w-7xl bg-background px-4 pb-16 pt-8 md:px-10"><p className="section-label">Atelier du narrateur</p><h1 className="my-6 break-words font-display text-xl leading-relaxed sm:text-3xl">Mes campagnes</h1>{q.data.allowed ? <CampaignEditor workspace={q.data} refresh={() => { void q.refetch(); }} /> : <div className="space-y-4"><p>Crée un salon dont tu es narrateur pour concevoir une campagne.</p><Button asChild className="min-h-11"><Link to="/salons">Mes salons</Link></Button></div>}</main>;
}
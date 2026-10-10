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
  return <main className="min-h-screen bg-background px-4 pb-16 pt-6 md:px-10"><header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-foreground pb-4"><Link to="/" className="font-display text-lg">Bastion</Link><Button asChild variant="outline"><Link to="/salons">Mes salons</Link></Button></header><h1 className="my-8 font-display text-3xl">Concevoir une campagne</h1>{q.data.allowed ? <CampaignEditor workspace={q.data} refresh={() => { void q.refetch(); }} /> : <p>Crée un salon dont tu es narrateur pour concevoir une campagne.</p>}</main>;
}
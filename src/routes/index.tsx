import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, Crown, KeyRound, Shield, Swords, Users, Zap } from "lucide-react";
import { CharacterPreview } from "@/components/CharacterPreview";
import { DEFAULT_LOOK } from "@/lib/character";
import bastionLogo from "@/assets/bastion-logo-full.png";
import bastionFortress from "@/assets/bastion-fortress.jpg";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Bastion — Entrez dans la forteresse" },
      { name: "description", content: "Découvrez Bastion, le jeu de rôle de plateau asymétrique de Mathéo Destin pour 3 à 5 joueurs." },
      { property: "og:title", content: "Bastion — Entrez dans la forteresse" },
      { property: "og:description", content: "Des aventuriers humains et nains, trois classes et des cartes personnelles face au narrateur." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const salonSteps = [
  { icon: <Users size={28} />, title: "01 · Monte ton salon", text: "Choisis un nom, le nombre de joueurs (3 à 5) et prépare tes cartes. Un mot de passe optionnel protège l’entrée, et le salon peut rester en attente jusqu’à la partie." },
  { icon: <KeyRound size={28} />, title: "02 · Invite la table", text: "Partage le code à six caractères ou le lien d’invitation. Chaque aventurier rejoint en un clic, même si la partie a déjà commencé." },
  { icon: <Crown size={28} />, title: "03 · Incarne le narrateur", text: "Le créateur devient narrateur : il enchaîne ses cartes en parcours, place ennemis et trésors, choisit la musique et le texte de chaque étape, puis contrôle les mobs en jeu." },
];

const classes = [
  { name: "Guerrier", trait: "Frappe lourde", detail: "Le plus solide du groupe. Ses coups font mal et il encaisse sans broncher." },
  { name: "Mage", trait: "Trait arcanique", detail: "Fragile mais dévastateur. Sa magie perce les défenses les plus épaisses." },
  { name: "Voleur", trait: "Coup sournois", detail: "Rapide et opportuniste. Il frappe là où personne ne l’attend." },
];

const mapFeatures = [
  { title: "Cartes 160 × 160", text: "De vastes plateaux en pixel art, dessinés case par case avec des pinceaux de toutes tailles — ou remplis d’une texture en un clic." },
  { title: "Textures et barrières", text: "Trente textures de sol et de mur, plus des barrières infranchissables qui gardent leur apparence pour piéger le regard." },
  { title: "Ennemis plaçables", text: "Zombie, slime vert, yéti, loup, orc, gobelin et cyclope : pose-les sur tes cartes, le narrateur les révèle et les contrôle en jeu." },
  { title: "Passages entre étapes", text: "Place un point de passage sur chaque carte : quand un aventurier l’atteint, tout le groupe bascule vers l’étape suivante du parcours." },
];

const phases = [
  { number: "01", title: "Préparation", text: "Choisissez votre classe, nommez votre aventurier humain et composez une équipe capable de survivre au Bastion." },
  { number: "02", title: "Affrontement", text: "Déplacez-vous librement au clavier (Z, Q, S, D) ; attaques et capacités se résolvent en tour par tour, avec des dés lancés côté serveur." },
  { number: "03", title: "Exploration", text: "Traversez les immenses cartes préparées par le narrateur, une étape après l’autre, en atteignant les points de passage." },
];

function Index() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <section className="relative min-h-[74vh] border-b-4 border-primary">
        <img src={bastionFortress} alt="Cinq aventuriers avancent vers la forteresse de Bastion" width={1536} height={1024} className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-hero-overlay" />
        <div id="top" data-motion-enter className="relative z-10 flex min-h-[74vh] max-w-7xl flex-col justify-end px-5 pb-12 pt-20 md:px-10 md:pb-16">
          <p className="mb-4 flex items-center gap-3 text-xs font-black uppercase text-primary"><span className="h-px w-10 bg-primary" /> Dungeon crawler asymétrique</p>
          <h1 className="font-display"><img src={bastionLogo} alt="Bastion" className="anim-pop w-[min(72vw,22rem)] [image-rendering:pixelated]" /></h1>
          <div className="mt-8 grid gap-8 border-t border-foreground/40 pt-6 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p className="max-w-xl text-lg font-medium leading-relaxed md:text-xl">Les aventuriers avancent. Le narrateur prépare l’inconnu. <span className="text-primary">La forteresse ne pardonne rien.</span></p>
              <div className="mt-6 flex flex-wrap gap-3"><Button asChild className="h-auto min-h-12 rounded-none border-2 border-primary px-5 py-3 font-bold"><Link to="/salons"><Users />Créer ou rejoindre un salon</Link></Button><Button asChild variant="outline" className="h-auto min-h-12 rounded-none px-5 py-3 font-bold"><Link to="/cartes"><Swords />Mes cartes</Link></Button></div>
            </div>
            <a href="#concept" aria-label="Découvrir le jeu" className="flex h-14 w-14 items-center justify-center border-2 border-foreground transition-colors hover:border-primary hover:bg-primary"><ArrowDown size={24} /></a>
          </div>
        </div>
      </section>

      <nav aria-label="Sommaire des règles" className="flex flex-wrap gap-2 border-b border-border px-5 py-4 md:px-10">
        {[{ id: "concept", label: "Le jeu" }, { id: "salons", label: "Les salons" }, { id: "cartes", label: "Les cartes" }, { id: "peuples", label: "Les races" }, { id: "classes", label: "Les classes" }, { id: "partie", label: "Les phases" }].map(({ id, label }) => <Button key={id} asChild variant="ghost" className="min-h-11 rounded-none font-bold"><a href={`#${id}`}>{label}</a></Button>)}
      </nav>

      <section id="concept" data-motion-stagger className="grid border-b border-border lg:grid-cols-2">
        <div className="px-5 py-20 md:px-10 lg:border-r lg:border-border lg:py-28">
          <p className="section-label">Le pacte de jeu</p>
          <h2 className="mt-6 max-w-2xl font-display text-3xl font-black uppercase leading-[0.9] tracking-normal md:text-5xl">Tous contre<br /><span className="text-primary">le narrateur.</span></h2>
        </div>
        <div className="flex flex-col justify-between gap-14 px-5 py-20 md:px-10 lg:py-28">
          <p className="max-w-2xl text-xl leading-relaxed text-muted-foreground md:text-2xl">Né d’une passion pour les jeux de plateau et les jeux de rôle, Bastion oppose un groupe d’aventuriers à celui qui incarne les lieux, les ennemis et les événements inconnus.</p>
          <div className="grid grid-cols-3 border-y border-border py-6">
            <Stat icon={<Zap />} title="Vitesse" />
            <Stat icon={<Swords />} title="Force" />
            <Stat icon={<Shield />} title="Endurance" />
          </div>
        </div>
      </section>

      <section id="salons" className="border-b border-border bg-secondary px-5 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div data-motion-enter className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div><p className="section-label">Salons privés</p><h2 className="mt-4 font-display text-3xl font-black uppercase leading-none tracking-normal md:text-5xl">Conçois tes propres<br /><span className="text-primary">parties.</span></h2></div>
            <p className="max-w-sm text-sm text-muted-foreground">Un salon, un code à six caractères et la table est montée. Toi ou un ami incarne le narrateur, les autres incarnent les aventuriers humains — en ligne, sur téléphone ou ordinateur.</p>
          </div>
          <div data-motion-stagger className="grid border border-border bg-background md:grid-cols-3">
            {salonSteps.map((step) => (
              <article key={step.title} className="border-b border-border p-7 last:border-b-0 md:border-b-0 md:border-r md:p-9 md:last:border-r-0">
                <span className="text-primary">{step.icon}</span>
                <h3 className="mt-5 font-display text-base font-black uppercase tracking-normal">{step.title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 flex flex-col gap-4 md:flex-row md:items-center">
            <Button asChild className="h-auto min-h-12 rounded-none px-5 py-3 font-bold"><Link to="/salons"><Users />Créer ou rejoindre un salon</Link></Button>
            <p className="text-xs font-bold uppercase text-muted-foreground">Gratuit · 3 à 5 joueurs · Le créateur devient narrateur</p>
          </div>
        </div>
      </section>

      <section id="cartes" className="border-b border-border px-5 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div data-motion-enter className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div><p className="section-label">Atelier du narrateur</p><h2 className="mt-4 font-display text-3xl font-black uppercase leading-none tracking-normal md:text-5xl">Dessine tes<br /><span className="text-primary">propres cartes.</span></h2></div>
            <p className="max-w-sm text-sm text-muted-foreground">L’éditeur de cartes te donne les clés du Bastion : terrain, monstres, trésors, musique et passages, tout se prépare avant le lancement.</p>
          </div>
          <div data-motion-stagger className="grid border border-border sm:grid-cols-2 lg:grid-cols-4">
            {mapFeatures.map((feature) => (
              <article key={feature.title} className="border-b border-border p-7 last:border-b-0 sm:border-r sm:[&:nth-child(2n)]:border-r-0 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-last-child(-n+2)]:border-b-0 lg:last:border-r-0">
                <h3 className="font-display text-base font-black uppercase tracking-normal">{feature.title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{feature.text}</p>
              </article>
            ))}
          </div>
          <div className="mt-10"><Button asChild variant="outline" className="h-auto min-h-12 rounded-none px-5 py-3 font-bold"><Link to="/cartes"><Swords />Ouvrir l’éditeur de cartes</Link></Button></div>
        </div>
      </section>

      <section id="peuples" className="px-5 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-7xl">
          <p className="section-label">Races d’aventurier</p>
          <h2 className="mt-4 font-display text-3xl font-black uppercase md:text-5xl">Humain et Nain</h2>
          <div data-motion-enter className="mt-8 flex flex-wrap items-center gap-8">
            <CharacterPreview look={DEFAULT_LOOK} size={192} />
            <CharacterPreview look={{ ...DEFAULT_LOOK, race: "Nain" }} size={192} />
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">L’Humain reste la race par défaut. Tu peux aussi incarner un Nain. Choisis ta classe — Guerrier, Mage ou Voleur — et rejoins le groupe face aux monstres du Bastion.</p>
          </div>
        </div>
      </section>

      <section id="classes" className="border-y border-border bg-secondary px-5 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div data-motion-enter className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div><p className="section-label">Choisir sa voie</p><h2 className="mt-4 font-display text-3xl font-black uppercase leading-none tracking-normal md:text-5xl">Trois classes</h2></div>
            <p className="max-w-sm text-sm text-muted-foreground">Chaque aventurier choisit une classe : points de vie, dégâts et capacité propre, visibles par toute la table.</p>
          </div>
          <div data-motion-stagger className="grid border border-border bg-background md:grid-cols-3">
            {classes.map((item) => (
              <article key={item.name} className="border-b border-border p-7 last:border-b-0 md:border-b-0 md:border-r md:p-9 md:last:border-r-0">
                <span className="text-xs font-black uppercase text-primary">Capacité / {item.trait}</span>
                <h3 className="mt-3 font-display text-base font-black uppercase tracking-normal">{item.name}</h3>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="partie" className="border-b border-border px-5 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-7xl">
          <p className="section-label">Structure de partie</p><h2 className="mt-4 font-display text-3xl font-black uppercase tracking-normal md:text-5xl">Trois temps.<br />Une mission.</h2>
          <div data-motion-stagger className="mt-14 grid border-t border-border md:grid-cols-3">
            {phases.map((phase) => <article key={phase.number} className="group border-b border-border py-8 md:border-b-0 md:border-r md:px-7 md:first:pl-0 md:last:border-r-0"><span className="font-display text-3xl font-black text-primary">{phase.number}</span><h3 className="mt-10 text-base font-black uppercase">{phase.title}</h3><p className="mt-4 text-sm leading-relaxed text-muted-foreground">{phase.text}</p></article>)}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 md:px-10 md:py-28">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.8fr_1.2fr]">
          <div data-motion-enter><p className="section-label">Protocole de test</p><h2 className="mt-5 font-display text-3xl font-black uppercase leading-none tracking-normal md:text-5xl">Jouer.<br /><span className="text-primary">Observer.</span><br />Ajuster.</h2></div>
          <ol className="divide-y divide-border border-y border-border">
            {["Lancer une partie courte", "Répartir les trois classes dans le groupe", "Limiter chacun à une compétence forte", "Noter ce qui gagne trop souvent", "Ajuster les coûts, durées et restrictions"].map((step, i) => <li key={step} className="flex items-center gap-5 py-5"><span className="text-xs font-black text-primary">0{i + 1}</span><span className="font-bold">{step}</span></li>)}
          </ol>
        </div>
      </section>

      <footer className="border-t-4 border-primary bg-card px-5 py-10 md:px-10"><div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-end md:justify-between"><div><p className="font-display text-2xl font-black uppercase">Bastion<span className="text-primary">.</span></p><p className="mt-2 text-xs text-muted-foreground">Un jeu de Mathéo Destin · 27/07/2026</p><Button asChild variant="link" className="mt-2 min-h-11 px-0"><Link to="/credits">Crédits audio</Link></Button></div><p className="text-xs font-bold uppercase">Financement participatif · Ulule · PIJ</p></div></footer>
    </main>
  );
}

function Stat({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <div className="flex flex-col items-center gap-3 border-r border-border text-center last:border-r-0"><span className="text-primary">{icon}</span><span className="text-[10px] font-black uppercase">{title}</span></div>;
}

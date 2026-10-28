import zombieIdle from "@/assets/zombie-Idle.gif.asset.json";
import { isZombie } from "@/lib/world-actors";
import { useEffect, useRef } from "react";
import decor from "@/assets/zone-tiles.png.asset.json";
import map from "@/data/salon-world.json";
import { WORLD_DECOR_ROWS } from "@/lib/world-decor";

/** Pixel silhouettes use the existing semantic palette, including custom catalogues. */
export function CatalogArtwork({ kind, item }: { kind: "mob" | "treasure"; item: { name: string; category?: string; type?: string } }) {
  const robot = /robot|drone|machine|sentinelle/i.test(`${item.category} ${item.name}`);
  const boss = /boss|gardien|coeur/i.test(`${item.category} ${item.name}`);
  const key = item.type === "cle";
  const weapon = item.type === "arme";
  const potion = item.type === "consommable";
  if (kind === "mob" && isZombie(item.name)) return <div role="img" aria-label={`Design de ${item.name}`} className="relative mx-auto size-24 shrink-0 overflow-hidden">
    <img src={zombieIdle.url} alt="" className="absolute left-1/2 top-1/2 h-auto w-[12rem] max-w-none -translate-x-1/2 -translate-y-[45%] [image-rendering:pixelated]" />
  </div>;
  return <svg role="img" aria-label={`Design de ${item.name}`} viewBox="0 0 32 32" className="mx-auto size-24! shrink-0" shapeRendering="crispEdges">
    {kind === "mob" ? <>
      <path d={robot ? "M8 5h16v12H8zM6 18h20v9H6zM3 18h3v7H3zM26 18h3v7h-3zM9 27h5v4H9zM18 27h5v4h-5z" : boss ? "M3 3h5v7h16V3h5v18h-4v7H7v-7H3zM8 28h6v3H8zM18 28h6v3h-6z" : "M10 3h4v4h4V3h4v5h4v16h-4v5H10v-5H6V8h4zM3 16h3v10H3zM26 16h3v10h-3z"} className="fill-primary stroke-foreground" strokeWidth="1" />
      <path d="M10 11h4v4h-4zM18 11h4v4h-4z" className="fill-secondary" /><path d="M11 12h2v2h-2zM19 12h2v2h-2zM13 20h6v2h-6z" className="fill-foreground" />
      {robot && <path d="M11 24h10v2H11zM15 1h2v4h-2z" className="fill-accent" />}
    </> : key ? <><path d="M3 5h12v12H3zM13 10h16v4H13zM23 14h3v5h-3z" className="fill-secondary stroke-foreground" /><path d="M7 9h4v4H7z" className="fill-background" /></> : weapon ? <><path d="M23 2h7v7L13 26l-7-7z" className="fill-accent stroke-foreground" /><path d="M3 16l13 13 3-3L6 13zM2 28l7-7 3 3-7 7z" className="fill-secondary stroke-foreground" /></> : potion ? <><path d="M12 3h8v8l5 5v13H7V16l5-5z" className="fill-accent stroke-foreground" /><path d="M8 19h16v9H8z" className="fill-primary" /><path d="M11 2h10v4H11z" className="fill-secondary stroke-foreground" /></> : <><path d="M4 10h24v19H4zM7 5h18v5H7z" className="fill-secondary stroke-foreground" /><path d="M4 16h24v3H4zM14 14h4v9h-4z" className="fill-primary stroke-foreground" /><path d="M16 2l6 5-6 6-6-6z" className="fill-accent stroke-foreground" /></>}
  </svg>;
}

export function EnvironmentPreview({ track, name }: { track?: string; name: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let disposed = false;
    const image = new Image();
    image.onload = () => {
      const ctx = canvas.current?.getContext("2d");
      if (!ctx || disposed) return;
      ctx.imageSmoothingEnabled = false;
      const zone = track === "couloirs" ? "salle-machines" : track === "laboratoire" ? "laboratoire" : track === "boss" ? "coeur" : "entree";
      const row = WORLD_DECOR_ROWS[zone] ?? 1;
      map.layers[0]?.data.forEach((tile, i) => ctx.drawImage(image, (tile - 1) * 16, row * 16, 16, 16, (i % map.width) * 16, Math.floor(i / map.width) * 16, 16, 16));
    };
    image.src = decor.url;
    return () => { disposed = true; };
  }, [track]);
  return <canvas ref={canvas} width={400} height={272} role="img" aria-label={`Décor pixel art de ${name}`} className="aspect-[25/17] w-full [image-rendering:pixelated]" />;
}
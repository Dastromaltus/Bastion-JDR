import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapCanvas, type MapMarker } from "@/components/maps/MapCanvas";
import { getSalonMap } from "@/lib/maps.functions";
import { cellWalkable } from "@/lib/map-grid";

/** Narrator picks the exact 40×40 cell where an enemy or treasure goes, over the salon's map. */
export function CellPicker({ d, value, onChange, glyph }: { d: any; value: { x: number; y: number } | null; onChange: (c: { x: number; y: number } | null) => void; glyph: string }) {
  const fetchMap = useServerFn(getSalonMap);
  const map = useQuery({ queryKey: ["salon-map", d.game.id, "picker", (d.events ?? []).filter((e: any) => e.kind === "carte").length], queryFn: () => fetchMap({ data: { gameId: d.game.id } }) });
  if (!map.data) return <p className="text-sm">Chargement de la carte…</p>;
  const markers: MapMarker[] = [
    ...d.enemies.filter((e: any) => e.status !== "vaincu" && e.tile_x != null).map((e: any) => ({ x: e.tile_x, y: e.tile_y, glyph: e.icon || "☠", zombie: /zombie/i.test(e.name) })),
    ...d.treasures.filter((t: any) => t.tile_x != null && t.status === "cache").map((t: any) => ({ x: t.tile_x, y: t.tile_y, glyph: "✦" })),
    ...(value ? [{ ...value, glyph, selected: true }] : []),
  ];
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold uppercase">Case sur la carte {value ? `· (${value.x + 1}, ${value.y + 1})` : "· touche une case"}</p>
      <div className="mx-auto max-w-sm border-2 border-foreground">
        <MapCanvas tiles={map.data.tiles} spawn={map.data.spawn} markers={markers} label={`Carte ${map.data.name} : choisir une case`}
          onCell={(x, y, kind) => { if (kind === "down") onChange(cellWalkable(map.data!, x, y) ? { x, y } : null); }} />
      </div>
      {value && <button type="button" className="min-h-11 text-sm underline" onClick={() => onChange(null)}>Placement automatique</button>}
    </div>
  );
}

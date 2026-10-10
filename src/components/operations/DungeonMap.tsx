import { useEffect, useRef } from "react";
import { roomIcon } from "@/lib/map-identity";
import { motionDisabled } from "@/lib/motion";

export type MapRoom = { key: string; name: string; grid_x: number; grid_y: number; connections: string[]; explored?: boolean };

const CW = 120, CH = 70, BW = 96, BH = 46;

/** Pixel-style schema of connected rooms. Unexplored rooms are greyed when `fog` is on. */
export function DungeonMap({
  rooms, current, fog = false, selectable = [], onSelect, label = "Carte des salles", playersHere,
}: {
  rooms: MapRoom[]; current?: string | undefined; fog?: boolean; selectable?: string[] | undefined; onSelect?: ((key: string) => void) | undefined; label?: string; playersHere?: number | undefined;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const explored = useRef(new Set(rooms.filter((r) => r.explored).map((r) => r.key)));
  useEffect(() => {
    for (const room of rooms) {
      if (!room.explored || explored.current.has(room.key)) continue;
      explored.current.add(room.key);
      if (!motionDisabled()) {
        const group = [...(svg.current?.querySelectorAll<SVGGElement>("[data-room]") ?? [])].find((g) => g.dataset["room"] === room.key);
        group?.animate([{ opacity: 0.55 }, { opacity: 1 }], { duration: 250, easing: "linear" });
      }
    }
  }, [JSON.stringify(rooms.map((r) => [r.key, r.explored]))]);
  if (!rooms.length) return <p className="text-sm text-muted-foreground">Aucune salle.</p>;
  const maxX = Math.max(...rooms.map((r) => r.grid_x)), maxY = Math.max(...rooms.map((r) => r.grid_y));
  const w = (maxX + 1) * CW, h = (maxY + 1) * CH;
  const pos = (r: MapRoom) => ({ x: r.grid_x * CW + (CW - BW) / 2, y: r.grid_y * CH + (CH - BH) / 2 });
  const byKey = new Map(rooms.map((r) => [r.key, r]));
  const edges = new Set<string>();
  for (const r of rooms) for (const c of r.connections) if (byKey.has(c)) edges.add([r.key, c].sort().join("|"));
  return (
    <svg ref={svg} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="h-auto w-full max-w-full" style={{ shapeRendering: "crispEdges" }}>
      {[...edges].map((e) => {
        const [a, b] = e.split("|").map((k) => byKey.get(k!)!);
        const pa = pos(a!), pb = pos(b!);
        const dim = fog && (!a!.explored || !b!.explored);
        return <line key={e} x1={pa.x + BW / 2} y1={pa.y + BH / 2} x2={pb.x + BW / 2} y2={pb.y + BH / 2} className={dim ? "stroke-muted-foreground/40" : "stroke-foreground"} strokeWidth={4} strokeDasharray={dim ? "6 6" : undefined} />;
      })}
      {rooms.map((r) => {
        const p = pos(r);
        const isCur = r.key === current;
        const hidden = fog && !r.explored;
        const can = selectable.includes(r.key) && !!onSelect;
        const Icon = roomIcon(r.key);
        return (
          <g key={r.key} data-room={r.key} onClick={can ? () => onSelect?.(r.key) : undefined} style={{ cursor: can ? "pointer" : "default" }}
            role={can ? "button" : undefined} tabIndex={can ? 0 : undefined} aria-label={can ? (hidden ? "Aller vers une salle inexplorée" : `Aller vers ${r.name}`) : undefined}
            onKeyDown={can ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect!(r.key); } } : undefined}>
            <rect x={p.x + 4} y={p.y + 4} width={BW} height={BH} className="fill-foreground" />
            <rect x={p.x} y={p.y} width={BW} height={BH} strokeWidth={3}
              className={`${isCur ? "fill-primary" : hidden ? "fill-muted" : can ? "fill-secondary" : "fill-card"} stroke-foreground`} />
            {!hidden && <Icon x={p.x + 3} y={p.y + 3} width={12} height={12} className="stroke-foreground" />}
            <text x={p.x + BW / 2} y={p.y + BH / 2 + 4} textAnchor="middle" fontSize={10}
              className={`font-pixel ${isCur ? "fill-primary-foreground" : hidden ? "fill-muted-foreground" : "fill-foreground"}`}>
              {(hidden ? "???" : r.name).slice(0, 16)}
            </text>
            {isCur && (playersHere ?? 0) > 0 && (
              <g>
                <rect x={p.x + BW - 22} y={p.y - 10} width={24} height={16} className="fill-secondary stroke-foreground" strokeWidth={2} />
                <text x={p.x + BW - 10} y={p.y + 2} textAnchor="middle" fontSize={10} className="fill-foreground font-pixel">♟{playersHere}</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

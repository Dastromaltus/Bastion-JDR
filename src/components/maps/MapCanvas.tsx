import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import mapSprites from "@/assets/map-textures-complete.png.asset.json";
import zombieSheet from "@/assets/zombie-sheet.png.asset.json";
import slimeSheet from "@/assets/slime-sheet.png.asset.json";
import yetiSheet from "@/assets/yeti-sheet.png.asset.json";
import wolfSheet from "@/assets/wolf-sheet.png.asset.json";
import orcSheet from "@/assets/orc-sheet.png.asset.json";
import goblinSheet from "@/assets/goblin-sheet.png.asset.json";
import cyclopsSheet from "@/assets/cyclops-sheet.png.asset.json";
import type { MonsterSprite } from "@/lib/world-actors";

const monsterImgs: Partial<Record<MonsterSprite, HTMLImageElement>> = {};
import { brushCells, GRID, SPRITES, tileFrame } from "@/lib/map-grid";

let sheet: HTMLImageElement | null = null;
function useSheet() {
  const [img, setImg] = useState<HTMLImageElement | null>(sheet?.complete ? sheet : null);
  useEffect(() => {
    if (img) return;
    if (!sheet) { sheet = new Image(); sheet.src = mapSprites.url; }
    const s = sheet;
    if (s.complete) setImg(s); else s.addEventListener("load", () => setImg(s), { once: true });
  }, [img]);
  return img;
}

/** Pixel-perfect 160×160 map drawing (16 px per cell), scaled by CSS. */
export type MapMarker = { x: number; y: number; glyph: string; selected?: boolean; sprite?: MonsterSprite | undefined };
export function MapCanvas({ tiles, spawn, passage, className, onCell, label, markers, brushSize }: {
  tiles: number[]; spawn?: { x: number; y: number }; className?: string; label: string; markers?: MapMarker[];
  onCell?: (x: number, y: number, kind: "down" | "move") => void; brushSize?: number | undefined; passage?: { x: number; y: number } | null | undefined;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const img = useSheet();
  const drawing = useRef(false);
  const [zoom, setZoom] = useState(1);
  const [ready, setReady] = useState(0);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const needed = [...new Set((markers ?? []).map((m) => m.sprite).filter(Boolean))] as MonsterSprite[];
  useEffect(() => {
    for (const kind of needed) {
      if (monsterImgs[kind]) continue;
      const image = new Image();
      image.src = kind === "zombie" ? zombieSheet.url : kind === "yeti" ? yetiSheet.url : kind === "wolf" ? wolfSheet.url : kind === "orc" ? orcSheet.url : kind === "goblin" ? goblinSheet.url : kind === "cyclops" ? cyclopsSheet.url : slimeSheet.url;
      monsterImgs[kind] = image;
      if (!image.complete) image.addEventListener("load", () => setReady((n) => n + 1), { once: true });
    }
  }, [needed.join(",")]);
  useEffect(() => {
    const c = ref.current?.getContext("2d");
    if (!c) return;
    c.imageSmoothingEnabled = false;
    c.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--world-label-bg").trim() || "#111";
    c.fillRect(0, 0, GRID * 16, GRID * 16);
    if (img) tiles.forEach((t, i) => { if (t > 0) c.drawImage(img, tileFrame(t) * 16, 0, 16, 16, (i % GRID) * 16, Math.floor(i / GRID) * 16, 16, 16); });
    if (spawn) {
      c.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--world-label").trim() || "#fff";
      c.lineWidth = 3; c.strokeRect(spawn.x * 16 + 2, spawn.y * 16 + 2, 12, 12);
    }
    const css = getComputedStyle(document.documentElement);
    if (passage) {
      c.fillStyle = css.getPropertyValue("--world-label").trim();
      c.fillRect(passage.x * 16 + 2, passage.y * 16 + 2, 12, 12);
      c.fillStyle = css.getPropertyValue("--world-label-bg").trim();
      c.font = "bold 14px monospace"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText("↑", passage.x * 16 + 8, passage.y * 16 + 8);
    }
    for (const m of markers ?? []) {
      const mImg = m.sprite ? monsterImgs[m.sprite] : undefined;
      const mReady = mImg?.complete && mImg.naturalWidth > 0;
      c.fillStyle = m.selected ? css.getPropertyValue("--world-label").trim() || "#fff" : "rgba(0,0,0,0.55)";
      if (!m.sprite || m.selected || !mReady) c.fillRect(m.x * 16, m.y * 16, 16, 16);
      if (m.sprite && mReady && mImg) { c.drawImage(mImg, 0, 0, 32, 32, m.x * 16 - 8, m.y * 16 - 10, 32, 32); continue; }
      c.fillStyle = m.selected ? css.getPropertyValue("--world-label-bg").trim() || "#111" : "#fff";
      c.font = "12px monospace"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(m.glyph, m.x * 16 + 8, m.y * 16 + 9);
    }
    // Brush footprint: the exact cells the next click will paint.
    if (brushSize && hover) {
      const cells = brushCells(hover.x, hover.y, brushSize);
      const x0 = Math.min(...cells.map((q) => q.x)) * 16, y0 = Math.min(...cells.map((q) => q.y)) * 16;
      const x1 = (Math.max(...cells.map((q) => q.x)) + 1) * 16, y1 = (Math.max(...cells.map((q) => q.y)) + 1) * 16;
      c.strokeStyle = css.getPropertyValue("--world-label").trim() || "#fff";
      c.lineWidth = 2; c.strokeRect(x0 + 1, y0 + 1, x1 - x0 - 2, y1 - y0 - 2);
    }
  }, [tiles, spawn, passage, img, JSON.stringify(markers ?? []), ready, brushSize, hover?.x, hover?.y]);
  function cell(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.floor(((e.clientX - r.left) / r.width) * GRID), Math.floor(((e.clientY - r.top) / r.height) * GRID)] as const;
  }
  return <div>
    {onCell && <div className="flex items-center justify-end gap-2 border-b border-border bg-background p-1">
      <Button variant="ghost" size="icon" aria-label="Réduire la carte" disabled={zoom === 1} onClick={() => setZoom((z) => Math.max(1, z - 1))}><Minus /></Button>
      <span className="w-12 text-center text-xs">{zoom}×</span>
      <Button variant="ghost" size="icon" aria-label="Agrandir la carte" disabled={zoom === 8} onClick={() => setZoom((z) => Math.min(8, z + 1))}><Plus /></Button>
    </div>}
    <div className="aspect-square overflow-auto">
    <canvas ref={ref} width={GRID * 16} height={GRID * 16} role="img" aria-label={label}
    style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
    className={`block aspect-square touch-none [image-rendering:pixelated] ${className ?? ""}`}
    onPointerDown={onCell ? (e) => { drawing.current = true; e.currentTarget.setPointerCapture(e.pointerId); const [x, y] = cell(e); if (x >= 0 && y >= 0 && x < GRID && y < GRID) setHover({ x, y }); onCell(x, y, "down"); } : undefined}
    onPointerMove={onCell ? (e) => { const [x, y] = cell(e); if (x < 0 || y < 0 || x >= GRID || y >= GRID) { setHover(null); return; } setHover((h) => (h && h.x === x && h.y === y ? h : { x, y })); if (drawing.current) onCell(x, y, "move"); } : undefined}
    onPointerUp={() => { drawing.current = false; }} onPointerCancel={() => { drawing.current = false; }}
    onPointerLeave={() => { drawing.current = false; setHover(null); }} />
    </div>
  </div>;
}

export function SpriteSwatch({ code, className }: { code: number; className?: string }) {
  return <span aria-hidden="true" className={`inline-block size-8 shrink-0 border-2 border-foreground [image-rendering:pixelated] ${className ?? ""}`}
    style={code > 0 ? { backgroundImage: `url(${mapSprites.url})`, backgroundSize: `${SPRITES.length * 32}px 32px`, backgroundPosition: `-${tileFrame(code) * 32}px 0` } : undefined} />;
}

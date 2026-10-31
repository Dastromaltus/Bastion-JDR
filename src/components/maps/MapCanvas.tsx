import { useEffect, useRef, useState } from "react";
import mapSprites from "@/assets/map-sprites.png.asset.json";
import zombieSheet from "@/assets/zombie-sheet.png.asset.json";
import slimeSheet from "@/assets/slime-sheet.png.asset.json";

const monsterImgs: Partial<Record<"zombie" | "slime", HTMLImageElement>> = {};
import { GRID, tileTexture } from "@/lib/map-grid";

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

/** Pixel-perfect 40×40 map drawing (16 px per cell), scaled by CSS. */
export type MapMarker = { x: number; y: number; glyph: string; selected?: boolean; sprite?: "zombie" | "slime" };
export function MapCanvas({ tiles, spawn, className, onCell, label, markers }: {
  tiles: number[]; spawn?: { x: number; y: number }; className?: string; label: string; markers?: MapMarker[];
  onCell?: (x: number, y: number, kind: "down" | "move") => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const img = useSheet();
  const drawing = useRef(false);
  const [ready, setReady] = useState(0);
  const needed = [...new Set((markers ?? []).map((m) => m.sprite).filter(Boolean))] as ("zombie" | "slime")[];
  useEffect(() => {
    for (const kind of needed) {
      if (monsterImgs[kind]) continue;
      const image = new Image();
      image.src = kind === "zombie" ? zombieSheet.url : slimeSheet.url;
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
    if (img) tiles.forEach((t, i) => { if (t > 0) c.drawImage(img, (tileTexture(t) - 1) * 16, 0, 16, 16, (i % GRID) * 16, Math.floor(i / GRID) * 16, 16, 16); });
    if (spawn) {
      c.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--world-label").trim() || "#fff";
      c.lineWidth = 3; c.strokeRect(spawn.x * 16 + 2, spawn.y * 16 + 2, 12, 12);
    }
    const css = getComputedStyle(document.documentElement);
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
  }, [tiles, spawn, img, JSON.stringify(markers ?? []), ready]);
  function cell(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.floor(((e.clientX - r.left) / r.width) * GRID), Math.floor(((e.clientY - r.top) / r.height) * GRID)] as const;
  }
  return <canvas ref={ref} width={GRID * 16} height={GRID * 16} role="img" aria-label={label}
    className={`block aspect-square w-full touch-none [image-rendering:pixelated] ${className ?? ""}`}
    onPointerDown={onCell ? (e) => { drawing.current = true; e.currentTarget.setPointerCapture(e.pointerId); const [x, y] = cell(e); onCell(x, y, "down"); } : undefined}
    onPointerMove={onCell ? (e) => { if (!drawing.current) return; const [x, y] = cell(e); if (x >= 0 && y >= 0 && x < GRID && y < GRID) onCell(x, y, "move"); } : undefined}
    onPointerUp={() => { drawing.current = false; }} onPointerCancel={() => { drawing.current = false; }} />;
}

export function SpriteSwatch({ code, className }: { code: number; className?: string }) {
  return <span aria-hidden="true" className={`inline-block size-8 shrink-0 border-2 border-foreground [image-rendering:pixelated] ${className ?? ""}`}
    style={code > 0 ? { backgroundImage: `url(${mapSprites.url})`, backgroundSize: "320px 32px", backgroundPosition: `-${(code - 1) * 32}px 0` } : undefined} />;
}

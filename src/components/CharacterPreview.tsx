import type { CharacterLook } from "@/lib/character";

/** Pixel-art avatar (16×16 grid) built from the chosen race, colours and accessory. */
export function CharacterPreview({ look, size = 160 }: { look: CharacterLook; size?: number }) {
  const { race, skin, outfit, accessory } = look;
  const px = (x: number, y: number, w: number, h: number, fill: string, key?: string) => <rect key={key ?? `${x}-${y}-${fill}`} x={x} y={y} width={w} height={h} fill={fill} />;
  const ink = "#1b1b2f";
  const parts: React.ReactNode[] = [];
  if (accessory === "cape") parts.push(px(3, 7, 10, 8, "#c0304f", "cape"));
  // body & legs
  parts.push(px(5, 8, 6, 5, outfit, "body"), px(5, 13, 2, 2, ink, "l1"), px(9, 13, 2, 2, ink, "l2"));
  // arms
  parts.push(px(3, 8, 2, 4, skin, "a1"), px(11, 8, 2, 4, skin, "a2"));
  if (race === "Crustacé") parts.push(px(1, 6, 3, 3, skin, "p1"), px(12, 6, 3, 3, skin, "p2"));
  if (race === "Oiseau") parts.push(px(1, 8, 2, 5, outfit, "w1"), px(13, 8, 2, 5, outfit, "w2"));
  // head
  parts.push(px(4, 2, 8, 6, skin, "head"));
  if (race === "Insecte") parts.push(px(5, 0, 1, 2, ink, "an1"), px(10, 0, 1, 2, ink, "an2"), px(5, 4, 2, 2, ink, "e1"), px(9, 4, 2, 2, ink, "e2"));
  else parts.push(px(6, 4, 1, 1, ink, "e1"), px(9, 4, 1, 1, ink, "e2"));
  if (race === "Oiseau") parts.push(px(7, 5, 2, 2, "#ff9f1c", "beak"));
  if (race === "Reptile") parts.push(px(4, 2, 8, 1, "#2f7a3a", "crest"), px(7, 6, 2, 1, ink, "mouth"));
  if (race === "Humain") parts.push(px(4, 2, 8, 1, "#5a3a22", "hair"), px(7, 6, 2, 1, ink, "mouth"));
  if (accessory === "casque") parts.push(px(3, 1, 10, 2, "#9aa3b5", "helm"), px(3, 3, 1, 2, "#9aa3b5", "helm2"), px(12, 3, 1, 2, "#9aa3b5", "helm3"));
  if (accessory === "bandeau") parts.push(px(4, 3, 8, 1, "#e63946", "band"), px(12, 3, 2, 1, "#e63946", "band2"));
  if (accessory === "sac") parts.push(px(11, 9, 3, 4, "#8a5a2b", "bag"), px(11, 9, 3, 1, ink, "bag2"));
  return (
    <svg role="img" aria-label={`Aperçu : ${look.name || "aventurier"}, ${race}`} viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" style={{ imageRendering: "pixelated" }}>
      {parts}
    </svg>
  );
}

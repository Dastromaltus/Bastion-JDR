import { useEffect, useState } from "react";
import type { CharacterLook } from "@/lib/character";
import { motionDisabled, MOTION_EVENT } from "@/lib/motion";
import humanIdle from "@/assets/human-idle.gif.asset.json";
import humanStill from "@/assets/human-still.png.asset.json";
import dwarfIdle from "@/assets/dwarf-idle.gif.asset.json";
import dwarfStill from "@/assets/dwarf-still.png.asset.json";

export function CharacterPreview({ look, size = 160 }: { look: CharacterLook; size?: number }) {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const update = () => setReduced(motionDisabled());
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    update(); window.addEventListener(MOTION_EVENT, update); media.addEventListener("change", update);
    return () => { window.removeEventListener(MOTION_EVENT, update); media.removeEventListener("change", update); };
  }, []);
  const idle = look.race === "Nain" ? dwarfIdle : humanIdle;
  const still = look.race === "Nain" ? dwarfStill : humanStill;
  return <img src={reduced ? still.url : idle.url} alt={`Aperçu : ${look.name || "aventurier"}, ${look.race}`} width={size} height={size} className="max-w-full object-contain [image-rendering:pixelated]" />;
}

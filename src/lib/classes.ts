import { hpFor, type RaceName } from "@/lib/races";

/** Class rules; combat effects mirror salon_combat_action (server is the authority). */
export const CLASSES = {
  guerrier: { label: "Guerrier", icon: "⚔", hpBonus: 6, damageBonus: 1, ability: "Frappe lourde", abilityText: "+1 dé à chaque attaque." },
  mage: { label: "Mage", icon: "✦", hpBonus: -2, damageBonus: 2, ability: "Trait arcanique", abilityText: "Ignore les boucliers ennemis." },
  voleur: { label: "Voleur", icon: "🗡", hpBonus: 2, damageBonus: 1, ability: "Coup sournois", abilityText: "+2 dégâts avec 2 réussites ou plus." },
} as const;

export type ClassName = keyof typeof CLASSES;
export const CLASS_NAMES = Object.keys(CLASSES) as [ClassName, ...ClassName[]];

export function classOf(value: string | null | undefined): ClassName {
  return value && value in CLASSES ? (value as ClassName) : "guerrier";
}

export function classHp(race: RaceName, cls: ClassName) {
  return hpFor(race) + CLASSES[cls].hpBonus;
}

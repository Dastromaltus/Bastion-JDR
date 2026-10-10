import { DoorOpen, Factory, BookOpen, Heart, Archive, Leaf, FlaskConical, Cog, Bed, Shield, Box, ArrowUp } from "lucide-react";
export function roomIcon(key: string) {
  if (/sas|breche|hall|antichambre/.test(key)) return DoorOpen;
  if (/convoyeur|fonderie|atelier|assemblage/.test(key)) return Factory;
  if (/archive/.test(key)) return Archive;
  if (/serre/.test(key)) return Leaf;
  if (/laboratoire/.test(key)) return FlaskConical;
  if (/coeur|noyau/.test(key)) return Heart;
  if (/repos/.test(key)) return Bed;
  if (/controle|commande/.test(key)) return Cog;
  if (/garde/.test(key)) return Shield;
  if (/ascenseur/.test(key)) return ArrowUp;
  if (/depot|reserve|armurerie/.test(key)) return Box;
  return BookOpen;
}
export const mapIdentity: Record<string, string> = {
  "le-sas": "Décontamination en cours. L’accès au Bastion reste strictement contrôlé.",
  "salle-des-machines": "Les convoyeurs s’éveillent. Une intelligence mécanique surveille les ateliers.",
  "le-reliquaire": "Les archives dissimulent des reliques ; la serre et le laboratoire gardent leurs secrets.",
  "coeur-du-bastion": "Des salles massives et dépouillées conduisent au cœur vivant de la forteresse.",
};
# Bastion — Narrateur, identité des maps et campagnes

## Cadre conservé
- Aucun changement de palette, police, bordure, ombre ou mise en page générale.
- Exploration : ordre actuel joueur 1, puis 2, puis 3. **Combat uniquement : initiative par Vitesse**, aventuriers et mobs mêlés, sans personnage du narrateur.
- Les campagnes publiées restent privées : « Publier » signifie les rendre prêtes à charger, pas les rendre publiques.

## Étape 1 — Narrateur sans personnage et contrôle des mobs
- Séparer son rôle de participant de toute fiche d’aventurier : aucun avatar sur la carte, aucun PV, inventaire personnel ou rang d’initiative de joueur ; conserver son nom dans une liste distincte des participants.
- Compter uniquement les aventuriers pour les places et le budget de menace de 3 points chacun.
- Archiver les fiches existantes lors du passage au rôle de narrateur, sans supprimer les objets ; les masquer aux joueurs et restaurer la fiche lorsque son propriétaire redevient aventurier. Un nouveau narrateur n’a pas de fiche à créer.
- Ajouter « Contrôler » dans la liste des mobs et la sélection sur la carte : un mob actif à la fois, accent visuel existant, stats, capacités, déplacement, attaque et passage de tour. Empêcher le changement pendant une action en cours.
- Introduire un ordre de combat validé côté serveur ; harmoniser la comparaison de Vitesse entre les fiches existantes et les stats 1–5 des mobs sans modifier silencieusement les fiches.
- Utiliser les jets serveur d6 avec réussites sur 5 et 6 pour le contrôle des mobs. Définir les capacités utilisables par leurs effets autorisés, pas par l’exécution libre de leur texte.
- Garder le contrôle d’un mob caché secret ; révéler et journaliser automatiquement sa première attaque. Les autres mobs conservent les commandes manuelles.

**Vérifications :** créateur sans personnage, transfert et restauration de fiche, places/budget, ordre de combat, actions simultanées, refus d’action d’un joueur au nom d’un mob, absence de données cachées dans ses réponses et abonnements.

## Étape 2 — Identité des maps, style inchangé
- Conserver les quatre Opérations et leur structure jouable ; enrichir leurs noms de salles et descriptions selon leurs thèmes : accès et décontamination, machines et IA, reliques et secrets, cœur et boss.
- Ajouter des icônes de salles issues de la bibliothèque existante et présenter leurs connexions et portes avec les composants actuels.
- Proposer par défaut : Forteresse vide, Couloirs industriels, Laboratoire abandonné et Boss, respectivement ; laisser le narrateur choisir une autre piste existante.
- Ne pas générer de nouvelles illustrations ni changer les fonds globaux ; réserver un emplacement neutre seulement si une illustration devient nécessaire.

**Vérifications :** quatre identités lisibles, pistes existantes, salles et sorties cohérentes, apparence au repos inchangée.

## Étape 3 — Concevoir une campagne
- Ajouter un accès depuis les outils du narrateur et une page privée « Concevoir une campagne », autorisée pour les utilisateurs narrateurs d’un salon.
- Informations : nom, résumé, difficulté et nombre d’aventuriers recommandé.
- Enchaîner plusieurs maps, réordonner les étapes et choisir un objectif par map.
- Afficher un aperçu interactif des salles, portes et connexions ; sélectionner une salle par toucher/clic, ou utiliser les listes déroulantes. Ajouter le glisser-déposer en complément, jamais comme seul moyen.
- Placer mobs et trésors ; ouvrir leur fiche pour régler stats 1–5, salle, déclencheur, visibilité et position, ou retirer l’élément. Afficher un récapitulatif par salle, événements compris.
- Afficher budget de menace et contrôles de cohérence : salles inaccessibles, objectif non atteignable, sortie absente. Le dépassement peut être enregistré en brouillon, mais bloque publication et chargement.
- Prévisualiser comme un joueur, sans éléments cachés ; tester dans une copie solo isolée, sans statistiques, sans altérer le brouillon.
- Sauvegarde automatique avec indicateur et gestion des erreurs, publication privée, duplication, modèles personnels, chargement dans un salon en attente et export PDF A4.
- Copier la campagne et ses maps dans le salon : les ajustements du narrateur et la progression ne modifient jamais la campagne source. La fin d’une étape conduit à la suivante avec son objectif et son ambiance.

**Vérifications :** isolation entre créateurs, autosauvegarde et reprise, placements tactiles, aperçu joueur, validations, copie indépendante, enchaînement des maps, test solo et PDF imprimable.

## Détails techniques
- Ajouter les tables demandées `campaigns`, `campaign_stages` et `campaign_placements`, avec droits explicites et RLS propriétaire ; les modèles personnels restent dans `campaigns`.
- Ajouter les données d’archivage, de contrôle et d’initiative sans supprimer ni changer le type des colonnes existantes. Protéger les archives séparément des lignes de participants lisibles par les membres.
- Stocker les instantanés de campagne et de salles chargés dans le salon pour ne pas dépendre d’une source modifiable ; réutiliser les copies existantes d’ennemis, trésors et événements.
- Utiliser des fonctions serveur TanStack authentifiées pour les intentions et une transaction verrouillée pour les changements d’initiative, les jets/actions et les copies. Aucune nouvelle Edge Function.
- Préserver les filtres RLS sur tout contenu caché, y compris les nouveaux états de contrôle et d’initiative : ne jamais envoyer aux joueurs une liste contenant les mobs cachés.
- Réutiliser Phaser chargé dynamiquement, les composants actuels, les pistes existantes et jsPDF chargé dynamiquement ; ajouter les titres et descriptions propres aux nouvelles pages privées et les exclure du sitemap.
- Exécuter les tests ciblés et les vérifications dans le navigateur à chaque étape ; les contrôles tactiles seront vérifiés en simulation, sans prétendre tester un téléphone physique.
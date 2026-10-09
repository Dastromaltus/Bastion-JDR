# Bastion — Salons privés, interface de jeu, rapport PDF

## Points à savoir avant de commencer
- L'application n'a pas encore de comptes. On ajoute la connexion (e-mail + mot de passe, et Google).
- Le créateur de personnage, le lanceur de dés autonome et le chat n'existent pas encore. On ne touche pas à ce qui existe (exploration 2D, combat, journal, sauvegardes, export Markdown). Le bouton « Chat » de la barre ouvrira un chat simple propre au salon.
- Les mots de passe de salon seront hachés et vérifiés sur le serveur via les fonctions serveur de l'application (équivalent sécurisé d'une Edge Function, qui n'est pas disponible avec cette architecture).

## Étape 1 — Salons et narrateur
- Pages : `/auth` (connexion), `/salons` (Mes salons : créés + rejoints, rôle, statut), `/salons/nouveau`, `/rejoindre/$code` (lien d'invitation), `/salon/$code` (salle d'attente puis partie).
- Création : nom, joueurs max 3–5, mot de passe optionnel, scénario. Code unique de 6 caractères A–Z/0–9. Créateur = narrateur.
- Rejoindre : code (+ mot de passe). Refus clair si complet, verrouillé ou lancé.
- Narrateur : expulser, verrouiller, lancer, terminer, transférer son rôle.
- Tables : `games`, `game_players` (role narrateur/aventurier), `game_secrets` (hash du mot de passe, invisible pour tous), `narrator_notes`, `game_hidden_enemies`, `game_events`, `game_messages`.
- Sécurité : RLS partout ; lecture limitée aux membres du salon (fonction `is_game_member`) ; notes et ennemis cachés limités au narrateur (`is_game_narrator`) ; aucune écriture directe sur `game_players.role` — changements de rôle, expulsions, adhésions uniquement via fonctions serveur qui vérifient l'appelant.

## Étape 2 — Interface de jeu
- Barre fixe en bas (boutons ≥ 44 px) : Inventaire, Fiche, Journal, Chat, Paramètres, adaptée gaucher/droitier.
- Inventaire : onglets Armes / Consommables / Clés et quêtes, grille, appui = menu (Utiliser, Équiper, Donner, Jeter), appui long = détails, confirmation pour jeter/donner. Table `game_inventory` : chacun voit le sien, le narrateur gère tout.
- Paramètres : audio (général, musique, effets), affichage (taille du texte, contraste, daltonien, animations réduites), contrôles (gaucher/droitier, vibrations), partie (code, quitter, signaler). Table `user_settings` par utilisateur ; table `player_reports`.
- Joueurs : appui sur un joueur → Donner un objet, Ping, Message ; roue de réactions (Attention, Besoin d'aide, OK, Attendre), diffusée en temps réel au salon.
- Chaque action : état de chargement, message d'erreur lisible, tactile + souris.

## Étape 3 — Rapport PDF
- Bouton « Télécharger le rapport PDF » sur l'écran de fin et dans Mes salons (parties terminées).
- Données fournies par une fonction serveur réservée aux membres ; notes privées incluses seulement pour le narrateur.
- jsPDF côté client, A4, marges 15 mm, fond blanc, accents rouge/noir : page de garde, participants, journal chronologique (jets : stat, dés, résultat, difficulté), résumé, en-tête/pied « Page X / Y », pas de ligne coupée, limite à 500 entrées avec mention.
- Fichier : `bastion-rapport-[nom-du-salon]-[date].pdf`.

## Contrôles finaux
- Test avec 1 narrateur et 3 joueurs répartis sur deux salons : vérifier l'isolation des données, l'impossibilité de lire les notes ou de changer son rôle.
- PDF vérifié sur un journal court et un journal de plus de 100 entrées.
- Liste finale des tables et politiques RLS.

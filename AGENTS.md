<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the public experience as a single-page interactive rulebook because the source material describes one game concept, not separate products.
- Derive the sitemap from required route staticData decisions and exclude authenticated subtrees, because search discovery must not expose private salon URLs or require a separate manually maintained page list.
- Keep 2D exploration maps in Tiled-compatible JSON and render them through a dynamically imported Phaser 3 scene because SSR must never evaluate browser-only game code.
- Validate movement, collisions, and random combat rolls in TanStack server functions; clients send intents and render the returned state.
- Store the narrator role per salon in game_players.role and change memberships/roles only through authenticated server functions, because players must never be able to edit roles with direct database requests.
- Salon passwords are verified against a PBKDF2 hash in server functions and also stored as an AES-GCM copy (key in a server secret) that only the salon creator can decrypt via getRoomPassword, because the creator must be able to read it while the browser never compares passwords.
- Generate game reports as PDFs in the browser with a dynamically imported jsPDF, fed by a members-only server function, so narrator-only notes are filtered on the server.
- Hidden narrator content (game_enemies, game_treasures, secret game_events) is filtered by RLS SELECT policies and written only by narrator-checked server functions in src/lib/narrator.functions.ts, because players must never receive hidden rows over the network or realtime.
- Salon levels are game_levels rows (one per parcours zone, ordered) edited by the narrator before launch via src/lib/levels.functions.ts and narrator-readable only; enterLevel runs server-side on game start and zone entry to switch music and post the intro text, so players never read upcoming level text.
- Salon ambience is one game_ambience row per salon written through the caller's RLS client; each browser plays it locally via a Web Audio engine whose tracks fall back to procedural placeholders when no file URL is set in src/lib/ambience-tracks.ts.
- Operations (prebuilt dungeons) live in dungeon_* template tables readable by signed-in users; loading copies them into the salon's game_enemies/game_treasures/game_dungeon_events and one game_dungeons row, all written only by src/lib/operations.functions.ts, because per-salon copies must stay narrator-only until revealed.
- Shared Operation template SELECT policies explicitly require a non-null auth.uid(); exploration SELECT policies expose only the porte-rouge homepage demo and its related rows, because new sessions must not inherit unrestricted public reads.
- Dungeon rooms carry grid_x/grid_y, features and the template map_key so each Operation can later become a Tiled tile map without a schema change.
- Salon tile movement uses a shared Tiled map and member-checked server intents with compare-and-set position writes; a dynamically imported Phaser scene animates only server-confirmed positions, preserving room transitions and hidden-content filtering.
- Build visible salon participants through the browser-safe world-actors helper; show the narrator as a labeled observer and follow the active adventurer's zone in the narrator view, without granting movement or exposing hidden content.
- Solo games are games.solo=true with one adventurer and no narrator; soloAct runs the automatic enemy rules server-side.
- Multiplayer salon turns use games turn state and a row-locked, member-checked end_salon_turn RPC; player gameplay handlers enforce the same shared order, while full-round Operation effects run only after the final participant ends their turn, preserving automatic solo play.
- Keep motion as additive CSS utilities plus browser-only MotionEffects and MotionBits; use explicit DOM entrance markers and a shared IntersectionObserver for page content, and propagate the saved motion preference to the document so every page, portal and Phaser obeys the same accessibility setting without changing game rules.

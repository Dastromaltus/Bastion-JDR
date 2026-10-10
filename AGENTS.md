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
- Keep 2D exploration maps in Tiled-compatible JSON and render them through a dynamically imported Phaser 3 scene because SSR must never evaluate browser-only game code.
- Validate movement, collisions, and random combat rolls in TanStack server functions; clients send intents and render the returned state.
- Store the narrator role per salon in game_players.role and change memberships/roles only through authenticated server functions, because players must never be able to edit roles with direct database requests.
- Hash salon passwords (PBKDF2) and verify them inside server functions, because passwords must never be compared in the browser.
- Generate game reports as PDFs in the browser with a dynamically imported jsPDF, fed by a members-only server function, so narrator-only notes are filtered on the server.
- Hidden narrator content (game_enemies, game_treasures, secret game_events) is filtered by RLS SELECT policies and written only by narrator-checked server functions in src/lib/narrator.functions.ts, because players must never receive hidden rows over the network or realtime.
- Salon ambience is one game_ambience row per salon written through the caller's RLS client; each browser plays it locally via a Web Audio engine whose tracks fall back to procedural placeholders when no file URL is set in src/lib/ambience-tracks.ts.
- Operations (prebuilt dungeons) live in dungeon_* template tables readable by signed-in users; loading copies them into the salon's game_enemies/game_treasures/game_dungeon_events and one game_dungeons row, all written only by src/lib/operations.functions.ts, because per-salon copies must stay narrator-only until revealed.
- Dungeon rooms carry grid_x/grid_y, features and the template map_key so each Operation can later become a Tiled tile map without a schema change.
- Salon tile movement uses a shared Tiled map and member-checked server intents with compare-and-set position writes; a dynamically imported Phaser scene animates only server-confirmed positions, preserving room transitions and hidden-content filtering.
- Solo games are games.solo=true with one adventurer and no narrator; soloAct runs the automatic enemy rules server-side.
- Multiplayer salon turns use games turn state and a row-locked, member-checked end_salon_turn RPC; player gameplay handlers enforce the same shared order, while full-round Operation effects run only after the final participant ends their turn, preserving automatic solo play.

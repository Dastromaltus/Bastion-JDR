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

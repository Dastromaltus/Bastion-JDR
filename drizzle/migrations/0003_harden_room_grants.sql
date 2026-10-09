REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.games, public.game_players, public.game_events, public.game_secrets FROM anon, authenticated;
REVOKE ALL ON public.game_secrets FROM anon, authenticated;
REVOKE ALL ON public.games, public.game_players, public.game_events, public.narrator_notes, public.game_hidden_enemies, public.game_messages, public.game_inventory, public.user_settings, public.player_reports FROM anon;
REVOKE UPDATE, TRUNCATE ON public.game_inventory, public.game_messages, public.player_reports FROM authenticated;
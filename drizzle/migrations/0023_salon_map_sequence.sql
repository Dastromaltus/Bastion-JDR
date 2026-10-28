CREATE TABLE public.game_map_sequence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  position integer NOT NULL,
  name text NOT NULL,
  source text NOT NULL,
  tiles smallint[] NOT NULL,
  spawn_x smallint NOT NULL,
  spawn_y smallint NOT NULL,
  UNIQUE (game_id, position)
);
CREATE TABLE public.game_map_progress (
  game_id uuid PRIMARY KEY REFERENCES public.games(id) ON DELETE CASCADE,
  current_index integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.game_map_sequence TO authenticated;
GRANT ALL ON public.game_map_sequence TO service_role;
GRANT SELECT ON public.game_map_progress TO authenticated;
GRANT ALL ON public.game_map_progress TO service_role;
ALTER TABLE public.game_map_sequence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_map_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Narrator reads map sequence" ON public.game_map_sequence FOR SELECT TO authenticated USING (public.is_game_narrator(game_id));
CREATE POLICY "Members read map progress" ON public.game_map_progress FOR SELECT TO authenticated USING (public.is_game_member(game_id));
CREATE TABLE public.game_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  zone text NOT NULL,
  position smallint NOT NULL DEFAULT 0,
  track text,
  intro_text text NOT NULL DEFAULT '',
  entered boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, zone)
);
GRANT SELECT ON public.game_levels TO authenticated;
GRANT ALL ON public.game_levels TO service_role;
ALTER TABLE public.game_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Narrator reads levels" ON public.game_levels FOR SELECT TO authenticated USING (public.is_game_narrator(game_id));
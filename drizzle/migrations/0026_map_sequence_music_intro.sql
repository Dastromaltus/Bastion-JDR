ALTER TABLE public.game_map_sequence ADD COLUMN IF NOT EXISTS track text;
ALTER TABLE public.game_map_sequence ADD COLUMN IF NOT EXISTS intro_text text NOT NULL DEFAULT '';
ALTER TABLE public.game_map_sequence ADD COLUMN IF NOT EXISTS treasures jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.game_enemies ADD COLUMN IF NOT EXISTS map_source text;
ALTER TABLE public.game_treasures ADD COLUMN IF NOT EXISTS map_source text;
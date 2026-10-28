ALTER TABLE public.custom_maps ADD COLUMN enemies jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.game_map_sequence ADD COLUMN enemies jsonb NOT NULL DEFAULT '[]'::jsonb;
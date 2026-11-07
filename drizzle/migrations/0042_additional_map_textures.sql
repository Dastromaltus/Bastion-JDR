CREATE OR REPLACE FUNCTION public.world_tile_walkable(t smallint)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT t IN (3,4,5,6,10,21,22,23,24,25,26,27,28,29,30) $$;
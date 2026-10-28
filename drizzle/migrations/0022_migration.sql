CREATE TABLE public.custom_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL DEFAULT 'Nouvelle carte',
  tiles smallint[] NOT NULL,
  spawn_x smallint NOT NULL DEFAULT 20,
  spawn_y smallint NOT NULL DEFAULT 20,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT custom_maps_size CHECK (cardinality(tiles) = 1600)
);
GRANT SELECT, DELETE ON public.custom_maps TO authenticated;
GRANT ALL ON public.custom_maps TO service_role;
ALTER TABLE public.custom_maps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "custom maps owner read" ON public.custom_maps FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL AND owner_id = auth.uid());
CREATE POLICY "custom maps owner delete" ON public.custom_maps FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL AND owner_id = auth.uid());

CREATE TABLE public.game_world_maps (
  game_id uuid PRIMARY KEY REFERENCES public.games(id) ON DELETE CASCADE,
  name text NOT NULL,
  source text NOT NULL,
  tiles smallint[] NOT NULL,
  spawn_x smallint NOT NULL,
  spawn_y smallint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_world_maps_size CHECK (cardinality(tiles) = 1600)
);
GRANT SELECT ON public.game_world_maps TO authenticated;
GRANT ALL ON public.game_world_maps TO service_role;
ALTER TABLE public.game_world_maps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "salon map members read" ON public.game_world_maps FOR SELECT TO authenticated USING (public.is_game_member(game_id));

CREATE OR REPLACE FUNCTION public.world_tile_walkable(t smallint) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT t IN (3,4,5,6,10) $$;

CREATE OR REPLACE FUNCTION public.salon_mob_move_collision() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE m smallint[];
BEGIN
 IF NEW.tile_x<>OLD.tile_x OR NEW.tile_y<>OLD.tile_y THEN
  IF NEW.tile_x<0 OR NEW.tile_x>39 OR NEW.tile_y<0 OR NEW.tile_y>39 THEN RAISE EXCEPTION 'Cette case est bloquée.'; END IF;
  SELECT tiles INTO m FROM public.game_world_maps WHERE game_id=NEW.game_id;
  IF m IS NOT NULL AND NOT public.world_tile_walkable(m[NEW.tile_y*40+NEW.tile_x+1]) THEN RAISE EXCEPTION 'Cette case est bloquée.'; END IF;
 END IF; RETURN NEW; END $function$;

DO $$ DECLARE def text; BEGIN
  SELECT pg_get_functiondef('public.salon_combat_action(uuid,integer,text,uuid,uuid,integer,integer,text)'::regprocedure) INTO def;
  def := replace(def, 'p_x>24', 'p_x>39');
  def := replace(def, 'p_y>16', 'p_y>39');
  EXECUTE def;
END $$;
ALTER TABLE public.custom_maps DROP CONSTRAINT custom_maps_size;
ALTER TABLE public.custom_maps ADD CONSTRAINT custom_maps_size CHECK (cardinality(tiles) IN (1600,25600));
ALTER TABLE public.game_world_maps DROP CONSTRAINT game_world_maps_size;
ALTER TABLE public.game_world_maps ADD CONSTRAINT game_world_maps_size CHECK (cardinality(tiles) IN (1600,25600));
ALTER TABLE public.game_players DROP CONSTRAINT game_players_world_bounds;
ALTER TABLE public.game_players ADD CONSTRAINT game_players_world_bounds CHECK (world_x BETWEEN 0 AND 159 AND world_y BETWEEN 0 AND 159);
CREATE OR REPLACE FUNCTION public.salon_mob_move_collision() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE m smallint[]; w integer;
BEGIN
 IF NEW.tile_x IS DISTINCT FROM OLD.tile_x OR NEW.tile_y IS DISTINCT FROM OLD.tile_y THEN
  IF NEW.tile_x<0 OR NEW.tile_x>159 OR NEW.tile_y<0 OR NEW.tile_y>159 THEN RAISE EXCEPTION 'Cette case est bloquée.'; END IF;
  SELECT tiles INTO m FROM public.game_world_maps WHERE game_id=NEW.game_id;
  w:=CASE WHEN cardinality(m)=1600 THEN 40 ELSE 160 END;
  IF m IS NOT NULL AND (NEW.tile_x>=w OR NEW.tile_y>=w OR NOT coalesce(public.world_tile_walkable(m[NEW.tile_y*w+NEW.tile_x+1]),false)) THEN RAISE EXCEPTION 'Cette case est bloquée.'; END IF;
 END IF; RETURN NEW;
END $function$;
DO $$ DECLARE def text; BEGIN
 SELECT pg_get_functiondef('public.salon_combat_action(uuid,integer,text,uuid,uuid,integer,integer,text)'::regprocedure) INTO def;
 def:=replace(replace(def,'p_x>39','p_x>159'),'p_y>39','p_y>159');
 EXECUTE def;
END $$;
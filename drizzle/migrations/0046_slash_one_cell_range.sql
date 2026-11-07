DO $migration$
DECLARE definition text; marker text := 'IF p_action=''slash'' THEN damage:=2;';
BEGIN
 SELECT pg_get_functiondef('public.salon_combat_action(uuid,integer,text,uuid,uuid,integer,integer,text)'::regprocedure) INTO definition;
 IF position(marker in definition)=0 THEN RAISE EXCEPTION 'Expected Slash damage branch not found'; END IF;
 definition:=replace(definition,marker,$check$IF p_action='slash' THEN
  IF actor_p.world_zone IS DISTINCT FROM actor_p.current_zone THEN
   SELECT spawn_x,spawn_y INTO actor_p.world_x,actor_p.world_y FROM public.game_world_maps WHERE game_id=p_game_id;
  END IF;
  IF actor_p.world_x IS NULL OR actor_p.world_y IS NULL OR e.tile_x IS NULL OR e.tile_y IS NULL OR greatest(abs(actor_p.world_x-e.tile_x),abs(actor_p.world_y-e.tile_y))>1 THEN
   RAISE EXCEPTION 'Ennemi hors de portée de Slash (1 case).';
  END IF;
  damage:=2;$check$);
 IF position('Ennemi hors de portée de Slash (1 case).' in definition)=0 THEN RAISE EXCEPTION 'Slash range integration failed'; END IF;
 EXECUTE definition;
END $migration$;
DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.get_salon_combat(uuid)'::regprocedure) INTO definition;
 definition:=replace(definition, 'game_id=p_game_id AND status=''revele''', 'game_id=p_game_id AND public.adventurer_sees_cell(game_id,zone,tile_x,tile_y)');
 definition:=replace(definition, 'status=''revele''', 'public.adventurer_sees_cell(game_id,zone,tile_x,tile_y)');
 EXECUTE definition;
END $$;
CREATE OR REPLACE FUNCTION public.adventurer_sees_cell(p_game_id uuid, p_zone text, p_x integer, p_y integer)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p public.game_players%ROWTYPE; m public.game_world_maps%ROWTYPE; x integer; y integer;
BEGIN
 IF auth.uid() IS NULL OR p_x IS NULL OR p_y IS NULL THEN RETURN false; END IF;
 SELECT * INTO p FROM public.game_players WHERE game_id=p_game_id AND user_id=auth.uid() AND role='adventurer';
 IF NOT FOUND OR coalesce(p.current_zone,'entree')<>p_zone THEN RETURN false; END IF;
 SELECT * INTO m FROM public.game_world_maps WHERE game_id=p_game_id;
 x:=CASE WHEN p.world_zone=coalesce(p.current_zone,'entree') THEN p.world_x ELSE coalesce(m.spawn_x,p.world_x) END;
 y:=CASE WHEN p.world_zone=coalesce(p.current_zone,'entree') THEN p.world_y ELSE coalesce(m.spawn_y,p.world_y) END;
 -- Field of vision = the visible screen around the adventurer (25 x 17 tiles).
 RETURN abs(p_x-x)<=12 AND abs(p_y-y)<=8;
END $function$;
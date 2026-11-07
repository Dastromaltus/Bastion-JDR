CREATE OR REPLACE FUNCTION public.salon_move_player(p_game_id uuid, p_dx integer, p_dy integer)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p public.game_players%ROWTYPE; m public.game_world_maps%ROWTYPE; w integer; z text; x integer; y integer; nx integer; ny integer;
BEGIN
 IF auth.uid() IS NULL OR abs(p_dx)+abs(p_dy)<>1 THEN RAISE EXCEPTION 'Déplacement adjacent requis.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.games WHERE id=p_game_id AND status='playing') THEN RAISE EXCEPTION 'La partie n’est pas en cours.'; END IF;
 SELECT * INTO p FROM public.game_players WHERE game_id=p_game_id AND user_id=auth.uid() AND role='adventurer' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Seuls les aventuriers de ce salon peuvent se déplacer.'; END IF;
 IF p.hp<=0 THEN RAISE EXCEPTION 'Ton aventurier est hors de combat.'; END IF;
 SELECT * INTO m FROM public.game_world_maps WHERE game_id=p_game_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('nomap',true); END IF;
 w:=CASE WHEN cardinality(m.tiles)=1600 THEN 40 ELSE 160 END; z:=coalesce(p.current_zone,'entree');
 IF p.world_zone=z AND p.world_x BETWEEN 0 AND w-1 AND p.world_y BETWEEN 0 AND w-1 AND coalesce(public.world_tile_walkable(m.tiles[p.world_y*w+p.world_x+1]),false) THEN x:=p.world_x; y:=p.world_y; ELSE x:=m.spawn_x; y:=m.spawn_y; END IF;
 nx:=x+p_dx; ny:=y+p_dy;
 IF nx<0 OR ny<0 OR nx>=w OR ny>=w OR NOT coalesce(public.world_tile_walkable(m.tiles[ny*w+nx+1]),false) THEN RETURN jsonb_build_object('moved',false,'x',x,'y',y); END IF;
 UPDATE public.game_players SET world_x=nx, world_y=ny, world_zone=z WHERE id=p.id;
 RETURN jsonb_build_object('moved',true,'x',nx,'y',ny);
END $function$;
REVOKE ALL ON FUNCTION public.salon_move_player(uuid,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salon_move_player(uuid,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.salon_move_mob(p_game_id uuid, p_enemy_id uuid, p_dx integer, p_dy integer)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE e public.game_enemies%ROWTYPE; m public.game_world_maps%ROWTYPE; w integer; nx integer; ny integer;
BEGIN
 IF auth.uid() IS NULL OR abs(p_dx)+abs(p_dy)<>1 THEN RAISE EXCEPTION 'Déplacement adjacent requis.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.games WHERE id=p_game_id AND status='playing') THEN RAISE EXCEPTION 'La partie n’est pas en cours.'; END IF;
 IF NOT public.is_game_narrator(p_game_id) THEN RAISE EXCEPTION 'Seul le narrateur déplace les mobs.'; END IF;
 SELECT * INTO e FROM public.game_enemies WHERE id=p_enemy_id AND game_id=p_game_id AND status<>'vaincu' FOR UPDATE;
 IF NOT FOUND OR e.tile_x IS NULL OR e.tile_y IS NULL THEN RAISE EXCEPTION 'Mob indisponible.'; END IF;
 SELECT * INTO m FROM public.game_world_maps WHERE game_id=p_game_id;
 w:=CASE WHEN m.game_id IS NOT NULL AND cardinality(m.tiles)=1600 THEN 40 ELSE 160 END;
 nx:=e.tile_x+p_dx; ny:=e.tile_y+p_dy;
 IF nx<0 OR ny<0 OR nx>=w OR ny>=w OR (m.game_id IS NOT NULL AND NOT coalesce(public.world_tile_walkable(m.tiles[ny*w+nx+1]),false)) THEN RETURN jsonb_build_object('moved',false,'x',e.tile_x,'y',e.tile_y); END IF;
 UPDATE public.game_enemies SET tile_x=nx, tile_y=ny WHERE id=e.id;
 RETURN jsonb_build_object('moved',true,'x',nx,'y',ny);
END $function$;
REVOKE ALL ON FUNCTION public.salon_move_mob(uuid,uuid,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salon_move_mob(uuid,uuid,integer,integer) TO authenticated;
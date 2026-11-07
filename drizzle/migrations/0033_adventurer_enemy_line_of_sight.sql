CREATE OR REPLACE FUNCTION public.adventurer_sees_cell(p_game_id uuid,p_zone text,p_x integer,p_y integer) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.game_players%ROWTYPE; m public.game_world_maps%ROWTYPE; x integer; y integer; dx integer; dy integer; sx integer; sy integer; err integer; e2 integer; w integer;
BEGIN
 IF auth.uid() IS NULL OR p_x IS NULL OR p_y IS NULL THEN RETURN false; END IF;
 SELECT * INTO p FROM public.game_players WHERE game_id=p_game_id AND user_id=auth.uid() AND role='adventurer';
 IF NOT FOUND OR coalesce(p.current_zone,'entree')<>p_zone THEN RETURN false; END IF;
 SELECT * INTO m FROM public.game_world_maps WHERE game_id=p_game_id;
 x:=CASE WHEN p.world_zone=coalesce(p.current_zone,'entree') THEN p.world_x ELSE coalesce(m.spawn_x,p.world_x) END;
 y:=CASE WHEN p.world_zone=coalesce(p.current_zone,'entree') THEN p.world_y ELSE coalesce(m.spawn_y,p.world_y) END;
 IF (p_x-x)*(p_x-x)+(p_y-y)*(p_y-y)>64 THEN RETURN false; END IF;
 w:=CASE WHEN cardinality(m.tiles)=1600 THEN 40 ELSE 160 END;
 IF p_x<0 OR p_y<0 OR p_x>=w OR p_y>=w THEN RETURN false; END IF;
 dx:=abs(p_x-x); dy:=-abs(p_y-y); sx:=CASE WHEN x<p_x THEN 1 ELSE -1 END; sy:=CASE WHEN y<p_y THEN 1 ELSE -1 END; err:=dx+dy;
 LOOP
  IF x=p_x AND y=p_y THEN RETURN true; END IF;
  e2:=2*err;
  IF e2>=dy THEN err:=err+dy; x:=x+sx; END IF;
  IF e2<=dx THEN err:=err+dx; y:=y+sy; END IF;
  IF m.game_id IS NOT NULL AND NOT coalesce(public.world_tile_walkable(m.tiles[y*w+x+1]),false) THEN RETURN false; END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.adventurer_sees_cell(uuid,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.adventurer_sees_cell(uuid,text,integer,integer) TO authenticated;
ALTER POLICY "Narrator reads all enemies, members read revealed" ON public.game_enemies USING (public.is_game_narrator(game_id) OR public.adventurer_sees_cell(game_id,zone,tile_x,tile_y));
ALTER TABLE public.custom_maps ADD COLUMN passage jsonb;
ALTER TABLE public.game_map_sequence ADD COLUMN passage jsonb;
ALTER TABLE public.game_world_maps ADD COLUMN passage jsonb;
CREATE OR REPLACE FUNCTION public.use_map_passage(p_game_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE g public.games%ROWTYPE; p public.game_players%ROWTYPE; m public.game_world_maps%ROWTYPE; s public.game_map_sequence%ROWTYPE; idx integer; zone_name text; owner uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise.'; END IF;
 SELECT * INTO g FROM public.games WHERE id=p_game_id FOR UPDATE;
 IF NOT FOUND OR g.status <> 'playing' THEN RAISE EXCEPTION 'La partie n’est pas en cours.'; END IF;
 SELECT * INTO p FROM public.game_players WHERE game_id=p_game_id AND user_id=auth.uid() AND role='adventurer';
 IF NOT FOUND OR p.hp<=0 THEN RAISE EXCEPTION 'Seul un aventurier vivant peut utiliser ce passage.'; END IF;
 SELECT * INTO m FROM public.game_world_maps WHERE game_id=p_game_id;
 IF m.passage IS NULL OR p.world_x IS DISTINCT FROM (m.passage->>'x')::integer OR p.world_y IS DISTINCT FROM (m.passage->>'y')::integer THEN RAISE EXCEPTION 'Rejoins le point de passage.'; END IF;
 SELECT current_index INTO idx FROM public.game_map_progress WHERE game_id=p_game_id;
 SELECT * INTO s FROM public.game_map_sequence WHERE game_id=p_game_id AND position=idx+1;
 IF NOT FOUND THEN RAISE EXCEPTION 'Aucune étape suivante dans ce parcours.'; END IF;
 SELECT user_id INTO owner FROM public.game_players WHERE game_id=p_game_id AND role='narrator' LIMIT 1;
 IF owner IS NULL THEN owner:=auth.uid(); END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(s.enemies) e LEFT JOIN public.enemy_catalog c ON c.id=(e->>'catalogId')::uuid WHERE c.id IS NULL OR (c.owner_id IS NOT NULL AND c.owner_id<>owner) OR (c.game_id IS NOT NULL AND c.game_id<>p_game_id) OR NOT coalesce(public.world_tile_walkable(s.tiles[(e->>'y')::integer*160+(e->>'x')::integer+1]),false)) THEN RAISE EXCEPTION 'Ennemis de la prochaine étape invalides.'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(s.treasures) e LEFT JOIN public.treasure_catalog c ON c.id=(e->>'catalogId')::uuid WHERE c.id IS NULL OR (c.game_id IS NOT NULL AND c.game_id<>p_game_id) OR NOT coalesce(public.world_tile_walkable(s.tiles[(e->>'y')::integer*160+(e->>'x')::integer+1]),false)) THEN RAISE EXCEPTION 'Trésors de la prochaine étape invalides.'; END IF;
 zone_name:=coalesce(p.current_zone,'entree');
 UPDATE public.game_mob_control SET enemy_id=NULL WHERE game_id=p_game_id;
 UPDATE public.game_combats SET active=false WHERE game_id=p_game_id;
 DELETE FROM public.game_enemies WHERE game_id=p_game_id AND map_source IS NOT NULL;
 DELETE FROM public.game_treasures WHERE game_id=p_game_id AND map_source IS NOT NULL AND status='cache';
 UPDATE public.game_world_maps SET name=s.name,source=s.source,tiles=s.tiles,spawn_x=s.spawn_x,spawn_y=s.spawn_y,passage=s.passage,updated_at=now() WHERE game_id=p_game_id;
 INSERT INTO public.game_enemies(game_id,map_source,catalog_id,name,category,icon,ability,speed,strength,endurance,hp,max_hp,threat_cost,zone,tile_x,tile_y)
 SELECT p_game_id,s.source,c.id,c.name,c.category,c.icon,c.ability,c.speed,c.strength,c.endurance,10+2*c.endurance,10+2*c.endurance,c.threat_cost,zone_name,(e->>'x')::integer,(e->>'y')::integer FROM jsonb_array_elements(s.enemies) e JOIN public.enemy_catalog c ON c.id=(e->>'catalogId')::uuid;
 INSERT INTO public.game_treasures(game_id,map_source,catalog_id,name,type,rarity,effect,value,placement,zone,tile_x,tile_y)
 SELECT p_game_id,s.source,c.id,c.name,c.type,c.rarity,c.effect,c.value,'coffre',zone_name,(e->>'x')::integer,(e->>'y')::integer FROM jsonb_array_elements(s.treasures) e JOIN public.treasure_catalog c ON c.id=(e->>'catalogId')::uuid;
 UPDATE public.game_players SET world_x=s.spawn_x,world_y=s.spawn_y,world_zone=zone_name,current_zone=zone_name WHERE game_id=p_game_id AND role='adventurer';
 UPDATE public.game_map_progress SET current_index=s.position,updated_at=now() WHERE game_id=p_game_id;
 IF s.track IS NOT NULL THEN INSERT INTO public.game_ambience(game_id,track,state) VALUES(p_game_id,s.track,'lecture') ON CONFLICT(game_id) DO UPDATE SET track=excluded.track,state='lecture',updated_at=now(); END IF;
 INSERT INTO public.game_events(game_id,actor_id,kind,message,payload,important,secret) VALUES(p_game_id,auth.uid(),'carte','Étape '||(s.position+1)||' : '||s.name||'.','{}',true,false);
 IF s.intro_text<>'' THEN INSERT INTO public.game_events(game_id,actor_id,kind,message,payload,important,secret) VALUES(p_game_id,auth.uid(),'niveau',s.intro_text,jsonb_build_object('step',s.position+1),true,false); END IF;
 RETURN jsonb_build_object('name',s.name,'index',s.position);
END $$;
REVOKE ALL ON FUNCTION public.use_map_passage(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.use_map_passage(uuid) TO authenticated;
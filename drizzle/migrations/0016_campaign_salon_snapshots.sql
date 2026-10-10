CREATE OR REPLACE FUNCTION public.install_campaign_stage(p_game_id uuid,p_index integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE snap jsonb; stage jsonb; p jsonb; cat jsonb; room text; first_room text; BEGIN
 SELECT snapshot INTO snap FROM public.game_campaigns WHERE game_id=p_game_id FOR UPDATE; stage:=snap->'stages'->p_index; IF stage IS NULL THEN RAISE EXCEPTION 'Étape introuvable.'; END IF;
 DELETE FROM public.game_combats WHERE game_id=p_game_id; DELETE FROM public.game_mob_control WHERE game_id=p_game_id;
 DELETE FROM public.game_treasures WHERE game_id=p_game_id AND status='cache'; DELETE FROM public.game_enemies WHERE game_id=p_game_id; DELETE FROM public.game_dungeon_events WHERE game_id=p_game_id;
 FOR p IN SELECT value FROM jsonb_array_elements(stage->'placements') LOOP
 cat:=p->'catalog'; room:=p->>'room_key';
 IF p->>'kind'='mob' THEN
 INSERT INTO public.game_enemies(game_id,catalog_id,name,category,icon,ability,speed,strength,endurance,hp,max_hp,threat_cost,zone,trigger,status,tile_x,tile_y) VALUES(p_game_id,(cat->>'id')::uuid,cat->>'name',cat->>'category',cat->>'icon',cat->>'ability',coalesce((p->'overrides'->>'speed')::integer,(cat->>'speed')::integer),coalesce((p->'overrides'->>'strength')::integer,(cat->>'strength')::integer),coalesce((p->'overrides'->>'endurance')::integer,(cat->>'endurance')::integer),10+2*coalesce((p->'overrides'->>'endurance')::integer,(cat->>'endurance')::integer),10+2*coalesce((p->'overrides'->>'endurance')::integer,(cat->>'endurance')::integer),(cat->>'threat_cost')::integer,room,p->>'trigger',CASE WHEN (p->>'hidden')::boolean THEN 'cache' ELSE 'revele' END,(p->>'tile_x')::integer,(p->>'tile_y')::integer);
 ELSE INSERT INTO public.game_treasures(game_id,catalog_id,name,type,rarity,effect,value,placement,zone,status) VALUES(p_game_id,(cat->>'id')::uuid,cat->>'name',cat->>'type',cat->>'rarity',cat->>'effect',(cat->>'value')::integer,'zone',room,CASE WHEN (p->>'hidden')::boolean THEN 'cache' ELSE 'decouvert' END); END IF;
 END LOOP;
 FOR p IN SELECT value FROM jsonb_array_elements(stage->'events') LOOP INSERT INTO public.game_dungeon_events(game_id,threshold,effect,text) VALUES(p_game_id,(p->>'threshold')::integer,p->>'effect',p->>'text'); END LOOP;
 first_room:=stage->'rooms'->0->>'key';
 INSERT INTO public.game_dungeons(game_id,template_id,status,current_room,explored) VALUES(p_game_id,(stage->>'template_id')::uuid,'preparation',first_room,ARRAY[first_room]) ON CONFLICT(game_id) DO UPDATE SET template_id=EXCLUDED.template_id,status='preparation',current_room=EXCLUDED.current_room,explored=EXCLUDED.explored,tension=0,current_turn=1,core_taken=false,door_locked=false,updated_at=now();
 UPDATE public.game_campaigns SET stage_index=p_index,updated_at=now() WHERE game_id=p_game_id;
 UPDATE public.game_players SET current_zone=first_room,world_zone=NULL WHERE game_id=p_game_id AND role='adventurer';
 INSERT INTO public.game_ambience(game_id,track,state) VALUES(p_game_id,stage->>'track','playing') ON CONFLICT(game_id) DO UPDATE SET track=EXCLUDED.track,state='playing',updated_at=now();
 INSERT INTO public.game_events(game_id,kind,message,important) VALUES(p_game_id,'campagne','Étape '||(p_index+1)||' : '||(stage->'t'->>'name')||'. Objectif : '||(stage->>'objective')||'. '||(stage->>'intro_text'),true);
 END $$;
REVOKE ALL ON FUNCTION public.install_campaign_stage(uuid,integer) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.install_campaign_stage(uuid,integer) TO service_role;
CREATE OR REPLACE FUNCTION public.load_private_campaign(p_campaign_id uuid,p_game_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c public.campaigns%ROWTYPE; s public.campaign_stages%ROWTYPE; placements jsonb; stages jsonb:='[]'; stage jsonb; used integer; budget integer; g public.games%ROWTYPE; BEGIN
 SELECT * INTO g FROM public.games WHERE id=p_game_id FOR UPDATE;
 IF NOT FOUND OR g.status<>'waiting' OR NOT public.is_game_narrator(p_game_id) THEN RAISE EXCEPTION 'Seul le narrateur peut charger une campagne avant lancement.'; END IF;
 SELECT * INTO c FROM public.campaigns WHERE id=p_campaign_id AND owner_id=auth.uid() FOR UPDATE; IF NOT FOUND OR c.status<>'published' THEN RAISE EXCEPTION 'Publie d’abord ta campagne privée.'; END IF;
 SELECT count(*)*3 INTO budget FROM public.game_players WHERE game_id=p_game_id AND role='adventurer';
 FOR s IN SELECT * FROM public.campaign_stages WHERE campaign_id=c.id ORDER BY position LOOP
 SELECT coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('catalog',CASE WHEN p.kind='mob' THEN (SELECT to_jsonb(e) FROM public.enemy_catalog e WHERE id=p.catalog_id) ELSE (SELECT to_jsonb(t) FROM public.treasure_catalog t WHERE id=p.catalog_id) END)),'[]') INTO placements FROM public.campaign_placements p WHERE stage_id=s.id;
 SELECT coalesce(sum((p->'catalog'->>'threat_cost')::integer),0) INTO used FROM jsonb_array_elements(placements) p WHERE p->>'kind'='mob'; IF used>budget THEN RAISE EXCEPTION 'Budget dépassé dans une étape : % / % ; ajoute des aventuriers ou retire des mobs.',used,budget; END IF;
 stage:=to_jsonb(s)||jsonb_build_object('placements',placements,'t',(SELECT to_jsonb(t)||jsonb_build_object('objective_text',s.objective,'objective_type','campaign','default_track',s.track) FROM public.dungeon_templates t WHERE id=s.template_id),'rooms',(SELECT jsonb_agg(to_jsonb(r) ORDER BY position) FROM public.dungeon_rooms r WHERE template_id=s.template_id),'events',coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM public.dungeon_events e WHERE template_id=s.template_id),'[]'),'roomEnemies','[]'::jsonb,'roomTreasures','[]'::jsonb);
 stages:=stages||jsonb_build_array(stage);
 END LOOP;
 IF jsonb_array_length(stages)=0 THEN RAISE EXCEPTION 'Campagne vide.'; END IF;
 INSERT INTO public.game_campaigns(game_id,snapshot) VALUES(p_game_id,to_jsonb(c)||jsonb_build_object('stages',stages)) ON CONFLICT(game_id) DO UPDATE SET snapshot=EXCLUDED.snapshot,stage_index=0,is_test=false;
 DELETE FROM public.game_levels WHERE game_id=p_game_id;
 PERFORM public.install_campaign_stage(p_game_id,0); RETURN jsonb_build_object('ok',true,'stages',jsonb_array_length(stages)); END $$;
CREATE OR REPLACE FUNCTION public.advance_private_campaign(p_game_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c public.game_campaigns%ROWTYPE; dg public.game_dungeons%ROWTYPE; stage jsonb; BEGIN
 PERFORM 1 FROM public.games WHERE id=p_game_id FOR UPDATE; IF NOT public.is_game_narrator(p_game_id) THEN RAISE EXCEPTION 'Seul le narrateur avance la campagne.'; END IF;
 SELECT * INTO c FROM public.game_campaigns WHERE game_id=p_game_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Aucune campagne chargée.'; END IF;
 SELECT * INTO dg FROM public.game_dungeons WHERE game_id=p_game_id; stage:=c.snapshot->'stages'->c.stage_index;
 IF NOT (stage->>'objective_room'=ANY(dg.explored)) OR dg.current_room<>stage->>'exit_room' OR EXISTS(SELECT 1 FROM public.game_enemies WHERE game_id=p_game_id AND zone=stage->>'objective_room' AND status<>'vaincu') THEN RAISE EXCEPTION 'Atteins l’objectif, neutralise ses mobs et rejoins la sortie.'; END IF;
 IF c.stage_index+1>=jsonb_array_length(c.snapshot->'stages') THEN UPDATE public.games SET status='finished',result='victoire',ended_at=now() WHERE id=p_game_id; UPDATE public.game_dungeons SET status='termine' WHERE game_id=p_game_id; INSERT INTO public.game_events(game_id,kind,message,important) VALUES(p_game_id,'fin','Campagne terminée : victoire !',true);
 ELSE PERFORM public.install_campaign_stage(p_game_id,c.stage_index+1); UPDATE public.game_dungeons SET status='en_cours' WHERE game_id=p_game_id; END IF;
 RETURN jsonb_build_object('ok',true); END $$;
REVOKE ALL ON FUNCTION public.load_private_campaign(uuid,uuid),public.advance_private_campaign(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.load_private_campaign(uuid,uuid),public.advance_private_campaign(uuid) TO authenticated;
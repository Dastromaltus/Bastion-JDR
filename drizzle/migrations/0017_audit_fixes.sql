-- Fix biased dice rolls in combat
CREATE OR REPLACE FUNCTION public.salon_combat_action(p_game_id uuid,p_revision integer,p_action text,p_enemy_id uuid DEFAULT NULL,p_target uuid DEFAULT NULL,p_x integer DEFAULT NULL,p_y integer DEFAULT NULL,p_effect text DEFAULT 'attaque') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c public.game_combats%ROWTYPE; f jsonb; e public.game_enemies%ROWTYPE; target_p public.game_players%ROWTYPE; actor_p public.game_players%ROWTYPE; n integer; rolls jsonb:='[]'; r integer; successes integer:=0; damage integer:=0; i integer; next_f jsonb; wrapped boolean:=false; narr boolean; BEGIN
 PERFORM 1 FROM public.games WHERE id=p_game_id AND status='playing' FOR UPDATE; IF NOT FOUND OR NOT public.is_game_member(p_game_id) THEN RAISE EXCEPTION 'Partie inaccessible.'; END IF;
 narr:=public.is_game_narrator(p_game_id);
 SELECT * INTO c FROM public.game_combats WHERE game_id=p_game_id AND active FOR UPDATE;
 IF p_action='control' THEN
  IF NOT narr THEN RAISE EXCEPTION 'Seul le narrateur contrôle un mob.'; END IF;
  SELECT * INTO e FROM public.game_enemies WHERE game_id=p_game_id AND id=p_enemy_id AND status<>'vaincu'; IF NOT FOUND THEN RAISE EXCEPTION 'Mob indisponible.'; END IF;
  INSERT INTO public.game_mob_control(game_id,enemy_id) VALUES(p_game_id,p_enemy_id) ON CONFLICT(game_id) DO UPDATE SET enemy_id=EXCLUDED.enemy_id,revision=game_mob_control.revision+1; RETURN jsonb_build_object('ok',true);
 END IF;
 IF c.game_id IS NULL OR c.revision<>p_revision THEN RAISE EXCEPTION 'Le tour a changé : actualise la partie.'; END IF;
 f:=c.fighters->c.turn_index;
 IF f->>'kind'='enemy' THEN
  IF NOT narr OR (f->>'id')::uuid<>p_enemy_id THEN RAISE EXCEPTION 'Ce mob ne peut pas agir à ce tour.'; END IF;
  SELECT * INTO e FROM public.game_enemies WHERE id=p_enemy_id AND game_id=p_game_id AND status<>'vaincu'; IF NOT FOUND THEN RAISE EXCEPTION 'Mob indisponible.'; END IF;
  IF p_action='move' THEN
   IF p_x IS NULL OR p_y IS NULL OR p_x<1 OR p_x>23 OR p_y<1 OR p_y>15 OR abs(p_x-e.tile_x)+abs(p_y-e.tile_y)<>1 THEN RAISE EXCEPTION 'Déplacement adjacent sur case valide requis.'; END IF;
   UPDATE public.game_enemies SET tile_x=p_x,tile_y=p_y WHERE id=e.id;
   INSERT INTO public.game_events(game_id,actor_id,kind,message,secret) VALUES(p_game_id,auth.uid(),'deplacement',e.name||' se déplace.',e.status='cache');
  ELSIF p_action IN ('attack','ability') THEN
   IF p_action='ability' AND (e.ability='' OR p_effect NOT IN ('attaque','soin','protection')) THEN RAISE EXCEPTION 'Capacité indisponible.'; END IF;
   SELECT * INTO target_p FROM public.game_players WHERE id=p_target AND game_id=p_game_id AND role='adventurer' AND hp>0 AND current_zone=e.zone;
   IF (p_action='attack' OR p_effect='attaque') AND target_p.id IS NULL THEN RAISE EXCEPTION 'Choisis un aventurier présent.'; END IF;
   n:=CASE WHEN p_action='ability' AND p_effect IN ('soin','protection') THEN e.endurance ELSE e.strength END;
   FOR i IN 1..n LOOP r:=(1+floor(random()*6))::integer; rolls:=rolls||jsonb_build_array(r); IF r>=5 THEN successes:=successes+1; END IF; END LOOP;
   IF p_action='attack' OR p_effect='attaque' THEN
    IF e.status='cache' THEN UPDATE public.game_enemies SET status='revele',revealed_at=now() WHERE id=e.id; INSERT INTO public.game_events(game_id,actor_id,kind,message,important) VALUES(p_game_id,auth.uid(),'revelation',e.name||' se révèle en attaquant !',true); END IF;
    damage:=successes; UPDATE public.game_players SET hp=greatest(0,hp-damage) WHERE id=target_p.id;
    INSERT INTO public.game_events(game_id,actor_id,kind,message,payload,important) VALUES(p_game_id,auth.uid(),'jet',e.name||' attaque '||target_p.display_name||' : '||n||'d6 '||rolls::text||' → '||successes||' réussite(s), '||damage||' dégâts.',jsonb_build_object('rolls',rolls,'successes',successes),true);
   ELSE UPDATE public.game_enemies SET hp=least(max_hp,hp+successes) WHERE id=e.id;
    INSERT INTO public.game_events(game_id,actor_id,kind,message,payload,secret) VALUES(p_game_id,auth.uid(),'jet',e.name||' utilise '||e.ability||' : '||successes||' réussite(s).',jsonb_build_object('rolls',rolls,'successes',successes),e.status='cache');
   END IF;
  ELSIF p_action<>'pass' THEN RAISE EXCEPTION 'Action inconnue.'; END IF;
 ELSE
  IF f->>'user_id'<>auth.uid()::text THEN RAISE EXCEPTION 'Ce n’est pas ton tour.'; END IF;
  SELECT * INTO actor_p FROM public.game_players WHERE id=(f->>'id')::uuid AND game_id=p_game_id AND role='adventurer' AND hp>0;
  IF NOT FOUND THEN RAISE EXCEPTION 'Aventurier indisponible.'; END IF;
  IF p_action='attack' THEN
   SELECT * INTO e FROM public.game_enemies WHERE id=p_enemy_id AND game_id=p_game_id AND status='revele' AND zone=actor_p.current_zone;
   IF NOT FOUND THEN RAISE EXCEPTION 'Aucun ennemi visible à attaquer ici.'; END IF;
   n:=greatest(1,least(5,round(actor_p.strength/20.0)::integer));
   FOR i IN 1..n LOOP r:=(1+floor(random()*6))::integer; rolls:=rolls||jsonb_build_array(r); IF r>=5 THEN successes:=successes+1; END IF; END LOOP;
   damage:=CASE WHEN successes>0 THEN greatest(1,successes+1-CASE WHEN e.ability ILIKE '%bouclier%' THEN 1 ELSE 0 END) ELSE 0 END;
   UPDATE public.game_enemies SET hp=greatest(0,hp-damage),status=CASE WHEN hp-damage<=0 THEN 'vaincu' ELSE status END WHERE id=e.id;
   INSERT INTO public.game_events(game_id,actor_id,kind,message,payload,important) VALUES(p_game_id,auth.uid(),'jet',actor_p.display_name||' attaque '||e.name||' : '||n||'d6 '||rolls::text||' → '||successes||' réussite(s), '||damage||' dégâts.',jsonb_build_object('rolls',rolls,'successes',successes),true);
  ELSIF p_action<>'pass' THEN RAISE EXCEPTION 'Action inconnue.'; END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.game_enemies WHERE game_id=p_game_id AND zone=c.zone AND status<>'vaincu') OR NOT EXISTS(SELECT 1 FROM public.game_players WHERE game_id=p_game_id AND current_zone=c.zone AND role='adventurer' AND hp>0) THEN
 UPDATE public.game_combats SET active=false,revision=revision+1 WHERE game_id=p_game_id; UPDATE public.game_mob_control SET enemy_id=NULL WHERE game_id=p_game_id;
 ELSE
 FOR i IN 1..jsonb_array_length(c.fighters) LOOP
  c.turn_index:=(c.turn_index+1)%jsonb_array_length(c.fighters); IF c.turn_index=0 THEN c.round:=c.round+1; wrapped:=true; END IF; next_f:=c.fighters->c.turn_index;
  EXIT WHEN (next_f->>'kind'='player' AND EXISTS(SELECT 1 FROM public.game_players WHERE id=(next_f->>'id')::uuid AND role='adventurer' AND hp>0)) OR (next_f->>'kind'='enemy' AND EXISTS(SELECT 1 FROM public.game_enemies WHERE id=(next_f->>'id')::uuid AND status<>'vaincu'));
 END LOOP;
 UPDATE public.game_combats SET turn_index=c.turn_index,round=c.round,revision=revision+1 WHERE game_id=p_game_id;
 INSERT INTO public.game_mob_control(game_id,enemy_id) VALUES(p_game_id,CASE WHEN next_f->>'kind'='enemy' THEN (next_f->>'id')::uuid ELSE NULL END) ON CONFLICT(game_id) DO UPDATE SET enemy_id=EXCLUDED.enemy_id,revision=game_mob_control.revision+1;
 END IF;
 RETURN jsonb_build_object('ok',true,'rolls',rolls,'successes',successes,'damage',damage,'wrapped',wrapped);
 END $$;

-- Loosen narrator requirement for campaign saving
CREATE OR REPLACE FUNCTION public.save_private_campaign(p_document jsonb,p_publish boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE cid uuid; existing public.campaigns%ROWTYPE; s jsonb; p jsonb; sid uuid; tid uuid; used integer; budget integer; reachable text[]; keys text[]; previous_count integer; room_record record; stat_value integer; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise.'; END IF;
 cid:=nullif(p_document->>'id','')::uuid;
 IF cid IS NOT NULL THEN SELECT * INTO existing FROM public.campaigns WHERE id=cid FOR UPDATE; IF NOT FOUND OR existing.owner_id<>auth.uid() THEN RAISE EXCEPTION 'Campagne inaccessible.'; END IF; IF existing.revision<>coalesce((p_document->>'revision')::integer,0) THEN RAISE EXCEPTION 'Cette campagne a changé dans une autre fenêtre. Recharge-la.'; END IF; ELSE cid:=gen_random_uuid(); END IF;
 IF length(coalesce(p_document->>'name','')) NOT BETWEEN 1 AND 80 OR length(coalesce(p_document->>'summary',''))>2000 THEN RAISE EXCEPTION 'Nom ou résumé invalide.'; END IF;
 IF coalesce(jsonb_array_length(p_document->'stages'),0)>20 THEN RAISE EXCEPTION 'Maximum 20 étapes.'; END IF;
 IF p_publish AND coalesce(jsonb_array_length(p_document->'stages'),0)=0 THEN RAISE EXCEPTION 'Ajoute au moins une étape.'; END IF;
 budget:=coalesce((p_document->>'recommended_players')::integer,3)*3;
 INSERT INTO public.campaigns(id,owner_id,name,summary,difficulty,recommended_players,status,is_template,revision) VALUES(cid,auth.uid(),p_document->>'name',coalesce(p_document->>'summary',''),coalesce(p_document->>'difficulty','initiation'),coalesce((p_document->>'recommended_players')::integer,3),CASE WHEN p_publish THEN 'published' ELSE 'draft' END,coalesce((p_document->>'is_template')::boolean,false),coalesce(existing.revision,0)+1) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,summary=EXCLUDED.summary,difficulty=EXCLUDED.difficulty,recommended_players=EXCLUDED.recommended_players,status=EXCLUDED.status,is_template=EXCLUDED.is_template,revision=EXCLUDED.revision,updated_at=now();
 DELETE FROM public.campaign_stages WHERE campaign_id=cid;
 FOR s IN SELECT value FROM jsonb_array_elements(coalesce(p_document->'stages','[]')) LOOP
 tid:=(s->>'template_id')::uuid; SELECT array_agg(key ORDER BY position) INTO keys FROM public.dungeon_rooms WHERE template_id=tid;
 IF keys IS NULL THEN RAISE EXCEPTION 'Map introuvable.'; END IF;
 IF NOT (s->>'objective_room'=ANY(keys)) OR NOT(s->>'exit_room'=ANY(keys)) THEN RAISE EXCEPTION 'Salle d’objectif ou sortie inconnue.'; END IF;
 reachable:=ARRAY[keys[1]];
 LOOP previous_count:=cardinality(reachable); FOR room_record IN SELECT key,connections FROM public.dungeon_rooms WHERE template_id=tid AND key=ANY(reachable) LOOP reachable:=ARRAY(SELECT DISTINCT unnest(reachable||room_record.connections)); END LOOP; EXIT WHEN cardinality(reachable)=previous_count; END LOOP;
 IF p_publish AND (NOT keys<@reachable OR NOT (s->>'objective_room'=ANY(reachable)) OR NOT(s->>'exit_room'=ANY(reachable)) OR length(trim(coalesce(s->>'objective','')))=0) THEN RAISE EXCEPTION 'Salle inaccessible, objectif manquant ou sortie impossible.'; END IF;
 IF coalesce(s->>'track','forteresse') NOT IN ('forteresse','alerte','couloirs','laboratoire','combat','boss','victoire','defaite','silence') THEN RAISE EXCEPTION 'Piste inconnue.'; END IF;
 sid:=gen_random_uuid(); INSERT INTO public.campaign_stages(id,campaign_id,template_id,position,objective,objective_room,exit_room,intro_text,track) VALUES(sid,cid,tid,coalesce((s->>'position')::integer,0),coalesce(s->>'objective',''),s->>'objective_room',s->>'exit_room',coalesce(s->>'intro_text',''),coalesce(s->>'track','forteresse'));
 used:=0;
 FOR p IN SELECT value FROM jsonb_array_elements(coalesce(s->'placements','[]')) LOOP
 IF NOT(p->>'room_key'=ANY(keys)) THEN RAISE EXCEPTION 'Salle de placement inconnue.'; END IF;
 IF p->>'kind'='mob' THEN
 IF NOT EXISTS(SELECT 1 FROM public.enemy_catalog WHERE id=(p->>'catalog_id')::uuid AND (game_id IS NULL OR created_by=auth.uid())) THEN RAISE EXCEPTION 'Mob inaccessible.'; END IF;
 SELECT threat_cost INTO stat_value FROM public.enemy_catalog WHERE id=(p->>'catalog_id')::uuid; used:=used+stat_value;
 FOR room_record IN SELECT speed,strength,endurance FROM public.enemy_catalog WHERE id=(p->>'catalog_id')::uuid LOOP
 IF coalesce((p->'overrides'->>'speed')::integer,room_record.speed) NOT BETWEEN 1 AND 5 OR coalesce((p->'overrides'->>'strength')::integer,room_record.strength) NOT BETWEEN 1 AND 5 OR coalesce((p->'overrides'->>'endurance')::integer,room_record.endurance) NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Les stats vont de 1 à 5.'; END IF; END LOOP;
 ELSE IF NOT EXISTS(SELECT 1 FROM public.treasure_catalog WHERE id=(p->>'catalog_id')::uuid AND (game_id IS NULL OR created_by=auth.uid())) THEN RAISE EXCEPTION 'Trésor inaccessible.'; END IF; END IF;
 INSERT INTO public.campaign_placements(stage_id,room_key,kind,catalog_id,hidden,trigger,tile_x,tile_y,overrides) VALUES(sid,p->>'room_key',p->>'kind',(p->>'catalog_id')::uuid,coalesce((p->>'hidden')::boolean,true),coalesce(p->>'trigger','entree'),coalesce((p->>'tile_x')::integer,16),coalesce((p->>'tile_y')::integer,9),coalesce(p->'overrides','{}'));
 END LOOP;
 IF p_publish AND used>budget THEN RAISE EXCEPTION 'Budget dépassé : % / %.',used,budget; END IF;
 END LOOP;
 RETURN jsonb_build_object('id',cid,'revision',coalesce(existing.revision,0)+1,'status',CASE WHEN p_publish THEN 'published' ELSE 'draft' END); END $$;

-- Harden enemy catalog RLS to allow authors to see their own catalog items even if not currently narrating
DROP POLICY IF EXISTS "Narrators read enemy catalog" ON public.enemy_catalog;
CREATE POLICY "Narrators read enemy catalog" ON public.enemy_catalog FOR SELECT TO authenticated
  USING ((game_id IS NULL AND (EXISTS (SELECT 1 FROM public.game_players gp WHERE gp.user_id = auth.uid() AND gp.role = 'narrator') OR created_by = auth.uid())) OR public.is_game_narrator(game_id));

DROP POLICY IF EXISTS "Narrators read treasure catalog" ON public.treasure_catalog;
CREATE POLICY "Narrators read treasure catalog" ON public.treasure_catalog FOR SELECT TO authenticated
  USING ((game_id IS NULL AND (EXISTS (SELECT 1 FROM public.game_players gp WHERE gp.user_id = auth.uid() AND gp.role = 'narrator') OR created_by = auth.uid())) OR public.is_game_narrator(game_id));

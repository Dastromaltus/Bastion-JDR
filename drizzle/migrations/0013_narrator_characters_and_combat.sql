CREATE TABLE public.game_character_archives (player_id uuid PRIMARY KEY REFERENCES public.game_players(id) ON DELETE CASCADE, game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE, user_id uuid NOT NULL, sheet jsonb NOT NULL, archived_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.game_character_archives TO authenticated; GRANT ALL ON public.game_character_archives TO service_role;
ALTER TABLE public.game_character_archives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads archived sheet" ON public.game_character_archives FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE OR REPLACE FUNCTION public.archive_narrator_character() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.role='narrator' THEN
  IF TG_OP='UPDATE' AND OLD.role='adventurer' THEN INSERT INTO public.game_character_archives(player_id,game_id,user_id,sheet) VALUES(OLD.id,OLD.game_id,OLD.user_id,to_jsonb(OLD)) ON CONFLICT(player_id) DO UPDATE SET sheet=EXCLUDED.sheet,archived_at=now(); END IF;
  NEW.race:=''; NEW.speed:=0; NEW.strength:=0; NEW.endurance:=0; NEW.hp:=0; NEW.max_hp:=0;
 ELSIF TG_OP='UPDATE' AND OLD.role='narrator' THEN
  SELECT coalesce((sheet->>'race'),'Humain'),coalesce((sheet->>'speed')::integer,70),coalesce((sheet->>'strength')::integer,70),coalesce((sheet->>'endurance')::integer,70),coalesce((sheet->>'hp')::integer,14),coalesce((sheet->>'max_hp')::integer,14) INTO NEW.race,NEW.speed,NEW.strength,NEW.endurance,NEW.hp,NEW.max_hp FROM public.game_character_archives WHERE player_id=OLD.id;
  IF NOT FOUND THEN NEW.race:='Humain'; NEW.speed:=70; NEW.strength:=70; NEW.endurance:=70; NEW.hp:=14; NEW.max_hp:=14; END IF;
 END IF; RETURN NEW; END $$;
CREATE TRIGGER narrator_character_archive BEFORE INSERT OR UPDATE ON public.game_players FOR EACH ROW EXECUTE FUNCTION public.archive_narrator_character();
INSERT INTO public.game_character_archives(player_id,game_id,user_id,sheet) SELECT id,game_id,user_id,to_jsonb(p) FROM public.game_players p WHERE role='narrator';
UPDATE public.game_players SET race='',speed=0,strength=0,endurance=0,hp=0,max_hp=0 WHERE role='narrator';
DROP POLICY "Owner or narrator reads inventory" ON public.game_inventory;
CREATE POLICY "Active adventurer inventory" ON public.game_inventory FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.game_players p WHERE p.game_id=game_inventory.game_id AND p.user_id=game_inventory.owner_id AND p.role='adventurer') AND ((owner_id=auth.uid() AND public.is_game_member(game_id)) OR public.is_game_narrator(game_id)));
DROP POLICY "Owner or narrator removes items" ON public.game_inventory;
CREATE POLICY "Active adventurer removes items" ON public.game_inventory FOR DELETE TO authenticated USING (EXISTS(SELECT 1 FROM public.game_players p WHERE p.game_id=game_inventory.game_id AND p.user_id=game_inventory.owner_id AND p.role='adventurer') AND ((owner_id=auth.uid() AND public.is_game_member(game_id)) OR public.is_game_narrator(game_id)));
ALTER TABLE public.game_enemies ADD COLUMN tile_x integer NOT NULL DEFAULT 16, ADD COLUMN tile_y integer NOT NULL DEFAULT 9;
CREATE TABLE public.game_mob_control (game_id uuid PRIMARY KEY REFERENCES public.games(id) ON DELETE CASCADE, enemy_id uuid REFERENCES public.game_enemies(id) ON DELETE SET NULL, revision integer NOT NULL DEFAULT 0);
GRANT SELECT ON public.game_mob_control TO authenticated; GRANT ALL ON public.game_mob_control TO service_role;
ALTER TABLE public.game_mob_control ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Narrator reads mob control" ON public.game_mob_control FOR SELECT TO authenticated USING(public.is_game_narrator(game_id));
CREATE TABLE public.game_combats (game_id uuid PRIMARY KEY REFERENCES public.games(id) ON DELETE CASCADE, zone text NOT NULL, active boolean NOT NULL DEFAULT true, turn_index integer NOT NULL DEFAULT 0, round integer NOT NULL DEFAULT 1, revision integer NOT NULL DEFAULT 0, fighters jsonb NOT NULL DEFAULT '[]');
GRANT SELECT ON public.game_combats TO authenticated; GRANT ALL ON public.game_combats TO service_role;
ALTER TABLE public.game_combats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Narrator reads full initiative" ON public.game_combats FOR SELECT TO authenticated USING(public.is_game_narrator(game_id));
CREATE OR REPLACE FUNCTION public.transfer_salon_narrator(p_game_id uuid,p_target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM 1 FROM public.games WHERE id=p_game_id FOR UPDATE;
 IF NOT public.is_game_narrator(p_game_id) THEN RAISE EXCEPTION 'Seul le narrateur peut transmettre son rôle.'; END IF;
 IF p_target=auth.uid() OR NOT EXISTS(SELECT 1 FROM public.game_players WHERE game_id=p_game_id AND user_id=p_target AND role='adventurer') THEN RAISE EXCEPTION 'Aventurier introuvable.'; END IF;
 UPDATE public.game_players SET role='adventurer' WHERE game_id=p_game_id AND user_id=auth.uid();
 UPDATE public.game_players SET role='narrator' WHERE game_id=p_game_id AND user_id=p_target;
 DELETE FROM public.game_mob_control WHERE game_id=p_game_id;
 INSERT INTO public.game_events(game_id,actor_id,kind,message,important) VALUES(p_game_id,auth.uid(),'systeme','Le rôle de narrateur est transmis ; la fiche précédente est archivée.',true);
 END $$;
CREATE OR REPLACE FUNCTION public.start_salon_combat(p_game_id uuid,p_zone text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE roster jsonb; BEGIN
 PERFORM 1 FROM public.games WHERE id=p_game_id AND status='playing' AND NOT solo FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.game_combats WHERE game_id=p_game_id AND active) THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.game_enemies WHERE game_id=p_game_id AND zone=p_zone AND status<>'vaincu') THEN RETURN; END IF;
 SELECT jsonb_agg(jsonb_build_object('id',id,'kind',kind,'name',name,'user_id',user_id,'speed',speed) ORDER BY speed DESC,kind,id) INTO roster FROM (
 SELECT id,'player'::text kind,display_name name,user_id,greatest(1,least(5,round(speed/20.0)::integer)) speed FROM public.game_players WHERE game_id=p_game_id AND role='adventurer' AND hp>0 AND current_zone=p_zone
 UNION ALL SELECT id,'enemy',name,NULL::uuid,speed FROM public.game_enemies WHERE game_id=p_game_id AND zone=p_zone AND status<>'vaincu') f;
 IF roster IS NULL THEN RETURN; END IF;
 INSERT INTO public.game_combats(game_id,zone,fighters) VALUES(p_game_id,p_zone,roster) ON CONFLICT(game_id) DO UPDATE SET zone=EXCLUDED.zone,fighters=EXCLUDED.fighters,active=true,turn_index=0,round=1,revision=game_combats.revision+1;
 INSERT INTO public.game_mob_control(game_id,enemy_id) VALUES(p_game_id,CASE WHEN roster->0->>'kind'='enemy' THEN (roster->0->>'id')::uuid ELSE NULL END) ON CONFLICT(game_id) DO UPDATE SET enemy_id=EXCLUDED.enemy_id,revision=game_mob_control.revision+1;
 END $$;
REVOKE ALL ON FUNCTION public.start_salon_combat(uuid,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.start_salon_combat(uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.get_salon_combat(p_game_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c public.game_combats%ROWTYPE; f jsonb; visible jsonb:='[]'; current_f jsonb; narr boolean; BEGIN
 IF NOT public.is_game_member(p_game_id) THEN RAISE EXCEPTION 'Salon inaccessible.'; END IF;
 SELECT * INTO c FROM public.game_combats WHERE game_id=p_game_id AND active; IF NOT FOUND THEN RETURN NULL; END IF;
 narr:=public.is_game_narrator(p_game_id);
 FOR f IN SELECT value FROM jsonb_array_elements(c.fighters) LOOP
 IF f->>'kind'='player' OR narr OR EXISTS(SELECT 1 FROM public.game_enemies WHERE id=(f->>'id')::uuid AND game_id=p_game_id AND status='revele') THEN visible:=visible||jsonb_build_array(f); END IF;
 END LOOP;
 f:=c.fighters->c.turn_index;
 IF f->>'kind'='enemy' AND NOT narr AND NOT EXISTS(SELECT 1 FROM public.game_enemies WHERE id=(f->>'id')::uuid AND status='revele') THEN current_f:=NULL; ELSE current_f:=f; END IF;
 RETURN jsonb_build_object('active',true,'round',c.round,'revision',c.revision,'fighters',visible,'current',current_f,'isMine',CASE WHEN f->>'kind'='enemy' THEN narr ELSE f->>'user_id'=auth.uid()::text END,'label',CASE WHEN current_f IS NULL THEN 'Le narrateur résout les événements.' ELSE 'Tour de '||(current_f->>'name') END);
 END $$;
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
   IF p_x IS NULL OR p_y IS NULL OR p_x<0 OR p_x>24 OR p_y<0 OR p_y>16 OR abs(p_x-e.tile_x)+abs(p_y-e.tile_y)<>1 THEN RAISE EXCEPTION 'Déplacement adjacent requis.'; END IF;
   UPDATE public.game_enemies SET tile_x=p_x,tile_y=p_y WHERE id=e.id;
   INSERT INTO public.game_events(game_id,actor_id,kind,message,secret) VALUES(p_game_id,auth.uid(),'deplacement',e.name||' se déplace.',e.status='cache');
  ELSIF p_action IN ('attack','ability') THEN
   IF p_action='ability' AND (e.ability='' OR p_effect NOT IN ('attaque','soin','protection')) THEN RAISE EXCEPTION 'Capacité indisponible.'; END IF;
   SELECT * INTO target_p FROM public.game_players WHERE id=p_target AND game_id=p_game_id AND role='adventurer' AND hp>0 AND current_zone=e.zone;
   IF (p_action='attack' OR p_effect='attaque') AND target_p.id IS NULL THEN RAISE EXCEPTION 'Choisis un aventurier présent.'; END IF;
   n:=CASE WHEN p_action='ability' AND p_effect IN ('soin','protection') THEN e.endurance ELSE e.strength END;
   FOR i IN 1..n LOOP r:=1+(get_byte(gen_random_bytes(1),0)%6); rolls:=rolls||jsonb_build_array(r); IF r>=5 THEN successes:=successes+1; END IF; END LOOP;
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
   FOR i IN 1..n LOOP r:=1+(get_byte(gen_random_bytes(1),0)%6); rolls:=rolls||jsonb_build_array(r); IF r>=5 THEN successes:=successes+1; END IF; END LOOP;
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
REVOKE ALL ON FUNCTION public.transfer_salon_narrator(uuid,uuid),public.get_salon_combat(uuid),public.salon_combat_action(uuid,integer,text,uuid,uuid,integer,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transfer_salon_narrator(uuid,uuid),public.get_salon_combat(uuid),public.salon_combat_action(uuid,integer,text,uuid,uuid,integer,integer,text) TO authenticated;
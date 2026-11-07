ALTER TABLE public.game_players ADD COLUMN IF NOT EXISTS class text NOT NULL DEFAULT 'guerrier' CHECK (class IN ('guerrier','mage','voleur'));
CREATE OR REPLACE FUNCTION public.salon_combat_action(p_game_id uuid, p_revision integer, p_action text, p_enemy_id uuid DEFAULT NULL::uuid, p_target uuid DEFAULT NULL::uuid, p_x integer DEFAULT NULL::integer, p_y integer DEFAULT NULL::integer, p_effect text DEFAULT 'attaque'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ DECLARE c public.game_combats%ROWTYPE; f jsonb; e public.game_enemies%ROWTYPE; target_p public.game_players%ROWTYPE; actor_p public.game_players%ROWTYPE; n integer; rolls jsonb:='[]'; r integer; successes integer:=0; damage integer:=0; i integer; next_f jsonb; wrapped boolean:=false; narr boolean; BEGIN
 PERFORM 1 FROM public.games WHERE id=p_game_id AND status='playing' FOR UPDATE; IF NOT FOUND OR NOT public.is_game_member(p_game_id) THEN RAISE EXCEPTION 'Partie inaccessible.'; END IF;
 narr:=public.is_game_narrator(p_game_id);
 SELECT * INTO c FROM public.game_combats WHERE game_id=p_game_id AND active FOR UPDATE;
 IF p_action='control' THEN IF c.active AND EXISTS(SELECT 1 FROM public.game_enemies WHERE id=p_enemy_id AND game_id=p_game_id AND zone<>c.zone) THEN RAISE EXCEPTION 'Ce mob est dans une autre salle du combat.'; END IF;
  IF NOT narr THEN RAISE EXCEPTION 'Seul le narrateur contrôle un mob.'; END IF;
  SELECT * INTO e FROM public.game_enemies WHERE game_id=p_game_id AND id=p_enemy_id AND status<>'vaincu'; IF NOT FOUND THEN RAISE EXCEPTION 'Mob indisponible.'; END IF;
  IF c.game_id IS NULL THEN PERFORM public.start_salon_combat(p_game_id,e.zone); END IF; INSERT INTO public.game_mob_control(game_id,enemy_id) VALUES(p_game_id,p_enemy_id) ON CONFLICT(game_id) DO UPDATE SET enemy_id=EXCLUDED.enemy_id,revision=game_mob_control.revision+1; RETURN jsonb_build_object('ok',true);
 END IF;
 IF c.game_id IS NULL OR c.revision<>p_revision THEN RAISE EXCEPTION 'Le tour a changé : actualise la partie.'; END IF;
 f:=c.fighters->c.turn_index;
 IF f->>'kind'='enemy' THEN
  IF NOT narr OR (f->>'id')::uuid<>p_enemy_id THEN RAISE EXCEPTION 'Ce mob ne peut pas agir à ce tour.'; END IF;
  SELECT * INTO e FROM public.game_enemies WHERE id=p_enemy_id AND game_id=p_game_id AND status<>'vaincu'; IF NOT FOUND THEN RAISE EXCEPTION 'Mob indisponible.'; END IF;
  IF p_action='move' THEN
   IF p_x IS NULL OR p_y IS NULL OR p_x<0 OR p_x>159 OR p_y<0 OR p_y>159 OR abs(p_x-e.tile_x)+abs(p_y-e.tile_y)<>1 THEN RAISE EXCEPTION 'Déplacement adjacent requis.'; END IF;
   UPDATE public.game_enemies SET tile_x=p_x,tile_y=p_y WHERE id=e.id;
   RETURN jsonb_build_object('ok',true,'moved',true);
  ELSIF p_action IN ('attack','ability') THEN
   IF p_action='ability' AND (e.ability='' OR p_effect NOT IN ('attaque','soin','protection')) THEN RAISE EXCEPTION 'Capacité indisponible.'; END IF;
   SELECT * INTO target_p FROM public.game_players WHERE id=p_target AND game_id=p_game_id AND role='adventurer' AND hp>0 AND current_zone=e.zone;
   IF (p_action='attack' OR p_effect='attaque') AND target_p.id IS NULL THEN RAISE EXCEPTION 'Choisis un aventurier présent.'; END IF;
   n:=CASE WHEN p_action='ability' AND p_effect IN ('soin','protection') THEN e.endurance ELSE e.strength END;
   FOR i IN 1..n LOOP r:=public.salon_d6(); rolls:=rolls||jsonb_build_array(r); IF r>=5 THEN successes:=successes+1; END IF; END LOOP;
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
   n:=greatest(1,least(5,round(actor_p.strength/20.0)::integer))+CASE WHEN actor_p.class='guerrier' THEN 1 ELSE 0 END;
   FOR i IN 1..n LOOP r:=public.salon_d6(); rolls:=rolls||jsonb_build_array(r); IF r>=5 THEN successes:=successes+1; END IF; END LOOP;
   damage:=CASE WHEN successes>0 THEN greatest(1,successes+CASE actor_p.class WHEN 'mage' THEN 2 ELSE 1 END-CASE WHEN e.ability ILIKE '%bouclier%' AND actor_p.class<>'mage' THEN 1 ELSE 0 END+CASE WHEN actor_p.class='voleur' AND successes>=2 THEN 2 ELSE 0 END) ELSE 0 END;
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
 END $function$;
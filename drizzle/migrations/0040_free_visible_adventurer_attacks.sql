DO $migration$
DECLARE definition text; branch text;
BEGIN
SELECT pg_get_functiondef(oid) INTO definition FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='salon_combat_action';
IF definition IS NULL OR position(' IF c.game_id IS NULL OR c.revision<>p_revision' IN definition)=0 THEN RAISE EXCEPTION 'Combat function signature changed'; END IF;
branch := $branch$
 IF p_action='attack' AND NOT narr THEN
  SELECT * INTO actor_p FROM public.game_players WHERE game_id=p_game_id AND user_id=auth.uid() AND role='adventurer' AND hp>0;
  IF NOT FOUND THEN RAISE EXCEPTION 'Aventurier indisponible.'; END IF;
  SELECT * INTO e FROM public.game_enemies WHERE id=p_enemy_id AND game_id=p_game_id AND status<>'vaincu' AND hp>0 AND zone=actor_p.current_zone AND public.adventurer_sees_cell(p_game_id,zone,tile_x,tile_y) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Aucun ennemi visible à attaquer ici.'; END IF;
  n:=greatest(1,least(5,round(actor_p.strength/20.0)::integer))+CASE WHEN actor_p.class='guerrier' THEN 1 ELSE 0 END;
  FOR i IN 1..n LOOP r:=public.salon_d6(); rolls:=rolls||jsonb_build_array(r); IF r>=5 THEN successes:=successes+1; END IF; END LOOP;
  damage:=CASE WHEN successes>0 THEN greatest(1,successes+CASE actor_p.class WHEN 'mage' THEN 2 ELSE 1 END-CASE WHEN e.ability ILIKE '%bouclier%' AND actor_p.class<>'mage' THEN 1 ELSE 0 END+CASE WHEN actor_p.class='voleur' AND successes>=2 THEN 2 ELSE 0 END) ELSE 0 END;
  UPDATE public.game_enemies SET hp=greatest(0,hp-damage),status=CASE WHEN hp-damage<=0 THEN 'vaincu' ELSE status END WHERE id=e.id;
  INSERT INTO public.game_events(game_id,actor_id,kind,message,payload,important) VALUES(p_game_id,auth.uid(),'jet',actor_p.display_name||' attaque '||e.name||' : '||damage||' dégâts.',jsonb_build_object('rolls',rolls,'successes',successes,'damage',damage,'enemyId',e.id),true);
  IF c.game_id IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM public.game_enemies WHERE game_id=p_game_id AND zone=c.zone AND status<>'vaincu' AND hp>0) THEN
    UPDATE public.game_combats SET active=false,revision=revision+1 WHERE game_id=p_game_id;
    UPDATE public.game_mob_control SET enemy_id=NULL WHERE game_id=p_game_id;
   ELSIF (c.fighters->c.turn_index)->>'id'=e.id::text AND e.hp-damage<=0 THEN
    FOR i IN 1..jsonb_array_length(c.fighters) LOOP
     c.turn_index:=(c.turn_index+1)%jsonb_array_length(c.fighters); IF c.turn_index=0 THEN c.round:=c.round+1; END IF;
     next_f:=c.fighters->c.turn_index;
     EXIT WHEN (next_f->>'kind'='player' AND EXISTS(SELECT 1 FROM public.game_players WHERE id=(next_f->>'id')::uuid AND game_id=p_game_id AND role='adventurer' AND hp>0)) OR (next_f->>'kind'='enemy' AND EXISTS(SELECT 1 FROM public.game_enemies WHERE id=(next_f->>'id')::uuid AND game_id=p_game_id AND status<>'vaincu' AND hp>0));
    END LOOP;
    UPDATE public.game_combats SET turn_index=c.turn_index,round=c.round,revision=revision+1 WHERE game_id=p_game_id;
    UPDATE public.game_mob_control SET enemy_id=CASE WHEN next_f->>'kind'='enemy' THEN (next_f->>'id')::uuid ELSE NULL END WHERE game_id=p_game_id;
   END IF;
  END IF;
  RETURN jsonb_build_object('ok',true,'rolls',rolls,'successes',successes,'damage',damage);
 END IF;
$branch$;
EXECUTE replace(definition,' IF c.game_id IS NULL OR c.revision<>p_revision',branch||' IF c.game_id IS NULL OR c.revision<>p_revision');
END $migration$;
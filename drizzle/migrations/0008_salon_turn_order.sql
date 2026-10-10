ALTER TABLE public.games ADD COLUMN IF NOT EXISTS turn_player_id uuid DEFAULT NULL, ADD COLUMN IF NOT EXISTS turn_round integer NOT NULL DEFAULT 1, ADD COLUMN IF NOT EXISTS turn_revision integer NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION public.end_salon_turn(p_game_id uuid, p_revision integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.games%ROWTYPE; ids uuid[]; active_id uuid; next_id uuid; idx integer; wrapped boolean; player_name text;
BEGIN
 SELECT * INTO g FROM public.games WHERE id=p_game_id FOR UPDATE;
 IF NOT FOUND OR NOT public.is_game_member(p_game_id) THEN RAISE EXCEPTION 'Tu n''es pas membre de ce salon.'; END IF;
 IF g.status <> 'playing' THEN RAISE EXCEPTION 'La partie n''est pas en cours.'; END IF;
 IF g.solo THEN RAISE EXCEPTION 'Les tours du mode solo sont automatiques.'; END IF;
 IF g.turn_revision <> p_revision THEN RAISE EXCEPTION 'Le tour a changé : réessaie.'; END IF;
 SELECT array_agg(id ORDER BY CASE WHEN role='narrator' THEN 1 ELSE 0 END, joined_at, id) INTO ids FROM public.game_players WHERE game_id=p_game_id AND (role='narrator' OR hp>0);
 IF coalesce(array_length(ids,1),0)=0 THEN RAISE EXCEPTION 'Aucun participant disponible.'; END IF;
 active_id := CASE WHEN g.turn_player_id = ANY(ids) THEN g.turn_player_id ELSE ids[1] END;
 IF NOT EXISTS(SELECT 1 FROM public.game_players WHERE id=active_id AND game_id=p_game_id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Ce n''est pas ton tour.'; END IF;
 idx := array_position(ids,active_id); wrapped := idx = array_length(ids,1); next_id := CASE WHEN wrapped THEN ids[1] ELSE ids[idx+1] END;
 UPDATE public.games SET turn_player_id=next_id,turn_round=turn_round+CASE WHEN wrapped THEN 1 ELSE 0 END,turn_revision=turn_revision+1 WHERE id=p_game_id;
 SELECT display_name INTO player_name FROM public.game_players WHERE id=next_id;
 INSERT INTO public.game_events(game_id,actor_id,kind,message,payload,important) VALUES(p_game_id,auth.uid(),'tour','À ' || player_name || ' de jouer.',jsonb_build_object('turn',g.turn_round+CASE WHEN wrapped THEN 1 ELSE 0 END,'player_id',next_id),true);
 RETURN jsonb_build_object('wrapped',wrapped,'round',g.turn_round+CASE WHEN wrapped THEN 1 ELSE 0 END);
END; $$;
REVOKE ALL ON FUNCTION public.end_salon_turn(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.end_salon_turn(uuid,integer) TO authenticated;

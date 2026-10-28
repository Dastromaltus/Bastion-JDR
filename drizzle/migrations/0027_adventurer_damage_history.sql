CREATE OR REPLACE FUNCTION public.record_adventurer_damage() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.role = 'adventurer' AND NEW.role = 'adventurer'
     AND NEW.hp < OLD.hp AND NEW.max_hp = OLD.max_hp
     AND EXISTS (SELECT 1 FROM public.games WHERE id = NEW.game_id AND status = 'playing') THEN
    INSERT INTO public.game_events(game_id, actor_id, kind, message, payload, important, secret)
    VALUES (NEW.game_id, auth.uid(), 'pv',
      NEW.display_name || ' perd ' || (OLD.hp - NEW.hp) || ' PV (' || NEW.hp || '/' || NEW.max_hp || ' PV restants).',
      jsonb_build_object('player_id', NEW.id, 'player_name', NEW.display_name, 'hp_before', OLD.hp, 'hp_after', NEW.hp, 'max_hp', NEW.max_hp, 'damage', OLD.hp - NEW.hp), true, false);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.record_adventurer_damage() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER record_adventurer_damage AFTER UPDATE OF hp ON public.game_players
FOR EACH ROW EXECUTE FUNCTION public.record_adventurer_damage();
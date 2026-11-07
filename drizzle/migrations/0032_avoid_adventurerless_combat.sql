DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.start_salon_combat(uuid,text)'::regprocedure) INTO definition;
 definition := replace(definition, 'IF roster IS NULL THEN RETURN; END IF;', 'IF roster IS NULL OR NOT EXISTS (SELECT 1 FROM public.game_players WHERE game_id=p_game_id AND role=''adventurer'' AND hp>0 AND current_zone=p_zone) THEN RETURN; END IF;');
 EXECUTE definition;
END $$;
DO $$ DECLARE definition text; BEGIN SELECT pg_get_functiondef('public.install_campaign_stage(uuid,integer)'::regprocedure) INTO definition; definition:=replace(definition,'''playing''','''lecture'''); EXECUTE definition; END $$;
CREATE OR REPLACE FUNCTION public.salon_d6() RETURNS integer LANGUAGE plpgsql VOLATILE SET search_path=public AS $$ DECLARE r integer; BEGIN LOOP r:=get_byte(gen_random_bytes(1),0); EXIT WHEN r<252; END LOOP; RETURN 1+r%6; END $$;
REVOKE ALL ON FUNCTION public.salon_d6() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE definition text; BEGIN SELECT pg_get_functiondef('public.salon_combat_action(uuid,integer,text,uuid,uuid,integer,integer,text)'::regprocedure) INTO definition;
 definition:=replace(definition,'1+(get_byte(gen_random_bytes(1),0)%6)','public.salon_d6()');
 definition:=replace(definition,'IF p_action=''control'' THEN','IF p_action=''control'' THEN');
 definition:=replace(definition,'INSERT INTO public.game_mob_control(game_id,enemy_id) VALUES(p_game_id,p_enemy_id)', 'IF c.game_id IS NULL THEN PERFORM public.start_salon_combat(p_game_id,e.zone); END IF; INSERT INTO public.game_mob_control(game_id,enemy_id) VALUES(p_game_id,p_enemy_id)');
 EXECUTE definition; END $$;
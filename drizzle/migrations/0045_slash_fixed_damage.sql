DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.salon_combat_action(uuid,integer,text,uuid,uuid,integer,integer,text)'::regprocedure) INTO definition;
 IF position('IF p_action=''attack'' AND NOT narr THEN' in definition)=0 THEN RAISE EXCEPTION 'Expected adventurer attack branch not found'; END IF;
 definition:=replace(definition,'IF p_action=''attack'' AND NOT narr THEN','IF p_action IN (''attack'',''slash'') AND NOT narr THEN');
 definition:=replace(definition,'n:=greatest(1,least(5,round(actor_p.strength/20.0)::integer))+CASE WHEN actor_p.class=''guerrier'' THEN 1 ELSE 0 END;','IF p_action=''slash'' THEN damage:=2; ELSE n:=greatest(1,least(5,round(actor_p.strength/20.0)::integer))+CASE WHEN actor_p.class=''guerrier'' THEN 1 ELSE 0 END;');
 definition:=replace(definition,'ELSE 0 END;'||chr(10)||'  UPDATE public.game_enemies','ELSE 0 END; END IF;'||chr(10)||'  UPDATE public.game_enemies');
 -- The second (legacy turn-bound) attack branch keeps its original behavior.
 definition:=replace(definition,'ELSE 0 END;'||chr(10)||'   UPDATE public.game_enemies','ELSE 0 END; END IF;'||chr(10)||'   UPDATE public.game_enemies');
 definition:=replace(definition,'jsonb_build_object(''rolls'',rolls,''successes'',successes,''damage'',damage,''enemyId'',e.id)','jsonb_build_object(''rolls'',rolls,''successes'',successes,''damage'',damage,''enemyId'',e.id,''effect'',CASE WHEN p_action=''slash'' THEN ''slash'' ELSE ''attack'' END)');
 definition:=replace(definition,'actor_p.display_name||'' attaque ''||e.name||'' : ''||damage','actor_p.display_name||CASE WHEN p_action=''slash'' THEN '' utilise Slash sur '' ELSE '' attaque '' END||e.name||'' : ''||damage');
 IF position('IF p_action=''slash'' THEN damage:=2;' in definition)=0 OR position('''effect'',CASE WHEN p_action=''slash''' in definition)=0 THEN RAISE EXCEPTION 'Slash integration failed'; END IF;
 EXECUTE definition;
END $migration$;
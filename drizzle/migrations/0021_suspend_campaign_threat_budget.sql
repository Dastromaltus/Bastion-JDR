DO $migration$
DECLARE definition text; original text;
BEGIN
 original := pg_get_functiondef('public.save_private_campaign(jsonb,boolean)'::regprocedure);
 definition := replace(original, 'IF p_publish AND used>budget THEN RAISE EXCEPTION ''Budget dépassé : % / %.'',used,budget; END IF;', '-- Threat budget temporarily suspended; ownership, stats and map validation preserved.');
 IF definition = original THEN RAISE EXCEPTION 'Publication budget guard not found'; END IF;
 EXECUTE definition;
 original := pg_get_functiondef('public.load_private_campaign(uuid,uuid)'::regprocedure);
 definition := replace(original, 'IF used>budget THEN RAISE EXCEPTION ''Budget dépassé dans une étape : % / % ; ajoute des aventuriers ou retire des mobs.'',used,budget; END IF;', '-- Threat budget temporarily suspended; owner and narrator checks preserved.');
 IF definition = original THEN RAISE EXCEPTION 'Loading budget guard not found'; END IF;
 EXECUTE definition;
END $migration$;
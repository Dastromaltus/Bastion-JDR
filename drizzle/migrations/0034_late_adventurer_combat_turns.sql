CREATE OR REPLACE FUNCTION public.include_joining_combatant() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c public.game_combats%ROWTYPE; current_id text; roster jsonb; idx integer; BEGIN
 IF NEW.role<>'adventurer' OR NEW.hp<=0 THEN RETURN NEW; END IF;
 SELECT * INTO c FROM public.game_combats WHERE game_id=NEW.game_id AND active AND zone=NEW.current_zone FOR UPDATE;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM jsonb_array_elements(c.fighters) f WHERE f->>'id'=NEW.id::text) THEN RETURN NEW; END IF;
 current_id:=c.fighters->c.turn_index->>'id';
 SELECT jsonb_agg(f ORDER BY (f->>'speed')::integer DESC,f->>'kind',f->>'id') INTO roster FROM jsonb_array_elements(c.fighters||jsonb_build_array(jsonb_build_object('id',NEW.id,'kind','player','name',NEW.display_name,'user_id',NEW.user_id,'speed',greatest(1,least(5,round(NEW.speed/20.0)::integer))))) f;
 SELECT ordinality-1 INTO idx FROM jsonb_array_elements(roster) WITH ORDINALITY WHERE value->>'id'=current_id;
 UPDATE public.game_combats SET fighters=roster,turn_index=coalesce(idx,0),revision=revision+1 WHERE game_id=NEW.game_id;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.include_joining_combatant() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER include_joining_combatant AFTER INSERT OR UPDATE OF current_zone ON public.game_players FOR EACH ROW EXECUTE FUNCTION public.include_joining_combatant();
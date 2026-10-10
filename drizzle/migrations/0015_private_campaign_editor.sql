ALTER TABLE public.dungeon_templates ADD COLUMN default_track text NOT NULL DEFAULT 'forteresse';
UPDATE public.dungeon_templates SET default_track=CASE WHEN slug='salle-des-machines' THEN 'couloirs' WHEN slug='le-reliquaire' THEN 'laboratoire' WHEN slug='coeur-du-bastion' THEN 'boss' ELSE 'forteresse' END;
CREATE TABLE public.campaigns (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, name text NOT NULL DEFAULT 'Nouvelle campagne', summary text NOT NULL DEFAULT '', difficulty text NOT NULL DEFAULT 'initiation' CHECK(difficulty IN ('initiation','moyenne','difficile')), recommended_players integer NOT NULL DEFAULT 3 CHECK(recommended_players BETWEEN 3 AND 5), status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')), is_template boolean NOT NULL DEFAULT false, revision integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,DELETE ON public.campaigns TO authenticated; GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Campaign creator reads" ON public.campaigns FOR SELECT TO authenticated USING(owner_id=auth.uid()); CREATE POLICY "Campaign creator deletes" ON public.campaigns FOR DELETE TO authenticated USING(owner_id=auth.uid());
CREATE TABLE public.campaign_stages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE, template_id uuid NOT NULL REFERENCES public.dungeon_templates(id), position integer NOT NULL DEFAULT 0, objective text NOT NULL DEFAULT '', objective_room text NOT NULL, exit_room text NOT NULL, intro_text text NOT NULL DEFAULT '', track text NOT NULL DEFAULT 'forteresse');
GRANT SELECT ON public.campaign_stages TO authenticated; GRANT ALL ON public.campaign_stages TO service_role;
ALTER TABLE public.campaign_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creator reads stages" ON public.campaign_stages FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.campaigns c WHERE c.id=campaign_id AND c.owner_id=auth.uid()));
CREATE TABLE public.campaign_placements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), stage_id uuid NOT NULL REFERENCES public.campaign_stages(id) ON DELETE CASCADE, room_key text NOT NULL, kind text NOT NULL CHECK(kind IN ('mob','treasure')), catalog_id uuid NOT NULL, hidden boolean NOT NULL DEFAULT true, trigger text NOT NULL DEFAULT 'entree' CHECK(trigger IN ('entree','porte','manuel')), tile_x integer NOT NULL DEFAULT 16 CHECK(tile_x BETWEEN 0 AND 24), tile_y integer NOT NULL DEFAULT 9 CHECK(tile_y BETWEEN 0 AND 16), overrides jsonb NOT NULL DEFAULT '{}');
GRANT SELECT ON public.campaign_placements TO authenticated; GRANT ALL ON public.campaign_placements TO service_role;
ALTER TABLE public.campaign_placements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creator reads placements" ON public.campaign_placements FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.campaign_stages s JOIN public.campaigns c ON c.id=s.campaign_id WHERE s.id=stage_id AND c.owner_id=auth.uid()));
CREATE TABLE public.game_campaigns (game_id uuid PRIMARY KEY REFERENCES public.games(id) ON DELETE CASCADE, snapshot jsonb NOT NULL, stage_index integer NOT NULL DEFAULT 0, is_test boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.game_campaigns TO authenticated; GRANT ALL ON public.game_campaigns TO service_role;
ALTER TABLE public.game_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Narrator reads campaign copy" ON public.game_campaigns FOR SELECT TO authenticated USING(public.is_game_narrator(game_id));
CREATE OR REPLACE FUNCTION public.save_private_campaign(p_document jsonb,p_publish boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE cid uuid; existing public.campaigns%ROWTYPE; s jsonb; p jsonb; sid uuid; tid uuid; used integer; budget integer; reachable text[]; keys text[]; previous_count integer; room_record record; stat_value integer; BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.game_players WHERE user_id=auth.uid() AND role='narrator') THEN RAISE EXCEPTION 'Un salon dont tu es narrateur est nécessaire.'; END IF;
 cid:=nullif(p_document->>'id','')::uuid;
 IF cid IS NOT NULL THEN SELECT * INTO existing FROM public.campaigns WHERE id=cid FOR UPDATE; IF NOT FOUND OR existing.owner_id<>auth.uid() THEN RAISE EXCEPTION 'Campagne inaccessible.'; END IF; IF existing.revision<>coalesce((p_document->>'revision')::integer,0) THEN RAISE EXCEPTION 'Cette campagne a changé dans une autre fenêtre. Recharge-la.'; END IF; ELSE cid:=gen_random_uuid(); END IF;
 IF length(coalesce(p_document->>'name','')) NOT BETWEEN 1 AND 80 OR length(coalesce(p_document->>'summary',''))>2000 THEN RAISE EXCEPTION 'Nom ou résumé invalide.'; END IF;
 IF coalesce(jsonb_array_length(p_document->'stages'),0)>20 THEN RAISE EXCEPTION 'Maximum 20 étapes.'; END IF;
 IF p_publish AND coalesce(jsonb_array_length(p_document->'stages'),0)=0 THEN RAISE EXCEPTION 'Ajoute au moins une étape.'; END IF;
 budget:=coalesce((p_document->>'recommended_players')::integer,3)*3;
 INSERT INTO public.campaigns(id,owner_id,name,summary,difficulty,recommended_players,status,is_template,revision) VALUES(cid,auth.uid(),p_document->>'name',coalesce(p_document->>'summary',''),coalesce(p_document->>'difficulty','initiation'),coalesce((p_document->>'recommended_players')::integer,3),CASE WHEN p_publish THEN 'published' ELSE 'draft' END,coalesce((p_document->>'is_template')::boolean,false),coalesce(existing.revision,0)+1) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,summary=EXCLUDED.summary,difficulty=EXCLUDED.difficulty,recommended_players=EXCLUDED.recommended_players,status=EXCLUDED.status,is_template=EXCLUDED.is_template,revision=EXCLUDED.revision,updated_at=now();
 DELETE FROM public.campaign_stages WHERE campaign_id=cid;
 FOR s IN SELECT value FROM jsonb_array_elements(coalesce(p_document->'stages','[]')) LOOP
 tid:=(s->>'template_id')::uuid; SELECT array_agg(key ORDER BY position) INTO keys FROM public.dungeon_rooms WHERE template_id=tid;
 IF keys IS NULL THEN RAISE EXCEPTION 'Map introuvable.'; END IF;
 IF NOT (s->>'objective_room'=ANY(keys)) OR NOT(s->>'exit_room'=ANY(keys)) THEN RAISE EXCEPTION 'Salle d’objectif ou sortie inconnue.'; END IF;
 reachable:=ARRAY[keys[1]];
 LOOP previous_count:=cardinality(reachable); FOR room_record IN SELECT key,connections FROM public.dungeon_rooms WHERE template_id=tid AND key=ANY(reachable) LOOP reachable:=ARRAY(SELECT DISTINCT unnest(reachable||room_record.connections)); END LOOP; EXIT WHEN cardinality(reachable)=previous_count; END LOOP;
 IF p_publish AND (NOT keys<@reachable OR NOT (s->>'objective_room'=ANY(reachable)) OR NOT(s->>'exit_room'=ANY(reachable)) OR length(trim(coalesce(s->>'objective','')))=0) THEN RAISE EXCEPTION 'Salle inaccessible, objectif manquant ou sortie impossible.'; END IF;
 IF coalesce(s->>'track','forteresse') NOT IN ('forteresse','alerte','couloirs','laboratoire','combat','boss','victoire','defaite','silence') THEN RAISE EXCEPTION 'Piste inconnue.'; END IF;
 sid:=gen_random_uuid(); INSERT INTO public.campaign_stages(id,campaign_id,template_id,position,objective,objective_room,exit_room,intro_text,track) VALUES(sid,cid,tid,coalesce((s->>'position')::integer,0),coalesce(s->>'objective',''),s->>'objective_room',s->>'exit_room',coalesce(s->>'intro_text',''),coalesce(s->>'track','forteresse'));
 used:=0;
 FOR p IN SELECT value FROM jsonb_array_elements(coalesce(s->'placements','[]')) LOOP
 IF NOT(p->>'room_key'=ANY(keys)) THEN RAISE EXCEPTION 'Salle de placement inconnue.'; END IF;
 IF p->>'kind'='mob' THEN
 IF NOT EXISTS(SELECT 1 FROM public.enemy_catalog WHERE id=(p->>'catalog_id')::uuid AND (game_id IS NULL OR created_by=auth.uid())) THEN RAISE EXCEPTION 'Mob inaccessible.'; END IF;
 SELECT threat_cost INTO stat_value FROM public.enemy_catalog WHERE id=(p->>'catalog_id')::uuid; used:=used+stat_value;
 FOR room_record IN SELECT speed,strength,endurance FROM public.enemy_catalog WHERE id=(p->>'catalog_id')::uuid LOOP
 IF coalesce((p->'overrides'->>'speed')::integer,room_record.speed) NOT BETWEEN 1 AND 5 OR coalesce((p->'overrides'->>'strength')::integer,room_record.strength) NOT BETWEEN 1 AND 5 OR coalesce((p->'overrides'->>'endurance')::integer,room_record.endurance) NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Les stats vont de 1 à 5.'; END IF; END LOOP;
 ELSE IF NOT EXISTS(SELECT 1 FROM public.treasure_catalog WHERE id=(p->>'catalog_id')::uuid AND (game_id IS NULL OR created_by=auth.uid())) THEN RAISE EXCEPTION 'Trésor inaccessible.'; END IF; END IF;
 INSERT INTO public.campaign_placements(stage_id,room_key,kind,catalog_id,hidden,trigger,tile_x,tile_y,overrides) VALUES(sid,p->>'room_key',p->>'kind',(p->>'catalog_id')::uuid,coalesce((p->>'hidden')::boolean,true),coalesce(p->>'trigger','entree'),coalesce((p->>'tile_x')::integer,16),coalesce((p->>'tile_y')::integer,9),coalesce(p->'overrides','{}'));
 END LOOP;
 IF p_publish AND used>budget THEN RAISE EXCEPTION 'Budget dépassé : % / %.',used,budget; END IF;
 END LOOP;
 RETURN jsonb_build_object('id',cid,'revision',coalesce(existing.revision,0)+1,'status',CASE WHEN p_publish THEN 'published' ELSE 'draft' END); END $$;
REVOKE ALL ON FUNCTION public.save_private_campaign(jsonb,boolean) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.save_private_campaign(jsonb,boolean) TO authenticated;
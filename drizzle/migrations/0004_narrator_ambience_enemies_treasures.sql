ALTER TABLE public.game_players ADD COLUMN IF NOT EXISTS current_zone text NOT NULL DEFAULT 'entree';
COMMENT ON TABLE public.game_hidden_enemies IS 'DEPRECATED: replaced by game_enemies';

-- Secret journal entries (placements) visible to the narrator only
ALTER TABLE public.game_events ADD COLUMN IF NOT EXISTS secret boolean NOT NULL DEFAULT false;
DROP POLICY IF EXISTS "Members read events" ON public.game_events;
CREATE POLICY "Members read events" ON public.game_events FOR SELECT TO authenticated
  USING (public.is_game_member(game_id) AND (NOT secret OR public.is_game_narrator(game_id)));

-- Ambience
CREATE TABLE public.game_ambience (
  game_id uuid PRIMARY KEY REFERENCES public.games(id) ON DELETE CASCADE,
  track text NOT NULL DEFAULT 'silence' CHECK (track IN ('silence','forteresse','alerte','couloirs','laboratoire','combat','boss','victoire','defaite')),
  state text NOT NULL DEFAULT 'arret' CHECK (state IN ('lecture','pause','arret')),
  volume integer NOT NULL DEFAULT 70 CHECK (volume BETWEEN 0 AND 100),
  loop boolean NOT NULL DEFAULT true,
  sfx text CHECK (sfx IS NULL OR sfx IN ('porte','alarme','laser','explosion','coffre')),
  sfx_at timestamptz,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.game_ambience TO authenticated;
GRANT ALL ON public.game_ambience TO service_role;
ALTER TABLE public.game_ambience ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read ambience" ON public.game_ambience FOR SELECT TO authenticated USING (public.is_game_member(game_id));
CREATE POLICY "Narrator creates ambience" ON public.game_ambience FOR INSERT TO authenticated WITH CHECK (public.is_game_narrator(game_id) AND updated_by = auth.uid());
CREATE POLICY "Narrator updates ambience" ON public.game_ambience FOR UPDATE TO authenticated USING (public.is_game_narrator(game_id)) WITH CHECK (public.is_game_narrator(game_id) AND updated_by = auth.uid());

-- Enemy catalog (game_id NULL = base catalog, otherwise custom for one salon)
CREATE TABLE public.enemy_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES public.games(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  category text NOT NULL CHECK (char_length(category) BETWEEN 1 AND 40),
  description text NOT NULL DEFAULT '',
  speed smallint NOT NULL CHECK (speed BETWEEN 1 AND 5),
  strength smallint NOT NULL CHECK (strength BETWEEN 1 AND 5),
  endurance smallint NOT NULL CHECK (endurance BETWEEN 1 AND 5),
  hp integer GENERATED ALWAYS AS (10 + 2 * endurance) STORED,
  ability text NOT NULL DEFAULT '',
  threat_cost smallint NOT NULL CHECK (threat_cost BETWEEN 1 AND 5),
  icon text NOT NULL DEFAULT '☠',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.enemy_catalog TO authenticated;
GRANT ALL ON public.enemy_catalog TO service_role;
ALTER TABLE public.enemy_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Narrators read enemy catalog" ON public.enemy_catalog FOR SELECT TO authenticated
  USING ((game_id IS NULL AND EXISTS (SELECT 1 FROM public.game_players gp WHERE gp.user_id = auth.uid() AND gp.role = 'narrator')) OR public.is_game_narrator(game_id));

CREATE TABLE public.treasure_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES public.games(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  type text NOT NULL CHECK (type IN ('consommable','equipement','arme','cle','quete')),
  rarity text NOT NULL CHECK (rarity IN ('commun','rare','epique','legendaire')),
  description text NOT NULL DEFAULT '',
  effect text NOT NULL DEFAULT '',
  value integer NOT NULL DEFAULT 0 CHECK (value BETWEEN 0 AND 100000),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.treasure_catalog TO authenticated;
GRANT ALL ON public.treasure_catalog TO service_role;
ALTER TABLE public.treasure_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Narrators read treasure catalog" ON public.treasure_catalog FOR SELECT TO authenticated
  USING ((game_id IS NULL AND EXISTS (SELECT 1 FROM public.game_players gp WHERE gp.user_id = auth.uid() AND gp.role = 'narrator')) OR public.is_game_narrator(game_id));

-- Placed enemies
CREATE TABLE public.game_enemies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  catalog_id uuid REFERENCES public.enemy_catalog(id) ON DELETE SET NULL,
  name text NOT NULL,
  category text NOT NULL,
  icon text NOT NULL DEFAULT '☠',
  ability text NOT NULL DEFAULT '',
  speed smallint NOT NULL CHECK (speed BETWEEN 1 AND 5),
  strength smallint NOT NULL CHECK (strength BETWEEN 1 AND 5),
  endurance smallint NOT NULL CHECK (endurance BETWEEN 1 AND 5),
  hp integer NOT NULL,
  max_hp integer NOT NULL,
  threat_cost smallint NOT NULL CHECK (threat_cost BETWEEN 1 AND 5),
  zone text NOT NULL,
  trigger text NOT NULL DEFAULT 'entree' CHECK (trigger IN ('entree','porte','manuel')),
  status text NOT NULL DEFAULT 'cache' CHECK (status IN ('cache','revele','vaincu')),
  created_at timestamptz NOT NULL DEFAULT now(),
  revealed_at timestamptz
);
CREATE INDEX game_enemies_game_idx ON public.game_enemies(game_id);
GRANT SELECT ON public.game_enemies TO authenticated;
GRANT ALL ON public.game_enemies TO service_role;
ALTER TABLE public.game_enemies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Narrator reads all enemies, members read revealed" ON public.game_enemies FOR SELECT TO authenticated
  USING (public.is_game_narrator(game_id) OR (status <> 'cache' AND public.is_game_member(game_id)));

-- Placed treasures
CREATE TABLE public.game_treasures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  catalog_id uuid REFERENCES public.treasure_catalog(id) ON DELETE SET NULL,
  name text NOT NULL,
  type text NOT NULL,
  rarity text NOT NULL,
  effect text NOT NULL DEFAULT '',
  value integer NOT NULL DEFAULT 0,
  placement text NOT NULL CHECK (placement IN ('zone','coffre','ennemi','direct')),
  zone text,
  enemy_id uuid REFERENCES public.game_enemies(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'cache' CHECK (status IN ('cache','decouvert')),
  found_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  found_at timestamptz
);
CREATE INDEX game_treasures_game_idx ON public.game_treasures(game_id);
GRANT SELECT ON public.game_treasures TO authenticated;
GRANT ALL ON public.game_treasures TO service_role;
ALTER TABLE public.game_treasures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Narrator reads all treasures, members read discovered" ON public.game_treasures FOR SELECT TO authenticated
  USING (public.is_game_narrator(game_id) OR (status = 'decouvert' AND public.is_game_member(game_id)));

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_ambience, public.game_enemies, public.game_treasures;

INSERT INTO public.enemy_catalog (name, category, description, speed, strength, endurance, ability, threat_cost, icon) VALUES
('Drone de patrouille','robot','Petit drone volant qui quadrille les couloirs.',4,1,1,'Alerte les autres ennemis',1,'◉'),
('Rôdeur mutant','créature','Chair tordue par les rejets toxiques du Bastion.',3,3,2,'Saignement',2,'☣'),
('Sentinelle blindée','robot','Gardien lourd, lent mais presque indestructible.',1,4,4,'Bouclier : réduit les dégâts de 1',3,'▣'),
('Essaim nanotech','nanomachines','Nuage de nanomachines voraces.',5,1,1,'Attaque plusieurs cibles',2,'⁘'),
('Cyborg déserteur','humanoïde','Ancien soldat greffé, armé d''un fusil.',3,3,3,'Tir à distance',3,'✚'),
('Xénomorphe','alien','Prédateur venu d''ailleurs, tapi dans les conduits.',4,4,2,'Embuscade : bonus de dégâts s''il est caché',3,'✶'),
('IA corrompue','intelligence artificielle','Conscience déréglée qui contrôle les systèmes.',2,2,3,'Verrouille portes et compétences',3,'◈'),
('Mécha-colosse','boss','Machine de guerre colossale, cœur du Bastion.',1,5,5,'Onde de choc',5,'⬢');

INSERT INTO public.treasure_catalog (name, type, rarity, description, effect, value) VALUES
('Kit de soins','consommable','commun','Trousse de premiers secours militaire.','Rend 5 PV',20),
('Cellule d''énergie','consommable','commun','Batterie compacte.','Recharge une compétence',25),
('Carte d''accès rouge','cle','rare','Badge magnétique du personnel de sécurité.','Ouvre une porte scellée',60),
('Module de camouflage','consommable','rare','Brouilleur optique portatif.','+1 aux actions d''embuscade pour 3 tours',80),
('Armure composite','equipement','epique','Plaques céramiques renforcées.','+1 Endurance tant qu''elle est équipée',150),
('Fusil à plasma','arme','epique','Arme à énergie de dernière génération.','+2 dégâts à distance',200),
('Noyau du Bastion','quete','legendaire','Le cœur énergétique de la forteresse.','Objet de quête',1000);
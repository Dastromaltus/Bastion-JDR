ALTER TABLE public.games DROP CONSTRAINT games_max_players_check;
ALTER TABLE public.games ADD CONSTRAINT games_max_players_check CHECK (max_players BETWEEN 1 AND 5);
ALTER TABLE public.games ADD COLUMN solo boolean NOT NULL DEFAULT false;
ALTER TABLE public.game_enemies ADD COLUMN overheated boolean NOT NULL DEFAULT false;

CREATE TABLE public.dungeon_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  position smallint NOT NULL DEFAULT 1,
  name text NOT NULL,
  summary text NOT NULL,
  story text NOT NULL,
  duration smallint NOT NULL CHECK (duration IN (30,60,90)),
  difficulty text NOT NULL CHECK (difficulty IN ('initiation','moyenne','difficile')),
  difficulty_label text NOT NULL DEFAULT '',
  map_type text NOT NULL CHECK (map_type IN ('lineaire','boucle','etoile')),
  objective_type text NOT NULL CHECK (objective_type IN ('sortie','survie','objet','boss')),
  objective_text text NOT NULL,
  target_turns smallint NOT NULL DEFAULT 10,
  tension_thresholds smallint[] NOT NULL DEFAULT '{3,6,9}',
  mechanic text NOT NULL DEFAULT '',
  fixed_treasure text NOT NULL DEFAULT '',
  random_treasure text NOT NULL DEFAULT '',
  solo boolean NOT NULL DEFAULT false,
  map_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dungeon_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.dungeon_templates(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  position smallint NOT NULL,
  connections text[] NOT NULL DEFAULT '{}',
  description text NOT NULL DEFAULT '',
  hazard_kind text CHECK (hazard_kind IN ('piege','verrou')),
  hazard text,
  lore text NOT NULL DEFAULT '',
  is_rest boolean NOT NULL DEFAULT false,
  grid_x smallint NOT NULL DEFAULT 0,
  grid_y smallint NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]',
  UNIQUE (template_id, key)
);
CREATE TABLE public.dungeon_room_enemies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.dungeon_rooms(id) ON DELETE CASCADE,
  enemy_catalog_id uuid NOT NULL REFERENCES public.enemy_catalog(id),
  hidden boolean NOT NULL DEFAULT true,
  trigger text NOT NULL DEFAULT 'entree' CHECK (trigger IN ('entree','porte','manuel'))
);
CREATE TABLE public.dungeon_room_treasures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.dungeon_rooms(id) ON DELETE CASCADE,
  treasure_catalog_id uuid NOT NULL REFERENCES public.treasure_catalog(id),
  container text NOT NULL DEFAULT 'coffre' CHECK (container IN ('coffre','sol','ennemi')),
  per_player boolean NOT NULL DEFAULT false
);
CREATE TABLE public.dungeon_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.dungeon_templates(id) ON DELETE CASCADE,
  threshold smallint NOT NULL CHECK (threshold BETWEEN 1 AND 20),
  effect text NOT NULL CHECK (effect IN ('renforts','alarme','effondrement','panne')),
  text text NOT NULL
);
CREATE TABLE public.game_dungeons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL UNIQUE REFERENCES public.games(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.dungeon_templates(id),
  status text NOT NULL DEFAULT 'preparation' CHECK (status IN ('preparation','en_cours','termine')),
  tension smallint NOT NULL DEFAULT 0 CHECK (tension BETWEEN 0 AND 20),
  current_room text NOT NULL,
  current_turn smallint NOT NULL DEFAULT 1,
  explored text[] NOT NULL DEFAULT '{}',
  core_taken boolean NOT NULL DEFAULT false,
  door_locked boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.game_dungeon_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  threshold smallint NOT NULL,
  effect text NOT NULL,
  text text NOT NULL,
  status text NOT NULL DEFAULT 'a_venir' CHECK (status IN ('a_venir','declenche')),
  triggered_at timestamptz
);
CREATE INDEX ON public.dungeon_rooms(template_id);
CREATE INDEX ON public.game_dungeon_events(game_id);

GRANT SELECT ON public.dungeon_templates, public.dungeon_rooms, public.dungeon_room_enemies, public.dungeon_room_treasures, public.dungeon_events, public.game_dungeons, public.game_dungeon_events TO authenticated;
GRANT ALL ON public.dungeon_templates, public.dungeon_rooms, public.dungeon_room_enemies, public.dungeon_room_treasures, public.dungeon_events, public.game_dungeons, public.game_dungeon_events TO service_role;

ALTER TABLE public.dungeon_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dungeon_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dungeon_room_enemies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dungeon_room_treasures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dungeon_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_dungeons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_dungeon_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users read templates" ON public.dungeon_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users read template rooms" ON public.dungeon_rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users read template enemies" ON public.dungeon_room_enemies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users read template treasures" ON public.dungeon_room_treasures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users read template events" ON public.dungeon_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members read salon dungeon" ON public.game_dungeons FOR SELECT TO authenticated USING (public.is_game_member(game_id));
CREATE POLICY "Narrator reads pending events, members read triggered" ON public.game_dungeon_events FOR SELECT TO authenticated USING (public.is_game_narrator(game_id) OR (status = 'declenche' AND public.is_game_member(game_id)));

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_dungeons;
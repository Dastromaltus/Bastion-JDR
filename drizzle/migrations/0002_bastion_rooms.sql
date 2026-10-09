CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{6}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  max_players integer NOT NULL CHECK (max_players BETWEEN 3 AND 5),
  scenario text NOT NULL,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','playing','finished')),
  locked boolean NOT NULL DEFAULT false,
  has_password boolean NOT NULL DEFAULT false,
  result text CHECK (result IN ('victoire','defaite')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz
);
CREATE TABLE public.game_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'adventurer' CHECK (role IN ('narrator','adventurer')),
  race text NOT NULL DEFAULT 'Humain',
  speed integer NOT NULL DEFAULT 70,
  strength integer NOT NULL DEFAULT 70,
  endurance integer NOT NULL DEFAULT 70,
  hp integer NOT NULL DEFAULT 17,
  max_hp integer NOT NULL DEFAULT 17,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, user_id)
);
CREATE INDEX game_players_user_idx ON public.game_players(user_id);
CREATE TABLE public.game_secrets (
  game_id uuid PRIMARY KEY REFERENCES public.games(id) ON DELETE CASCADE,
  password_hash text NOT NULL
);
CREATE TABLE public.narrator_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.game_hidden_enemies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  label text NOT NULL,
  hp integer NOT NULL DEFAULT 10,
  notes text NOT NULL DEFAULT '',
  revealed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.game_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  actor_id uuid,
  kind text NOT NULL,
  message text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  important boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX game_events_game_idx ON public.game_events(game_id, created_at);
CREATE TABLE public.game_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  author_name text NOT NULL,
  recipient_id uuid,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.game_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('arme','consommable','cle')),
  effect text NOT NULL DEFAULT '',
  rarity text NOT NULL DEFAULT 'commun' CHECK (rarity IN ('commun','rare','epique','legendaire')),
  equipped boolean NOT NULL DEFAULT false,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.player_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  reported_id uuid NOT NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.games, public.game_players, public.game_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.narrator_notes, public.game_hidden_enemies TO authenticated;
GRANT SELECT, INSERT ON public.game_messages TO authenticated;
GRANT SELECT, DELETE ON public.game_inventory TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_settings TO authenticated;
GRANT SELECT, INSERT ON public.player_reports TO authenticated;
GRANT ALL ON public.games, public.game_players, public.game_secrets, public.narrator_notes, public.game_hidden_enemies, public.game_events, public.game_messages, public.game_inventory, public.user_settings, public.player_reports TO service_role;

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.narrator_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_hidden_enemies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_reports ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_game_member(_game_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.game_players WHERE game_id = _game_id AND user_id = auth.uid())
$$;
CREATE OR REPLACE FUNCTION public.is_game_narrator(_game_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.game_players WHERE game_id = _game_id AND user_id = auth.uid() AND role = 'narrator')
$$;
REVOKE ALL ON FUNCTION public.is_game_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_game_narrator(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_game_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_game_narrator(uuid) TO authenticated, service_role;

CREATE POLICY "Members read their games" ON public.games FOR SELECT TO authenticated USING (public.is_game_member(id));
CREATE POLICY "Members read roster" ON public.game_players FOR SELECT TO authenticated USING (public.is_game_member(game_id));
CREATE POLICY "Narrator reads notes" ON public.narrator_notes FOR SELECT TO authenticated USING (public.is_game_narrator(game_id));
CREATE POLICY "Narrator writes notes" ON public.narrator_notes FOR INSERT TO authenticated WITH CHECK (public.is_game_narrator(game_id) AND author_id = auth.uid());
CREATE POLICY "Narrator updates notes" ON public.narrator_notes FOR UPDATE TO authenticated USING (public.is_game_narrator(game_id)) WITH CHECK (public.is_game_narrator(game_id));
CREATE POLICY "Narrator deletes notes" ON public.narrator_notes FOR DELETE TO authenticated USING (public.is_game_narrator(game_id));
CREATE POLICY "Narrator reads hidden enemies" ON public.game_hidden_enemies FOR SELECT TO authenticated USING (public.is_game_narrator(game_id));
CREATE POLICY "Narrator adds hidden enemies" ON public.game_hidden_enemies FOR INSERT TO authenticated WITH CHECK (public.is_game_narrator(game_id));
CREATE POLICY "Narrator updates hidden enemies" ON public.game_hidden_enemies FOR UPDATE TO authenticated USING (public.is_game_narrator(game_id)) WITH CHECK (public.is_game_narrator(game_id));
CREATE POLICY "Narrator deletes hidden enemies" ON public.game_hidden_enemies FOR DELETE TO authenticated USING (public.is_game_narrator(game_id));
CREATE POLICY "Members read events" ON public.game_events FOR SELECT TO authenticated USING (public.is_game_member(game_id));
CREATE POLICY "Members read visible messages" ON public.game_messages FOR SELECT TO authenticated USING (public.is_game_member(game_id) AND (recipient_id IS NULL OR recipient_id = auth.uid() OR user_id = auth.uid()));
CREATE POLICY "Members send messages" ON public.game_messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_game_member(game_id) AND (recipient_id IS NULL OR EXISTS (SELECT 1 FROM public.game_players gp WHERE gp.game_id = game_messages.game_id AND gp.user_id = game_messages.recipient_id)));
CREATE POLICY "Owner or narrator reads inventory" ON public.game_inventory FOR SELECT TO authenticated USING ((owner_id = auth.uid() AND public.is_game_member(game_id)) OR public.is_game_narrator(game_id));
CREATE POLICY "Owner or narrator removes items" ON public.game_inventory FOR DELETE TO authenticated USING ((owner_id = auth.uid() AND public.is_game_member(game_id)) OR public.is_game_narrator(game_id));
CREATE POLICY "Own settings read" ON public.user_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own settings insert" ON public.user_settings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own settings update" ON public.user_settings FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Members file reports" ON public.player_reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid() AND public.is_game_member(game_id));
CREATE POLICY "Reporter reads own reports" ON public.player_reports FOR SELECT TO authenticated USING (reporter_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.games, public.game_players, public.game_events, public.game_messages, public.game_inventory;
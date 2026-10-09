CREATE TABLE public.exploration_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.exploration_sessions(id) ON DELETE CASCADE,
  label text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.exploration_saves TO anon, authenticated;
GRANT ALL ON public.exploration_saves TO service_role;
ALTER TABLE public.exploration_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Exploration saves are publicly visible" ON public.exploration_saves FOR SELECT TO anon, authenticated USING (true);
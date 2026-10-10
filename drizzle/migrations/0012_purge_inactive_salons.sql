CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE OR REPLACE FUNCTION public.purge_inactive_salons()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.games g
  WHERE greatest(g.created_at, coalesce(g.started_at, g.created_at), coalesce(g.ended_at, g.created_at),
    coalesce((SELECT max(e.created_at) FROM public.game_events e WHERE e.game_id = g.id), g.created_at),
    coalesce((SELECT max(m.created_at) FROM public.game_messages m WHERE m.game_id = g.id), g.created_at)
  ) < now() - interval '2 months';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.purge_inactive_salons() FROM PUBLIC, anon, authenticated;
SELECT cron.schedule('purge-inactive-salons', '0 4 * * *', 'SELECT public.purge_inactive_salons()');
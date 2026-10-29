ALTER TABLE public.enemy_catalog ADD COLUMN IF NOT EXISTS owner_id uuid;
DROP POLICY IF EXISTS "Narrators read enemy catalog" ON public.enemy_catalog;
CREATE POLICY "Narrators read enemy catalog" ON public.enemy_catalog FOR SELECT TO authenticated USING ((owner_id IS NULL AND ((game_id IS NULL AND EXISTS (SELECT 1 FROM public.game_players gp WHERE gp.user_id = auth.uid() AND gp.role = 'narrator')) OR public.is_game_narrator(game_id))) OR owner_id = auth.uid());
CREATE POLICY "Map authors read shared enemies" ON public.enemy_catalog FOR SELECT TO authenticated USING (game_id IS NULL AND owner_id IS NULL AND auth.uid() IS NOT NULL);
GRANT SELECT ON public.enemy_catalog TO authenticated;
GRANT ALL ON public.enemy_catalog TO service_role;
COMMENT ON COLUMN public.enemy_catalog.owner_id IS 'Private personal-map enemy author; null for shared and legacy salon catalog entries.';
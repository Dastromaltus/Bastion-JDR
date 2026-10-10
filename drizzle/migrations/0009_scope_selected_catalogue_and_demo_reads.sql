-- The Operations catalogue is shared with signed-in users, not anonymous callers.
ALTER POLICY "Signed-in users read templates" ON public.dungeon_templates USING ((SELECT auth.uid()) IS NOT NULL);
ALTER POLICY "Signed-in users read template rooms" ON public.dungeon_rooms USING ((SELECT auth.uid()) IS NOT NULL);
ALTER POLICY "Signed-in users read template enemies" ON public.dungeon_room_enemies USING ((SELECT auth.uid()) IS NOT NULL);
ALTER POLICY "Signed-in users read template treasures" ON public.dungeon_room_treasures USING ((SELECT auth.uid()) IS NOT NULL);
ALTER POLICY "Signed-in users read template events" ON public.dungeon_events USING ((SELECT auth.uid()) IS NOT NULL);

-- Only the existing shared homepage demo is public; future sessions default to private.
ALTER POLICY "Exploration sessions are publicly visible" ON public.exploration_sessions USING (slug = 'porte-rouge');
ALTER POLICY "Exploration players are publicly visible" ON public.exploration_players USING (EXISTS (SELECT 1 FROM public.exploration_sessions AS session WHERE session.id = exploration_players.session_id AND session.slug = 'porte-rouge'));
ALTER POLICY "Exploration entities are publicly visible" ON public.exploration_entities USING (EXISTS (SELECT 1 FROM public.exploration_sessions AS session WHERE session.id = exploration_entities.session_id AND session.slug = 'porte-rouge'));
ALTER POLICY "Exploration events are publicly visible" ON public.exploration_events USING (EXISTS (SELECT 1 FROM public.exploration_sessions AS session WHERE session.id = exploration_events.session_id AND session.slug = 'porte-rouge'));
ALTER POLICY "Exploration saves are publicly visible" ON public.exploration_saves USING (EXISTS (SELECT 1 FROM public.exploration_sessions AS session WHERE session.id = exploration_saves.session_id AND session.slug = 'porte-rouge'));

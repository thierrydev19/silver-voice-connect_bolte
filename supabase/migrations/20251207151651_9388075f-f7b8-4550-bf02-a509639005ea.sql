-- Permettre aux membres d'un cercle de voir les profils des autres membres
CREATE POLICY "Circle members can view other members profiles" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.circle_members cm1
    WHERE cm1.user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.circle_members cm2
      WHERE cm2.circle_id = cm1.circle_id
      AND cm2.user_id = profiles.user_id
    )
  )
);
/*
  # Ajout des indexes de performance
  
  Crée des indexes pour optimiser les requêtes fréquentes
  utilisées par l'application Silver Voice.
*/

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_circles_created_by ON public.circles(created_by);
CREATE INDEX IF NOT EXISTS idx_circles_invitation_code ON public.circles(invitation_code);
CREATE INDEX IF NOT EXISTS idx_circle_members_circle_id ON public.circle_members(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_members_user_id ON public.circle_members(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_circle_id ON public.reminders(circle_id);
CREATE INDEX IF NOT EXISTS idx_reminders_due_at ON public.reminders(due_at);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON public.reminders(status);
CREATE INDEX IF NOT EXISTS idx_reminders_circle_status ON public.reminders(circle_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_circle_id ON public.messages(circle_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_circle_created ON public.messages(circle_id, created_at DESC);

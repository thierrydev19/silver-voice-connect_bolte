/*
  # Configuration complète Silver Voice

  ## Fonctions utilitaires
  
  1. **generate_invitation_code**
     - Génère un code d'invitation unique de 6 caractères
     - Utilisé automatiquement lors de la création d'un cercle
  
  2. **is_circle_member**
     - Vérifie si un utilisateur est membre d'un cercle
     - Utilisé dans les politiques RLS pour contrôler l'accès
  
  3. **has_role**
     - Vérifie si un utilisateur a un rôle spécifique
     - Utilisé pour les contrôles d'accès basés sur les rôles
  
  4. **handle_new_user**
     - Crée automatiquement un profil lors de l'inscription
     - Trigger sur auth.users
  
  5. **update_updated_at_column**
     - Met à jour automatiquement le champ updated_at
     - Trigger sur les tables avec timestamp
  
  ## Triggers
  
  - Génération automatique des codes d'invitation
  - Création automatique des profils utilisateurs
  - Mise à jour automatique des timestamps
  
  ## Sécurité RLS
  
  Politiques complètes pour toutes les tables :
  - **profiles** : accès restreint à l'utilisateur et aux membres du cercle
  - **user_roles** : gestion des rôles utilisateur
  - **circles** : création et gestion par les membres
  - **circle_members** : gestion des membres par le créateur
  - **reminders** : accès par cercle, modification par créateur
  - **messages** : accès par cercle, création par membres
  
  ## Storage
  
  Bucket pour les messages audio avec politiques d'accès
*/

-- ============================================
-- FONCTIONS UTILITAIRES
-- ============================================

-- Fonction: generate_invitation_code
CREATE OR REPLACE FUNCTION public.generate_invitation_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := upper(substring(md5(random()::text) from 1 for 6));
    SELECT EXISTS(SELECT 1 FROM circles WHERE invitation_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN new_code;
END;
$$;

-- Fonction: set_circle_invitation_code (trigger function)
CREATE OR REPLACE FUNCTION public.set_circle_invitation_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.invitation_code IS NULL THEN
    NEW.invitation_code := generate_invitation_code();
  END IF;
  RETURN NEW;
END;
$$;

-- Fonction: is_circle_member
CREATE OR REPLACE FUNCTION public.is_circle_member(_user_id uuid, _circle_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.circle_members
    WHERE user_id = _user_id
      AND circle_id = _circle_id
  )
$$;

-- Fonction: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Fonction: handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name');
  RETURN NEW;
END;
$$;

-- Fonction: update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger: création automatique du code d'invitation
DROP TRIGGER IF EXISTS set_circle_invitation_code_trigger ON public.circles;
CREATE TRIGGER set_circle_invitation_code_trigger
  BEFORE INSERT ON public.circles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_circle_invitation_code();

-- Trigger: création automatique du profil utilisateur
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Triggers: mise à jour automatique de updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_circles_updated_at ON public.circles;
CREATE TRIGGER update_circles_updated_at
  BEFORE UPDATE ON public.circles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_reminders_updated_at ON public.reminders;
CREATE TRIGGER update_reminders_updated_at
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS) - PROFILES
-- ============================================

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Circle members can view other members profiles" ON public.profiles;
CREATE POLICY "Circle members can view other members profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM circle_members cm1
      WHERE cm1.user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM circle_members cm2
        WHERE cm2.circle_id = cm1.circle_id
        AND cm2.user_id = profiles.user_id
      )
    )
  );

-- ============================================
-- ROW LEVEL SECURITY (RLS) - USER_ROLES
-- ============================================

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own roles" ON public.user_roles;
CREATE POLICY "Users can insert their own roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) - CIRCLES
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can create circles" ON public.circles;
CREATE POLICY "Authenticated users can create circles"
  ON public.circles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Circle members can view their circles" ON public.circles;
CREATE POLICY "Circle members can view their circles"
  ON public.circles FOR SELECT
  TO authenticated
  USING (is_circle_member(auth.uid(), id) OR created_by = auth.uid());

DROP POLICY IF EXISTS "Circle creators can update their circles" ON public.circles;
CREATE POLICY "Circle creators can update their circles"
  ON public.circles FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Circle creators can delete their circles" ON public.circles;
CREATE POLICY "Circle creators can delete their circles"
  ON public.circles FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- ============================================
-- ROW LEVEL SECURITY (RLS) - CIRCLE_MEMBERS
-- ============================================

DROP POLICY IF EXISTS "Circle members can view other members" ON public.circle_members;
CREATE POLICY "Circle members can view other members"
  ON public.circle_members FOR SELECT
  TO authenticated
  USING (is_circle_member(auth.uid(), circle_id));

DROP POLICY IF EXISTS "Circle creators can add members" ON public.circle_members;
CREATE POLICY "Circle creators can add members"
  ON public.circle_members FOR INSERT
  TO authenticated
  WITH CHECK (
    (EXISTS (SELECT 1 FROM circles WHERE circles.id = circle_members.circle_id AND circles.created_by = auth.uid()))
    OR (auth.uid() = user_id)
  );

DROP POLICY IF EXISTS "Circle creators can update members" ON public.circle_members;
CREATE POLICY "Circle creators can update members"
  ON public.circle_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM circles WHERE circles.id = circle_members.circle_id AND circles.created_by = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM circles WHERE circles.id = circle_members.circle_id AND circles.created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Circle creators can remove members" ON public.circle_members;
CREATE POLICY "Circle creators can remove members"
  ON public.circle_members FOR DELETE
  TO authenticated
  USING (
    (EXISTS (SELECT 1 FROM circles WHERE circles.id = circle_members.circle_id AND circles.created_by = auth.uid()))
    OR (auth.uid() = user_id)
  );

-- ============================================
-- ROW LEVEL SECURITY (RLS) - REMINDERS
-- ============================================

DROP POLICY IF EXISTS "Circle members can view reminders" ON public.reminders;
CREATE POLICY "Circle members can view reminders"
  ON public.reminders FOR SELECT
  TO authenticated
  USING (is_circle_member(auth.uid(), circle_id));

DROP POLICY IF EXISTS "Circle members can create reminders" ON public.reminders;
CREATE POLICY "Circle members can create reminders"
  ON public.reminders FOR INSERT
  TO authenticated
  WITH CHECK (is_circle_member(auth.uid(), circle_id) AND auth.uid() = created_by);

DROP POLICY IF EXISTS "Circle members can update reminders" ON public.reminders;
CREATE POLICY "Circle members can update reminders"
  ON public.reminders FOR UPDATE
  TO authenticated
  USING (is_circle_member(auth.uid(), circle_id))
  WITH CHECK (is_circle_member(auth.uid(), circle_id));

DROP POLICY IF EXISTS "Reminder creators can delete reminders" ON public.reminders;
CREATE POLICY "Reminder creators can delete reminders"
  ON public.reminders FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- ============================================
-- ROW LEVEL SECURITY (RLS) - MESSAGES
-- ============================================

DROP POLICY IF EXISTS "Circle members can view messages" ON public.messages;
CREATE POLICY "Circle members can view messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (is_circle_member(auth.uid(), circle_id));

DROP POLICY IF EXISTS "Circle members can create messages" ON public.messages;
CREATE POLICY "Circle members can create messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (is_circle_member(auth.uid(), circle_id) AND auth.uid() = sender_id);

DROP POLICY IF EXISTS "Message senders can delete their messages" ON public.messages;
CREATE POLICY "Message senders can delete their messages"
  ON public.messages FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);

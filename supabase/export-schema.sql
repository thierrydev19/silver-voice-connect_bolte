-- ============================================
-- SILVER VOICE - EXPORT SCHEMA COMPLET
-- À exécuter dans votre projet Supabase
-- ============================================

-- ============================================
-- 1. ENUMS
-- ============================================
CREATE TYPE public.app_role AS ENUM ('senior', 'aidant');
CREATE TYPE public.reminder_status AS ENUM ('pending', 'done', 'snoozed');

-- ============================================
-- 2. TABLES
-- ============================================

-- Table: profiles
CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  display_name text,
  avatar_url text,
  phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Table: user_roles
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Table: circles (cercles familiaux)
CREATE TABLE public.circles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  invitation_code text UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Table: circle_members
CREATE TABLE public.circle_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role app_role NOT NULL DEFAULT 'aidant'::app_role,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (circle_id, user_id)
);

-- Table: reminders
CREATE TABLE public.reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  text text NOT NULL,
  due_at timestamp with time zone NOT NULL,
  status reminder_status NOT NULL DEFAULT 'pending'::reminder_status,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Table: messages
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text,
  audio_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============================================
-- 3. FONCTIONS
-- ============================================

-- Fonction: generate_invitation_code
CREATE OR REPLACE FUNCTION public.generate_invitation_code()
RETURNS text
LANGUAGE plpgsql
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

-- Fonction: set_circle_invitation_code (trigger)
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

-- Fonction: is_circle_member (security definer pour RLS)
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

-- Fonction: has_role (security definer pour RLS)
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

-- Fonction: handle_new_user (crée un profil à l'inscription)
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
-- 4. TRIGGERS
-- ============================================

-- Trigger: création automatique du code d'invitation
CREATE TRIGGER set_circle_invitation_code_trigger
  BEFORE INSERT ON public.circles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_circle_invitation_code();

-- Trigger: création automatique du profil utilisateur
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Triggers: mise à jour automatique de updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_circles_updated_at
  BEFORE UPDATE ON public.circles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reminders_updated_at
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Activer RLS sur toutes les tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- === PROFILES ===
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Circle members can view other members profiles"
  ON public.profiles FOR SELECT
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

-- === USER_ROLES ===
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- === CIRCLES ===
CREATE POLICY "Authenticated users can create circles"
  ON public.circles FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Circle members can view their circles"
  ON public.circles FOR SELECT
  USING (is_circle_member(auth.uid(), id) OR created_by = auth.uid());

CREATE POLICY "Circle creators can update their circles"
  ON public.circles FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Circle creators can delete their circles"
  ON public.circles FOR DELETE
  USING (auth.uid() = created_by);

-- === CIRCLE_MEMBERS ===
CREATE POLICY "Circle members can view other members"
  ON public.circle_members FOR SELECT
  USING (is_circle_member(auth.uid(), circle_id));

CREATE POLICY "Circle creators can add members"
  ON public.circle_members FOR INSERT
  WITH CHECK (
    (EXISTS (SELECT 1 FROM circles WHERE circles.id = circle_members.circle_id AND circles.created_by = auth.uid()))
    OR (auth.uid() = user_id)
  );

CREATE POLICY "Circle creators can remove members"
  ON public.circle_members FOR DELETE
  USING (
    (EXISTS (SELECT 1 FROM circles WHERE circles.id = circle_members.circle_id AND circles.created_by = auth.uid()))
    OR (auth.uid() = user_id)
  );

-- === REMINDERS ===
CREATE POLICY "Circle members can view reminders"
  ON public.reminders FOR SELECT
  USING (is_circle_member(auth.uid(), circle_id));

CREATE POLICY "Circle members can create reminders"
  ON public.reminders FOR INSERT
  WITH CHECK (is_circle_member(auth.uid(), circle_id) AND auth.uid() = created_by);

CREATE POLICY "Reminder creators can update reminders"
  ON public.reminders FOR UPDATE
  USING (auth.uid() = created_by OR is_circle_member(auth.uid(), circle_id));

CREATE POLICY "Reminder creators can delete reminders"
  ON public.reminders FOR DELETE
  USING (auth.uid() = created_by);

-- === MESSAGES ===
CREATE POLICY "Circle members can view messages"
  ON public.messages FOR SELECT
  USING (is_circle_member(auth.uid(), circle_id));

CREATE POLICY "Circle members can create messages"
  ON public.messages FOR INSERT
  WITH CHECK (is_circle_member(auth.uid(), circle_id) AND auth.uid() = sender_id);

CREATE POLICY "Message senders can delete their messages"
  ON public.messages FOR DELETE
  USING (auth.uid() = sender_id);

-- ============================================
-- 6. STORAGE (Bucket pour messages audio)
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-messages', 'audio-messages', true);

CREATE POLICY "Authenticated users can upload audio"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'audio-messages' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view audio messages"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audio-messages');

CREATE POLICY "Users can delete their own audio"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'audio-messages' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- 7. CONFIGURATION AUTH (à faire dans Dashboard)
-- ============================================
-- Dans votre dashboard Supabase:
-- 1. Authentication > Providers > Email > Activer
-- 2. Authentication > Settings > Désactiver "Confirm email"
-- 3. Authentication > URL Configuration > Site URL: votre-domaine.com

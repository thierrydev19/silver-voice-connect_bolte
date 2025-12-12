-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('senior', 'aidant');

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create circles table (family circles)
CREATE TABLE public.circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create circle_members table
CREATE TABLE public.circle_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'aidant',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (circle_id, user_id)
);

-- Create reminder status enum
CREATE TYPE public.reminder_status AS ENUM ('pending', 'done', 'snoozed', 'cancelled');

-- Create reminders table
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  due_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status reminder_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Security definer function to check if user is member of circle
CREATE OR REPLACE FUNCTION public.is_circle_member(_user_id UUID, _circle_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.circle_members
    WHERE user_id = _user_id
      AND circle_id = _circle_id
  )
$$;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for circles
CREATE POLICY "Circle members can view their circles"
  ON public.circles FOR SELECT
  USING (public.is_circle_member(auth.uid(), id) OR created_by = auth.uid());

CREATE POLICY "Authenticated users can create circles"
  ON public.circles FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Circle creators can update their circles"
  ON public.circles FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Circle creators can delete their circles"
  ON public.circles FOR DELETE
  USING (auth.uid() = created_by);

-- RLS Policies for circle_members
CREATE POLICY "Circle members can view other members"
  ON public.circle_members FOR SELECT
  USING (public.is_circle_member(auth.uid(), circle_id));

CREATE POLICY "Circle creators can add members"
  ON public.circle_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.circles
      WHERE id = circle_id AND created_by = auth.uid()
    )
    OR auth.uid() = user_id
  );

CREATE POLICY "Circle creators can remove members"
  ON public.circle_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.circles
      WHERE id = circle_id AND created_by = auth.uid()
    )
    OR auth.uid() = user_id
  );

-- RLS Policies for reminders
CREATE POLICY "Circle members can view reminders"
  ON public.reminders FOR SELECT
  USING (public.is_circle_member(auth.uid(), circle_id));

CREATE POLICY "Circle members can create reminders"
  ON public.reminders FOR INSERT
  WITH CHECK (public.is_circle_member(auth.uid(), circle_id) AND auth.uid() = created_by);

CREATE POLICY "Reminder creators can update reminders"
  ON public.reminders FOR UPDATE
  USING (auth.uid() = created_by OR public.is_circle_member(auth.uid(), circle_id));

CREATE POLICY "Reminder creators can delete reminders"
  ON public.reminders FOR DELETE
  USING (auth.uid() = created_by);

-- RLS Policies for messages
CREATE POLICY "Circle members can view messages"
  ON public.messages FOR SELECT
  USING (public.is_circle_member(auth.uid(), circle_id));

CREATE POLICY "Circle members can create messages"
  ON public.messages FOR INSERT
  WITH CHECK (public.is_circle_member(auth.uid(), circle_id) AND auth.uid() = sender_id);

CREATE POLICY "Message senders can delete their messages"
  ON public.messages FOR DELETE
  USING (auth.uid() = sender_id);

-- Trigger function to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_circles_updated_at
  BEFORE UPDATE ON public.circles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reminders_updated_at
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name');
  RETURN NEW;
END;
$$;

-- Trigger for auto-creating profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
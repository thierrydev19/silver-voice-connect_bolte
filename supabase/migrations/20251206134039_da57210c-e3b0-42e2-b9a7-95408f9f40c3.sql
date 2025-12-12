-- Add invitation code column to circles
ALTER TABLE public.circles 
ADD COLUMN IF NOT EXISTS invitation_code TEXT UNIQUE;

-- Create function to generate unique invitation codes
CREATE OR REPLACE FUNCTION public.generate_invitation_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 6-character alphanumeric code
    new_code := upper(substring(md5(random()::text) from 1 for 6));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM circles WHERE invitation_code = new_code) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$;

-- Create trigger to auto-generate invitation code on circle creation
CREATE OR REPLACE FUNCTION public.set_circle_invitation_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.invitation_code IS NULL THEN
    NEW.invitation_code := generate_invitation_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_invitation_code
  BEFORE INSERT ON public.circles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_circle_invitation_code();

-- Update existing circles with invitation codes
UPDATE public.circles 
SET invitation_code = generate_invitation_code() 
WHERE invitation_code IS NULL;
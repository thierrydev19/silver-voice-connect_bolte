import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface UserProfile {
  displayName: string | null;
  role: 'senior' | 'aidant' | null;
}

export const useUserProfile = () => {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile>({ displayName: null, role: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setProfile({ displayName: null, role: null });
        setLoading(false);
        return;
      }

      try {
        // Fetch display name from profiles
        const { data: profileData } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', user.id)
          .maybeSingle();

        // Fetch role from user_roles
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        setProfile({
          displayName: profileData?.display_name || null,
          role: roleData?.role as 'senior' | 'aidant' | null
        });
      } catch (error) {
        console.error('Error fetching user profile:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchProfile();
    }
  }, [user, authLoading]);

  const firstName = profile.displayName?.split(' ')[0] || null;

  return {
    ...profile,
    firstName,
    loading: authLoading || loading
  };
};

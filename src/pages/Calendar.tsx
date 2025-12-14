import { PhoneFrame } from "@/components/PhoneFrame";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { WeeklyCalendar } from "@/components/WeeklyCalendar";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toast } from "sonner";

const Calendar = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();
  const [circleId, setCircleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileLoading && !user) {
      navigate('/login');
    }
  }, [user, profileLoading, navigate]);

  useEffect(() => {
    const fetchCircleId = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('circle_members')
        .select('circle_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setCircleId(data.circle_id);
      } else {
        toast.error('Vous devez être membre d\'un cercle familial');
        navigate(role === 'senior' ? '/senior' : '/aidant');
      }
      setLoading(false);
    };

    fetchCircleId();
  }, [user, navigate, role]);

  if (loading || profileLoading) {
    return (
      <PhoneFrame>
        <TopBar title="Calendrier" />
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <TopBar title="Calendrier hebdomadaire" />
      <div className="bg-gradient-to-b from-background to-secondary/10 min-h-screen">
        {circleId && <WeeklyCalendar circleId={circleId} />}
      </div>
      <BottomNav />
    </PhoneFrame>
  );
};

export default Calendar;

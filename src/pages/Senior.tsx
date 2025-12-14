import { PhoneFrame } from "@/components/PhoneFrame";
import { BigButton } from "@/components/BigButton";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { WeeklyCalendar } from "@/components/WeeklyCalendar";
import { Mic, Sun, MessageCircle, Calendar, Users, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { format, isToday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface Reminder {
  id: string;
  text: string;
  due_at: string;
  status: string;
}

interface Message {
  id: string;
  content: string | null;
  audio_url: string | null;
  created_at: string;
  sender_id: string;
  sender_name?: string;
}

const Senior = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { firstName, role, loading: profileLoading } = useUserProfile();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [circleId, setCircleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Role protection: redirect if not senior
  useEffect(() => {
    if (!profileLoading && role && role !== 'senior') {
      toast.error('Vous devez vous reconnecter pour accéder à cette page en tant qu\'Aîné');
      navigate('/aidant');
    }
  }, [role, profileLoading, navigate]);

  // Redirect if not logged in
  useEffect(() => {
    if (!profileLoading && !user) {
      navigate('/login');
    }
  }, [user, profileLoading, navigate]);

  // Fetch circle ID
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
      }
      setLoading(false);
    };

    fetchCircleId();
  }, [user]);

  // Fetch reminders and messages
  useEffect(() => {
    const fetchData = async () => {
      if (!circleId) return;

      // Fetch today's reminders
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: remindersData } = await supabase
        .from('reminders')
        .select('*')
        .eq('circle_id', circleId)
        .eq('status', 'pending')
        .gte('due_at', today.toISOString())
        .lt('due_at', tomorrow.toISOString())
        .order('due_at', { ascending: true })
        .limit(5);

      if (remindersData) {
        setReminders(remindersData);
      }

      // Fetch recent messages
      const { data: messagesData } = await supabase
        .from('messages')
        .select('*')
        .eq('circle_id', circleId)
        .order('created_at', { ascending: false })
        .limit(3);

      if (messagesData) {
        // Fetch sender names
        const senderIds = [...new Set(messagesData.map(m => m.sender_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', senderIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);
        
        setMessages(messagesData.map(m => ({
          ...m,
          sender_name: profileMap.get(m.sender_id) || 'Inconnu'
        })));
      }
    };

    fetchData();

    // Real-time subscriptions
    if (circleId) {
      const remindersChannel = supabase
        .channel('senior-reminders')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'reminders',
          filter: `circle_id=eq.${circleId}`
        }, () => {
          fetchData();
        })
        .subscribe();

      const messagesChannel = supabase
        .channel('senior-messages')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `circle_id=eq.${circleId}`
        }, () => {
          fetchData();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(remindersChannel);
        supabase.removeChannel(messagesChannel);
      };
    }
  }, [circleId]);

  if (loading || profileLoading) {
    return (
      <PhoneFrame>
        <TopBar title="Mon assistant" />
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <TopBar title="Mon assistant" />
      
      <div className="p-6 space-y-6 min-h-screen bg-gradient-to-b from-background to-secondary/10">
        {/* Greeting */}
        <div className="text-center py-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full mb-3">
            <Sun className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">
            Bonjour{firstName ? ` ${firstName}` : ''} !
          </h2>
          <p className="text-muted-foreground">Que puis-je faire pour vous ?</p>
        </div>

        {/* Main action - Voice */}
        <BigButton
          variant="primary"
          icon={Mic}
          onClick={() => navigate("/reminders")}
          className="w-full"
        >
          Créer un rappel vocal
        </BigButton>

        {/* Today's reminders */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Aujourd'hui
          </h3>
          {reminders.length > 0 ? (
            <div className="space-y-2">
              {reminders.map((reminder) => (
                <Card key={reminder.id} className="p-4 bg-card hover:bg-accent/10 transition-colors cursor-pointer rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="bg-primary/10 rounded-lg px-3 py-1 min-w-[60px] text-center">
                      <span className="text-sm font-semibold text-primary">
                        {format(parseISO(reminder.due_at), 'HH:mm', { locale: fr })}
                      </span>
                    </div>
                    <p className="flex-1 text-base">{reminder.text}</p>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-4 bg-card/50 rounded-xl text-center">
              <p className="text-muted-foreground">Aucun rappel pour aujourd'hui</p>
            </Card>
          )}
        </div>

        {/* Weekly Calendar */}
        {circleId && <WeeklyCalendar circleId={circleId} />}

        {/* Recent messages */}
        {messages.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              Derniers messages
            </h3>
            <div className="space-y-2">
              {messages.map((message) => (
                <Card 
                  key={message.id} 
                  className="p-4 bg-card hover:bg-accent/10 transition-colors cursor-pointer rounded-xl"
                  onClick={() => navigate('/messages')}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-primary">
                        {message.sender_name?.[0] || '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{message.sender_name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {message.audio_url ? '🎤 Message vocal' : message.content}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        {/* Bottom spacing for nav */}
        <div className="h-20" />
      </div>
      <BottomNav />
    </PhoneFrame>
  );
};

export default Senior;

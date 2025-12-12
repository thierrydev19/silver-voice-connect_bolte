import { PhoneFrame } from "@/components/PhoneFrame";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Users, Bell, MessageCircle, Calendar, Heart, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
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

interface Member {
  id: string;
  user_id: string;
  role: string;
  display_name: string | null;
}

const Aidant = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { firstName, role, loading: profileLoading } = useUserProfile();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [circleId, setCircleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Role protection: redirect if not aidant
  useEffect(() => {
    if (!profileLoading && role && role !== 'aidant') {
      toast.error('Vous devez vous reconnecter pour accéder à cette page en tant qu\'Aidant');
      navigate('/senior');
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

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!circleId) return;

      // Fetch upcoming reminders (pending and snoozed)
      const { data: remindersData } = await supabase
        .from('reminders')
        .select('*')
        .eq('circle_id', circleId)
        .in('status', ['pending', 'snoozed'])
        .gte('due_at', new Date().toISOString())
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

      // Fetch circle members
      const { data: membersData } = await supabase
        .from('circle_members')
        .select('id, user_id, role')
        .eq('circle_id', circleId);

      if (membersData) {
        const memberIds = membersData.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', memberIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);
        
        setMembers(membersData.map(m => ({
          ...m,
          display_name: profileMap.get(m.user_id) || 'Utilisateur'
        })));
      }
    };

    fetchData();

    // Real-time subscriptions
    if (circleId) {
      const remindersChannel = supabase
        .channel('aidant-reminders')
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
        .channel('aidant-messages')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `circle_id=eq.${circleId}`
        }, () => {
          fetchData();
        })
        .subscribe();

      const membersChannel = supabase
        .channel('aidant-members')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'circle_members',
          filter: `circle_id=eq.${circleId}`
        }, () => {
          fetchData();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(remindersChannel);
        supabase.removeChannel(messagesChannel);
        supabase.removeChannel(membersChannel);
      };
    }
  }, [circleId]);

  const formatReminderDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) {
      return `Aujourd'hui ${format(date, 'HH:mm', { locale: fr })}`;
    } else if (isTomorrow(date)) {
      return `Demain ${format(date, 'HH:mm', { locale: fr })}`;
    }
    return format(date, 'EEEE d MMMM HH:mm', { locale: fr });
  };

  const getRoleLabel = (role: string) => {
    return role === 'senior' ? 'Aîné' : 'Aidant';
  };

  if (loading || profileLoading) {
    return (
      <PhoneFrame>
        <TopBar title="Tableau de bord" />
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PhoneFrame>
    );
  }

  const pendingReminders = reminders.filter(r => r.status === 'pending' || r.status === 'snoozed');

  return (
    <PhoneFrame>
      <TopBar title={firstName ? `Bonjour ${firstName}` : "Tableau de bord"} />
      
      <div className="p-6 space-y-6 min-h-screen bg-gradient-to-b from-background to-primary/5">
        {/* Header stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-none rounded-xl">
            <div className="flex items-center gap-3">
              <div className="bg-primary/20 rounded-lg p-2">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingReminders.length}</p>
                <p className="text-sm text-muted-foreground">Rappels actifs</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-accent/10 to-accent/5 border-none rounded-xl">
            <div className="flex items-center gap-3">
              <div className="bg-accent/20 rounded-lg p-2">
                <Users className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{members.length}</p>
                <p className="text-sm text-muted-foreground">Membres</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Upcoming reminders */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Prochains rappels
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/reminders")}
              className="text-primary"
            >
              Tout voir
            </Button>
          </div>
          
          {reminders.length > 0 ? (
            <div className="space-y-2">
              {reminders.map((reminder) => (
                <Card key={reminder.id} className="p-4 hover:bg-accent/10 transition-colors cursor-pointer rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{reminder.text}</p>
                      <p className="text-sm text-muted-foreground">{formatReminderDate(reminder.due_at)}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      reminder.status === 'pending' 
                        ? 'bg-primary/10 text-primary' 
                        : 'bg-secondary/50 text-secondary-foreground'
                    }`}>
                      {reminder.status === 'pending' ? 'En attente' : 'Reporté'}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-4 bg-card/50 rounded-xl text-center">
              <p className="text-muted-foreground">Aucun rappel à venir</p>
            </Card>
          )}
        </div>

        {/* Recent messages */}
        {messages.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-primary" />
                Messages récents
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/messages")}
                className="text-primary"
              >
                Tout voir
              </Button>
            </div>
            
            <div className="space-y-2">
              {messages.map((message) => (
                <Card 
                  key={message.id} 
                  className="p-4 hover:bg-accent/10 transition-colors cursor-pointer rounded-xl"
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
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(message.created_at), 'HH:mm', { locale: fr })}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Family circle */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              Cercle familial
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/circle")}
              className="text-primary"
            >
              Gérer
            </Button>
          </div>
          
          {members.length > 0 ? (
            <div className="space-y-2">
              {members.map((member) => (
                <Card key={member.id} className="p-4 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                      <span className="text-lg font-semibold text-primary">
                        {member.display_name?.[0] || '?'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{member.display_name}</p>
                      <p className="text-sm text-muted-foreground">{getRoleLabel(member.role)}</p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-accent"></div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-4 bg-card/50 rounded-xl text-center">
              <p className="text-muted-foreground">Aucun membre dans le cercle</p>
              <Button
                variant="link"
                onClick={() => navigate("/circle")}
                className="text-primary mt-2"
              >
                Créer ou rejoindre un cercle
              </Button>
            </Card>
          )}
        </div>

        {/* Bottom spacing for nav */}
        <div className="h-20" />
      </div>
      <BottomNav />
    </PhoneFrame>
  );
};

export default Aidant;

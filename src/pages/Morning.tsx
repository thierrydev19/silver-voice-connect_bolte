import { PhoneFrame } from "@/components/PhoneFrame";
import { BigButton } from "@/components/BigButton";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Sun, Volume2, Calendar, VolumeX, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { useState, useEffect, useMemo } from "react";
import { useVoiceSynthesis } from "@/hooks/useVoiceSynthesis";
import { format, isToday, parseISO, startOfDay, endOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Reminder {
  id: string;
  text: string;
  due_at: string;
  status: string;
}

const Morning = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [circleId, setCircleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Récupérer le cercle de l'utilisateur
  useEffect(() => {
    const fetchCircle = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      const { data } = await supabase
        .from('circle_members')
        .select('circle_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      
      if (data) {
        setCircleId(data.circle_id);
      }
      setLoading(false);
    };
    
    fetchCircle();
  }, [user]);

  // Récupérer les rappels du jour
  useEffect(() => {
    if (!circleId) return;

    const fetchTodayReminders = async () => {
      const today = new Date();
      const start = startOfDay(today).toISOString();
      const end = endOfDay(today).toISOString();

      const { data } = await supabase
        .from('reminders')
        .select('*')
        .eq('circle_id', circleId)
        .neq('status', 'done')
        .gte('due_at', start)
        .lte('due_at', end)
        .order('due_at', { ascending: true });
      
      if (data) {
        setReminders(data);
      }
    };

    fetchTodayReminders();

    // Écouter les changements en temps réel
    const channel = supabase
      .channel('morning-reminders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reminders',
          filter: `circle_id=eq.${circleId}`
        },
        () => {
          fetchTodayReminders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [circleId]);

  const todaySummary = useMemo(() => {
    const formattedReminders = reminders.map(r => ({
      time: format(new Date(r.due_at), 'HH:mm'),
      text: r.text
    }));

    return {
      greeting: "Bonjour ! Voici votre journée",
      reminders: formattedReminders,
      weather: "Ensoleillé, 22°C",
    };
  }, [reminders]);

  const buildSpeechText = useMemo(() => {
    const today = format(new Date(), "EEEE d MMMM", { locale: fr });
    let text = `Bonjour ! Nous sommes ${today}. `;
    
    if (todaySummary.reminders.length === 0) {
      text += "Vous n'avez aucun rendez-vous prévu aujourd'hui. Profitez de votre journée !";
    } else {
      text += `Vous avez ${todaySummary.reminders.length} rappel${todaySummary.reminders.length > 1 ? 's' : ''} aujourd'hui. `;
      
      todaySummary.reminders.forEach((reminder, index) => {
        const [hours, minutes] = reminder.time.split(':');
        const timeText = minutes === '00' 
          ? `${parseInt(hours)} heures` 
          : `${parseInt(hours)} heures ${parseInt(minutes)}`;
        
        if (index === todaySummary.reminders.length - 1 && index > 0) {
          text += `Et à ${timeText}, ${reminder.text}. `;
        } else {
          text += `À ${timeText}, ${reminder.text}. `;
        }
      });
      
      text += "Passez une excellente journée !";
    }
    
    return text;
  }, [todaySummary]);

  const { speak, stop, isSpeaking, isSupported } = useVoiceSynthesis({
    rate: 0.85,
  });

  const handlePlaySummary = () => {
    if (isSpeaking) {
      stop();
    } else {
      speak(buildSpeechText);
    }
  };

  if (loading) {
    return (
      <PhoneFrame>
        <TopBar title="Ma journée" onBack={() => navigate(-1)} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <TopBar title="Ma journée" onBack={() => navigate(-1)} />
      
      <div className="p-6 space-y-6 min-h-screen bg-gradient-to-b from-primary/5 via-secondary/5 to-accent/5">
        {/* Header with sun */}
        <div className="text-center py-6">
          <div className={`inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-primary/20 via-accent/20 to-secondary/20 rounded-full mb-4 ${isSpeaking ? 'animate-pulse' : ''}`}>
            <Sun className="w-12 h-12 text-primary" />
          </div>
          <h2 className="text-3xl font-bold mb-2">{todaySummary.greeting}</h2>
          <p className="text-lg text-muted-foreground">{todaySummary.weather}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
          </p>
        </div>

        {/* Play summary button */}
        <BigButton
          variant="accent"
          icon={isSpeaking ? VolumeX : Volume2}
          onClick={handlePlaySummary}
          disabled={!isSupported}
        >
          {isSpeaking ? 'Arrêter la lecture' : 'Écouter ma journée'}
        </BigButton>

        {/* Today's schedule */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Programme du jour
          </h3>
          
          {todaySummary.reminders.length > 0 ? (
            <div className="space-y-2">
              {todaySummary.reminders.map((reminder, index) => (
                <Card 
                  key={index} 
                  className="p-5 rounded-xl bg-gradient-to-r from-card to-secondary/10 border-none shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-primary rounded-xl px-4 py-2 min-w-[70px] text-center">
                      <span className="text-lg font-bold text-white">{reminder.time}</span>
                    </div>
                    <p className="flex-1 text-lg font-medium">{reminder.text}</p>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center rounded-xl bg-accent/10 border-accent/20">
              <p className="text-lg text-muted-foreground">
                {circleId 
                  ? "Aucun rendez-vous prévu aujourd'hui" 
                  : "Rejoignez un cercle pour voir vos rappels"}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {circleId ? "Profitez de votre journée ! 🌸" : ""}
              </p>
            </Card>
          )}
        </div>

        {/* Motivational message */}
        <Card className="p-6 rounded-xl bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 border-none">
          <p className="text-center text-lg font-medium text-foreground/80">
            "Chaque jour est une nouvelle opportunité de sourire"
          </p>
        </Card>

        {/* Bottom actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => navigate("/reminders")}
            className="flex-1 bg-secondary/50 hover:bg-secondary/70 rounded-xl p-4 text-center transition-colors"
          >
            <p className="font-medium">Ajouter un rappel</p>
          </button>
          <button
            onClick={() => navigate("/senior")}
            className="flex-1 bg-accent/30 hover:bg-accent/50 rounded-xl p-4 text-center transition-colors"
          >
            <p className="font-medium">Retour</p>
          </button>
        </div>
        
        {/* Bottom spacing for nav */}
        <div className="h-20" />
      </div>
      <BottomNav />
    </PhoneFrame>
  );
};

export default Morning;

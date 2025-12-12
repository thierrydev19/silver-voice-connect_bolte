import { PhoneFrame } from "@/components/PhoneFrame";
import { BigButton } from "@/components/BigButton";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Mic, Check, Clock, MicOff, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useVoiceRecognition } from "@/hooks/useVoiceRecognition";
import { useVoiceSynthesis } from "@/hooks/useVoiceSynthesis";
import { useVoiceFeedback } from "@/hooks/useVoiceFeedback";
import { parseFrenchDate, formatDateForSpeech, formatTimeForSpeech } from "@/utils/frenchDateParser";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Reminder {
  id: string;
  text: string;
  due_at: string;
  status: 'pending' | 'done' | 'snoozed' | 'cancelled';
  circle_id: string;
  created_by: string;
}

const Reminders = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [circleId, setCircleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Get voice feedback setting from localStorage
  const getVoiceFeedbackEnabled = () => {
    if (!user) return true;
    const settings = localStorage.getItem(`settings-${user.id}`);
    if (settings) {
      const parsed = JSON.parse(settings);
      return parsed.voiceFeedbackEnabled ?? true;
    }
    return true;
  };

  const { speak } = useVoiceSynthesis();
  const { feedback, customFeedback } = useVoiceFeedback({ 
    enabled: getVoiceFeedbackEnabled() 
  });

  // Récupérer le cercle de l'utilisateur
  useEffect(() => {
    const fetchCircle = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase
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

  // Récupérer les rappels depuis la base
  useEffect(() => {
    if (!circleId) return;

    const fetchReminders = async () => {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('circle_id', circleId)
        .order('due_at', { ascending: true });
      
      if (data) {
        setReminders(data);
      }
    };

    fetchReminders();

    // Écouter les changements en temps réel
    const channel = supabase
      .channel('reminders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reminders',
          filter: `circle_id=eq.${circleId}`
        },
        async () => {
          // Refetch all reminders on any change
          const { data } = await supabase
            .from('reminders')
            .select('*')
            .eq('circle_id', circleId)
            .order('due_at', { ascending: true });
          
          if (data) {
            setReminders(data);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [circleId]);

  const handleVoiceResult = async (transcript: string) => {
    if (!circleId || !user) {
      toast.error('Vous devez rejoindre un cercle familial');
      return;
    }

    console.log('Transcription:', transcript);
    
    const parsed = parseFrenchDate(transcript);
    
    if (parsed.text.length < 2) {
      toast.error('Je n\'ai pas compris. Essayez de nouveau.');
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase
        .from('reminders')
        .insert({
          text: parsed.text,
          due_at: parsed.dueAt.toISOString(),
          status: 'pending',
          circle_id: circleId,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      // Confirmation vocale
      const dateStr = formatDateForSpeech(parsed.dueAt);
      const timeStr = formatTimeForSpeech(parsed.dueAt);
      const confirmation = `C'est noté. Je vous rappellerai ${parsed.text} ${dateStr} à ${timeStr}.`;
      
      speak(confirmation);
      toast.success('Rappel créé !');
    } catch (err) {
      console.error('Erreur création rappel:', err);
      toast.error('Erreur lors de la création du rappel');
    } finally {
      setSaving(false);
    }
  };

  const handleVoiceError = (error: string) => {
    toast.error(error);
  };

  const { 
    isListening, 
    transcript, 
    isSupported, 
    startListening, 
    stopListening 
  } = useVoiceRecognition({
    onResult: handleVoiceResult,
    onError: handleVoiceError,
  });

  const handleVoiceInput = () => {
    if (isListening) {
      stopListening();
      feedback('recording_stop');
    } else {
      startListening();
      feedback('recording_start');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('reminders')
        .update({ status: 'done' })
        .eq('id', id);
      
      if (error) throw error;
      feedback('reminder_done');
      toast.success('Rappel terminé !');
    } catch (err) {
      console.error('Erreur:', err);
      feedback('error');
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleSnooze = async (id: string) => {
    const reminder = reminders.find(r => r.id === id);
    if (!reminder) return;

    const newDueAt = new Date(new Date(reminder.due_at).getTime() + 30 * 60 * 1000);

    try {
      const { error } = await supabase
        .from('reminders')
        .update({ 
          status: 'snoozed',
          due_at: newDueAt.toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
      customFeedback('Rappel reporté de 30 minutes');
      toast.info('Rappel reporté de 30 minutes');
    } catch (err) {
      console.error('Erreur:', err);
      feedback('error');
      toast.error('Erreur lors du report');
    }
  };

  const pendingReminders = reminders.filter(r => r.status === 'pending' || r.status === 'snoozed');

  if (loading) {
    return (
      <PhoneFrame>
        <TopBar title="Rappels vocaux" onBack={() => navigate(-1)} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PhoneFrame>
    );
  }

  if (!user) {
    return (
      <PhoneFrame>
        <TopBar title="Rappels vocaux" onBack={() => navigate(-1)} />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Clock className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Connexion requise</h2>
          <p className="text-muted-foreground mb-4">
            Connectez-vous pour créer et gérer vos rappels.
          </p>
          <Button onClick={() => navigate('/login')}>Se connecter</Button>
        </div>
      </PhoneFrame>
    );
  }

  if (!circleId) {
    return (
      <PhoneFrame>
        <TopBar title="Rappels vocaux" onBack={() => navigate(-1)} />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Clock className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Pas encore de cercle</h2>
          <p className="text-muted-foreground">
            Rejoignez ou créez un cercle familial pour utiliser les rappels.
          </p>
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <TopBar title="Rappels vocaux" onBack={() => navigate(-1)} />
      
      <div className="p-6 space-y-6 min-h-screen bg-gradient-to-b from-background to-primary/5">
        {/* Voice input */}
        <div className="text-center space-y-4">
          <div className={`mx-auto w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
            isListening 
              ? 'bg-gradient-to-br from-primary via-primary/80 to-secondary animate-pulse' 
              : 'bg-gradient-to-br from-primary/20 to-secondary/20'
          }`}>
            {isSupported ? (
              saving ? (
                <Loader2 className="w-16 h-16 text-primary animate-spin" />
              ) : (
                <Mic className={`w-16 h-16 transition-colors ${
                  isListening ? 'text-white' : 'text-primary'
                }`} />
              )
            ) : (
              <MicOff className="w-16 h-16 text-muted-foreground" />
            )}
          </div>
          
          <div>
            {isListening && transcript && (
              <p className="text-lg font-medium text-primary mb-2 min-h-[28px]">
                "{transcript}"
              </p>
            )}
            <p className={`text-xl font-semibold mb-2 ${isListening ? 'text-primary' : ''}`}>
              {!isSupported 
                ? 'Micro non disponible' 
                : saving
                  ? 'Enregistrement...'
                  : isListening 
                    ? 'Je vous écoute...' 
                    : 'Appuyez pour parler'}
            </p>
            <p className="text-muted-foreground">
              Dites par exemple : "Rappelle-moi la pharmacie demain à 10h"
            </p>
          </div>

          <BigButton
            variant="primary"
            icon={Mic}
            onClick={handleVoiceInput}
            disabled={!isSupported || saving}
          >
            {isListening ? 'Arrêter' : 'Parler'}
          </BigButton>
        </div>

        {/* Recent reminders */}
        <div className="space-y-3 pt-4">
          <h3 className="text-lg font-semibold">Rappels en cours ({pendingReminders.length})</h3>
          
          {pendingReminders.length === 0 ? (
            <Card className="p-6 text-center rounded-xl bg-muted/30">
              <p className="text-muted-foreground">Aucun rappel en cours</p>
            </Card>
          ) : (
            pendingReminders.map((reminder, index) => (
              <Card 
                key={reminder.id} 
                className={`p-4 rounded-xl ${index === 0 ? 'bg-accent/10 border-accent/20' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`rounded-lg p-2 mt-1 ${index === 0 ? 'bg-accent' : 'bg-secondary'}`}>
                    <Clock className={`w-5 h-5 ${index === 0 ? 'text-white' : 'text-secondary-foreground'}`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{reminder.text}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(new Date(reminder.due_at), "EEEE d MMMM 'à' HH:mm", { locale: fr })}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button 
                        size="sm" 
                        className={`rounded-lg ${index === 0 ? 'bg-accent hover:bg-accent/90' : ''}`}
                        onClick={() => handleComplete(reminder.id)}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        OK
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="rounded-lg"
                        onClick={() => handleSnooze(reminder.id)}
                      >
                        Plus tard
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        <div className="bg-muted/50 rounded-xl p-4 text-sm text-muted-foreground">
          <p className="font-medium mb-2">💡 Exemples de phrases</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>"Rappelle-moi la pharmacie demain à 10h"</li>
            <li>"Prendre les médicaments à 8h30"</li>
            <li>"Appeler Marie vendredi à 14h"</li>
          </ul>
        </div>
        
        {/* Bottom spacing for nav */}
        <div className="h-20" />
      </div>
      <BottomNav />
    </PhoneFrame>
  );
};

export default Reminders;

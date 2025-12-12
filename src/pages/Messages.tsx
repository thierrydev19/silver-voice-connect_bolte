import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "@/components/PhoneFrame";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { BigButton } from "@/components/BigButton";
import { Mic, Send, Play, Pause, Trash2, MessageCircle, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Message {
  id: string;
  content: string | null;
  audio_url: string | null;
  sender_id: string;
  circle_id: string;
  created_at: string;
  sender_name?: string;
}

const Messages = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isRecording, audioBlob, audioUrl, startRecording, stopRecording, resetRecording, error } = useAudioRecorder();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [textMessage, setTextMessage] = useState("");
  const [circleId, setCircleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Récupérer le cercle de l'utilisateur
  useEffect(() => {
    const fetchCircle = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('circle_members')
        .select('circle_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      
      if (data) {
        setCircleId(data.circle_id);
      } else if (error) {
        console.log('Pas de cercle trouvé');
      }
      setLoading(false);
    };
    
    fetchCircle();
  }, [user]);

  // Récupérer les messages
  useEffect(() => {
    if (!circleId) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          audio_url,
          sender_id,
          circle_id,
          created_at
        `)
        .eq('circle_id', circleId)
        .order('created_at', { ascending: true });
      
      if (data) {
        // Récupérer les noms des expéditeurs
        const senderIds = [...new Set(data.map(m => m.sender_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', senderIds);
        
        const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);
        
        const messagesWithNames = data.map(m => ({
          ...m,
          sender_name: profileMap.get(m.sender_id) || 'Membre'
        }));
        
        setMessages(messagesWithNames);
      }
    };

    fetchMessages();

    // Écouter les nouveaux messages en temps réel
    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `circle_id=eq.${circleId}`
        },
        async (payload) => {
          const newMessage = payload.new as Message;
          
          // Récupérer le nom de l'expéditeur
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', newMessage.sender_id)
            .single();
          
          setMessages(prev => [...prev, {
            ...newMessage,
            sender_name: profile?.display_name || 'Membre'
          }]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [circleId]);

  // Scroll vers le bas quand nouveaux messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const uploadAudio = async (blob: Blob): Promise<string | null> => {
    if (!user) return null;
    
    const fileName = `${user.id}/${Date.now()}.webm`;
    
    const { data, error } = await supabase.storage
      .from('audio-messages')
      .upload(fileName, blob, {
        contentType: 'audio/webm',
        cacheControl: '3600'
      });
    
    if (error) {
      console.error('Erreur upload:', error);
      return null;
    }
    
    const { data: urlData } = supabase.storage
      .from('audio-messages')
      .getPublicUrl(data.path);
    
    return urlData.publicUrl;
  };

  const sendMessage = async (content?: string, audioFileUrl?: string) => {
    if (!circleId || !user) {
      toast.error("Vous devez rejoindre un cercle familial");
      return;
    }
    
    setSending(true);
    
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          content: content || null,
          audio_url: audioFileUrl || null,
          sender_id: user.id,
          circle_id: circleId
        });
      
      if (error) throw error;
      
      setTextMessage("");
      resetRecording();
      toast.success("Message envoyé !");
    } catch (err) {
      console.error('Erreur envoi:', err);
      toast.error("Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  const handleSendText = () => {
    if (textMessage.trim()) {
      sendMessage(textMessage.trim());
    }
  };

  const handleSendAudio = async () => {
    if (!audioBlob) return;
    
    setSending(true);
    const uploadedUrl = await uploadAudio(audioBlob);
    
    if (uploadedUrl) {
      await sendMessage(undefined, uploadedUrl);
    } else {
      toast.error("Erreur lors de l'upload audio");
      setSending(false);
    }
  };

  const togglePlay = (messageId: string, url: string) => {
    const audio = audioRefs.current[messageId];
    
    if (audio) {
      if (playingId === messageId) {
        audio.pause();
        setPlayingId(null);
      } else {
        // Pause any playing audio
        Object.values(audioRefs.current).forEach(a => a.pause());
        audio.play();
        setPlayingId(messageId);
      }
    } else {
      const newAudio = new Audio(url);
      audioRefs.current[messageId] = newAudio;
      newAudio.onended = () => setPlayingId(null);
      newAudio.play();
      setPlayingId(messageId);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  if (loading) {
    return (
      <PhoneFrame>
        <TopBar title="Messages" onBack={() => navigate(-1)} />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </PhoneFrame>
    );
  }

  if (!circleId) {
    return (
      <PhoneFrame>
        <TopBar title="Messages" onBack={() => navigate(-1)} />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <MessageCircle className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Pas encore de cercle</h2>
          <p className="text-muted-foreground">
            Rejoignez ou créez un cercle familial pour échanger des messages.
          </p>
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <TopBar title="Messages famille" onBack={() => navigate(-1)} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Liste des messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Aucun message pour l'instant</p>
              <p className="text-sm">Envoyez le premier message !</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isOwn = message.sender_id === user?.id;
              const showDate = index === 0 || 
                formatDate(messages[index - 1].created_at) !== formatDate(message.created_at);
              
              return (
                <div key={message.id}>
                  {showDate && (
                    <div className="text-center text-xs text-muted-foreground my-4">
                      {formatDate(message.created_at)}
                    </div>
                  )}
                  
                  <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] ${isOwn ? 'order-2' : 'order-1'}`}>
                      {!isOwn && (
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                            <User className="w-3 h-3 text-secondary-foreground" />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">
                            {message.sender_name}
                          </span>
                        </div>
                      )}
                      
                      <div className={`rounded-2xl p-3 ${
                        isOwn 
                          ? 'bg-primary text-primary-foreground rounded-br-md' 
                          : 'bg-secondary text-secondary-foreground rounded-bl-md'
                      }`}>
                        {message.audio_url ? (
                          <button
                            onClick={() => togglePlay(message.id, message.audio_url!)}
                            className="flex items-center gap-2"
                          >
                            {playingId === message.id ? (
                              <Pause className="w-5 h-5" />
                            ) : (
                              <Play className="w-5 h-5" />
                            )}
                            <span className="text-sm">Message vocal</span>
                          </button>
                        ) : (
                          <p className="text-sm">{message.content}</p>
                        )}
                      </div>
                      
                      <p className={`text-xs text-muted-foreground mt-1 ${isOwn ? 'text-right' : ''}`}>
                        {formatTime(message.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Zone d'enregistrement/envoi */}
        <div className="border-t bg-background p-4 space-y-3">
          {error && (
            <p className="text-destructive text-sm text-center">{error}</p>
          )}
          
          {audioUrl ? (
            <div className="flex items-center gap-3 bg-secondary/30 rounded-xl p-3">
              <audio src={audioUrl} className="hidden" />
              <button
                onClick={() => {
                  const audio = new Audio(audioUrl);
                  audio.play();
                }}
                className="p-2 rounded-full bg-primary text-primary-foreground"
              >
                <Play className="w-5 h-5" />
              </button>
              <span className="flex-1 text-sm">Message vocal prêt</span>
              <button
                onClick={resetRecording}
                className="p-2 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button
                onClick={handleSendAudio}
                disabled={sending}
                className="p-2 rounded-full bg-primary text-primary-foreground disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <>
              {/* Input texte */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={textMessage}
                  onChange={(e) => setTextMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                  placeholder="Écrivez un message..."
                  className="flex-1 px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={handleSendText}
                  disabled={!textMessage.trim() || sending}
                  className="p-3 rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              
              {/* Bouton enregistrement */}
              <BigButton
                variant={isRecording ? "secondary" : "primary"}
                icon={Mic}
                onClick={isRecording ? stopRecording : startRecording}
                className={isRecording ? "animate-pulse" : ""}
              >
                {isRecording ? "Arrêter l'enregistrement" : "Enregistrer un message vocal"}
              </BigButton>
            </>
          )}
        </div>
      </div>
      <BottomNav />
    </PhoneFrame>
  );
};

export default Messages;

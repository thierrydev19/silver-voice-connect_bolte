import { useCallback, useEffect, useRef, useState } from 'react';

type FeedbackType = 
  | 'success' 
  | 'error' 
  | 'reminder_created' 
  | 'reminder_done'
  | 'message_sent'
  | 'login_success'
  | 'logout'
  | 'navigation'
  | 'recording_start'
  | 'recording_stop';

const feedbackMessages: Record<FeedbackType, string> = {
  success: 'Action effectuée avec succès',
  error: 'Une erreur est survenue',
  reminder_created: 'Rappel créé',
  reminder_done: 'Rappel terminé',
  message_sent: 'Message envoyé',
  login_success: 'Connexion réussie',
  logout: 'Vous êtes déconnecté',
  navigation: 'Page chargée',
  recording_start: 'Enregistrement en cours',
  recording_stop: 'Enregistrement terminé',
};

interface UseVoiceFeedbackOptions {
  enabled?: boolean;
  rate?: number;
}

export const useVoiceFeedback = (options: UseVoiceFeedbackOptions = {}) => {
  const { enabled = true, rate = 1.1 } = options;
  const [isSupported, setIsSupported] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const supported = 'speechSynthesis' in window;
    setIsSupported(supported);

    if (supported) {
      const loadVoices = () => {
        voicesRef.current = window.speechSynthesis.getVoices();
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (!enabled || !('speechSynthesis' in window)) return;

    // Cancel any ongoing feedback
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Find French voice
    const frenchVoice = voicesRef.current.find(v => 
      v.lang.startsWith('fr') && v.localService
    ) || voicesRef.current.find(v => v.lang.startsWith('fr'));

    if (frenchVoice) {
      utterance.voice = frenchVoice;
    }

    utterance.lang = 'fr-FR';
    utterance.rate = rate;
    utterance.pitch = 1;
    utterance.volume = 0.8;

    window.speechSynthesis.speak(utterance);
  }, [enabled, rate]);

  const feedback = useCallback((type: FeedbackType) => {
    const message = feedbackMessages[type];
    if (message) {
      speak(message);
    }
  }, [speak]);

  const customFeedback = useCallback((message: string) => {
    speak(message);
  }, [speak]);

  return {
    feedback,
    customFeedback,
    isSupported,
    enabled,
  };
};

// Singleton pour accès global au feedback
let globalFeedbackInstance: ReturnType<typeof useVoiceFeedback> | null = null;

export const setGlobalFeedback = (instance: ReturnType<typeof useVoiceFeedback>) => {
  globalFeedbackInstance = instance;
};

export const getGlobalFeedback = () => globalFeedbackInstance;

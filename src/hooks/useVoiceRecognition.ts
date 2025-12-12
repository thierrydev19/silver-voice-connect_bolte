import { useState, useCallback, useRef, useEffect } from 'react';

interface UseVoiceRecognitionOptions {
  language?: string;
  continuous?: boolean;
  onResult?: (transcript: string) => void;
  onError?: (error: string) => void;
}

// Type definitions for Web Speech API
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
  readonly resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

// Detect if we're on Android
const isAndroid = () => {
  return /android/i.test(navigator.userAgent);
};

export const useVoiceRecognition = (options: UseVoiceRecognitionOptions = {}) => {
  const {
    language = 'fr-FR',
    continuous = false,
    onResult,
    onError,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const lastTranscriptRef = useRef<string>('');
  const hasCalledResultRef = useRef(false);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Stable refs for callbacks to avoid recreating recognition
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);
  
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // Clear silence timeout
  const clearSilenceTimeout = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  }, []);

  // Start silence timeout - on Android, submit after silence
  const startSilenceTimeout = useCallback(() => {
    clearSilenceTimeout();
    
    // On Android, use timeout to detect end of speech since isFinal is unreliable
    if (isAndroid()) {
      silenceTimeoutRef.current = setTimeout(() => {
        if (lastTranscriptRef.current && !hasCalledResultRef.current) {
          console.log('Android: Submitting via silence timeout:', lastTranscriptRef.current);
          hasCalledResultRef.current = true;
          onResultRef.current?.(lastTranscriptRef.current);
        }
        // Stop recognition after timeout
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      }, 2000); // 2 second silence = end of speech
    }
  }, [clearSilenceTimeout]);

  useEffect(() => {
    // Check for browser support
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognitionAPI);

    if (SpeechRecognitionAPI && !recognitionRef.current) {
      recognitionRef.current = new SpeechRecognitionAPI();
      recognitionRef.current.lang = language;
      recognitionRef.current.continuous = continuous;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onstart = () => {
        console.log('Speech recognition started');
        hasCalledResultRef.current = false;
        lastTranscriptRef.current = '';
      };

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        const currentTranscript = finalTranscript || interimTranscript;
        setTranscript(currentTranscript);
        
        // Store latest transcript for Android fallback
        if (currentTranscript) {
          lastTranscriptRef.current = currentTranscript;
          // Reset silence timeout on new speech
          startSilenceTimeout();
        }

        console.log('Transcript:', { finalTranscript, interimTranscript, isFinal: !!finalTranscript });

        // On desktop/iOS, isFinal works correctly
        if (finalTranscript && !hasCalledResultRef.current) {
          console.log('Final transcript detected:', finalTranscript);
          hasCalledResultRef.current = true;
          clearSilenceTimeout();
          onResultRef.current?.(finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        clearSilenceTimeout();
        
        let errorMessage = 'Erreur de reconnaissance vocale';
        switch (event.error) {
          case 'not-allowed':
            errorMessage = 'Accès au microphone refusé';
            break;
          case 'no-speech':
            // On Android, no-speech can occur even with speech - submit last transcript
            if (isAndroid() && lastTranscriptRef.current && !hasCalledResultRef.current) {
              console.log('Android no-speech fallback:', lastTranscriptRef.current);
              hasCalledResultRef.current = true;
              onResultRef.current?.(lastTranscriptRef.current);
              return;
            }
            errorMessage = 'Aucune parole détectée';
            break;
          case 'network':
            errorMessage = 'Erreur réseau';
            break;
          case 'aborted':
            // Ignore aborted errors (user stopped listening)
            return;
        }
        
        if (onErrorRef.current) {
          onErrorRef.current(errorMessage);
        }
      };

      recognitionRef.current.onend = () => {
        console.log('Speech recognition ended');
        setIsListening(false);
        
        // On Android: if we have a transcript but haven't called onResult, do it now
        if (isAndroid() && lastTranscriptRef.current && !hasCalledResultRef.current) {
          console.log('Android onend fallback:', lastTranscriptRef.current);
          hasCalledResultRef.current = true;
          onResultRef.current?.(lastTranscriptRef.current);
        }
        
        clearSilenceTimeout();
      };
    }

    return () => {
      clearSilenceTimeout();
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, [language, continuous, startSilenceTimeout, clearSilenceTimeout]);

  const startListening = useCallback(async () => {
    if (!recognitionRef.current) {
      onErrorRef.current?.('Reconnaissance vocale non supportée');
      return;
    }

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Reset state
      setTranscript('');
      lastTranscriptRef.current = '';
      hasCalledResultRef.current = false;
      
      setIsListening(true);
      recognitionRef.current.start();
      
      console.log('Started listening, isAndroid:', isAndroid());
    } catch (error) {
      console.error('Error starting recognition:', error);
      onErrorRef.current?.('Impossible d\'accéder au microphone');
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      console.log('Stopping listening manually');
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
  };
};

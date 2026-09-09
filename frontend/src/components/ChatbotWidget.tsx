import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  X, 
  Sparkles, 
  Loader2, 
  Bot, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  ExternalLink, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Syringe, 
  Calendar, 
  Pill, 
  Truck, 
  RefreshCw,
  Copy,
  Check,
  ClipboardList,
  ShieldAlert,
  AlertTriangle,
  Languages,
  Edit3,
  ChevronRight
} from 'lucide-react';
import api from '../api/instance';
import { useTheme } from '../context/ThemeContext';
import { SupportedLanguage, SUPPORTED_LANGUAGES, getTranslation } from '../utils/translations';
import { useNavigate } from 'react-router-dom';
import { useOffline } from '../context/OfflineContext';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type VoiceState = 'idle' | 'listening' | 'transcribing' | 'processing' | 'speaking' | 'error';
type AppMode = 'chat' | 'explain' | 'asha';

interface GroundedItem {
  title?: string;
  name?: string;
  status?: string;
  date?: string;
  next_due_date?: string;
  time?: string;
  doctor?: string;
  facility?: string;
  quantity?: number;
  price?: string;
  blood_group?: string;
  emergency_contact?: string;
  allergies?: string;
  available_beds?: number;
  total_beds?: number;
  icu_beds?: number;
  phone?: string;
  address?: string;
  type?: string;
  tat?: string;
  cost?: string;
}

interface GroundedData {
  type: 'vaccination' | 'followup' | 'medicine' | 'diagnostic' | 'emergency' | 'facility';
  title: string;
  count: number;
  items: GroundedItem[];
  action_link?: string;
  action_text?: string;
}

interface Message {
  role: 'user' | 'ai';
  content: string;
  language?: SupportedLanguage;
  grounded_data?: GroundedData | null;
  timestamp?: number;
}

interface FieldNoteResult {
  patient_name?: string | null;
  age_approx?: string | null;
  gender?: string | null;
  village_location?: string | null;
  symptoms?: string[];
  vitals_mentioned?: {
    temperature?: string | null;
    blood_pressure?: string | null;
    weight?: string | null;
    pulse?: string | null;
    spo2?: string | null;
  };
  observations?: string;
  recommended_action?: string | null;
  urgency_flag?: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  worker_confirmation_required: true;
  disclaimer: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Language detection helper (client-side, mirrors backend detect_language)
// ─────────────────────────────────────────────────────────────────────────────
function detectSpokenLanguage(text: string): SupportedLanguage | null {
  const devanagariCount = (text.match(/[\u0900-\u097F]/g) || []).length;
  if (devanagariCount > 2) {
    const marathiMarkers = ['आहे', 'नाही', 'कधी', 'कुठे', 'माझी', 'माझा', 'करा', 'द्या', 'सांगा', 'लस', 'औषध', 'रुग्णालय'];
    if (marathiMarkers.some(m => text.includes(m))) return 'mr';
    return 'hi';
  }
  return null; // English or unknown — don't force a switch
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function ChatbotWidget() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { effectiveOnline } = useOffline();

  // ── Widget State ──
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>('mr');
  const [mode, setMode] = useState<AppMode>('chat');
  const [copied, setCopied] = useState(false);

  // ── Voice State Machine ──
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [speechError, setSpeechError] = useState<string | null>(null);
  // Fix: useRef to mirror transcript to avoid stale closure in recognition.onend
  const interimTranscriptRef = useRef('');
  const [interimTranscript, setInterimTranscript] = useState('');
  // Track whether current input was populated by voice (shows review badge)
  const [voicePopulated, setVoicePopulated] = useState(false);
  // Track which mode the mic is targeting ('chat' | 'explain' | 'asha')
  const [micTargetMode, setMicTargetMode] = useState<AppMode>('chat');

  // ── Language Detection Prompt ──
  const [detectedLang, setDetectedLang] = useState<SupportedLanguage | null>(null);

  // ── TTS State ──
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const ttsVoicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // ── Explain Simply Mode ──
  const [explainInput, setExplainInput] = useState('');
  const [explainResult, setExplainResult] = useState<any | null>(null);
  const [explaining, setExplaining] = useState(false);

  // ── ASHA/ANM Field Note Mode ──
  const [ashaInput, setAshaInput] = useState('');
  const [ashaStructuring, setAshaStructuring] = useState(false);
  const [ashaRawNote, setAshaRawNote] = useState<FieldNoteResult | null>(null);
  const [ashaShowConfirm, setAshaShowConfirm] = useState(false);
  const [ashaConfirmedNote, setAshaConfirmedNote] = useState<FieldNoteResult | null>(null);
  const [ashaEditMode, setAshaEditMode] = useState(false);

  // ── Refs ──
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  // Real-time audio waveform visualizer
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const waveStreamRef = useRef<MediaStream | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Initialisation
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('preferred_language') as SupportedLanguage;
    if (saved && ['mr', 'hi', 'en'].includes(saved)) setCurrentLang(saved);
  }, []);

  // Pre-load TTS voices once widget opens
  useEffect(() => {
    if (!isOpen || !('speechSynthesis' in window)) return;
    const loadVoices = () => {
      ttsVoicesRef.current = window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, interimTranscript, explainResult, ashaRawNote]);

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      stopVoiceInput();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Language
  // ─────────────────────────────────────────────────────────────────────────
  const handleLanguageChange = async (lang: SupportedLanguage) => {
    setCurrentLang(lang);
    setDetectedLang(null);
    localStorage.setItem('preferred_language', lang);
    try { await api.patch('/profile/language', { preferred_language: lang }); } catch (_) {}
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Waveform Canvas — Real-time audio amplitude visualizer
  // ─────────────────────────────────────────────────────────────────────────
  const startWaveformVisualization = useCallback((stream: MediaStream) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      waveStreamRef.current = stream;

      const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas || !analyserRef.current) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const bufferLen = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLen);
        analyserRef.current.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const barWidth = (canvas.width / bufferLen) * 2.5;
        let x = 0;
        for (let i = 0; i < bufferLen; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height * 0.85;
          const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
          gradient.addColorStop(0, 'rgba(239, 68, 68, 0.9)');
          gradient.addColorStop(1, 'rgba(239, 68, 68, 0.2)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, canvas.height - barHeight, barWidth - 1, barHeight, 2);
          ctx.fill();
          x += barWidth + 1;
        }
        animFrameRef.current = requestAnimationFrame(draw);
      };
      draw();
    } catch (e) {
      console.warn('Waveform visualization error:', e);
    }
  }, []);

  const stopWaveformVisualization = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (_) {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    // Clear canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Voice Input — State Machine
  // ─────────────────────────────────────────────────────────────────────────
  const stopVoiceInput = useCallback(() => {
    stopWaveformVisualization();
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try { mediaRecorderRef.current.stop(); } catch (_) {}
    }
  }, [stopWaveformVisualization]);

  const startListening = (targetMode?: AppMode) => {
    const activeMode = targetMode || mode;
    setMicTargetMode(activeMode);
    setSpeechError(null);
    setDetectedLang(null);
    setInterimTranscript('');
    interimTranscriptRef.current = '';
    setVoicePopulated(false);

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = false;
        recognition.interimResults = true;

        const speechLangMap: Record<SupportedLanguage, string> = { mr: 'mr-IN', hi: 'hi-IN', en: 'en-IN' };
        recognition.lang = speechLangMap[currentLang] || 'mr-IN';

        recognition.onstart = () => setVoiceState('listening');

        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
          }
          // Sync both ref (closure-safe) and state (UI display)
          interimTranscriptRef.current = transcript;
          setInterimTranscript(transcript);
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          if (event.error === 'not-allowed' || event.error === 'permission-denied') {
            setVoiceState('error');
            setSpeechError(getTranslation(currentLang, 'mic_permission_denied'));
          } else if (event.error === 'no-speech') {
            setVoiceState('idle');
          } else {
            // Fallback to MediaRecorder → Groq Whisper
            setVoiceState('idle');
            startMediaRecorderFallback(activeMode);
          }
        };

        recognition.onend = () => {
          // Use ref value — immune to stale closure
          const finalText = interimTranscriptRef.current.trim();
          setInterimTranscript('');
          interimTranscriptRef.current = '';
          stopWaveformVisualization();

          if (finalText) {
            // ── KEY CHANGE: Never auto-send. Populate the field for user review ──
            if (activeMode === 'asha') {
              setAshaInput(finalText);
              setVoiceState('idle');
            } else if (activeMode === 'explain') {
              setExplainInput(finalText);
              setVoiceState('idle');
            } else {
              // chat mode — populate input, show review badge, do NOT auto-send
              setInput(finalText);
              setVoicePopulated(true);
              setVoiceState('idle');
              // Auto-detect language from spoken text
              const detectedFromText = detectSpokenLanguage(finalText);
              if (detectedFromText && detectedFromText !== currentLang) {
                setDetectedLang(detectedFromText);
              }
            }
          } else {
            setVoiceState('idle');
          }
        };

        recognition.start();
        // Also start waveform visualizer via getUserMedia for canvas drawing
        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
          startWaveformVisualization(stream);
          // Keep stream ref but don't record — recognition does the work
          waveStreamRef.current = stream;
        }).catch(() => { /* waveform is optional */ });
        return;
      } catch (e) {
        console.warn('SpeechRecognition failed, falling back to MediaRecorder:', e);
      }
    }

    // No Web Speech API — use MediaRecorder → Groq Whisper
    startMediaRecorderFallback(activeMode);
  };

  const startMediaRecorderFallback = async (targetMode?: AppMode) => {
    const activeMode = targetMode || mode;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      // Start waveform visualization on the same stream
      startWaveformVisualization(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        stopWaveformVisualization();
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size > 500) {
          setVoiceState('transcribing');
          await handleTranscribeAudio(audioBlob, activeMode);
        } else {
          setVoiceState('idle');
        }
      };

      mediaRecorder.start();
      setVoiceState('listening');
    } catch (err: any) {
      stopWaveformVisualization();
      setVoiceState('error');
      setSpeechError(getTranslation(currentLang, 'mic_permission_denied'));
    }
  };

  const handleStopListening = () => {
    stopVoiceInput();
    setVoiceState('idle');
    setInterimTranscript('');
    interimTranscriptRef.current = '';
  };

  const handleMicClick = (targetMode?: AppMode) => {
    if (voiceState === 'listening') {
      // Stop and let recognition.onend or mediaRecorder.onstop handle sending
      stopVoiceInput();
    } else if (voiceState === 'idle' || voiceState === 'error') {
      startListening(targetMode || mode);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Groq Whisper Transcription
  // ─────────────────────────────────────────────────────────────────────────
  const handleTranscribeAudio = async (blob: Blob, targetMode?: AppMode) => {
    const activeMode = targetMode || mode;
    try {
      const formData = new FormData();
      formData.append('file', blob, 'voice_query.webm');
      formData.append('language', currentLang);

      const resp = await api.post('/chatbot/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Handle empty_audio flag from backend
      if (resp.data.empty_audio || !resp.data.transcription) {
        setVoiceState('idle');
        return;
      }

      const text = resp.data.transcription;
      const backendDetectedLang = resp.data.detected_language as SupportedLanguage | undefined;

      // Use backend-detected language, then client-side detection, then current
      const detectedFromText = detectSpokenLanguage(text);
      const finalDetected = backendDetectedLang || detectedFromText;
      if (finalDetected && finalDetected !== currentLang) {
        setDetectedLang(finalDetected);
      }

      // ── KEY CHANGE: Populate field for user review; never auto-send ──
      if (activeMode === 'asha') {
        setAshaInput(text);
        setVoiceState('idle');
      } else if (activeMode === 'explain') {
        setExplainInput(text);
        setVoiceState('idle');
      } else {
        // chat mode — show transcription in input for review
        setInput(text);
        setVoicePopulated(true);
        setVoiceState('idle');
      }
    } catch (err: any) {
      console.error('Audio transcription error:', err);
      setSpeechError(
        currentLang === 'mr'
          ? 'ऑडिओ ट्रान्सक्राइब करता आले नाही. कृपया टाईप करा.'
          : currentLang === 'hi'
          ? 'ऑडियो ट्रांसक्राइब नहीं हो सका। कृपया टाइप करें।'
          : 'Audio could not be transcribed. Please type instead.'
      );
      setVoiceState('error');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Chat Message
  // ─────────────────────────────────────────────────────────────────────────
  const handleSendMessage = async (textToSend?: string) => {
    const userMsg = (textToSend || input).trim();
    if (!userMsg || loading) return;

    // Track if this was a voice-populated send (for auto-TTS)
    const wasVoiceInput = voicePopulated;
    setVoicePopulated(false);

    setMessages(prev => [
      ...prev,
      { role: 'user', content: userMsg, language: currentLang, timestamp: Date.now() },
    ]);
    setInput('');
    setInterimTranscript('');
    interimTranscriptRef.current = '';

    if (!effectiveOnline) {
      const offlineMsg =
        currentLang === 'mr'
          ? '⚠️ तुम्ही सध्या ऑफलाइन मोडमध्ये आहात. थेट AI सहाय्यासाठी इंटरनेट कनेक्शन आवश्यक आहे.'
          : currentLang === 'hi'
          ? '⚠️ आप वर्तमान में ऑफ़लाइन मोड में हैं। लाइव AI सहायता के लिए इंटरनेट आवश्यक है।'
          : '⚠️ You are currently in Offline Mode. Live AI healthcare requests require an active internet connection.';
      setMessages(prev => [...prev, { role: 'ai', content: offlineMsg, language: currentLang, timestamp: Date.now() }]);
      setVoiceState('idle');
      return;
    }

    setLoading(true);
    setVoiceState('processing');

    try {
      const payload = {
        message: userMsg,
        language: currentLang,
        history: messages.map(m => ({ role: m.role, content: m.content })),
      };

      const response = await api.post('/chatbot/ask', payload);
      const aiContent = response.data.response;
      const grounded = response.data.grounded_data;

      setMessages(prev => [
        ...prev,
        { role: 'ai', content: aiContent, language: currentLang, grounded_data: grounded, timestamp: Date.now() },
      ]);

      // Auto-play TTS if the original query came from voice input
      if (wasVoiceInput) {
        speakResponse(aiContent, currentLang);
      } else {
        setVoiceState('idle');
      }
    } catch (err: any) {
      let errorMsg = 'न्यूरल लिंक संपर्क खंडित झाला आहे. कृपया पुन्हा प्रयत्न करा.';
      if (currentLang === 'en') errorMsg = 'Neural connection interrupted. Please try again.';
      else if (currentLang === 'hi') errorMsg = 'नेटवर्क कनेक्शन में बाधा आई है। कृपया पुनः प्रयास करें।';

      if (err.response?.status === 401) {
        errorMsg = currentLang === 'mr' ? 'कृपया AI वापरण्यासाठी लॉग इन करा.' : 'Please login to access AI assistant.';
      } else if (err.response?.data?.detail) {
        errorMsg = err.response.data.detail;
      }

      setMessages(prev => [...prev, { role: 'ai', content: errorMsg, language: currentLang, timestamp: Date.now() }]);
      setVoiceState('idle');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Text-To-Speech
  // ─────────────────────────────────────────────────────────────────────────
  const speakResponse = (text: string, lang: SupportedLanguage, index?: number) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    if (speakingIndex === index && index !== undefined) {
      setSpeakingIndex(null);
      setVoiceState('idle');
      return;
    }

    const cleanText = text.replace(/[#*_`~>-]/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1').replace(/\n+/g, '. ').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voiceLangMap: Record<SupportedLanguage, string> = { mr: 'mr-IN', hi: 'hi-IN', en: 'en-IN' };
    utterance.lang = voiceLangMap[lang] || 'mr-IN';
    utterance.rate = 0.92;
    utterance.pitch = 1.0;

    // Use pre-loaded voices (immune to race condition on first open)
    const voices = ttsVoicesRef.current.length > 0 ? ttsVoicesRef.current : window.speechSynthesis.getVoices();
    const match = voices.find(v => v.lang.toLowerCase().startsWith(utterance.lang.toLowerCase().substring(0, 5)));
    if (match) utterance.voice = match;

    utterance.onstart = () => {
      if (index !== undefined) setSpeakingIndex(index);
      setVoiceState('speaking');
    };
    utterance.onend = () => { setSpeakingIndex(null); setVoiceState('idle'); };
    utterance.onerror = () => { setSpeakingIndex(null); setVoiceState('idle'); };

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); }
    setSpeakingIndex(null);
    setVoiceState('idle');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Explain Simply
  // ─────────────────────────────────────────────────────────────────────────
  const handleExplainSimply = async () => {
    if (!explainInput.trim() || explaining) return;
    setExplaining(true);
    setExplainResult(null);
    try {
      const resp = await api.post('/chatbot/explain-simply', { text: explainInput.trim(), language: currentLang });
      setExplainResult(resp.data);
    } catch (err: any) {
      console.error('Explain simply error:', err);
    } finally {
      setExplaining(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ASHA/ANM Field Note
  // ─────────────────────────────────────────────────────────────────────────
  const handleStructureFieldNote = async () => {
    if (!ashaInput.trim() || ashaStructuring) return;
    setAshaStructuring(true);
    setAshaRawNote(null);
    setAshaConfirmedNote(null);
    setAshaShowConfirm(false);

    try {
      const resp = await api.post('/chatbot/structure-field-note', {
        spoken_text: ashaInput.trim(),
        language: currentLang,
      });
      setAshaRawNote(resp.data.structured_note);
      setAshaShowConfirm(true);
    } catch (err: any) {
      console.error('Field note structuring error:', err);
      setSpeechError(
        currentLang === 'mr'
          ? 'नोंद संरचित करता आली नाही. कृपया पुन्हा प्रयत्न करा.'
          : 'Could not structure the note. Please try again.'
      );
    } finally {
      setAshaStructuring(false);
    }
  };

  const handleConfirmAshaNote = () => {
    if (!ashaRawNote) return;
    setAshaConfirmedNote(ashaRawNote);
    setAshaShowConfirm(false);
    setAshaRawNote(null);
  };

  const handleCancelAshaNote = () => {
    setAshaShowConfirm(false);
    setAshaRawNote(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Quick Prompts
  // ─────────────────────────────────────────────────────────────────────────
  const quickPrompts = [
    { label: getTranslation(currentLang, 'prompt_vaccine'), icon: Syringe },
    { label: getTranslation(currentLang, 'prompt_medicine'), icon: Pill },
    { label: getTranslation(currentLang, 'prompt_followup'), icon: Calendar },
    { label: getTranslation(currentLang, 'prompt_hospital'), icon: Building2 },
    { label: getTranslation(currentLang, 'prompt_emergency'), icon: Truck },
  ];

  const glassClass = theme === 'dark' ? 'glass-dark' : 'glass-light';
  const isListening = voiceState === 'listening';

  // ─────────────────────────────────────────────────────────────────────────
  // Urgency badge helper
  // ─────────────────────────────────────────────────────────────────────────
  const getUrgencyStyle = (flag?: string) => {
    if (flag === 'EMERGENCY') return 'bg-rose-500/15 text-rose-500 border-rose-500/30';
    if (flag === 'URGENT') return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
    return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
  };

  const getUrgencyLabel = (flag?: string) => {
    if (flag === 'EMERGENCY') return getTranslation(currentLang, 'asha_urgency_emergency');
    if (flag === 'URGENT') return getTranslation(currentLang, 'asha_urgency_urgent');
    return getTranslation(currentLang, 'asha_urgency_routine');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Voice Flow Step Indicator
  // ─────────────────────────────────────────────────────────────────────────
  const VoiceFlowIndicator = () => {
    const steps = [
      { key: 'ask', label: getTranslation(currentLang, 'voice_flow_ask'), activeStates: ['listening'] as VoiceState[] },
      { key: 'transcribe', label: getTranslation(currentLang, 'voice_flow_transcribe'), activeStates: ['transcribing'] as VoiceState[] },
      { key: 'process', label: getTranslation(currentLang, 'voice_flow_process'), activeStates: ['processing'] as VoiceState[] },
      { key: 'listen', label: getTranslation(currentLang, 'voice_flow_listen'), activeStates: ['speaking'] as VoiceState[] },
    ];
    const currentStepIndex = steps.findIndex(s => s.activeStates.includes(voiceState));

    return (
      <div className="flex items-center justify-center space-x-1 py-1.5">
        {steps.map((step, idx) => {
          const isActive = idx === currentStepIndex;
          const isDone = currentStepIndex > idx;
          return (
            <div key={step.key} className="flex items-center">
              <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all duration-300 ${
                isActive
                  ? 'bg-rose-500/20 text-rose-500 border border-rose-500/40 scale-105'
                  : isDone
                  ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/20'
                  : 'bg-white/5 text-slate-500 border border-white/10'
              }`}>
                <span>{step.label}</span>
              </div>
              {idx < steps.length - 1 && (
                <ChevronRight size={10} className={`mx-0.5 ${
                  isDone ? 'text-emerald-500' : currentStepIndex >= idx ? 'text-rose-500/60' : 'text-slate-600'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Mic Button state
  // ─────────────────────────────────────────────────────────────────────────
  const micBtnClass = (forMode?: AppMode) => {
    const targetState = voiceState;
    if (targetState === 'listening') return 'bg-rose-500 text-white shadow-rose-500/60 shadow-lg ring-4 ring-rose-500/30';
    if (targetState === 'transcribing') return 'bg-amber-500 text-white shadow-amber-500/40 shadow-lg animate-pulse';
    if (targetState === 'processing') return theme === 'dark' ? 'bg-cyan-500/30 text-cyan-400' : 'bg-blue-100 text-blue-600';
    if (targetState === 'error') return 'bg-rose-500/20 text-rose-500 border border-rose-500/30';
    return theme === 'dark'
      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 hover:shadow-cyan-500/20 hover:shadow-lg'
      : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 hover:shadow-blue-500/20 hover:shadow-lg';
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`w-[460px] max-w-[95vw] h-[680px] mb-4 ${glassClass} border border-white/20 dark:border-cyan-500/20 shadow-2xl rounded-3xl flex flex-col overflow-hidden backdrop-blur-3xl`}
          >
            {/* ── Header ── */}
            <div className={`px-4 pt-4 pb-3 border-b border-white/10 ${theme === 'dark' ? 'bg-white/5' : 'bg-blue-50/50'} flex flex-col space-y-3`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg ${
                    theme === 'dark' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-blue-600 text-white shadow-blue-500/20'
                  }`}>
                    <Bot size={22} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-wide leading-tight">
                      {getTranslation(currentLang, 'assistant_title')}
                    </h3>
                    <div className="flex items-center space-x-1.5 mt-0.5">
                      <div className={`w-2 h-2 rounded-full ${effectiveOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {effectiveOnline ? getTranslation(currentLang, 'assistant_status') : 'Offline (AI Paused)'}
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all text-slate-400 hover:text-slate-200">
                  <X size={20} />
                </button>
              </div>

              {/* Language + Mode Tabs */}
              <div className="flex items-center justify-between pt-0.5 gap-2">
                {/* Language Segmented Toggle */}
                <div className="flex items-center space-x-0.5 bg-black/10 dark:bg-black/30 p-1 rounded-xl border border-white/10 text-xs font-bold">
                  {SUPPORTED_LANGUAGES.map(l => (
                    <button
                      key={l.code}
                      onClick={() => handleLanguageChange(l.code)}
                      className={`px-2.5 py-1 rounded-lg transition-all text-[11px] ${
                        currentLang === l.code
                          ? theme === 'dark'
                            ? 'bg-cyan-500 text-black font-black shadow-md'
                            : 'bg-blue-600 text-white font-black shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {l.nativeName}
                    </button>
                  ))}
                </div>

                {/* Mode Selector */}
                <div className="flex items-center space-x-0.5 bg-black/10 dark:bg-black/30 p-1 rounded-xl border border-white/10 text-xs">
                  {([
                    { key: 'chat', label: 'Chat', icon: Bot },
                    { key: 'explain', label: getTranslation(currentLang, 'explain_simply_btn').split(' ')[0], icon: FileText },
                    { key: 'asha', label: getTranslation(currentLang, 'asha_mode_tab'), icon: ClipboardList },
                  ] as { key: AppMode; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setMode(key)}
                      className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                        mode === key
                          ? theme === 'dark' ? 'bg-white/20 text-white' : 'bg-white text-blue-600 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Icon size={11} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Error / Speech Error Banner ── */}
            {speechError && (
              <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-xs text-amber-500 font-medium">
                <div className="flex items-center space-x-2">
                  <AlertCircle size={14} />
                  <span>{speechError}</span>
                </div>
                <button onClick={() => { setSpeechError(null); setVoiceState('idle'); }} className="p-1 hover:opacity-75">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* ── Language Detection Prompt Banner ── */}
            {detectedLang && detectedLang !== currentLang && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-2 flex items-center justify-between text-xs font-medium"
              >
                <div className="flex items-center space-x-2 text-blue-400">
                  <Languages size={14} />
                  <span>
                    {getTranslation(currentLang, 'voice_lang_switch_prompt')}{' '}
                    <strong>{SUPPORTED_LANGUAGES.find(l => l.code === detectedLang)?.nativeName}</strong>
                  </span>
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => { handleLanguageChange(detectedLang); setDetectedLang(null); }}
                    className="px-2 py-0.5 rounded-lg bg-blue-500 text-white text-[10px] font-black"
                  >
                    {getTranslation(currentLang, 'voice_lang_switch_yes')}
                  </button>
                  <button onClick={() => setDetectedLang(null)} className="px-2 py-0.5 rounded-lg bg-white/10 text-slate-300 text-[10px] font-bold">
                    {getTranslation(currentLang, 'voice_lang_switch_no')}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ════════════════════════════════════════
                MODE: CHAT
            ════════════════════════════════════════ */}
            {mode === 'chat' && (
              <>
                {/* Messages Stream */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                  {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 px-4 py-8">
                      <div className={`p-4 rounded-3xl ${theme === 'dark' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-blue-50 text-blue-600'} animate-bounce`}>
                        <Sparkles size={36} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                          {getTranslation(currentLang, 'assistant_welcome')}
                        </p>
                        <p className="text-[11px] text-slate-400 font-medium">
                          {currentLang === 'mr'
                            ? 'लसीकरण, औषधे, फॉलो-अप किंवा जवळचे रुग्णालय याबद्दल बोला किंवा विचारा.'
                            : currentLang === 'hi'
                            ? 'टीकाकरण, दवाइयां, फॉलो-अप या नजदीकी अस्पताल के बारे में पूछें।'
                            : 'Ask about vaccinations, medicine stock, follow-ups, or hospital beds.'}
                        </p>
                      </div>

                      {/* Quick Prompt Chips */}
                      <div className="w-full space-y-1.5 pt-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-left px-1">
                          {currentLang === 'mr' ? 'सुचवलेले प्रश्न:' : currentLang === 'hi' ? 'सुझाए गए प्रश्न:' : 'Suggested Questions:'}
                        </p>
                        <div className="flex flex-col space-y-1.5">
                          {quickPrompts.map((p, idx) => {
                            const Icon = p.icon;
                            return (
                              <button
                                key={idx}
                                onClick={() => { setInput(p.label); handleSendMessage(p.label); }}
                                className="flex items-center space-x-2.5 p-2.5 text-left rounded-xl bg-white/5 dark:bg-white/5 hover:bg-blue-500/10 dark:hover:bg-cyan-500/10 border border-white/10 dark:border-white/5 transition-all text-xs font-semibold group"
                              >
                                <Icon size={14} className={theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'} />
                                <span className="flex-1 text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors">
                                  {p.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Messages */}
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-2`}>
                      <div className="flex items-start space-x-2 max-w-[90%]">
                        <div className={`p-4 rounded-2xl ${
                          msg.role === 'user'
                            ? theme === 'dark'
                              ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 rounded-tr-none font-medium'
                              : 'bg-blue-600 text-white rounded-tr-none font-medium shadow-md shadow-blue-500/20'
                            : theme === 'dark'
                            ? 'bg-white/5 border border-white/10 text-slate-200 rounded-tl-none'
                            : 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-none shadow-sm'
                        } text-[13px] leading-relaxed whitespace-pre-line`}>
                          {msg.content}

                          {/* TTS button on AI messages */}
                          {msg.role === 'ai' && (
                            <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                              <button
                                onClick={() =>
                                  speakingIndex === i ? stopSpeaking() : speakResponse(msg.content, msg.language || currentLang, i)
                                }
                                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg transition-all text-[11px] font-bold ${
                                  speakingIndex === i
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse'
                                    : 'hover:bg-white/10 hover:text-slate-200'
                                }`}
                              >
                                {speakingIndex === i ? <VolumeX size={14} /> : <Volume2 size={14} />}
                                <span>{speakingIndex === i ? getTranslation(currentLang, 'stop_audio') : getTranslation(currentLang, 'listen_audio')}</span>
                              </button>
                              <span className="text-[10px] opacity-60">
                                {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Grounded Healthcare Data Card */}
                      {msg.grounded_data && (
                        <div className="w-full max-w-[92%] mt-1">
                          <div className={`p-3.5 rounded-2xl border ${
                            theme === 'dark' ? 'bg-cyan-950/20 border-cyan-500/30' : 'bg-blue-50/80 border-blue-200'
                          } space-y-2.5 shadow-lg`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                {msg.grounded_data.type === 'vaccination' && <Syringe size={16} className="text-blue-500" />}
                                {msg.grounded_data.type === 'medicine' && <Pill size={16} className="text-emerald-500" />}
                                {msg.grounded_data.type === 'followup' && <Calendar size={16} className="text-purple-500" />}
                                {msg.grounded_data.type === 'facility' && <Building2 size={16} className="text-indigo-500" />}
                                {msg.grounded_data.type === 'emergency' && <Truck size={16} className="text-rose-500" />}
                                <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                                  {msg.grounded_data.title}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                                {msg.grounded_data.items.length} {currentLang === 'en' ? 'records' : 'नोंदी'}
                              </span>
                            </div>

                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 scrollbar-hide text-xs">
                              {msg.grounded_data.items.map((item, idx) => (
                                <div key={idx} className="p-2 rounded-xl bg-white/40 dark:bg-black/20 border border-white/20 dark:border-white/5 flex flex-col space-y-1">
                                  <div className="flex items-center justify-between font-bold text-[11px]">
                                    <span className="text-slate-800 dark:text-slate-200">{item.title || item.name}</span>
                                    {item.status && (
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                                        item.status.includes('COMPLETED') || item.status.includes('Available')
                                          ? 'bg-emerald-500/15 text-emerald-500'
                                          : item.status.includes('DUE') || item.status.includes('Low')
                                          ? 'bg-amber-500/15 text-amber-500'
                                          : 'bg-blue-500/15 text-blue-500'
                                      }`}>
                                        {item.status}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5">
                                    {item.next_due_date && <div>पुढील तारीख: <strong className="text-slate-700 dark:text-slate-300">{item.next_due_date}</strong></div>}
                                    {item.date && <div>दिनांक: {item.date} {item.time && `• ${item.time}`}</div>}
                                    {item.facility && <div>रुग्णालय: {item.facility}</div>}
                                    {item.quantity !== undefined && <div>उपलब्ध साठा: <strong>{item.quantity}</strong></div>}
                                    {item.available_beds !== undefined && <div>उपलब्ध खाटा: <strong>{item.available_beds}</strong> (ICU: {item.icu_beds})</div>}
                                    {item.phone && <div>हेल्पलाईन: <strong>{item.phone}</strong></div>}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {msg.grounded_data.action_link && (
                              <button
                                onClick={() => { setIsOpen(false); navigate(msg.grounded_data!.action_link!); }}
                                className="w-full mt-2 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center justify-center space-x-1.5 shadow-md shadow-blue-500/20 transition-all"
                              >
                                <span>{msg.grounded_data.action_text || getTranslation(currentLang, 'open_module')}</span>
                                <ExternalLink size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* AI Thinking State */}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="p-4 rounded-2xl rounded-tl-none bg-white/5 border border-white/10 flex items-center space-x-3 text-xs text-slate-400">
                        <Loader2 className="animate-spin text-blue-500" size={16} />
                        <span>{getTranslation(currentLang, 'processing_state')}</span>
                      </div>
                    </div>
                  )}

                  {/* Transcribing State */}
                  {voiceState === 'transcribing' && !loading && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center space-x-3"
                    >
                      <Loader2 className="animate-spin text-amber-500" size={16} />
                      <span className="text-xs font-bold text-amber-500">{getTranslation(currentLang, 'voice_state_transcribing')}</span>
                    </motion.div>
                  )}

                  {/* Listening Waveform Banner with real-time canvas */}
                  {isListening && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-2"
                    >
                      {/* Canvas waveform */}
                      <canvas
                        ref={canvasRef}
                        width={380}
                        height={40}
                        className="w-full rounded-lg"
                        style={{ imageRendering: 'pixelated' }}
                      />
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-rose-500">{getTranslation(currentLang, 'listening_state')}</p>
                          <p className="text-[11px] text-slate-300 italic truncate max-w-[220px]">
                            {interimTranscript || (currentLang === 'mr' ? 'मराठीत बोला...' : currentLang === 'hi' ? 'हिंदी में बोलें...' : 'Speak now...')}
                          </p>
                        </div>
                        <button
                          onClick={handleStopListening}
                          className="px-3 py-1.5 rounded-xl bg-rose-500 text-white text-[10px] font-black uppercase tracking-wider shadow-md hover:bg-rose-600 transition-all"
                        >
                          {getTranslation(currentLang, 'cancel')}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* ── Input Area ── */}
                <div className="p-3.5 border-t border-white/10 bg-white/5 dark:bg-black/20 space-y-2">

                  {/* Voice Flow Step Indicator — shown during any active voice state */}
                  {(voiceState !== 'idle' && voiceState !== 'error') && (
                    <VoiceFlowIndicator />
                  )}

                  {/* Voice Review Badge — shown when input was populated by voice */}
                  {voicePopulated && input.trim() && voiceState === 'idle' && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-[11px]"
                    >
                      <div className="flex items-center space-x-2 text-emerald-500 font-bold">
                        <Mic size={12} />
                        <span>{getTranslation(currentLang, 'voice_review_badge')}</span>
                      </div>
                      <span className="text-slate-400 text-[10px]">{getTranslation(currentLang, 'voice_review_or_edit')}</span>
                    </motion.div>
                  )}

                  {/* Large Mic + Text Input + Send */}
                  <div className="flex items-center space-x-2">
                    {/* Mic Button — large touch-friendly (14 = 56px) */}
                    <button
                      id="voice-mic-btn"
                      onClick={() => handleMicClick('chat')}
                      disabled={voiceState === 'transcribing' || voiceState === 'processing' || !effectiveOnline}
                      title={isListening ? getTranslation(currentLang, 'stop_speak_tooltip') : getTranslation(currentLang, 'speak_btn_tooltip')}
                      className={`relative w-14 h-14 rounded-2xl transition-all flex-shrink-0 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed ${micBtnClass('chat')}`}
                    >
                      {voiceState === 'transcribing' || voiceState === 'processing'
                        ? <Loader2 size={22} className="animate-spin" />
                        : isListening
                        ? <MicOff size={22} />
                        : <Mic size={22} />
                      }
                      {/* Pulse ring for listening state */}
                      {isListening && (
                        <span className="absolute inset-0 rounded-2xl ring-4 ring-rose-400/40 animate-ping" />
                      )}
                    </button>

                    <input
                      value={input}
                      onChange={(e) => { setInput(e.target.value); if (voicePopulated) setVoicePopulated(false); }}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder={getTranslation(currentLang, 'type_placeholder')}
                      className={`flex-1 bg-white/5 dark:bg-black/30 border rounded-2xl px-4 py-3 text-[13px] font-medium outline-none focus:ring-2 ring-blue-500 dark:ring-cyan-400 transition-all text-slate-800 dark:text-white placeholder:text-slate-400 ${
                        voicePopulated && input.trim()
                          ? 'border-emerald-500/40 bg-emerald-500/5'
                          : 'border-white/10'
                      }`}
                    />

                    <button
                      onClick={() => handleSendMessage()}
                      disabled={loading || !input.trim()}
                      className={`w-12 h-12 rounded-2xl transition-all shadow-md flex items-center justify-center flex-shrink-0 ${
                        theme === 'dark'
                          ? 'bg-cyan-500 text-black hover:bg-cyan-400 font-bold'
                          : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20 font-bold'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      <Send size={18} />
                    </button>
                  </div>

                  {/* Voice state label */}
                  {(voiceState !== 'idle' && voiceState !== 'listening') && (
                    <p className="text-[10px] text-center text-slate-400 font-medium">
                      {voiceState === 'transcribing' && getTranslation(currentLang, 'voice_state_transcribing')}
                      {voiceState === 'processing' && getTranslation(currentLang, 'processing_state')}
                      {voiceState === 'speaking' && getTranslation(currentLang, 'speaking_state')}
                      {voiceState === 'error' && getTranslation(currentLang, 'voice_state_error')}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* ════════════════════════════════════════
                MODE: EXPLAIN SIMPLY
            ════════════════════════════════════════ */}
            {mode === 'explain' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-hide">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-blue-500">
                    <FileText size={18} />
                    <h4 className="text-sm font-black uppercase tracking-wider">{getTranslation(currentLang, 'explain_simply_title')}</h4>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">{getTranslation(currentLang, 'explain_simply_desc')}</p>
                </div>

                <div className="space-y-2">
                  {/* Textarea with dictation mic inside */}
                  <div className="relative">
                    <textarea
                      rows={4}
                      value={explainInput}
                      onChange={(e) => setExplainInput(e.target.value)}
                      placeholder={getTranslation(currentLang, 'explain_simply_placeholder')}
                      className="w-full bg-white/5 dark:bg-black/30 border border-white/10 rounded-2xl p-3.5 text-xs font-medium outline-none focus:ring-2 ring-blue-500 text-slate-800 dark:text-white placeholder:text-slate-400 resize-none pr-14"
                    />
                    {/* Dictation mic button inside textarea */}
                    <button
                      onClick={() => handleMicClick('explain')}
                      disabled={voiceState === 'transcribing' || !effectiveOnline}
                      title={getTranslation(currentLang, 'voice_dictate_tooltip')}
                      className={`absolute bottom-3 right-3 w-10 h-10 rounded-xl transition-all flex items-center justify-center ${micBtnClass('explain')}`}
                    >
                      {isListening && micTargetMode === 'explain' ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                  </div>
                  {/* Listening indicator for explain mode */}
                  {isListening && micTargetMode === 'explain' && (
                    <div className="flex items-center space-x-2 text-rose-500 text-xs font-bold px-1">
                      <span className="w-1.5 h-3 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-5 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-2 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      <span>{interimTranscript || getTranslation(currentLang, 'listening_state')}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400">
                      उदा: "Tab Paracetamol 650mg TDS 3 days post meals."
                    </span>
                    <button
                      onClick={handleExplainSimply}
                      disabled={explaining || !explainInput.trim()}
                      className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md disabled:opacity-40 transition-all flex items-center space-x-1.5"
                    >
                      {explaining && <Loader2 size={12} className="animate-spin" />}
                      <span>{explaining ? (currentLang === 'mr' ? 'तयार होत आहे...' : 'Processing...') : getTranslation(currentLang, 'explain_simply_btn')}</span>
                    </button>
                  </div>
                </div>

                {explainResult && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-2xl border ${
                      theme === 'dark' ? 'bg-cyan-950/20 border-cyan-500/30' : 'bg-blue-50 border-blue-200'
                    } space-y-3 shadow-xl`}
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <h5 className="font-extrabold text-sm text-slate-800 dark:text-white">
                        {explainResult.simplified_title || 'सोपे स्पष्टीकरण'}
                      </h5>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(explainResult.simplified_explanation || '');
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
                      >
                        {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </button>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                      {explainResult.simplified_explanation}
                    </p>

                    {explainResult.what_you_need_to_do?.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {getTranslation(currentLang, 'explain_action_steps')}
                        </p>
                        <ul className="space-y-1">
                          {explainResult.what_you_need_to_do.map((step: string, sIdx: number) => (
                            <li key={sIdx} className="text-xs flex items-start space-x-2">
                              <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                              <span className="text-slate-700 dark:text-slate-300">{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {explainResult.preserved_critical_details?.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {getTranslation(currentLang, 'explain_preserved')}
                        </p>
                        <div className="p-2 rounded-xl bg-black/10 dark:bg-black/30 text-[11px] font-mono text-cyan-400 border border-white/5">
                          {explainResult.preserved_critical_details.join(', ')}
                        </div>
                      </div>
                    )}

                    <p className="text-[9px] text-slate-400 italic pt-1 border-t border-white/5">{explainResult.disclaimer}</p>
                  </motion.div>
                )}
              </div>
            )}

            {/* ════════════════════════════════════════
                MODE: ASHA/ANM FIELD NOTE
            ════════════════════════════════════════ */}
            {mode === 'asha' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide relative">
                {/* Header */}
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-violet-500">
                    <ClipboardList size={18} />
                    <h4 className="text-sm font-black uppercase tracking-wider">{getTranslation(currentLang, 'asha_mode_title')}</h4>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">{getTranslation(currentLang, 'asha_mode_desc')}</p>
                </div>

                {/* Safety Disclaimer Banner */}
                <div className="flex items-start space-x-2.5 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-xs text-amber-500">
                  <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                  <p className="font-medium leading-relaxed">{getTranslation(currentLang, 'asha_disclaimer')}</p>
                </div>

                {/* Voice + Text Input */}
                <div className="space-y-2">
                  <div className="relative">
                    <textarea
                      rows={4}
                      value={ashaInput}
                      onChange={(e) => setAshaInput(e.target.value)}
                      placeholder={getTranslation(currentLang, 'asha_mode_placeholder')}
                      className="w-full bg-white/5 dark:bg-black/30 border border-white/10 rounded-2xl p-3.5 text-xs font-medium outline-none focus:ring-2 ring-violet-500 text-slate-800 dark:text-white placeholder:text-slate-400 resize-none pr-14"
                    />
                    {/* Mic inside textarea area */}
                    <button
                      onClick={() => handleMicClick('asha')}
                      disabled={voiceState === 'transcribing' || !effectiveOnline}
                      className={`absolute bottom-3 right-3 w-10 h-10 rounded-xl transition-all flex items-center justify-center ${micBtnClass()}`}
                    >
                      {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                  </div>

                  {/* Listening banner for ASHA mode */}
                  {isListening && (
                    <div className="flex items-center space-x-2 text-rose-500 text-xs font-bold px-1">
                      <span className="w-1.5 h-3 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-5 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-2 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      <span>{interimTranscript || getTranslation(currentLang, 'listening_state')}</span>
                    </div>
                  )}

                  <button
                    onClick={handleStructureFieldNote}
                    disabled={ashaStructuring || !ashaInput.trim() || !effectiveOnline}
                    className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm shadow-md disabled:opacity-40 transition-all flex items-center justify-center space-x-2"
                  >
                    {ashaStructuring && <Loader2 size={16} className="animate-spin" />}
                    <span>{ashaStructuring ? getTranslation(currentLang, 'asha_structuring') : getTranslation(currentLang, 'asha_structure_btn')}</span>
                  </button>
                </div>

                {/* ── ASHA Confirmation Modal (overlay) ── */}
                <AnimatePresence>
                  {ashaShowConfirm && ashaRawNote && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-3xl z-10 flex items-end p-4"
                    >
                      <motion.div
                        initial={{ y: 40, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 40, opacity: 0 }}
                        className={`w-full max-h-[85%] overflow-y-auto rounded-2xl border shadow-2xl p-4 space-y-3 ${
                          theme === 'dark' ? 'bg-slate-900 border-violet-500/30' : 'bg-white border-violet-200'
                        }`}
                      >
                        {/* Modal header */}
                        <div className="flex items-start justify-between">
                          <div>
                            <h5 className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center space-x-2">
                              <AlertTriangle size={16} className="text-amber-500" />
                              <span>{getTranslation(currentLang, 'asha_confirm_title')}</span>
                            </h5>
                            <p className="text-[11px] text-slate-400 mt-0.5">{getTranslation(currentLang, 'asha_confirm_desc')}</p>
                          </div>
                        </div>

                        {/* Urgency Badge */}
                        <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold ${getUrgencyStyle(ashaRawNote.urgency_flag)}`}>
                          {getUrgencyLabel(ashaRawNote.urgency_flag)}
                        </div>

                        {/* Structured fields */}
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          {ashaRawNote.patient_name && (
                            <div className="col-span-2 p-2 rounded-xl bg-white/5 border border-white/10">
                              <span className="text-slate-400 uppercase text-[9px] font-black tracking-wider block">Patient</span>
                              <span className="font-bold text-slate-800 dark:text-white">{ashaRawNote.patient_name}</span>
                              {ashaRawNote.age_approx && <span className="text-slate-500"> • {ashaRawNote.age_approx}</span>}
                              {ashaRawNote.gender && <span className="text-slate-500"> • {ashaRawNote.gender}</span>}
                            </div>
                          )}
                          {ashaRawNote.symptoms && ashaRawNote.symptoms.length > 0 && (
                            <div className="col-span-2 p-2 rounded-xl bg-white/5 border border-white/10">
                              <span className="text-slate-400 uppercase text-[9px] font-black tracking-wider block mb-1">
                                {currentLang === 'mr' ? 'लक्षणे' : currentLang === 'hi' ? 'लक्षण' : 'Symptoms'}
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {ashaRawNote.symptoms.map((s, si) => (
                                  <span key={si} className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-bold">{s}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {ashaRawNote.vitals_mentioned && Object.values(ashaRawNote.vitals_mentioned).some(Boolean) && (
                            <div className="col-span-2 p-2 rounded-xl bg-white/5 border border-white/10">
                              <span className="text-slate-400 uppercase text-[9px] font-black tracking-wider block mb-1">
                                {currentLang === 'mr' ? 'व्हायटल्स' : 'Vitals'}
                              </span>
                              <div className="grid grid-cols-2 gap-1 text-[10px]">
                                {ashaRawNote.vitals_mentioned.temperature && <div><span className="text-slate-400">Temp:</span> <strong>{ashaRawNote.vitals_mentioned.temperature}</strong></div>}
                                {ashaRawNote.vitals_mentioned.blood_pressure && <div><span className="text-slate-400">BP:</span> <strong>{ashaRawNote.vitals_mentioned.blood_pressure}</strong></div>}
                                {ashaRawNote.vitals_mentioned.pulse && <div><span className="text-slate-400">Pulse:</span> <strong>{ashaRawNote.vitals_mentioned.pulse}</strong></div>}
                                {ashaRawNote.vitals_mentioned.spo2 && <div><span className="text-slate-400">SpO2:</span> <strong>{ashaRawNote.vitals_mentioned.spo2}</strong></div>}
                                {ashaRawNote.vitals_mentioned.weight && <div><span className="text-slate-400">Weight:</span> <strong>{ashaRawNote.vitals_mentioned.weight}</strong></div>}
                              </div>
                            </div>
                          )}
                          {ashaRawNote.observations && (
                            <div className="col-span-2 p-2 rounded-xl bg-white/5 border border-white/10">
                              <span className="text-slate-400 uppercase text-[9px] font-black tracking-wider block">
                                {currentLang === 'mr' ? 'निरीक्षणे' : currentLang === 'hi' ? 'अवलोकन' : 'Observations'}
                              </span>
                              <p className="text-slate-700 dark:text-slate-300 text-[11px] mt-0.5">{ashaRawNote.observations}</p>
                            </div>
                          )}
                        </div>

                        {/* Disclaimer */}
                        <p className="text-[9px] text-amber-500/80 italic border border-amber-500/20 rounded-xl p-2 bg-amber-500/5">
                          {ashaRawNote.disclaimer}
                        </p>

                        {/* Action buttons */}
                        <div className="flex space-x-2 pt-1">
                          <button
                            onClick={handleCancelAshaNote}
                            className="flex-1 py-2.5 rounded-xl border border-white/20 text-slate-400 text-xs font-bold hover:bg-white/5 transition-all"
                          >
                            {getTranslation(currentLang, 'asha_confirm_cancel')}
                          </button>
                          <button
                            onClick={handleConfirmAshaNote}
                            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center space-x-1.5"
                          >
                            <CheckCircle2 size={14} />
                            <span>{getTranslation(currentLang, 'asha_confirm_save')}</span>
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── Confirmed Note Display ── */}
                {ashaConfirmedNote && !ashaShowConfirm && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-2xl border space-y-3 ${
                      theme === 'dark' ? 'bg-violet-950/20 border-violet-500/30' : 'bg-violet-50 border-violet-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-violet-500 font-black text-xs uppercase tracking-wider">
                        <CheckCircle2 size={16} />
                        <span>{getTranslation(currentLang, 'asha_confirmed_label')}</span>
                      </div>
                      <div className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getUrgencyStyle(ashaConfirmedNote.urgency_flag)}`}>
                        {ashaConfirmedNote.urgency_flag}
                      </div>
                    </div>

                    {ashaConfirmedNote.patient_name && (
                      <p className="text-sm font-bold text-slate-800 dark:text-white">
                        {ashaConfirmedNote.patient_name}
                        {ashaConfirmedNote.age_approx && ` • ${ashaConfirmedNote.age_approx}`}
                      </p>
                    )}

                    {ashaConfirmedNote.symptoms && ashaConfirmedNote.symptoms.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {ashaConfirmedNote.symptoms.map((s, si) => (
                          <span key={si} className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-bold">{s}</span>
                        ))}
                      </div>
                    )}

                    {ashaConfirmedNote.observations && (
                      <p className="text-xs text-slate-600 dark:text-slate-300">{ashaConfirmedNote.observations}</p>
                    )}

                    <div className="flex space-x-2">
                      <button
                        onClick={() => { setAshaConfirmedNote(null); setAshaInput(''); }}
                        className="flex-1 py-2 rounded-xl border border-white/20 text-slate-400 text-xs font-bold hover:bg-white/5 transition-all flex items-center justify-center space-x-1"
                      >
                        <RefreshCw size={12} />
                        <span>{currentLang === 'mr' ? 'नवीन नोंद' : currentLang === 'hi' ? 'नई नोट' : 'New Note'}</span>
                      </button>
                      <button
                        onClick={() => {
                          const text = [
                            ashaConfirmedNote.patient_name && `Patient: ${ashaConfirmedNote.patient_name}`,
                            ashaConfirmedNote.age_approx && `Age: ${ashaConfirmedNote.age_approx}`,
                            ashaConfirmedNote.symptoms?.length && `Symptoms: ${ashaConfirmedNote.symptoms.join(', ')}`,
                            ashaConfirmedNote.observations && `Observations: ${ashaConfirmedNote.observations}`,
                            `Urgency: ${ashaConfirmedNote.urgency_flag}`,
                          ].filter(Boolean).join('\n');
                          navigator.clipboard.writeText(text);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-all flex items-center justify-center space-x-1"
                      >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copied ? getTranslation(currentLang, 'copied') : getTranslation(currentLang, 'copy')}</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating Toggle Button ── */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-16 h-16 rounded-3xl flex items-center justify-center shadow-2xl transition-all relative overflow-hidden group
          ${theme === 'dark'
            ? 'bg-cyan-500 text-black shadow-cyan-400/40 border border-cyan-400/50'
            : 'bg-blue-600 text-white shadow-blue-600/40 border border-blue-400/30'}
        `}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X size={26} />
            </motion.div>
          ) : (
            <motion.div key="bot" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
              className="relative flex items-center justify-center"
            >
              <Bot size={26} />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white dark:border-[#050810] animate-pulse" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}

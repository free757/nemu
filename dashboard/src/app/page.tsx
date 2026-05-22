'use client';

// Set to true to enable verbose per-event pipeline logging (for development debugging only)
const DEBUG_PIPELINE_LOGS = false;

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { sanitizeTranscript } from '@/lib/speechManager';
import { RealtimePipeline } from '@/lib/realtimePipeline';
import { resetThrottler, throttleAIRequest, startNewSession, getCurrentSessionId } from '@/lib/pipelineDebounce';
import { 
  Users, 
  Settings, 
  Plus, 
  Search, 
  RefreshCw, 
  LogOut, 
  ShieldCheck, 
  Globe,
  Trash2,
  Edit2,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Menu,
  Bot,
  Upload,
  Mic,
  MicOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Dashboard() {
  const router = useRouter();
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [remoteConfigs, setRemoteConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Auth Guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    const auth = sessionStorage.getItem('dashboard_auth');
    if (!auth) {
      router.replace('/login');
    } else {
      setIsAuthChecked(true);
    }
  }, [router]);



  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{id: string, name: string} | null>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editingConfig, setEditingConfig] = useState<any>(null);
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  


  // Interview Assistant State
  const [interviewProfiles, setInterviewProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isCloningVoice, setIsCloningVoice] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [rateLimitNotice, setRateLimitNotice] = useState<string | null>(null);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const rateLimitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [transcript, setTranscript] = useState<{role: string, text: string}[]>([]);
  const [manualQuestion, setManualQuestion] = useState('');
  const [activeAITool, setActiveAITool] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileData, setEditProfileData] = useState({ name: '', cv: '', prompt: '' });

  const fetchProfiles = async () => {
    const { data } = await supabase.from('interview_profiles').select('*').order('created_at', { ascending: false });
    if (data) {
      setInterviewProfiles(data);
      if (data.length > 0 && !selectedProfileId) setSelectedProfileId(data[0].id);
    }
  };

  const handleCreateProfile = () => {
    setSelectedProfileId('new');
    setEditProfileData({ name: '', cv: '', prompt: '' });
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!editProfileData.name.trim()) return alert(lang === 'ar' ? 'الرجاء إدخال اسم المرشح.' : 'Please enter a candidate name.');
    
    if (selectedProfileId === 'new') {
      const { data, error } = await supabase.from('interview_profiles').insert([{ 
        profile_name: editProfileData.name, 
        cv_text: editProfileData.cv,
        system_prompt: editProfileData.prompt
      }]).select();
      
      if (!error && data && data.length > 0) {
        await fetchProfiles();
        setSelectedProfileId(data[0].id);
        setIsEditingProfile(false);
      } else {
        alert(error?.message || 'Failed to create profile');
      }
    } else {
      const { error } = await supabase.from('interview_profiles').update({
        profile_name: editProfileData.name,
        cv_text: editProfileData.cv,
        system_prompt: editProfileData.prompt
      }).eq('id', selectedProfileId);
      
      if (!error) {
        await fetchProfiles();
        setIsEditingProfile(false);
      } else {
        alert(error.message);
      }
    }
  };

  const handleDeleteProfile = async () => {
    if (!confirm('Are you sure you want to delete this profile?')) return;
    const { error } = await supabase.from('interview_profiles').delete().eq('id', selectedProfileId);
    if (!error) {
      setSelectedProfileId('');
      setIsEditingProfile(false);
      fetchProfiles();
    } else {
      alert(error.message);
    }
  };

  useEffect(() => {
    if (activeTab === 'tools') fetchProfiles();
  }, [activeTab]);



  const [formData, setFormData] = useState({
    pin: '',
    username: '',
    phone_number: '',
    proxy_ip: '',
    proxy_port: '',
    proxy_user: '',
    proxy_pass: '',
    proxy_location: '',
    proxy_timezone: '',
    is_manager: false
  });

  const [quickPaste, setQuickPaste] = useState('');

  const handleQuickPasteChange = (value: string) => {
    setQuickPaste(value);
    const cleanVal = value.trim();
    if (!cleanVal) return;
    
    // Supported delimiters: colon (:), comma (,), semicolon (;), pipe (|), or spaces
    const parts = cleanVal.split(/[:;,| \t]+/);
    if (parts.length >= 2) {
      const ip = parts[0];
      const port = parts[1];
      const user = parts[2] || '';
      const pass = parts[3] || '';
      
      setFormData(prev => ({
        ...prev,
        proxy_ip: ip,
        proxy_port: port,
        proxy_user: user,
        proxy_pass: pass
      }));
    }
  };

  const [configFormData, setConfigFormData] = useState({
    config_key: '',
    config_value: '',
    is_enabled: true
  });

  const t = {
    en: {
      users: 'Users Management',
      config: 'Remote Config',
      tools: 'AI Tools',
      signOut: 'Sign Out',
      title: 'Manage Users',
      configTitle: 'Remote Configuration',
      toolsTitle: 'AI Tools Suite',
      subtitle: 'Control everything in real-time from one place.',
      toolsSubtitle: 'Your personal AI productivity and career suite.',
      addNew: 'Add New User',
      addConfig: 'Add New Config',
      search: 'Search users by name or PIN...',
      profile: 'User Profile',
      pin: 'PIN',
      proxy: 'Proxy Info',
      actions: 'Actions',
      noUsers: 'No users found matching your search.',
      edit: 'Edit User Profile',
      create: 'Create New User',
      fullName: 'Full Name',
      loginPin: 'Login PIN',
      phone: 'Phone Number',
      proxyConfig: 'Proxy Configuration',
      ip: 'IP Address',
      port: 'Port',
      user: 'Proxy Username',
      pass: 'Proxy Password',
      location: 'IP Location',
      timezone: 'Timezone',
      fetchBtn: 'Fetch Info',
      cancel: 'Cancel',
      save: 'Save Changes',
      createBtn: 'Create User',
      configKey: 'Configuration Key (e.g. home_link)',
      configVal: 'Value (JSON or Text)',
      enabled: 'Is Enabled',
      saveConfig: 'Save Configuration',
      createConfig: 'Create Configuration',
      confirmTitle: 'Are you sure?',
      confirmText: 'Do you really want to delete this? This action cannot be undone.',
      confirmBtn: 'Yes, Delete',
      confirmCancel: 'No, Keep',
      quickPaste: 'Quick Paste (IP:Port:User:Pass)',
      quickPastePlaceholder: 'Paste proxy string here...',
      isManager: 'Is Manager (Dashboard Access)'
    },
    ar: {
      users: 'إدارة المستخدمين',
      config: 'الإعدادات عن بعد',
      tools: 'أدوات الذكاء الاصطناعي',
      signOut: 'تسجيل الخروج',
      title: 'إدارة المستخدمين',
      configTitle: 'الإعدادات عن بعد',
      toolsTitle: 'حزمة أدوات الذكاء الاصطناعي',
      subtitle: 'تحكم في كل شيء في الوقت الفعلي من مكان واحد.',
      toolsSubtitle: 'حزمة أدواتك الشخصية للإنتاجية والمسار المهني.',
      addNew: 'إضافة مستخدم جديد',
      addConfig: 'إضافة إعداد جديد',
      search: 'ابحث عن المستخدمين بالاسم أو الـ PIN...',
      profile: 'ملف المستخدم',
      pin: 'كود الدخول',
      proxy: 'بيانات البروكسي',
      actions: 'الإجراءات',
      noUsers: 'لم يتم العثور على مستخدمين يطابقون بحثك.',
      edit: 'تعديل ملف المستخدم',
      create: 'إنشاء مستخدم جديد',
      fullName: 'الاسم الكامل',
      loginPin: 'كود الدخول (PIN)',
      phone: 'رقم الهاتف',
      proxyConfig: 'إعدادات البروكسي',
      ip: 'عنوان الـ IP',
      port: 'المنفذ (Port)',
      user: 'اسم مستخدم البروكسي',
      pass: 'كلمة سر البروكسي',
      location: 'موقع الـ IP',
      timezone: 'المنطقة الزمنية',
      fetchBtn: 'جلب المعلومات',
      cancel: 'إلغاء',
      save: 'حفظ التعديلات',
      createBtn: 'إنشاء المستخدم',
      configKey: 'اسم الإعداد (مثلاً: home_link)',
      configVal: 'القيمة (نص أو JSON)',
      enabled: 'مفعل',
      saveConfig: 'حفظ الإعداد',
      createConfig: 'إنشاء الإعداد',
      confirmTitle: 'هل أنت متأكد؟',
      confirmText: 'هل تريد حقاً حذف هذا؟ لا يمكن التراجع عن هذا الإجراء.',
      confirmBtn: 'نعم، احذف',
      confirmCancel: 'لا، تراجع',
      quickPaste: 'لصق سريع (IP:Port:User:Pass)',
      quickPastePlaceholder: 'الصق سطر البروكسي هنا...',
      isManager: 'مدير (صلاحية دخول لوحة التحكم)'
    }
  }[lang];

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('app_users').select('*').order('created_at', { ascending: false });
    if (!error) setUsers(data);
    setLoading(false);
  };

  const fetchConfigs = async () => {
    const { data, error } = await supabase.from('remote_configs').select('*').order('created_at', { ascending: false });
    if (!error) setRemoteConfigs(data);
  };

  useEffect(() => {
    fetchUsers();
    fetchConfigs();
  }, []);

  const handleDeleteClick = (id: string, name: string, type: 'user' | 'config' = 'user') => {
    setConfirmAction({id, name});
    // Store type in confirmAction metadata if needed, but for now we'll check activeTab
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (confirmAction) {
      const table = activeTab === 'users' ? 'app_users' : 'remote_configs';
      const { error } = await supabase.from(table).delete().eq('id', confirmAction.id);
      if (!error) {
        activeTab === 'users' ? fetchUsers() : fetchConfigs();
        setIsConfirmOpen(false);
      }
    }
  };

  const handleOpenEdit = (user: any) => {
    setEditingUser(user);
    setQuickPaste('');
    setFormData({
      pin: user.pin || '',
      username: user.username || '',
      phone_number: user.phone_number || '',
      proxy_ip: user.proxy_ip || '',
      proxy_port: user.proxy_port?.toString() || '',
      proxy_user: user.proxy_user || '',
      proxy_pass: user.proxy_pass || '',
      proxy_location: user.proxy_location || '',
      proxy_timezone: user.proxy_timezone || '',
      is_manager: user.is_manager || false
    });
    setIsModalOpen(true);
  };

  const handleOpenConfigEdit = (config: any) => {
    setEditingConfig(config);
    setConfigFormData({
      config_key: config.config_key,
      config_value: typeof config.config_value === 'object' ? JSON.stringify(config.config_value, null, 2) : config.config_value,
      is_enabled: config.is_enabled
    });
    setIsConfigModalOpen(true);
  };

  const handleOpenAdd = () => {
    if (activeTab === 'users') {
      setEditingUser(null);
      setQuickPaste('');
      setFormData({
        pin: '', username: '', phone_number: '',
        proxy_ip: '', proxy_port: '', proxy_user: '', proxy_pass: '',
        proxy_location: '', proxy_timezone: '', is_manager: false
      });
      setIsModalOpen(true);
    } else {
      setEditingConfig(null);
      setConfigFormData({
        config_key: '',
        config_value: '',
        is_enabled: true
      });
      setIsConfigModalOpen(true);
    }
  };

  const fetchIpInfo = async () => {
    if (!formData.proxy_ip || formData.proxy_ip.length < 7) return;
    try {
      const res = await fetch(`https://ipapi.co/${formData.proxy_ip}/json/`);
      const data = await res.json();
      if (!data.error) {
        setFormData(prev => ({
          ...prev,
          proxy_location: `${data.city || ''}, ${data.country_name || ''}`,
          proxy_timezone: data.timezone || ''
        }));
      }
    } catch (err) {
      console.error('Failed to fetch IP info:', err);
    }
  };

  // Auto-fetch IP info when IP changes (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchIpInfo();
    }, 1200);
    return () => clearTimeout(timer);
  }, [formData.proxy_ip]);

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let parsedValue;
    try {
      parsedValue = JSON.parse(configFormData.config_value);
    } catch (e) {
      parsedValue = configFormData.config_value;
    }

    const payload = {
      ...configFormData,
      config_value: parsedValue
    };

    let error;
    if (editingConfig) {
      const { error: err } = await supabase.from('remote_configs').update(payload).eq('id', editingConfig.id);
      error = err;
    } else {
      const { error: err } = await supabase.from('remote_configs').insert([payload]);
      error = err;
    }

    if (!error) {
      setIsConfigModalOpen(false);
      fetchConfigs();
    } else {
      alert(error.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      proxy_port: parseInt(formData.proxy_port)
    };

    let error;
    if (editingUser) {
      const { error: err } = await supabase.from('app_users').update(payload).eq('id', editingUser.id);
      error = err;
    } else {
      const { error: err } = await supabase.from('app_users').insert([payload]);
      error = err;
    }

    if (!error) {
      setIsModalOpen(false);
      fetchUsers();
    } else {
      alert(error.message);
    }
  };

  // --- End of State ---

  const recognitionRef = useRef<any>(null);
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>('');
  const isCheckingRef = useRef<boolean>(false);

  const [draftPreview, setDraftPreview] = useState('');
  const pipelineRef = useRef<RealtimePipeline | null>(null);

  if (typeof window !== 'undefined') {
    if (!pipelineRef.current) {
      pipelineRef.current = new RealtimePipeline();
    }
  }

  // Sync pipeline events with React state and functions
  useEffect(() => {
    if (pipelineRef.current) {
      pipelineRef.current.registerEvents({
        onTranscriptUpdate: (newTranscript) => {
          console.log('[UI] transcript updated');
          setManualQuestion(newTranscript);
        },
        onDraftReady: (draft) => {
          console.log('[UI] draft received');
          setDraftPreview(draft);
        },
        onTriggerScheduled: (delayMs) => {
          console.log(`[UI] trigger scheduled: ${delayMs}ms`);
        },
        onTriggerCancelled: (reason) => {
          console.log(`[UI] trigger cancelled: ${reason}`);
        },
        onAnswerGenerating: (question) => {
          console.log('[UI] answer generation started for:', question);
          setTranscript(prev => [...prev, { role: 'user', text: question }]);
          setIsAIGenerating(true);
          setDraftPreview('');
          setManualQuestion('');
        },
        onAnswerGenerated: async (answer) => {
          console.log('[UI] answer generated');
          setRateLimitNotice(null);
          setIsAIGenerating(false);
          if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
          
          setTranscript(prev => [...prev, { role: 'assistant', text: answer }]);
          setDraftPreview('');
          setManualQuestion('');

          try {
            if (recognitionRef.current) recognitionRef.current.stop();
          } catch (e) {}

          const profile = interviewProfiles.find(p => p.id === selectedProfileId);
          if (profile && isVoiceEnabled) {
            const playBrowserTTS = (textToSpeak: string) => {
              if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(textToSpeak);
                utterance.lang = 'en-US';
                utterance.rate = 0.95;
                utterance.pitch = 1;
                window.speechSynthesis.speak(utterance);
              }
            };

            if (profile.voice_id) {
              try {
                const ttsRes = await fetch('/api/tts', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    text: answer,
                    voiceId: profile.voice_id
                  })
                });
                if (ttsRes.ok) {
                  const audioBlob = await ttsRes.blob();
                  const audioUrl = URL.createObjectURL(audioBlob);
                  const audio = new Audio(audioUrl);
                  audio.play();
                } else {
                  playBrowserTTS(answer);
                }
              } catch (ttsErr) {
                playBrowserTTS(answer);
              }
            } else {
              playBrowserTTS(answer);
            }
          }
        },
        onRateLimited: (cooldownMs) => {
          const waitSec = Math.ceil(cooldownMs / 1000);
          setRateLimitNotice(`AI provider is rate limited. Retrying in ${waitSec}s…`);
          setIsAIGenerating(false);
          setTranscript(prev => [...prev, { role: 'system', text: `⚠️ AI provider is rate limited. Skipping this answer.` }]);
          if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
          rateLimitTimerRef.current = setTimeout(() => setRateLimitNotice(null), cooldownMs);
        },
        onPipelineError: (err) => {
          setIsAIGenerating(false);
          // Suppress AbortErrors — these are intentional pipeline cancellations, not real errors
          if (err.name === 'AbortError') {
            console.log('[UI] Pipeline request aborted (intentional — suppressing UI error)');
            return;
          }
          
          // Append error message to chat so user has direct visibility
          setTranscript(prev => [...prev, { role: 'system', text: `❌ Error generating answer: ${err.message || 'AI request failed'}` }]);

          // Suppress 429 — already handled by retry logic, show rate limit notice instead
          if (err.message?.includes('429') || err.message?.toLowerCase().includes('rate limit')) {
            const waitSec = 10;
            setRateLimitNotice(`AI provider is rate limited. Retrying in ${waitSec}s…`);
            if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
            rateLimitTimerRef.current = setTimeout(() => setRateLimitNotice(null), waitSec * 1000);
            return;
          }
          console.error('[UI] Pipeline Error:', err);
        }
      });
    }
  }, [selectedProfileId, isVoiceEnabled, interviewProfiles, manualQuestion]);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support Speech Recognition. Please use Chrome.");
      return;
    }
    
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    // Switch to continuous + interim results for smart buffering
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang === 'ar' ? 'ar-SA' : 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      finalTranscriptRef.current = '';
      setManualQuestion('');
      startNewSession();
      console.log('[UI] pipeline listening');
    };
    
    recognition.onend = () => {
      // Intentionally allowing it to stop for safety (avoids ghost mic)
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech Recognition Error:", event.error);
      if (event.error === 'not-allowed') {
        alert("Microphone access denied. Please allow microphone permissions in your browser.");
      }
      setIsListening(false);
    };
    
    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      
      const fullText = finalTranscriptRef.current + interim;
      setManualQuestion(fullText);

      if (pipelineRef.current) {
        const profile = interviewProfiles.find(p => p.id === selectedProfileId);
        if (DEBUG_PIPELINE_LOGS) {
          console.log('[UI] pipeline chunk received:', fullText.slice(-40));
        }
        
        pipelineRef.current.debounceAndProcess({
          chunk: fullText,
          isPartial: !event.results[event.results.length - 1]?.isFinal,
          incomingConfidence: event.results[event.results.length - 1]?.[0]?.confidence,
          silenceDuration: 0,
          isUserSpeaking: true,
          cvText: profile?.cv_text || '',
          systemPrompt: profile?.system_prompt || '',
          sessionId: getCurrentSessionId()
        });
      }
    };

    recognition.start();
  };

  const processQuestion = async (question: string) => {
    setTranscript(prev => [...prev, { role: 'user', text: question }]);
    
    const profile = interviewProfiles.find(p => p.id === selectedProfileId);
    if (profile) {
      setTranscript(prev => [...prev, { role: 'system', text: 'Thinking...' }]);
      try {
        console.log('Using server /api/chat (OpenRouter) with protection...');
        const answer = await throttleAIRequest<string | null>(
          'final',
          question,
          async (signal) => {
            const res = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                question, 
                cvText: profile.cv_text,
                systemPrompt: profile.system_prompt 
              }),
              signal
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            return data.answer || null;
          },
          getCurrentSessionId() || undefined
        );
        
        setTranscript(prev => prev.filter(t => t.text !== 'Thinking...'));
        if (!answer) {
          throw new Error('Chat request throttled, blocked, or aborted');
        }
        
        setTranscript(prev => [...prev, { role: 'assistant', text: answer }]);
        
        if (isVoiceEnabled) {
          const playBrowserTTS = (textToSpeak: string) => {
            if ('speechSynthesis' in window) {
              window.speechSynthesis.cancel();
              const utterance = new SpeechSynthesisUtterance(textToSpeak);
              utterance.lang = 'en-US';
              utterance.rate = 0.95;
              utterance.pitch = 1;
              window.speechSynthesis.speak(utterance);
            }
          };

          if (profile.voice_id) {
            try {
              console.log('Fetching Cartesia TTS audio for voice:', profile.voice_id);
              const ttsRes = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  text: answer,
                  voiceId: profile.voice_id
                })
              });
              
              if (ttsRes.ok) {
                const audioBlob = await ttsRes.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);
                audio.play();
              } else {
                const errData = await ttsRes.json();
                console.error("Cartesia API Error:", errData);
                alert(`Cartesia TTS Error: ${errData.error || 'Check logs'}`);
                playBrowserTTS(answer);
              }
            } catch (ttsErr) {
              console.error("TTS Exception:", ttsErr);
              playBrowserTTS(answer);
            }
          } else {
            playBrowserTTS(answer);
          }
        }
      } catch (e: any) {
         setTranscript(prev => prev.filter(t => t.text !== 'Thinking...'));
         setTranscript(prev => [...prev, { role: 'system', text: `⚠️ Error: ${e.message}` }]);
      }
    }
  };

  const submitManualQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualQuestion.trim()) return;
    const q = manualQuestion;
    setManualQuestion('');
    
    if (pipelineRef.current) {
      const profile = interviewProfiles.find(p => p.id === selectedProfileId);
      await pipelineRef.current.requestFinalization(
        profile?.cv_text || '',
        profile?.system_prompt || '',
        q
      );
    }
  };

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      if (recognitionRef.current) recognitionRef.current.stop();
      
      // Reset drafting UI preview immediately
      setDraftPreview('');

      // Validate accumulated text and finalize through the realtime pipeline on mic stop
      if (manualQuestion.trim() && pipelineRef.current) {
        const q = sanitizeTranscript(manualQuestion);
        setManualQuestion('');
        const profile = interviewProfiles.find(p => p.id === selectedProfileId);
        pipelineRef.current.requestFinalization(profile?.cv_text || '', profile?.system_prompt || '', q);
      } else {
        if (pipelineRef.current) {
          pipelineRef.current.reset(true);
        }
      }
    } else {
      startListening();
    }
  };

  const handleVoiceUpload = async (file: File) => {
    setIsCloningVoice(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const profile = interviewProfiles.find(p => p.id === selectedProfileId);
      formData.append('name', `${profile?.profile_name || 'User'} - Cloned Voice`);
      
      const res = await fetch('/api/voice-clone', {
        method: 'POST',
        body: formData
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      const { error } = await supabase
        .from('interview_profiles')
        .update({ voice_id: data.voice_id })
        .eq('id', selectedProfileId);
        
      if (error) throw error;
      
      alert(lang === 'ar' ? 'تم استنساخ الصوت وحفظه بنجاح!' : 'Voice cloned and saved successfully!');
      fetchProfiles();
    } catch (err: any) {
      console.error(err);
      alert(lang === 'ar' ? `خطأ: ${err.message}` : `Error cloning voice: ${err.message}`);
    } finally {
      setIsCloningVoice(false);
    }
  };

  const startRecordingVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const file = new File([audioBlob], "recording.wav", { type: 'audio/wav' });
        handleVoiceUpload(file);
      };

      mediaRecorder.start();
      setIsRecordingVoice(true);
    } catch (err: any) {
      alert("Microphone access denied or error: " + err.message);
    }
  };

  const stopRecordingVoice = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecordingVoice(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.username?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    user.pin?.includes(searchQuery)
  );

  // ── Auth Guard (placed after all hooks) ──────────────────────────────────
  if (!isAuthChecked) return (
    <div className="w-screen h-screen flex items-center justify-center"
         style={{ background: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)' }}>
      <div className="w-8 h-8 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
    </div>
  );
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className={`flex flex-col md:flex-row h-screen ${theme === 'dark' ? 'bg-[#0a0a0a] text-white' : 'bg-[#f8f9fa] text-gray-900'} ${lang === 'ar' ? 'font-arabic' : ''}`} dir="ltr">
      {/* Mobile Header */}
      <div className={`md:hidden flex items-center justify-between p-4 border-b ${theme === 'dark' ? 'bg-[#111] border-white/5' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">NEMU<span className="text-blue-500">ADMIN</span></span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-100'}`}
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Sidebar / Mobile Drawer */}
      <AnimatePresence>
        {(isMobileMenuOpen || !isSidebarCollapsed) && (
          <>
            {/* Backdrop for mobile */}
            {isMobileMenuOpen && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] md:hidden"
              />
            )}
            
            <motion.aside 
              initial={isMobileMenuOpen ? { x: -256 } : false}
              animate={isMobileMenuOpen ? { x: 0 } : { width: isSidebarCollapsed ? 80 : 256 }}
              exit={isMobileMenuOpen ? { x: -256 } : {}}
              className={`fixed md:relative top-0 left-0 bottom-0 z-[101] md:z-auto border-r flex flex-col transition-colors h-full ${theme === 'dark' ? 'bg-[#111] border-white/5' : 'bg-white border-gray-200'} ${isMobileMenuOpen ? 'w-[256px]' : 'hidden md:flex'}`}
            >
              {/* Toggle Button (Desktop only) */}
              <button 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className={`hidden md:flex absolute -right-3 top-10 w-6 h-6 rounded-full border items-center justify-center z-10 transition-all ${theme === 'dark' ? 'bg-[#1a1a1a] border-white/10 text-gray-400 hover:text-white' : 'bg-white border-gray-200 text-gray-400 hover:text-gray-900 shadow-sm'}`}
              >
                {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>

              <div className={`p-6 flex items-center gap-3 overflow-hidden ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}>
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex-shrink-0 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                {!isSidebarCollapsed && (
                  <motion.span 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="font-bold text-xl tracking-tight whitespace-nowrap"
                  >
                    NEMU<span className="text-blue-500">ADMIN</span>
                  </motion.span>
                )}
              </div>

              <nav className="flex-1 px-4 py-4 space-y-2">
                <button 
                  onClick={() => { setActiveTab('users'); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'users' ? 'bg-blue-600/10 text-blue-500 border border-blue-500/20' : theme === 'dark' ? 'text-gray-400 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100'} ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
                >
                  <Users className="w-5 h-5 flex-shrink-0" />
                  {!isSidebarCollapsed && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-medium whitespace-nowrap">{t.users}</motion.span>}
                </button>
                <button 
                  onClick={() => { setActiveTab('config'); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'config' ? 'bg-blue-600/10 text-blue-500 border border-blue-500/20' : theme === 'dark' ? 'text-gray-400 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100'} ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
                >
                  <Settings className="w-5 h-5 flex-shrink-0" />
                  {!isSidebarCollapsed && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-medium whitespace-nowrap">{t.config}</motion.span>}
                </button>
                <button 
                  onClick={() => { setActiveTab('tools'); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'tools' ? 'bg-blue-600/10 text-blue-500 border border-blue-500/20' : theme === 'dark' ? 'text-gray-400 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100'} ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
                >
                  <Bot className="w-5 h-5 flex-shrink-0" />
                  {!isSidebarCollapsed && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-medium whitespace-nowrap">{t.tools}</motion.span>}
                </button>
              </nav>

              <div className={`p-4 border-t border-white/5 space-y-4 ${isSidebarCollapsed ? 'items-center flex flex-col px-0' : ''}`}>
                <div className={`flex items-center px-2 ${isSidebarCollapsed ? 'flex-col gap-4' : 'justify-between'}`}>
                  <button 
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className={`p-2 rounded-lg transition-all ${theme === 'dark' ? 'bg-white/5 text-yellow-400' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {theme === 'dark' ? <motion.div animate={{ rotate: 360 }}>☀️</motion.div> : <motion.div animate={{ rotate: 180 }}>🌙</motion.div>}
                  </button>
                  <button 
                    onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${theme === 'dark' ? 'bg-white/5 text-blue-400' : 'bg-gray-100 text-blue-600'}`}
                  >
                    {isSidebarCollapsed ? lang.toUpperCase() : (lang === 'en' ? 'ARABIC' : 'ENGLISH')}
                  </button>
                </div>
                <button
                  onClick={() => {
                    sessionStorage.removeItem('dashboard_auth');
                    router.replace('/login');
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-400/10 transition-all ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
                >
                  <LogOut className="w-5 h-5 flex-shrink-0" />
                  {!isSidebarCollapsed && <span className="font-medium">{t.signOut}</span>}
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              {activeTab === 'users' ? t.title : activeTab === 'config' ? t.configTitle : t.toolsTitle}
            </h1>
            <p className="text-gray-500 text-sm md:text-base">
              {activeTab === 'users' ? t.subtitle : activeTab === 'config' ? t.subtitle : t.toolsSubtitle}
            </p>
          </div>
          
          <div className="flex gap-3">
            {activeTab !== 'tools' && (
              <>
                <button 
                  onClick={activeTab === 'users' ? fetchUsers : fetchConfigs}
                  className={`p-3 border rounded-xl transition-all ${theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button 
                  onClick={handleOpenAdd}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 rounded-xl hover:bg-blue-500 transition-all font-bold text-white shadow-lg shadow-blue-600/20"
                >
                  <Plus className="w-5 h-5" />
                  <span>{activeTab === 'users' ? t.addNew : t.addConfig}</span>
                </button>
              </>
            )}
          </div>
        </header>

        {activeTab === 'users' ? (
          <div className="space-y-6">
            {/* Search Bar */}
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input 
                type="text" 
                placeholder={t.search}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full border rounded-2xl py-4 pl-12 pr-4 focus:border-blue-500 outline-none transition-all ${theme === 'dark' ? 'bg-[#111] border-white/5' : 'bg-white border-gray-200 text-gray-900'}`}
              />
            </div>

            {/* Desktop Table View */}
            <div className={`hidden md:block rounded-3xl border shadow-sm overflow-hidden ${theme === 'dark' ? 'bg-[#111] border-white/5' : 'bg-white border-gray-200'}`}>
              <table className="w-full text-left">
                <thead>
                  <tr className={`border-b ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                    <th className="px-6 py-5 text-gray-400 font-medium">{t.profile}</th>
                    <th className="px-6 py-5 text-gray-400 font-medium">{t.pin}</th>
                    <th className="px-6 py-5 text-gray-400 font-medium">{t.proxy}</th>
                    <th className="px-6 py-5 text-gray-400 font-medium text-right">{t.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <AnimatePresence>
                    {filteredUsers.map((user) => (
                      <motion.tr 
                        key={user.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className={`transition-all group ${theme === 'dark' ? 'hover:bg-white/[0.02] divide-white/5' : 'hover:bg-gray-50 divide-gray-100'}`}
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center font-bold text-lg text-white">
                              {user.username?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user.username}</p>
                                {user.is_manager && (
                                  <span className="px-2 py-0.5 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full font-bold uppercase tracking-wider">
                                    Manager
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-500 text-sm">{user.phone_number}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`px-3 py-1 border rounded-lg font-mono text-blue-400 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-blue-50 border-blue-100'}`}>
                            {user.pin}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="text-sm">
                            <p className="flex items-center gap-2">
                              <Globe className="w-3 h-3 text-gray-500" />
                              <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>{user.proxy_ip}:{user.proxy_port}</span>
                            </p>
                            <p className="text-gray-500 text-xs flex items-center gap-1">
                               <MapPin className="w-3 h-3" /> {user.proxy_location || 'N/A'} • {user.proxy_timezone || 'N/A'}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => handleOpenEdit(user)}
                              className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteClick(user.id, user.username)}
                              className="p-2 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {filteredUsers.map((user) => (
                <motion.div 
                  key={user.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`p-6 rounded-3xl border shadow-sm space-y-6 ${theme === 'dark' ? 'bg-[#111] border-white/5' : 'bg-white border-gray-200'}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center font-bold text-xl text-white">
                        {user.username?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user.username}</h3>
                          {user.is_manager && (
                            <span className="px-2 py-0.5 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full font-bold uppercase tracking-wider">
                              Manager
                            </span>
                          )}
                        </div>
                        <p className="text-gray-500 text-sm">{user.phone_number}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 border rounded-lg font-mono text-sm text-blue-400 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-blue-50 border-blue-100'}`}>
                      {user.pin}
                    </span>
                  </div>

                  <div className={`p-4 rounded-2xl space-y-2 ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">{t.proxy}</p>
                    <p className="flex items-center gap-2 text-sm">
                      <Globe className="w-4 h-4 text-blue-500" />
                      <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>{user.proxy_ip}:{user.proxy_port}</span>
                    </p>
                    <p className="text-gray-500 text-xs flex items-center gap-2">
                       <MapPin className="w-4 h-4" /> {user.proxy_location || 'N/A'} • {user.proxy_timezone || 'N/A'}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleOpenEdit(user)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${theme === 'dark' ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      <Edit2 className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                    </button>
                    <button 
                      onClick={() => handleDeleteClick(user.id, user.username)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500/10 text-red-500 rounded-xl font-bold hover:bg-red-500/20 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'حذف' : 'Delete'}</span>
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>

            {filteredUsers.length === 0 && !loading && (
              <div className="p-20 text-center text-gray-500">
                {t.noUsers}
              </div>
            )}
          </div>
        ) : activeTab === 'config' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {remoteConfigs.map((config) => (
              <div key={config.id} className={`p-6 rounded-3xl border space-y-4 ${theme === 'dark' ? 'bg-[#111] border-white/5' : 'bg-white border-gray-200'}`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-600/20 text-purple-500 rounded-xl flex items-center justify-center">
                      <Settings className="w-5 h-5" />
                    </div>
                    <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{config.config_key}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${config.is_enabled ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                      {config.is_enabled ? 'ACTIVE' : 'DISABLED'}
                    </div>
                    <button 
                      onClick={() => handleOpenConfigEdit(config)}
                      className="p-2 text-gray-400 hover:text-blue-500 rounded-lg transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteClick(config.id, config.config_key)}
                      className="p-2 text-red-500/50 hover:text-red-500 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className={`rounded-2xl p-4 font-mono overflow-x-auto max-h-60 overflow-y-auto ${theme === 'dark' ? 'bg-black/50' : 'bg-gray-50 border border-gray-100'}`}>
                  <pre className={`text-blue-400 ${lang === 'ar' ? 'text-right' : 'text-left'} text-xs md:text-sm`}>{JSON.stringify(config.config_value, null, 2)}</pre>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6 max-w-4xl">

            {activeAITool === null ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Live Interview Assistant Card */}
                <div 
                  onClick={() => setActiveAITool('interview')}
                  className={`p-6 rounded-3xl border cursor-pointer hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 flex flex-col items-center justify-center text-center space-y-4 ${theme === 'dark' ? 'bg-[#111] border-white/10 hover:border-blue-500/50' : 'bg-white border-gray-200 hover:border-blue-500'}`}
                >
                  <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center">
                    <Bot className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold">Live Interview Pilot</h3>
                  <p className="text-sm text-gray-500">Real-time stealth teleprompter with AI to ace your mock interviews.</p>
                </div>

                {/* Cover Letter Generator (Coming Soon) */}
                <div className={`p-6 rounded-3xl border opacity-60 cursor-not-allowed flex flex-col items-center justify-center text-center space-y-4 ${theme === 'dark' ? 'bg-[#111] border-white/5' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="w-16 h-16 bg-purple-500/10 text-purple-500 rounded-2xl flex items-center justify-center">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <h3 className="text-xl font-bold">Cover Letter AI</h3>
                  <p className="text-sm text-gray-500">Generate personalized cover letters instantly. (Coming Soon)</p>
                </div>

                {/* Resume Builder (Coming Soon) */}
                <div className={`p-6 rounded-3xl border opacity-60 cursor-not-allowed flex flex-col items-center justify-center text-center space-y-4 ${theme === 'dark' ? 'bg-[#111] border-white/5' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="w-16 h-16 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </div>
                  <h3 className="text-xl font-bold">Resume Builder</h3>
                  <p className="text-sm text-gray-500">Optimize your CV layout for ATS scanning. (Coming Soon)</p>
                </div>
              </div>
            ) : activeAITool === 'interview' ? (
              <div className="space-y-6">
                <button 
                  onClick={() => {
                    setActiveAITool(null);
                    setIsSessionActive(false);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all w-fit ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}
                >
                  <ChevronLeft className="w-4 h-4" /> Back to Tools Grid
                </button>

            {/* Interview Assistant Placeholder / Active Session */}
            {!isSessionActive ? (
              <div className={`p-8 rounded-3xl border flex flex-col items-center justify-center text-center space-y-6 min-h-[400px] ${theme === 'dark' ? 'bg-gradient-to-b from-[#111] to-black border-white/5' : 'bg-gradient-to-b from-white to-gray-50 border-gray-200'}`}>
                <div className="w-20 h-20 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center animate-pulse">
                  <Bot className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-bold">Interview Pilot</h2>
                <p className="text-gray-500 max-w-lg">
                  Upload your CV and start a live interview session. The AI will listen to the questions and provide real-time suggestions based on your experience.
                </p>
                
                <div className="w-full max-w-2xl mt-8 bg-black/5 dark:bg-white/5 p-6 rounded-3xl border border-gray-200 dark:border-white/10 text-left">
                  {isEditingProfile ? (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex justify-between items-center mb-4 border-b border-gray-200 dark:border-white/10 pb-4">
                        <h3 className="text-xl font-bold">{selectedProfileId === 'new' ? 'Create New Profile' : 'Edit Candidate Profile'}</h3>
                        <button onClick={() => {
                          if (selectedProfileId === 'new') {
                            setSelectedProfileId(interviewProfiles.length > 0 ? interviewProfiles[0].id : '');
                          }
                          setIsEditingProfile(false);
                        }} className="text-gray-500 hover:text-gray-800 dark:hover:text-white font-bold">Cancel</button>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-500 mb-2">Candidate Name</label>
                        <input type="text" value={editProfileData.name} onChange={e => setEditProfileData({...editProfileData, name: e.target.value})} className="w-full p-4 rounded-xl border outline-none bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-white/10 font-bold" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-500 mb-2">CV / Background Knowledge</label>
                        <textarea rows={6} value={editProfileData.cv} onChange={e => setEditProfileData({...editProfileData, cv: e.target.value})} placeholder="Paste resume text or knowledge base here..." className="w-full p-4 rounded-xl border outline-none bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-white/10 font-mono text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-500 mb-2">System Prompt (AI Rules)</label>
                        <textarea rows={4} value={editProfileData.prompt} onChange={e => setEditProfileData({...editProfileData, prompt: e.target.value})} placeholder="Optional: Leave empty for default human-like rules, or write specific instructions." className="w-full p-4 rounded-xl border outline-none bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-white/10 font-mono text-sm" />
                      </div>
                      <div className="flex gap-4 pt-4 mt-4 border-t border-gray-200 dark:border-white/10">
                        <button onClick={handleSaveProfile} className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition-all">Save Profile</button>
                        <button onClick={handleDeleteProfile} className="px-6 py-4 bg-red-500/10 text-red-500 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-all">Delete</button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <select 
                          value={selectedProfileId}
                          onChange={e => setSelectedProfileId(e.target.value)}
                          className={`flex-1 p-4 rounded-xl border outline-none font-bold text-lg ${theme === 'dark' ? 'bg-[#1a1a1a] border-white/10 text-white' : 'bg-white border-gray-200'}`}
                        >
                          <option value="" disabled>Select a Candidate...</option>
                          {interviewProfiles.map(p => (
                            <option key={p.id} value={p.id}>{p.profile_name}</option>
                          ))}
                        </select>
                        
                        <button 
                          onClick={() => {
                            const p = interviewProfiles.find(x => x.id === selectedProfileId);
                            if(p) {
                              setEditProfileData({ name: p.profile_name, cv: p.cv_text || '', prompt: p.system_prompt || '' });
                              setIsEditingProfile(true);
                            }
                          }}
                          disabled={!selectedProfileId}
                          className="p-4 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 transition-all text-gray-500"
                          title="Edit Candidate Profile"
                        >
                          <Edit2 className="w-6 h-6" />
                        </button>
                        
                        <button 
                          onClick={handleCreateProfile}
                          className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all shadow-lg"
                          title="Create New Candidate"
                        >
                          <Plus className="w-6 h-6" />
                        </button>
                      </div>

                  {!isEditingProfile && (
                    <div className="flex gap-4 w-full">
                      <input 
                        type="file" 
                        accept="application/pdf"
                        id="cv-upload"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          
                          try {
                            const pdfjs = await import('pdfjs-dist');
                            pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
                            
                            const arrayBuffer = await file.arrayBuffer();
                            const pdf = await pdfjs.getDocument(arrayBuffer).promise;
                            let fullText = '';
                            
                            for (let i = 1; i <= pdf.numPages; i++) {
                              const page = await pdf.getPage(i);
                              const textContent = await page.getTextContent();
                              const pageText = textContent.items.map((item: any) => item.str).join(' ');
                              fullText += pageText + '\n';
                            }
                            
                            const { error } = await supabase.from('interview_profiles').insert([{
                              profile_name: file.name.replace('.pdf', ''),
                              cv_text: fullText
                            }]);
                            
                            if (error) throw error;
                            alert(lang === 'ar' ? 'تم استخراج النص وحفظه كبروفايل جديد بنجاح!' : 'CV text extracted and saved as a new profile successfully!');
                            fetchProfiles();
                          } catch (err: any) {
                            console.error(err);
                            alert(lang === 'ar' ? `حدث خطأ: ${err.message}` : `Error processing PDF: ${err.message}`);
                          }
                        }}
                      />
                      <button 
                        onClick={() => document.getElementById('cv-upload')?.click()}
                        className={`flex-1 py-4 border border-dashed rounded-xl font-bold transition-all ${theme === 'dark' ? 'border-white/20 hover:border-blue-500 hover:bg-blue-500/10 text-gray-400' : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50 text-gray-600'}`}
                      >
                        Upload CV PDF (Auto-Create)
                      </button>
                    </div>
                  )}

                  {selectedProfileId && (
                    <div className="w-full max-w-md space-y-6">
                      {/* Voice Settings */}
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            placeholder="Paste Cartesia Voice ID here..."
                            defaultValue={interviewProfiles.find(p => p.id === selectedProfileId)?.voice_id || ''}
                            id="manual-voice-id"
                            className={`flex-1 p-4 rounded-xl border outline-none font-mono text-sm ${theme === 'dark' ? 'bg-[#1a1a1a] border-white/10 text-blue-400' : 'bg-gray-50 border-gray-200 text-blue-600'}`}
                          />
                          <button 
                            onClick={async () => {
                              const val = (document.getElementById('manual-voice-id') as HTMLInputElement).value;
                              try {
                                const { error } = await supabase
                                  .from('interview_profiles')
                                  .update({ voice_id: val })
                                  .eq('id', selectedProfileId);
                                if (error) throw error;
                                alert(lang === 'ar' ? 'تم تحديث معرف الصوت!' : 'Voice ID updated!');
                                fetchProfiles();
                              } catch (e: any) {
                                alert(e.message);
                              }
                            }}
                            className="px-6 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition-all"
                          >
                            Update
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <input 
                            type="file" 
                            accept="audio/*"
                            id="voice-upload"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleVoiceUpload(file);
                            }}
                          />
                          <button 
                            disabled={isCloningVoice || isRecordingVoice}
                            onClick={() => document.getElementById('voice-upload')?.click()}
                            className={`flex-1 py-4 border border-dashed rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${theme === 'dark' ? 'border-white/20 hover:border-purple-500 hover:bg-purple-500/10' : 'border-gray-300 hover:border-purple-500 hover:bg-purple-50'}`}
                          >
                            {isCloningVoice && !isRecordingVoice ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                            <span>Upload</span>
                          </button>
                          
                          <button 
                            disabled={isCloningVoice}
                            onClick={isRecordingVoice ? stopRecordingVoice : startRecordingVoice}
                            className={`flex-1 py-4 border border-dashed rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${isRecordingVoice ? 'border-red-500 bg-red-500/10 text-red-500 animate-pulse' : theme === 'dark' ? 'border-white/20 hover:border-red-500 hover:bg-red-500/10' : 'border-gray-300 hover:border-red-500 hover:bg-red-50'}`}
                          >
                            {isRecordingVoice ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                            <span>{isRecordingVoice ? 'Stop' : 'Record'}</span>
                          </button>
                        </div>
                      </div>

                      {/* AI Instructions (System Prompt) */}
                      <div className="space-y-2 text-left pt-4 border-t border-white/5">
                        <label className="text-sm font-bold text-gray-500 ml-1">
                          {lang === 'ar' ? 'تعليمات الذكاء الاصطناعي (System Prompt):' : 'AI Instructions (System Prompt):'}
                        </label>
                        <textarea 
                          rows={4}
                          key={selectedProfileId} // Force re-render when profile changes to update defaultValue
                          defaultValue={interviewProfiles.find(p => p.id === selectedProfileId)?.system_prompt || ''}
                          id="manual-system-prompt"
                          className={`w-full p-4 rounded-xl border outline-none text-sm ${theme === 'dark' ? 'bg-[#1a1a1a] border-white/10 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700'}`}
                          placeholder="Tell the AI how to behave..."
                        />
                        <button 
                          onClick={async () => {
                            const val = (document.getElementById('manual-system-prompt') as HTMLTextAreaElement).value;
                            try {
                              const { error } = await supabase
                                .from('interview_profiles')
                                .update({ system_prompt: val })
                                .eq('id', selectedProfileId);
                              if (error) throw error;
                              alert(lang === 'ar' ? 'تم تحديث التعليمات بنجاح!' : 'Instructions updated successfully!');
                              fetchProfiles();
                            } catch (e: any) {
                              alert(e.message);
                            }
                          }}
                          className="w-full py-3 bg-blue-600/10 text-blue-500 border border-blue-500/20 rounded-xl font-bold hover:bg-blue-600/20 transition-all"
                        >
                          {lang === 'ar' ? 'حفظ التعليمات' : 'Save Instructions'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

                {!isEditingProfile && (
                  <button 
                    onClick={() => {
                      if(!selectedProfileId) return alert('Please select a profile first!');
                      setIsSessionActive(true);
                      setTranscript([{ role: 'system', text: 'Session started. Click the mic icon or type a question to begin.' }]);
                    }}
                    className={`w-full max-w-2xl py-5 mt-4 text-white rounded-2xl font-bold text-lg transition-all shadow-xl ${selectedProfileId ? 'bg-blue-600 hover:bg-blue-500 hover:scale-[1.02]' : 'bg-gray-500 cursor-not-allowed opacity-50'}`}
                  >
                    Start Session
                  </button>
                )}
              </div>
            ) : (
              <div className={`p-4 md:p-8 rounded-3xl border flex flex-col min-h-[600px] ${theme === 'dark' ? 'bg-[#111] border-white/5' : 'bg-white border-gray-200'}`}>
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 mb-6 pb-4 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center">
                      <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                    </div>
                    <div>
                      <h2 className="font-bold text-xl">Active Session</h2>
                      <p className="text-sm text-gray-500">
                        {isListening ? 'Listening...' : 'Paused'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:gap-4">
                    <button 
                      onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                      className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm md:text-base font-bold transition-all border ${
                        isVoiceEnabled 
                        ? 'bg-blue-600/10 text-blue-500 border-blue-500/20' 
                        : theme === 'dark' ? 'bg-white/5 text-gray-400 border-white/10' : 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}
                    >
                      {isVoiceEnabled ? 'Voice: ON 🔊' : 'Voice: OFF 🔇'}
                    </button>
                    <button 
                      onClick={() => setIsSessionActive(false)}
                      className="flex-1 md:flex-none px-4 py-2 bg-red-500/10 text-red-500 rounded-lg text-sm md:text-base font-bold hover:bg-red-500/20"
                    >
                      End Session
                    </button>
                  </div>
                </div>

                {rateLimitNotice && (
                  <div className="mb-6 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 font-medium flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">⚠️</span>
                      {rateLimitNotice}
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto space-y-6 mb-6 pr-2 scroll-smooth">
                  {transcript.map((msg, i) => {
                    if (msg.role === 'assistant') {
                      return (
                        <div key={i} className={`w-full ${theme === 'dark' ? 'bg-blue-900/20 border-blue-500/50' : 'bg-blue-50 border-blue-400'} border-l-4 p-5 md:p-8 rounded-r-2xl shadow-sm transition-all`}>
                          <strong className={`block mb-3 text-xs md:text-sm tracking-wider uppercase font-bold ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                            💡 Suggested Answer
                          </strong>
                          <p className={`text-xl md:text-3xl font-medium leading-relaxed tracking-wide ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {msg.text}
                          </p>
                        </div>
                      );
                    }
                    if (msg.role === 'user') {
                      return (
                        <div key={i} className={`w-full p-4 md:p-5 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/10 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                          <strong className="block mb-2 text-xs tracking-wider uppercase opacity-60">
                            🎤 Question Heard
                          </strong>
                          <p className="text-sm md:text-lg italic">
                            "{msg.text}"
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div key={i} className="w-full py-3 bg-transparent text-gray-500 text-center mx-auto text-sm border border-dashed border-gray-300/20 rounded-lg">
                        {msg.text}
                      </div>
                    );
                  })}
                  
                  {isAIGenerating && (
                    <div className={`w-full ${theme === 'dark' ? 'bg-blue-900/10 border-blue-500/20' : 'bg-blue-50/50 border-blue-200'} border-l-4 p-5 md:p-8 rounded-r-2xl shadow-sm transition-all`}>
                      <strong className={`block mb-3 text-xs md:text-sm tracking-wider uppercase font-bold text-blue-400 dark:text-blue-500`}>
                        🤖 AI Answer Generating...
                      </strong>
                      <div className="flex space-x-2 items-center py-2">
                        <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  )}

                  {draftPreview && (
                    <div className="w-full bg-blue-500/5 border-l-4 border-blue-500/40 p-4 md:p-6 rounded-r-2xl animate-pulse">
                      <strong className="block mb-2 text-xs tracking-wider uppercase font-bold text-blue-500">
                        ⚡ Draft Answer Preparing...
                      </strong>
                      <p className="text-lg md:text-xl font-medium text-gray-400">
                        {draftPreview}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2 mt-auto pt-4 border-t border-gray-200 dark:border-gray-800">
                  <button 
                    onClick={toggleListening}
                    title="Click to speak"
                    className={`w-12 h-12 md:w-14 md:h-14 shrink-0 rounded-full flex items-center justify-center text-white shadow-xl transition-all ${
                      isListening ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-blue-600 hover:bg-blue-500'
                    }`}
                  >
                    {isListening ? <div className="w-4 h-4 md:w-5 md:h-5 bg-white rounded-sm" /> : <Bot className="w-5 h-5 md:w-6 md:h-6" />}
                  </button>

                  <form onSubmit={submitManualQuestion} className="flex-1 w-full flex items-center gap-2">
                    <input
                      type="text"
                      value={manualQuestion}
                      onChange={(e) => setManualQuestion(e.target.value)}
                      placeholder="Type a question here..."
                      className="flex-1 bg-gray-100 dark:bg-white/5 border border-transparent dark:border-white/10 rounded-xl px-4 py-3 md:py-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
                    />
                    <button
                      type="submit"
                      disabled={!manualQuestion.trim()}
                      className="px-6 py-3 md:py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-white transition-all text-sm md:text-base"
                    >
                      Send
                    </button>
                  </form>
                </div>
              </div>
            )}
            </div>
            ) : null}
          </div>
        )}
      </main>

      {/* Add/Edit Config Modal */}
      <AnimatePresence>
        {isConfigModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConfigModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-lg rounded-[2.5rem] border p-8 shadow-2xl ${theme === 'dark' ? 'bg-[#111] border-white/10' : 'bg-white border-gray-200'}`}
            >
              <h2 className={`text-2xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editingConfig ? t.saveConfig : t.createConfig}</h2>
              <form onSubmit={handleConfigSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 ml-1">{t.configKey}</label>
                  <input 
                    required
                    value={configFormData.config_key}
                    onChange={e => setConfigFormData({...configFormData, config_key: e.target.value})}
                    className={`w-full border rounded-2xl p-4 outline-none focus:border-blue-500 transition-all font-mono ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}
                    placeholder="e.g. home_button_url"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 ml-1">{t.configVal}</label>
                  <textarea 
                    required
                    rows={6}
                    value={configFormData.config_value}
                    onChange={e => setConfigFormData({...configFormData, config_value: e.target.value})}
                    className={`w-full border rounded-2xl p-4 outline-none focus:border-blue-500 transition-all font-mono ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}
                    placeholder='{"url": "https://google.com", "label": "Google"}'
                  />
                </div>
                <div className="flex items-center gap-3">
                   <input 
                    type="checkbox"
                    checked={configFormData.is_enabled}
                    onChange={e => setConfigFormData({...configFormData, is_enabled: e.target.checked})}
                    className="w-5 h-5 accent-blue-600"
                   />
                   <label className="text-sm font-medium">{t.enabled}</label>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsConfigModalOpen(false)}
                    className={`flex-1 px-6 py-4 rounded-2xl font-bold transition-all ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                  >
                    {t.cancel}
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-4 bg-blue-600 rounded-2xl font-bold hover:bg-blue-500 transition-all text-white"
                  >
                    {editingConfig ? t.save : t.createBtn}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit User Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-2xl rounded-[2.5rem] border p-8 shadow-2xl overflow-y-auto max-h-[90vh] ${theme === 'dark' ? 'bg-[#111] border-white/10' : 'bg-white border-gray-200'}`}
            >
              <h2 className={`text-2xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editingUser ? t.edit : t.create}</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400 ml-1">{t.fullName}</label>
                    <input 
                      required
                      value={formData.username}
                      onChange={e => setFormData({...formData, username: e.target.value})}
                      className={`w-full border rounded-2xl p-4 outline-none focus:border-blue-500 transition-all ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400 ml-1">{t.loginPin}</label>
                    <input 
                      required
                      value={formData.pin}
                      onChange={e => setFormData({...formData, pin: e.target.value})}
                      className={`w-full border rounded-2xl p-4 outline-none focus:border-blue-500 transition-all font-mono ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}
                      placeholder="4-6 digits"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400 ml-1">{t.phone}</label>
                    <input 
                      value={formData.phone_number}
                      onChange={e => setFormData({...formData, phone_number: e.target.value})}
                      className={`w-full border rounded-2xl p-4 outline-none focus:border-blue-500 transition-all ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}
                      placeholder="+20123456789"
                    />
                  </div>
                  <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all h-[56px] self-end ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t.isManager}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.is_manager} 
                        onChange={e => setFormData({...formData, is_manager: e.target.checked})} 
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>

                <div className={`p-6 rounded-3xl border space-y-6 ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                  <h3 className="text-sm font-bold text-blue-500 flex items-center gap-2 uppercase tracking-widest">
                    <Globe className="w-4 h-4" /> {t.proxyConfig}
                  </h3>
                  
                  {/* Quick Paste Input */}
                  <div className="space-y-2">
                    <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block ml-1">
                      {t.quickPaste}
                    </label>
                    <div className="relative">
                      <input 
                        value={quickPaste}
                        onChange={e => handleQuickPasteChange(e.target.value)}
                        className={`w-full border rounded-xl p-3 outline-none focus:border-blue-500 transition-all font-mono text-sm ${theme === 'dark' ? 'bg-black/40 border-white/5 text-blue-400 placeholder-gray-600' : 'bg-white border-gray-200 text-blue-600 placeholder-gray-400'}`}
                        placeholder={t.quickPastePlaceholder}
                      />
                      {quickPaste && (
                        <div className="absolute right-3 top-3 text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          Auto-parsed!
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <input 
                        required
                        value={formData.proxy_ip}
                        onChange={e => setFormData({...formData, proxy_ip: e.target.value})}
                        className={`w-full border rounded-xl p-3 outline-none focus:border-blue-500 transition-all ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white border-gray-200'}`}
                        placeholder={t.ip}
                      />
                    </div>
                    <input 
                      required
                      type="number"
                      value={formData.proxy_port}
                      onChange={e => setFormData({...formData, proxy_port: e.target.value})}
                      className={`border rounded-xl p-3 outline-none focus:border-blue-500 transition-all ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white border-gray-200'}`}
                      placeholder={t.port}
                    />
                    <input 
                      value={formData.proxy_user}
                      onChange={e => setFormData({...formData, proxy_user: e.target.value})}
                      className={`border rounded-xl p-3 outline-none focus:border-blue-500 transition-all ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white border-gray-200'}`}
                      placeholder={t.user}
                    />
                    <input 
                      value={formData.proxy_pass}
                      onChange={e => setFormData({...formData, proxy_pass: e.target.value})}
                      className={`border rounded-xl p-3 outline-none focus:border-blue-500 transition-all ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white border-gray-200'}`}
                      placeholder={t.pass}
                    />
                    <input 
                      value={formData.proxy_location}
                      onChange={e => setFormData({...formData, proxy_location: e.target.value})}
                      className={`border rounded-xl p-3 outline-none focus:border-blue-500 transition-all ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white border-gray-200'}`}
                      placeholder={t.location}
                    />
                    <input 
                      value={formData.proxy_timezone}
                      onChange={e => setFormData({...formData, proxy_timezone: e.target.value})}
                      className={`border rounded-xl p-3 outline-none focus:border-blue-500 transition-all ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white border-gray-200'}`}
                      placeholder={t.timezone}
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className={`flex-1 px-6 py-4 rounded-2xl font-bold transition-all ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                  >
                    {t.cancel}
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-4 bg-blue-600 rounded-2xl font-bold hover:bg-blue-500 transition-all text-white"
                  >
                    {editingUser ? t.save : t.createBtn}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {isConfirmOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConfirmOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`relative w-full max-w-sm rounded-[2rem] border p-8 shadow-2xl text-center ${theme === 'dark' ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-gray-200'}`}
            >
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.confirmTitle}</h3>
              <p className="text-gray-500 text-sm mb-8">{t.confirmText}</p>
              
              <div className="flex flex-col gap-2">
                <button 
                  onClick={confirmDelete}
                  className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-500 transition-all"
                >
                  {t.confirmBtn}
                </button>
                <button 
                  onClick={() => setIsConfirmOpen(false)}
                  className={`w-full py-3 rounded-xl font-bold transition-all ${theme === 'dark' ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {t.confirmCancel}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


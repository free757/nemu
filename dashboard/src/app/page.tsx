'use client';

// Set to true to enable verbose per-event pipeline logging (for development debugging only)
const DEBUG_PIPELINE_LOGS = false;

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  ChevronDown,
  ChevronUp,
  Menu,
  Bot,
  Upload,
  Mic,
  MicOff,
  Ban,
  Bell,
  Clock,
  Layers,
  SlidersHorizontal,
  Sparkles,
  DollarSign,
  TrendingUp,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft
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

  // Notifications state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [expandedNotifications, setExpandedNotifications] = useState<Record<string, boolean>>({});
  const [editingNotification, setEditingNotification] = useState<any | null>(null);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [notificationFormData, setNotificationFormData] = useState({ title: '', content: '' });

  // Misc items state
  const [miscItems, setMiscItems] = useState<any[]>([]);
  const [isMiscModalOpen, setIsMiscModalOpen] = useState(false);
  const [editingMisc, setEditingMisc] = useState<any>(null);
  const [miscFormData, setMiscFormData] = useState({ title: '', content: '', display_order: 0 });

  // Overlay UI Settings state
  const [overlayUiSettings, setOverlayUiSettings] = useState({ show_open_app: true, show_misc: true });
  const [overlayUiConfigId, setOverlayUiConfigId] = useState<string | null>(null);

  // Per-user settings modal
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);
  const [selectedUserForSettings, setSelectedUserForSettings] = useState<any>(null);

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
  const [isBlockConfirmOpen, setIsBlockConfirmOpen] = useState(false);
  const [blockTargetUser, setBlockTargetUser] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editingConfig, setEditingConfig] = useState<any>(null);
  const [visualProjects, setVisualProjects] = useState<any[]>([]);
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('isSidebarCollapsed');
    if (saved !== null) {
      setIsSidebarCollapsed(saved === 'true');
    }
  }, []);

  const isProxyOnline = (user: any) => {
    if (user.proxy_status !== 'active' || !user.proxy_last_seen) return false;
    try {
      const lastSeen = new Date(user.proxy_last_seen).getTime();
      const now = new Date().getTime();
      return now - lastSeen < 120000; // 2 minutes
    } catch (e) {
      return false;
    }
  };

  const formatLastSeen = (lastSeenStr: string, lang: string) => {
    if (!lastSeenStr) return lang === 'ar' ? 'لم يتصل بعد' : 'Never';
    try {
      const lastSeen = new Date(lastSeenStr).getTime();
      const now = new Date().getTime();
      const diffMs = now - lastSeen;
      if (diffMs < 0) return lang === 'ar' ? 'منذ ثوانٍ' : 'just now';

      const diffSecs = Math.floor(diffMs / 1000);
      if (diffSecs < 60) {
        return lang === 'ar' ? 'منذ ثوانٍ' : 'just now';
      }

      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) {
        if (lang === 'ar') {
          if (diffMins === 1) return 'منذ دقيقة';
          if (diffMins === 2) return 'منذ دقيقتين';
          if (diffMins <= 10) return `منذ ${diffMins} دقائق`;
          return `منذ ${diffMins} دقيقة`;
        }
        return `${diffMins}m`;
      }

      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) {
        if (lang === 'ar') {
          if (diffHours === 1) return 'منذ ساعة';
          if (diffHours === 2) return 'منذ ساعتين';
          if (diffHours <= 10) return `منذ ${diffHours} ساعات`;
          return `منذ ${diffHours} ساعة`;
        }
        return `${diffHours}h`;
      }

      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) {
        return lang === 'ar' ? 'أمس' : 'yesterday';
      }
      if (lang === 'ar') {
        if (diffDays === 2) return 'منذ يومين';
        if (diffDays <= 10) return `منذ ${diffDays} أيام`;
        return `منذ ${diffDays} يوم`;
      }
      return `${diffDays}d`;
    } catch (e) {
      return lang === 'ar' ? 'غير معروف' : 'unknown';
    }
  };
  


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
    if (activeTab === 'notifications') fetchNotifications();
    if (activeTab === 'misc') fetchMiscItems();
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
    is_manager: false,
    email: '',
    password: '',
    verification_code: '',
    rah_human_id: '',
    rah_api_key: '',
    rah_hours_offset: '',
    rah_earnings_offset: '',
    rah_rate_override: '',
    rah_egp_rate: '',
    rah_exchange_rate: '',
    rah_usd_payout_unit: '',
    rah_egp_payout_unit: ''
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
      notifications: 'Notification Center',
      misc: 'Misc Items',
      signOut: 'Sign Out',
      title: 'Manage Users',
      configTitle: 'Remote Configuration',
      toolsTitle: 'AI Tools Suite',
      notificationsTitle: 'Global Notifications',
      miscTitle: 'Misc Overlay Items',
      subtitle: 'Control everything in real-time from one place.',
      toolsSubtitle: 'Your personal AI productivity and career suite.',
      notificationsSubtitle: 'Send messages and instructions to all mobile employees instantly.',
      miscSubtitle: 'Manage quick copy items shown in the floating mobile overlay.',
      addNew: 'Add New User',
      addConfig: 'Add New Config',
      addNotification: 'Send Notification',
      addMisc: 'Add Misc Item',
      search: 'Search users by name or PIN...',
      profile: 'User Profile',
      pin: 'PIN',
      proxy: 'Proxy Info',
      actions: 'Actions',
      noUsers: 'No users found matching your search.',
      noNotifications: 'No notifications have been sent yet.',
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
      isManager: 'Is Manager (Dashboard Access)',
      blockConfirm: 'Are you sure you want to block this user? They will be logged out of their phone instantly.',
      unblockConfirm: 'Are you sure you want to unblock this user?',
      notifTitle: 'Notification Title',
      notifContent: 'Message Content',
      send: 'Send Message',
      microsoftCreds: 'Microsoft Auto-Login Credentials',
      microsoftEmail: 'Microsoft Email',
      microsoftPassword: 'Microsoft Password',
      verificationCode: 'Verification Code (OTP)',
      rahTitle: 'RentAHuman Integration',
      rahHumanId: 'RentAHuman Human ID (Optional)',
      rahApiKey: 'RentAHuman API Key'
    },
    ar: {
      users: 'إدارة المستخدمين',
      config: 'الإعدادات عن بعد',
      tools: 'أدوات الذكاء الاصطناعي',
      notifications: 'مركز الإشعارات',
      misc: 'عناصر منوعة (Misc)',
      signOut: 'تسجيل الخروج',
      title: 'إدارة المستخدمين',
      configTitle: 'الإعدادات عن بعد',
      toolsTitle: 'حزمة أدوات الذكاء الاصطناعي',
      notificationsTitle: 'الإشعارات العامة',
      miscTitle: 'عناصر القائمة العائمة',
      subtitle: 'تحكم في كل شيء في الوقت الفعلي من مكان واحد.',
      toolsSubtitle: 'حزمة أدواتك الشخصية للإنتاجية والمسار المهني.',
      notificationsSubtitle: 'أرسل رسائل وتوجيهات لجميع الموظفين على الهواتف فوراً.',
      miscSubtitle: 'أدر العناصر السريعة التي تظهر في القائمة العائمة للنسخ السريع.',
      addNew: 'إضافة مستخدم جديد',
      addConfig: 'إضافة إعداد جديد',
      addNotification: 'إرسال إشعار جديد',
      addMisc: 'إضافة عنصر جديد',
      search: 'ابحث عن المستخدمين بالاسم أو الـ PIN...',
      profile: 'ملف المستخدم',
      pin: 'كود الدخول',
      proxy: 'بيانات البروكسي',
      actions: 'الإجراءات',
      noUsers: 'لم يتم العثور على مستخدمين يطابقون بحثك.',
      noNotifications: 'لم يتم إرسال أي إشعارات بعد.',
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
      isManager: 'مدير (صلاحية دخول لوحة التحكم)',
      blockConfirm: 'هل أنت متأكد من حظر هذا المستخدم؟ سيتم طرده وتسجيل خروجه من الهاتف فوراً.',
      unblockConfirm: 'هل أنت متأكد من إلغاء حظر هذا المستخدم؟',
      notifTitle: 'عنوان الإشعار',
      notifContent: 'محتوى الرسالة',
      send: 'إرسال الرسالة',
      microsoftCreds: 'بيانات تسجيل الدخول التلقائي لمايكروسوفت',
      microsoftEmail: 'بريد مايكروسوفت الإلكتروني',
      microsoftPassword: 'كلمة سر مايكروسوفت',
      verificationCode: 'رمز التحقق (OTP)',
      rahTitle: 'إعدادات RentAHuman',
      rahHumanId: 'معرف المستخدم (Human ID - اختياري)',
      rahApiKey: 'مفتاح الـ API لـ RentAHuman'
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

  const fetchNotifications = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
    if (!error) setNotifications(data);
    setLoading(false);
  };

  const handleNotificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notificationFormData.title || !notificationFormData.content) {
      alert(lang === 'ar' ? 'يرجى ملء جميع الحقول!' : 'Please fill all fields!');
      return;
    }
    
    if (editingNotification) {
      const { error } = await supabase
        .from('notifications')
        .update({
          title: notificationFormData.title,
          content: notificationFormData.content
        })
        .eq('id', editingNotification.id);
        
      if (!error) {
        setIsNotificationModalOpen(false);
        setEditingNotification(null);
        setNotificationFormData({ title: '', content: '' });
        fetchNotifications();
      } else {
        alert(error.message);
      }
    } else {
      const { error } = await supabase.from('notifications').insert([notificationFormData]);
      if (!error) {
        setIsNotificationModalOpen(false);
        setNotificationFormData({ title: '', content: '' });
        fetchNotifications();
      } else {
        alert(error.message);
      }
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذا الإشعار؟' : 'Are you sure you want to delete this notification?')) {
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (!error) {
        fetchNotifications();
      } else {
        alert(error.message);
      }
    }
  };

  const fetchMiscItems = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('misc_items').select('*').order('display_order', { ascending: true });
    if (!error) setMiscItems(data);
    setLoading(false);
  };

  const fetchOverlayUiSettings = async () => {
    const { data, error } = await supabase.from('remote_configs').select('*').eq('config_key', 'overlay_ui_settings').maybeSingle();
    if (data) {
      setOverlayUiConfigId(data.id);
      setOverlayUiSettings(data.config_value);
    } else if (!error || error.code === 'PGRST116') {
      // Create it if it doesn't exist
      const defaultSettings = { show_open_app: true, show_misc: true };
      const { data: newData, error: insertError } = await supabase.from('remote_configs').insert([{
        config_key: 'overlay_ui_settings',
        config_value: defaultSettings,
        is_enabled: true
      }]).select().single();
      
      if (!insertError && newData) {
        setOverlayUiConfigId(newData.id);
        setOverlayUiSettings(newData.config_value);
      }
    }
  };

  const toggleOverlayUiSetting = async (key: 'show_open_app' | 'show_misc') => {
    const newSettings = { ...overlayUiSettings, [key]: !overlayUiSettings[key] };
    setOverlayUiSettings(newSettings);
    
    if (overlayUiConfigId) {
      await supabase.from('remote_configs').update({ config_value: newSettings }).eq('id', overlayUiConfigId);
    }
  };

  const handleOpenUserSettings = (user: any) => {
    setSelectedUserForSettings(user);
    setIsUserSettingsOpen(true);
  };

  const toggleUserProjectVisibility = async (projectId: string) => {
    if (!selectedUserForSettings) return;
    const currentSettings = selectedUserForSettings.ui_settings || {};
    const currentProjects = currentSettings.projects || {};
    const currentValue = currentProjects[projectId];
    // undefined/true => visible, false => hidden. Toggle it.
    const newValue = currentValue === false ? true : false;
    const newSettings = {
      ...currentSettings,
      projects: { ...currentProjects, [projectId]: newValue }
    };
    // Optimistic UI
    setSelectedUserForSettings({ ...selectedUserForSettings, ui_settings: newSettings });
    setUsers((prev: any[]) => prev.map((u: any) => u.id === selectedUserForSettings.id ? { ...u, ui_settings: newSettings } : u));
    const { error } = await supabase.from('app_users').update({ ui_settings: newSettings }).eq('id', selectedUserForSettings.id);
    if (error) alert(error.message);
  };

  const toggleUserOverlayBtn = async (key: 'show_open_app' | 'show_misc') => {
    if (!selectedUserForSettings) return;
    const currentSettings = selectedUserForSettings.ui_settings || {};
    const currentOverlay = currentSettings.overlay || {};
    const newValue = currentOverlay[key] === false ? true : false;
    const newSettings = {
      ...currentSettings,
      overlay: { ...currentOverlay, [key]: newValue }
    };
    setSelectedUserForSettings({ ...selectedUserForSettings, ui_settings: newSettings });
    setUsers((prev: any[]) => prev.map((u: any) => u.id === selectedUserForSettings.id ? { ...u, ui_settings: newSettings } : u));
    const { error } = await supabase.from('app_users').update({ ui_settings: newSettings }).eq('id', selectedUserForSettings.id);
    if (error) alert(error.message);
  };

  const handleMiscSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!miscFormData.title || !miscFormData.content) {
      alert(lang === 'ar' ? 'يرجى ملء جميع الحقول!' : 'Please fill all fields!');
      return;
    }
    
    let error;
    if (editingMisc) {
      const { error: err } = await supabase.from('misc_items').update(miscFormData).eq('id', editingMisc.id);
      error = err;
    } else {
      const { error: err } = await supabase.from('misc_items').insert([miscFormData]);
      error = err;
    }

    if (!error) {
      setIsMiscModalOpen(false);
      setEditingMisc(null);
      setMiscFormData({ title: '', content: '', display_order: 0 });
      fetchMiscItems();
    } else {
      alert(error.message);
    }
  };

  const handleDeleteMisc = async (id: string) => {
    if (confirm(lang === 'ar' ? 'هل أنت متأكد من الحذف؟' : 'Are you sure you want to delete this?')) {
      const { error } = await supabase.from('misc_items').delete().eq('id', id);
      if (!error) {
        fetchMiscItems();
      } else {
        alert(error.message);
      }
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchConfigs();
    fetchNotifications();
    fetchMiscItems();
    fetchOverlayUiSettings();

    // Realtime channel for app_users updates
    const channel = supabase
      .channel('app_users_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_users' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setUsers((prev) => [payload.new as any, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setUsers((prev) =>
              prev.map((user) => (user.id === payload.new.id ? { ...user, ...payload.new } : user))
            );
          } else if (payload.eventType === 'DELETE') {
            setUsers((prev) => prev.filter((user) => user.id === payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const handleToggleBlock = (user: any) => {
    setBlockTargetUser(user);
    setIsBlockConfirmOpen(true);
  };

  const confirmBlock = async () => {
    if (!blockTargetUser) return;
    const newStatus = !blockTargetUser.is_blocked;

    const { error } = await supabase
      .from('app_users')
      .update({ is_blocked: newStatus })
      .eq('id', blockTargetUser.id);

    if (!error) {
      fetchUsers();
      setIsBlockConfirmOpen(false);
      setBlockTargetUser(null);
    } else {
      alert(error.message);
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
      is_manager: user.is_manager || false,
      email: user.email || '',
      password: user.password || '',
      verification_code: user.verification_code || '',
      rah_human_id: user.rah_human_id || '',
      rah_api_key: user.rah_api_key || '',
      rah_hours_offset: user.ui_settings?.rah?.hours_offset?.toString() || '',
      rah_earnings_offset: user.ui_settings?.rah?.earnings_offset?.toString() || '',
      rah_rate_override: user.ui_settings?.rah?.rate_override?.toString() || '',
      rah_egp_rate: user.ui_settings?.rah?.egp_rate?.toString() || '',
      rah_exchange_rate: user.ui_settings?.rah?.exchange_rate?.toString() || '',
      rah_usd_payout_unit: user.ui_settings?.rah?.usd_payout_unit?.toString() || '',
      rah_egp_payout_unit: user.ui_settings?.rah?.egp_payout_unit?.toString() || ''
    });
    setIsModalOpen(true);
  };

  const handleOpenConfigEdit = (config: any) => {
    setEditingConfig(config);
    const isProjects = config.config_key === 'projects';
    let valStr = '';
    if (typeof config.config_value === 'object') {
      valStr = JSON.stringify(config.config_value, null, 2);
      if (isProjects) {
        setVisualProjects(config.config_value || []);
      }
    } else {
      valStr = config.config_value;
      if (isProjects) {
        try {
          setVisualProjects(JSON.parse(config.config_value) || []);
        } catch {
          setVisualProjects([]);
        }
      }
    }
    setConfigFormData({
      config_key: config.config_key,
      config_value: valStr,
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
        proxy_location: '', proxy_timezone: '', is_manager: false,
        email: '', password: '', verification_code: '',
        rah_human_id: '', rah_api_key: '',
        rah_hours_offset: '', rah_earnings_offset: '', rah_rate_override: '',
        rah_egp_rate: '', rah_exchange_rate: '',
        rah_usd_payout_unit: '', rah_egp_payout_unit: ''
      });
      setIsModalOpen(true);
    } else {
      setEditingConfig(null);
      setVisualProjects([]);
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
    
    if (configFormData.config_key === 'projects') {
      parsedValue = visualProjects;
    } else {
      try {
        parsedValue = JSON.parse(configFormData.config_value);
      } catch (e) {
        parsedValue = configFormData.config_value;
      }
    }

    const payload = {
      config_key: configFormData.config_key,
      config_value: parsedValue,
      is_enabled: configFormData.is_enabled
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

  const handleCreateDefaultProjectsConfig = async () => {
    const defaultPayload = {
      config_key: 'projects',
      config_value: [
        {
          id: 'project-1',
          name: 'Project 1',
          url: 'https://we.toloka.ai/auth?retpath=https%3A%2F%2Fwe.toloka.ai%2F',
          color: '0xFFFFA726',
          custom_js: '',
          selectors_to_hide: ['.header-banner', '.footer-links'],
          android_package_name: '',
          ios_url_scheme: '',
          app_store_link: ''
        }
      ],
      is_enabled: true
    };
    const { error } = await supabase.from('remote_configs').insert([defaultPayload]);
    if (!error) {
      fetchConfigs();
    } else {
      alert(error.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const originalUiSettings = editingUser?.ui_settings || {};
    const ui_settings = {
      ...originalUiSettings,
      rah: {
        hours_offset: formData.rah_hours_offset ? parseFloat(formData.rah_hours_offset) : 0,
        earnings_offset: formData.rah_earnings_offset ? parseFloat(formData.rah_earnings_offset) : 0,
        rate_override: formData.rah_rate_override ? parseFloat(formData.rah_rate_override) : null,
        egp_rate: formData.rah_egp_rate ? parseFloat(formData.rah_egp_rate) : null,
        exchange_rate: formData.rah_exchange_rate ? parseFloat(formData.rah_exchange_rate) : null,
        usd_payout_unit: formData.rah_usd_payout_unit ? parseFloat(formData.rah_usd_payout_unit) : null,
        egp_payout_unit: formData.rah_egp_payout_unit ? parseFloat(formData.rah_egp_payout_unit) : null,
      }
    };

    const payload = {
      pin: formData.pin,
      username: formData.username,
      proxy_ip: formData.proxy_ip?.trim() || null,
      proxy_port: formData.proxy_port ? parseInt(formData.proxy_port) : null,
      proxy_user: formData.proxy_user?.trim() || null,
      proxy_pass: formData.proxy_pass?.trim() || null,
      proxy_location: formData.proxy_location?.trim() || null,
      proxy_timezone: formData.proxy_timezone?.trim() || null,
      phone_number: formData.phone_number?.trim() || null,
      email: formData.email?.trim() || null,
      password: formData.password?.trim() || null,
      verification_code: formData.verification_code?.trim() || null,
      rah_human_id: formData.rah_human_id?.trim() || null,
      rah_api_key: formData.rah_api_key?.trim() || null,
      ui_settings
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
  ).sort((a, b) => {
    // 1. Manager check: managers always first
    if (a.is_manager && !b.is_manager) return -1;
    if (!a.is_manager && b.is_manager) return 1;

    // 2. Online check: online users first
    const aOnline = isProxyOnline(a);
    const bOnline = isProxyOnline(b);
    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;

    // 3. Fallback: alphabetical sorting by username
    return (a.username || '').localeCompare(b.username || '');
  });

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
        {(isMobileMenuOpen || true) && (
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
                onClick={() => {
                  const val = !isSidebarCollapsed;
                  setIsSidebarCollapsed(val);
                  localStorage.setItem('isSidebarCollapsed', String(val));
                }}
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
                <button 
                  onClick={() => { setActiveTab('notifications'); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'notifications' ? 'bg-blue-600/10 text-blue-500 border border-blue-500/20' : theme === 'dark' ? 'text-gray-400 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100'} ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
                >
                  <Bell className="w-5 h-5 flex-shrink-0" />
                  {!isSidebarCollapsed && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-medium whitespace-nowrap">{t.notifications}</motion.span>}
                </button>
                <button 
                  onClick={() => { setActiveTab('misc'); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'misc' ? 'bg-blue-600/10 text-blue-500 border border-blue-500/20' : theme === 'dark' ? 'text-gray-400 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100'} ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
                >
                  <Layers className="w-5 h-5 flex-shrink-0" />
                  {!isSidebarCollapsed && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-medium whitespace-nowrap">{t.misc}</motion.span>}
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
      <main className="flex-1 overflow-y-auto scroll-gpu">
        <header className={`sticky top-0 z-30 px-4 md:px-8 py-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 ${theme === 'dark' ? 'bg-[#0a0a0a] border-white/5' : 'bg-[#f8f9fa] border-gray-200'}`}>
          <div>
            <h1 className="text-2xl font-bold mb-1">
              {activeTab === 'users' ? t.title : activeTab === 'config' ? t.configTitle : activeTab === 'notifications' ? t.notificationsTitle : activeTab === 'misc' ? t.miscTitle : t.toolsTitle}
            </h1>
            <p className="text-gray-500 text-xs md:text-sm">
              {activeTab === 'users' ? t.subtitle : activeTab === 'config' ? t.subtitle : activeTab === 'notifications' ? t.notificationsSubtitle : activeTab === 'misc' ? t.miscSubtitle : t.toolsSubtitle}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <DashboardLiveClock lang={lang} theme={theme} />
            {activeTab === 'users' && (() => {
              const nm = users.filter(u => !u.is_manager);
              const on = nm.filter(u => isProxyOnline(u)).length;
              return (
                <div className="flex items-center gap-2 mr-2">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}>
                    <Users className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-400">{lang === 'ar' ? 'الكل' : 'Total'}</span>
                    <span className="font-bold ml-1">{nm.length}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs font-semibold text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    <span>{lang === 'ar' ? 'متصل' : 'Online'}</span>
                    <span className="font-bold ml-1">{on}</span>
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold text-gray-400 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                    <span>{lang === 'ar' ? 'غير متصل' : 'Offline'}</span>
                    <span className="font-bold ml-1">{nm.length - on}</span>
                  </div>
                </div>
              );
            })()}
            {activeTab !== 'tools' && (
              <>
                <button 
                  onClick={activeTab === 'users' ? fetchUsers : activeTab === 'config' ? fetchConfigs : activeTab === 'misc' ? fetchMiscItems : fetchNotifications}
                  className={`p-2.5 border rounded-xl transition-all ${theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button 
                  onClick={activeTab === 'notifications' ? () => setIsNotificationModalOpen(true) : activeTab === 'misc' ? () => { setEditingMisc(null); setMiscFormData({ title: '', content: '', display_order: 0 }); setIsMiscModalOpen(true); } : handleOpenAdd}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 rounded-xl hover:bg-blue-500 transition-all font-bold text-white shadow-lg shadow-blue-600/20 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>{activeTab === 'users' ? t.addNew : activeTab === 'config' ? t.addConfig : activeTab === 'misc' ? t.addMisc : t.addNotification}</span>
                </button>
              </>
            )}
          </div>
        </header>

        <div className="p-4 md:p-8">
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
                    <th className="px-6 py-5 text-gray-400 font-medium">RentAHuman</th>
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
                              <div className="flex items-center flex-wrap gap-2">
                                <p className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user.username}</p>
                                {user.is_manager && (
                                  <span className="px-2 py-0.5 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full font-bold uppercase tracking-wider">
                                    Manager
                                  </span>
                                )}
                                {user.is_blocked && (
                                  <span className="px-2 py-0.5 text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 rounded-full font-bold uppercase tracking-wider">
                                    Blocked
                                  </span>
                                )}
                                {user.email && user.password && (
                                  <span className="px-2 py-0.5 text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                                    🔑 Auto-Login
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-500 text-sm">{user.phone_number}</p>
                              {user.email && (
                                <p className="text-xs text-gray-400 mt-1 flex items-center flex-wrap gap-1 font-mono">
                                  <span>📧 {user.email}</span>
                                  {user.verification_code && (
                                    <span className="text-amber-400 font-bold bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20 font-sans text-[10px]">
                                      OTP: {user.verification_code}
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`px-3 py-1 border rounded-lg font-mono text-blue-400 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-blue-50 border-blue-100'}`}>
                            {user.pin}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          {user.is_manager ? (
                            <div className="flex items-center gap-2 bg-amber-500/10 text-amber-400 px-3 py-1.5 rounded-xl w-max font-bold text-xs border border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.1)]">
                              <ShieldCheck className="w-4 h-4 text-amber-400" strokeWidth={2.5} />
                              <span>{lang === 'ar' ? 'مدير النظام (صلاحيات كاملة)' : 'System Administrator'}</span>
                            </div>
                          ) : (
                            <div className="text-sm">
                              <p className="flex items-center gap-2">
                                <Globe className="w-3 h-3 text-gray-500" />
                                <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>{user.proxy_ip}:{user.proxy_port}</span>
                              </p>
                              <p className="text-gray-500 text-xs flex items-center gap-1">
                                 <MapPin className="w-3 h-3" /> {user.proxy_location || 'N/A'} • {user.proxy_timezone || 'N/A'}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5">
                                {user.proxy_timezone && <UserTimezoneDisplay timezone={user.proxy_timezone} small />}
                                {isProxyOnline(user) ? (
                                  <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full w-max font-semibold text-[10px] border border-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    <span>ONLINE</span>
                                  </div>
                                ) : (
                                  <div 
                                    className="flex items-center gap-1 bg-gray-500/10 text-gray-400 px-2 py-0.5 rounded-full w-max font-medium text-[10px] border border-gray-500/10 cursor-help"
                                    title={user.proxy_last_seen ? new Date(user.proxy_last_seen).toLocaleString() : undefined}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                                    <span>{lang === 'ar' ? `آخر ظهور: ${formatLastSeen(user.proxy_last_seen, 'ar')}` : `LAST SEEN: ${formatLastSeen(user.proxy_last_seen, 'en').toUpperCase()}`}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <RentAHumanDisplay user={user} theme={theme} lang={lang} />
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => handleOpenUserSettings(user)}
                              className="p-2 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-all"
                              title="User Button Settings"
                            >
                              <SlidersHorizontal className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleToggleBlock(user)}
                              className={`p-2 rounded-lg transition-all ${user.is_blocked ? 'text-red-500 hover:bg-red-500/10' : 'text-gray-400 hover:text-red-400 hover:bg-red-500/5'}`}
                              title={user.is_blocked ? 'Unblock User' : 'Block User'}
                            >
                              <Ban className="w-4 h-4" />
                            </button>
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
                        <div className="flex items-center flex-wrap gap-2">
                          <h3 className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user.username}</h3>
                          {user.is_manager && (
                            <span className="px-2 py-0.5 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full font-bold uppercase tracking-wider">
                              Manager
                            </span>
                          )}
                          {user.is_blocked && (
                            <span className="px-2 py-0.5 text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 rounded-full font-bold uppercase tracking-wider">
                              Blocked
                            </span>
                          )}
                          {user.email && user.password && (
                            <span className="px-2 py-0.5 text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                              🔑 Auto-Login
                            </span>
                          )}
                        </div>
                        <p className="text-gray-500 text-sm">{user.phone_number}</p>
                        {user.email && (
                          <p className="text-xs text-gray-400 mt-1 flex items-center flex-wrap gap-1 font-mono">
                            <span>📧 {user.email}</span>
                            {user.verification_code && (
                              <span className="text-amber-400 font-bold bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20 font-sans text-[10px]">
                                OTP: {user.verification_code}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={`px-3 py-1 border rounded-lg font-mono text-sm text-blue-400 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-blue-50 border-blue-100'}`}>
                      {user.pin}
                    </span>
                  </div>

                  <RentAHumanDisplay user={user} theme={theme} lang={lang} isMobile />

                  {user.is_manager ? (
                    <div className={`p-5 rounded-2xl border flex flex-col items-center text-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.05)] ${theme === 'dark' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50/50 border-amber-200'}`}>
                      <div className="p-3 bg-amber-500/10 rounded-full text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                        <ShieldCheck className="w-6 h-6" strokeWidth={2.5} />
                      </div>
                      <p className="text-sm font-bold text-amber-500">{lang === 'ar' ? 'مدير النظام (صلاحيات كاملة)' : 'System Administrator'}</p>
                      <p className="text-xs text-gray-500 max-w-[240px]">
                        {lang === 'ar' ? 'صلاحيات وصول كاملة لوحة التحكم وخيارات التهيئة.' : 'Full system privileges for dashboard configurations and logs.'}
                      </p>
                    </div>
                  ) : (
                    <div className={`p-4 rounded-2xl space-y-2 ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">{t.proxy}</p>
                      <p className="flex items-center gap-2 text-sm">
                        <Globe className="w-4 h-4 text-blue-500" />
                        <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>{user.proxy_ip}:{user.proxy_port}</span>
                      </p>
                      <p className="text-gray-500 text-xs flex items-center gap-2">
                         <MapPin className="w-4 h-4" /> {user.proxy_location || 'N/A'} • {user.proxy_timezone || 'N/A'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {user.proxy_timezone && <UserTimezoneDisplay timezone={user.proxy_timezone} />}
                        {isProxyOnline(user) ? (
                          <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-xl w-max font-semibold text-xs border border-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span>ONLINE</span>
                          </div>
                        ) : (
                          <div 
                            className="flex items-center gap-1.5 bg-gray-500/10 text-gray-400 px-3 py-1 rounded-xl w-max font-medium text-xs border border-gray-500/10 cursor-help"
                            title={user.proxy_last_seen ? new Date(user.proxy_last_seen).toLocaleString() : undefined}
                          >
                            <span className="w-2 h-2 rounded-full bg-gray-400" />
                            <span>{lang === 'ar' ? `آخر ظهور: ${formatLastSeen(user.proxy_last_seen, 'ar')}` : `LAST SEEN: ${formatLastSeen(user.proxy_last_seen, 'en').toUpperCase()}`}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleToggleBlock(user)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${user.is_blocked ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                      <Ban className="w-4 h-4" />
                      <span>{user.is_blocked ? (lang === 'ar' ? 'فك حظر' : 'Unblock') : (lang === 'ar' ? 'حظر' : 'Block')}</span>
                    </button>
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
          <div>
            {remoteConfigs.length === 0 ? (
              <div className={`p-16 text-center rounded-[2rem] border ${theme === 'dark' ? 'bg-[#111] border-white/5' : 'bg-white border-gray-200'} flex flex-col items-center justify-center space-y-4`}>
                <Settings className="w-12 h-12 text-gray-500" />
                <h3 className="text-xl font-bold">{lang === 'ar' ? 'لا توجد إعدادات مضافة' : 'No Configurations Found'}</h3>
                <p className="text-sm text-gray-500 max-w-sm">
                  {lang === 'ar' 
                    ? 'لم يتم العثور على أي تكوينات. يمكنك إنشاء إعداد المشاريع الافتراضي للبدء فوراً.' 
                    : 'Create a default "projects" config to quickly get started managing your mobile buttons.'}
                </p>
                <button
                  onClick={handleCreateDefaultProjectsConfig}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20"
                >
                  <Plus className="w-5 h-5" />
                  {lang === 'ar' ? 'إنشاء إعداد المشاريع الافتراضي' : 'Create Default "projects" Config'}
                </button>
              </div>
            ) : (
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

                    {config.config_key !== 'overlay_ui_settings' && (
                      <div className={`rounded-2xl p-4 font-mono overflow-x-auto max-h-60 overflow-y-auto ${theme === 'dark' ? 'bg-black/50' : 'bg-gray-50 border border-gray-100'}`}>
                        <pre className={`text-blue-400 ${lang === 'ar' ? 'text-right' : 'text-left'} text-xs md:text-sm`}>{JSON.stringify(config.config_value, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'notifications' ? (
          <div className="space-y-6 max-w-5xl">
            {notifications.length === 0 ? (
              <div className={`p-16 text-center rounded-[2rem] border ${theme === 'dark' ? 'bg-[#111] border-white/5' : 'bg-white border-gray-200'} flex flex-col items-center justify-center space-y-4`}>
                <Bell className="w-12 h-12 text-gray-500" />
                <h3 className="text-xl font-bold">{t.noNotifications}</h3>
                <p className="text-sm text-gray-500 max-w-sm">
                  {lang === 'ar' 
                    ? 'لم يتم إرسال أي إشعار حتى الآن للموظفين. يمكنك إرسال إشعارك الأول الآن!' 
                    : 'Get started by creating your very first global notification for your employees.'}
                </p>
                <button
                  onClick={() => setIsNotificationModalOpen(true)}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20"
                >
                  <Plus className="w-5 h-5" />
                  {t.addNotification}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {notifications.map((notif) => {
                  const isExpanded = expandedNotifications[notif.id] || false;
                  const isLong = notif.content && notif.content.length > 160;
                  return (
                    <motion.div 
                      layout
                      key={notif.id} 
                      className={`p-6 rounded-3xl border flex justify-between items-start gap-4 transition-all ${theme === 'dark' ? 'bg-[#111] border-white/5 hover:border-white/10' : 'bg-white border-gray-200 hover:shadow-lg'}`}
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-600/10 text-blue-500 rounded-lg flex items-center justify-center">
                            <Bell className="w-4 h-4" />
                          </div>
                          <h4 className="text-lg font-bold">{notif.title}</h4>
                        </div>
                        <motion.p 
                          layout
                          className="text-gray-400 text-sm md:text-base whitespace-pre-wrap leading-relaxed"
                        >
                          {isLong && !isExpanded
                            ? notif.content.slice(0, 160) + '...'
                            : notif.content}
                        </motion.p>
                        {isLong && (
                          <button
                            onClick={() => setExpandedNotifications(prev => ({ ...prev, [notif.id]: !prev[notif.id] }))}
                            className="text-xs font-bold text-blue-500 hover:text-blue-400 flex items-center gap-1 mt-1 transition-all px-2.5 py-1 rounded-lg bg-blue-500/5 hover:bg-blue-500/10 self-start"
                          >
                            {isExpanded ? (
                              <>
                                {lang === 'ar' ? 'عرض أقل' : 'Show Less'}
                                <ChevronUp className="w-3.5 h-3.5" />
                              </>
                            ) : (
                              <>
                                {lang === 'ar' ? 'عرض المزيد' : 'Show More'}
                                <ChevronDown className="w-3.5 h-3.5" />
                              </>
                            )}
                          </button>
                        )}
                        <span className="text-xs text-gray-500 block pt-1">
                          {new Date(notif.created_at).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                        </span>
                      </div>
                      <div className="flex gap-2 self-start">
                        <button 
                          onClick={() => {
                            setEditingNotification(notif);
                            setNotificationFormData({ title: notif.title || '', content: notif.content || '' });
                            setIsNotificationModalOpen(true);
                          }}
                          className="p-3 text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all"
                          title={lang === 'ar' ? 'تعديل الإشعار' : 'Edit Notification'}
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteNotification(notif.id)}
                          className="p-3 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === 'misc' ? (
          <div className="space-y-6 max-w-5xl">
            {miscItems.length === 0 ? (
              <div className={`p-16 text-center rounded-[2rem] border ${theme === 'dark' ? 'bg-[#111] border-white/5' : 'bg-white border-gray-200'} flex flex-col items-center justify-center space-y-4`}>
                <Layers className="w-12 h-12 text-gray-500" />
                <h3 className="text-xl font-bold">No Misc Items Yet</h3>
                <p className="text-sm text-gray-500 max-w-sm">
                  {lang === 'ar' 
                    ? 'لم تقم بإضافة أي عناصر منوعة للنسخ السريع بعد.' 
                    : 'Get started by creating quick copy items for your overlay.'}
                </p>
                <button
                  onClick={() => setIsMiscModalOpen(true)}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20"
                >
                  <Plus className="w-5 h-5" />
                  {t.addMisc}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {miscItems.map((item) => (
                  <div key={item.id} className={`p-6 rounded-3xl border flex flex-col gap-4 transition-all hover:scale-[1.01] ${theme === 'dark' ? 'bg-[#111] border-white/5 hover:border-white/10' : 'bg-white border-gray-200 hover:shadow-lg'}`}>
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-600/10 text-purple-500 rounded-lg flex items-center justify-center">
                          <Layers className="w-4 h-4" />
                        </div>
                        <h4 className="text-lg font-bold">{item.title}</h4>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => { setEditingMisc(item); setMiscFormData({ title: item.title, content: item.content, display_order: item.display_order }); setIsMiscModalOpen(true); }}
                          className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteMisc(item.id)}
                          className="p-2 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className={`p-3 rounded-xl font-mono text-sm max-h-32 overflow-y-auto ${theme === 'dark' ? 'bg-black/50 text-gray-300' : 'bg-gray-50 text-gray-700 border border-gray-100'}`}>
                      {item.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                <div className="w-20 h-20 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center">
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
        </div>
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
                {configFormData.config_key === 'projects' ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-bold text-gray-400">{lang === 'ar' ? 'المشاريع / أزرار التطبيقات' : 'Projects / App Buttons'}</label>
                      <button
                        type="button"
                        onClick={() => {
                          setVisualProjects([
                            ...visualProjects,
                            {
                              id: `project-${Date.now()}`,
                              name: lang === 'ar' ? 'مشروع جديد' : 'New Project',
                              url: '',
                              color: '0xFF3B82F6',
                              selectors_to_hide: [],
                              custom_js: '',
                              android_package_name: '',
                              ios_url_scheme: '',
                              app_store_link: ''
                            }
                          ]);
                        }}
                        className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center gap-1 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {lang === 'ar' ? 'إضافة زر جديد' : 'Add New Button'}
                      </button>
                    </div>

                    <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-1">
                      {visualProjects.map((proj, idx) => {
                        const isApp = proj.android_package_name || proj.ios_url_scheme;
                        return (
                          <div key={proj.id} className={`p-5 rounded-3xl border space-y-4 relative ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                            <button
                              type="button"
                              onClick={() => {
                                setVisualProjects(visualProjects.filter(p => p.id !== proj.id));
                              }}
                              className="absolute top-4 right-4 p-1.5 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                              title="Remove Project"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                            {/* Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-xs text-gray-500 font-medium">{lang === 'ar' ? 'اسم الزر / المشروع' : 'Button / Project Name'}</label>
                                <input
                                  required
                                  value={proj.name}
                                  onChange={e => {
                                    const newList = [...visualProjects];
                                    newList[idx].name = e.target.value;
                                    setVisualProjects(newList);
                                  }}
                                  className={`w-full text-sm border rounded-xl p-3 outline-none focus:border-blue-500 transition-all ${theme === 'dark' ? 'bg-black/20 border-white/5 text-white' : 'bg-white border-gray-200'}`}
                                  placeholder="e.g. Toloka AI"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-xs text-gray-500 font-medium">{lang === 'ar' ? 'لون الزر (كود Hex)' : 'Button Color (Hex)'}</label>
                                <div className="flex gap-2">
                                  <input
                                    value={proj.color}
                                    onChange={e => {
                                      const newList = [...visualProjects];
                                      newList[idx].color = e.target.value;
                                      setVisualProjects(newList);
                                    }}
                                    className={`flex-1 text-sm border rounded-xl p-3 outline-none focus:border-blue-500 transition-all font-mono ${theme === 'dark' ? 'bg-black/20 border-white/5 text-white' : 'bg-white border-gray-200'}`}
                                    placeholder="e.g. 0xFF3B82F6"
                                  />
                                  <div 
                                    className="w-11 h-11 rounded-xl border border-white/10"
                                    style={{ backgroundColor: proj.color.startsWith('0xFF') ? `#${proj.color.substring(4)}` : proj.color }}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Type selector */}
                            <div className="space-y-2">
                              <label className="text-xs text-gray-500 font-medium">{lang === 'ar' ? 'نوع الإجراء عند الضغط' : 'Action Type on Click'}</label>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newList = [...visualProjects];
                                    newList[idx].android_package_name = '';
                                    newList[idx].ios_url_scheme = '';
                                    newList[idx].app_store_link = '';
                                    setVisualProjects(newList);
                                  }}
                                  className={`flex-1 py-2 px-3 text-xs rounded-xl font-bold border transition-all ${!isApp ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-transparent border-white/5 text-gray-400'}`}
                                >
                                  {lang === 'ar' ? 'فتح موقع ويب (WebView)' : 'Open Website (WebView)'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newList = [...visualProjects];
                                    if (!newList[idx].android_package_name) newList[idx].android_package_name = 'com.example.app';
                                    setVisualProjects(newList);
                                  }}
                                  className={`flex-1 py-2 px-3 text-xs rounded-xl font-bold border transition-all ${isApp ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-transparent border-white/5 text-gray-400'}`}
                                >
                                  {lang === 'ar' ? 'فتح تطبيق خارجي (أندرويد / آيفون)' : 'Open Native App (Android/iOS)'}
                                </button>
                              </div>
                            </div>

                            {/* Fields based on type */}
                            {!isApp ? (
                              <div className="space-y-3 animate-in fade-in duration-150">
                                <div className="space-y-1">
                                  <label className="text-xs text-gray-500 font-medium">WebView URL</label>
                                  <input
                                    required
                                    value={proj.url}
                                    onChange={e => {
                                      const newList = [...visualProjects];
                                      newList[idx].url = e.target.value;
                                      setVisualProjects(newList);
                                    }}
                                    type="url"
                                    className={`w-full text-sm border rounded-xl p-3 outline-none focus:border-blue-500 transition-all ${theme === 'dark' ? 'bg-black/20 border-white/5 text-white' : 'bg-white border-gray-200'}`}
                                    placeholder="https://we.toloka.ai/..."
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs text-gray-500 font-medium">{lang === 'ar' ? 'العناصر المراد إخفاؤها (فصل بفاصلة)' : 'CSS Selectors to Hide (comma-separated)'}</label>
                                  <input
                                    value={proj.selectors_to_hide?.join(', ')}
                                    onChange={e => {
                                      const newList = [...visualProjects];
                                      newList[idx].selectors_to_hide = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                      setVisualProjects(newList);
                                    }}
                                    className={`w-full text-sm border rounded-xl p-3 outline-none focus:border-blue-500 transition-all ${theme === 'dark' ? 'bg-black/20 border-white/5 text-white' : 'bg-white border-gray-200'}`}
                                    placeholder=".header-banner, .footer-links"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs text-gray-500 font-medium">{lang === 'ar' ? 'كود جافاسكريبت مخصص (لتجاوز وتحديث السلوك)' : 'Custom JavaScript Override (for future updates)'}</label>
                                  <textarea
                                    value={proj.custom_js || ''}
                                    onChange={e => {
                                      const newList = [...visualProjects];
                                      newList[idx].custom_js = e.target.value;
                                      setVisualProjects(newList);
                                    }}
                                    rows={4}
                                    className={`w-full text-sm border rounded-xl p-3 outline-none focus:border-blue-500 transition-all font-mono ${theme === 'dark' ? 'bg-black/20 border-white/5 text-white' : 'bg-white border-gray-200'}`}
                                    placeholder="e.g. document.querySelector('.auth-button-ms').click();"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3 animate-in fade-in duration-150">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-xs text-gray-500 font-medium">Android Package Name (Google Play)</label>
                                    <input
                                      required
                                      value={proj.android_package_name}
                                      onChange={e => {
                                        const newList = [...visualProjects];
                                        newList[idx].android_package_name = e.target.value;
                                        setVisualProjects(newList);
                                      }}
                                      className={`w-full text-sm border rounded-xl p-3 outline-none focus:border-blue-500 transition-all font-mono ${theme === 'dark' ? 'bg-black/20 border-white/5 text-white' : 'bg-white border-gray-200'}`}
                                      placeholder="e.g. com.github.shadowsocks"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs text-gray-500 font-medium">iOS URL Scheme (App Store)</label>
                                    <input
                                      value={proj.ios_url_scheme}
                                      onChange={e => {
                                        const newList = [...visualProjects];
                                        newList[idx].ios_url_scheme = e.target.value;
                                        setVisualProjects(newList);
                                      }}
                                      className={`w-full text-sm border rounded-xl p-3 outline-none focus:border-blue-500 transition-all font-mono ${theme === 'dark' ? 'bg-black/20 border-white/5 text-white' : 'bg-white border-gray-200'}`}
                                      placeholder="e.g. shadowsocks://"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs text-gray-500 font-medium">{lang === 'ar' ? 'رابط التنزيل المباشر (Google Play / App Store)' : 'Store Link / Fallback Download Link'}</label>
                                  <input
                                    value={proj.app_store_link}
                                    onChange={e => {
                                      const newList = [...visualProjects];
                                      newList[idx].app_store_link = e.target.value;
                                      setVisualProjects(newList);
                                    }}
                                    type="url"
                                    className={`w-full text-sm border rounded-xl p-3 outline-none focus:border-blue-500 transition-all ${theme === 'dark' ? 'bg-black/20 border-white/5 text-white' : 'bg-white border-gray-200'}`}
                                    placeholder="https://play.google.com/store/apps/details?id=..."
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {visualProjects.length === 0 && (
                        <div className="p-8 text-center text-gray-500 border border-dashed border-white/5 rounded-3xl">
                          {lang === 'ar' ? 'لا توجد أزرار مضافة بعد. اضغط على "إضافة زر جديد".' : 'No buttons added yet. Click "Add New Button".'}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
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
                )}
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

      {/* Send Notification Modal */}
      <AnimatePresence>
        {isNotificationModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNotificationModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-lg rounded-[2.5rem] border p-8 shadow-2xl ${theme === 'dark' ? 'bg-[#111] border-white/10' : 'bg-white border-gray-200'}`}
            >
              <h2 className={`text-2xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {editingNotification 
                  ? (lang === 'ar' ? 'تعديل الإشعار العام' : 'Edit Global Notification')
                  : t.addNotification}
              </h2>
              <form onSubmit={handleNotificationSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 ml-1">{t.notifTitle}</label>
                  <input 
                    required
                    value={notificationFormData.title}
                    onChange={e => setNotificationFormData({...notificationFormData, title: e.target.value})}
                    className={`w-full border rounded-2xl p-4 outline-none focus:border-blue-500 transition-all ${theme === 'dark' ? 'bg-white/5 border-white/5 text-white' : 'bg-gray-50 border-gray-100 text-gray-900'}`}
                    placeholder={lang === 'ar' ? 'أدخل عنوان الإشعار...' : 'Enter title...'}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 ml-1">{t.notifContent}</label>
                  <textarea 
                    required
                    rows={4}
                    value={notificationFormData.content}
                    onChange={e => setNotificationFormData({...notificationFormData, content: e.target.value})}
                    className={`w-full border rounded-2xl p-4 outline-none focus:border-blue-500 transition-all resize-none ${theme === 'dark' ? 'bg-white/5 border-white/5 text-white' : 'bg-gray-50 border-gray-100 text-gray-900'}`}
                    placeholder={lang === 'ar' ? 'اكتب محتوى الإشعار بالتفصيل هنا...' : 'Enter message content here...'}
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsNotificationModalOpen(false);
                      setEditingNotification(null);
                      setNotificationFormData({ title: '', content: '' });
                    }}
                    className={`flex-1 px-6 py-4 rounded-2xl font-bold transition-all ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                  >
                    {t.cancel}
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-4 bg-blue-600 rounded-2xl font-bold hover:bg-blue-500 transition-all text-white shadow-lg shadow-blue-600/20"
                  >
                    {editingNotification 
                      ? (lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes')
                      : t.send}
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

                {/* Microsoft Credentials Section */}
                <div className={`p-6 rounded-3xl border space-y-6 ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                  <h3 className="text-sm font-bold text-orange-500 flex items-center gap-2 uppercase tracking-widest">
                    <ShieldCheck className="w-4 h-4" /> {t.microsoftCreds}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block ml-1">
                        {t.microsoftEmail}
                      </label>
                      <input 
                        type="email"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        className={`w-full border rounded-xl p-3 outline-none focus:border-blue-500 transition-all ${theme === 'dark' ? 'bg-black/20 border-white/5 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                        placeholder="username@outlook.com / company.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block ml-1">
                        {t.microsoftPassword}
                      </label>
                      <input 
                        type="text"
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                        className={`w-full border rounded-xl p-3 outline-none focus:border-blue-500 transition-all ${theme === 'dark' ? 'bg-black/20 border-white/5 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                        placeholder="••••••••••••"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block ml-1">
                        {t.verificationCode}
                      </label>
                      <input 
                        type="text"
                        value={formData.verification_code}
                        onChange={e => setFormData({...formData, verification_code: e.target.value})}
                        className={`w-full border rounded-xl p-3 outline-none focus:border-blue-500 transition-all ${theme === 'dark' ? 'bg-black/20 border-white/5 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                        placeholder="e.g. 123 456"
                      />
                    </div>
                  </div>
                </div>

                {/* RentAHuman Integration Section */}
                <div className={`p-6 rounded-3xl border space-y-6 ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                  <h3 className="text-sm font-bold text-purple-500 flex items-center gap-2 uppercase tracking-widest">
                    <Bot className="w-4 h-4" /> {t.rahTitle}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block ml-1">
                        {t.rahHumanId}
                      </label>
                      <input 
                        type="text"
                        value={formData.rah_human_id}
                        onChange={e => setFormData({...formData, rah_human_id: e.target.value})}
                        className={`w-full border rounded-xl p-3 outline-none focus:border-blue-500 transition-all ${theme === 'dark' ? 'bg-black/20 border-white/5 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                        placeholder="e.g. secretboss001 or Pt4Z1msFXpnKAZvTtPbL"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block ml-1">
                        {t.rahApiKey}
                      </label>
                      <input 
                        type="text"
                        value={formData.rah_api_key}
                        onChange={e => setFormData({...formData, rah_api_key: e.target.value})}
                        className={`w-full border rounded-xl p-3 outline-none focus:border-blue-500 transition-all ${theme === 'dark' ? 'bg-black/20 border-white/5 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                        placeholder="rah_live_..."
                      />
                    </div>
                  </div>



                  <div className="border-t border-dashed border-white/10 pt-4 space-y-4">
                    <span className="text-xs font-bold text-emerald-400 block uppercase tracking-wider">
                      {lang === 'ar' ? 'حسابات الدفع والربح بالجنيه المصري (EGP Payout Accounting)' : 'EGP Payout Accounting & Exchange Rate'}
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-[11px] text-gray-400 font-bold uppercase tracking-wider block ml-1">
                          {lang === 'ar' ? 'لكل كم دولار ($)' : 'USD Payout Unit ($)'}
                        </label>
                        <input 
                          type="number"
                          step="any"
                          value={formData.rah_usd_payout_unit}
                          onChange={e => setFormData({...formData, rah_usd_payout_unit: e.target.value})}
                          className={`w-full border rounded-xl p-3 outline-none focus:border-blue-500 transition-all ${theme === 'dark' ? 'bg-black/20 border-white/5 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                          placeholder="e.g. 100 (Default)"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] text-gray-400 font-bold uppercase tracking-wider block ml-1">
                          {lang === 'ar' ? 'الجنيه المصري المقابل' : 'EGP Payout Value'}
                        </label>
                        <input 
                          type="number"
                          step="any"
                          value={formData.rah_egp_payout_unit}
                          onChange={e => setFormData({...formData, rah_egp_payout_unit: e.target.value})}
                          className={`w-full border rounded-xl p-3 outline-none focus:border-blue-500 transition-all ${theme === 'dark' ? 'bg-black/20 border-white/5 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                          placeholder="e.g. 1000 (Default)"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] text-gray-400 font-bold uppercase tracking-wider block ml-1">
                          {lang === 'ar' ? 'سعر صرف الدولار (EGP/$)' : 'USD to EGP Exchange Rate'}
                        </label>
                        <input 
                          type="number"
                          step="any"
                          value={formData.rah_exchange_rate}
                          onChange={e => setFormData({...formData, rah_exchange_rate: e.target.value})}
                          className={`w-full border rounded-xl p-3 outline-none focus:border-blue-500 transition-all ${theme === 'dark' ? 'bg-black/20 border-white/5 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                          placeholder="e.g. 48.5"
                        />
                      </div>
                    </div>
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
                        value={formData.proxy_ip}
                        onChange={e => setFormData({...formData, proxy_ip: e.target.value})}
                        className={`w-full border rounded-xl p-3 outline-none focus:border-blue-500 transition-all ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white border-gray-200'}`}
                        placeholder={t.ip}
                      />
                    </div>
                    <input 
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

      {/* Per-User Button Settings Modal */}
      <AnimatePresence>
        {isUserSettingsOpen && selectedUserForSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsUserSettingsOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-md rounded-[2.5rem] border p-8 shadow-2xl ${theme === 'dark' ? 'bg-[#111] border-white/10' : 'bg-white border-gray-200'}`}
            >
              {/* Header */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-purple-600/30">
                  {selectedUserForSettings.username?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedUserForSettings.username}</h2>
                  <p className="text-gray-500 text-sm">{lang === 'ar' ? 'إعدادات الأزرار الخاصة بالمستخدم' : 'Per-User Button Visibility'}</p>
                </div>
              </div>

              {/* Overlay Buttons Section */}
              <div className="space-y-4 mb-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">{lang === 'ar' ? 'أزرار النافذة العائمة' : 'Floating Overlay Buttons'}</h3>
                {([
                  { key: 'show_open_app' as const, label: lang === 'ar' ? 'زر فتح التطبيق' : 'Open App Button', color: '#1E3A8A' },
                  { key: 'show_misc' as const, label: lang === 'ar' ? 'زر المتنوعات' : 'Misc Button', color: '#6D28D9' }
                ]).map(({ key, label, color }) => {
                  const overlaySettings = selectedUserForSettings.ui_settings?.overlay || {};
                  const isOn = overlaySettings[key] !== false;
                  return (
                    <div key={key} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '30' }}>
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                        </div>
                        <span className="font-semibold text-sm">{label}</span>
                      </div>
                      <label className="flex items-center cursor-pointer relative">
                        <input type="checkbox" className="sr-only" checked={isOn} onChange={() => toggleUserOverlayBtn(key)} />
                        <div className={`block w-12 h-7 rounded-full transition-colors ${isOn ? 'bg-blue-500' : theme === 'dark' ? 'bg-white/10' : 'bg-gray-300'}`} />
                        <div className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full shadow transition-transform ${isOn ? 'translate-x-5' : 'translate-x-0'}`} />
                      </label>
                    </div>
                  );
                })}
              </div>

              {/* Projects Section */}
              {remoteConfigs.find((c: any) => c.config_key === 'projects') && (
                <div className="space-y-4 mb-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">{lang === 'ar' ? 'أزرار المشاريع' : 'Project Buttons'}</h3>
                  {(remoteConfigs.find((c: any) => c.config_key === 'projects')?.config_value || []).map((project: any) => {
                    const userProjects = selectedUserForSettings.ui_settings?.projects || {};
                    // default is the project's global is_visible (defaults to true)
                    const globalVisible = project.is_visible !== false;
                    const isOn = userProjects[project.id] !== undefined ? userProjects[project.id] !== false : globalVisible;
                    return (
                      <div key={project.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: project.color ? project.color.replace('0xFF', '#') : '#1E3A8A' }}>
                            {project.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <span className="font-semibold text-sm">{project.name}</span>
                        </div>
                        <label className="flex items-center cursor-pointer relative">
                          <input type="checkbox" className="sr-only" checked={isOn} onChange={() => toggleUserProjectVisibility(project.id)} />
                          <div className={`block w-12 h-7 rounded-full transition-colors ${isOn ? 'bg-blue-500' : theme === 'dark' ? 'bg-white/10' : 'bg-gray-300'}`} />
                          <div className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full shadow transition-transform ${isOn ? 'translate-x-5' : 'translate-x-0'}`} />
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                onClick={() => setIsUserSettingsOpen(false)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all"
              >
                {lang === 'ar' ? 'حفظ وإغلاق' : 'Done'}
              </button>
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

      {/* Custom Block Confirmation Modal */}
      <AnimatePresence>
        {isBlockConfirmOpen && blockTargetUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBlockConfirmOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`relative w-full max-w-sm rounded-[2rem] border p-8 shadow-2xl text-center ${theme === 'dark' ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-gray-200'}`}
            >
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${blockTargetUser.is_blocked ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                {blockTargetUser.is_blocked ? <ShieldCheck className="w-8 h-8" /> : <Ban className="w-8 h-8" />}
              </div>
              <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {blockTargetUser.is_blocked 
                  ? (lang === 'ar' ? 'إلغاء حظر المستخدم' : 'Unblock User') 
                  : (lang === 'ar' ? 'حظر المستخدم' : 'Block User')}
              </h3>
              <p className="text-gray-500 text-sm mb-8">
                {blockTargetUser.is_blocked 
                  ? (lang === 'ar' ? `هل تريد حقاً إلغاء حظر ${blockTargetUser.username}؟` : `Are you sure you want to unblock ${blockTargetUser.username}?`)
                  : (lang === 'ar' ? `هل تريد حقاً حظر ${blockTargetUser.username}؟ سيتم تسجيل خروجه وطرده من هاتفه فوراً.` : `Are you sure you want to block ${blockTargetUser.username}? They will be logged out of their phone instantly.`)}
              </p>
              
              <div className="flex flex-col gap-2">
                <button 
                  onClick={confirmBlock}
                  className={`w-full py-3 text-white rounded-xl font-bold transition-all ${blockTargetUser.is_blocked ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'}`}
                >
                  {blockTargetUser.is_blocked 
                    ? (lang === 'ar' ? 'إلغاء الحظر' : 'Unblock') 
                    : (lang === 'ar' ? 'نعم، احظر' : 'Block')}
                </button>
                <button 
                  onClick={() => setIsBlockConfirmOpen(false)}
                  className={`w-full py-3 rounded-xl font-bold transition-all ${theme === 'dark' ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {t.confirmCancel}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Misc Modal */}
      {isMiscModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`w-full max-w-lg rounded-[2rem] p-8 shadow-2xl border ${theme === 'dark' ? 'bg-[#111] border-white/10' : 'bg-white border-gray-200'}`}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-purple-600/20 text-purple-500 rounded-xl flex items-center justify-center">
                {editingMisc ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              </div>
              <h2 className="text-2xl font-bold">{editingMisc ? (lang === 'ar' ? 'تعديل العنصر' : 'Edit Misc Item') : t.addMisc}</h2>
            </div>

            <form onSubmit={handleMiscSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">{lang === 'ar' ? 'العنوان' : 'Title'}</label>
                <input
                  required
                  type="text"
                  value={miscFormData.title}
                  onChange={(e) => setMiscFormData({...miscFormData, title: e.target.value})}
                  className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-purple-500 outline-none transition-all ${theme === 'dark' ? 'bg-black/50 border-white/10 focus:border-purple-500/50' : 'bg-gray-50 border-gray-200 focus:border-purple-500'}`}
                  placeholder={lang === 'ar' ? 'مثال: رقم الحساب البنكي' : 'e.g., Bank Account'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">{lang === 'ar' ? 'المحتوى (الذي سيتم نسخه)' : 'Content (to be copied)'}</label>
                <textarea
                  required
                  rows={4}
                  value={miscFormData.content}
                  onChange={(e) => setMiscFormData({...miscFormData, content: e.target.value})}
                  className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-purple-500 outline-none transition-all resize-none ${theme === 'dark' ? 'bg-black/50 border-white/10 focus:border-purple-500/50' : 'bg-gray-50 border-gray-200 focus:border-purple-500'}`}
                  placeholder={lang === 'ar' ? 'أدخل النص هنا...' : 'Enter text here...'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">{lang === 'ar' ? 'ترتيب العرض (0 هو الأول)' : 'Display Order (0 is first)'}</label>
                <input
                  type="number"
                  value={miscFormData.display_order}
                  onChange={(e) => setMiscFormData({...miscFormData, display_order: parseInt(e.target.value) || 0})}
                  className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-purple-500 outline-none transition-all ${theme === 'dark' ? 'bg-black/50 border-white/10 focus:border-purple-500/50' : 'bg-gray-50 border-gray-200 focus:border-purple-500'}`}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsMiscModalOpen(false)}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold shadow-lg shadow-purple-600/20 transition-all"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}

// ─── Dashboard Live Header Clock Component ───────────
function DashboardLiveClock({ lang, theme }: { lang: string; theme: string }) {
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      try {
        setTimeStr(now.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }));
        setDateStr(now.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric'
        }));
      } catch {
        setTimeStr('');
        setDateStr('');
      }
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, [lang]);

  if (!timeStr) return null;

  return (
    <div className={`hidden sm:flex items-center gap-2.5 px-4 py-2 rounded-2xl border text-xs font-semibold shadow-sm transition-all ${
      theme === 'dark' 
        ? 'bg-white/[0.02] border-white/5 text-gray-300' 
        : 'bg-white border-gray-200 text-gray-700'
    }`}>
      <div className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </div>
      <div className="flex items-center gap-1.5 font-mono">
        <span className="text-gray-400 font-sans">{dateStr}</span>
        <span className="text-gray-500">•</span>
        <span className="text-blue-400 font-bold">{timeStr}</span>
      </div>
    </div>
  );
}

// ─── Isolated clock component — renders independently every second ───────────
function UserTimezoneDisplay({ timezone, small = false }: { timezone: string; small?: boolean }) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => {
      try {
        setTime(new Intl.DateTimeFormat('en-US', {
          timeZone: timezone.trim(),
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }).format(new Date()));
      } catch { setTime(''); }
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, [timezone]);

  if (!time) return null;

  if (small) {
    return (
      <div className="flex items-center gap-1 bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full w-max font-mono text-[10px] border border-blue-500/10">
        <Clock className="w-2.5 h-2.5" />
        <span>{time}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 bg-blue-500/10 text-blue-400 px-3 py-1 rounded-xl w-max font-mono text-xs border border-blue-500/10">
      <Clock className="w-3.5 h-3.5" />
      <span>{time}</span>
    </div>
  );
}

// ─── RentAHuman Integration Display Component ──────────────────────────────

interface RentAHumanProfile {
  id: string;
  name: string;
  headline?: string;
  hourlyRate?: number;
  currency?: string;
  rating?: number;
  reviewCount?: number;
  totalBookings?: number;
  isAvailable?: boolean;
  isVerified?: boolean;
  avatarUrl?: string;
  activeRentalsCount?: number;
  rentalsSummary?: {
    active: number;
    completed: number;
    cancelled: number;
  } | null;
  totalDeposited?: number;
  walletBalance?: number;
  currentlyDue?: number;
  transactions?: Array<{
    id: string;
    type: string;
    amount: number;
    balanceAfter: number;
    description: string;
    createdAt: string;
  }>;
}

function RentAHumanDisplay({ user, theme, lang, isMobile = false }: { user: any; theme: string; lang: 'en' | 'ar'; isMobile?: boolean }) {
  const [profile, setProfile] = useState<RentAHumanProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user.rah_human_id) {
      if (user.rah_api_key && user.rah_balance !== undefined && user.rah_balance !== null) {
        // Construct synthetic profile from Supabase fields synced by the mobile client!
        setProfile({
          id: user.id || 'synthetic-id',
          name: user.username || 'Worker',
          hourlyRate: user.ui_settings?.rah?.rate_override || 10,
          currentlyDue: (user.ui_settings?.rah?.earnings_offset || (user.email === 'flash75711@gmail.com' ? 51.33 : 0) || user.rah_balance || 0) * 100, // fall back to earnings_offset so pending amounts display automatically!
          transactions: (user.rah_earnings || []).map((tx: any) => ({
            id: tx.id || '',
            amount: tx.amount, // already in cents in the database!
            type: tx.type || (tx.direction === 'received' ? 'figure_ongoing_payout' : 'transfer'),
            description: tx.description || '',
            createdAt: tx.created_at || tx.timestamp || '',
            balanceAfter: tx.balance_after || tx.balanceAfter || 0
          })),
          totalBookings: 0,
          rating: 5,
          reviewCount: 0,
          currency: 'USD',
          totalDeposited: 0
        });
        setError(null);
      } else {
        setProfile(null);
        setError(null);
      }
      return;
    }

    let isMounted = true;
    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/rentahuman?humanId=${encodeURIComponent(user.rah_human_id)}&apiKey=${encodeURIComponent(user.rah_api_key || '')}`);
        if (!res.ok) {
          throw new Error('Not Found');
        }
        const data = await res.json();
        if (isMounted) {
          if (data.success && data.human) {
            setProfile(data.human);
          } else {
            throw new Error('Invalid response');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'API Error');
          setProfile(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [user.rah_human_id, user.rah_api_key, user.rah_balance, user.rah_earnings]);

  if (!user.rah_human_id && !user.rah_api_key) {
    return (
      <div className={`text-xs py-2 px-3 rounded-2xl border border-dashed flex items-center justify-center gap-1.5 font-medium ${
        theme === 'dark' ? 'border-white/10 text-gray-500 bg-white/[0.01]' : 'border-gray-200 text-gray-400 bg-gray-50/50'
      }`}>
        <Sparkles className="w-3.5 h-3.5 opacity-60" />
        <span>{lang === 'ar' ? 'غير متصل بـ RentAHuman' : 'Not Connected'}</span>
      </div>
    );
  }

  if (!user.rah_human_id && user.rah_api_key && (user.rah_balance === undefined || user.rah_balance === null)) {
    return (
      <div className={`text-xs py-2 px-3 rounded-2xl border border-dashed flex items-center justify-center gap-1.5 font-medium ${
        theme === 'dark' ? 'border-purple-500/20 text-purple-400 bg-purple-500/[0.01]' : 'border-purple-200 text-purple-600 bg-purple-50/50'
      }`}>
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-500" />
        <span>{lang === 'ar' ? 'بانتظار المزامنة الأولى من الهاتف...' : 'Awaiting first mobile sync...'}</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 py-1 font-medium">
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
        <span>{lang === 'ar' ? 'جاري التحميل...' : 'Loading metrics...'}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 py-1.5 px-3 rounded-2xl w-max font-medium">
        <Ban className="w-3.5 h-3.5" />
        <span>{lang === 'ar' ? 'خطأ في الربط' : 'API Connection Error'}</span>
      </div>
    );
  }

  if (!profile) return null;

  const bookings = profile.totalBookings || 0;
  const rating = profile.rating || 0;
  const reviews = profile.reviewCount || 0;
  const currency = profile.currency || 'USD';
  
  // ─── Fintech Metrics Calculations from Wallet Transaction History ───
  // 1. Determine hourly rate (Manager override or RentAHuman profile rate, fallback to $10/hr)
  const customRate = Number(user.ui_settings?.rah?.rate_override || profile.hourlyRate || 10);
  
  // 2. Fetch transactions and aggregate bounty earnings
  const transactions = profile.transactions || [];
  let paidEarnings = 0;
  if (transactions.length > 0) {
    paidEarnings = transactions
      .filter((tx: any) => 
        tx.type === 'figure_ongoing_payout' || 
        tx.type === 'admin_credit' || 
        tx.description?.toLowerCase().includes('payout') || 
        tx.description?.toLowerCase().includes('bonus') ||
        tx.description?.toLowerCase().includes('ongoing_')
      )
      .reduce((sum: number, tx: any) => sum + Math.abs(tx.amount), 0) / 100;
  } else {
    // Safety fallback to lifetime deposited
    paidEarnings = (profile.totalDeposited || 0) / 100;
  }

  // 3. Calculate automated paid hours
  const paidHours = customRate > 0 ? Number((paidEarnings / customRate).toFixed(1)) : 0;

  // 4. Load manual offset adjustments (for unpaid/pending program work)
  const hoursOffset = Number(user.ui_settings?.rah?.hours_offset || (user.email === 'flash75711@gmail.com' ? 4.7 : 0));
  const earningsOffset = Number(user.ui_settings?.rah?.earnings_offset || (user.email === 'flash75711@gmail.com' ? 51.33 : 0));

  // 5. Final aggregate figures (exact summation)
  const totalEarnings = paidEarnings + earningsOffset;
  const totalHours = Number((paidHours + hoursOffset).toFixed(1));

  // 6. EGP Worker Payout and Net Profit calculations
  const exchangeRate = Number(user.ui_settings?.rah?.exchange_rate || 48.5); // Fallback to current EGP exchange rate if not overridden
  const usdPayoutUnit = Number(user.ui_settings?.rah?.usd_payout_unit || 100);
  const egpPayoutUnit = Number(user.ui_settings?.rah?.egp_payout_unit || 1000);

  const platformRevenueEGP = totalEarnings * exchangeRate;
  const workerPayoutEGP = usdPayoutUnit > 0 ? totalEarnings * (egpPayoutUnit / usdPayoutUnit) : 0;
  const netProfitEGP = platformRevenueEGP - workerPayoutEGP;
  const profitMarginPct = platformRevenueEGP > 0 ? (netProfitEGP / platformRevenueEGP) * 100 : 0;


  const badgeClass = theme === 'dark' 
    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20' 
    : 'bg-purple-50 text-purple-600 border border-purple-100 hover:bg-purple-100/50';

  const formatTxDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const handleOpenDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDetailsOpen(true);
  };

  if (isMobile) {
    return (
      <div 
        onClick={handleOpenDetails}
        className={`p-4 rounded-2xl border space-y-3 cursor-pointer transition-all hover:scale-[1.01] ${
          theme === 'dark' ? 'bg-purple-500/[0.02] border-purple-500/10 hover:border-purple-500/30' : 'bg-purple-50/20 border-purple-100/50 hover:border-purple-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-purple-500" />
            <span className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>
              RentAHuman Profile
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {profile.activeRentalsCount && profile.activeRentalsCount > 0 ? (
              <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {lang === 'ar' ? 'يعمل حالياً' : 'Active Now'} ({profile.activeRentalsCount})
              </span>
            ) : (
              <span className="flex items-center gap-1 bg-gray-500/10 text-gray-400 border border-gray-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                {lang === 'ar' ? 'متصل' : 'Connected'}
              </span>
            )}
            {profile.isVerified && (
              <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                <ShieldCheck className="w-3.5 h-3.5" /> VERIFIED
              </span>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className={`p-2.5 rounded-xl border ${theme === 'dark' ? 'bg-black/25 border-white/5' : 'bg-white border-gray-100'}`}>
            <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">
              {lang === 'ar' ? 'ساعات العمل' : 'Total Hours'}
            </span>
            <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {totalHours} hrs
            </span>
          </div>
          
          <div className={`p-2.5 rounded-xl border ${theme === 'dark' ? 'bg-black/25 border-white/5' : 'bg-white border-gray-100'}`}>
            <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">
              {lang === 'ar' ? 'إجمالي الأرباح' : 'Total Earnings'}
            </span>
            <span className={`font-bold text-purple-400`}>
              ${totalEarnings.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Details Dialog / Portal Rendering inside component */}
        {mounted && typeof window !== 'undefined' && createPortal(
          <AnimatePresence>
            {detailsOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={(e) => { e.stopPropagation(); setDetailsOpen(false); }}
                className="absolute inset-0 bg-black/75 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className={`relative w-full max-w-lg rounded-[2.5rem] border p-6 md:p-8 shadow-2xl overflow-y-auto max-h-[90vh] ${
                  theme === 'dark' ? 'bg-[#111] border-white/10' : 'bg-white border-gray-200'
                }`}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/20 flex items-center justify-center font-bold text-xl">
                      {profile.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{profile.name}</h3>
                      <p className="text-xs text-gray-500 font-medium">RentAHuman integration stats</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setDetailsOpen(false)}
                    className={`p-2 rounded-xl text-xs font-bold transition-all ${
                      theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    ✕
                  </button>
                </div>

                {/* Fintech Performance Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className={`p-4 rounded-3xl border ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">{lang === 'ar' ? 'إجمالي الساعات' : 'Total Hours'}</span>
                      <TrendingUp className="w-4 h-4 text-purple-500" />
                    </div>
                    <div className="text-2xl font-black mb-1">{totalHours} hrs</div>
                    <div className="text-[10px] text-gray-500 font-medium">
                      {paidHours}h paid + {hoursOffset}h pending
                    </div>
                  </div>

                  <div className={`p-4 rounded-3xl border ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">{lang === 'ar' ? 'إجمالي الأرباح' : 'Total Earnings'}</span>
                      <DollarSign className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-black mb-1 text-emerald-400">${totalEarnings.toFixed(2)}</div>
                    <div className="text-[10px] text-gray-500 font-medium">
                      ${paidEarnings.toFixed(2)} paid + ${earningsOffset.toFixed(2)} pending
                    </div>
                  </div>

                  <div className={`p-4 rounded-3xl border ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">{lang === 'ar' ? 'المستحق حالياً' : 'Currently Due'}</span>
                      <Clock className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-black mb-1 text-amber-400">${((profile.currentlyDue || 0) / 100).toFixed(2)}</div>
                    <div className="text-[10px] text-gray-500 font-medium">
                      {lang === 'ar' ? 'بانتظار الإفراج من الضمان' : 'Awaiting escrow release'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mb-6">
                  <div className={`p-3 rounded-2xl border text-xs ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white border-gray-100'}`}>
                    <span className="text-gray-400 block text-[9px] uppercase font-bold mb-0.5">{lang === 'ar' ? 'أجر الساعة' : 'Rate'}</span>
                    <span className="font-bold">${customRate}/hr</span>
                  </div>
                  <div className={`p-3 rounded-2xl border text-xs ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white border-gray-100'}`}>
                    <span className="text-gray-400 block text-[9px] uppercase font-bold mb-0.5">{lang === 'ar' ? 'الحجوزات' : 'Bookings'}</span>
                    <span className="font-bold">{bookings}</span>
                  </div>
                  <div className={`p-3 rounded-2xl border text-xs ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white border-gray-100'}`}>
                    <span className="text-gray-400 block text-[9px] uppercase font-bold mb-0.5">{lang === 'ar' ? 'التقييم' : 'Rating'}</span>
                    <span className="font-bold flex justify-center items-center gap-0.5">★ {rating.toFixed(1)}</span>
                  </div>
                </div>

                {/* Financial Ledger Section */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">
                    {lang === 'ar' ? 'دفتر المعاملات المالية (المحفظة)' : 'Financial Transaction Ledger'}
                  </h4>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {transactions.map((tx: any) => {
                      const isCredit = tx.amount > 0;
                      return (
                        <div key={tx.id} className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                          theme === 'dark' ? 'bg-white/[0.01] border-white/5 hover:bg-white/[0.03]' : 'bg-gray-50 border-gray-100 hover:bg-gray-100/50'
                        } transition-all`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              isCredit ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                            }`}>
                              {isCredit ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0">
                              <p className={`text-xs font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{tx.description}</p>
                              <span className="text-[9px] text-gray-500 font-medium block mt-0.5">{formatTxDate(tx.createdAt)}</span>
                            </div>
                          </div>
                          <span className={`text-xs font-black shrink-0 ${isCredit ? 'text-green-400' : 'text-red-400'}`}>
                            {isCredit ? '+' : '-'}${Math.abs(tx.amount / 100).toFixed(2)}
                          </span>
                        </div>
                      );
                    })}

                    {transactions.length === 0 && (
                      <div className="py-8 text-center text-xs text-gray-500 border border-dashed border-white/5 rounded-2xl">
                        No transactions registered yet.
                      </div>
                    )}
                  </div>
                </div>

              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 px-1 min-w-[130px]">
      <div className="flex items-center gap-1.5">
        <button 
          onClick={handleOpenDetails}
          className={`flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold border transition-all ${badgeClass}`}
          title="Click to view detailed metrics & financial ledger"
        >
          <Bot className="w-3.5 h-3.5 shrink-0 text-purple-400" />
          <span>{totalHours} hrs</span>
        </button>
        {profile.isVerified && (
          <span className="p-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md shrink-0" title="Verified Human">
            <ShieldCheck className="w-3 h-3" />
          </span>
        )}
        {profile.activeRentalsCount && profile.activeRentalsCount > 0 ? (
          <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-md text-[9px] font-bold animate-pulse shrink-0" title={`${profile.activeRentalsCount} active rental(s)`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {lang === 'ar' ? 'نشط' : 'Active'}
          </span>
        ) : (
          <span className="flex items-center gap-1 bg-gray-500/10 text-gray-400 border border-gray-500/20 px-1.5 py-0.5 rounded-md text-[9px] font-bold shrink-0" title="Connected">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            {lang === 'ar' ? 'متصل' : 'Connected'}
          </span>
        )}
      </div>
      
      <div className="text-[10px] text-gray-400 flex flex-col gap-0.5 font-medium ml-1">
        <span className="flex items-center gap-1">
          💼 {bookings} bookings • <span className="text-purple-400 font-bold">${totalEarnings.toFixed(1)}</span>
        </span>
        {rating > 0 && (
          <span className="flex items-center gap-1 text-amber-400 font-bold">
            ★ {rating.toFixed(1)} <span className="text-gray-500 font-normal">({reviews})</span>
          </span>
        )}
        {totalEarnings > 0 && (
          <div className="flex flex-col border-t border-white/5 mt-1 pt-1 space-y-0.5">
            <span className="text-emerald-400 font-semibold flex items-center gap-1" title={lang === 'ar' ? `مستحقات المستخدم: ${egpPayoutUnit} جنيه لكل ${usdPayoutUnit} دولار` : `EGP Payout: ${egpPayoutUnit} EGP per ${usdPayoutUnit} USD`}>
              🇪🇬 {workerPayoutEGP.toLocaleString(undefined, {maximumFractionDigits:0})} EGP Pay
            </span>
            <span className={`text-[9px] font-bold ${netProfitEGP >= 0 ? 'text-blue-400' : 'text-red-400'}`} title={`Net Profit: Platform EGP (${platformRevenueEGP.toFixed(0)}) - Worker Payout EGP (${workerPayoutEGP.toFixed(0)})`}>
              Profit: {netProfitEGP.toLocaleString(undefined, {maximumFractionDigits:0})} EGP ({profitMarginPct.toFixed(0)}%)
            </span>
          </div>
        )}
      </div>

      {/* Details Dialog / Portal Rendering inside desktop view */}
      {mounted && typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {detailsOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(e) => { e.stopPropagation(); setDetailsOpen(false); }}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={`relative w-full max-w-lg rounded-[2.5rem] border p-6 md:p-8 shadow-2xl overflow-y-auto max-h-[90vh] ${
                theme === 'dark' ? 'bg-[#111] border-white/10' : 'bg-white border-gray-200'
              }`}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/20 flex items-center justify-center font-bold text-xl">
                    {profile.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{profile.name}</h3>
                    <p className="text-xs text-gray-500 font-medium">RentAHuman Integration Performance</p>
                  </div>
                </div>
                <button 
                  onClick={() => setDetailsOpen(false)}
                  className={`p-2 rounded-xl text-xs font-bold transition-all ${
                    theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  ✕
                </button>
              </div>

              {/* Fintech Performance Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className={`p-4 rounded-3xl border ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">{lang === 'ar' ? 'إجمالي الساعات' : 'Total Hours'}</span>
                    <TrendingUp className="w-4 h-4 text-purple-500" />
                  </div>
                  <div className="text-2xl font-black mb-1">{totalHours} hrs</div>
                  <div className="text-[10px] text-gray-500 font-medium">
                    {paidHours}h paid + {hoursOffset}h pending
                  </div>
                </div>

                <div className={`p-4 rounded-3xl border ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">{lang === 'ar' ? 'إجمالي الأرباح' : 'Total Earnings'}</span>
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-black mb-1 text-emerald-400">${totalEarnings.toFixed(2)}</div>
                  <div className="text-[10px] text-gray-500 font-medium">
                    ${paidEarnings.toFixed(2)} paid + ${earningsOffset.toFixed(2)} pending
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center mb-6">
                <div className={`p-3 rounded-2xl border text-xs ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white border-gray-100'}`}>
                  <span className="text-gray-400 block text-[9px] uppercase font-bold mb-0.5">{lang === 'ar' ? 'أجر الساعة' : 'Rate'}</span>
                  <span className="font-bold">${customRate}/hr</span>
                </div>
                <div className={`p-3 rounded-2xl border text-xs ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white border-gray-100'}`}>
                  <span className="text-gray-400 block text-[9px] uppercase font-bold mb-0.5">{lang === 'ar' ? 'الحجوزات' : 'Bookings'}</span>
                  <span className="font-bold">{bookings}</span>
                </div>
                <div className={`p-3 rounded-2xl border text-xs ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white border-gray-100'}`}>
                  <span className="text-gray-400 block text-[9px] uppercase font-bold mb-0.5">{lang === 'ar' ? 'التقييم' : 'Rating'}</span>
                  <span className="font-bold flex justify-center items-center gap-0.5 font-sans">★ {rating.toFixed(1)}</span>
                </div>
              </div>

              {/* EGP Accounting & Net Profit Calculator */}
              {totalEarnings > 0 && (
                <div className={`p-5 rounded-3xl border mb-6 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 ${theme === 'dark' ? 'border-emerald-500/20' : 'border-emerald-200'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-emerald-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                      🇪🇬 {lang === 'ar' ? 'حسابات الدفع بالجنيه المصري والربح الصافي' : 'EGP Payout & Net Profit'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Exchange: {exchangeRate} EGP/$
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 block font-medium">{lang === 'ar' ? 'مستحقات العامل بالجنيه' : 'Worker Share (EGP)'}</span>
                      <div className="text-xl font-bold text-white">
                        {workerPayoutEGP.toLocaleString(undefined, {maximumFractionDigits:0})} EGP
                      </div>
                      <span className="text-[9px] text-gray-500 block">
                        {lang === 'ar' ? `${egpPayoutUnit} جنيه لكل ${usdPayoutUnit} دولار من إجمالي الأرباح` : `${egpPayoutUnit} EGP per ${usdPayoutUnit} USD of total earnings`}
                      </span>
                    </div>
                    
                    <div className="space-y-1 text-right">
                      <span className="text-[10px] text-gray-400 block font-medium">{lang === 'ar' ? 'ربحك الصافي بالجنيه' : 'Manager Net Profit (EGP)'}</span>
                      <div className={`text-xl font-black ${netProfitEGP >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {netProfitEGP >= 0 ? '+' : ''}{netProfitEGP.toLocaleString(undefined, {maximumFractionDigits:0})} EGP
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded inline-block ${netProfitEGP >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        Margin: {profitMarginPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-dashed border-white/10 flex justify-between text-[10px] text-gray-500 font-medium">
                    <span>{lang === 'ar' ? 'إيراد المنصة بالدولار:' : 'Platform Revenue:'} <strong className="text-gray-300">${totalEarnings.toFixed(2)}</strong></span>
                    <span>{lang === 'ar' ? 'بالجنيه المصري:' : 'EGP Equivalent:'} <strong className="text-gray-300">{platformRevenueEGP.toLocaleString(undefined, {maximumFractionDigits:0})} EGP</strong></span>
                  </div>
                </div>
              )}

              {/* Financial Ledger Section */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">
                  {lang === 'ar' ? 'دفتر المعاملات المالية (المحفظة)' : 'Financial Transaction Ledger'}
                </h4>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {transactions.map((tx: any) => {
                    const isCredit = tx.amount > 0;
                    return (
                      <div key={tx.id} className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                        theme === 'dark' ? 'bg-white/[0.01] border-white/5 hover:bg-white/[0.03]' : 'bg-gray-50 border-gray-100 hover:bg-gray-100/50'
                      } transition-all`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isCredit ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {isCredit ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-xs font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{tx.description}</p>
                            <span className="text-[9px] text-gray-500 font-medium block mt-0.5">{formatTxDate(tx.createdAt)}</span>
                          </div>
                        </div>
                        <span className={`text-xs font-black shrink-0 ${isCredit ? 'text-green-400' : 'text-red-400'}`}>
                          {isCredit ? '+' : '-'}${Math.abs(tx.amount / 100).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}

                  {transactions.length === 0 && (
                    <div className="py-8 text-center text-xs text-gray-500 border border-dashed border-white/5 rounded-2xl">
                      No transactions registered yet.
                    </div>
                  )}
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    )}
    </div>
  );
}

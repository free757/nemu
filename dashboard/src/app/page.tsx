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
  CheckCircle,
  Bell,
  Clock,
  Layers,
  SlidersHorizontal,
  Sparkles,
  DollarSign,
  TrendingUp,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Coins,
  Save,
  Check,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Dashboard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
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
  const [isForceLogoutConfirmOpen, setIsForceLogoutConfirmOpen] = useState(false);
  const [forceLogoutTargetUser, setForceLogoutTargetUser] = useState<any>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Record<string, boolean>>({});
  const [editingUser, setEditingUser] = useState<any>(null);
  
  // Financial & Accounts States
  const [financialTransactions, setFinancialTransactions] = useState<any[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(50.0);
  const [manualExchangeRate, setManualExchangeRate] = useState<string>('');
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutTargetUser, setPayoutTargetUser] = useState<any>(null);
  const [payoutFormData, setPayoutFormData] = useState({ amountEgp: '', transferMobile: '', description: '' });
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txFormData, setTxFormData] = useState({ amountUsd: '', amountEgp: '', type: 'deposit', description: '' });
  const [editedDues, setEditedDues] = useState<Record<string, string>>({});
  const [expandedPayouts, setExpandedPayouts] = useState<Record<string, boolean>>({});
  const [isWalletLedgerExpanded, setIsWalletLedgerExpanded] = useState(false);
  const [editingConfig, setEditingConfig] = useState<any>(null);
  const [visualProjects, setVisualProjects] = useState<any[]>([]);
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    setMounted(true);
    fetchExchangeRate();
    fetchTransactions();
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
    rah_egp_payout_unit: '',
    owner_id: '',
    payoneer_email: '',
    payout_status: 'waiting'
  });

  const [quickPaste, setQuickPaste] = useState('');
  const [pinError, setPinError] = useState('');
  const [emailError, setEmailError] = useState('');

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
    if (!error) {
      setUsers(data);
      // Clean up selectedUserIds to remove any users that are no longer in the list
      setSelectedUserIds(prev => {
        if (!data) return {};
        const activeIds = new Set(data.map(u => u.id));
        const clean: Record<string, boolean> = {};
        for (const id in prev) {
          if (activeIds.has(id) && prev[id]) {
            clean[id] = true;
          }
        }
        return clean;
      });
    }
    setLoading(false);
  };

  const fetchTransactions = async () => {
    const { data, error } = await supabase
      .from('financial_transactions')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setFinancialTransactions(data);
    }
  };

  const fetchExchangeRate = async () => {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      const data = await res.json();
      if (data && data.rates && data.rates.EGP) {
        setExchangeRate(data.rates.EGP);
      }
    } catch (e) {
      console.error('Failed to fetch exchange rate:', e);
    }
  };

  const handleSaveDue = async (accountId: string, val: string) => {
    const numVal = parseFloat(val) || 0;
    const { error } = await supabase
      .from('app_users')
      .update({ rah_currently_due: numVal })
      .eq('id', accountId);
    if (!error) {
      showToast(lang === 'ar' ? 'تم حفظ القيمة بنجاح' : 'Due next payout updated successfully', 'success');
      fetchUsers();
    } else {
      alert(error.message);
    }
  };

  const handleUpdatePayoutStatus = async (accountId: string, status: string) => {
    const { error } = await supabase
      .from('app_users')
      .update({ payout_status: status })
      .eq('id', accountId);
    if (!error) {
      showToast(lang === 'ar' ? 'تم تحديث حالة الدفع بنجاح' : 'Payout status updated successfully', 'success');
      fetchUsers();
    } else {
      alert(error.message);
    }
  };

  const handleCreateTransaction = async (payload: {
    amount_usd?: number;
    amount_egp?: number;
    type: 'deposit' | 'payout' | 'expense' | 'profit_withdraw';
    target_user_id?: string;
    transfer_mobile?: string;
    description?: string;
  }) => {
    const { error } = await supabase
      .from('financial_transactions')
      .insert([payload]);
    if (!error) {
      showToast(lang === 'ar' ? 'تم تسجيل المعاملة بنجاح' : 'Transaction created successfully', 'success');
      fetchTransactions();
      fetchUsers();
    } else {
      alert(error.message);
    }
  };

  const getOwnerHexColor = (ownerId: string) => {
    if (!ownerId) return 'transparent';
    const colors = [
      '#a855f7', // purple
      '#14b8a6', // teal
      '#ec4899', // pink
      '#6366f1', // indigo
      '#f43f5e', // rose
      '#06b6d4', // cyan
      '#f59e0b', // amber
      '#10b981'  // emerald
    ];
    let hash = 0;
    for (let i = 0; i < ownerId.length; i++) {
      hash = ownerId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const getOwnerClasses = (ownerId: string) => {
    if (!ownerId) return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    const colorMap = [
      'bg-purple-500/10 text-purple-400 border-purple-500/20',
      'bg-teal-500/10 text-teal-400 border-teal-500/20',
      'bg-pink-500/10 text-pink-400 border-pink-500/20',
      'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      'bg-rose-500/10 text-rose-400 border-rose-500/20',
      'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      'bg-amber-500/10 text-amber-400 border-amber-500/20',
      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    ];
    let hash = 0;
    for (let i = 0; i < ownerId.length; i++) {
      hash = ownerId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colorMap.length;
    return colorMap[index];
  };

  const handlePayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutTargetUser) return;
    const amountEgp = parseFloat(payoutFormData.amountEgp) || 0;
    const rate = parseFloat(manualExchangeRate) || exchangeRate || 50.0;
    const amountUsd = amountEgp / rate;

    const payload = {
      amount_usd: amountUsd,
      amount_egp: amountEgp,
      type: 'payout' as const,
      target_user_id: payoutTargetUser.id,
      transfer_mobile: payoutFormData.transferMobile || undefined,
      description: payoutFormData.description || `Salary payout for ${payoutTargetUser.username}`,
    };

    await handleCreateTransaction(payload);

    // Reset linked accounts dues to 0
    const { error } = await supabase
      .from('app_users')
      .update({ rah_currently_due: 0 })
      .eq('owner_id', payoutTargetUser.id);
    
    if (!error) {
      showToast(lang === 'ar' ? 'تم تصفير مستحقات الحسابات بنجاح' : 'Linked accounts dues reset to 0', 'success');
      fetchUsers();
    } else {
      console.error('Error resetting dues:', error);
    }

    setIsPayoutModalOpen(false);
    setPayoutFormData({ amountEgp: '', transferMobile: '', description: '' });
    setPayoutTargetUser(null);
  };

  const handleTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountUsd = parseFloat(txFormData.amountUsd) || 0;
    const amountEgp = parseFloat(txFormData.amountEgp) || 0;
    const rate = parseFloat(manualExchangeRate) || exchangeRate || 50.0;

    const payload = {
      amount_usd: amountUsd || (amountEgp ? amountEgp / rate : 0),
      amount_egp: amountEgp || (amountUsd ? amountUsd * rate : 0),
      type: txFormData.type as 'deposit' | 'expense' | 'profit_withdraw',
      description: txFormData.description || '',
    };

    await handleCreateTransaction(payload);
    setIsTxModalOpen(false);
    setTxFormData({ amountUsd: '', amountEgp: '', type: 'deposit', description: '' });
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذه المعاملة؟ هذا الإجراء لا يمكن التراجع عنه.' : 'Are you sure you want to delete this transaction? This action cannot be undone.')) {
      return;
    }
    const { error } = await supabase
      .from('financial_transactions')
      .delete()
      .eq('id', id);
    if (!error) {
      showToast(lang === 'ar' ? 'تم حذف المعاملة بنجاح' : 'Transaction deleted successfully', 'success');
      fetchTransactions();
      fetchUsers();
    } else {
      alert(error.message);
    }
  };

  const renderAccountsTab = () => {
    const currentRate = parseFloat(manualExchangeRate) || exchangeRate || 50.0;

    // Calculate totals
    let totalDepositsUsd = 0;
    let totalExpensesUsd = 0;
    let totalPayoutsUsd = 0;
    let totalDistributionsUsd = 0;

    financialTransactions.forEach(tx => {
      const usdAmount = Number(tx.amount_usd) || 0;
      if (tx.type === 'deposit') {
        totalDepositsUsd += usdAmount;
      } else if (tx.type === 'expense') {
        totalExpensesUsd += usdAmount;
      } else if (tx.type === 'payout') {
        totalPayoutsUsd += usdAmount;
      } else if (tx.type === 'profit_withdraw') {
        totalDistributionsUsd += usdAmount;
      }
    });

    const netUsdWallet = totalDepositsUsd - totalExpensesUsd - totalPayoutsUsd - totalDistributionsUsd;
    const netEgpWallet = netUsdWallet * currentRate;

    // Split splits
    const partner1ShareUsd = netUsdWallet * 0.4;
    const partner1ShareEgp = netEgpWallet * 0.4;
    const partner2ShareUsd = netUsdWallet * 0.6;
    const partner2ShareEgp = netEgpWallet * 0.6;

    // Group users by owner
    const employees = users.filter(u => !u.is_manager && !u.owner_id);

    return (
      <div className="space-y-6 pb-24 animate-fadeIn">
        {/* Exchange Rate Banner */}
        <div className={`p-6 rounded-[2rem] border flex flex-col md:flex-row items-center justify-between gap-6 transition-all ${
          theme === 'dark' ? 'bg-[#111] border-white/5' : 'bg-white border-gray-200 hover:shadow-lg'
        }`}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.1)]">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-500 uppercase tracking-wider">{lang === 'ar' ? 'سعر صرف الدولار الحالي' : 'EGP / USD Exchange Rate'}</h3>
              <p className={`text-xl font-extrabold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} mt-0.5`}>
                1 USD = {currentRate.toFixed(2)} EGP
                {!manualExchangeRate && (
                  <span className="text-xs text-green-500 font-medium ml-2 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                    {lang === 'ar' ? 'سعر حي' : 'LIVE API'}
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <label className="text-xs font-bold text-gray-400 whitespace-nowrap">{lang === 'ar' ? 'تعديل السعر يدويًا:' : 'Override Rate:'}</label>
            <div className="relative flex items-center w-full md:w-48">
              <input
                type="number"
                step="any"
                placeholder={exchangeRate.toFixed(2)}
                value={manualExchangeRate}
                onChange={(e) => setManualExchangeRate(e.target.value)}
                className={`w-full border rounded-2xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 transition-all font-bold ${
                  theme === 'dark' ? 'bg-white/5 border-white/5 text-white' : 'bg-gray-50 border-gray-100 text-gray-900'
                }`}
              />
              {manualExchangeRate && (
                <button
                  onClick={() => setManualExchangeRate('')}
                  className="absolute right-3 text-[10px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full font-bold uppercase"
                >
                  {lang === 'ar' ? 'افتراضي' : 'CLEAR'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Withdrawal Cycle & Suspension Risks Info Banner */}
        <div className={`p-6 rounded-[2rem] border relative overflow-hidden bg-gradient-to-r ${
          theme === 'dark'
            ? 'from-amber-500/10 via-red-500/5 to-transparent border-amber-500/20'
            : 'from-amber-50 via-red-50/30 to-white border-amber-200'
        }`}>
          <div className="flex gap-4 items-start">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h4 className={`text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {lang === 'ar' ? 'ℹ️ دورة السحب ومخاطر بايونير' : 'ℹ️ Withdrawal Cycle & Payoneer Risk Info'}
              </h4>
              <div className={`text-xs space-y-1.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                <p>
                  {lang === 'ar'
                    ? '⚠️ تظهر أزرار السحب في رينت يوم الخميس صباحاً (تقريباً 7:00 ص بتوقيت مصر). عند طلب السحب، تتجدول الدفعة لتصل بايونير خلال يومين.'
                    : '⚠️ Rent withdrawal buttons appear on Thursday mornings (~7:00 AM Egypt time). Once requested, payouts are scheduled to reach Payoneer within 2 days.'}
                </p>
                <p>
                  {lang === 'ar'
                    ? '⚠️ تنبيه هام: عند ربط عدة حسابات رينت بحساب بايونير واحد، قد يتم تعليق دفعات بعض الحسابات بينما تمر دفعات الحسابات الأخرى بسلام.'
                    : '⚠️ Important: When linking multiple Rent accounts to a single Payoneer, some withdrawals may get suspended/held while others clear successfully.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Central Wallet & Profit Split Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Central Wallet */}
          <div className={`p-6 rounded-[2rem] border relative overflow-hidden flex flex-col justify-between h-[230px] transition-all bg-gradient-to-br ${
            theme === 'dark' 
              ? 'from-blue-600/10 via-blue-900/5 to-transparent border-blue-500/20' 
              : 'from-blue-50 to-white border-blue-200 hover:shadow-xl'
          }`}>
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-500 uppercase tracking-widest block">
                    {lang === 'ar' ? 'المحفظة المركزية' : 'Central Wallet'}
                  </span>
                  <button
                    onClick={() => setIsWalletLedgerExpanded(!isWalletLedgerExpanded)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 ${
                      isWalletLedgerExpanded
                        ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                        : theme === 'dark' ? 'bg-white/5 border-white/5 text-gray-400 hover:text-white' : 'bg-gray-50 border-gray-200 text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    <span>{lang === 'ar' ? 'سجل المحفظة' : 'Wallet Ledger'}</span>
                  </button>
                </div>
                <h3 className={`text-3xl font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  ${netUsdWallet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <p className="text-sm font-semibold text-gray-500">
                  ≈ {netEgpWallet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center">
                <Wallet className="w-6 h-6" />
              </div>
            </div>
            
            <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
              <button
                onClick={() => {
                  setTxFormData({ amountUsd: '', amountEgp: '', type: 'deposit', description: '' });
                  setIsTxModalOpen(true);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/10"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'إيداع' : 'Deposit'}</span>
              </button>
              <button
                onClick={() => {
                  setTxFormData({ amountUsd: '', amountEgp: '', type: 'expense', description: '' });
                  setIsTxModalOpen(true);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-600/10"
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'مصروف' : 'Expense'}</span>
              </button>
              <button
                onClick={() => {
                  setTxFormData({ amountUsd: '', amountEgp: '', type: 'profit_withdraw', description: '' });
                  setIsTxModalOpen(true);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-amber-600/10"
              >
                <Coins className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'سحب أرباح' : 'Withdraw'}</span>
              </button>
            </div>
          </div>

          {/* Card 2: Partner 1 Split (40%) */}
          <div className={`p-6 rounded-[2rem] border flex flex-col justify-between h-[230px] transition-all bg-gradient-to-br ${
            theme === 'dark' 
              ? 'from-purple-600/10 via-purple-900/5 to-transparent border-purple-500/20' 
              : 'from-purple-50 to-white border-purple-200 hover:shadow-xl'
          }`}>
            <div className="space-y-1">
              <span className="text-xs font-bold text-purple-500 uppercase tracking-widest block">
                {lang === 'ar' ? 'شريك 1 (40%)' : 'Partner 1 (40%)'}
              </span>
              <h3 className={`text-3xl font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                ${partner1ShareUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-sm font-semibold text-gray-500">
                ≈ {partner1ShareEgp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
              </p>
            </div>
            
            <div className="space-y-2 mt-4 pt-4 border-t border-white/5">
              <div className="flex justify-between text-xs text-gray-500 font-bold">
                <span>{lang === 'ar' ? 'الحصة من المحفظة' : 'Current Share'}</span>
                <span>40%</span>
              </div>
              <div className="w-full bg-gray-700/30 rounded-full h-2 overflow-hidden">
                <div className="bg-purple-500 h-full rounded-full" style={{ width: '40%' }} />
              </div>
            </div>
          </div>

          {/* Card 3: Partner 2 Split (60%) */}
          <div className={`p-6 rounded-[2rem] border flex flex-col justify-between h-[230px] transition-all bg-gradient-to-br ${
            theme === 'dark' 
              ? 'from-emerald-600/10 via-emerald-900/5 to-transparent border-emerald-500/20' 
              : 'from-emerald-50 to-white border-emerald-200 hover:shadow-xl'
          }`}>
            <div className="space-y-1">
              <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest block">
                {lang === 'ar' ? 'شريك 2 (60%)' : 'Partner 2 (60%)'}
              </span>
              <h3 className={`text-3xl font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                ${partner2ShareUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-sm font-semibold text-gray-500">
                ≈ {partner2ShareEgp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
              </p>
            </div>
            
            <div className="space-y-2 mt-4 pt-4 border-t border-white/5">
              <div className="flex justify-between text-xs text-gray-500 font-bold">
                <span>{lang === 'ar' ? 'الحصة من المحفظة' : 'Current Share'}</span>
                <span>60%</span>
              </div>
              <div className="w-full bg-gray-700/30 rounded-full h-2 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: '60%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Expandable Wallet Ledger Section */}
        {isWalletLedgerExpanded && (
          <div className={`p-6 rounded-[2rem] border mt-6 animate-fadeIn ${
            theme === 'dark' ? 'bg-[#111] border-white/5' : 'bg-white border-gray-200'
          }`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {lang === 'ar' ? 'سجل عمليات المحفظة (الإيداعات، المصروفات، سحوبات الشركاء)' : 'Wallet Transaction Ledger (Deposits, Expenses, Withdrawals)'}
              </h3>
              <button 
                onClick={() => setIsWalletLedgerExpanded(false)}
                className="text-xs text-gray-500 hover:text-gray-400 font-bold"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
            
            {(() => {
              const walletTx = financialTransactions.filter(tx => tx.type !== 'payout');
              if (walletTx.length === 0) {
                return (
                  <p className="text-sm text-gray-500 text-center py-6">
                    {lang === 'ar' ? 'لا توجد عمليات مسجلة بعد في المحفظة.' : 'No wallet transactions recorded yet.'}
                  </p>
                );
              }
              return (
                <div className="overflow-x-auto rounded-2xl border border-white/5">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className={`border-b ${theme === 'dark' ? 'bg-white/5 border-white/5 text-gray-400' : 'bg-gray-50 border-gray-100 text-gray-500'} text-xs font-bold uppercase`}>
                        <th className="px-6 py-3">{lang === 'ar' ? 'التاريخ' : 'DATE'}</th>
                        <th className="px-6 py-3">{lang === 'ar' ? 'النوع' : 'TYPE'}</th>
                        <th className="px-6 py-3">{lang === 'ar' ? 'المبلغ بالدولار' : 'USD'}</th>
                        <th className="px-6 py-3">{lang === 'ar' ? 'المبلغ بالجنيه' : 'EGP'}</th>
                        <th className="px-6 py-3">{lang === 'ar' ? 'البيان' : 'DESC'}</th>
                        <th className="px-6 py-3 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {walletTx.map(tx => (
                        <tr key={tx.id} className={theme === 'dark' ? 'hover:bg-white/[0.01]' : 'hover:bg-gray-50'}>
                          <td className="px-6 py-3 whitespace-nowrap text-xs text-gray-500">
                            {new Date(tx.created_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap">
                            {tx.type === 'deposit' && (
                              <span className="px-2.5 py-0.5 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-bold">
                                DEPOSIT
                              </span>
                            )}
                            {tx.type === 'expense' && (
                              <span className="px-2.5 py-0.5 text-xs bg-red-500/10 text-red-400 border border-red-500/20 rounded-full font-bold">
                                EXPENSE
                              </span>
                            )}
                            {tx.type === 'profit_withdraw' && (
                              <span className="px-2.5 py-0.5 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full font-bold">
                                WITHDRAW
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3 font-semibold font-mono text-xs">
                            ${Number(tx.amount_usd).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-3 font-semibold font-mono text-xs text-gray-400">
                            {Number(tx.amount_egp).toLocaleString()} EGP
                          </td>
                          <td className="px-6 py-3 text-xs text-gray-400 max-w-xs truncate" title={tx.description}>
                            {tx.description || '-'}
                          </td>
                          <td className="px-6 py-3 text-right whitespace-nowrap">
                            <button
                              onClick={() => handleDeleteTransaction(tx.id)}
                              className="p-1.5 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                              title={lang === 'ar' ? 'حذف' : 'Delete'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        {/* Grouped Employee Dues List */}
        <div className="space-y-4">
          <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {lang === 'ar' ? 'مستحقات ورواتب الموظفين' : 'Employee Salaries & Work Hours'}
          </h2>
          
          {employees.length === 0 ? (
            <div className={`p-12 text-center rounded-[2rem] border ${theme === 'dark' ? 'bg-[#111] border-white/5 text-gray-500' : 'bg-white border-gray-200 text-gray-400'}`}>
              {lang === 'ar' ? 'لا يوجد موظفون مضافون حالياً.' : 'No primary employees found.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {employees.map(employee => {
                const linkedAccounts = users.filter(u => u.owner_id === employee.id);
                let totalUsdDue = 0;
                linkedAccounts.forEach(acc => {
                  totalUsdDue += Number(acc.rah_currently_due) || 0;
                });
                const totalHours = totalUsdDue / 10;
                const salaryDueEgp = totalHours * 100;
                
                const historicPaidEgp = financialTransactions
                  .filter(tx => tx.type === 'payout' && tx.target_user_id === employee.id)
                  .reduce((sum, tx) => sum + (Number(tx.amount_egp) || 0), 0);

                const employeeColor = getOwnerHexColor(employee.id);

                return (
                  <div 
                    key={employee.id}
                    className={`rounded-[2rem] border p-6 transition-all ${
                      theme === 'dark' ? 'bg-[#111] border-white/5' : 'bg-white border-gray-200 hover:shadow-md'
                    }`}
                    style={{ borderLeft: `6px solid ${employeeColor}` }}
                  >
                    {/* Employee Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                      <div>
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-lg animate-pulse"
                            style={{ backgroundColor: employeeColor }}
                          >
                            {employee.username?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                              {employee.username}
                            </h3>
                            <p className="text-gray-500 text-xs">
                              📞 {employee.phone_number || (lang === 'ar' ? 'بدون رقم هاتف' : 'No phone number')}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Stats Overview */}
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="text-center px-4 py-2 bg-white/5 border border-white/5 rounded-2xl">
                          <span className="text-[10px] text-gray-500 font-bold block uppercase">{lang === 'ar' ? 'الساعات' : 'HOURS'}</span>
                          <span className={`text-sm font-extrabold ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{totalHours.toFixed(1)} hrs</span>
                        </div>
                        <div className="text-center px-4 py-2 bg-white/5 border border-white/5 rounded-2xl">
                          <span className="text-[10px] text-gray-500 font-bold block uppercase">{lang === 'ar' ? 'الراتب المستحق' : 'SALARY DUE'}</span>
                          <span className={`text-sm font-extrabold ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{salaryDueEgp.toLocaleString()} EGP</span>
                        </div>
                        <div className="text-center px-4 py-2 bg-white/5 border border-white/5 rounded-2xl">
                          <span className="text-[10px] text-gray-500 font-bold block uppercase">{lang === 'ar' ? 'إجمالي المدفوع' : 'TOTAL PAID'}</span>
                          <span className={`text-sm font-extrabold ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>{historicPaidEgp.toLocaleString()} EGP</span>
                        </div>
                        
                        <button
                          onClick={() => setExpandedPayouts(prev => ({ ...prev, [employee.id]: !prev[employee.id] }))}
                          className={`px-4 py-3 rounded-2xl font-bold text-xs border transition-all flex items-center gap-1.5 ${
                            expandedPayouts[employee.id]
                              ? 'bg-blue-600/10 text-blue-500 border-blue-500/20'
                              : theme === 'dark' ? 'bg-white/5 border-white/5 text-gray-400 hover:text-white' : 'bg-gray-50 border-gray-200 text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          <Clock className="w-4 h-4" />
                          <span>{lang === 'ar' ? 'سجل المدفوعات' : 'History'}</span>
                          {expandedPayouts[employee.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        <button
                          onClick={() => {
                            setPayoutTargetUser(employee);
                            setPayoutFormData({
                              amountEgp: salaryDueEgp.toString(),
                              transferMobile: employee.phone_number || '',
                              description: `Salary payout for ${employee.username} (${totalHours.toFixed(1)} hrs worked)`,
                            });
                            setIsPayoutModalOpen(true);
                          }}
                          disabled={salaryDueEgp <= 0}
                          className={`px-5 py-3 rounded-2xl font-bold text-xs transition-all flex items-center gap-2 ${
                            salaryDueEgp > 0
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                              : 'bg-gray-600/20 text-gray-500 cursor-not-allowed opacity-50'
                          }`}
                        >
                          <Coins className="w-4 h-4" />
                          <span>{lang === 'ar' ? 'صرف المرتب' : 'Payout Salary'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Linked Rent Accounts */}
                    <div className="space-y-3 pl-2 sm:pl-12">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                        {lang === 'ar' ? 'حسابات رينت المرتبطة' : 'Linked Rent Accounts'}
                      </h4>
                      {linkedAccounts.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">
                          {lang === 'ar' ? 'لا توجد حسابات مرتبطة بهذا الموظف.' : 'No accounts linked to this employee yet.'}
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {linkedAccounts.map(acc => {
                            const isOnline = isProxyOnline(acc);
                            const accHours = (Number(acc.rah_currently_due) || 0) / 10;
                            const accSalary = accHours * 100;
                            return (
                              <div 
                                key={acc.id}
                                className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
                                  theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50 border-gray-100'
                                }`}
                              >
                                <div className="space-y-2 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-sm font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
                                      {acc.username}
                                    </span>
                                    <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`} />
                                    {acc.payoneer_email && (
                                      <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-medium font-mono">
                                        {lang === 'ar' ? 'بايونير' : 'Payoneer'}: {acc.payoneer_email}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <p className="text-[11px] text-gray-500 whitespace-nowrap">
                                      {accHours.toFixed(1)} hrs • {accSalary} EGP
                                    </p>
                                    <select
                                      value={acc.payout_status || 'waiting'}
                                      onChange={e => handleUpdatePayoutStatus(acc.id, e.target.value)}
                                      className={`text-[10px] font-bold border rounded-lg px-2 py-1 outline-none transition-all cursor-pointer ${
                                        acc.payout_status === 'cleared'
                                          ? 'bg-green-500/15 border-green-500/30 text-green-400'
                                          : acc.payout_status === 'requested'
                                          ? 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400'
                                          : acc.payout_status === 'ready'
                                          ? 'bg-red-500/15 border-red-500/30 text-red-400'
                                          : acc.payout_status === 'suspended'
                                          ? 'bg-orange-500/15 border-orange-500/30 text-orange-400'
                                          : 'bg-gray-500/15 border-gray-500/30 text-gray-400'
                                      }`}
                                    >
                                      <option value="waiting" className={theme === 'dark' ? 'bg-[#111]' : 'bg-white'}>
                                        ⚪ {lang === 'ar' ? 'لم تبدأ الدورة' : 'Cycle Waiting'}
                                      </option>
                                      <option value="ready" className={theme === 'dark' ? 'bg-[#111]' : 'bg-white'}>
                                        🔴 {lang === 'ar' ? 'جاهز للطلب' : 'Ready to Request'}
                                      </option>
                                      <option value="requested" className={theme === 'dark' ? 'bg-[#111]' : 'bg-white'}>
                                        🟡 {lang === 'ar' ? 'قيد الانتظار' : 'Requested / Pending'}
                                      </option>
                                      <option value="cleared" className={theme === 'dark' ? 'bg-[#111]' : 'bg-white'}>
                                        🟢 {lang === 'ar' ? 'تم الوصول' : 'Cleared / Received'}
                                      </option>
                                      <option value="suspended" className={theme === 'dark' ? 'bg-[#111]' : 'bg-white'}>
                                        ⚠️ {lang === 'ar' ? 'معلقة / مشكلة' : 'Suspended / Issue'}
                                      </option>
                                    </select>
                                  </div>
                                </div>
                                
                                {/* Edit Due Field */}
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500 text-xs font-bold">$</span>
                                  <input
                                    type="number"
                                    step="any"
                                    value={editedDues[acc.id] !== undefined ? editedDues[acc.id] : (acc.rah_currently_due || 0).toString()}
                                    onChange={e => setEditedDues({ ...editedDues, [acc.id]: e.target.value })}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        handleSaveDue(acc.id, editedDues[acc.id] || (acc.rah_currently_due || 0).toString());
                                        const updated = { ...editedDues };
                                        delete updated[acc.id];
                                        setEditedDues(updated);
                                      }
                                    }}
                                    className={`w-20 border rounded-xl px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 font-bold transition-all text-center ${
                                      theme === 'dark' ? 'bg-black/35 border-white/5 text-white' : 'bg-white border-gray-200 text-gray-900'
                                    }`}
                                  />
                                  {editedDues[acc.id] !== undefined && editedDues[acc.id] !== (acc.rah_currently_due || 0).toString() && (
                                    <button
                                      onClick={() => {
                                        handleSaveDue(acc.id, editedDues[acc.id]);
                                        const updated = { ...editedDues };
                                        delete updated[acc.id];
                                        setEditedDues(updated);
                                      }}
                                      className="p-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg hover:bg-emerald-500 hover:text-white transition-all"
                                      title="Save"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Expandable Payouts Section */}
                    {expandedPayouts[employee.id] && (
                      <div className="mt-6 pt-6 border-t border-dashed border-white/10 space-y-3 animate-fadeIn">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                          {lang === 'ar' ? 'سجل مدفوعات الموظف' : 'Employee Payout Records'}
                        </h4>
                        {(() => {
                          const payouts = financialTransactions.filter(tx => tx.type === 'payout' && tx.target_user_id === employee.id);
                          if (payouts.length === 0) {
                            return (
                              <p className="text-xs text-gray-500 italic">
                                {lang === 'ar' ? 'لا توجد مدفوعات مسجلة بعد.' : 'No payouts recorded yet.'}
                              </p>
                            );
                          }
                          return (
                            <div className="overflow-x-auto rounded-2xl border border-white/5">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className={`border-b ${theme === 'dark' ? 'bg-white/5 border-white/5 text-gray-400' : 'bg-gray-50 border-gray-100 text-gray-500'} font-bold`}>
                                    <th className="px-4 py-2.5">{lang === 'ar' ? 'التاريخ' : 'DATE'}</th>
                                    <th className="px-4 py-2.5">{lang === 'ar' ? 'المبلغ بالجنيه' : 'AMOUNT (EGP)'}</th>
                                    <th className="px-4 py-2.5">{lang === 'ar' ? 'رقم التحويل' : 'MOBILE'}</th>
                                    <th className="px-4 py-2.5">{lang === 'ar' ? 'البيان' : 'DESC'}</th>
                                    <th className="px-4 py-2.5"></th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                  {payouts.map(tx => (
                                    <tr key={tx.id} className={theme === 'dark' ? 'hover:bg-white/[0.01]' : 'hover:bg-gray-50'}>
                                      <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{new Date(tx.created_at).toLocaleDateString()}</td>
                                      <td className="px-4 py-2 font-bold font-mono text-emerald-500">{Number(tx.amount_egp).toLocaleString()} EGP</td>
                                      <td className="px-4 py-2 font-mono text-gray-400">{tx.transfer_mobile || '-'}</td>
                                      <td className="px-4 py-2 text-gray-400 truncate max-w-[120px]" title={tx.description}>{tx.description || '-'}</td>
                                      <td className="px-4 py-2 text-right">
                                        <button
                                          onClick={() => handleDeleteTransaction(tx.id)}
                                          className="text-red-500/50 hover:text-red-500 p-1.5 rounded-lg transition-all hover:bg-red-500/10"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
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

    // Realtime channel for financial_transactions updates
    const txChannel = supabase
      .channel('financial_transactions_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'financial_transactions' },
        () => {
          fetchTransactions();
        }
      )
      .subscribe();

    // Realtime channel for remote_configs updates
    const configChannel = supabase
      .channel('remote_configs_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'remote_configs' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setRemoteConfigs((prev) => [payload.new as any, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setRemoteConfigs((prev) =>
              prev.map((config) => (config.id === payload.new.id ? { ...config, ...payload.new } : config))
            );
          } else if (payload.eventType === 'DELETE') {
            setRemoteConfigs((prev) => prev.filter((config) => config.id === payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(configChannel);
      supabase.removeChannel(txChannel);
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

  const handleForceLogout = (user: any) => {
    setForceLogoutTargetUser(user);
    setIsForceLogoutConfirmOpen(true);
  };

  const confirmForceLogout = async () => {
    if (!forceLogoutTargetUser) return;

    const currentSettings = forceLogoutTargetUser.ui_settings || {};
    const newSettings = {
      ...currentSettings,
      force_logout: true
    };
    
    // Update local state optimistically
    setUsers((prev: any[]) => prev.map((u: any) => u.id === forceLogoutTargetUser.id ? { ...u, ui_settings: newSettings } : u));
    setIsForceLogoutConfirmOpen(false);
    
    const { error } = await supabase
      .from('app_users')
      .update({ ui_settings: newSettings })
      .eq('id', forceLogoutTargetUser.id);

    if (error) {
      showToast(error.message, 'error');
      fetchUsers();
    } else {
      showToast(
        lang === 'ar'
          ? 'تم إرسال أمر تسجيل الخروج بنجاح.'
          : 'Force logout command sent successfully.',
        'success'
      );
    }
    setForceLogoutTargetUser(null);
  };

  const handleTriggerRentAHumanSync = async () => {
    let syncConfig = remoteConfigs.find(c => c.config_key === 'rentahuman_sync_trigger');
    
    if (!syncConfig) {
      const { data, error } = await supabase
        .from('remote_configs')
        .select('*')
        .eq('config_key', 'rentahuman_sync_trigger')
        .maybeSingle();
      if (data) {
        syncConfig = data;
      } else {
        const { data: newConfig } = await supabase
          .from('remote_configs')
          .insert([{ config_key: 'rentahuman_sync_trigger', config_value: { status: 'requested' }, is_enabled: true }])
          .select()
          .single();
        if (newConfig) {
          showToast(
            lang === 'ar' ? 'تم إنشاء حقل المزامنة وبدء الطلب...' : 'Sync field created and request sent...',
            'info'
          );
          fetchConfigs();
          return;
        }
        showToast(lang === 'ar' ? 'تعذر العثور على إعداد المزامنة' : 'Could not find sync configuration', 'error');
        return;
      }
    }

    const newConfigValue = { ...syncConfig.config_value, status: 'requested' };
    const { error } = await supabase
      .from('remote_configs')
      .update({ config_value: newConfigValue })
      .eq('id', syncConfig.id);

    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast(
        lang === 'ar' ? 'تم إرسال طلب المزامنة إلى الماك.' : 'Sync request sent to Mac.',
        'info'
      );
      fetchConfigs();
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

  const batchToggleBlock = async (blockStatus: boolean) => {
    const selectedIds = Object.keys(selectedUserIds).filter(id => selectedUserIds[id]);
    if (selectedIds.length === 0) return;
    
    const message = blockStatus
      ? (lang === 'ar' 
         ? `هل أنت متأكد من حظر ${selectedIds.length} مستخدم؟ سيتم طردهم من هواتفهم فوراً.` 
         : `Are you sure you want to block ${selectedIds.length} users? They will be logged out of their phones instantly.`)
      : (lang === 'ar' 
         ? `هل أنت متأكد من إلغاء حظر ${selectedIds.length} مستخدم؟` 
         : `Are you sure you want to unblock ${selectedIds.length} users?`);
         
    if (!confirm(message)) return;
    
    setLoading(true);
    const { error } = await supabase
      .from('app_users')
      .update({ is_blocked: blockStatus })
      .in('id', selectedIds);
      
    if (!error) {
      showToast(
        lang === 'ar'
          ? `تمت العملية بنجاح لـ ${selectedIds.length} مستخدم.`
          : `Action completed successfully for ${selectedIds.length} users.`,
        'success'
      );
      setSelectedUserIds({});
      fetchUsers();
    } else {
      alert(error.message);
    }
    setLoading(false);
  };

  const batchForceLogout = async () => {
    const selectedIds = Object.keys(selectedUserIds).filter(id => selectedUserIds[id]);
    if (selectedIds.length === 0) return;
    
    const confirmed = confirm(
      lang === 'ar'
        ? `هل أنت متأكد من تسجيل الخروج الإجباري لـ ${selectedIds.length} مستخدم؟`
        : `Are you sure you want to force logout ${selectedIds.length} users?`
    );
    if (!confirmed) return;
    
    setLoading(true);
    try {
      const selectedUsers = users.filter(u => selectedIds.includes(u.id));
      
      // Update local state optimistically
      setUsers((prev: any[]) => prev.map((u: any) => {
        if (selectedIds.includes(u.id)) {
          const currentSettings = u.ui_settings || {};
          return {
            ...u,
            ui_settings: { ...currentSettings, force_logout: true }
          };
        }
        return u;
      }));
      
      const promises = selectedUsers.map(user => {
        const currentSettings = user.ui_settings || {};
        const newSettings = {
          ...currentSettings,
          force_logout: true
        };
        return supabase
          .from('app_users')
          .update({ ui_settings: newSettings })
          .eq('id', user.id);
      });
      
      await Promise.all(promises);
      showToast(
        lang === 'ar'
          ? `تم إرسال أمر تسجيل الخروج لـ ${selectedIds.length} مستخدم بنجاح.`
          : `Force logout command sent to ${selectedIds.length} users successfully.`,
        'success'
      );
      setSelectedUserIds({});
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
      fetchUsers();
    }
  };

  const handleOpenEdit = (user: any) => {
    setPinError('');
    setEmailError('');
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
      rah_egp_payout_unit: user.ui_settings?.rah?.egp_payout_unit?.toString() || '',
      owner_id: user.owner_id || '',
      payoneer_email: user.payoneer_email || '',
      payout_status: user.payout_status || 'waiting'
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
      setPinError('');
      setEmailError('');
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
        rah_usd_payout_unit: '', rah_egp_payout_unit: '',
        owner_id: '',
        payoneer_email: '',
        payout_status: 'waiting'
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
      ui_settings,
      owner_id: formData.owner_id || null,
      payoneer_email: formData.payoneer_email?.trim() || null,
      payout_status: formData.payout_status || 'waiting'
    };

    // Double check duplicate validation just in case
    const pinDuplicate = users.find(u => u.pin === formData.pin && (!editingUser || u.id !== editingUser.id));
    if (pinDuplicate) {
      alert(lang === 'ar' ? `⚠️ رمز الـ PIN هذا مستخدم بالفعل من قبل الموظف: ${pinDuplicate.username}` : `⚠️ This PIN is already used by: ${pinDuplicate.username}`);
      return;
    }
    if (formData.email?.trim()) {
      const emailTrimmed = formData.email.trim().toLowerCase();
      const emailDuplicate = users.find(u => u.email?.trim().toLowerCase() === emailTrimmed && (!editingUser || u.id !== editingUser.id));
      if (emailDuplicate) {
        alert(lang === 'ar' ? `⚠️ البريد الإلكتروني مستخدم بالفعل من قبل الموظف: ${emailDuplicate.username}` : `⚠️ This email is already used by: ${emailDuplicate.username}`);
        return;
      }
    }

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
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    user.pin?.includes(searchQuery)
  ).sort((a, b) => {
    // 1. Manager check: managers always first
    if (a.is_manager && !b.is_manager) return -1;
    if (!a.is_manager && b.is_manager) return 1;
    if (a.is_manager && b.is_manager) {
      return (a.username || '').localeCompare(b.username || '');
    }

    // Neither is a manager. Group them by owner.
    const aOwnerId = a.owner_id || a.id;
    const bOwnerId = b.owner_id || b.id;

    if (aOwnerId === bOwnerId) {
      // Same owner group: owner goes first, then linked accounts sorted alphabetically
      if (!a.owner_id && b.owner_id) return -1;
      if (a.owner_id && !b.owner_id) return 1;
      return (a.username || '').localeCompare(b.username || '');
    }

    // Different owner groups: sort the owner groups alphabetically by the owner's username.
    const aOwner = users.find(u => u.id === aOwnerId);
    const bOwner = users.find(u => u.id === bOwnerId);
    const aOwnerName = (aOwner ? aOwner.username : a.username) || '';
    const bOwnerName = (bOwner ? bOwner.username : b.username) || '';
    return aOwnerName.localeCompare(bOwnerName);
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
                  onClick={() => { setActiveTab('accounts'); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'accounts' ? 'bg-blue-600/10 text-blue-500 border border-blue-500/20' : theme === 'dark' ? 'text-gray-400 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100'} ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
                >
                  <DollarSign className="w-5 h-5 flex-shrink-0" />
                  {!isSidebarCollapsed && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-medium whitespace-nowrap">{lang === 'ar' ? 'الحسابات والمالية' : 'Financial Accounts'}</motion.span>}
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
              {activeTab === 'users' ? t.title : activeTab === 'accounts' ? (lang === 'ar' ? 'الحسابات والمحفظة المالية' : 'Financial Accounts & Wallet') : activeTab === 'config' ? t.configTitle : activeTab === 'notifications' ? t.notificationsTitle : activeTab === 'misc' ? t.miscTitle : t.toolsTitle}
            </h1>
            <p className="text-gray-500 text-xs md:text-sm">
              {activeTab === 'users' ? t.subtitle : activeTab === 'accounts' ? (lang === 'ar' ? 'تتبع رواتب الموظفين، ساعات العمل، المصروفات، وأرباح الشركاء.' : 'Track employee salaries, hours, expenses, and partner profits.') : activeTab === 'config' ? t.subtitle : activeTab === 'notifications' ? t.notificationsSubtitle : activeTab === 'misc' ? t.miscSubtitle : t.toolsSubtitle}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <DashboardLiveClock lang={lang} theme={theme} />
            {activeTab === 'users' && (
              <PayoutHeaderWidget lang={lang} theme={theme} />
            )}
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
                {activeTab === 'users' && (
                  <div className="relative w-48 sm:w-64">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                    <input 
                      type="text" 
                      placeholder={t.search}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full border rounded-xl py-2.5 pl-10 pr-3 focus:border-blue-500 outline-none transition-all text-xs font-medium ${theme === 'dark' ? 'bg-[#111] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-950'}`}
                    />
                  </div>
                )}
                {activeTab === 'users' && (() => {
                  const syncConfig = remoteConfigs.find(c => c.config_key === 'rentahuman_sync_trigger');
                  const syncStatus = syncConfig?.config_value?.status || 'idle';
                  const isSyncing = syncStatus === 'requested' || syncStatus === 'running';
                  
                  return (
                    <button
                      onClick={handleTriggerRentAHumanSync}
                      disabled={isSyncing}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all text-sm border shrink-0 ${
                        isSyncing 
                          ? (theme === 'dark' ? 'bg-purple-600/25 text-purple-400 border-purple-500/20 cursor-not-allowed' : 'bg-purple-50 text-purple-500 border-purple-100 cursor-not-allowed')
                          : (theme === 'dark' ? 'bg-purple-600/10 text-purple-400 border-purple-500/20 hover:bg-purple-600/20 shadow-[0_0_12px_rgba(139,92,246,0.1)]' : 'bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-100/80')
                      }`}
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>
                        {isSyncing 
                          ? (lang === 'ar' ? 'جاري المزامنة...' : 'Syncing...')
                          : (lang === 'ar' ? 'مزامنة RentAHuman' : 'Sync RentAHuman')}
                      </span>
                    </button>
                  );
                })()}
                <button 
                  onClick={activeTab === 'users' || activeTab === 'accounts' ? async () => { await fetchUsers(); await fetchTransactions(); } : activeTab === 'config' ? fetchConfigs : activeTab === 'misc' ? fetchMiscItems : fetchNotifications}
                  className={`p-2.5 border rounded-xl transition-all ${theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                {activeTab !== 'accounts' && (
                  <button 
                    onClick={activeTab === 'notifications' ? () => setIsNotificationModalOpen(true) : activeTab === 'misc' ? () => { setEditingMisc(null); setMiscFormData({ title: '', content: '', display_order: 0 }); setIsMiscModalOpen(true); } : handleOpenAdd}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 rounded-xl hover:bg-blue-500 transition-all font-bold text-white shadow-lg shadow-blue-600/20 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{activeTab === 'users' ? t.addNew : activeTab === 'config' ? t.addConfig : activeTab === 'misc' ? t.addMisc : t.addNotification}</span>
                  </button>
                )}
              </>
            )}
          </div>
        </header>

        <div className="p-4 md:p-8">
        {activeTab === 'users' ? (
          <div className="space-y-6">
            




            {/* Desktop Table View */}
            <div className={`hidden md:block rounded-3xl border shadow-sm overflow-hidden ${theme === 'dark' ? 'bg-[#111] border-white/5' : 'bg-white border-gray-200'}`}>
              <table className="w-full text-left">
                <thead>
                  <tr className={`border-b ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                    <th className="pl-6 py-5 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={
                          (() => {
                            const nonManagers = filteredUsers.filter(u => !u.is_manager);
                            return nonManagers.length > 0 && nonManagers.every(u => selectedUserIds[u.id]);
                          })()
                        }
                        onChange={(e) => {
                          const checked = e.target.checked;
                          const newSelected = { ...selectedUserIds };
                          filteredUsers.forEach(u => {
                            if (!u.is_manager) {
                              if (checked) {
                                newSelected[u.id] = true;
                              } else {
                                delete newSelected[u.id];
                              }
                            }
                          });
                          setSelectedUserIds(newSelected);
                        }}
                        className={`rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer ${theme === 'dark' ? 'bg-[#222] border-white/10' : 'bg-white border-gray-300'}`}
                      />
                    </th>
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
                        layout="position"
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className={`transition-all group ${theme === 'dark' ? 'hover:bg-white/[0.02] divide-white/5' : 'hover:bg-gray-50 divide-gray-100'}`}
                        style={{ borderLeft: !user.is_manager ? `4px solid ${getOwnerHexColor(user.owner_id || user.id)}` : undefined }}
                      >
                        <td className="pl-6 py-5 w-12 text-center">
                          {!user.is_manager ? (
                            <input
                              type="checkbox"
                              checked={!!selectedUserIds[user.id]}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                const newSelected = { ...selectedUserIds };
                                if (checked) {
                                  newSelected[user.id] = true;
                                } else {
                                  delete newSelected[user.id];
                                }
                                setSelectedUserIds(newSelected);
                              }}
                              className={`rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer ${theme === 'dark' ? 'bg-[#222] border-white/10' : 'bg-white border-gray-300'}`}
                            />
                          ) : (
                            <div className="w-4 h-4" />
                          )}
                        </td>
                        <td className={`py-5 pr-6 ${user.owner_id ? 'pl-14' : 'pl-6'}`}>
                          <div className="flex items-center gap-3">
                            {user.owner_id && (
                              <span className={`text-xl font-bold select-none mr-1 ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>↳</span>
                            )}
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
                                {(() => {
                                  const owner = user.owner_id ? users.find(u => u.id === user.owner_id) : null;
                                  if (!owner) return null;
                                  return (
                                    <span className={`px-2 py-0.5 text-[10px] border rounded-full font-bold uppercase tracking-wider flex items-center gap-1 ${getOwnerClasses(user.owner_id)}`}>
                                      👤 {lang === 'ar' ? `صاحب الحساب: ${owner.username}` : `Owner: ${owner.username}`}
                                    </span>
                                  );
                                })()}
                                {!user.is_manager && (
                                  <>
                                    {user.payoneer_email && (
                                      <span className="px-2 py-0.5 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full font-bold font-mono">
                                        📧 Payoneer: {user.payoneer_email}
                                      </span>
                                    )}
                                    <span className={`px-2 py-0.5 text-[10px] border rounded-full font-bold uppercase tracking-wider ${
                                      user.payout_status === 'cleared'
                                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                        : user.payout_status === 'requested'
                                        ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                        : user.payout_status === 'ready'
                                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                        : user.payout_status === 'suspended'
                                        ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                        : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                    }`}>
                                      {user.payout_status === 'cleared' && '🟢 '}
                                      {user.payout_status === 'requested' && '🟡 '}
                                      {user.payout_status === 'ready' && '🔴 '}
                                      {user.payout_status === 'suspended' && '⚠️ '}
                                      {user.payout_status === 'waiting' && '⚪ '}
                                      {user.payout_status === 'cleared' && (lang === 'ar' ? 'تم الوصول' : 'Cleared')}
                                      {user.payout_status === 'requested' && (lang === 'ar' ? 'قيد الانتظار' : 'Requested')}
                                      {user.payout_status === 'ready' && (lang === 'ar' ? 'جاهز للطلب' : 'Ready')}
                                      {user.payout_status === 'suspended' && (lang === 'ar' ? 'معلقة' : 'Suspended')}
                                      {(user.payout_status === 'waiting' || !user.payout_status) && (lang === 'ar' ? 'لم تبدأ الدورة' : 'Waiting')}
                                    </span>
                                  </>
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
                            {user.is_manager ? (
                              <button 
                                onClick={() => handleOpenEdit(user)}
                                className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
                                title={lang === 'ar' ? 'تعديل البيانات' : 'Edit Profile'}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <>
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
                                  onClick={() => handleForceLogout(user)}
                                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                  title={lang === 'ar' ? 'تسجيل خروج إجباري' : 'Force Logout'}
                                >
                                  <LogOut className="w-4 h-4" />
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
                              </>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Mobile Select All Bar */}
            <div className={`md:hidden flex items-center justify-between p-4 rounded-2xl border mb-2 ${theme === 'dark' ? 'bg-[#111] border-white/5' : 'bg-white border-gray-200'}`}>
              <label className="flex items-center gap-3 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={
                    (() => {
                      const nonManagers = filteredUsers.filter(u => !u.is_manager);
                      return nonManagers.length > 0 && nonManagers.every(u => selectedUserIds[u.id]);
                    })()
                  }
                  onChange={(e) => {
                    const checked = e.target.checked;
                    const newSelected = { ...selectedUserIds };
                    filteredUsers.forEach(u => {
                      if (!u.is_manager) {
                        if (checked) {
                          newSelected[u.id] = true;
                        } else {
                          delete newSelected[u.id];
                        }
                      }
                    });
                    setSelectedUserIds(newSelected);
                  }}
                  className={`rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer ${theme === 'dark' ? 'bg-[#222] border-white/10' : 'bg-white border-gray-300'}`}
                />
                <span className={`font-semibold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{lang === 'ar' ? 'تحديد الكل' : 'Select All'}</span>
              </label>
              <span className={`text-xs px-2.5 py-1 rounded-full border ${theme === 'dark' ? 'bg-white/5 border-white/5 text-gray-400' : 'bg-gray-100 border-gray-200 text-gray-600'}`}>
                {Object.keys(selectedUserIds).filter(id => selectedUserIds[id]).length} {lang === 'ar' ? 'محدد' : 'selected'}
              </span>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              <AnimatePresence mode="popLayout">
                {filteredUsers.map((user) => (
                  <motion.div 
                    key={user.id}
                    layout
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`p-6 rounded-3xl border shadow-sm space-y-6 ${theme === 'dark' ? 'bg-[#111] border-white/5' : 'bg-white border-gray-200'}`}
                    style={{ 
                      borderLeft: !user.is_manager ? `6px solid ${getOwnerHexColor(user.owner_id || user.id)}` : undefined,
                      marginLeft: user.owner_id ? '1.5rem' : undefined
                    }}
                  >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      {!user.is_manager ? (
                        <input
                          type="checkbox"
                          checked={!!selectedUserIds[user.id]}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            const newSelected = { ...selectedUserIds };
                            if (checked) {
                              newSelected[user.id] = true;
                            } else {
                              delete newSelected[user.id];
                            }
                            setSelectedUserIds(newSelected);
                          }}
                          className={`rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer ${theme === 'dark' ? 'bg-[#222] border-white/10' : 'bg-white border-gray-300'}`}
                        />
                      ) : null}
                      {user.owner_id && (
                        <span className={`text-xl font-bold select-none mr-1 ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>↳</span>
                      )}
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
                          {(() => {
                            const owner = user.owner_id ? users.find(u => u.id === user.owner_id) : null;
                            if (!owner) return null;
                            return (
                              <span className={`px-2 py-0.5 text-[10px] border rounded-full font-bold uppercase tracking-wider flex items-center gap-1 ${getOwnerClasses(user.owner_id)}`}>
                                👤 {lang === 'ar' ? `صاحب الحساب: ${owner.username}` : `Owner: ${owner.username}`}
                              </span>
                            );
                          })()}
                          {!user.is_manager && (
                            <>
                              {user.payoneer_email && (
                                <span className="px-2 py-0.5 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full font-bold font-mono">
                                  📧 Payoneer: {user.payoneer_email}
                                </span>
                              )}
                              <span className={`px-2 py-0.5 text-[10px] border rounded-full font-bold uppercase tracking-wider ${
                                user.payout_status === 'cleared'
                                  ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                  : user.payout_status === 'requested'
                                  ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                  : user.payout_status === 'ready'
                                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                  : user.payout_status === 'suspended'
                                  ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                  : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                              }`}>
                                {user.payout_status === 'cleared' && '🟢 '}
                                {user.payout_status === 'requested' && '🟡 '}
                                {user.payout_status === 'ready' && '🔴 '}
                                {user.payout_status === 'suspended' && '⚠️ '}
                                {user.payout_status === 'waiting' && '⚪ '}
                                {user.payout_status === 'cleared' && (lang === 'ar' ? 'تم الوصول' : 'Cleared')}
                                {user.payout_status === 'requested' && (lang === 'ar' ? 'قيد الانتظار' : 'Requested')}
                                {user.payout_status === 'ready' && (lang === 'ar' ? 'جاهز للطلب' : 'Ready')}
                                {user.payout_status === 'suspended' && (lang === 'ar' ? 'معلقة' : 'Suspended')}
                                {(user.payout_status === 'waiting' || !user.payout_status) && (lang === 'ar' ? 'لم تبدأ الدورة' : 'Waiting')}
                              </span>
                            </>
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

                  {user.is_manager ? (
                    <button 
                      onClick={() => handleOpenEdit(user)}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all w-full ${theme === 'dark' ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      <Edit2 className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'تعديل البيانات' : 'Edit Profile'}</span>
                    </button>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => handleToggleBlock(user)}
                        className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${user.is_blocked ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                        <Ban className="w-4 h-4" />
                        <span>{user.is_blocked ? (lang === 'ar' ? 'فك حظر' : 'Unblock') : (lang === 'ar' ? 'حظر' : 'Block')}</span>
                      </button>
                      <button 
                        onClick={() => handleForceLogout(user)}
                        className="flex items-center justify-center gap-2 py-3 bg-red-500/10 text-red-500 rounded-xl font-bold hover:bg-red-500/20 transition-all"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>{lang === 'ar' ? 'خروج إجباري' : 'Force Logout'}</span>
                      </button>
                      <button 
                        onClick={() => handleOpenEdit(user)}
                        className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${theme === 'dark' ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                        <Edit2 className="w-4 h-4" />
                        <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(user.id, user.username)}
                        className="flex items-center justify-center gap-2 py-3 bg-red-500/10 text-red-500 rounded-xl font-bold hover:bg-red-500/20 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>{lang === 'ar' ? 'حذف' : 'Delete'}</span>
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
              </AnimatePresence>
            </div>

            {filteredUsers.length === 0 && !loading && (
              <div className="p-20 text-center text-gray-500">
                {t.noUsers}
              </div>
            )}

            {/* Floating Bulk Action Bar */}
            {mounted && typeof window !== 'undefined' && createPortal(
              <AnimatePresence>
                {Object.keys(selectedUserIds).filter(id => selectedUserIds[id]).length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 50 }}
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between gap-4 px-6 py-4 rounded-2xl shadow-2xl border border-white/10 bg-[#16161a]/95 backdrop-blur-md max-w-full w-[90%] md:w-[600px] flex-col sm:flex-row"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center font-bold text-xs text-white">
                        {Object.keys(selectedUserIds).filter(id => selectedUserIds[id]).length}
                      </span>
                      <span className="text-sm font-semibold text-white">
                        {lang === 'ar' ? 'مستخدمين محددين' : 'users selected'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap justify-center">
                      <button
                        onClick={() => batchToggleBlock(true)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'حظر' : 'Block'}</span>
                      </button>
                      
                      <button
                        onClick={() => batchToggleBlock(false)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'فك حظر' : 'Unblock'}</span>
                      </button>

                      <button
                        onClick={batchForceLogout}
                        className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'خروج إجباري' : 'Force Logout'}</span>
                      </button>
                      
                      <button
                        onClick={() => setSelectedUserIds({})}
                        className="px-2.5 py-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-xs font-medium transition-all"
                      >
                        {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>,
              document.body
            )}
          </div>
        ) : activeTab === 'accounts' ? (
          renderAccountsTab()
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
                      onChange={e => {
                        const val = e.target.value;
                        setFormData({...formData, pin: val});
                        if (!val) {
                          setPinError('');
                        } else {
                          const duplicate = users.find(u => u.pin === val && (!editingUser || u.id !== editingUser.id));
                          if (duplicate) {
                            setPinError(lang === 'ar' ? `⚠️ هذا الـ PIN مستخدم بالفعل من قبل الموظف: ${duplicate.username}` : `⚠️ PIN already used by: ${duplicate.username}`);
                          } else {
                            setPinError('');
                          }
                        }
                      }}
                      className={`w-full border rounded-2xl p-4 outline-none focus:border-blue-500 transition-all font-mono ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'} ${pinError ? 'border-red-500/50 focus:border-red-500' : ''}`}
                      placeholder="4-6 digits"
                    />
                    {pinError && (
                      <p className="text-red-500 text-xs ml-1 font-semibold animate-pulse">{pinError}</p>
                    )}
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
                  {!formData.is_manager && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm text-gray-400 ml-1">
                          {lang === 'ar' ? 'صاحب الحساب (الموظف)' : 'Account Owner (Employee)'}
                        </label>
                        <select
                          value={formData.owner_id || ''}
                          onChange={e => setFormData({ ...formData, owner_id: e.target.value })}
                          className={`w-full border rounded-2xl p-4 outline-none focus:border-blue-500 transition-all ${
                            theme === 'dark' ? 'bg-white/5 border-white/5 text-white' : 'bg-gray-50 border-gray-100 text-gray-900'
                          }`}
                        >
                          <option value="" className={theme === 'dark' ? 'bg-[#111]' : 'bg-white'}>
                            {lang === 'ar' ? 'بدون صاحب (هو الموظف الأساسي)' : 'None (This is the primary employee)'}
                          </option>
                          {users
                            .filter(u => !u.is_manager && !u.owner_id && (editingUser ? u.id !== editingUser.id : true))
                            .map(u => (
                              <option key={u.id} value={u.id} className={theme === 'dark' ? 'bg-[#111]' : 'bg-white'}>
                                {u.username}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-gray-400 ml-1">
                          {lang === 'ar' ? 'بريد بايونير (Payoneer Email)' : 'Payoneer Email'}
                        </label>
                        <input
                          type="email"
                          value={formData.payoneer_email || ''}
                          onChange={e => setFormData({ ...formData, payoneer_email: e.target.value })}
                          className={`w-full border rounded-2xl p-4 outline-none focus:border-blue-500 transition-all ${
                            theme === 'dark' ? 'bg-white/5 border-white/5 text-white' : 'bg-gray-50 border-gray-100 text-gray-900'
                          }`}
                          placeholder="email@payoneer.com"
                        />
                      </div>
                    </>
                  )}
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
                        onChange={e => {
                          const val = e.target.value;
                          setFormData({...formData, email: val});
                          const trimmed = val.trim().toLowerCase();
                          if (!trimmed) {
                            setEmailError('');
                          } else {
                            const duplicate = users.find(u => u.email?.trim().toLowerCase() === trimmed && (!editingUser || u.id !== editingUser.id));
                            if (duplicate) {
                              setEmailError(lang === 'ar' ? `⚠️ البريد الإلكتروني مستخدم بالفعل من قبل الموظف: ${duplicate.username}` : `⚠️ Email already used by: ${duplicate.username}`);
                            } else {
                              setEmailError('');
                            }
                          }
                        }}
                        className={`w-full border rounded-xl p-3 outline-none focus:border-blue-500 transition-all ${theme === 'dark' ? 'bg-black/20 border-white/5 text-white' : 'bg-white border-gray-200 text-gray-900'} ${emailError ? 'border-red-500/50 focus:border-red-500' : ''}`}
                        placeholder="username@outlook.com / company.com"
                      />
                      {emailError && (
                        <p className="text-red-500 text-xs ml-1 font-semibold animate-pulse">{emailError}</p>
                      )}
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
                    disabled={!!pinError || !!emailError}
                    className={`flex-1 px-6 py-4 rounded-2xl font-bold transition-all text-white ${
                      (pinError || emailError)
                        ? 'bg-gray-600/50 text-gray-400 opacity-50 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-500'
                    }`}
                  >
                    {editingUser ? t.save : t.createBtn}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Financial Payout Modal */}
      <AnimatePresence>
        {isPayoutModalOpen && payoutTargetUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsPayoutModalOpen(false);
                setPayoutTargetUser(null);
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-md rounded-[2.5rem] border p-8 shadow-2xl ${
                theme === 'dark' ? 'bg-[#111] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
              }`}
            >
              <h2 className="text-xl font-bold mb-6">
                {lang === 'ar' ? `تسجيل صرف راتب: ${payoutTargetUser.username}` : `Salary Payout: ${payoutTargetUser.username}`}
              </h2>
              <form onSubmit={handlePayoutSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block ml-1">
                    {lang === 'ar' ? 'المبلغ بالجنيه المصري (EGP)' : 'Amount (EGP)'}
                  </label>
                  <input 
                    required
                    type="number"
                    step="any"
                    value={payoutFormData.amountEgp}
                    onChange={e => setPayoutFormData({...payoutFormData, amountEgp: e.target.value})}
                    className={`w-full border rounded-2xl p-4 outline-none focus:border-blue-500 transition-all font-bold font-mono ${
                      theme === 'dark' ? 'bg-white/5 border-white/5 text-white' : 'bg-gray-50 border-gray-100 text-gray-900'
                    }`}
                    placeholder="e.g. 1500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block ml-1">
                    {lang === 'ar' ? 'رقم فودافون كاش / المحفظة' : 'Mobile Transfer Number'}
                  </label>
                  <input 
                    type="text"
                    value={payoutFormData.transferMobile}
                    onChange={e => setPayoutFormData({...payoutFormData, transferMobile: e.target.value})}
                    className={`w-full border rounded-2xl p-4 outline-none focus:border-blue-500 transition-all font-mono ${
                      theme === 'dark' ? 'bg-white/5 border-white/5 text-white' : 'bg-[#fff] border-gray-200 text-gray-900'
                    }`}
                    placeholder="e.g. 01012345678"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block ml-1">
                    {lang === 'ar' ? 'البيان / الملاحظات' : 'Description'}
                  </label>
                  <input 
                    type="text"
                    value={payoutFormData.description}
                    onChange={e => setPayoutFormData({...payoutFormData, description: e.target.value})}
                    className={`w-full border rounded-2xl p-4 outline-none focus:border-blue-500 transition-all ${
                      theme === 'dark' ? 'bg-white/5 border-white/5 text-white' : 'bg-gray-50 border-gray-100 text-gray-900'
                    }`}
                    placeholder="e.g. June salary"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsPayoutModalOpen(false);
                      setPayoutTargetUser(null);
                    }}
                    className={`flex-1 px-6 py-4 rounded-2xl font-bold transition-all ${
                      theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {t.cancel}
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-bold transition-all text-white shadow-lg shadow-emerald-600/20"
                  >
                    {lang === 'ar' ? 'تسجيل الدفع' : 'Record Payout'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Financial Transaction Modal */}
      <AnimatePresence>
        {isTxModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTxModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-md rounded-[2.5rem] border p-8 shadow-2xl ${
                theme === 'dark' ? 'bg-[#111] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
              }`}
            >
              <h2 className="text-xl font-bold mb-6">
                {txFormData.type === 'deposit' && (lang === 'ar' ? 'إيداع أموال في المحفظة' : 'Deposit Funds')}
                {txFormData.type === 'expense' && (lang === 'ar' ? 'تسجيل مصروفات' : 'Log Expense')}
                {txFormData.type === 'profit_withdraw' && (lang === 'ar' ? 'سحب أرباح الشركاء' : 'Withdraw Partner Profits')}
              </h2>
              <form onSubmit={handleTxSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block ml-1">
                    {lang === 'ar' ? 'العملية' : 'Transaction Type'}
                  </label>
                  <select
                    value={txFormData.type}
                    onChange={e => setTxFormData({...txFormData, type: e.target.value as any})}
                    className={`w-full border rounded-2xl p-4 outline-none focus:border-blue-500 transition-all font-bold ${
                      theme === 'dark' ? 'bg-white/5 border-white/5 text-white' : 'bg-gray-50 border-gray-100 text-gray-900'
                    }`}
                  >
                    <option value="deposit" className={theme === 'dark' ? 'bg-[#111]' : 'bg-white'}>
                      {lang === 'ar' ? 'إيداع (Deposit)' : 'Deposit'}
                    </option>
                    <option value="expense" className={theme === 'dark' ? 'bg-[#111]' : 'bg-white'}>
                      {lang === 'ar' ? 'مصروفات (Expense)' : 'Expense'}
                    </option>
                    <option value="profit_withdraw" className={theme === 'dark' ? 'bg-[#111]' : 'bg-white'}>
                      {lang === 'ar' ? 'سحب أرباح شركاء (Profit Withdraw)' : 'Profit Withdraw'}
                    </option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block ml-1">
                      {lang === 'ar' ? 'المبلغ ($)' : 'Amount (USD)'}
                    </label>
                    <input 
                      type="number"
                      step="any"
                      value={txFormData.amountUsd}
                      onChange={e => setTxFormData({...txFormData, amountUsd: e.target.value})}
                      className={`w-full border rounded-2xl p-4 outline-none focus:border-blue-500 transition-all font-bold font-mono ${
                        theme === 'dark' ? 'bg-white/5 border-white/5 text-white' : 'bg-gray-50 border-gray-100 text-gray-900'
                      }`}
                      placeholder="$100"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block ml-1">
                      {lang === 'ar' ? 'المبلغ (EGP)' : 'Amount (EGP)'}
                    </label>
                    <input 
                      type="number"
                      step="any"
                      value={txFormData.amountEgp}
                      onChange={e => setTxFormData({...txFormData, amountEgp: e.target.value})}
                      className={`w-full border rounded-2xl p-4 outline-none focus:border-blue-500 transition-all font-bold font-mono ${
                        theme === 'dark' ? 'bg-white/5 border-white/5 text-white' : 'bg-gray-50 border-gray-100 text-gray-900'
                      }`}
                      placeholder="5000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block ml-1">
                    {lang === 'ar' ? 'البيان / التفاصيل' : 'Description'}
                  </label>
                  <input 
                    required
                    type="text"
                    value={txFormData.description}
                    onChange={e => setTxFormData({...txFormData, description: e.target.value})}
                    className={`w-full border rounded-2xl p-4 outline-none focus:border-blue-500 transition-all ${
                      theme === 'dark' ? 'bg-white/5 border-white/5 text-white' : 'bg-gray-50 border-gray-100 text-gray-900'
                    }`}
                    placeholder="e.g. Rent Payment, Office rent, etc."
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsTxModalOpen(false)}
                    className={`flex-1 px-6 py-4 rounded-2xl font-bold transition-all ${
                      theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {t.cancel}
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold transition-all text-white shadow-lg shadow-blue-600/20"
                  >
                    {lang === 'ar' ? 'تسجيل العملية' : 'Save Transaction'}
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

      {/* Custom Force Logout Confirmation Modal */}
      <AnimatePresence>
        {isForceLogoutConfirmOpen && forceLogoutTargetUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsForceLogoutConfirmOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`relative w-full max-w-sm rounded-[2rem] border p-8 shadow-2xl text-center ${theme === 'dark' ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-gray-200'}`}
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-red-500/10 text-red-500">
                <LogOut className="w-8 h-8" />
              </div>
              <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {lang === 'ar' ? 'تسجيل خروج إجباري' : 'Force Logout'}
              </h3>
              <p className="text-gray-500 text-sm mb-8">
                {lang === 'ar' 
                  ? `هل تريد حقاً تسجيل خروج المستخدم "${forceLogoutTargetUser.username}" من التطبيق إجبارياً؟ سيتم فصل البروكسي وإعادته لصفحة تسجيل الدخول.` 
                  : `Are you sure you want to force logout user "${forceLogoutTargetUser.username}"? This will disconnect their proxy and return them to the login screen.`}
              </p>
              
              <div className="flex flex-col gap-2">
                <button 
                  onClick={confirmForceLogout}
                  className="w-full py-3 text-white bg-red-600 hover:bg-red-500 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                >
                  {lang === 'ar' ? 'نعم، سجل خروج' : 'Yes, Log Out'}
                </button>
                <button 
                  onClick={() => setIsForceLogoutConfirmOpen(false)}
                  className={`w-full py-3 rounded-xl font-bold transition-all ${theme === 'dark' ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border text-sm backdrop-blur-md max-w-sm ${
              toast.type === 'error'
                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                : toast.type === 'info'
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}
          >
            <span className={`w-2 h-2 rounded-full animate-pulse ${
              toast.type === 'error' ? 'bg-red-400' : toast.type === 'info' ? 'bg-blue-400' : 'bg-emerald-400'
            }`} />
            <span className="font-semibold">{toast.message}</span>
          </motion.div>
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

// ─── RentAHuman Payout Header Widget Component ───────────────────────────────
function PayoutHeaderWidget({ lang, theme }: { lang: 'en' | 'ar'; theme: string }) {
  const [timeLeftStr, setTimeLeftStr] = useState('');
  const [fullDetails, setFullDetails] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const getNextPayoutDate = () => {
    const now = new Date();
    // Wednesday 9:00 PM Pacific Time is Thursday 4:00 AM UTC
    const target = new Date(now);
    target.setUTCHours(4, 0, 0, 0);
    
    const currentDay = now.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 4 = Thu
    const currentHours = now.getUTCHours();
    
    let daysToAdd = (4 - currentDay + 7) % 7;
    
    if (currentDay === 4) {
      if (currentHours >= 16) {
        daysToAdd = 7;
      } else {
        daysToAdd = 0;
      }
    }
    
    target.setUTCDate(target.getUTCDate() + daysToAdd);
    return target;
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const target = getNextPayoutDate();
      const diffMs = target.getTime() - now.getTime();
      
      if (diffMs <= 0) {
        setTimeLeftStr(lang === 'ar' ? 'جاري السحب حالياً...' : 'Processing Payout...');
        setIsProcessing(true);
        setFullDetails(
          lang === 'ar'
            ? 'سحب الأرباح نشط حالياً! تستمر معالجة السحب لمدة 12 ساعة.'
            : 'Payout is actively processing! This status remains for 12 hours.'
        );
        return;
      }
      
      setIsProcessing(false);
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      const dayLabel = lang === 'ar' ? 'يوم' : 'd';
      const hourLabel = lang === 'ar' ? 'س' : 'h';
      const minLabel = lang === 'ar' ? 'د' : 'm';
      
      const parts = [];
      if (days > 0) parts.push(`${days}${dayLabel}`);
      if (hours > 0 || days > 0) parts.push(`${hours}${hourLabel}`);
      parts.push(`${minutes}${minLabel}`);
      
      setTimeLeftStr(parts.join(' '));
      
      const dateOpts: Intl.DateTimeFormatOptions = { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      };
      const formattedDate = target.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', dateOpts);
      
      setFullDetails(
        lang === 'ar'
          ? `موعد السحب القادم: ${formattedDate} (يغطي أسبوع العمل السابق من الجمعة للجمعة)`
          : `Next payout: ${formattedDate} (Covers previous Friday-to-Friday week)`
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 10000); // 10s interval is fine
    return () => clearInterval(interval);
  }, [lang]);

  return (
    <div 
      title={fullDetails}
      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-help transition-all shrink-0 select-none ${
        isProcessing
          ? theme === 'dark'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.05)]'
            : 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100/70'
          : theme === 'dark'
            ? 'bg-purple-600/10 border-purple-500/20 text-purple-400 hover:bg-purple-600/20 shadow-[0_0_12px_rgba(139,92,246,0.05)]'
            : 'bg-purple-50 border-purple-100 text-purple-600 hover:bg-purple-100/70'
      }`}
    >
      <span className="flex h-1.5 w-1.5 relative">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
          isProcessing ? 'bg-emerald-400' : 'bg-purple-400'
        }`}></span>
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
          isProcessing ? 'bg-emerald-500' : 'bg-purple-500'
        }`}></span>
      </span>
      <Calendar className="w-3.5 h-3.5" />
      <span>
        {isProcessing ? timeLeftStr : (lang === 'ar' ? `السحب: ${timeLeftStr}` : `Payout: ${timeLeftStr}`)}
      </span>
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
      if ((user.rah_api_key || user.rah_earnings) && user.rah_balance !== undefined && user.rah_balance !== null) {
        // Construct synthetic profile from Supabase fields synced by the mobile client/scraper!
        const transactions = Array.isArray(user.rah_earnings)
          ? user.rah_earnings.map((tx: any) => ({
              id: tx.id || '',
              amount: tx.amount, // already in cents in the database!
              type: tx.type || (tx.direction === 'received' ? 'figure_ongoing_payout' : 'transfer'),
              description: tx.description || '',
              createdAt: tx.created_at || tx.createdAt || tx.timestamp || '',
              balanceAfter: tx.balance_after || tx.balanceAfter || 0
            }))
          : [];

        setProfile({
          id: user.id || 'synthetic-id',
          name: user.username || 'Worker',
          hourlyRate: user.ui_settings?.rah?.rate_override || 10,
          currentlyDue: (user.rah_currently_due !== undefined && user.rah_currently_due !== null
            ? user.rah_currently_due
            : (user.ui_settings?.rah?.earnings_offset || (user.email === 'flash75711@gmail.com' ? 51.33 : 0) || user.rah_balance || 0)) * 100, // fall back to earnings_offset so pending amounts display automatically!
          transactions: transactions,
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

  if (!user.rah_human_id && !user.rah_api_key && !user.rah_earnings) {
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

  // 4. Load manual offset adjustments (for unpaid/pending program work) or fallback to automated offsets from currentlyDue
  const automatedEarningsOffset = (profile.currentlyDue || 0) / 100;
  const automatedHoursOffset = customRate > 0 ? (automatedEarningsOffset / customRate) : 0;

  const hoursOffset = user.ui_settings?.rah?.hours_offset !== undefined && user.ui_settings?.rah?.hours_offset !== null && user.ui_settings?.rah?.hours_offset !== '' && Number(user.ui_settings?.rah?.hours_offset) > 0
    ? Number(user.ui_settings?.rah?.hours_offset)
    : (automatedHoursOffset > 0 ? automatedHoursOffset : (user.email === 'flash75711@gmail.com' ? 4.7 : 0));

  const earningsOffset = user.ui_settings?.rah?.earnings_offset !== undefined && user.ui_settings?.rah?.earnings_offset !== null && user.ui_settings?.rah?.earnings_offset !== '' && Number(user.ui_settings?.rah?.earnings_offset) > 0
    ? Number(user.ui_settings?.rah?.earnings_offset)
    : (automatedEarningsOffset > 0 ? automatedEarningsOffset : (user.email === 'flash75711@gmail.com' ? 51.33 : 0));

  // 5. Final aggregate figures (exact summation)
  let totalEarnings = paidEarnings + earningsOffset;
  let totalHours = Number((paidHours + hoursOffset).toFixed(1));

  const scrapedStats = (!Array.isArray(user.rah_earnings) && user.rah_earnings && typeof user.rah_earnings === 'object')
    ? (user.rah_earnings as any)
    : null;

  if (scrapedStats) {
    paidEarnings = scrapedStats.paid_to_you || 0;
    totalEarnings = paidEarnings + (scrapedStats.due_next_payout || 0);
    totalHours = Number((scrapedStats.usable_hours || scrapedStats.hours_submitted || 0).toFixed(1));
  }

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

  const formatSyncTime = (dateStr?: string) => {
    if (!dateStr) return lang === 'ar' ? 'غير متوفر' : 'N/A';
    try {
      const date = new Date(dateStr);
      const diffMs = new Date().getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return lang === 'ar' ? 'الآن' : 'Just now';
      if (diffMins < 60) return lang === 'ar' ? `منذ ${diffMins} د` : `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return lang === 'ar' ? `منذ ${diffHours} س` : `${diffHours}h ago`;
      return date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
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

        <div className="flex items-center justify-between text-[10px] text-gray-500 font-bold px-1 pt-0.5 border-t border-white/5">
          <span>🔄 {lang === 'ar' ? 'آخر مزامنة:' : 'Last synced:'}</span>
          <span>{formatSyncTime(user.rah_last_synced)}</span>
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
                      <p className="text-xs text-gray-500 font-medium">{lang === 'ar' ? 'إحصائيات تكامل RentAHuman' : 'RentAHuman integration stats'}</p>
                      <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                        🔄 {lang === 'ar' ? 'آخر تحديث:' : 'Last synced:'} {formatSyncTime(user.rah_last_synced)}
                      </p>
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
                      <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">{lang === 'ar' ? 'مكتسب غير مقيد' : 'Earned, not credited'}</span>
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

                    {transactions.length === 0 && scrapedStats && (
                      <div className="space-y-3 p-1">
                        <div className={`p-4 rounded-3xl border text-xs space-y-3 ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400 font-medium">{lang === 'ar' ? 'الساعات المقدمة' : 'Hours Submitted'}</span>
                            <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{scrapedStats.hours_submitted} hrs</span>
                          </div>
                          <div className="flex justify-between items-center border-t border-white/5 pt-2.5">
                            <span className="text-gray-400 font-medium">{lang === 'ar' ? 'الساعات المقبولة للعمل' : 'Usable Hours'}</span>
                            <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{scrapedStats.usable_hours} hrs</span>
                          </div>
                          <div className="flex justify-between items-center border-t border-white/5 pt-2.5">
                            <span className="text-gray-400 font-medium">{lang === 'ar' ? 'معدل صلاحية الساعات' : 'Usability Rate'}</span>
                            <span className={`font-bold ${scrapedStats.usability_rate >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>{scrapedStats.usability_rate}%</span>
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-500 text-center font-medium leading-relaxed">
                          {lang === 'ar' 
                            ? 'تم سحب هذه الأرقام مباشرة من صفحة RentAHuman Ongoing.'
                            : 'These stats were scraped directly from RentAHuman Ongoing page.'}
                        </p>
                      </div>
                    )}

                    {transactions.length === 0 && !scrapedStats && (
                      <div className="py-8 text-center text-xs text-gray-500 border border-dashed border-white/5 rounded-2xl">
                        {lang === 'ar' ? 'لا توجد معاملات مسجلة حتى الآن.' : 'No transactions registered yet.'}
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
        <span className="text-[9px] text-gray-500 font-bold mt-1">
          🔄 {lang === 'ar' ? 'تحديث:' : 'Sync:'} {formatSyncTime(user.rah_last_synced)}
        </span>
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

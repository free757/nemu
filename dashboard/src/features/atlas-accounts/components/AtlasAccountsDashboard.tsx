"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  AlertCircle,
  LogOut,
  RefreshCw,
  LayoutGrid,
  List,
  Plus,
  Wallet,
  X,
} from "lucide-react";
import { PinLogin } from "./PinLogin";
import { AccountsSummary } from "./AccountsSummary";
import { AccountsList } from "./AccountsList";
import { AccountCard } from "./AccountCard";
import { AddAccountModal } from "./AddAccountModal";
import { PayoutHistory } from "./PayoutHistory";
import { PaymentsHistory } from "./PaymentsHistory";

interface Account {
  id: string;
  account_name: string;
  accepted_hours: number;
  rejected_hours: number;
  in_review_hours: number;
  wallet_address: string;
  amount_paid: number;
  created_at: string;
  next_payment?: number;
}

interface Payout {
  id: string;
  account_id: string;
  amount_paid: number;
  wallet_address: string;
  timestamp: string;
}

interface WorkerSession {
  id: string;
  username: string;
}

export default function AtlasAccountsDashboard() {
  const router = useRouter();

  // Authentication State
  const [worker, setWorker] = useState<WorkerSession | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Login PIN States
  const [pin, setPin] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(false);
  const [loginErrorMsg, setLoginErrorMsg] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const shakeKey = useRef(0);

  // Dashboard Data States
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [activeHistoryTab, setActiveHistoryTab] = useState<"resets" | "payments">("resets");

  // Add Account States
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [newAccountForm, setNewAccountForm] = useState({
    account_name: "",
    wallet_address: "",
    accepted_hours: 0,
    rejected_hours: 0,
    in_review_hours: 0,
    amount_paid: 0,
  });

  // Edit Account Form States
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editWalletValue, setEditWalletValue] = useState("");
  const [editAmountPaid, setEditAmountPaid] = useState<string>("0");
  const [editNextPayment, setEditNextPayment] = useState<string>("0");
  const [editHours, setEditHours] = useState({
    accepted: "0",
    rejected: "0",
    in_review: "0",
  });
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);



  // 1. Clock Setup (Login View)
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      );
      setCurrentDate(
        now.toLocaleDateString("ar-EG", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // 2. Authentication Check
  useEffect(() => {
    try {
      const authData = sessionStorage.getItem("worker_auth");
      if (authData) {
        setWorker(JSON.parse(authData) as WorkerSession);
      } else {
        setWorker(null);
      }
    } catch (e) {
      console.warn("sessionStorage is disabled or unavailable", e);
      setWorker(null);
    }
    setAuthChecking(false);
  }, []);

  // 3. Login PIN Auto-submit
  useEffect(() => {
    if (pin.length === 4) {
      handleLogin(pin);
    }
  }, [pin]);

  const handleLogin = async (enteredPin: string) => {
    setLoginLoading(true);
    setLoginError(false);
    setLoginErrorMsg("");

    try {
      const { data, error } = await supabase
        .from("atlas_workers")
        .select("id, username, pin, is_blocked")
        .eq("pin", enteredPin)
        .single();

      if (error || !data) {
        shakeKey.current += 1;
        setLoginError(true);
        setLoginErrorMsg("الرمز التعريفي (PIN) غير صحيح. حاول مجدداً.");
        setTimeout(() => {
          setPin("");
          setLoginError(false);
          setLoginErrorMsg("");
        }, 800);
      } else if (data.is_blocked) {
        shakeKey.current += 1;
        setLoginError(true);
        setLoginErrorMsg("هذا الحساب معطل من قبل الإدارة.");
        setTimeout(() => {
          setPin("");
          setLoginError(false);
          setLoginErrorMsg("");
        }, 1200);
      } else {
        const session = { id: data.id, username: data.username };
        try {
          sessionStorage.setItem("worker_auth", JSON.stringify(session));
        } catch (e) {
          console.warn("sessionStorage is disabled or full", e);
        }
        setWorker(session);
        setPin("");
      }
    } catch (err) {
      setLoginError(true);
      setLoginErrorMsg("خطأ في الاتصال بالسيرفر. يرجى المحاولة لاحقاً.");
      setTimeout(() => {
        setPin("");
        setLoginError(false);
      }, 1000);
    } finally {
      setLoginLoading(false);
    }
  };

  // 4. Load Dashboard Data
  const loadDashboardData = useCallback(async (workerId: string) => {
    setDataLoading(true);
    try {
      // Query accounts
      const { data: accountsData, error: accountsErr } = await supabase
        .from("atlas_accounts")
        .select("*")
        .eq("worker_id", workerId)
        .order("created_at", { ascending: true });

      if (accountsErr) throw accountsErr;
      setAccounts(accountsData || []);

      // Query payouts
      const { data: payoutsData, error: payoutsErr } = await supabase
        .from("atlas_payouts")
        .select("*")
        .eq("worker_id", workerId)
        .order("created_at", { ascending: false });

      if (payoutsErr) throw payoutsErr;

      // Map to local UI structure
      const formattedPayouts = (payoutsData || []).map((p: any) => ({
        id: p.id,
        account_id: p.account_id,
        amount_paid: p.amount_paid,
        wallet_address: p.wallet_address,
        timestamp: p.created_at,
      }));
      setPayouts(formattedPayouts);

      // Query actual payments ledger
      const { data: paymentsData, error: paymentsErr } = await supabase
        .from("atlas_payments")
        .select("*")
        .eq("worker_id", workerId)
        .order("created_at", { ascending: false });

      if (paymentsErr) throw paymentsErr;
      setPayments(paymentsData || []);
    } catch (error) {
      console.error("Error loading worker data:", error);
      showFeedback("error", "حدث خطأ أثناء تحميل البيانات. يرجى التحديث.");
    } finally {
      setDataLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (worker) {
      loadDashboardData(worker.id);
    }
  }, [worker, loadDashboardData]);

  const showFeedback = (type: "success" | "error", text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleRefresh = async () => {
    if (!worker || refreshing) return;
    setRefreshing(true);
    await loadDashboardData(worker.id);
  };

  const startEditAccount = (account: Account) => {
    setEditingAccountId(account.id);
    setEditWalletValue(account.wallet_address || "");
    setEditAmountPaid(String(account.amount_paid || 0));
    setEditNextPayment(String(account.next_payment || 0));
    setEditHours({
      accepted: String(account.accepted_hours),
      rejected: String(account.rejected_hours),
      in_review: String(account.in_review_hours),
    });
  };

  const saveAccountDetails = async (accountId: string) => {
    if (!worker) return;
    setUpdatingId(accountId);
    try {
      const { error } = await supabase
        .from("atlas_accounts")
        .update({
          wallet_address: editWalletValue.trim(),
          accepted_hours: parseFloat(editHours.accepted) || 0,
          rejected_hours: parseFloat(editHours.rejected) || 0,
          in_review_hours: parseFloat(editHours.in_review) || 0,
          amount_paid: parseFloat(editAmountPaid) || 0,
          next_payment: parseFloat(editNextPayment) || 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", accountId);

      if (error) throw error;

      // Update state locally
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === accountId
            ? {
                ...acc,
                wallet_address: editWalletValue.trim(),
                accepted_hours: parseFloat(editHours.accepted) || 0,
                rejected_hours: parseFloat(editHours.rejected) || 0,
                in_review_hours: parseFloat(editHours.in_review) || 0,
                amount_paid: parseFloat(editAmountPaid) || 0,
                next_payment: parseFloat(editNextPayment) || 0,
              }
            : acc
        )
      );
      setEditingAccountId(null);
      showFeedback("success", "تم حفظ الساعات والمبالغ بنجاح.");
    } catch (err) {
      console.error(err);
      showFeedback("error", "فشل في حفظ البيانات. حاول مجدداً.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAddAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!worker || !newAccountForm.account_name.trim()) return;
    setUpdatingId("add-account");
    try {
      const { error } = await supabase.from("atlas_accounts").insert([
        {
          worker_id: worker.id,
          account_name: newAccountForm.account_name.trim(),
          accepted_hours: Number(newAccountForm.accepted_hours),
          rejected_hours: Number(newAccountForm.rejected_hours),
          in_review_hours: Number(newAccountForm.in_review_hours),
          wallet_address: newAccountForm.wallet_address.trim(),
          amount_paid: Number(newAccountForm.amount_paid),
        },
      ]);

      if (error) throw error;

      showFeedback("success", "تمت إضافة الحساب بنجاح.");
      setIsAddAccountOpen(false);
      setNewAccountForm({
        account_name: "",
        wallet_address: "",
        accepted_hours: 0,
        rejected_hours: 0,
        in_review_hours: 0,
        amount_paid: 0,
      });
      await loadDashboardData(worker.id);
    } catch (err) {
      console.error(err);
      showFeedback("error", "فشل في إضافة الحساب. حاول مجدداً.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleResetPayout = async (account: Account) => {
    const confirmMsg =
      "هل أنت متأكد من تصفير ساعات ومبالغ هذا الحساب؟ سيتم ترحيل هذه البيانات لسجل الدفعات التاريخي ويبدأ الحساب من الصفر.";
    if (!window.confirm(confirmMsg)) return;

    setUpdatingId(account.id);
    try {
      // 1. Create snapshot in atlas_payouts using worker's id
      const { error: payoutErr } = await supabase.from("atlas_payouts").insert([
        {
          account_id: account.id,
          worker_id: worker!.id,
          accepted_hours: account.accepted_hours,
          rejected_hours: account.rejected_hours,
          in_review_hours: account.in_review_hours,
          wallet_address: account.wallet_address || "",
          amount_paid: account.amount_paid || 0.0,
        },
      ]);

      if (payoutErr) throw payoutErr;

      // 2. Reset values in atlas_accounts
      const { error: resetErr } = await supabase
        .from("atlas_accounts")
        .update({
          accepted_hours: 0.0,
          rejected_hours: 0.0,
          in_review_hours: 0.0,
          amount_paid: 0.0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id);

      if (resetErr) throw resetErr;

      showFeedback("success", "تم تصفير الحساب بنجاح وترحيل الدفعة إلى السجل.");
      await loadDashboardData(worker!.id);
    } catch (err) {
      console.error(err);
      showFeedback("error", "فشل تصفير الحساب. حاول مجدداً.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleLogout = () => {
    try {
      sessionStorage.removeItem("worker_auth");
    } catch (e) {
      console.warn("sessionStorage delete error", e);
    }
    setWorker(null);
    setAccounts([]);
    setPayouts([]);
    setPayments([]);
  };

  const handleKeyPress = (digit: string) => {
    if (loginLoading || loginError) return;
    if (pin.length < 4) {
      setPin((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    if (loginLoading || loginError) return;
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (loginLoading || loginError) return;
    setPin("");
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
        <span className="text-sm font-medium">جاري التحقق من الجلسة...</span>
      </div>
    );
  }

  // ==================== VIEW 1: PIN LOGIN ====================
  if (!worker) {
    return (
      <PinLogin
        pin={pin}
        loginLoading={loginLoading}
        loginError={loginError}
        loginErrorMsg={loginErrorMsg}
        currentTime={currentTime}
        currentDate={currentDate}
        shakeKey={shakeKey}
        onKeyPress={handleKeyPress}
        onBackspace={handleBackspace}
        onClear={handleClear}
        onHomeClick={() => router.push("/")}
      />
    );
  }

  // ==================== VIEW 2: WORKER DASHBOARD ====================
  if (dataLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
        <span className="text-sm font-medium">جاري تحميل بيانات الموظف وسجلاته...</span>
      </div>
    );
  }

  // Compute Combined Stats
  const totalAccepted = accounts.reduce((sum, acc) => sum + acc.accepted_hours, 0);
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalExpectedEarnings = Number(
    (
      accounts.reduce((sum, acc) => sum + Number(acc.amount_paid || 0), 0) +
      payouts.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
    ).toFixed(2)
  );
  const totalOutstanding = Number((totalExpectedEarnings - totalPaid).toFixed(2));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-x-hidden selection:bg-indigo-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.06)_0,transparent_50%)] pointer-events-none" />

      {/* Navigation Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5 font-sans">
                حسابات أطلس
                <span className="text-[9px] font-semibold text-indigo-400 bg-indigo-950/50 border border-indigo-900 px-2 py-0.5 rounded-full font-mono">
                  بوابة الموظف
                </span>
              </h1>
              <p className="text-[10px] text-slate-400 font-sans">مرحباً بك، {worker.username}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={`p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-lg transition-all duration-150 ${
                refreshing ? "opacity-50" : ""
              }`}
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 px-3 py-2 rounded-lg transition-colors font-sans"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 space-y-8 z-10">
        {/* Alerts / Floating Toast Message */}
        <AnimatePresence>
          {feedbackMsg && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`fixed top-6 right-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md max-w-sm ${
                feedbackMsg.type === "success"
                  ? "bg-emerald-950/80 border-emerald-500/30 text-emerald-300 shadow-emerald-950/20"
                  : "bg-rose-950/80 border-rose-500/30 text-rose-350 shadow-rose-950/20"
              }`}
            >
              <div className={`p-1.5 rounded-lg ${
                feedbackMsg.type === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-450"
              }`}>
                <AlertCircle className="w-4 h-4 shrink-0" />
              </div>
              <div className="flex-1 text-xs font-semibold pr-2 text-right dir-rtl">
                {feedbackMsg.text}
              </div>
              <button 
                onClick={() => setFeedbackMsg(null)}
                className="text-slate-400 hover:text-white p-1 transition-colors rounded-md hover:bg-white/5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 1. Accounts Summary panel */}
        <AccountsSummary
          accounts={accounts}
          totalAccepted={totalAccepted}
          totalPaid={totalPaid}
          totalExpectedEarnings={totalExpectedEarnings}
          totalOutstanding={totalOutstanding}
        />

        {/* 2. Active accounts listing section */}
        <section className="space-y-4 font-sans">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Wallet className="w-4 h-4 text-indigo-400" />
              حسابات العمل الحالية (Accounts)
            </h3>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <button
                onClick={() => setIsAddAccountOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/20"
              >
                <Plus className="w-3.5 h-3.5 animate-pulse" />
                <span>ربط حساب جديد</span>
              </button>

              {accounts.length > 0 && (
                <div className="flex items-center bg-slate-900 border border-slate-800/80 rounded-lg p-0.5 shrink-0">
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-1.5 rounded transition-all ${
                      viewMode === "list"
                        ? "bg-indigo-600 text-white shadow-md"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="عرض خطي / جدولي"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-1.5 rounded transition-all ${
                      viewMode === "grid"
                        ? "bg-indigo-600 text-white shadow-md"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="عرض شبكي / بطاقات"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {accounts.length === 0 ? (
            <div className="bg-slate-900/20 border border-slate-900/60 rounded-2xl p-12 text-center text-slate-500">
              <AlertCircle className="w-10 h-10 mx-auto text-slate-600 mb-3" />
              <p className="text-sm">لم يتم ربط أي حسابات عمل بهذا الموظف بعد.</p>
              <p className="text-xs text-slate-600 mt-1">يرجى التواصل مع الأدمن لربط حساباتك وإدخل ساعاتك.</p>
            </div>
          ) : viewMode === "list" ? (
            <AccountsList
              accounts={accounts}
              editingAccountId={editingAccountId}
              updatingId={updatingId}
              editHours={editHours}
              setEditHours={setEditHours}
              editAmountPaid={editAmountPaid}
              setEditAmountPaid={setEditAmountPaid}
              editNextPayment={editNextPayment}
              setEditNextPayment={setEditNextPayment}
              editWalletValue={editWalletValue}
              setEditWalletValue={setEditWalletValue}
              onSave={saveAccountDetails}
              onCancel={() => setEditingAccountId(null)}
              onReset={handleResetPayout}
              onStartEdit={startEditAccount}
              payouts={payouts}
            />
          ) : (
            <AccountCard
              accounts={accounts}
              editingAccountId={editingAccountId}
              updatingId={updatingId}
              editHours={editHours}
              setEditHours={setEditHours}
              editAmountPaid={editAmountPaid}
              setEditAmountPaid={setEditAmountPaid}
              editNextPayment={editNextPayment}
              setEditNextPayment={setEditNextPayment}
              editWalletValue={editWalletValue}
              setEditWalletValue={setEditWalletValue}
              onSave={saveAccountDetails}
              onCancel={() => setEditingAccountId(null)}
              onReset={handleResetPayout}
              onStartEdit={startEditAccount}
              payouts={payouts}
            />
          )}
        </section>

        {/* 3. History Logs Section */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-900 pb-3">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              📊 سجل المعاملات والأرشيف التراكمي
            </h3>
            <div className="flex bg-slate-900 border border-slate-800/80 rounded-xl p-0.5 self-start sm:self-auto text-xs">
              <button
                onClick={() => setActiveHistoryTab("resets")}
                className={`px-4 py-2 rounded-lg font-bold transition-all ${
                  activeHistoryTab === "resets"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-405 hover:text-white"
                }`}
              >
                سجل تصفير ساعات العمل ({payouts.length})
              </button>
              <button
                onClick={() => setActiveHistoryTab("payments")}
                className={`px-4 py-2 rounded-lg font-bold transition-all ${
                  activeHistoryTab === "payments"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-405 hover:text-white"
                }`}
              >
                سجل الدفعات المستلمة ({payments.length})
              </button>
            </div>
          </div>

          {activeHistoryTab === "resets" ? (
            payouts.length === 0 ? (
              <div className="bg-slate-900/10 border border-slate-900/40 rounded-2xl p-8 text-center text-slate-500 text-xs font-sans">
                لا توجد أي عمليات تصفير ساعات مسجلة بعد.
              </div>
            ) : (
              <PayoutHistory payouts={payouts} accounts={accounts} />
            )
          ) : (
            payments.length === 0 ? (
              <div className="bg-slate-900/10 border border-slate-900/40 rounded-2xl p-8 text-center text-slate-500 text-xs font-sans">
                لا توجد أي دفعات أو مبالغ مستلمة مسجلة بعد.
              </div>
            ) : (
              <PaymentsHistory payments={payments} />
            )
          )}
        </section>
      </main>

      {/* Add Account Modal Form Dialog */}
      <AddAccountModal
        isOpen={isAddAccountOpen}
        onClose={() => setIsAddAccountOpen(false)}
        newAccountForm={newAccountForm}
        setNewAccountForm={setNewAccountForm}
        onSubmit={handleAddAccountSubmit}
        isSaving={updatingId === "add-account"}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900/60 bg-slate-950 py-6 text-center text-[10px] text-slate-505 flex flex-col items-center justify-center gap-1.5 font-sans">
        <div>بوابة حسابات وأرباح موظفي أطلس ادفينشر</div>
        <div className="text-slate-650">Atlas Helper &copy; {new Date().getFullYear()} — Production Ready</div>
      </footer>
    </div>
  );
}

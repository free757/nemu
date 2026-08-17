"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { RefreshCw, AlertCircle, Plus, Users, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

// Clean Subcomponents
import { AdminWorkerSidebar } from "./AdminWorkerSidebar";
import { AdminAccountsSection } from "./AdminAccountsSection";
import { AdminHistoryLogs } from "./AdminHistoryLogs";
import { AdminAddAccountModal } from "./AdminAddAccountModal";
import { AdminAddPaymentModal } from "./AdminAddPaymentModal";

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
  worker_id: string;
  accepted_hours: number;
  rejected_hours: number;
  in_review_hours: number;
  wallet_address: string;
  amount_paid: number;
  created_at: string;
}

interface Worker {
  id: string;
  username: string;
  pin: string;
  is_blocked: boolean;
  created_at: string;
  atlas_accounts?: Account[];
}

interface AtlasAdminPanelProps {
  lang: "ar" | "en";
  theme?: "light" | "dark";
}

export default function AtlasAdminPanel({ lang, theme }: AtlasAdminPanelProps) {
  const isDark = theme === "dark";

  // Coordinator state
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payments, setPayments] = useState<any[]>([]);


  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modals Visibility
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);

  // Helper to show float feedback toast
  const showFeedback = useCallback((type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  // Fetch all workers
  const fetchWorkers = useCallback(
    async (clearSelection = false, silent = false) => {
      if (!silent) setLoading(true);
      try {
        const { data, error } = await supabase
          .from("atlas_workers")
          .select("*, atlas_accounts(id, accepted_hours)")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setWorkers(data || []);
        if (clearSelection) {
          setSelectedWorkerId(null);
        }
      } catch (err) {
        console.error(err);
        showFeedback(
          "error",
          lang === "ar" ? "فشل تحميل قائمة الموظفين" : "Failed to load employees list"
        );
      } finally {
        setLoading(false);
      }
    },
    [lang, showFeedback]
  );

  // Fetch details for a specific worker
  const fetchWorkerDetails = useCallback(
    async (workerId: string) => {
      try {
        // Fetch accounts
        const { data: accountsData, error: accountsErr } = await supabase
          .from("atlas_accounts")
          .select("*")
          .eq("worker_id", workerId)
          .order("created_at", { ascending: true });

        if (accountsErr) throw accountsErr;
        setAccounts(accountsData || []);

        // Fetch resets
        const { data: payoutsData, error: payoutsErr } = await supabase
          .from("atlas_payouts")
          .select("*")
          .eq("worker_id", workerId)
          .order("created_at", { ascending: false });

        if (payoutsErr) throw payoutsErr;
        setPayouts(payoutsData || []);

        // Fetch payments
        const { data: paymentsData, error: paymentsErr } = await supabase
          .from("atlas_payments")
          .select("*")
          .eq("worker_id", workerId)
          .order("created_at", { ascending: false });

        if (paymentsErr) throw paymentsErr;
        setPayments(paymentsData || []);
      } catch (err) {
        console.error(err);
        showFeedback(
          "error",
          lang === "ar" ? "فشل تحميل تفاصيل حسابات الموظف" : "Failed to load worker details"
        );
      }
    },
    [lang, showFeedback]
  );

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  useEffect(() => {
    if (selectedWorkerId) {
      fetchWorkerDetails(selectedWorkerId);
    } else {
      setAccounts([]);
      setPayouts([]);
      setPayments([]);
    }
  }, [selectedWorkerId, fetchWorkerDetails]);

  // Worker Database Mutators
  const handleAddWorker = async (username: string, pin: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("atlas_workers")
        .insert([{ username, pin }]);

      if (error) throw error;
      showFeedback("success", lang === "ar" ? "تم إضافة الموظف بنجاح" : "Employee added successfully");
      await fetchWorkers(false, true);
    } catch (err) {
      console.error(err);
      showFeedback("error", lang === "ar" ? "فشل إضافة الموظف" : "Failed to add employee");
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditWorker = async (workerId: string, username: string, pin: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("atlas_workers")
        .update({ username, pin, updated_at: new Date().toISOString() })
        .eq("id", workerId);

      if (error) throw error;
      showFeedback("success", lang === "ar" ? "تم تعديل بيانات الموظف بنجاح" : "Worker details saved");
      await fetchWorkers(false, true);
    } catch (err) {
      console.error(err);
      showFeedback("error", lang === "ar" ? "فشل تعديل الموظف" : "Failed to save details");
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleBlockWorker = async (worker: Worker) => {
    const confirmMsg =
      lang === "ar"
        ? `هل أنت متأكد من ${worker.is_blocked ? "تفعيل" : "تعطيل"} حساب الموظف "${worker.username}"؟`
        : `Are you sure you want to ${worker.is_blocked ? "activate" : "block"} worker "${worker.username}"?`;
    if (!window.confirm(confirmMsg)) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("atlas_workers")
        .update({ is_blocked: !worker.is_blocked, updated_at: new Date().toISOString() })
        .eq("id", worker.id);

      if (error) throw error;
      showFeedback("success", lang === "ar" ? "تم تحديث حالة الموظف بنجاح" : "Worker status updated");
      setWorkers((prev) =>
        prev.map((w) => (w.id === worker.id ? { ...w, is_blocked: !w.is_blocked } : w))
      );
    } catch (err) {
      console.error(err);
      showFeedback("error", lang === "ar" ? "فشل تحديث حالة الموظف" : "Failed to toggle status");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteWorker = async (worker: Worker) => {
    const confirmMsg =
      lang === "ar"
        ? `تحذير: سيؤدي حذف الموظف "${worker.username}" إلى حذف جميع حساباته وسجل دفعاته نهائياً. هل أنت متأكد؟`
        : `Warning: Deleting worker "${worker.username}" will permanently delete all their accounts and payouts. Continue?`;
    if (!window.confirm(confirmMsg)) return;

    setActionLoading(true);
    try {
      const { error } = await supabase.from("atlas_workers").delete().eq("id", worker.id);
      if (error) throw error;

      showFeedback("success", lang === "ar" ? "تم حذف الموظف بنجاح" : "Worker deleted successfully");
      const isCurrentSelected = selectedWorkerId === worker.id;
      await fetchWorkers(isCurrentSelected, true);
    } catch (err) {
      console.error(err);
      showFeedback("error", lang === "ar" ? "فشل حذف الموظف" : "Failed to delete worker");
    } finally {
      setActionLoading(false);
    }
  };

  // Accounts Database Mutators
  const handleAddAccount = async (accountData: {
    account_name: string;
    wallet_address: string;
    accepted_hours: number;
    rejected_hours: number;
    in_review_hours: number;
  }) => {
    if (!selectedWorkerId) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from("atlas_accounts").insert([
        {
          worker_id: selectedWorkerId,
          ...accountData,
        },
      ]);
      if (error) throw error;

      showFeedback("success", lang === "ar" ? "تم ربط الحساب بنجاح" : "Account linked successfully");
      setIsAddAccountOpen(false);
      fetchWorkerDetails(selectedWorkerId);
      fetchWorkers(false, true);
    } catch (err) {
      console.error(err);
      showFeedback("error", lang === "ar" ? "فشل ربط الحساب" : "Failed to link account");
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateAccount = async (accountId: string, fields: any) => {
    if (!selectedWorkerId) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from("atlas_accounts").update(fields).eq("id", accountId);
      if (error) throw error;

      showFeedback("success", lang === "ar" ? "تم حفظ التعديلات بنجاح" : "Account details updated");
      fetchWorkerDetails(selectedWorkerId);
      fetchWorkers(false, true);
    } catch (err) {
      console.error(err);
      showFeedback("error", lang === "ar" ? "فشل تعديل بيانات الحساب" : "Failed to update account");
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!selectedWorkerId) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from("atlas_accounts").delete().eq("id", accountId);
      if (error) throw error;

      showFeedback("success", lang === "ar" ? "تم حذف الحساب بنجاح" : "Account deleted successfully");
      fetchWorkerDetails(selectedWorkerId);
      fetchWorkers(false, true);
    } catch (err) {
      console.error(err);
      showFeedback("error", lang === "ar" ? "فشل حذف الحساب" : "Failed to delete account");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPayout = async (account: Account) => {
    if (!selectedWorkerId) return;
    const confirmMsg =
      lang === "ar"
        ? `هل أنت متأكد من تصفير ساعات الحساب "${account.account_name}"؟ سيتم تحويل الساعات لمستحقات الأرشيف المالي.`
        : `Are you sure you want to reset work hours for "${account.account_name}"? Active hours will be logged to resets archive.`;
    if (!window.confirm(confirmMsg)) return;

    setActionLoading(true);
    try {
      const totalAmount = 0;

      // 1. Log payout archive reset
      const { error: resetErr } = await supabase.from("atlas_payouts").insert([
        {
          worker_id: selectedWorkerId,
          account_id: account.id,
          accepted_hours: account.accepted_hours,
          rejected_hours: account.rejected_hours,
          in_review_hours: account.in_review_hours,
          amount_paid: totalAmount,
          wallet_address: account.wallet_address || null,
        },
      ]);

      if (resetErr) throw resetErr;

      // 2. Clear hours resets in active account
      const { error: updateErr } = await supabase
        .from("atlas_accounts")
        .update({
          accepted_hours: 0,
          rejected_hours: 0,
          in_review_hours: 0,
        })
        .eq("id", account.id);

      if (updateErr) throw updateErr;

      showFeedback("success", lang === "ar" ? "تم تصفير الحساب بنجاح" : "Account reset completed");
      fetchWorkerDetails(selectedWorkerId);
      fetchWorkers(false, true);
    } catch (err) {
      console.error(err);
      showFeedback("error", lang === "ar" ? "فشل تصفير الحساب" : "Failed to reset hours");
    } finally {
      setActionLoading(false);
    }
  };

  // Payment Settlements Mutators
  const handleAddPayment = async (
    amount: number,
    method: string,
    wallet: string,
    notes: string,
    exchangeRate?: number,
    amountEgp?: number
  ) => {
    if (!selectedWorkerId) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from("atlas_payments").insert([
        {
          worker_id: selectedWorkerId,
          amount,
          payout_method: method,
          wallet_address: wallet.trim() || null,
          notes: notes.trim() || null,
          exchange_rate: exchangeRate || null,
          amount_egp: amountEgp || null,
        },
      ]);

      if (error) throw error;
      showFeedback("success", lang === "ar" ? "تم تسجيل الدفعة بنجاح" : "Settlement registered successfully");
      setIsAddPaymentOpen(false);
      fetchWorkerDetails(selectedWorkerId);
      fetchWorkers(false, true);
    } catch (err) {
      console.error(err);
      showFeedback("error", lang === "ar" ? "فشل تسجيل الدفعة المالية" : "Failed to log payment");
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdatePayout = async (payoutId: string, updatedFields: any) => {
    const { error } = await supabase.from("atlas_payouts").update(updatedFields).eq("id", payoutId);
    if (error) throw error;
  };

  const handleDeletePayoutDb = async (payoutId: string) => {
    const { error } = await supabase.from("atlas_payouts").delete().eq("id", payoutId);
    if (error) throw error;
  };

  const handleUpdatePayment = async (paymentId: string, updatedFields: any) => {
    const { error } = await supabase.from("atlas_payments").update(updatedFields).eq("id", paymentId);
    if (error) throw error;
  };

  const handleDeletePayment = async (paymentId: string) => {
    const { error } = await supabase.from("atlas_payments").delete().eq("id", paymentId);
    if (error) throw error;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm">
          {lang === "ar" ? "جاري تحميل نظام حسابات أطلس..." : "Loading Atlas Accounts..."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn text-right">
      {/* Toast Feedback Messages */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 right-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md max-w-sm ${
              feedback.type === "success"
                ? "bg-emerald-950/80 border-emerald-500/30 text-emerald-300 shadow-emerald-950/20"
                : "bg-rose-950/80 border-rose-500/30 text-rose-350 shadow-rose-950/20"
            }`}
          >
            <div
              className={`p-1.5 rounded-lg ${
                feedback.type === "success"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-rose-500/10 text-rose-450"
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
            </div>
            <div className="flex-1 text-xs font-semibold pr-2 text-right dir-rtl">
              {feedback.text}
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-white p-1 transition-colors rounded-md hover:bg-white/5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
        {/* 1. Left side Worker Sidebar */}
        <div className="lg:col-span-1">
          <AdminWorkerSidebar
            lang={lang}
            isDark={isDark}
            workers={workers}
            selectedWorkerId={selectedWorkerId}
            onSelectWorker={setSelectedWorkerId}
            onAddWorker={handleAddWorker}
            onEditWorker={handleEditWorker}
            onToggleBlockWorker={handleToggleBlockWorker}
            onDeleteWorker={handleDeleteWorker}
          />
        </div>

        {/* 2. Right side Selected Worker Details panel */}
        <div className="lg:col-span-4 space-y-6">
          {selectedWorkerId ? (
            (() => {
              const totalAccepted = accounts.reduce((sum, acc) => sum + Number(acc.accepted_hours || 0), 0);
              const totalEarned =
                accounts.reduce((sum, acc) => sum + Number(acc.amount_paid || 0), 0) +
                payouts.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
              const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
              const remainingBalance = totalEarned - totalPaid;

              return (
                <>
                  {/* Selected Worker Info Bar */}
                  <div
                    className={`p-6 rounded-3xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
                      isDark ? "bg-[#111] border-white/5" : "bg-white border-gray-200"
                    }`}
                  >
                    <div>
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        {workers.find((w) => w.id === selectedWorkerId)?.username || ""}
                      </h2>
                      <p className="text-xs text-gray-500 mt-1">
                        {lang === "ar"
                          ? "إدارة حسابات هذا الموظف، تعديل الساعات، وتصفير الأرصدة المستحقة."
                          : "Manage accounts, edit active hours, and log payout resets for this employee."}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3 items-center">
                        <div
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                            isDark
                              ? "bg-white/5 border-white/5 text-gray-300"
                              : "bg-gray-50 border-gray-150 text-gray-700"
                          }`}
                        >
                          {lang === "ar" ? "ساعات مقبولة: " : "Accepted Hours: "}
                          <span className="text-emerald-400 font-mono">{totalAccepted.toFixed(1)}h</span>
                        </div>

                        <div
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                            isDark
                              ? "bg-indigo-500/5 border-indigo-500/10 text-indigo-300"
                              : "bg-indigo-50/50 border-indigo-205 text-indigo-700"
                          }`}
                        >
                          {lang === "ar" ? "إجمالي الأرباح: " : "Total Earned: "}
                          <span className="text-indigo-400 font-mono">{totalEarned.toFixed(2)} USDT</span>
                        </div>

                        <div
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                            isDark
                              ? "bg-amber-500/5 border-amber-500/10 text-amber-300"
                              : "bg-amber-50/50 border-indigo-205 text-amber-700"
                          }`}
                        >
                          {lang === "ar" ? "المستلم الكلي: " : "Total Paid: "}
                          <span className="text-amber-400 font-mono">{totalPaid.toFixed(2)} USDT</span>
                        </div>

                        <div
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                            remainingBalance > 0
                              ? isDark
                                ? "bg-rose-500/5 border-rose-500/10 text-rose-300"
                                : "bg-rose-50 border-rose-200 text-rose-700"
                              : isDark
                              ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-300"
                              : "bg-emerald-50 border-emerald-200 text-emerald-700"
                          }`}
                        >
                          {lang === "ar" ? "المتبقي للموظف: " : "Owed: "}
                          <span className="font-mono">{remainingBalance.toFixed(2)} USDT</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setIsAddPaymentOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-2xl transition-all shadow-lg shadow-amber-600/25 shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{lang === "ar" ? "تسجيل دفعة مسلّمة" : "Log Payment"}</span>
                      </button>

                      <button
                        onClick={() => setIsAddAccountOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-2xl transition-all shadow-lg shadow-blue-600/25 shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{lang === "ar" ? "ربط حساب جديد" : "Link New Account"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Add Account Modal */}
                  <AdminAddAccountModal
                    isOpen={isAddAccountOpen}
                    onClose={() => setIsAddAccountOpen(false)}
                    lang={lang}
                    isDark={isDark}
                    actionLoading={actionLoading}
                    onSubmit={handleAddAccount}
                  />

                  {/* Add Payment Modal */}
                  <AdminAddPaymentModal
                    isOpen={isAddPaymentOpen}
                    onClose={() => setIsAddPaymentOpen(false)}
                    lang={lang}
                    isDark={isDark}
                    defaultWalletAddress={accounts.find((a) => a.wallet_address)?.wallet_address || ""}
                    remainingBalance={remainingBalance}
                    actionLoading={actionLoading}
                    onSubmit={handleAddPayment}
                  />

                  {/* Active Accounts List / Grid UI section */}
                  <AdminAccountsSection
                    lang={lang}
                    isDark={isDark}
                    accounts={accounts}
                    payouts={payouts}
                    actionLoading={actionLoading}
                    onUpdateAccount={handleUpdateAccount}
                    onDeleteAccount={handleDeleteAccount}
                    onResetPayout={handleResetPayout}
                  />

                  {/* History Logs & Payments Ledger section */}
                  <AdminHistoryLogs
                    lang={lang}
                    isDark={isDark}
                    workerId={selectedWorkerId}
                    accounts={accounts}
                    payouts={payouts}
                    payments={payments}
                    onRefresh={() => fetchWorkerDetails(selectedWorkerId)}
                    showFeedback={showFeedback}
                    onUpdatePayout={handleUpdatePayout}
                    onDeletePayout={handleDeletePayoutDb}
                    onUpdatePayment={handleUpdatePayment}
                    onDeletePayment={handleDeletePayment}
                  />
                </>
              );
            })()
          ) : (
            <div
              className={`p-16 text-center rounded-[2rem] border ${
                isDark ? "bg-[#111] border-white/5" : "bg-white border-gray-200"
              } flex flex-col items-center justify-center space-y-4`}
            >
              <Users className="w-12 h-12 text-gray-500" />
              <h3 className="text-xl font-bold">
                {lang === "ar" ? "اختر موظفاً للمتابعة" : "Select an Employee to Continue"}
              </h3>
              <p className="text-xs text-gray-500 max-w-sm font-medium">
                {lang === "ar"
                  ? "يرجى اختيار أحد الموظفين من القائمة الجانبية لعرض حسابات العمل الحالية، تصفير الساعات، ومتابعة سجل الدفعات."
                  : "Please select one of the employees from the sidebar list to view their accounts, perform resets, and manage payout logs."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

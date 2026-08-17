"use client";

import React, { useState } from "react";
import { History, Check, X, Edit2, Trash2, RefreshCw } from "lucide-react";

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

interface Payment {
  id: string;
  worker_id: string;
  amount: number;
  payout_method: string;
  wallet_address?: string;
  notes?: string;
  created_at: string;
  exchange_rate?: number;
  amount_egp?: number;
}

interface AdminHistoryLogsProps {
  lang: "ar" | "en";
  isDark: boolean;
  workerId: string;
  accounts: Account[];
  payouts: Payout[];
  payments: Payment[];
  onRefresh: () => void;
  showFeedback: (type: "success" | "error", text: string) => void;
  onUpdatePayout: (payoutId: string, updatedFields: any) => Promise<void>;
  onDeletePayout: (payoutId: string) => Promise<void>;
  onUpdatePayment: (paymentId: string, updatedFields: any) => Promise<void>;
  onDeletePayment: (paymentId: string) => Promise<void>;
}

export const AdminHistoryLogs: React.FC<AdminHistoryLogsProps> = ({
  lang,
  isDark,
  workerId,
  accounts,
  payouts,
  payments,
  onRefresh,
  showFeedback,
  onUpdatePayout,
  onDeletePayout,
  onUpdatePayment,
  onDeletePayment,
}) => {
  const [activeTab, setActiveTab] = useState<"resets" | "payments">("resets");
  const [actionLoading, setActionLoading] = useState(false);

  // Reset Edit States
  const [editingPayoutId, setEditingPayoutId] = useState<string | null>(null);
  const [editPayoutForm, setEditPayoutForm] = useState({
    accepted_hours: 0,
    rejected_hours: 0,
    in_review_hours: 0,
    amount_paid: 0,
    wallet_address: "",
    created_at: "",
  });

  // Payment Edit States
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editPaymentForm, setEditPaymentForm] = useState({
    amount: 0,
    payout_method: "USDT",
    wallet_address: "",
    notes: "",
    created_at: "",
    exchange_rate: 0,
    amount_egp: 0,
  });

  // Reset Actions
  const startEditingPayout = (payout: Payout) => {
    setEditingPayoutId(payout.id);
    setEditPayoutForm({
      accepted_hours: payout.accepted_hours,
      rejected_hours: payout.rejected_hours,
      in_review_hours: payout.in_review_hours,
      amount_paid: payout.amount_paid,
      wallet_address: payout.wallet_address || "",
      created_at: payout.created_at,
    });
  };

  const handleSavePayoutEdit = async (payoutId: string) => {
    setActionLoading(true);
    try {
      await onUpdatePayout(payoutId, {
        accepted_hours: Number(editPayoutForm.accepted_hours),
        rejected_hours: Number(editPayoutForm.rejected_hours),
        in_review_hours: Number(editPayoutForm.in_review_hours),
        amount_paid: Number(editPayoutForm.amount_paid),
        wallet_address: editPayoutForm.wallet_address.trim(),
        created_at: editPayoutForm.created_at,
      });

      showFeedback(
        "success",
        lang === "ar" ? "تم حفظ تعديلات التصفير بنجاح" : "Payout reset edits saved"
      );
      setEditingPayoutId(null);
      onRefresh();
    } catch (err) {
      console.error(err);
      showFeedback(
        "error",
        lang === "ar" ? "فشل تعديل سجل التصفير" : "Failed to update payout reset"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePayout = async (payoutId: string) => {
    const confirmMsg =
      lang === "ar"
        ? "هل أنت متأكد من حذف هذا السجل نهائياً؟ سيؤثر هذا على إجمالي الحسابات التراكمي."
        : "Are you sure you want to permanently delete this reset log?";
    if (!window.confirm(confirmMsg)) return;

    setActionLoading(true);
    try {
      await onDeletePayout(payoutId);

      showFeedback(
        "success",
        lang === "ar" ? "تم حذف سجل التصفير بنجاح" : "Payout reset log deleted successfully"
      );
      onRefresh();
    } catch (err) {
      console.error(err);
      showFeedback(
        "error",
        lang === "ar" ? "فشل حذف سجل التصفير" : "Failed to delete payout reset log"
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Payment Actions
  const startEditingPayment = (payment: Payment) => {
    setEditingPaymentId(payment.id);
    setEditPaymentForm({
      amount: payment.amount,
      payout_method: payment.payout_method,
      wallet_address: payment.wallet_address || "",
      notes: payment.notes || "",
      created_at: payment.created_at,
      exchange_rate: payment.exchange_rate || 0,
      amount_egp: payment.amount_egp || 0,
    });
  };

  const handleSavePaymentEdit = async (paymentId: string) => {
    setActionLoading(true);
    try {
      await onUpdatePayment(paymentId, {
        amount: Number(editPaymentForm.amount),
        payout_method: editPaymentForm.payout_method,
        wallet_address: editPaymentForm.wallet_address.trim() || null,
        notes: editPaymentForm.notes.trim() || null,
        created_at: editPaymentForm.created_at,
        exchange_rate: editPaymentForm.exchange_rate ? Number(editPaymentForm.exchange_rate) : null,
        amount_egp: editPaymentForm.amount_egp ? Number(editPaymentForm.amount_egp) : null,
      });

      showFeedback(
        "success",
        lang === "ar" ? "تم حفظ تعديلات الدفعة بنجاح" : "Payment edits saved"
      );
      setEditingPaymentId(null);
      onRefresh();
    } catch (err) {
      console.error(err);
      showFeedback(
        "error",
        lang === "ar" ? "فشل تعديل الدفعة" : "Failed to update payment details"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    const confirmMsg =
      lang === "ar"
        ? "هل أنت متأكد من حذف سجل الدفعة هذا نهائياً؟"
        : "Are you sure you want to permanently delete this payment transfer?";
    if (!window.confirm(confirmMsg)) return;

    setActionLoading(true);
    try {
      await onDeletePayment(paymentId);

      showFeedback(
        "success",
        lang === "ar" ? "تم حذف الدفعة بنجاح" : "Payment log deleted successfully"
      );
      onRefresh();
    } catch (err) {
      console.error(err);
      showFeedback("error", lang === "ar" ? "فشل حذف الدفعة" : "Failed to delete payment log");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tabs Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-900 pb-3">
        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
          <History className="w-4 h-4 text-blue-500" />
          {lang === "ar" ? "الأرشيف والسجل المالي للموظف" : "Employee Archive & Ledger"}
        </h4>
        <div
          className={`flex border rounded-xl p-0.5 self-start sm:self-auto text-[10px] font-bold ${
            isDark ? "bg-slate-900 border-white/5" : "bg-gray-100 border-gray-200"
          }`}
        >
          <button
            onClick={() => setActiveTab("resets")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "resets"
                ? "bg-blue-600 text-white shadow-md"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {lang === "ar" ? "سجل تصفير الساعات" : "Work Resets"} ({payouts.length})
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "payments"
                ? "bg-blue-600 text-white shadow-md"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {lang === "ar" ? "سجل تسليم الدفعات" : "Payments Ledger"} ({payments.length})
          </button>
        </div>
      </div>

      {activeTab === "resets" ? (
        payouts.length === 0 ? (
          <div
            className={`p-8 text-center rounded-[2rem] border italic text-xs ${
              isDark ? "bg-[#111] border-white/5 text-gray-500" : "bg-white border-gray-200 text-gray-400"
            }`}
          >
            {lang === "ar"
              ? "لا توجد دفعات أو تصفيرات مسجلة لهذا الحساب."
              : "No payout resets logged yet."}
          </div>
        ) : (
          <div
            className={`border rounded-[2rem] overflow-hidden ${
              isDark ? "bg-[#111]/40 border-white/5" : "bg-white border-gray-205 shadow-sm"
            }`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr
                    className={`border-b ${
                      isDark ? "bg-black/50 border-white/5 text-gray-400" : "bg-gray-50 border-gray-150 text-gray-500"
                    } font-bold`}
                  >
                    <th className="px-5 py-3">{lang === "ar" ? "تاريخ التصفير" : "Reset Date"}</th>
                    <th className="px-5 py-3">{lang === "ar" ? "الحساب" : "Account"}</th>
                    <th className="px-5 py-3 text-center">{lang === "ar" ? "المقبولة" : "Accepted"}</th>
                    <th className="px-5 py-3 text-center">{lang === "ar" ? "المرفوضة" : "Rejected"}</th>
                    <th className="px-5 py-3 text-center">{lang === "ar" ? "تحت المراجعة" : "In Review"}</th>
                    <th className="px-5 py-3 text-center">{lang === "ar" ? "المبلغ المستلم" : "Amount Received"}</th>
                    <th className="px-5 py-3">{lang === "ar" ? "المحفظة المستلمة" : "Received Wallet"}</th>
                    <th className="px-5 py-3 text-center">{lang === "ar" ? "إجراءات" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {payouts.map((payout) => {
                    const isEditingPayout = editingPayoutId === payout.id;

                    return (
                      <tr
                        key={payout.id}
                        className={`${
                          isDark
                            ? "hover:bg-white/5 text-gray-300 border-white/5"
                            : "hover:bg-gray-50 text-gray-700 border-gray-100"
                        }`}
                      >
                        <td className="px-5 py-3 whitespace-nowrap">
                          {isEditingPayout ? (
                            <input
                              type="datetime-local"
                              value={editPayoutForm.created_at.slice(0, 16)}
                              onChange={(e) =>
                                setEditPayoutForm((p) => ({ ...p, created_at: e.target.value }))
                              }
                              className={`text-xs px-2 py-0.5 rounded border outline-none font-bold ${
                                isDark
                                  ? "bg-slate-900 border-slate-800 text-white"
                                  : "bg-gray-50 border-gray-200 text-gray-900"
                              }`}
                            />
                          ) : (
                            new Date(payout.created_at).toLocaleDateString(
                              lang === "ar" ? "ar-EG" : "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )
                          )}
                        </td>
                        <td className="px-5 py-3 font-bold text-white">
                          {accounts.find((a) => a.id === payout.account_id)?.account_name ||
                            "Account"}
                        </td>
                        <td className="px-5 py-3 text-center">
                          {isEditingPayout ? (
                            <input
                              type="number"
                              inputMode="decimal"
                              step="any"
                              value={editPayoutForm.accepted_hours}
                              onChange={(e) =>
                                setEditPayoutForm((p) => ({
                                  ...p,
                                  accepted_hours: parseFloat(e.target.value) || 0,
                                }))
                              }
                              className="w-16 text-center bg-slate-900 border border-slate-800 rounded font-bold text-emerald-400 py-0.5 text-xs outline-none"
                            />
                          ) : (
                            <span className="font-bold text-emerald-400">
                              {payout.accepted_hours} hr
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-center">
                          {isEditingPayout ? (
                            <input
                              type="number"
                              inputMode="decimal"
                              step="any"
                              value={editPayoutForm.rejected_hours}
                              onChange={(e) =>
                                setEditPayoutForm((p) => ({
                                  ...p,
                                  rejected_hours: parseFloat(e.target.value) || 0,
                                }))
                              }
                              className="w-16 text-center bg-slate-900 border border-slate-800 rounded font-bold text-rose-400 py-0.5 text-xs outline-none"
                            />
                          ) : (
                            <span className="font-semibold text-rose-400">
                              {payout.rejected_hours} hr
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-center">
                          {isEditingPayout ? (
                            <input
                              type="number"
                              inputMode="decimal"
                              step="any"
                              value={editPayoutForm.in_review_hours}
                              onChange={(e) =>
                                setEditPayoutForm((p) => ({
                                  ...p,
                                  in_review_hours: parseFloat(e.target.value) || 0,
                                }))
                              }
                              className="w-16 text-center bg-slate-900 border border-slate-800 rounded font-bold text-amber-500 py-0.5 text-xs outline-none"
                            />
                          ) : (
                            <span className="text-amber-500">{payout.in_review_hours} hr</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-center">
                          {isEditingPayout ? (
                            <input
                              type="number"
                              inputMode="decimal"
                              step="any"
                              value={editPayoutForm.amount_paid}
                              onChange={(e) =>
                                setEditPayoutForm((p) => ({
                                  ...p,
                                  amount_paid: parseFloat(e.target.value) || 0,
                                }))
                              }
                              className="w-20 text-center bg-slate-900 border border-slate-800 rounded font-bold text-amber-500 py-0.5 text-xs outline-none"
                            />
                          ) : (
                            <span className="font-bold text-amber-400">
                              {payout.amount_paid || 0} USDT
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 font-mono text-[10px] text-gray-300">
                          {isEditingPayout ? (
                            <input
                              type="text"
                              value={editPayoutForm.wallet_address}
                              onChange={(e) =>
                                setEditPayoutForm((p) => ({ ...p, wallet_address: e.target.value }))
                              }
                              className="w-32 bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-[10px] outline-none text-white font-mono"
                            />
                          ) : (
                            payout.wallet_address || "—"
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex justify-center items-center gap-1.5">
                            {isEditingPayout ? (
                              <>
                                <button
                                  onClick={() => handleSavePayoutEdit(payout.id)}
                                  disabled={actionLoading}
                                  className="p-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded transition-all"
                                  title={lang === "ar" ? "حفظ" : "Save"}
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => setEditingPayoutId(null)}
                                  className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded transition-all"
                                  title={lang === "ar" ? "إلغاء" : "Cancel"}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEditingPayout(payout)}
                                  className="p-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 border border-blue-500/20 rounded transition-all"
                                  title={lang === "ar" ? "تعديل" : "Edit"}
                                >
                                  <Edit2 className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  onClick={() => handleDeletePayout(payout.id)}
                                  disabled={actionLoading}
                                  className="p-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded transition-all"
                                  title={lang === "ar" ? "حذف" : "Delete"}
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        payments.length === 0 ? (
          <div
            className={`p-8 text-center rounded-[2rem] border italic text-xs ${
              isDark ? "bg-[#111] border-white/5 text-gray-500" : "bg-white border-gray-200 text-gray-400"
            }`}
          >
            {lang === "ar" ? "لا توجد دفعات مستلمة مسجلة بعد." : "No payment transfers logged yet."}
          </div>
        ) : (
          <div
            className={`border rounded-[2rem] overflow-hidden ${
              isDark ? "bg-[#111]/40 border-white/5" : "bg-white border-gray-205 shadow-sm"
            }`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr
                    className={`border-b ${
                      isDark ? "bg-black/50 border-white/5 text-gray-400" : "bg-gray-50 border-gray-150 text-gray-500"
                    } font-bold`}
                  >
                    <th className="px-5 py-3">{lang === "ar" ? "تاريخ الدفعة" : "Payment Date"}</th>
                    <th className="px-5 py-3 text-center">{lang === "ar" ? "طريقة الدفع" : "Method"}</th>
                    <th className="px-5 py-3 text-center">{lang === "ar" ? "المبلغ المستلم" : "Amount Paid"}</th>
                    <th className="px-5 py-3">{lang === "ar" ? "عنوان المحفظة" : "Wallet Address"}</th>
                    <th className="px-5 py-3">{lang === "ar" ? "ملاحظات" : "Notes"}</th>
                    <th className="px-5 py-3 text-center">{lang === "ar" ? "إجراءات" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {payments.map((payment) => {
                    const isEditingPayment = editingPaymentId === payment.id;

                    return (
                      <tr
                        key={payment.id}
                        className={`${
                          isDark
                            ? "hover:bg-white/5 text-gray-300 border-white/5"
                            : "hover:bg-gray-50 text-gray-700 border-gray-100"
                        }`}
                      >
                        <td className="px-5 py-3 whitespace-nowrap">
                          {isEditingPayment ? (
                            <input
                              type="datetime-local"
                              value={editPaymentForm.created_at.slice(0, 16)}
                              onChange={(e) =>
                                setEditPaymentForm((p) => ({ ...p, created_at: e.target.value }))
                              }
                              className={`text-xs px-2 py-0.5 rounded border outline-none font-bold ${
                                isDark
                                  ? "bg-slate-900 border-slate-800 text-white"
                                  : "bg-gray-50 border-gray-200 text-gray-900"
                              }`}
                            />
                          ) : (
                            new Date(payment.created_at).toLocaleDateString(
                              lang === "ar" ? "ar-EG" : "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )
                          )}
                        </td>
                        <td className="px-5 py-3 text-center">
                          {isEditingPayment ? (
                            <select
                              value={editPaymentForm.payout_method}
                              onChange={(e) =>
                                setEditPaymentForm((p) => ({
                                  ...p,
                                  payout_method: e.target.value,
                                }))
                              }
                              className={`text-xs px-2 py-0.5 rounded border outline-none font-bold ${
                                isDark
                                  ? "bg-slate-900 border-slate-800 text-white"
                                  : "bg-gray-50 border-gray-200 text-gray-900"
                              }`}
                            >
                              <option value="USDT">USDT</option>
                              <option value="Cash">{lang === "ar" ? "نقداً (Cash)" : "Cash"}</option>
                              <option value="Other">{lang === "ar" ? "أخرى (Other)" : "Other"}</option>
                            </select>
                          ) : (
                            <span
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                                payment.payout_method === "USDT"
                                  ? "bg-blue-500/5 border-blue-500/10 text-blue-400"
                                  : "bg-emerald-500/5 border-emerald-500/10 text-emerald-400"
                              }`}
                            >
                              {payment.payout_method}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-center font-bold text-amber-400">
                          {isEditingPayment ? (
                            <div className="flex flex-col gap-1 items-center">
                              <input
                                type="number"
                                inputMode="decimal"
                                step="any"
                                placeholder="USDT"
                                value={editPaymentForm.amount || ""}
                                onChange={(e) => {
                                  const usd = parseFloat(e.target.value) || 0;
                                  setEditPaymentForm((p) => ({
                                    ...p,
                                    amount: usd,
                                    amount_egp: p.exchange_rate ? Number((usd * p.exchange_rate).toFixed(2)) : 0,
                                  }));
                                }}
                                className="w-20 text-center bg-slate-900 border border-slate-800 rounded font-bold text-amber-400 py-0.5 text-xs outline-none"
                              />
                              <div className="flex gap-1 items-center">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="any"
                                  placeholder="Rate"
                                  value={editPaymentForm.exchange_rate || ""}
                                  onChange={(e) => {
                                    const rate = parseFloat(e.target.value) || 0;
                                    setEditPaymentForm((p) => ({
                                      ...p,
                                      exchange_rate: rate,
                                      amount_egp: Number((p.amount * rate).toFixed(2)),
                                    }));
                                  }}
                                  className="w-12 text-center bg-slate-900 border border-slate-800 rounded text-[9px] text-gray-400 py-0.5 outline-none font-sans"
                                  title="Exchange Rate"
                                />
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="any"
                                  placeholder="EGP"
                                  value={editPaymentForm.amount_egp || ""}
                                  onChange={(e) => {
                                    const egp = parseFloat(e.target.value) || 0;
                                    setEditPaymentForm((p) => ({
                                      ...p,
                                      amount_egp: egp,
                                      amount: p.exchange_rate ? Number((egp / p.exchange_rate).toFixed(2)) : 0,
                                    }));
                                  }}
                                  className="w-16 text-center bg-slate-900 border border-slate-800 rounded text-[9px] text-emerald-450 py-0.5 outline-none font-sans"
                                  title="EGP Amount"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <span>{payment.amount} USDT</span>
                              {payment.amount_egp && payment.exchange_rate && (
                                <span className="text-[9px] text-gray-500 font-semibold mt-0.5 leading-none font-sans">
                                  {payment.amount_egp} EGP (@{payment.exchange_rate})
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3 font-mono text-[10px] text-gray-300">
                          {isEditingPayment ? (
                            <input
                              type="text"
                              value={editPaymentForm.wallet_address}
                              onChange={(e) =>
                                setEditPaymentForm((p) => ({ ...p, wallet_address: e.target.value }))
                              }
                              className="w-32 bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-[10px] outline-none text-white font-mono"
                            />
                          ) : (
                            payment.wallet_address || "—"
                          )}
                        </td>
                        <td className="px-5 py-3 text-gray-400 max-w-[150px] truncate">
                          {isEditingPayment ? (
                            <input
                              type="text"
                              value={editPaymentForm.notes}
                              onChange={(e) =>
                                setEditPaymentForm((p) => ({ ...p, notes: e.target.value }))
                              }
                              className="w-32 bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-[10px] outline-none text-white"
                            />
                          ) : (
                            payment.notes || "—"
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex justify-center items-center gap-1.5">
                            {isEditingPayment ? (
                              <>
                                <button
                                  onClick={() => handleSavePaymentEdit(payment.id)}
                                  disabled={actionLoading}
                                  className="p-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-450 border border-emerald-500/20 rounded transition-all"
                                  title={lang === "ar" ? "حفظ" : "Save"}
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => setEditingPaymentId(null)}
                                  className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded transition-all"
                                  title={lang === "ar" ? "إلغاء" : "Cancel"}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEditingPayment(payment)}
                                  className="p-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 border border-blue-500/20 rounded transition-all"
                                  title={lang === "ar" ? "تعديل" : "Edit"}
                                >
                                  <Edit2 className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  onClick={() => handleDeletePayment(payment.id)}
                                  disabled={actionLoading}
                                  className="p-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded transition-all"
                                  title={lang === "ar" ? "حذف" : "Delete"}
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
};

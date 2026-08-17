"use client";

import React, { useState } from "react";
import { 
  Plus, Edit2, Trash2, Check, X, RefreshCw, 
  ArrowRightLeft, AlertCircle, Coins, List, LayoutGrid, Wallet 
} from "lucide-react";

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

interface AdminAccountsSectionProps {
  lang: "ar" | "en";
  isDark: boolean;
  accounts: Account[];
  payouts: Payout[];
  actionLoading: boolean;
  onUpdateAccount: (accountId: string, fields: any) => Promise<void>;
  onDeleteAccount: (accountId: string) => Promise<void>;
  onResetPayout: (account: Account) => Promise<void>;
}

export const AdminAccountsSection: React.FC<AdminAccountsSectionProps> = ({
  lang,
  isDark,
  accounts,
  payouts,
  actionLoading,
  onUpdateAccount,
  onDeleteAccount,
  onResetPayout,
}) => {
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editAccountForm, setEditAccountForm] = useState({
    account_name: "",
    accepted_hours: "",
    rejected_hours: "",
    in_review_hours: "",
    wallet_address: "",
    amount_paid: "",
    next_payment: "",
  });

  const startEditing = (account: Account) => {
    setEditingAccountId(account.id);
    setEditAccountForm({
      account_name: account.account_name,
      accepted_hours: String(account.accepted_hours),
      rejected_hours: String(account.rejected_hours),
      in_review_hours: String(account.in_review_hours),
      wallet_address: account.wallet_address || "",
      amount_paid: String(account.amount_paid || 0),
      next_payment: String(account.next_payment || 0),
    });
  };

  const handleSave = async (accountId: string) => {
    try {
      await onUpdateAccount(accountId, {
        account_name: editAccountForm.account_name.trim(),
        accepted_hours: parseFloat(editAccountForm.accepted_hours) || 0,
        rejected_hours: parseFloat(editAccountForm.rejected_hours) || 0,
        in_review_hours: parseFloat(editAccountForm.in_review_hours) || 0,
        wallet_address: editAccountForm.wallet_address.trim(),
        amount_paid: parseFloat(editAccountForm.amount_paid) || 0,
        next_payment: parseFloat(editAccountForm.next_payment) || 0,
      });
      setEditingAccountId(null);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
          <Wallet className="w-4 h-4 text-blue-500" />
          {lang === "ar" ? "حسابات العمل وساعات العمل الحالية" : "Current Work Accounts & Hours"}
        </h4>

        {accounts.length > 0 && (
          <div className="flex items-center bg-slate-900 border border-slate-800/80 rounded-lg p-0.5 shrink-0">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded transition-all ${
                viewMode === "list"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
              title={lang === "ar" ? "عرض خطي / جدولي" : "List View"}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded transition-all ${
                viewMode === "grid"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
              title={lang === "ar" ? "عرض شبكي / بطاقات" : "Grid View"}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {accounts.length === 0 ? (
        <div
          className={`p-12 text-center rounded-[2rem] border italic text-xs ${
            isDark ? "bg-[#111] border-white/5 text-gray-500" : "bg-white border-gray-200 text-gray-400"
          }`}
        >
          {lang === "ar"
            ? "لا توجد أي حسابات مربوطة بهذا الموظف حالياً."
            : "No accounts linked to this employee yet."}
        </div>
      ) : viewMode === "list" ? (
        <div
          className={`border rounded-[2rem] overflow-hidden ${
            isDark ? "bg-[#111]/45 border-white/5" : "bg-white border-gray-205 shadow-sm"
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
                  <th className="px-5 py-3.5">{lang === "ar" ? "حساب العمل" : "Account Name"}</th>
                  <th className="px-5 py-3.5 text-center">{lang === "ar" ? "المقبولة" : "Accepted"}</th>
                  <th className="px-5 py-3.5 text-center">{lang === "ar" ? "المرفوضة" : "Rejected"}</th>
                  <th className="px-5 py-3.5 text-center">{lang === "ar" ? "المراجعة" : "Review"}</th>
                  <th className="px-5 py-3.5 text-center">{lang === "ar" ? "الإجمالي" : "Total"}</th>
                  <th className="px-5 py-3.5 text-center">{lang === "ar" ? "المبلغ المدفوع" : "Amount Paid"}</th>
                  <th className="px-5 py-3.5 text-center text-indigo-400">{lang === "ar" ? "الدفعة القادمة" : "Next Payment"}</th>
                  <th className="px-5 py-3.5">{lang === "ar" ? "المحفظة" : "Wallet"}</th>
                  <th className="px-5 py-3.5 text-center">{lang === "ar" ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {accounts.map((account) => {
                  const total = Number(
                    (account.accepted_hours + account.rejected_hours + account.in_review_hours).toFixed(2)
                  );
                  const isEditing = editingAccountId === account.id;

                  return (
                    <tr
                      key={account.id}
                      className={`${
                        isDark
                          ? "hover:bg-white/5 text-gray-300 border-white/5"
                          : "hover:bg-gray-50 text-gray-700 border-gray-100"
                      }`}
                    >
                      <td className="px-5 py-3.5 font-bold text-white whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editAccountForm.account_name}
                            onChange={(e) =>
                              setEditAccountForm((p) => ({ ...p, account_name: e.target.value }))
                            }
                            className={`px-2 py-0.5 rounded border outline-none font-bold ${
                              isDark
                                ? "bg-slate-900 border-slate-800 text-white"
                                : "bg-gray-50 border-gray-200 text-gray-900"
                            }`}
                          />
                        ) : (
                          account.account_name
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            value={editAccountForm.accepted_hours}
                            onChange={(e) =>
                              setEditAccountForm((p) => ({
                                ...p,
                                accepted_hours: e.target.value,
                              }))
                            }
                            className="w-16 text-center bg-slate-900 border border-slate-800 rounded font-bold text-emerald-400 py-0.5 text-xs outline-none"
                          />
                        ) : (
                          <span className="text-emerald-400 font-bold">{account.accepted_hours} hr</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            value={editAccountForm.rejected_hours}
                            onChange={(e) =>
                              setEditAccountForm((p) => ({
                                ...p,
                                rejected_hours: e.target.value,
                              }))
                            }
                            className="w-16 text-center bg-slate-900 border border-slate-800 rounded font-bold text-rose-400 py-0.5 text-xs outline-none"
                          />
                        ) : (
                          <span className="text-rose-455 font-medium">{account.rejected_hours} hr</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            value={editAccountForm.in_review_hours}
                            onChange={(e) =>
                              setEditAccountForm((p) => ({
                                ...p,
                                in_review_hours: e.target.value,
                              }))
                            }
                            className="w-16 text-center bg-slate-900 border border-slate-800 rounded font-bold text-amber-500 py-0.5 text-xs outline-none"
                          />
                        ) : (
                          <span className="text-amber-400 font-bold">{account.in_review_hours} hr</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center font-bold text-gray-300">
                        {total} hr
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            value={editAccountForm.amount_paid}
                            onChange={(e) =>
                              setEditAccountForm((p) => ({ ...p, amount_paid: e.target.value }))
                            }
                            className={`text-center rounded border outline-none w-24 py-0.5 text-xs ${
                              isDark
                                ? "bg-slate-900 border-slate-800 text-white"
                                : "bg-gray-50 border-gray-200 text-gray-900"
                            }`}
                          />
                        ) : (
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-amber-500">{account.amount_paid || 0} USDT</span>
                            {payouts.filter((p) => p.account_id === account.id).reduce((sum, p) => sum + Number(p.amount_paid || 0), 0) > 0 && (
                              <span className="text-[8.5px] text-gray-500 font-semibold block mt-0.5 leading-none">
                                {lang === "ar" ? "الكل: " : "Total: "}
                                {(
                                  (account.amount_paid || 0) +
                                  payouts.filter((p) => p.account_id === account.id).reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
                                ).toFixed(2)}{" "}
                                USDT
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center text-indigo-400 font-bold whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            value={editAccountForm.next_payment}
                            onChange={(e) =>
                              setEditAccountForm((p) => ({ ...p, next_payment: e.target.value }))
                            }
                            className={`text-center rounded border outline-none w-20 py-0.5 text-xs ${
                              isDark
                                ? "bg-slate-900 border-slate-800 text-white"
                                : "bg-gray-50 border-gray-200 text-gray-900"
                            }`}
                          />
                        ) : (
                          <span>{account.next_payment || 0} USDT</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[10px] text-gray-300">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editAccountForm.wallet_address}
                            onChange={(e) =>
                              setEditAccountForm((p) => ({ ...p, wallet_address: e.target.value }))
                            }
                            className={`px-2 py-0.5 rounded border outline-none text-[10px] ${
                              isDark
                                ? "bg-slate-900 border-slate-800 text-white"
                                : "bg-gray-50 border-gray-200 text-gray-900"
                            }`}
                          />
                        ) : (
                          account.wallet_address || "—"
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-center items-center gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSave(account.id)}
                                disabled={actionLoading}
                                className="p-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded transition-all"
                                title={lang === "ar" ? "حفظ" : "Save"}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingAccountId(null)}
                                className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded transition-all"
                                title={lang === "ar" ? "إلغاء" : "Cancel"}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => onResetPayout(account)}
                                disabled={actionLoading}
                                className="px-2.5 py-1 bg-amber-600/10 hover:bg-amber-600/20 text-amber-500 border border-amber-500/20 rounded-lg transition-all font-bold text-[10px]"
                              >
                                {lang === "ar" ? "تصفير الساعات" : "Reset Hours"}
                              </button>
                              <button
                                onClick={() => startEditing(account)}
                                className="p-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 border border-blue-500/20 rounded transition-all"
                                title={lang === "ar" ? "تعديل" : "Edit"}
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => {
                                  const confirmMsg =
                                    lang === "ar"
                                      ? "تحذير: سيتم حذف هذا الحساب نهائياً مع كافة سجلاته. هل أنت متأكد؟"
                                      : "Warning: Permanently delete this account? This cannot be undone.";
                                  if (window.confirm(confirmMsg)) {
                                    onDeleteAccount(account.id);
                                  }
                                }}
                                disabled={actionLoading}
                                className="p-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded transition-all"
                                title={lang === "ar" ? "حذف الحساب" : "Delete Account"}
                              >
                                <Trash2 className="w-3 h-3" />
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {accounts.map((account) => {
            const total = Number(
              (account.accepted_hours + account.rejected_hours + account.in_review_hours).toFixed(2)
            );
            const isEditing = editingAccountId === account.id;
            const resetsSum = payouts
              .filter((p) => p.account_id === account.id)
              .reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);

            return (
              <div
                key={account.id}
                className={`p-5 rounded-3xl border flex flex-col justify-between transition-all ${
                  isDark ? "bg-[#111] border-white/5" : "bg-white border-gray-200 shadow-sm"
                }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-4">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editAccountForm.account_name}
                        onChange={(e) =>
                          setEditAccountForm((p) => ({ ...p, account_name: e.target.value }))
                        }
                        className={`px-2 py-1 rounded border outline-none font-bold text-sm w-36 ${
                          isDark
                            ? "bg-slate-900 border-slate-800 text-white"
                            : "bg-gray-50 border-gray-205 text-gray-900"
                        }`}
                      />
                    ) : (
                      <h5 className="font-bold text-white text-sm">{account.account_name}</h5>
                    )}

                    <div className="flex items-center gap-1.5">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleSave(account.id)}
                            disabled={actionLoading}
                            className="p-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded transition-all"
                            title={lang === "ar" ? "حفظ" : "Save"}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingAccountId(null)}
                            className="p-1 bg-slate-850 hover:bg-slate-800 text-slate-400 rounded transition-all"
                            title={lang === "ar" ? "إلغاء" : "Cancel"}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => onResetPayout(account)}
                            disabled={actionLoading}
                            className="px-2 py-1 bg-amber-600/10 hover:bg-amber-600/20 text-amber-505 border border-amber-500/20 rounded-lg transition-all font-bold text-[9px]"
                          >
                            {lang === "ar" ? "تصفير" : "Reset"}
                          </button>
                          <button
                            onClick={() => startEditing(account)}
                            className="p-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 border border-blue-500/20 rounded transition-all"
                            title={lang === "ar" ? "تعديل" : "Edit"}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              const confirmMsg =
                                lang === "ar"
                                  ? "تحذير: سيتم حذف هذا الحساب نهائياً مع كافة سجلاته. هل أنت متأكد؟"
                                  : "Warning: Permanently delete this account? This cannot be undone.";
                              if (window.confirm(confirmMsg)) {
                                onDeleteAccount(account.id);
                              }
                            }}
                            disabled={actionLoading}
                            className="p-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded transition-all"
                            title={lang === "ar" ? "حذف الحساب" : "Delete Account"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-4 text-xs font-semibold">
                    <div className={`p-2 rounded-xl text-center ${isDark ? "bg-black/45" : "bg-gray-50"}`}>
                      <span className="block text-[9px] text-gray-500 mb-1">
                        {lang === "ar" ? "المقبولة" : "Accepted"}
                      </span>
                      {isEditing ? (
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          value={editAccountForm.accepted_hours}
                          onChange={(e) =>
                            setEditAccountForm((p) => ({
                              ...p,
                              accepted_hours: e.target.value,
                            }))
                          }
                          className="w-full text-center bg-slate-900 border border-slate-800 rounded font-bold text-white py-0.5 text-xs outline-none"
                        />
                      ) : (
                        <span className="text-emerald-400 font-bold">{account.accepted_hours}h</span>
                      )}
                    </div>

                    <div className={`p-2 rounded-xl text-center ${isDark ? "bg-black/45" : "bg-gray-50"}`}>
                      <span className="block text-[9px] text-gray-500 mb-1">
                        {lang === "ar" ? "المرفوضة" : "Rejected"}
                      </span>
                      {isEditing ? (
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          value={editAccountForm.rejected_hours}
                          onChange={(e) =>
                            setEditAccountForm((p) => ({
                              ...p,
                              rejected_hours: e.target.value,
                            }))
                          }
                          className="w-full text-center bg-slate-900 border border-slate-800 rounded font-bold text-white py-0.5 text-xs outline-none"
                        />
                      ) : (
                        <span className="text-rose-405 font-bold">{account.rejected_hours}h</span>
                      )}
                    </div>

                    <div className={`p-2 rounded-xl text-center ${isDark ? "bg-black/45" : "bg-gray-50"}`}>
                      <span className="block text-[9px] text-gray-500 mb-1">
                        {lang === "ar" ? "المراجعة" : "Review"}
                      </span>
                      {isEditing ? (
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          value={editAccountForm.in_review_hours}
                          onChange={(e) =>
                            setEditAccountForm((p) => ({
                              ...p,
                              in_review_hours: e.target.value,
                            }))
                          }
                          className="w-full text-center bg-slate-900 border border-slate-800 rounded font-bold text-white py-0.5 text-xs outline-none"
                        />
                      ) : (
                        <span className="text-amber-400 font-bold">{account.in_review_hours}h</span>
                      )}
                    </div>

                    <div className={`p-2 rounded-xl text-center ${isDark ? "bg-black/45" : "bg-gray-50"}`}>
                      <span className="block text-[9px] text-gray-500 mb-1">
                        {lang === "ar" ? "الإجمالي" : "Total"}
                      </span>
                      <span className="text-gray-300 font-bold">{total}h</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-3.5 mb-4 space-y-2 text-xs">
                    <div className="flex justify-between items-center font-semibold">
                      <span className="text-gray-400 flex items-center gap-1">
                        <Coins className="w-3.5 h-3.5 text-amber-500" />
                        {lang === "ar" ? "المستلم المباشر من الحساب:" : "Direct Recv Amount:"}
                      </span>
                      {isEditing ? (
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          value={editAccountForm.amount_paid}
                          onChange={(e) =>
                            setEditAccountForm((p) => ({ ...p, amount_paid: e.target.value }))
                          }
                          className={`text-center rounded border outline-none w-28 py-1 text-xs ${
                            isDark
                              ? "bg-slate-900 border-slate-800 text-white"
                              : "bg-gray-50 border-gray-205 text-gray-905"
                          }`}
                        />
                      ) : (
                        <div className="text-left font-bold text-amber-500">
                          {account.amount_paid || 0} USDT
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center font-semibold">
                      <span className="text-gray-400 flex items-center gap-1">
                        <Coins className="w-3.5 h-3.5 text-indigo-400" />
                        {lang === "ar" ? "الدفعة القادمة:" : "Next Payment:"}
                      </span>
                      {isEditing ? (
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          value={editAccountForm.next_payment}
                          onChange={(e) =>
                            setEditAccountForm((p) => ({ ...p, next_payment: e.target.value }))
                          }
                          className={`text-center rounded border outline-none w-28 py-1 text-xs ${
                            isDark
                              ? "bg-slate-900 border-slate-800 text-white"
                              : "bg-gray-50 border-gray-205 text-gray-905"
                          }`}
                        />
                      ) : (
                        <div className="text-left font-bold text-indigo-400">
                          {account.next_payment || 0} USDT
                        </div>
                      )}
                    </div>

                    {resetsSum > 0 && (
                      <div className="flex justify-between items-center font-semibold">
                        <span className="text-gray-400 flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5 text-amber-450" />
                          {lang === "ar" ? "دفعات تصفير سابقة:" : "Resets Payouts Sum:"}
                        </span>
                        <span className="font-bold text-amber-400">{resetsSum.toFixed(2)} USDT</span>
                      </div>
                    )}

                    <div className="h-px bg-white/5 my-1" />

                    <div className="flex justify-between items-center font-semibold">
                      <span className="text-gray-400 flex items-center gap-1">
                        <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-450" />
                        {lang === "ar" ? "إجمالي المستلم الكلي:" : "Grand Total Received:"}
                      </span>
                      <span className="font-bold text-emerald-400">
                        {((account.amount_paid || 0) + resetsSum).toFixed(2)} USDT
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-3 space-y-1.5">
                  <span className="block text-[10px] text-gray-500 font-semibold">
                    {lang === "ar" ? "عنوان محفظة الدفع" : "USDT Payout Wallet"}
                  </span>
                  {isEditing ? (
                    <input
                      type="text"
                      placeholder="USDT Wallet Address"
                      value={editAccountForm.wallet_address}
                      onChange={(e) =>
                        setEditAccountForm((p) => ({ ...p, wallet_address: e.target.value }))
                      }
                      className={`w-full px-2.5 py-1.5 rounded border text-[11px] outline-none ${
                        isDark
                          ? "bg-slate-900 border-slate-800 text-white"
                          : "bg-gray-50 border-gray-200 text-gray-909"
                      }`}
                    />
                  ) : (
                    <div className="font-mono text-[10px] break-all bg-black/30 border border-white/5 rounded-lg px-2.5 py-1.5 text-gray-400 font-mono">
                      {account.wallet_address || (
                        <span className="text-gray-650 italic">
                          {lang === "ar" ? "لا يوجد محفظة مسجلة" : "No wallet registered"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

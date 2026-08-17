"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  ArrowRightLeft,
  Edit2,
  CheckCircle2,
  XCircle,
  Clock,
  Coins,
  Wallet,
  Check,
  X,
  RefreshCw,
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

interface AccountCardProps {
  accounts: Account[];
  editingAccountId: string | null;
  updatingId: string | null;
  editHours: { accepted: string; rejected: string; in_review: string };
  setEditHours: React.Dispatch<
    React.SetStateAction<{ accepted: string; rejected: string; in_review: string }>
  >;
  editAmountPaid: string;
  setEditAmountPaid: (val: string) => void;
  editNextPayment: string;
  setEditNextPayment: (val: string) => void;
  editWalletValue: string;
  setEditWalletValue: (val: string) => void;
  onSave: (id: string) => void;
  onCancel: () => void;
  onReset: (acc: Account) => void;
  onStartEdit: (acc: Account) => void;
  payouts?: any[];
}

export const AccountCard: React.FC<AccountCardProps> = ({
  accounts,
  editingAccountId,
  updatingId,
  editHours,
  setEditHours,
  editAmountPaid,
  setEditAmountPaid,
  editNextPayment,
  setEditNextPayment,
  editWalletValue,
  setEditWalletValue,
  onSave,
  onCancel,
  onReset,
  onStartEdit,
  payouts,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-sans">
      {accounts.map((account) => {
        const totalHours = Number(
          (
            account.accepted_hours +
            account.rejected_hours +
            account.in_review_hours
          ).toFixed(2)
        );
        const isEditing = editingAccountId === account.id;
        const isUpdating = updatingId === account.id;
        const resetsSum = payouts
          ? payouts
              .filter((p) => p.account_id === account.id)
              .reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
          : 0;

        return (
          <motion.div
            key={account.id}
            layout
            className="bg-slate-900/40 backdrop-blur border border-slate-850 hover:border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-lg relative"
          >
            {/* Header of Card */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="text-sm font-bold text-white">{account.account_name}</h4>
                <span className="text-[9px] text-slate-500">مُعرّف: {account.id.substring(0, 8)}...</span>
              </div>
              <div className="flex items-center gap-1.5">
                {!isEditing && (
                  <>
                    <button
                      onClick={() => onReset(account)}
                      className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1"
                      title="تصفير الحساب وترحيل الدفعة"
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                      <span>تصفير</span>
                    </button>
                    <button
                      onClick={() => onStartEdit(account)}
                      className="px-2.5 py-1 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>تعديل</span>
                    </button>
                  </>
                )}
                <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-semibold text-indigo-400">
                  Atlas
                </span>
              </div>
            </div>

            {/* Stats Layout */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-950/60 border border-slate-900/60 rounded-xl p-2.5 text-center">
                <span className="block text-[9px] text-slate-500 font-semibold mb-1.5 flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  المقبولة
                </span>
                {isEditing ? (
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={editHours.accepted}
                    onChange={(e) =>
                      setEditHours((prev) => ({ ...prev, accepted: e.target.value }))
                    }
                    className="w-full text-center bg-slate-900 border border-slate-800 rounded font-bold text-white py-1 text-xs outline-none focus:border-indigo-500"
                  />
                ) : (
                  <span className="text-sm font-bold text-emerald-400">{account.accepted_hours} hr</span>
                )}
              </div>

              <div className="bg-slate-950/60 border border-slate-900/60 rounded-xl p-2.5 text-center">
                <span className="block text-[9px] text-slate-500 font-semibold mb-1.5 flex items-center justify-center gap-1">
                  <XCircle className="w-3 h-3 text-rose-400" />
                  المرفوضة
                </span>
                {isEditing ? (
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={editHours.rejected}
                    onChange={(e) =>
                      setEditHours((prev) => ({ ...prev, rejected: e.target.value }))
                    }
                    className="w-full text-center bg-slate-900 border border-slate-800 rounded font-bold text-white py-1 text-xs outline-none focus:border-indigo-500"
                  />
                ) : (
                  <span className="text-sm font-bold text-rose-400">{account.rejected_hours} hr</span>
                )}
              </div>

              <div className="bg-slate-950/60 border border-slate-900/60 rounded-xl p-2.5 text-center">
                <span className="block text-[9px] text-slate-500 font-semibold mb-1.5 flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  المراجعة
                </span>
                {isEditing ? (
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={editHours.in_review}
                    onChange={(e) =>
                      setEditHours((prev) => ({ ...prev, in_review: e.target.value }))
                    }
                    className="w-full text-center bg-slate-900 border border-slate-800 rounded font-bold text-white py-1 text-xs outline-none focus:border-indigo-500"
                  />
                ) : (
                  <span className="text-sm font-bold text-amber-400">{account.in_review_hours} hr</span>
                )}
              </div>

              <div className="bg-slate-950/60 border border-slate-900/60 rounded-xl p-2.5 text-center">
                <span className="block text-[9px] text-slate-500 font-semibold mb-1.5">الإجمالي</span>
                <span className="text-sm font-bold text-slate-200">{totalHours} hr</span>
              </div>
            </div>

            {/* Expected Earnings & Payout Breakdown Section */}
            <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3.5 mb-4 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-semibold flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-amber-500" />
                  المستلم المباشر من الحساب:
                </span>
                {isEditing ? (
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={editAmountPaid}
                    onChange={(e) => setEditAmountPaid(e.target.value)}
                    className="w-24 text-center bg-slate-900 border border-slate-850 focus:border-indigo-500 rounded font-bold text-white py-1 text-xs outline-none"
                  />
                ) : (
                  <span className="font-bold text-amber-400 text-sm">{account.amount_paid || 0} USDT</span>
                )}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-semibold flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-indigo-400" />
                  الدفعة القادمة:
                </span>
                {isEditing ? (
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={editNextPayment}
                    onChange={(e) => setEditNextPayment(e.target.value)}
                    className="w-24 text-center bg-slate-900 border border-slate-850 focus:border-indigo-500 rounded font-bold text-white py-1 text-xs outline-none"
                  />
                ) : (
                  <span className="font-bold text-indigo-400 text-sm">{account.next_payment || 0} USDT</span>
                )}
              </div>

              {resetsSum > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-semibold flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-indigo-400" />
                    دفعات تصفير سابقة:
                  </span>
                  <span className="font-bold text-indigo-400 text-sm">
                    {resetsSum.toFixed(2)} USDT
                  </span>
                </div>
              )}

              <div className="h-px bg-slate-900 my-1" />

              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-semibold flex items-center gap-1">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-450" />
                  إجمالي المستلم الكلي:
                </span>
                <span className="font-bold text-emerald-400 text-sm">
                  {((account.amount_paid || 0) + resetsSum).toFixed(2)} USDT
                </span>
              </div>
            </div>

            {/* Wallet Address section */}
            <div className="mt-auto border-t border-slate-800/80 pt-4 space-y-2">
              <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                <Wallet className="w-3 h-3 text-indigo-400" />
                عنوان محفظة الدفع الخاصة بك
              </span>

              {isEditing ? (
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    value={editWalletValue}
                    onChange={(e) => setEditWalletValue(e.target.value)}
                    disabled={isUpdating}
                    placeholder="أدخل عنوان USDT"
                    className="flex-1 text-xs bg-slate-950 border border-slate-800 focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none transition-all placeholder:text-slate-700"
                  />
                  <button
                    onClick={() => onSave(account.id)}
                    disabled={isUpdating}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg p-2 transition-colors flex items-center justify-center w-8 h-8 flex-shrink-0"
                    title="حفظ"
                  >
                    {isUpdating ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={onCancel}
                    disabled={isUpdating}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg p-2 transition-colors flex items-center justify-center w-8 h-8 flex-shrink-0"
                    title="إلغاء"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="text-xs bg-slate-950/40 border border-slate-900/80 rounded-lg px-3 py-2 text-slate-300 font-mono break-all leading-relaxed">
                  {account.wallet_address || (
                    <span className="text-slate-600 italic">لا يوجد عنوان محفظة مسجل</span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

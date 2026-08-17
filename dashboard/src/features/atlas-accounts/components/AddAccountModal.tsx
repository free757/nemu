"use client";

import React from "react";
import { X, Save } from "lucide-react";

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  newAccountForm: {
    account_name: string;
    wallet_address: string;
    accepted_hours: number;
    rejected_hours: number;
    in_review_hours: number;
    amount_paid: number;
  };
  setNewAccountForm: React.Dispatch<
    React.SetStateAction<{
      account_name: string;
      wallet_address: string;
      accepted_hours: number;
      rejected_hours: number;
      in_review_hours: number;
      amount_paid: number;
    }>
  >;
  onSubmit: (e: React.FormEvent) => void;
  isSaving: boolean;
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({
  isOpen,
  onClose,
  newAccountForm,
  setNewAccountForm,
  onSubmit,
  isSaving,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 font-sans">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative z-10 animate-scale-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-base font-bold text-white mb-2">ربط حساب عمل جديد</h3>
        <p className="text-xs text-slate-400 mb-5 leading-relaxed font-sans">
          أدخل اسم الحساب، والمحفظة، والساعات المسجلة حالياً لربطه ببوابة حسابات الموظف
        </p>

        <form onSubmit={onSubmit} className="space-y-4 text-right text-xs">
          <div className="space-y-1">
            <label className="block text-[10px] text-slate-400 font-semibold">اسم الحساب (مستلزم)</label>
            <input
              type="text"
              value={newAccountForm.account_name}
              onChange={(e) =>
                setNewAccountForm((p) => ({ ...p, account_name: e.target.value }))
              }
              placeholder="مثال: jack_smith_92"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500/80 rounded-xl text-slate-100 placeholder-slate-700 outline-none text-left"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] text-slate-400 font-semibold">محفظة USDT للمدفوعات</label>
            <input
              type="text"
              value={newAccountForm.wallet_address}
              onChange={(e) =>
                setNewAccountForm((p) => ({ ...p, wallet_address: e.target.value }))
              }
              placeholder="Txxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500/80 rounded-xl text-slate-100 placeholder-slate-700 outline-none text-left font-mono"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-[10px] text-emerald-450 font-semibold">ساعات مقبولة</label>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={newAccountForm.accepted_hours}
                onChange={(e) =>
                  setNewAccountForm((p) => ({
                    ...p,
                    accepted_hours: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-center font-bold text-emerald-400"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] text-rose-400 font-semibold">ساعات مرفوضة</label>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={newAccountForm.rejected_hours}
                onChange={(e) =>
                  setNewAccountForm((p) => ({
                    ...p,
                    rejected_hours: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-center font-bold text-rose-450"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] text-amber-500 font-semibold">ساعات مراجعة</label>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={newAccountForm.in_review_hours}
                onChange={(e) =>
                  setNewAccountForm((p) => ({
                    ...p,
                    in_review_hours: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-center font-bold text-amber-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] text-slate-400 font-semibold">المبالغ المستلمة للتسويات</label>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={newAccountForm.amount_paid}
              onChange={(e) =>
                setNewAccountForm((p) => ({
                  ...p,
                  amount_paid: parseFloat(e.target.value) || 0,
                }))
              }
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500/80 rounded-xl text-slate-100 placeholder-slate-700 outline-none text-left"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-500/10 mt-6"
          >
            {isSaving ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>حفظ الحساب وتنشيطه</span>
          </button>
        </form>
      </div>
    </div>
  );
};

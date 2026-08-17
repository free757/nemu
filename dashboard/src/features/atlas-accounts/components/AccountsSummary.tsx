"use client";

import React from "react";
import { CheckCircle2, Wallet, Coins, ArrowRightLeft } from "lucide-react";

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

interface AccountsSummaryProps {
  accounts: Account[];
  totalAccepted: number;
  totalPaid: number;
  totalExpectedEarnings: number;
  totalOutstanding: number;
}

export const AccountsSummary: React.FC<AccountsSummaryProps> = ({
  accounts,
  totalAccepted,
  totalPaid,
  totalExpectedEarnings,
  totalOutstanding,
}) => {
  const totalNextPayment = accounts.reduce((sum, acc) => sum + Number(acc.next_payment || 0), 0);

  return (
    <div className="space-y-6">
      {/* Configuration & General Summary bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/30 border border-slate-900 rounded-2xl p-6">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            💡 ملخص حساب الموظف
          </h2>
          <p className="text-xs text-slate-400 font-sans">
            تابع ساعات عملك المسجلة، وأدخل المبالغ المستلمة من المنصة، والمحفظة الخاصة بك.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs bg-slate-950/60 border border-slate-900 rounded-xl px-4 py-3 w-full md:w-auto justify-between md:justify-end">
          <div className="text-right">
            <span className="block text-[10px] text-slate-500 font-semibold">الحسابات المفعلة</span>
            <span className="text-sm font-bold text-white">{accounts.length}</span>
          </div>
          <div className="w-px h-8 bg-slate-800 hidden sm:block" />
          <div className="text-right">
            <span className="block text-[10px] text-indigo-400 font-bold">إجمالي الدفعة القادمة</span>
            <span className="text-sm font-bold text-indigo-400">{totalNextPayment.toFixed(2)} USDT</span>
          </div>
          <div className="w-px h-8 bg-slate-800 hidden sm:block" />
          <div className="text-right">
            <span className="block text-[10px] text-slate-500 font-semibold">حالة الحساب</span>
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-900 px-2 py-0.5 rounded-full">نشط</span>
          </div>
        </div>
      </div>

      {/* Financial Summary Stats Cards Grid */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-4 flex items-center gap-3.5 shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] text-slate-500 font-semibold">المقبولة (الكل)</span>
              <span className="text-base font-bold text-emerald-400">{totalAccepted} hr</span>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-4 flex items-center gap-3.5 shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 flex-shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] text-slate-500 font-semibold">المبالغ المستلمة</span>
              <span className="text-base font-bold text-amber-400">{totalPaid} USDT</span>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-4 flex items-center gap-3.5 shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] text-slate-500 font-semibold">الأرباح المستحقة</span>
              <span className="text-base font-bold text-indigo-400">{totalExpectedEarnings} USDT</span>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-4 flex items-center gap-3.5 shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-450 flex-shrink-0">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] text-slate-500 font-semibold">المستحقات المتبقية</span>
              <span className={`text-base font-bold ${totalOutstanding > 0 ? "text-emerald-450" : "text-slate-500"}`}>
                {totalOutstanding} USDT
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

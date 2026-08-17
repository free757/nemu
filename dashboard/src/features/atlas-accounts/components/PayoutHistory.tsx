"use client";

import React from "react";

interface Payout {
  id: string;
  account_id: string;
  amount_paid: number;
  wallet_address: string;
  timestamp: string;
}

interface Account {
  id: string;
  account_name: string;
  next_payment?: number;
}

interface PayoutHistoryProps {
  payouts: Payout[];
  accounts: Account[];
}

export const PayoutHistory: React.FC<PayoutHistoryProps> = ({ payouts, accounts }) => {
  const accountMap = new Map(accounts.map((a) => [a.id, a.account_name]));

  return (
    <div className="bg-slate-900/30 border border-slate-900/80 rounded-2xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto font-sans">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="bg-slate-950/80 border-b border-slate-900 text-slate-400 font-semibold">
              <th className="px-5 py-3.5">تاريخ المعاملة</th>
              <th className="px-5 py-3.5">اسم الحساب</th>
              <th className="px-5 py-3.5 text-center">المبلغ المستلم</th>
              <th className="px-5 py-3.5">محفظة الاستلام</th>
              <th className="px-5 py-3.5 text-center">نوع العملية</th>
              <th className="px-5 py-3.5 text-center">حالة الدفعة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900/60">
            {payouts.map((payout) => {
              const accountName = accountMap.get(payout.account_id) || "حساب محذوف";
              return (
                <tr
                  key={payout.id}
                  className="hover:bg-slate-900/20 transition-colors text-slate-350"
                >
                  <td className="px-5 py-3.5 text-slate-400 whitespace-nowrap">
                    {new Date(payout.timestamp).toLocaleDateString("ar-EG", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-5 py-3.5 font-bold text-white whitespace-nowrap">
                    {accountName}
                  </td>
                  <td className="px-5 py-3.5 text-center font-bold text-emerald-400 whitespace-nowrap">
                    +{payout.amount_paid} USDT
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[11px] text-slate-400 break-all select-all">
                    {payout.wallet_address || "تم تصفير مباشر بدون محفظة"}
                  </td>
                  <td className="px-5 py-3.5 text-center text-[10px] font-semibold text-slate-400">
                    ترحيل دفعة وتصفير ساعات
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-900/40 text-[9px] font-semibold text-emerald-400">
                      مكتملة
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

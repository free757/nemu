"use client";

import React from "react";

interface Payment {
  id: string;
  amount: number;
  payout_method: string;
  wallet_address?: string;
  notes?: string;
  created_at: string;
  exchange_rate?: number;
  amount_egp?: number;
}

interface PaymentsHistoryProps {
  payments: Payment[];
}

export const PaymentsHistory: React.FC<PaymentsHistoryProps> = ({ payments }) => {
  return (
    <div className="bg-slate-900/30 border border-slate-900/80 rounded-2xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto font-sans">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="bg-slate-950/80 border-b border-slate-900 text-slate-400 font-semibold">
              <th className="px-5 py-3.5">تاريخ الدفعة</th>
              <th className="px-5 py-3.5 text-center">القيمة المستلمة</th>
              <th className="px-5 py-3.5 text-center">طريقة الدفع</th>
              <th className="px-5 py-3.5">محفظة الاستلام</th>
              <th className="px-5 py-3.5">ملاحظات / المعاملة</th>
              <th className="px-5 py-3.5 text-center">حالة العملية</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900/60">
            {payments.map((payment) => {
              return (
                <tr
                  key={payment.id}
                  className="hover:bg-slate-900/20 transition-colors text-slate-350"
                >
                  <td className="px-5 py-3.5 text-slate-400 whitespace-nowrap">
                    {new Date(payment.created_at).toLocaleDateString("ar-EG", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-5 py-3.5 text-center font-bold text-amber-400 whitespace-nowrap">
                    <div className="flex flex-col items-center">
                      <span>{payment.amount} USDT</span>
                      {payment.amount_egp && payment.exchange_rate && (
                        <span className="text-[9px] text-slate-500 font-semibold mt-0.5 leading-none">
                          {payment.amount_egp} EGP (@{payment.exchange_rate})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-center font-bold text-slate-200">
                    {payment.payout_method === "USDT" 
                      ? "USDT" 
                      : payment.payout_method === "Cash" 
                      ? "نقداً (Cash)" 
                      : payment.payout_method}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[11px] text-slate-400 break-all select-all">
                    {payment.wallet_address || "—"}
                  </td>
                  <td className="px-5 py-3.5 text-slate-400 max-w-xs truncate" title={payment.notes}>
                    {payment.notes || "—"}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-900/40 text-[9px] font-semibold text-emerald-400">
                      مستلمة
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

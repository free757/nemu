"use client";

import React from "react";
import { RefreshCw, Check, X, ArrowRightLeft, Edit2 } from "lucide-react";

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

interface AccountsListProps {
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

export const AccountsList: React.FC<AccountsListProps> = ({
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
    <div className="bg-slate-900/30 border border-slate-900/80 rounded-2xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto font-sans">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="bg-slate-950/80 border-b border-slate-900 text-slate-400 font-semibold">
              <th className="px-5 py-3.5">حساب العمل</th>
              <th className="px-5 py-3.5 text-center">المقبولة</th>
              <th className="px-5 py-3.5 text-center">المرفوضة</th>
              <th className="px-5 py-3.5 text-center">المراجعة</th>
               <th className="px-5 py-3.5 text-center">الإجمالي</th>
               <th className="px-5 py-3.5 text-center text-amber-400">المستلم المباشر</th>
              <th className="px-5 py-3.5 text-center text-indigo-400">الدفعة القادمة</th>
              <th className="px-5 py-3.5 text-center text-emerald-450">إجمالي المستلم</th>
              <th className="px-5 py-3.5">المحفظة</th>
              <th className="px-5 py-3.5 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900/60">
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
                <tr
                  key={account.id}
                  className="hover:bg-slate-900/20 transition-colors text-slate-350"
                >
                  <td className="px-5 py-3.5 font-bold text-white whitespace-nowrap">
                    {account.account_name}
                  </td>
                  <td className="px-5 py-3.5 text-center font-bold">
                    {isEditing ? (
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={editHours.accepted}
                        onChange={(e) =>
                          setEditHours((p) => ({
                            ...p,
                            accepted: e.target.value,
                          }))
                        }
                        className="w-16 text-center bg-slate-900 border border-slate-800 rounded font-bold text-emerald-400 py-1 text-xs outline-none focus:border-indigo-500"
                      />
                    ) : (
                      <span className="text-emerald-400 font-bold">{account.accepted_hours} hr</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-center font-bold">
                    {isEditing ? (
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={editHours.rejected}
                        onChange={(e) =>
                          setEditHours((p) => ({
                            ...p,
                            rejected: e.target.value,
                          }))
                        }
                        className="w-16 text-center bg-slate-900 border border-slate-800 rounded font-bold text-rose-400 py-1 text-xs outline-none focus:border-indigo-500"
                      />
                    ) : (
                      <span className="text-rose-400 font-bold">{account.rejected_hours} hr</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-center font-bold">
                    {isEditing ? (
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={editHours.in_review}
                        onChange={(e) =>
                          setEditHours((p) => ({
                            ...p,
                            in_review: e.target.value,
                          }))
                        }
                        className="w-16 text-center bg-slate-900 border border-slate-800 rounded font-bold text-amber-400 py-1 text-xs outline-none focus:border-indigo-500"
                      />
                    ) : (
                      <span className="text-amber-400 font-bold">{account.in_review_hours} hr</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-center text-slate-300 font-bold">
                    {totalHours} hr
                  </td>
                  <td className="px-5 py-3.5 text-center font-bold text-amber-500 whitespace-nowrap">
                    {isEditing ? (
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={editAmountPaid}
                        onChange={(e) => setEditAmountPaid(e.target.value)}
                        className="w-20 text-center bg-slate-900 border border-slate-800 rounded font-bold text-amber-400 py-1 text-xs outline-none focus:border-indigo-500"
                      />
                    ) : (
                      <span className="text-amber-400 font-bold">{account.amount_paid || 0} USDT</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-center text-indigo-400 font-bold whitespace-nowrap">
                    {isEditing ? (
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={editNextPayment}
                        onChange={(e) => setEditNextPayment(e.target.value)}
                        className="w-16 text-center bg-slate-900 border border-slate-800 rounded font-bold text-indigo-400 py-1 text-xs outline-none focus:border-indigo-500"
                      />
                    ) : (
                      <span>{account.next_payment || 0} USDT</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-center font-bold text-emerald-450 whitespace-nowrap">
                    {((account.amount_paid || 0) + resetsSum).toFixed(2)} USDT
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[11px] text-slate-350">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editWalletValue}
                        onChange={(e) => setEditWalletValue(e.target.value)}
                        placeholder="USDT Wallet"
                        className="w-32 bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-[11px] outline-none focus:border-indigo-500 text-white"
                      />
                    ) : (
                      account.wallet_address || <span className="text-slate-600 italic">لا يوجد</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    {isEditing ? (
                      <div className="flex justify-center gap-1.5">
                        <button
                          onClick={() => onSave(account.id)}
                          disabled={isUpdating}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white rounded p-1.5 transition-colors flex items-center justify-center"
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
                          className="bg-slate-800 hover:bg-slate-700 text-slate-400 rounded p-1.5 transition-colors flex items-center justify-center"
                          title="إلغاء"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-center gap-1.5">
                        <button
                          onClick={() => onReset(account)}
                          className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 text-[10px] font-bold rounded transition-colors flex items-center gap-1"
                          title="تصفير الحساب وترحيل الدفعة"
                        >
                          <ArrowRightLeft className="w-2.5 h-2.5" />
                          <span>تصفير</span>
                        </button>
                        <button
                          onClick={() => onStartEdit(account)}
                          className="px-2.5 py-1 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold rounded transition-colors flex items-center gap-1"
                        >
                          <Edit2 className="w-2.5 h-2.5" />
                          <span>تعديل</span>
                        </button>
                      </div>
                    )}
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

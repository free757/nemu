"use client";

import React, { useState, useEffect } from "react";
import { X, RefreshCw } from "lucide-react";

interface AdminAddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: "ar" | "en";
  isDark: boolean;
  actionLoading: boolean;
  onSubmit: (accountData: {
    account_name: string;
    wallet_address: string;
    accepted_hours: number;
    rejected_hours: number;
    in_review_hours: number;
  }) => Promise<void>;
}

export const AdminAddAccountModal: React.FC<AdminAddAccountModalProps> = ({
  isOpen,
  onClose,
  lang,
  isDark,
  actionLoading,
  onSubmit,
}) => {
  const [accountName, setAccountName] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [acceptedHours, setAcceptedHours] = useState(0);
  const [rejectedHours, setRejectedHours] = useState(0);
  const [inReviewHours, setInReviewHours] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setAccountName("");
      setWalletAddress("");
      setAcceptedHours(0);
      setRejectedHours(0);
      setInReviewHours(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim()) return;
    await onSubmit({
      account_name: accountName.trim(),
      wallet_address: walletAddress.trim(),
      accepted_hours: Number(acceptedHours),
      rejected_hours: Number(rejectedHours),
      in_review_hours: Number(inReviewHours),
    });
  };

  return (
    <div className="bg-black/60 backdrop-blur-sm fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl ${
          isDark ? "bg-[#0f0f0f] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
        }`}
      >
        <div className="flex justify-between items-center mb-6">
          <h4 className="text-lg font-bold">
            {lang === "ar" ? "ربط حساب عمل جديد للموظف" : "Link New Account to Employee"}
          </h4>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-medium">
          <div>
            <label className="block mb-1.5 text-gray-400">
              {lang === "ar" ? "اسم حساب العمل (مستلزم)" : "Account Name (Required)"}
            </label>
            <input
              type="text"
              required
              value={accountName}
              placeholder="e.g. Yasmin_TikTok"
              onChange={(e) => setAccountName(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border outline-none ${
                isDark
                  ? "bg-white/5 border-white/10 focus:border-blue-500"
                  : "bg-gray-50 border-gray-200 focus:border-blue-500"
              }`}
            />
          </div>

          <div>
            <label className="block mb-1.5 text-gray-400">
              {lang === "ar" ? "عنوان محفظة الاستلام (USDT)" : "USDT Payout Wallet"}
            </label>
            <input
              type="text"
              value={walletAddress}
              placeholder="USDT Wallet Address"
              onChange={(e) => setWalletAddress(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border outline-none font-mono ${
                isDark
                  ? "bg-white/5 border-white/10 focus:border-blue-500"
                  : "bg-gray-50 border-gray-200 focus:border-blue-500"
              }`}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block mb-1.5 text-emerald-450 font-semibold">
                {lang === "ar" ? "مقبولة" : "Accepted"}
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={acceptedHours}
                onChange={(e) => setAcceptedHours(parseFloat(e.target.value) || 0)}
                className={`w-full px-2 py-1.5 rounded-lg text-center font-bold outline-none ${
                  isDark
                    ? "bg-white/5 border-white/10 text-emerald-400"
                    : "bg-gray-50 border-gray-200 text-emerald-600"
                }`}
              />
            </div>
            <div>
              <label className="block mb-1.5 text-rose-450 font-semibold">
                {lang === "ar" ? "مرفوضة" : "Rejected"}
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={rejectedHours}
                onChange={(e) => setRejectedHours(parseFloat(e.target.value) || 0)}
                className={`w-full px-2 py-1.5 rounded-lg text-center font-bold outline-none ${
                  isDark
                    ? "bg-white/5 border-white/10 text-rose-400"
                    : "bg-gray-50 border-gray-200 text-rose-600"
                }`}
              />
            </div>
            <div>
              <label className="block mb-1.5 text-amber-500 font-semibold">
                {lang === "ar" ? "مراجعة" : "In Review"}
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={inReviewHours}
                onChange={(e) => setInReviewHours(parseFloat(e.target.value) || 0)}
                className={`w-full px-2 py-1.5 rounded-lg text-center font-bold outline-none ${
                  isDark
                    ? "bg-white/5 border-white/10 text-amber-400"
                    : "bg-gray-50 border-gray-200 text-amber-600"
                }`}
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2.5 rounded-xl font-bold ${
                isDark
                  ? "bg-white/5 hover:bg-white/10 text-gray-400"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-600"
              }`}
            >
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center gap-2"
            >
              {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{lang === "ar" ? "ربط الحساب" : "Link Account"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

"use client";

import React, { useState, useEffect } from "react";
import { X, RefreshCw, Calculator } from "lucide-react";

interface AdminAddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: "ar" | "en";
  isDark: boolean;
  defaultWalletAddress: string;
  remainingBalance: number;
  actionLoading: boolean;
  onSubmit: (
    amount: number,
    method: string,
    wallet: string,
    notes: string,
    exchangeRate?: number,
    amountEgp?: number
  ) => Promise<void>;
}

export const AdminAddPaymentModal: React.FC<AdminAddPaymentModalProps> = ({
  isOpen,
  onClose,
  lang,
  isDark,
  defaultWalletAddress,
  remainingBalance,
  actionLoading,
  onSubmit,
}) => {
  const [amount, setAmount] = useState<number>(0);
  const [payoutMethod, setPayoutMethod] = useState<string>("USDT");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // EGP Conversion states
  const [enableEgp, setEnableEgp] = useState<boolean>(false);
  const [exchangeRate, setExchangeRate] = useState<number>(50);
  const [amountEgp, setAmountEgp] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      setAmount(0);
      setPayoutMethod("USDT");
      setWalletAddress(defaultWalletAddress);
      setNotes("");
      setEnableEgp(false);
      setExchangeRate(50);
      setAmountEgp(0);
    }
  }, [isOpen, defaultWalletAddress]);

  if (!isOpen) return null;

  const handleUsdChange = (usdVal: number) => {
    setAmount(usdVal);
    if (enableEgp && exchangeRate > 0) {
      setAmountEgp(Number((usdVal * exchangeRate).toFixed(2)));
    }
  };

  const handleEgpChange = (egpVal: number) => {
    setAmountEgp(egpVal);
    if (enableEgp && exchangeRate > 0) {
      setAmount(Number((egpVal / exchangeRate).toFixed(2)));
    }
  };

  const handleRateChange = (rateVal: number) => {
    setExchangeRate(rateVal);
    if (enableEgp && rateVal > 0) {
      setAmountEgp(Number((amount * rateVal).toFixed(2)));
    }
  };

  const handleToggleEgp = (checked: boolean) => {
    setEnableEgp(checked);
    if (checked) {
      // Auto fill EGP based on current USD amount
      setAmountEgp(Number((amount * exchangeRate).toFixed(2)));
      // If payment method is USDT, switch to Cash because EGP is cash/transfer
      if (payoutMethod === "USDT") {
        setPayoutMethod("Cash");
      }
    } else {
      setAmountEgp(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;
    await onSubmit(
      amount,
      payoutMethod,
      walletAddress,
      notes,
      enableEgp ? exchangeRate : undefined,
      enableEgp ? amountEgp : undefined
    );
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
            {lang === "ar" ? "تسجيل دفعة مسلّمة جديدة" : "Log New Payment Transfer"}
          </h4>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-medium">
          {/* Worker Owed Balance Info card */}
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between ${
              isDark ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-150"
            }`}
          >
            <div className="text-right">
              <span className="block text-[10px] text-gray-400 mb-0.5">
                {lang === "ar" ? "المبلغ المتبقي المستحق للموظف:" : "Employee Owed Balance:"}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-bold text-amber-500">{remainingBalance.toFixed(2)} USDT</span>
                {enableEgp && exchangeRate > 0 && (
                  <span className="text-[10px] text-gray-500 font-semibold font-sans">
                    {lang === "ar" ? "يعادل " : "≈ "}
                    {(remainingBalance * exchangeRate).toLocaleString(lang === "ar" ? "ar-EG" : "en-US", {
                      maximumFractionDigits: 1,
                    })}{" "}
                    EGP
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setAmount(Number(remainingBalance.toFixed(2)));
                if (enableEgp) {
                  setAmountEgp(Number((remainingBalance * exchangeRate).toFixed(2)));
                }
              }}
              className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 border border-blue-500/25 rounded-xl font-bold text-[10px] transition-all"
            >
              {lang === "ar" ? "دفع كامل المبلغ" : "Pay Full Amount"}
            </button>
          </div>

          {/* EGP Conversion Toggle */}
          <div
            className={`p-3 rounded-2xl border flex items-center justify-between ${
              isDark ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-150"
            }`}
          >
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-400" />
              <span className="font-bold">
                {lang === "ar" ? "تسليم الدفعة بالجنيه المصري (EGP)" : "Pay in Egyptian Pounds (EGP)"}
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enableEgp}
                onChange={(e) => handleToggleEgp(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {enableEgp && (
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl border border-dashed border-emerald-500/20 bg-emerald-500/5">
              <div>
                <label className="block mb-1.5 text-emerald-400 font-bold">
                  {lang === "ar" ? "سعر صرف الدولار (EGP)" : "USD exchange rate"}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  required
                  value={exchangeRate || ""}
                  onChange={(e) => handleRateChange(parseFloat(e.target.value) || 0)}
                  className={`w-full px-3 py-2 rounded-xl border outline-none font-bold ${
                    isDark ? "bg-[#0f0f0f] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
                  }`}
                />
              </div>

              <div>
                <label className="block mb-1.5 text-emerald-400 font-bold">
                  {lang === "ar" ? "المبلغ بالجنيه (EGP)" : "Amount in EGP"}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  required
                  value={amountEgp || ""}
                  onChange={(e) => handleEgpChange(parseFloat(e.target.value) || 0)}
                  className={`w-full px-3 py-2 rounded-xl border outline-none font-bold ${
                    isDark ? "bg-[#0f0f0f] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
                  }`}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block mb-1.5 text-gray-400">
              {lang === "ar" ? "المبلغ بالدولار (USDT)" : "Amount (USDT)"}
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              required
              value={amount || ""}
              placeholder="e.g. 150.00"
              onChange={(e) => handleUsdChange(parseFloat(e.target.value) || 0)}
              className={`w-full px-4 py-2.5 rounded-xl border outline-none ${
                isDark
                  ? "bg-white/5 border-white/10 focus:border-blue-500"
                  : "bg-gray-50 border-gray-200 focus:border-blue-500"
              }`}
            />
          </div>

          <div>
            <label className="block mb-1.5 text-gray-400">
              {lang === "ar" ? "طريقة الدفع" : "Payment Method"}
            </label>
            <select
              value={payoutMethod}
              onChange={(e) => setPayoutMethod(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border outline-none ${
                isDark
                  ? "bg-slate-900 border-white/10 text-white focus:border-blue-500"
                  : "bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500"
              }`}
            >
              <option value="USDT">USDT</option>
              <option value="Cash">{lang === "ar" ? "نقداً (Cash)" : "Cash"}</option>
              <option value="Other">{lang === "ar" ? "أخرى (Other)" : "Other"}</option>
            </select>
          </div>

          <div>
            <label className="block mb-1.5 text-gray-400">
              {lang === "ar" ? "عنوان محفظة الاستلام (اختياري)" : "Wallet Address (Optional)"}
            </label>
            <input
              type="text"
              placeholder="USDT Wallet Address"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border outline-none ${
                isDark
                  ? "bg-white/5 border-white/10 focus:border-blue-500"
                  : "bg-gray-50 border-gray-200 focus:border-blue-500"
              }`}
            />
          </div>

          <div>
            <label className="block mb-1.5 text-gray-400">
              {lang === "ar" ? "ملاحظات / رقم المعاملة (اختياري)" : "Notes / Tx Hash (Optional)"}
            </label>
            <input
              type="text"
              placeholder="e.g. Transaction Hash or Cash Details"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border outline-none ${
                isDark
                  ? "bg-white/5 border-white/10 focus:border-blue-500"
                  : "bg-gray-50 border-gray-200 focus:border-blue-500"
              }`}
            />
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
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl flex items-center gap-2"
            >
              {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{lang === "ar" ? "تسجيل الدفعة" : "Log Payment"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

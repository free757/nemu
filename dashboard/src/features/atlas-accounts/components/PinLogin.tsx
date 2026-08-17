"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, AlertCircle, ArrowLeft, Sparkles } from "lucide-react";

const PIN_LENGTH = 4;

interface PinLoginProps {
  pin: string;
  loginLoading: boolean;
  loginError: boolean;
  loginErrorMsg: string;
  currentTime: string;
  currentDate: string;
  shakeKey: React.RefObject<number>;
  onKeyPress: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onHomeClick: () => void;
}

export const PinLogin: React.FC<PinLoginProps> = ({
  pin,
  loginLoading,
  loginError,
  loginErrorMsg,
  currentTime,
  currentDate,
  shakeKey,
  onKeyPress,
  onBackspace,
  onClear,
  onHomeClick,
}) => {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-6 relative overflow-hidden selection:bg-indigo-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08)_0,transparent_60%)] pointer-events-none" />

      {/* Top Bar with Clock */}
      <div className="w-full max-w-md flex justify-between items-center z-10">
        <button
          onClick={onHomeClick}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors bg-slate-900/60 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-lg"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>الرئيسية</span>
        </button>
        <div className="text-right">
          <div className="text-sm font-semibold tracking-wide text-indigo-400">{currentTime}</div>
          <div className="text-[10px] text-slate-500 font-medium">{currentDate}</div>
        </div>
      </div>

      {/* PIN Box */}
      <div className="w-full max-w-md my-auto flex flex-col items-center justify-center z-10 relative">
        <motion.div
          key={shakeKey.current}
          animate={loginError ? { x: [-10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="w-full bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-8 flex flex-col items-center shadow-2xl"
        >
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white mb-1">
            تسجيل دخول الموظفين
          </h2>
          <p className="text-xs text-slate-400 mb-6 text-center font-sans">
            أدخل الرمز التعريفي (PIN) لرؤية حساباتك وتعديل ساعاتها
          </p>

          {/* Dots */}
          <div className="flex gap-4 mb-6">
            {Array.from({ length: PIN_LENGTH }).map((_, idx) => (
              <div
                key={idx}
                className={`w-3.5 h-3.5 rounded-full border transition-all duration-200 ${
                  idx < pin.length
                    ? "bg-indigo-500 border-indigo-400 shadow-lg shadow-indigo-500/50 scale-110"
                    : "bg-slate-950 border-slate-700"
                }`}
              />
            ))}
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {loginError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2 text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg w-full mb-6 justify-center"
              >
                <AlertCircle className="w-4 h-4" />
                <span>{loginErrorMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading */}
          {loginLoading && (
            <div className="flex items-center justify-center gap-2 py-2 mb-4">
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          )}

          {/* Keyboard */}
          <div className="grid grid-cols-3 gap-3.5 w-full">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => onKeyPress(digit)}
                className="h-14 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 active:bg-slate-900 hover:bg-slate-900/40 text-lg font-semibold flex items-center justify-center transition-all duration-150"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={onClear}
              className="h-14 rounded-xl bg-slate-950/40 border border-slate-900 text-xs font-semibold text-slate-555 hover:text-slate-300 flex items-center justify-center transition-colors"
            >
              مسح الكل
            </button>
            <button
              type="button"
              onClick={() => onKeyPress("0")}
              className="h-14 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 active:bg-slate-900 hover:bg-slate-900/40 text-lg font-semibold flex items-center justify-center transition-all duration-150"
            >
              0
            </button>
            <button
              type="button"
              onClick={onBackspace}
              className="h-14 rounded-xl bg-slate-950/40 border border-slate-900 text-xs font-semibold text-slate-555 hover:text-slate-300 flex items-center justify-center transition-colors"
            >
              مسح
            </button>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="text-[10px] text-slate-700 flex items-center gap-1.5 z-10">
        <Sparkles className="w-3.5 h-3.5 text-indigo-500/60" />
        <span>بوابة حسابات أطلس ادفينشر للموظفين</span>
      </div>
    </main>
  );
};

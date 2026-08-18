"use client";

import React from "react";
import { Sparkles, ShieldCheck, Cpu, Notebook, Sun, Moon, RotateCcw } from "lucide-react";
import { ThemeMode } from "../hooks/useTheme";

interface AtlasHeaderProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenNotes: () => void;
  onResetAll?: () => void;
}

export const AtlasHeader: React.FC<AtlasHeaderProps> = ({
  theme,
  onToggleTheme,
  onOpenNotes,
  onResetAll,
}) => {
  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-50 transition-colors">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-md shadow-brand-500/20 text-white shrink-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5 sm:gap-2 truncate">
              Atlas Helper
              <span className="text-[9px] sm:text-[10px] font-semibold text-brand-700 bg-brand-50 border border-brand-200 dark:text-brand-400 dark:bg-brand-950 dark:border-brand-800 px-1.5 py-0.5 rounded-full shrink-0">
                Gemini 2.5 Pro
              </span>
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate hidden xs:block">
              Action Label Validator & Corrector
            </p>
          </div>
        </div>

        {/* Actions & Badges */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Reset All / New Task Button */}
          {onResetAll && (
            <button
              type="button"
              onClick={onResetAll}
              className="flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/60 rounded-lg transition-all font-semibold shadow-xs"
              title="فيديو جديد (مسح الكل)"
              aria-label="فيديو جديد (مسح الكل)"
            >
              <RotateCcw className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span className="hidden md:inline">فيديو جديد</span>
            </button>
          )}

          {/* Theme Switcher Button */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex items-center justify-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 text-xs text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg transition-colors font-medium shadow-xs"
            title={theme === "dark" ? "التبديل إلى الوضع النهاري" : "التبديل إلى الوضع الليلي"}
            aria-label={theme === "dark" ? "التبديل إلى الوضع النهاري" : "التبديل إلى الوضع الليلي"}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600 shrink-0" />
            )}
            <span className="hidden lg:inline">{theme === "dark" ? "نهاري" : "ليلي"}</span>
          </button>

          {/* Shared Notes Drawer Trigger */}
          <button
            type="button"
            onClick={onOpenNotes}
            className="flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 text-xs text-slate-800 dark:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg transition-colors font-semibold shadow-xs"
            title="درج الملاحظات المشتركة"
            aria-label="درج الملاحظات المشتركة"
          >
            <Notebook className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
            <span className="hidden sm:inline">الملاحظات</span>
          </button>

          {/* Feature Badges */}
          <div className="hidden xl:flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-slate-800 pl-3">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Strict Rubric</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <span>File API</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

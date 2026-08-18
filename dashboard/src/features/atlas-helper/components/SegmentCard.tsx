"use client";

import React from "react";
import { Clock, Cpu, Languages, Eye, Check, Copy, Sparkles, Trash2 } from "lucide-react";
import { Button } from "./ui/Button";
import { SegmentItem } from "../types/atlas";
import { translateToArabic } from "../lib/utils";

interface SegmentCardProps {
  segment: SegmentItem;
  index: number;
  isArabic: boolean;
  isCopied: boolean;
  isReAiLoading: boolean;
  isBatchLoading: boolean;
  onUpdate: (id: string, field: keyof SegmentItem, value: string) => void;
  onRemove: (id: string) => void;
  onCopy: (id: string, text: string) => void;
  onToggleArabic: (id: string) => void;
  onReAi: (id: string) => void;
}

export const SegmentCard: React.FC<SegmentCardProps> = ({
  segment,
  index,
  isArabic,
  isCopied,
  isReAiLoading,
  isBatchLoading,
  onUpdate,
  onRemove,
  onCopy,
  onToggleArabic,
  onReAi,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4 transition-all hover:border-slate-300 dark:hover:border-slate-700 shadow-sm dark:shadow-md space-y-3">
      <div className="flex flex-col md:flex-row gap-3 sm:gap-4 items-start md:items-center justify-between">
        <div className="space-y-2 flex-1 w-full min-w-0">
          {/* Segment Header & Badges */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 w-full">
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-mono text-brand-700 bg-brand-50 border border-brand-200 dark:text-brand-400 dark:bg-brand-950/60 dark:border-brand-800/40 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md w-fit">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>
                #{index + 1} ({segment.startTime} – {segment.endTime})
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              {segment.usedModel && (
                <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/60 dark:border-indigo-800/40 px-2 py-0.5 rounded-md font-mono" title={`Model: ${segment.usedModel}`}>
                  <Cpu className="w-3 h-3 text-indigo-500 dark:text-indigo-400 shrink-0" />
                  <span className="max-w-[80px] sm:max-w-[140px] truncate">{segment.usedModel.split("-").slice(0, 2).join("-")}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => onToggleArabic(segment.id)}
                className={`flex items-center gap-1 text-[11px] sm:text-xs px-2 py-1 rounded-md transition-all font-medium border ${
                  isArabic
                    ? "bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-950/70 dark:border-amber-500/50 dark:text-amber-300"
                    : "bg-slate-100 border-slate-300 text-slate-700 hover:text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                }`}
                title={isArabic ? "إخفاء الترجمة العربية" : "عرض الترجمة العربية"}
                aria-label="ترجمة عربي"
              >
                <Languages className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{isArabic ? "إخفاء" : "عربي"}</span>
              </button>

              {segment.correctedLabel && (
                <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-800/40 px-2 py-0.5 rounded-md font-medium" title={segment.analysisMode === "visual" ? "Verified Video Frames" : "Atlas Rubric Applied"}>
                  <Eye className="w-3 h-3 shrink-0" />
                  <span className="hidden xs:inline">
                    {segment.analysisMode === "visual" ? "Video" : "Rubric"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Labels Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 w-full">
            {/* Current Label */}
            <div>
              <label className="block text-[10px] sm:text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Current AI Label
              </label>
              <input
                type="text"
                value={segment.currentLabel}
                onChange={(e) => onUpdate(segment.id, "currentLabel", e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-md text-xs text-slate-800 dark:text-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              {isArabic && segment.currentLabel && (
                <p className="mt-1 text-[11px] text-amber-900 dark:text-amber-300/90 font-sans dir-rtl bg-amber-50 dark:bg-slate-950/60 p-1.5 rounded border border-amber-200 dark:border-amber-500/20 leading-tight">
                  🇸🇦 {translateToArabic(segment.currentLabel)}
                </p>
              )}
            </div>

            {/* Corrected Label */}
            {segment.correctedLabel && (
              <div>
                <label className="block text-[10px] sm:text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                  Corrected Action Label
                </label>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <input
                    type="text"
                    readOnly
                    value={segment.correctedLabel}
                    className="w-full px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/50 rounded-md text-xs text-emerald-800 dark:text-emerald-300 font-mono font-semibold focus:outline-none"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => onCopy(segment.id, segment.correctedLabel!)}
                      icon={
                        isCopied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                        )
                      }
                      title={isCopied ? "تم النسخ!" : "نسخ التسمية المصححة"}
                      aria-label="نسخ"
                      className="px-2"
                    />

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onReAi(segment.id)}
                      isLoading={isReAiLoading}
                      disabled={isBatchLoading}
                      icon={<Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />}
                      title="إعادة تصحيح هذا المقطع فقط بالذكاء الاصطناعي"
                      aria-label="Re-AI"
                      className="px-2"
                    />
                  </div>
                </div>
                {isArabic && segment.correctedLabel && (
                  <p className="mt-1 text-[11px] text-emerald-900 dark:text-emerald-300/90 font-sans dir-rtl bg-emerald-50 dark:bg-emerald-950/40 p-1.5 rounded border border-emerald-200 dark:border-emerald-500/30 leading-tight">
                    🇸🇦 {translateToArabic(segment.correctedLabel)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Visual Evidence / Proof Box */}
          {segment.visualEvidence && (
            <div className="mt-2 text-xs bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-2.5 rounded-lg text-slate-700 dark:text-slate-300 flex items-start gap-2">
              <Eye className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
              <div className="text-[11px] sm:text-xs">
                <span className="font-semibold text-brand-700 dark:text-brand-300">Proof: </span>
                <span>{segment.visualEvidence}</span>
                {isArabic && (
                  <p className="mt-1 text-[11px] text-amber-900 dark:text-amber-200/90 font-sans dir-rtl bg-amber-50 dark:bg-slate-900/80 p-1.5 rounded border border-amber-200 dark:border-amber-500/20">
                    🇸🇦 {translateToArabic(segment.visualEvidence)}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Remove Button */}
        <button
          type="button"
          onClick={() => onRemove(segment.id)}
          className="text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 p-1.5 rounded-lg transition-colors self-end md:self-center hover:bg-rose-50 dark:hover:bg-rose-950/30"
          title="حذف هذا المقطع"
          aria-label="حذف المقطع"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

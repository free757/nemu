"use client";

import React from "react";
import { Plus, Copy, Check, FileSpreadsheet } from "lucide-react";
import { Button } from "./ui/Button";
import { SegmentCard } from "./SegmentCard";
import { SegmentItem } from "../types/atlas";

interface SegmentListProps {
  segments: SegmentItem[];
  copiedReport: boolean;
  copiedId: string | null;
  loadingSegmentId: string | null;
  isBatchLoading: boolean;
  arabicMap: Record<string, boolean>;
  onCopyFullReport: () => void;
  onAddSingleSegment: () => void;
  onUpdateSegment: (id: string, field: keyof SegmentItem, value: string) => void;
  onRemoveSegment: (id: string) => void;
  onCopy: (id: string, text: string) => void;
  onToggleArabic: (id: string) => void;
  onCorrectSingleSegment: (id: string) => void;
}

export const SegmentList: React.FC<SegmentListProps> = ({
  segments,
  copiedReport,
  copiedId,
  loadingSegmentId,
  isBatchLoading,
  arabicMap,
  onCopyFullReport,
  onAddSingleSegment,
  onUpdateSegment,
  onRemoveSegment,
  onCopy,
  onToggleArabic,
  onCorrectSingleSegment,
}) => {
  if (segments.length === 0) return null;

  return (
    <div className="space-y-3 sm:space-y-4 pt-1">
      {/* List Header Actions */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-300 truncate">
          Parsed Segments ({segments.length})
        </h3>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {segments.some((s) => s.correctedLabel) && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onCopyFullReport}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold border-emerald-700 shadow-xs"
              icon={copiedReport ? <Check className="w-3.5 h-3.5 text-white" /> : <FileSpreadsheet className="w-3.5 h-3.5 text-white" />}
              title={copiedReport ? "تم نسخ التقرير الكامل!" : "نسخ التقرير الكامل لجميع المقاطع"}
              aria-label="نسخ التقرير الكامل"
            >
              <span>{copiedReport ? "تم النسخ!" : "نسخ التقرير"}</span>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddSingleSegment}
            icon={<Plus className="w-3.5 h-3.5" />}
            title="إضافة مقطع زمني يدوي"
            aria-label="إضافة مقطع"
          >
            <span className="hidden sm:inline">إضافة مقطع</span>
          </Button>
        </div>
      </div>

      {/* Grid of Segments */}
      <div className="grid gap-3 sm:gap-4">
        {segments.map((seg, index) => (
          <SegmentCard
            key={seg.id}
            segment={seg}
            index={index}
            isArabic={!!arabicMap[seg.id]}
            isCopied={copiedId === seg.id}
            isReAiLoading={loadingSegmentId === seg.id}
            isBatchLoading={isBatchLoading}
            onUpdate={onUpdateSegment}
            onRemove={onRemoveSegment}
            onCopy={onCopy}
            onToggleArabic={onToggleArabic}
            onReAi={onCorrectSingleSegment}
          />
        ))}
      </div>
    </div>
  );
};

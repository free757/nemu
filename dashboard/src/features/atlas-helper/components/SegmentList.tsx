"use client";

import React from "react";
import { Plus, Copy, Check } from "lucide-react";
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
    <div className="space-y-4 pt-2">
      {/* List Header Actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300">
          Parsed Segments Details ({segments.length})
        </h3>
        <div className="flex items-center gap-2">
          {segments.some((s) => s.correctedLabel) && (
            <Button
              variant="primary"
              size="sm"
              onClick={onCopyFullReport}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold border-emerald-700"
              icon={copiedReport ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            >
              {copiedReport ? "Report Copied!" : "📋 Copy Full Report"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onAddSingleSegment}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Segment
          </Button>
        </div>
      </div>

      {/* Grid of Segments */}
      <div className="grid gap-4">
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

"use client";

import React, { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { useBatchSegments } from "../hooks/useBatchSegments";
import { BatchInputCard } from "./BatchInputCard";
import { SegmentList } from "./SegmentList";

interface BatchLabelFormProps {
  fileUri: string | null;
  isLoaded: boolean;
  videoUrl?: string;
  resetKey?: number;
}

export const BatchLabelForm: React.FC<BatchLabelFormProps> = ({
  fileUri,
  isLoaded,
  videoUrl,
  resetKey,
}) => {
  const {
    segments,
    bulkText,
    isLoading,
    loadingSegmentId,
    error,
    copiedId,
    copiedReport,
    arabicMap,
    handleBulkTextChange,
    handleUpdateSegment,
    handleRemoveSegment,
    handleAddSingleSegment,
    handleCopy,
    toggleArabicTranslation,
    handleCopyFullReport,
    handleCorrectAll,
    handleCorrectSingleSegment,
    handleReset,
    setDirectBulkText,
  } = useBatchSegments({ fileUri, videoUrl });

  useEffect(() => {
    if (resetKey !== undefined && resetKey > 0) {
      handleReset();
    }
  }, [resetKey, handleReset]);

  return (
    <div className="space-y-6">
      {/* 1. Bulk Input Card */}
      <BatchInputCard
        bulkText={bulkText}
        onBulkTextChange={handleBulkTextChange}
        detectedCount={segments.length}
        isLoading={isLoading}
        isLoaded={isLoaded}
        onCorrectAll={handleCorrectAll}
        onClearText={handleReset}
        onPasteText={setDirectBulkText}
      />

      {/* 2. Segments List */}
      <SegmentList
        segments={segments}
        copiedReport={copiedReport}
        copiedId={copiedId}
        loadingSegmentId={loadingSegmentId}
        isBatchLoading={isLoading}
        arabicMap={arabicMap}
        onCopyFullReport={handleCopyFullReport}
        onAddSingleSegment={handleAddSingleSegment}
        onUpdateSegment={handleUpdateSegment}
        onRemoveSegment={handleRemoveSegment}
        onCopy={handleCopy}
        onToggleArabic={toggleArabicTranslation}
        onCorrectSingleSegment={handleCorrectSingleSegment}
      />

      {/* Global Form Error Message */}
      {error && (
        <div className="p-3.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500 dark:text-red-400" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

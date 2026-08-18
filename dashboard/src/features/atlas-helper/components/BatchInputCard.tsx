"use client";

import React from "react";
import { FileText, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "./ui/Button";

interface BatchInputCardProps {
  bulkText: string;
  onBulkTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  detectedCount: number;
  isLoading: boolean;
  isLoaded: boolean;
  onCorrectAll: () => void;
}

export const BatchInputCard: React.FC<BatchInputCardProps> = ({
  bulkText,
  onBulkTextChange,
  detectedCount,
  isLoading,
  isLoaded,
  onCorrectAll,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm dark:shadow-lg space-y-4 transition-colors">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <FileText className="w-4 h-4 text-brand-600 dark:text-brand-500" />
          Paste Segments Text (Time Ranges + Current AI Labels)
        </label>
        <span className="text-xs font-mono px-2.5 py-1 rounded-md text-brand-700 bg-brand-50 border border-brand-200 dark:text-brand-400 dark:bg-brand-950/60 dark:border-brand-800/40">
          {detectedCount} segment(s) detected
        </span>
      </div>

      <textarea
        value={bulkText}
        onChange={onBulkTextChange}
        placeholder={`Paste your segment text block here, e.g.:\n\n0:00.00–0:03.00\npick up and place wrench with right hand\n\n0:03.00–0:07.33\npick up and place wrench with right hand`}
        rows={6}
        className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all font-mono"
      />

      <div className="pt-2">
        <Button
          variant="primary"
          size="lg"
          className="w-full py-3.5 text-base font-bold bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 shadow-xl shadow-brand-500/25 transition-all text-white"
          onClick={onCorrectAll}
          isLoading={isLoading}
          disabled={!isLoaded}
          icon={<Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />}
        >
          Verify & Correct All Segments with AI
        </Button>
        {!isLoaded && (
          <p className="text-xs text-center text-amber-600 dark:text-amber-400/80 mt-2 flex items-center justify-center gap-1 font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            Please paste and load your video URL in Step 1 first to enable AI correction.
          </p>
        )}
      </div>
    </div>
  );
};

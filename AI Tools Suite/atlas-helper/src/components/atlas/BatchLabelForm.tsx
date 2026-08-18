"use client";

import React, { useState } from "react";
import { Button } from "../ui/Button";
import { parseBulkSegmentsText, parseTimeRange, translateToArabic } from "../../lib/utils";
import { ApiResponse, CorrectLabelsResponse, SegmentItem } from "../../types/atlas";
import { DEFAULT_ATLAS_SYSTEM_PROMPT } from "../../constants/atlas-prompts";
import {
  Sparkles,
  Copy,
  Check,
  Plus,
  Trash2,
  Settings2,
  FileText,
  Clock,
  Layers,
  AlertCircle,
  Eye,
  Languages,
  Cpu,
} from "lucide-react";

interface BatchLabelFormProps {
  fileUri: string | null;
  isLoaded: boolean;
  videoUrl: string;
}

export const BatchLabelForm: React.FC<BatchLabelFormProps> = ({ fileUri, isLoaded, videoUrl }) => {
  const [segments, setSegments] = useState<SegmentItem[]>([]);
  const [bulkText, setBulkText] = useState<string>("");
  const [customPrompt, setCustomPrompt] = useState<string>(DEFAULT_ATLAS_SYSTEM_PROMPT);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);
  const [arabicMap, setArabicMap] = useState<Record<string, boolean>>({});
  const [loadingSegmentId, setLoadingSegmentId] = useState<string | null>(null);


  const handleBulkTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setBulkText(text);
    const parsed = parseBulkSegmentsText(text);
    if (parsed.length > 0) {
      setSegments(parsed);
      setError(null);
    }
  };

  const handleAddSingleSegment = () => {
    setSegments((prev) => [
      ...prev,
      {
        id: `seg-${Date.now()}-${prev.length + 1}`,
        startTime: "0:00.00",
        endTime: "0:05.00",
        currentLabel: "",
        status: "idle",
      },
    ]);
  };

  const handleRemoveSegment = (id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id));
  };

  const handleUpdateSegment = (id: string, key: keyof SegmentItem, value: string) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [key]: value } : s))
    );
  };

  const toggleArabicTranslation = (id: string) => {
    setArabicMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCorrectAll = async () => {
    if (!fileUri) {
      setError("⚠️ Please load a Cloudflare R2 video URL first in Step 1.");
      return;
    }

    let activeSegments = segments;
    if (activeSegments.length === 0 && bulkText.trim()) {
      activeSegments = parseBulkSegmentsText(bulkText);
      if (activeSegments.length > 0) {
        setSegments(activeSegments);
      }
    }

    if (activeSegments.length === 0) {
      setError("⚠️ Please paste your segment timestamps and labels in the text box.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/correct-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUri,
          segments: activeSegments,
          customPrompt: showSettings ? customPrompt : undefined,
        }),
      });

      const result: ApiResponse<CorrectLabelsResponse> = await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || "Failed to correct labels.");
      }

      const correctedMap = new Map(
        result.data.segments.map((res) => [res.id, res])
      );

      setSegments((prev) =>
        prev.map((s) => {
          const res = correctedMap.get(s.id);
          return {
            ...s,
            correctedLabel: res?.correctedLabel || s.currentLabel,
            visualEvidence: res?.visualEvidence,
            analysisMode: res?.analysisMode || "visual",
            usedModel: res?.usedModel,
            status: "success",
          };
        })
      );
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during AI label correction.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCorrectSingleSegment = async (id: string) => {
    if (!fileUri) {
      setError("⚠️ Please load a Cloudflare R2 video URL first in Step 1.");
      return;
    }

    const targetSeg = segments.find((s) => s.id === id);
    if (!targetSeg) return;

    setLoadingSegmentId(id);
    setError(null);

    try {
      const response = await fetch("/api/correct-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUri,
          segments: [
            {
              id: targetSeg.id,
              startTime: targetSeg.startTime,
              endTime: targetSeg.endTime,
              currentLabel: targetSeg.currentLabel,
            },
          ],
          customPrompt: showSettings ? customPrompt : undefined,
        }),
      });

      const result: ApiResponse<CorrectLabelsResponse> = await response.json();

      if (!response.ok || !result.success || !result.data || result.data.segments.length === 0) {
        throw new Error(result.error || "Failed to correct this segment.");
      }

      const res = result.data.segments[0];
      setSegments((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                correctedLabel: res.correctedLabel,
                visualEvidence: res.visualEvidence,
                analysisMode: res.analysisMode || "visual",
                usedModel: res.usedModel,
                status: "success",
              }
            : s
        )
      );
    } catch (err: any) {
      setError(err.message || "Failed to correct this segment.");
    } finally {
      setLoadingSegmentId(null);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyFullReport = () => {
    if (segments.length === 0) return;
    const reportText = [
      `### 🎥 Video URL:\n${videoUrl || "Not Loaded"}`,
      `\n### 📋 Corrected Segments Details:`,
      ...segments.map((seg, idx) => {
        const isSegArabic = !!arabicMap[seg.id];
        const modelStr = seg.usedModel ? ` [Model: ${seg.usedModel}]` : "";
        const modeStr = seg.analysisMode === "visual" ? " (👁️ Verified Video Frames)" : " (✍️ Atlas Rubric Applied)";
        const arabicCurrent = isSegArabic ? `\n🇸🇦 الترجمة: ${translateToArabic(seg.currentLabel)}` : "";
        const arabicCorrected = isSegArabic && seg.correctedLabel ? `\n🇸🇦 التسمية المصححة: ${translateToArabic(seg.correctedLabel)}` : "";
        const arabicEvidence = isSegArabic && seg.visualEvidence ? `\n🇸🇦 الملاحظة البصرية: ${translateToArabic(seg.visualEvidence)}` : "";

        return `\n**Segment ${idx + 1} (${seg.startTime} – ${seg.endTime})**${modelStr}${modeStr}\n` +
          `- **Current AI Label:** ${seg.currentLabel}${arabicCurrent}\n` +
          `- **Corrected Action Label:** ${seg.correctedLabel || "Not Corrected"}${arabicCorrected}\n` +
          (seg.visualEvidence ? `- **Visual Evidence:** ${seg.visualEvidence}${arabicEvidence}\n` : "");
      })
    ].join("\n");

    navigator.clipboard.writeText(reportText);
    setCopiedReport(true);
    setTimeout(() =      {/* Bulk Input Box */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm dark:shadow-lg space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand-600 dark:text-brand-500" />
            Paste Segments Text (Time Ranges + Current AI Labels)
          </label>
          <span className="text-xs font-mono px-2.5 py-1 rounded-md text-brand-700 bg-brand-50 border border-brand-200 dark:text-brand-400 dark:bg-brand-950/60 dark:border-brand-800/40">
            {segments.length} segment(s) detected
          </span>
        </div>
        <textarea
          value={bulkText}
          onChange={handleBulkTextChange}
          placeholder={`Paste your segment text block here, e.g.:\n\n0:00.00–0:03.00\npick up and place wrench with right hand\n\n0:03.00–0:07.33\npick up and place wrench with right hand`}
          rows={6}
          className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all font-mono"
        />

        {/* ALWAYS VISIBLE MAIN ACTION BUTTON */}
        <div className="pt-2">
          <Button
            variant="primary"
            size="lg"
            className="w-full py-3.5 text-base font-bold bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 shadow-xl shadow-brand-500/25 transition-all text-white"
            onClick={handleCorrectAll}
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

      {/* Segments Cards / Edit List */}
      {segments.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300">Parsed Segments Details</h3>
            <div className="flex items-center gap-2">
              {segments.some((s) => s.correctedLabel) && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCopyFullReport}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold border-emerald-700"
                  icon={copiedReport ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                >
                  {copiedReport ? "Report Copied!" : "📋 Copy Full Report"}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddSingleSegment}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                Add Segment
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            {segments.map((seg, index) => {
              const isArabic = !!arabicMap[seg.id];
              return (
                <div
                  key={seg.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 transition-all hover:border-slate-300 dark:hover:border-slate-700 shadow-sm dark:shadow-md space-y-3"
                >
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                    <div className="space-y-2 flex-1 w-full">
                      <div className="flex flex-wrap items-center justify-between gap-2 w-full">
                        <div className="flex items-center gap-2 text-xs font-mono text-brand-700 bg-brand-50 border border-brand-200 dark:text-brand-400 dark:bg-brand-950/60 dark:border-brand-800/40 px-2.5 py-1 rounded-md w-fit">
                          <Clock className="w-3.5 h-3.5" />
                          <span>
                            Segment {index + 1}: {seg.startTime} – {seg.endTime}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {seg.usedModel && (
                            <div className="flex items-center gap-1 text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/60 dark:border-indigo-800/40 px-2.5 py-0.5 rounded-md font-mono">
                              <Cpu className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                              <span>{seg.usedModel}</span>
                            </div>
                          )}

                          <button
                            onClick={() => toggleArabicTranslation(seg.id)}
                            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-all font-medium border ${
                              isArabic
                                ? "bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-950/70 dark:border-amber-500/50 dark:text-amber-300"
                                : "bg-slate-100 border-slate-300 text-slate-700 hover:text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                            }`}
                          >
                            <Languages className="w-3.5 h-3.5" />
                            <span>{isArabic ? "إخفاء الترجمة" : "🌐 ترجمة عربي"}</span>
                          </button>

                          {seg.correctedLabel && (
                            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-800/40 px-2.5 py-1 rounded-md font-medium">
                              <Eye className="w-3.5 h-3.5" />
                              <span>
                                {seg.analysisMode === "visual"
                                  ? "👁️ Verified Video Frames"
                                  : "✍️ Atlas Rubric Applied"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Current AI Label
                          </label>
                          <input
                            type="text"
                            value={seg.currentLabel}
                            onChange={(e) =>
                              handleUpdateSegment(seg.id, "currentLabel", e.target.value)
                            }
                            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-md text-xs text-slate-800 dark:text-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
                          />
                          {isArabic && seg.currentLabel && (
                            <p className="mt-1 text-xs text-amber-900 dark:text-amber-300/90 font-sans dir-rtl bg-amber-50 dark:bg-slate-950/60 p-1.5 rounded border border-amber-200 dark:border-amber-500/20">
                              🇸🇦 <strong>الترجمة:</strong> {translateToArabic(seg.currentLabel)}
                            </p>
                          )}
                        </div>

                        {seg.correctedLabel && (
                          <div>
                            <label className="block text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                              Corrected Action Label
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                readOnly
                                value={seg.correctedLabel}
                                className="w-full px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/50 rounded-md text-xs text-emerald-800 dark:text-emerald-300 font-mono font-semibold focus:outline-none"
                              />
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleCopy(seg.id, seg.correctedLabel!)}
                                  icon={
                                    copiedId === seg.id ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                                    )
                                  }
                                >
                                  {copiedId === seg.id ? "Copied" : "Copy"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCorrectSingleSegment(seg.id)}
                                  isLoading={loadingSegmentId === seg.id}
                                  disabled={isLoading}
                                  icon={<Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />}
                                  title="إعادة تصحيح هذا المقطع فقط بالذكاء الاصطناعي"
                                >
                                  {loadingSegmentId === seg.id ? "Correcting..." : "Re-AI"}
                                </Button>
                              </div>
                            </div>
                            {isArabic && seg.correctedLabel && (
                              <p className="mt-1 text-xs text-emerald-900 dark:text-emerald-300/90 font-sans dir-rtl bg-emerald-50 dark:bg-emerald-950/40 p-1.5 rounded border border-emerald-200 dark:border-emerald-500/30">
                                🇸🇦 <strong>التسمية المصححة:</strong> {translateToArabic(seg.correctedLabel)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Visual Evidence / Proof Box */}
                      {seg.visualEvidence && (
                        <div className="mt-2 text-xs bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-2.5 rounded-lg text-slate-700 dark:text-slate-300 flex items-start gap-2">
                          <Eye className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-brand-700 dark:text-brand-300">Visual Evidence: </span>
                            <span>{seg.visualEvidence}</span>
                            {isArabic && (
                              <p className="mt-1 text-amber-900 dark:text-amber-200/90 font-sans dir-rtl bg-amber-50 dark:bg-slate-900/80 p-1.5 rounded border border-amber-200 dark:border-amber-500/20">
                                🇸🇦 <strong>الملاحظة البصرية:</strong> {translateToArabic(seg.visualEvidence)}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleRemoveSegment(seg.id)}
                      className="text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 p-1.5 rounded-lg transition-colors self-end md:self-center"
                      title="Remove segment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500 dark:text-red-400" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

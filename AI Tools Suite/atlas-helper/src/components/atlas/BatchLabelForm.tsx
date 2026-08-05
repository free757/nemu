"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { parseBulkSegmentsText, parseTimeRange } from "@/lib/utils";
import { ApiResponse, CorrectLabelsResponse, SegmentItem } from "@/types/atlas";
import { DEFAULT_ATLAS_SYSTEM_PROMPT } from "@/constants/atlas-prompts";
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
} from "lucide-react";

interface BatchLabelFormProps {
  fileUri: string | null;
  isLoaded: boolean;
}

export const BatchLabelForm: React.FC<BatchLabelFormProps> = ({ fileUri, isLoaded }) => {
  const [segments, setSegments] = useState<SegmentItem[]>([]);
  const [bulkText, setBulkText] = useState<string>("");
  const [customPrompt, setCustomPrompt] = useState<string>(DEFAULT_ATLAS_SYSTEM_PROMPT);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Parse bulk text whenever changed
  const handleBulkTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setBulkText(text);
    const parsed = parseBulkSegmentsText(text);
    if (parsed.length > 0) {
      setSegments(parsed);
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

  const handleCorrectAll = async () => {
    if (!fileUri) {
      setError("Please load a video URL first.");
      return;
    }

    if (segments.length === 0) {
      setError("Please add at least one segment to correct.");
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
          segments,
          customPrompt: showSettings ? customPrompt : undefined,
        }),
      });

      const result: ApiResponse<CorrectLabelsResponse> = await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || "Failed to correct labels.");
      }

      // Map corrected labels back to segments
      const correctedMap = new Map(
        result.data.segments.map((res) => [res.id, res.correctedLabel])
      );

      setSegments((prev) =>
        prev.map((s) => ({
          ...s,
          correctedLabel: correctedMap.get(s.id) || s.currentLabel,
          status: "success",
        }))
      );
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during AI label correction.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Settings Toggle Bar */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-brand-500" />
          <h2 className="text-base font-semibold text-white">2. Action Labels & Segments</h2>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <Settings2 className="w-4 h-4" />
          <span>{showSettings ? "Hide Rules" : "Edit Rubric Prompt"}</span>
        </button>
      </div>

      {/* Custom Prompt Settings Modal/Panel */}
      {showSettings && (
        <div className="bg-slate-950 border border-brand-500/30 p-4 rounded-xl space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-brand-400 uppercase tracking-wider">
              System Prompt & Rubric Instructions
            </label>
            <button
              onClick={() => setCustomPrompt(DEFAULT_ATLAS_SYSTEM_PROMPT)}
              className="text-xs text-slate-400 hover:text-white underline"
            >
              Reset to Default
            </button>
          </div>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={8}
            className="w-full p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      )}

      {/* Bulk Input Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand-500" />
            Bulk Paste Segments Text (Time Ranges + Current Labels)
          </label>
          <span className="text-xs text-slate-400">
            {segments.length} segment(s) detected
          </span>
        </div>
        <textarea
          value={bulkText}
          onChange={handleBulkTextChange}
          placeholder={`Paste your segment text block here, e.g.:\n\n0:00.00–0:03.00\npick up and place wrench with right hand\n\n0:03.00–0:07.33\npick up and place wrench with right hand`}
          rows={5}
          className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all font-mono"
        />
      </div>

      {/* Segments Cards / Edit List */}
      {segments.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-300">Parsed Segments to Process</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddSingleSegment}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Add Segment
            </Button>
          </div>

          <div className="grid gap-4">
            {segments.map((seg, index) => (
              <div
                key={seg.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 transition-all hover:border-slate-700"
              >
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  <div className="space-y-2 flex-1 w-full">
                    <div className="flex items-center gap-2 text-xs font-mono text-brand-400 bg-brand-950/60 border border-brand-800/40 px-2.5 py-1 rounded-md w-fit">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        Segment {index + 1}: {seg.startTime} – {seg.endTime}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Current AI Label
                        </label>
                        <input
                          type="text"
                          value={seg.currentLabel}
                          onChange={(e) =>
                            handleUpdateSegment(seg.id, "currentLabel", e.target.value)
                          }
                          className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                      </div>

                      {seg.correctedLabel && (
                        <div>
                          <label className="block text-[11px] font-medium text-emerald-400 mb-1">
                            Gemini Corrected Label
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value={seg.correctedLabel}
                              className="w-full px-3 py-1.5 bg-emerald-950/30 border border-emerald-800/50 rounded-md text-xs text-emerald-300 font-mono font-semibold focus:outline-none"
                            />
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleCopy(seg.id, seg.correctedLabel!)}
                              icon={
                                copiedId === seg.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                                )
                              }
                            >
                              {copiedId === seg.id ? "Copied" : "Copy"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveSegment(seg.id)}
                    className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg transition-colors self-end md:self-center"
                    title="Remove segment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <Button
              variant="primary"
              size="lg"
              className="w-full shadow-lg shadow-brand-600/25"
              onClick={handleCorrectAll}
              isLoading={isLoading}
              disabled={!isLoaded}
              icon={<Sparkles className="w-5 h-5 text-amber-300" />}
            >
              Verify & Correct All Segments with Gemini 2.5 Pro
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-lg text-xs text-red-400">
          {error}
        </div>
      )}
    </div>
  );
};

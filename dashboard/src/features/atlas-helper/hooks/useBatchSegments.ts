"use client";

import React, { useState, useCallback } from "react";
import { SegmentItem, ApiResponse, CorrectLabelsResponse } from "../types/atlas";
import { parseBulkSegmentsText } from "../lib/utils";

interface UseBatchSegmentsProps {
  fileUri: string | null;
  videoUrl?: string;
}

export function useBatchSegments({ fileUri, videoUrl }: UseBatchSegmentsProps) {
  const [segments, setSegments] = useState<SegmentItem[]>([]);
  const [bulkText, setBulkText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingSegmentId, setLoadingSegmentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);
  const [arabicMap, setArabicMap] = useState<Record<string, boolean>>({});

  const setDirectBulkText = useCallback((text: string) => {
    setBulkText(text);
    if (!text.trim()) {
      setSegments([]);
      return;
    }
    const parsed = parseBulkSegmentsText(text);
    setSegments(parsed);
  }, []);

  const handleBulkTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDirectBulkText(e.target.value);
  }, [setDirectBulkText]);

  const handleUpdateSegment = useCallback((id: string, field: keyof SegmentItem, value: string) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  }, []);

  const handleRemoveSegment = useCallback((id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleAddSingleSegment = useCallback(() => {
    const newId = `seg-${Date.now()}`;
    const newSegment: SegmentItem = {
      id: newId,
      startTime: "0:00.00",
      endTime: "0:05.00",
      currentLabel: "pick up object with right hand",
    };
    setSegments((prev) => [...prev, newSegment]);
  }, []);

  const handleCopy = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleReset = useCallback(() => {
    setBulkText("");
    setSegments([]);
    setError(null);
    setCopiedId(null);
    setCopiedReport(false);
    setArabicMap({});
  }, []);

  const toggleArabicTranslation = useCallback((id: string) => {
    setArabicMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleCopyFullReport = useCallback(() => {
    if (segments.length === 0) return;

    const reportText = segments
      .map((s) => {
        const label = s.correctedLabel || s.currentLabel;
        return `${s.startTime}–${s.endTime}\n${label}`;
      })
      .join("\n\n");

    navigator.clipboard.writeText(reportText);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  }, [segments]);

  const handleCorrectAll = useCallback(async () => {
    if (!fileUri) {
      setError("Please load a video URL first before validating.");
      return;
    }
    if (segments.length === 0) {
      setError("Please paste or add at least one segment.");
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
          videoUrl,
        }),
      });

      const result: ApiResponse<CorrectLabelsResponse> = await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || "Failed to process segments with Gemini.");
      }

      const resultMap = new Map(result.data.segments.map((r) => [r.id, r]));

      setSegments((prev) =>
        prev.map((s) => {
          const match = resultMap.get(s.id);
          if (match) {
            return {
              ...s,
              correctedLabel: match.correctedLabel,
              visualEvidence: match.visualEvidence,
              analysisMode: match.analysisMode,
              usedModel: match.usedModel,
            };
          }
          return s;
        })
      );
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during correction.");
    } finally {
      setIsLoading(false);
    }
  }, [fileUri, segments, videoUrl]);

  const handleCorrectSingleSegment = useCallback(
    async (segId: string) => {
      if (!fileUri) {
        setError("Please load a video URL first before validating.");
        return;
      }
      const targetSegment = segments.find((s) => s.id === segId);
      if (!targetSegment) return;

      setLoadingSegmentId(segId);
      setError(null);

      try {
        const response = await fetch("/api/correct-label", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileUri,
            segments: [targetSegment],
            videoUrl,
          }),
        });

        const result: ApiResponse<CorrectLabelsResponse> = await response.json();

        if (!response.ok || !result.success || !result.data || result.data.segments.length === 0) {
          throw new Error(result.error || "Failed to re-validate segment.");
        }

        const match = result.data.segments[0];

        setSegments((prev) =>
          prev.map((s) =>
            s.id === segId
              ? {
                  ...s,
                  correctedLabel: match.correctedLabel,
                  visualEvidence: match.visualEvidence,
                  analysisMode: match.analysisMode,
                  usedModel: match.usedModel,
                }
              : s
          )
        );
      } catch (err: any) {
        setError(err.message || "Failed to re-validate segment.");
      } finally {
        setLoadingSegmentId(null);
      }
    },
    [fileUri, segments, videoUrl]
  );

  return {
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
  };
}

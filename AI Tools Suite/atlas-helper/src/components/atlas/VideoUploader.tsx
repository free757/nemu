"use client";

import React, { useState } from "react";
import { Button } from "./ui/Button";
import { Video, CheckCircle2, AlertCircle, Link2, X, Clipboard, ArrowRight } from "lucide-react";
import { ApiResponse, UploadVideoResponse } from "../types/atlas";

interface VideoUploaderProps {
  onVideoLoaded: (fileUri: string, videoUrl: string) => void;
  isLoaded: boolean;
  loadedUrl?: string;
  fileUri?: string | null;
  videoUrl?: string;
  onVideoUrlChange?: (url: string) => void;
  onClear?: () => void;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({
  onVideoLoaded,
  isLoaded,
  loadedUrl,
  fileUri,
  videoUrl: controlledUrl,
  onVideoUrlChange,
  onClear,
}) => {
  const [internalUrl, setInternalUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const currentUrl = controlledUrl !== undefined ? controlledUrl : internalUrl;

  const handleUrlChange = (val: string) => {
    if (onVideoUrlChange) {
      onVideoUrlChange(val);
    } else {
      setInternalUrl(val);
    }
  };

  const handlePasteUrl = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        handleUrlChange(text.trim());
      }
    } catch (err) {
      console.error("Failed to read clipboard:", err);
    }
  };

  const handleClear = () => {
    handleUrlChange("");
    setError(null);
    if (onClear) {
      onClear();
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUrl.trim()) {
      setError("Please paste a valid Cloudflare R2 video URL.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/upload-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: currentUrl.trim() }),
      });

      const result: ApiResponse<UploadVideoResponse> = await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || "Failed to upload video to Gemini File API.");
      }

      onVideoLoaded(result.data.fileUri, currentUrl.trim());
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred while loading video.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm dark:shadow-lg transition-colors">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="p-2 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-lg shrink-0">
            <Video className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white truncate">
              1. Cloudflare R2 Video URL
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 hidden xs:block truncate">
              Paste the video link once for Gemini analysis
            </p>
          </div>
        </div>

        {(currentUrl.length > 0 || isLoaded) && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 font-medium flex items-center gap-1 transition-colors px-2 py-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30 shrink-0"
            title="مسح رابط الفيديو وتفريغ الحقل"
            aria-label="مسح رابط الفيديو"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">مسح الرابط</span>
          </button>
        )}
      </div>

      <form onSubmit={handleUpload} className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
            <Link2 className="w-4 h-4" />
          </div>
          <input
            type="url"
            value={currentUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://data...r2.cloudflarestorage.com/episodes/video.mp4?..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handlePasteUrl}
            icon={<Clipboard className="w-4 h-4 text-brand-600 dark:text-brand-400" />}
            title="لصق الرابط من الحافظة مباشرة"
            aria-label="لصق الرابط من الحافظة"
            className="flex-1 sm:flex-initial"
          >
            <span className="hidden sm:inline">لصق الرابط</span>
          </Button>

          <Button
            type="submit"
            variant={isLoaded ? "secondary" : "primary"}
            isLoading={isLoading}
            icon={isLoaded ? <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> : <ArrowRight className="w-4 h-4" />}
            title={isLoaded ? "إعادة تحميل الفيديو" : "تحميل الفيديو"}
            className="flex-1 sm:flex-initial"
          >
            <span>{isLoaded ? "إعادة التحميل" : "تحميل"}</span>
          </Button>
        </div>
      </form>

      {isLoaded && loadedUrl && (
        <div className={`mt-3 flex items-center gap-2 text-[11px] sm:text-xs px-3 py-2 rounded-lg border ${
          fileUri?.startsWith('text-rubric-')
            ? 'text-amber-800 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/40 dark:border-amber-800/40'
            : 'text-emerald-800 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800/40'
        }`}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="truncate">
            {fileUri?.startsWith('text-rubric-')
              ? `✍️ Text Rubric Mode active`
              : `👁️ Video active in Gemini memory: ${loadedUrl.slice(0, 50)}...`
            }
          </span>
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 dark:text-red-400 dark:bg-red-950/40 dark:border-red-800/40 px-3 py-2 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

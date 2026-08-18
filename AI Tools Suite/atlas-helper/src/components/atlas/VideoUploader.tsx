"use client";

import React, { useState } from "react";
import { Button } from "./ui/Button";
import { Video, CheckCircle2, AlertCircle, Link2 } from "lucide-react";
import { ApiResponse, UploadVideoResponse } from "../types/atlas";

interface VideoUploaderProps {
  onVideoLoaded: (fileUri: string, videoUrl: string) => void;
  isLoaded: boolean;
  loadedUrl?: string;
  fileUri?: string | null;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({
  onVideoLoaded,
  isLoaded,
  loadedUrl,
  fileUri,
}) => {
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl.trim()) {
      setError("Please paste a valid Cloudflare R2 video URL.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/upload-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: videoUrl.trim() }),
      });

      const result: ApiResponse<UploadVideoResponse> = await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || "Failed to upload video to Gemini File API.");
      }

      onVideoLoaded(result.data.fileUri, videoUrl.trim());
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred while loading video.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm dark:shadow-lg transition-colors">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-lg">
          <Video className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">1. Cloudflare R2 Video URL</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Paste the video link once. It will be uploaded and stored for Gemini analysis.
          </p>
        </div>
      </div>

      <form onSubmit={handleUpload} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
            <Link2 className="w-4 h-4" />
          </div>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://data...r2.cloudflarestorage.com/episodes/video.mp4?..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
            disabled={isLoading}
          />
        </div>

        <Button
          type="submit"
          variant={isLoaded ? "secondary" : "primary"}
          isLoading={isLoading}
          icon={isLoaded ? <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> : undefined}
        >
          {isLoaded ? "Reload Video" : "Load Video"}
        </Button>
      </form>

      {isLoaded && loadedUrl && (
        <div className={`mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
          fileUri?.startsWith('text-rubric-')
            ? 'text-amber-800 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/40 dark:border-amber-800/40'
            : 'text-emerald-800 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800/40'
        }`}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="truncate">
            {fileUri?.startsWith('text-rubric-')
              ? `✍️ Text Rubric Mode (Gemini key not found — check GEMINI_API_KEY_1 in Vercel)`
              : `👁️ Video active in Gemini memory: ${loadedUrl.slice(0, 70)}...`
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

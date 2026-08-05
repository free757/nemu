"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Video, CheckCircle2, AlertCircle, Link2 } from "lucide-react";
import { ApiResponse, UploadVideoResponse } from "@/types/atlas";

interface VideoUploaderProps {
  onVideoLoaded: (fileUri: string, videoUrl: string) => void;
  isLoaded: boolean;
  loadedUrl?: string;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({
  onVideoLoaded,
  isLoaded,
  loadedUrl,
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
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-brand-500/10 text-brand-500 rounded-lg">
          <Video className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">1. Cloudflare R2 Video URL</h2>
          <p className="text-xs text-slate-400">
            Paste the video link once. It will be uploaded and stored for Gemini analysis.
          </p>
        </div>
      </div>

      <form onSubmit={handleUpload} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Link2 className="w-4 h-4" />
          </div>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://data...r2.cloudflarestorage.com/episodes/video.mp4?..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
            disabled={isLoading}
          />
        </div>

        <Button
          type="submit"
          variant={isLoaded ? "secondary" : "primary"}
          isLoading={isLoading}
          icon={isLoaded ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : undefined}
        >
          {isLoaded ? "Reload Video" : "Load Video"}
        </Button>
      </form>

      {isLoaded && loadedUrl && (
        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-3 py-2 rounded-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="truncate">Video active in Gemini memory: {loadedUrl}</span>
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-center gap-2 text-xs text-red-400 bg-red-950/40 border border-red-800/40 px-3 py-2 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

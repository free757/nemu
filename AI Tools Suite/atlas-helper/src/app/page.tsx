"use client";

import React, { useState } from "react";
import { VideoUploader } from "@/components/atlas/VideoUploader";
import { BatchLabelForm } from "@/components/atlas/BatchLabelForm";
import { Sparkles, ShieldCheck, Cpu } from "lucide-react";

export default function HomePage() {
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string>("");

  const handleVideoLoaded = (uri: string, url: string) => {
    setFileUri(uri);
    setLoadedUrl(url);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-md shadow-brand-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Atlas Helper
                <span className="text-[10px] font-semibold text-brand-400 bg-brand-950 border border-brand-800 px-2 py-0.5 rounded-full">
                  Gemini 2.5 Pro
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Action Label Validator & Corrector for Atlas Capture
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Strict Atlas Rubric</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-brand-400" />
              <span>File API In-Memory</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Step 1: Video Link Uploader */}
        <VideoUploader
          onVideoLoaded={handleVideoLoaded}
          isLoaded={Boolean(fileUri)}
          loadedUrl={loadedUrl}
        />

        {/* Step 2: Batch Segments Form */}
        <BatchLabelForm fileUri={fileUri} isLoaded={Boolean(fileUri)} />
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        Atlas Helper &copy; {new Date().getFullYear()} — Production Ready for AI Tools Suite
      </footer>
    </main>
  );
}

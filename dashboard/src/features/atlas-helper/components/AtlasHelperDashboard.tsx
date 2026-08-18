"use client";

import React, { useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { AtlasHeader } from "./AtlasHeader";
import { VideoUploader } from "./VideoUploader";
import { BatchLabelForm } from "./BatchLabelForm";
import { NotesDrawer } from "./NotesDrawer";

export default function AtlasHelperDashboard() {
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string>("");
  const [videoInputUrl, setVideoInputUrl] = useState<string>("");
  const [resetKey, setResetKey] = useState<number>(0);
  const [isNotesOpen, setIsNotesOpen] = useState<boolean>(false);
  const { theme, isDark, toggleTheme } = useTheme();

  const handleVideoLoaded = (uri: string, url: string) => {
    setFileUri(uri);
    setLoadedUrl(url);
    setVideoInputUrl(url);
  };

  const handleResetAll = () => {
    setFileUri(null);
    setLoadedUrl("");
    setVideoInputUrl("");
    setResetKey((prev) => prev + 1);
  };

  return (
    <div className={isDark ? "dark" : ""}>
      <main className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
        {/* Navigation Bar */}
        <AtlasHeader
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenNotes={() => setIsNotesOpen(true)}
          onResetAll={handleResetAll}
        />

        {/* Core Content Container */}
        <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Step 1: Video Link Uploader */}
          <VideoUploader
            onVideoLoaded={handleVideoLoaded}
            isLoaded={Boolean(fileUri)}
            loadedUrl={loadedUrl}
            fileUri={fileUri}
            videoUrl={videoInputUrl}
            onVideoUrlChange={setVideoInputUrl}
            onClear={() => {
              setFileUri(null);
              setLoadedUrl("");
              setVideoInputUrl("");
            }}
          />

          {/* Step 2: Batch Segments Verification */}
          <BatchLabelForm
            fileUri={fileUri}
            isLoaded={Boolean(fileUri)}
            videoUrl={loadedUrl}
            resetKey={resetKey}
          />
        </div>

        {/* Shared Notes Drawer */}
        <NotesDrawer isOpen={isNotesOpen} onClose={() => setIsNotesOpen(false)} />

        {/* Global Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 py-4 text-center text-xs text-slate-500 transition-colors">
          Atlas Helper &copy; {new Date().getFullYear()} — Production Ready for AI Tools Suite
        </footer>
      </main>
    </div>
  );
}

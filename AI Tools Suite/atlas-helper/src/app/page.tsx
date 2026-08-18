"use client";

import React, { useState, useEffect } from "react";
import { VideoUploader } from "../components/atlas/VideoUploader";
import { BatchLabelForm } from "../components/atlas/BatchLabelForm";
import { NotesDrawer } from "../components/atlas/NotesDrawer";
import { Sparkles, ShieldCheck, Cpu, Notebook, Sun, Moon } from "lucide-react";

export default function HomePage() {
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string>("");
  const [isNotesOpen, setIsNotesOpen] = useState<boolean>(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem("atlas_theme") as "dark" | "light" | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("atlas_theme", nextTheme);
  };

  const handleVideoLoaded = (uri: string, url: string) => {
    setFileUri(uri);
    setLoadedUrl(url);
  };

  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <main className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
        {/* Header Bar */}
        <header className="border-b border-slate-200 dark:border-slate-800 bg-white/85 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 transition-colors">
          <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-md shadow-brand-500/20 text-white">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  Atlas Helper
                  <span className="text-[10px] font-semibold text-brand-700 bg-brand-50 border border-brand-200 dark:text-brand-400 dark:bg-brand-950 dark:border-brand-800 px-2 py-0.5 rounded-full">
                    Gemini 2.5 Pro
                  </span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Action Label Validator & Corrector for Atlas Capture
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
                title={theme === "dark" ? "التبديل إلى الوضع النهاري (Light Mode)" : "التبديل إلى الوضع الليلي (Dark Mode)"}
              >
                {theme === "dark" ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />
                    <span className="hidden sm:inline">الوضع النهاري</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-indigo-600" />
                    <span className="hidden sm:inline">الوضع الليلي</span>
                  </>
                )}
              </button>

              {/* Shared Notes Drawer Button */}
              <button
                onClick={() => setIsNotesOpen(true)}
                className="flex items-center gap-1.5 text-xs text-slate-800 dark:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-lg transition-colors font-semibold"
              >
                <Notebook className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <span>درج الملاحظات</span>
              </button>

              <div className="hidden md:flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Strict Atlas Rubric</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                  <span>File API In-Memory</span>
                </div>
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
            fileUri={fileUri}
          />

          {/* Step 2: Batch Segments Form */}
          <BatchLabelForm fileUri={fileUri} isLoaded={Boolean(fileUri)} videoUrl={loadedUrl} />
        </div>

        {/* Shared Notes Drawer */}
        <NotesDrawer isOpen={isNotesOpen} onClose={() => setIsNotesOpen(false)} />

        {/* Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 py-4 text-center text-xs text-slate-500 transition-colors">
          Atlas Helper &copy; {new Date().getFullYear()} — Production Ready for AI Tools Suite
        </footer>
      </main>
    </div>
  );
}

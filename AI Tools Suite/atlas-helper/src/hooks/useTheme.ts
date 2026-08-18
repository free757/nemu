"use client";

import { useState, useEffect, useCallback } from "react";

export type ThemeMode = "dark" | "light";

const THEME_STORAGE_KEY = "atlas_theme";

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }, []);

  return {
    theme,
    isDark: theme === "dark",
    toggleTheme,
  };
}

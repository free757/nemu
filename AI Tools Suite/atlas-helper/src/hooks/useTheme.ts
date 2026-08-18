"use client";

import { useState, useEffect, useCallback } from "react";

export type ThemeMode = "dark" | "light";

const THEME_STORAGE_KEY = "atlas_theme";

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    const initialTheme = saved === "light" ? "light" : "dark";
    setTheme(initialTheme);

    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_STORAGE_KEY, next);

      if (next === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }

      return next;
    });
  }, []);

  return {
    theme,
    isDark: theme === "dark",
    isMounted,
    toggleTheme,
  };
}

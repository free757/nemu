"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";

export interface NoteItem {
  id: number;
  title: string;
  content: string;
  created_at: string;
}

export function useSharedNotes(isOpen: boolean) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Record<number, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const fetchNotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("shared_notes")
        .select("*")
        .order("created_at", { ascending: false });

      if (err) throw err;
      setNotes(data || []);
    } catch (err: any) {
      setError(err.message || "فشل تحميل الملاحظات.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchNotes();
    }
  }, [isOpen, fetchNotes]);

  const addNote = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim() || !content.trim()) return;

      setIsSaving(true);
      setError(null);
      try {
        const { data, error: err } = await supabase
          .from("shared_notes")
          .insert([{ title: title.trim(), content: content.trim() }])
          .select();

        if (err) throw err;

        if (data && data[0]) {
          setNotes((prev) => [data[0] as NoteItem, ...prev]);
        } else {
          await fetchNotes();
        }
        setTitle("");
        setContent("");
      } catch (err: any) {
        setError(err.message || "فشل حفظ الملاحظة.");
      } finally {
        setIsSaving(false);
      }
    },
    [title, content, fetchNotes]
  );

  const deleteNote = useCallback(async (id: number) => {
    if (!window.confirm("هل أنت متأكد من حذف هذه الملاحظة؟")) return;

    setError(null);
    try {
      const { error: err } = await supabase
        .from("shared_notes")
        .delete()
        .eq("id", id);

      if (err) throw err;
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err: any) {
      setError(err.message || "فشل حذف الملاحظة.");
    }
  }, []);

  const toggleExpand = useCallback((id: number) => {
    setExpandedNotes((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  }, [notes, searchQuery]);

  return {
    notes: filteredNotes,
    totalNotesCount: notes.length,
    title,
    setTitle,
    content,
    setContent,
    isLoading,
    isSaving,
    error,
    searchQuery,
    setSearchQuery,
    expandedNotes,
    toggleExpand,
    fetchNotes,
    addNote,
    deleteNote,
  };
}

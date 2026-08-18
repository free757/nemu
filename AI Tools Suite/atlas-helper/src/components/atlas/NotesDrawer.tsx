"use client";

import React from "react";
import {
  Notebook,
  X,
  Plus,
  Trash2,
  Save,
  RotateCw,
  AlertCircle,
  FileText,
  Search,
} from "lucide-react";
import { useSharedNotes } from "../hooks/useSharedNotes";

interface NotesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotesDrawer: React.FC<NotesDrawerProps> = ({ isOpen, onClose }) => {
  const {
    notes,
    totalNotesCount,
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
  } = useSharedNotes(isOpen);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[999] transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 z-[1000] shadow-2xl flex flex-col transition-transform duration-300 animate-slide-in">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
              <Notebook className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">درج الملاحظات المشتركة</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">ملاحظات يراها ويشاركها جميع أعضاء الفريق</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={fetchNotes}
              className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="تحديث الملاحظات"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? "animate-spin text-brand-500" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6 text-slate-700 dark:text-slate-200 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-500/30 dark:text-red-200 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Add New Note Form */}
          <form onSubmit={addNote} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة ملاحظة جديدة للجميع</span>
            </h3>

            <div className="space-y-1">
              <label className="block text-[10px] text-slate-600 dark:text-slate-400 font-medium">عنوان الملاحظة</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: كود الخياطة الجديد، كليب البراغي..."
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] text-slate-600 dark:text-slate-400 font-medium">الملاحظة التفصيلية</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="اكتب هنا الملاحظات، الليبلز، أو التنبيهات..."
                rows={3}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-y"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-2 px-4 bg-brand-600 hover:bg-brand-500 disabled:bg-brand-800 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-brand-500/20"
            >
              {isSaving ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>حفظ الملاحظة للجميع</span>
            </button>
          </form>

          {/* Notes List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-brand-500" />
                <span>الملاحظات المسجلة ({totalNotesCount})</span>
              </h3>
            </div>

            {totalNotesCount > 3 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث في الملاحظات..."
                  className="w-full pl-3 pr-8 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            )}

            {isLoading && totalNotesCount === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">جاري تحميل الملاحظات...</div>
            ) : totalNotesCount === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
                لا توجد ملاحظات مسجلة بعد. كن أول من يضيف ملاحظة!
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-800 rounded-xl p-4 space-y-2 relative group transition-all"
                  >
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-md transition-all opacity-0 group-hover:opacity-100"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <h4 className="text-xs font-bold text-brand-700 dark:text-brand-300 pr-8 flex items-center gap-1">
                      <span>📌</span>
                      <span>{note.title}</span>
                    </h4>

                    {(() => {
                      const isLong = note.content.length > 120 || note.content.split("\n").length > 3;
                      const isExpanded = !!expandedNotes[note.id];

                      let displayedContent = note.content;
                      if (isLong && !isExpanded) {
                        const lines = note.content.split("\n");
                        if (lines.length > 3) {
                          displayedContent = lines.slice(0, 3).join("\n");
                        }
                        if (displayedContent.length > 120) {
                          displayedContent = displayedContent.slice(0, 120) + "...";
                        } else if (lines.length > 3) {
                          displayedContent += "...";
                        }
                      }

                      return (
                        <div className="space-y-1">
                          <div
                            className={`text-xs text-slate-800 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-sans scrollbar-thin ${
                              isExpanded ? "max-h-48 overflow-y-auto pr-1.5 scrollbar-thumb-slate-400 dark:scrollbar-thumb-slate-800 scrollbar-track-transparent" : ""
                            }`}
                          >
                            {displayedContent}
                          </div>
                          {isLong && (
                            <button
                              onClick={() => toggleExpand(note.id)}
                              className="text-[10px] text-brand-600 dark:text-brand-400 hover:underline font-bold focus:outline-none mt-1 select-none"
                            >
                              {isExpanded ? "عرض أقل ▲" : "عرض المزيد ▼"}
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-900">
                      <span>ملاحظة مشتركة</span>
                      <span>
                        {new Date(note.created_at).toLocaleDateString("ar-EG", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

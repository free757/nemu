"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../../../../src/lib/supabase";
import {
  Notebook,
  X,
  Plus,
  Trash2,
  Save,
  RotateCw,
  AlertCircle,
  FileText,
  BookOpen,
  Ban,
  CheckCircle2,
  Sparkles,
  Info,
  Copy,
  Check,
  Search
} from "lucide-react";

interface NoteItem {
  id: number;
  title: string;
  content: string;
  created_at: string;
}

interface NotesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const BANNED_WORDS_DATA = [
  {
    banned: "inspect",
    alternatives: "look at, hold, pick up",
    meaning: "صف الفعل الحركي الفيزيائي الذي حدث فعلاً ولا تصف مجرد النظر/الإدراك.",
  },
  {
    banned: "adjust",
    alternatives: "slide, align, rotate, flatten, tighten, fold, tuck, squeeze",
    meaning: "حدد حركة التعديل الميكانيكية بالضبط (لف، شد، طي، سحب...).",
  },
  {
    banned: "reach",
    alternatives: "pick up, hold, touch, open",
    meaning: "لا تصف مجرد مد اليد في الهواء، بل صف الفعل المكتمل عند التفاعل.",
  },
  {
    banned: "manipulate",
    alternatives: "slide, rotate, fold, squeeze أو أي حركة محددة",
    meaning: "استخدم اسم الحركة الحقيقية وتجنب الكلمات العامة الفضفاضة.",
  },
  {
    banned: "tool",
    alternatives: "spoon, cloth, lid, bottle, hoe, shears, screwdriver",
    meaning: "اذكر اسم الشيء/الأداة الصريح بدلاً من كلمة أداة عامة.",
  },
  {
    banned: "grab",
    alternatives: "pick up",
    meaning: "استخدم الفعل القياسي المعتمد لأطلس وهو pick up للرفع والالتقاط.",
  },
];

const CORE_VERBS_DATA = [
  { verb: "pick up", arabic: "يرفع أو يأخذ شيء من سطح", usage: "pick up [object] with [hand]" },
  { verb: "hold", arabic: "يمسك أو يثبت شيء أثناء عمل اليد الأخرى", usage: "hold [object] with [hand]" },
  { verb: "slide", arabic: "يحرك أو يسحب شيء على سطح", usage: "slide [object] with [hand]" },
  { verb: "align", arabic: "يحاذي شيئين معاً بدقة (مثل الورق قبل القَص)", usage: "align [objects] with both hands" },
  { verb: "rotate", arabic: "يلف أو يدير شيء في يده أو على سطح", usage: "rotate [object] with [hand]" },
  { verb: "flatten / smoothen", arabic: "يفرد شيء (flatten للصلب/الورق و smoothen للأقمشة)", usage: "smoothen cloth with right hand" },
  { verb: "tighten", arabic: "يشد أو يُحكم ربط شيء (برغي، غطاء)", usage: "tighten [object] with [hand]" },
  { verb: "fold", arabic: "يطوي شيء (قماش، ورق، سلك)", usage: "fold [object] with [hand]" },
  { verb: "tuck", arabic: "يدس أو يُدخل طرف شيء داخل شيء آخر", usage: "tuck [object] into [container]" },
  { verb: "squeeze", arabic: "يعصر أو يضغط بأصابعه/يده", usage: "squeeze [object] with [hand]" },
  { verb: "pass", arabic: "ينقل الشيء من يد لأخرى صراحة", usage: "pass [object] from right hand to left hand" },
  { verb: "place", arabic: "يضع الشيء على سطح/مكان محدد", usage: "place [object] on table with [hand]" },
  { verb: "wipe", arabic: "يمسح وينظف سطح شيء", usage: "wipe [object] with cloth in right hand" },
];

export const NotesDrawer: React.FC<NotesDrawerProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<"guide" | "notes">("guide");
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Record<number, boolean>>({});
  const [copiedVerb, setCopiedVerb] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchNotes = async () => {
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
      setError(err.message || "Failed to load notes.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === "notes") {
      fetchNotes();
    }
  }, [isOpen, activeTab]);

  const handleCopyVerb = (verb: string) => {
    navigator.clipboard.writeText(verb);
    setCopiedVerb(verb);
    setTimeout(() => setCopiedVerb(null), 1500);
  };

  const handleAddNote = async (e: React.FormEvent) => {
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
      setError(err.message || "Failed to save note.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async (id: number) => {
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
      setError(err.message || "Failed to delete note.");
    }
  };

  if (!isOpen) return null;

  const filteredVerbs = CORE_VERBS_DATA.filter(
    (v) =>
      v.verb.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.arabic.includes(searchQuery)
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[999] transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[540px] bg-slate-900 border-l border-slate-800 z-[1000] shadow-2xl flex flex-col transition-transform duration-300 animate-slide-in">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Atlas Reference & Notes</h2>
              <p className="text-[11px] text-slate-400">الدليل المرجعي لمعايير أطلس والملاحظات</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {activeTab === "notes" && (
              <button
                onClick={fetchNotes}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title="تحديث الملاحظات"
              >
                <RotateCw className={`w-4 h-4 ${isLoading ? "animate-spin text-brand-400" : ""}`} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 p-2 bg-slate-950/60 border-b border-slate-800 gap-1.5 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("guide")}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
              activeTab === "guide"
                ? "bg-brand-600 text-white shadow-md shadow-brand-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>دليل القواعد والأفعال المعتمدة</span>
          </button>

          <button
            onClick={() => setActiveTab("notes")}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
              activeTab === "notes"
                ? "bg-brand-600 text-white shadow-md shadow-brand-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Notebook className="w-3.5 h-3.5" />
            <span>الملاحظات المشتركة ({notes.length})</span>
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6 text-slate-200 text-xs">
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-500/30 text-red-200 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === "guide" && (
            <div className="space-y-6">
              {/* Banned Words Card */}
              <div className="bg-slate-950 border border-red-900/30 rounded-xl p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-red-950/60">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                      <Ban className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="font-bold text-red-300 text-xs tracking-wide">
                      الكلمات الممنوعة (Banned Words) والبديل الصحيح
                    </h3>
                  </div>
                  <span className="text-[10px] text-red-400 font-semibold bg-red-950/60 px-2 py-0.5 rounded border border-red-900/40">
                    ممنوع نهائياً
                  </span>
                </div>

                <div className="space-y-2.5">
                  {BANNED_WORDS_DATA.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-lg space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-900/40 text-[11px]">
                            ❌ {item.banned}
                          </span>
                          <span className="text-slate-500 text-[10px]">استخدم بدلها:</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/40 text-[11px]">
                          ✅ {item.alternatives}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed pr-1">
                        💡 {item.meaning}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Core Actions Mapping */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="font-bold text-white text-xs tracking-wide">
                      أهم مجموعة أفعال للحفظ (Action Verbs)
                    </h3>
                  </div>
                  <span className="text-[10px] text-brand-400 font-semibold bg-brand-950/60 px-2 py-0.5 rounded border border-brand-800/40">
                    {CORE_VERBS_DATA.length} أفعال معتمدة
                  </span>
                </div>

                {/* Quick Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث عن فعل أو حركة بالعربية أو الإنجليزية..."
                    className="w-full pl-3 pr-8 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                <div className="space-y-2">
                  {filteredVerbs.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 rounded-lg flex items-center justify-between transition-all"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-brand-400 text-xs">
                            {item.verb}
                          </span>
                          <span className="text-slate-300 text-[11px] font-medium">
                            {item.arabic}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {item.usage}
                        </div>
                      </div>

                      <button
                        onClick={() => handleCopyVerb(item.verb)}
                        className="p-1.5 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700 rounded-md transition-colors shrink-0"
                        title="نسخ الفعل"
                      >
                        {copiedVerb === item.verb ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Golden Rules Reminder */}
              <div className="bg-gradient-to-br from-indigo-950/30 to-brand-950/20 border border-indigo-900/30 rounded-xl p-4 space-y-2.5">
                <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-indigo-400" />
                  <span>قواعد ذهبية لا تنساها (Golden Rules)</span>
                </h4>
                <ul className="space-y-1.5 text-[11px] text-slate-300 list-disc list-inside leading-relaxed">
                  <li><strong className="text-white">One Hand = One Action:</strong> اليد الواحدة لا تأخذ فعلين في نفس الحركة (مثل: wipe cloth وليس hold cloth + wipe).</li>
                  <li><strong className="text-white">حذف أدوات التعريف:</strong> ممنوع (the, a, an, his, their) — اكتب <span className="font-mono text-brand-300">pick up bottle with right hand</span> مباشرة.</li>
                  <li><strong className="text-white">تطابق مسميات الأشياء:</strong> إذا بدأت بـ <span className="font-mono text-brand-300">book</span> لا تبدلها بـ <span className="font-mono text-red-300">page</span> في نفس الليبل.</li>
                  <li><strong className="text-white">توثيق النقل بين اليدين:</strong> دائماً اكتب <span className="font-mono text-brand-300">pass [object] from right hand to left hand</span> إذا انتقل الغرض بين اليدين.</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === "notes" && (
            <div className="space-y-6">
              {/* Add New Note Form */}
              <form onSubmit={handleAddNote} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-semibold text-brand-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة ملاحظة جديدة</span>
                </h3>

                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-400 font-medium">عنوان الملاحظة</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثال: كود الخياطة الجديد..."
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-400 font-medium">الملاحظة التفصيلية</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="اكتب هنا الملاحظات أو الأكواد المرجعية للتسهيل على الجميع..."
                    rows={3}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-y"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20"
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
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-brand-500" />
                  <span>الملاحظات المسجلة ({notes.length})</span>
                </h3>

                {isLoading && notes.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500">جاري تحميل الملاحظات...</div>
                ) : notes.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    لا توجد ملاحظات مسجلة بعد. كن أول من يضيف ملاحظة!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notes.map((note) => (
                      <div
                        key={note.id}
                        className="bg-slate-950/60 border border-slate-800/80 hover:border-slate-800 rounded-xl p-4 space-y-2 relative group transition-all"
                      >
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="absolute top-3 right-3 p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-900 rounded-md transition-all opacity-0 group-hover:opacity-100"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <h4 className="text-xs font-bold text-brand-300 pr-8 flex items-center gap-1">
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
                                className={`text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-sans scrollbar-thin ${
                                  isExpanded ? "max-h-48 overflow-y-auto pr-1.5 scrollbar-thumb-slate-850 scrollbar-track-transparent" : ""
                                }`}
                              >
                                {displayedContent}
                              </div>
                              {isLong && (
                                <button
                                  onClick={() => setExpandedNotes(prev => ({ ...prev, [note.id]: !prev[note.id] }))}
                                  className="text-[10px] text-brand-400 hover:text-brand-300 font-bold focus:outline-none mt-1 select-none"
                                >
                                  {isExpanded ? "عرض أقل ▲" : "عرض المزيد ▼"}
                                </button>
                              )}
                            </div>
                          );
                        })()}

                        <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-900">
                          <span>بواسطة الأداة المشتركة</span>
                          <span>
                            {new Date(note.created_at).toLocaleDateString("ar-EG", {
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

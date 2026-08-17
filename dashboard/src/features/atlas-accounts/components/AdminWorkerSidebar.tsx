"use client";

import React, { useState } from "react";
import { 
  Users, UserPlus, X, RefreshCw, MoreVertical, Edit2, ShieldCheck, Ban, Trash2 
} from "lucide-react";

interface AdminWorkerSidebarProps {
  lang: "ar" | "en";
  isDark: boolean;
  workers: any[];
  selectedWorkerId: string | null;
  onSelectWorker: (workerId: string | null) => void;
  onAddWorker: (username: string, pin: string) => Promise<void>;
  onEditWorker: (workerId: string, username: string, pin: string) => Promise<void>;
  onToggleBlockWorker: (worker: any) => Promise<void>;
  onDeleteWorker: (worker: any) => Promise<void>;
}

export const AdminWorkerSidebar: React.FC<AdminWorkerSidebarProps> = ({
  lang,
  isDark,
  workers,
  selectedWorkerId,
  onSelectWorker,
  onAddWorker,
  onEditWorker,
  onToggleBlockWorker,
  onDeleteWorker,
}) => {
  const [isAddWorkerOpen, setIsAddWorkerOpen] = useState(false);
  const [isEditWorkerOpen, setIsEditWorkerOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<any | null>(null);
  const [activeDropdownWorkerId, setActiveDropdownWorkerId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Forms states
  const [newWorkerForm, setNewWorkerForm] = useState({ username: "", pin: "" });
  const [editWorkerForm, setEditWorkerForm] = useState({ username: "", pin: "" });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkerForm.username.trim() || !newWorkerForm.pin.trim()) return;

    setActionLoading(true);
    try {
      await onAddWorker(newWorkerForm.username.trim(), newWorkerForm.pin.trim());
      setIsAddWorkerOpen(false);
      setNewWorkerForm({ username: "", pin: "" });
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorker || !editWorkerForm.username.trim() || !editWorkerForm.pin.trim()) return;

    setActionLoading(true);
    try {
      await onEditWorker(editingWorker.id, editWorkerForm.username.trim(), editWorkerForm.pin.trim());
      setIsEditWorkerOpen(false);
      setEditingWorker(null);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const startEditingWorker = (worker: any) => {
    setEditingWorker(worker);
    setEditWorkerForm({ username: worker.username, pin: worker.pin });
    setIsEditWorkerOpen(true);
  };

  return (
    <div
      className={`p-4 rounded-2xl border flex flex-col justify-between ${
        isDark ? "bg-[#111] border-white/5" : "bg-white border-gray-200"
      }`}
    >
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-500" />
            {lang === "ar" ? "الموظفون" : "Employees"}
          </h3>
          <button
            onClick={() => setIsAddWorkerOpen(true)}
            className="p-1.5 bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/20 text-blue-500 rounded-lg transition-all"
            title={lang === "ar" ? "إضافة موظف جديد" : "Add New Worker"}
          >
            <UserPlus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Add Worker Dialog overlay */}
        {isAddWorkerOpen && (
          <div className="bg-black/60 backdrop-blur-sm fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className={`w-full max-w-sm p-6 rounded-3xl border shadow-2xl ${
                isDark ? "bg-[#0f0f0f] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
              }`}
            >
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-bold">
                  {lang === "ar" ? "إضافة موظف جديد" : "Add New Employee"}
                </h4>
                <button onClick={() => setIsAddWorkerOpen(false)} className="text-gray-500 hover:text-gray-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleAddSubmit} className="space-y-4 text-xs font-medium">
                <div>
                  <label className="block mb-1.5 text-gray-400">
                    {lang === "ar" ? "اسم الموظف" : "Employee Name"}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Yasmin"
                    value={newWorkerForm.username}
                    onChange={(e) => setNewWorkerForm((p) => ({ ...p, username: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-xl border outline-none ${
                      isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-205"
                    }`}
                  />
                </div>
                <div>
                  <label className="block mb-1.5 text-gray-400">
                    {lang === "ar" ? "الرمز التعريفي (4 أرقام)" : "PIN Code (4 Digits)"}
                  </label>
                  <input
                    type="text"
                    required
                    pattern="\d{4}"
                    maxLength={4}
                    placeholder="e.g. 1234"
                    value={newWorkerForm.pin}
                    onChange={(e) => setNewWorkerForm((p) => ({ ...p, pin: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-xl border outline-none font-mono text-center tracking-widest ${
                      isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-205"
                    }`}
                  />
                  {workers.some(
                    (w) => w.pin === newWorkerForm.pin.trim() && newWorkerForm.pin.trim() !== ""
                  ) && (
                    <p className="text-red-500 text-[10px] mt-1">
                      {lang === "ar"
                        ? "⚠️ هذا الرمز التعريفي مستخدم بالفعل لموظف آخر."
                        : "⚠️ This PIN is already taken."}
                    </p>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddWorkerOpen(false)}
                    className={`px-3 py-1.5 rounded-lg ${
                      isDark ? "bg-white/5 text-gray-400" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {lang === "ar" ? "إلغاء" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    disabled={
                      actionLoading ||
                      workers.some(
                        (w) => w.pin === newWorkerForm.pin.trim() && newWorkerForm.pin.trim() !== ""
                      )
                    }
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-lg font-bold flex items-center gap-1.5"
                  >
                    {actionLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                    <span>{lang === "ar" ? "حفظ" : "Save"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Worker Dialog overlay */}
        {isEditWorkerOpen && editingWorker && (
          <div className="bg-black/60 backdrop-blur-sm fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className={`w-full max-w-sm p-6 rounded-3xl border shadow-2xl ${
                isDark ? "bg-[#0f0f0f] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
              }`}
            >
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-bold">
                  {lang === "ar" ? "تعديل بيانات الموظف" : "Edit Employee Details"}
                </h4>
                <button
                  onClick={() => {
                    setIsEditWorkerOpen(false);
                    setEditingWorker(null);
                  }}
                  className="text-gray-500 hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleEditSubmit} className="space-y-4 text-xs font-medium">
                <div>
                  <label className="block mb-1.5 text-gray-400">
                    {lang === "ar" ? "اسم الموظف" : "Employee Name"}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Yasmin"
                    value={editWorkerForm.username}
                    onChange={(e) => setEditWorkerForm((p) => ({ ...p, username: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-xl border outline-none ${
                      isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-205"
                    }`}
                  />
                </div>
                <div>
                  <label className="block mb-1.5 text-gray-400">
                    {lang === "ar" ? "الرمز التعريفي (4 أرقام)" : "PIN Code (4 Digits)"}
                  </label>
                  <input
                    type="text"
                    required
                    pattern="\d{4}"
                    maxLength={4}
                    placeholder="e.g. 1234"
                    value={editWorkerForm.pin}
                    onChange={(e) => setEditWorkerForm((p) => ({ ...p, pin: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-xl border outline-none font-mono text-center tracking-widest ${
                      isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-205"
                    }`}
                  />
                  {workers.some(
                    (w) =>
                      w.id !== editingWorker.id &&
                      w.pin === editWorkerForm.pin.trim() &&
                      editWorkerForm.pin.trim() !== ""
                  ) && (
                    <p className="text-red-500 text-[10px] mt-1">
                      {lang === "ar"
                        ? "⚠️ هذا الرمز التعريفي مستخدم بالفعل لموظف آخر."
                        : "⚠️ This PIN is already taken."}
                    </p>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditWorkerOpen(false);
                      setEditingWorker(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg ${
                      isDark ? "bg-white/5 text-gray-400" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {lang === "ar" ? "إلغاء" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    disabled={
                      actionLoading ||
                      workers.some(
                        (w) =>
                          w.id !== editingWorker.id &&
                          w.pin === editWorkerForm.pin.trim() &&
                          editWorkerForm.pin.trim() !== ""
                      )
                    }
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-lg font-bold flex items-center gap-1.5"
                  >
                    {actionLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                    <span>{lang === "ar" ? "حفظ التعديلات" : "Save Changes"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Workers List */}
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {workers.length === 0 ? (
            <p className="text-xs text-gray-500 italic p-2 text-center">
              {lang === "ar" ? "لا يوجد موظفون مضافون" : "No employees found"}
            </p>
          ) : (
            workers.map((worker, index) => (
              <div
                key={worker.id}
                className={`w-full flex items-center justify-between p-2 rounded-xl border transition-all text-xs ${
                  selectedWorkerId === worker.id
                    ? "bg-blue-600/10 border-blue-500/20 text-blue-500"
                    : isDark
                    ? "bg-white/0 border-transparent text-gray-400 hover:text-white"
                    : "bg-gray-50/0 border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                <button
                  onClick={() => onSelectWorker(worker.id)}
                  className="flex-1 text-right truncate font-semibold mr-1.5"
                >
                  <div className="truncate flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        worker.is_blocked ? "bg-red-500" : "bg-green-500"
                      }`}
                    />
                    <span className={worker.is_blocked ? "line-through opacity-50" : ""}>
                      {worker.username}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[8.5px] text-gray-500 mt-0.5 font-sans leading-none">
                    <span className="font-mono">PIN: {worker.pin}</span>
                    <span>•</span>
                    <span>
                      {lang === "ar"
                        ? `${worker.atlas_accounts?.length || 0} ${
                            (worker.atlas_accounts?.length || 0) === 1
                              ? "حساب"
                              : (worker.atlas_accounts?.length || 0) === 2
                              ? "حسابين"
                              : "حسابات"
                          }`
                        : `${worker.atlas_accounts?.length || 0} ${
                            (worker.atlas_accounts?.length || 0) === 1 ? "acc" : "accs"
                          }`}
                    </span>
                    {(worker.atlas_accounts?.length || 0) > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-gray-450 font-medium">
                          {worker.atlas_accounts?.reduce(
                            (sum: number, acc: any) => sum + Number(acc.accepted_hours || 0),
                            0
                          )}
                          h
                        </span>
                      </>
                    )}
                  </div>
                </button>

                <div
                  className={`relative shrink-0 ${
                    activeDropdownWorkerId === worker.id ? "z-30" : "z-10"
                  }`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDropdownWorkerId(
                        activeDropdownWorkerId === worker.id ? null : worker.id
                      );
                    }}
                    className={`p-1.5 rounded-lg transition-colors ${
                      selectedWorkerId === worker.id
                        ? "text-blue-500 hover:bg-blue-500/10"
                        : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                    }`}
                    title={lang === "ar" ? "خيارات الموظف" : "Employee Options"}
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>

                  {activeDropdownWorkerId === worker.id && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdownWorkerId(null);
                        }}
                      />
                      <div
                        className={`absolute right-0 w-36 rounded-xl border shadow-xl z-20 overflow-hidden ${
                          index >= workers.length - 2 && workers.length > 2
                            ? "bottom-full mb-1"
                            : "top-full mt-1"
                        } ${
                          isDark
                            ? "bg-[#0f0f0f] border-white/10 text-white"
                            : "bg-white border-gray-200 text-gray-800"
                        }`}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownWorkerId(null);
                            startEditingWorker(worker);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-[10px] text-right font-bold transition-colors ${
                            isDark ? "hover:bg-white/5 text-gray-300" : "hover:bg-gray-50 text-gray-700"
                          }`}
                        >
                          <Edit2 className="w-3 h-3 text-blue-500" />
                          <span>{lang === "ar" ? "تعديل البيانات" : "Edit Details"}</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownWorkerId(null);
                            onToggleBlockWorker(worker);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-[10px] text-right font-bold transition-colors border-t border-b ${
                            isDark
                              ? "hover:bg-white/5 text-gray-300 border-white/5"
                              : "hover:bg-gray-50 text-gray-700 border-gray-100"
                          }`}
                        >
                          {worker.is_blocked ? (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                              <span>{lang === "ar" ? "تفعيل الموظف" : "Activate Worker"}</span>
                            </>
                          ) : (
                            <>
                              <Ban className="w-3.5 h-3.5 text-amber-500" />
                              <span>{lang === "ar" ? "حظر الموظف" : "Block Worker"}</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownWorkerId(null);
                            onDeleteWorker(worker);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-[10px] text-right font-bold text-rose-500 transition-colors ${
                            isDark ? "hover:bg-white/5" : "hover:bg-rose-50"
                          }`}
                        >
                          <Trash2 className="w-3 h-3 text-rose-505" />
                          <span>{lang === "ar" ? "حذف الموظف" : "Delete Worker"}</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

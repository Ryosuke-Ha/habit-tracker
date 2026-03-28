"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useSetting } from "@/hooks/useSetting";
import HamburgerMenu from "@/components/HamburgerMenu";

interface Template { id: number; name: string; }
interface Habit { id: number; template_id: number; title: string; scheduled_time: string; location: string; order: number; }

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const PROTECTED = new Set(["平日", "休日"]);
const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function generateTimeOptions(): string[] {
  const times: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return times;
}
const TIME_OPTIONS = generateTimeOptions();

export default function TemplatesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { getSetting, setSetting } = useSetting();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState("");

  // Template CRUD
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const newInputRef = useRef<HTMLInputElement>(null);

  // Accordion / habits
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [habitsByTemplate, setHabitsByTemplate] = useState<Record<number, Habit[]>>({});
  const [loadingHabitsFor, setLoadingHabitsFor] = useState<number | null>(null);

  // Habit editing
  const [editingHabitId, setEditingHabitId] = useState<number | null>(null);
  const [editHabit, setEditHabit] = useState({ title: "", scheduled_time: "07:00", location: "" });
  const [addingHabitFor, setAddingHabitFor] = useState<number | null>(null);
  const [newHabit, setNewHabit] = useState({ title: "", scheduled_time: "07:00", location: "" });

  // Day-of-week mapping
  const [dayMap, setDayMap] = useState<Record<string, string>>({});

  // Submitting states (二重送信防止)
  const [submittingAddTemplate, setSubmittingAddTemplate] = useState(false);
  const [submittingRenameTemplate, setSubmittingRenameTemplate] = useState(false);
  const [submittingDeleteTemplate, setSubmittingDeleteTemplate] = useState(false);
  const [submittingAddHabit, setSubmittingAddHabit] = useState(false);
  const [submittingEditHabit, setSubmittingEditHabit] = useState(false);
  const [deletingHabitId, setDeletingHabitId] = useState<number | null>(null);

  useEffect(() => { fetchTemplates(); }, []);
  useEffect(() => { if (editingId !== null) editInputRef.current?.focus(); }, [editingId]);
  useEffect(() => { if (addingNew) newInputRef.current?.focus(); }, [addingNew]);

  useEffect(() => {
    getSetting("habit_day_template_map").then((stored) => {
      if (stored) {
        try { setDayMap(JSON.parse(stored)); } catch { /* ignore */ }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (templates.length === 0) return;
    getSetting("habit_day_template_map").then((existing) => {
      if (existing) return;
      const heijitsu = templates.find((t) => t.name === "平日");
      const kyujitsu = templates.find((t) => t.name === "休日");
      if (!heijitsu || !kyujitsu) return;
      const defaults: Record<string, string> = {
        "0": String(kyujitsu.id),
        "1": String(heijitsu.id),
        "2": String(heijitsu.id),
        "3": String(heijitsu.id),
        "4": String(heijitsu.id),
        "5": String(heijitsu.id),
        "6": String(kyujitsu.id),
      };
      setDayMap(defaults);
      setSetting("habit_day_template_map", JSON.stringify(defaults));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates]);

  async function fetchTemplates() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/templates`);
      setTemplates(await res.json());
      setError("");
    } catch {
      setError("バックエンドに接続できません。サーバーを起動してください。");
    } finally {
      setLoading(false);
    }
  }

  async function fetchHabits(templateId: number) {
    if (habitsByTemplate[templateId] !== undefined) return;
    setLoadingHabitsFor(templateId);
    try {
      const res = await fetch(`${API}/templates/${templateId}/habits`);
      const data = await res.json();
      setHabitsByTemplate((prev) => ({ ...prev, [templateId]: data }));
    } finally {
      setLoadingHabitsFor(null);
    }
  }

  function toggleExpand(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      fetchHabits(id);
    }
  }

  // Template CRUD
  async function handleRename(id: number) {
    if (!editingName.trim() || submittingRenameTemplate) return;
    setSubmittingRenameTemplate(true);
    try {
      await fetch(`${API}/templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim() }),
      });
      setEditingId(null);
      fetchTemplates();
    } finally {
      setSubmittingRenameTemplate(false);
    }
  }

  async function handleDelete(id: number) {
    if (submittingDeleteTemplate) return;
    setSubmittingDeleteTemplate(true);
    try {
      await fetch(`${API}/templates/${id}`, { method: "DELETE" });
      setConfirmDeleteId(null);
      fetchTemplates();
    } finally {
      setSubmittingDeleteTemplate(false);
    }
  }

  async function handleAdd() {
    if (!newName.trim() || submittingAddTemplate) return;
    setSubmittingAddTemplate(true);
    try {
      await fetch(`${API}/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNewName("");
      setAddingNew(false);
      fetchTemplates();
    } finally {
      setSubmittingAddTemplate(false);
    }
  }

  // Habit CRUD
  async function handleAddHabit(templateId: number) {
    if (!newHabit.title.trim() || submittingAddHabit) return;
    setSubmittingAddHabit(true);
    try {
      const res = await fetch(`${API}/habits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newHabit.title.trim(),
          scheduled_time: newHabit.scheduled_time,
          location: newHabit.location.trim(),
          template_id: templateId,
        }),
      });
      const habit: Habit = await res.json();
      setHabitsByTemplate((prev) => ({
        ...prev,
        [templateId]: [...(prev[templateId] || []), habit].sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time)),
      }));
      setAddingHabitFor(null);
      setNewHabit({ title: "", scheduled_time: "07:00", location: "" });
    } finally {
      setSubmittingAddHabit(false);
    }
  }

  async function handleEditHabit(habitId: number, templateId: number) {
    if (submittingEditHabit) return;
    setSubmittingEditHabit(true);
    try {
      const res = await fetch(`${API}/habits/${habitId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editHabit.title.trim(), scheduled_time: editHabit.scheduled_time, location: editHabit.location.trim() }),
      });
      const updated: Habit = await res.json();
      setHabitsByTemplate((prev) => ({
        ...prev,
        [templateId]: (prev[templateId] || [])
          .map((h) => (h.id === habitId ? updated : h))
          .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time)),
      }));
      setEditingHabitId(null);
    } finally {
      setSubmittingEditHabit(false);
    }
  }

  async function handleDeleteHabit(habitId: number, templateId: number) {
    if (deletingHabitId !== null) return;
    setDeletingHabitId(habitId);
    // オプティミスティックUI
    setHabitsByTemplate((prev) => ({
      ...prev,
      [templateId]: (prev[templateId] || []).filter((h) => h.id !== habitId),
    }));
    try {
      await fetch(`${API}/habits/${habitId}`, { method: "DELETE" });
    } catch {
      // ロールバック
      fetchHabits(templateId);
    } finally {
      setDeletingHabitId(null);
    }
  }

  function handleDayMapChange(day: string, templateId: string) {
    const newMap = { ...dayMap, [day]: templateId };
    setDayMap(newMap);
    setSetting("habit_day_template_map", JSON.stringify(newMap));
  }

  return (
    <main>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="戻る"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900">テンプレートを管理</h1>
        </div>
        <HamburgerMenu
          user={session?.user}
          onSignOut={() => signOut({ callbackUrl: "/login" })}
          items={[
            { label: "TODO", onClick: () => router.push("/"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
            { label: "TODOメモ", onClick: () => router.push("/memo"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
            { label: "週の振り返り", onClick: () => router.push("/review/weekly"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
            { label: "月の振り返り", onClick: () => router.push("/review/monthly"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
          ]}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Loading spinner */}
      {loading ? (
        <div className="flex justify-center py-12">
          <svg className="w-6 h-6 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
        <>
          {/* テンプレート一覧 */}
          <ul className="flex flex-col gap-2 mb-4">
            {templates.map((t) => (
              <li key={t.id} className="rounded-xl border border-gray-200 overflow-hidden">
                {confirmDeleteId === t.id ? (
                  <div className="flex items-center gap-3 p-4 bg-red-50 border-red-200">
                    <p className="flex-1 text-sm text-red-700 font-medium">
                      「{t.name}」を削除しますか？
                      <span className="block text-xs font-normal text-red-500 mt-0.5">紐付く習慣もすべて削除されます</span>
                    </p>
                    <button type="button" onClick={() => handleDelete(t.id)} disabled={submittingDeleteTemplate} className="text-xs px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed">{submittingDeleteTemplate ? "削除中…" : "削除する"}</button>
                    <button type="button" onClick={() => setConfirmDeleteId(null)} className="text-xs px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">取消</button>
                  </div>
                ) : editingId === t.id ? (
                  <div className="flex items-center gap-2 p-4 bg-white border-2 border-blue-300 rounded-xl">
                    <input
                      ref={editInputRef}
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); if (e.key === "Escape") setEditingId(null); }}
                      className="flex-1 border border-blue-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    <button type="button" onClick={() => handleRename(t.id)} disabled={submittingRenameTemplate} className="text-xs px-3 py-1.5 bg-black text-white rounded-lg hover:bg-gray-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed">{submittingRenameTemplate ? "保存中…" : "保存"}</button>
                    <button type="button" onClick={() => setEditingId(null)} disabled={submittingRenameTemplate} className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">取消</button>
                  </div>
                ) : (
                  <>
                    {/* Template header row */}
                    <div className="flex items-center gap-2 p-4 bg-white">
                      <button
                        type="button"
                        onClick={() => toggleExpand(t.id)}
                        className="flex-1 flex items-center gap-2 text-left"
                      >
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${expandedId === t.id ? "rotate-90" : ""}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="text-sm font-semibold text-gray-800">{t.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingId(t.id); setEditingName(t.name); setConfirmDeleteId(null); }}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        編集
                      </button>
                      {!PROTECTED.has(t.name) && (
                        <button
                          type="button"
                          onClick={() => { setConfirmDeleteId(t.id); setEditingId(null); }}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors font-medium"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          削除
                        </button>
                      )}
                    </div>

                    {/* Accordion: habit list */}
                    {expandedId === t.id && (
                      <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                        {loadingHabitsFor === t.id ? (
                          <div className="flex justify-center py-4">
                            <svg className="w-5 h-5 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          </div>
                        ) : (
                          <>
                            <ul className="flex flex-col gap-2 mb-3">
                              {(habitsByTemplate[t.id] || []).map((h) => (
                                <li key={h.id}>
                                  {editingHabitId === h.id ? (
                                    <div className="flex flex-col gap-2 p-3 bg-white border border-blue-200 rounded-xl">
                                      <input
                                        value={editHabit.title}
                                        onChange={(e) => setEditHabit((v) => ({ ...v, title: e.target.value }))}
                                        placeholder="タイトル"
                                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                      />
                                      <div className="flex gap-2">
                                        <select
                                          value={editHabit.scheduled_time}
                                          onChange={(e) => setEditHabit((v) => ({ ...v, scheduled_time: e.target.value }))}
                                          className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                        >
                                          {TIME_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                        <input
                                          value={editHabit.location}
                                          onChange={(e) => setEditHabit((v) => ({ ...v, location: e.target.value }))}
                                          placeholder="場所"
                                          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                        />
                                      </div>
                                      <div className="flex gap-2 justify-end">
                                        <button type="button" onClick={() => handleEditHabit(h.id, t.id)} disabled={submittingEditHabit} className="text-xs px-3 py-1.5 bg-black text-white rounded-lg hover:bg-gray-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed">{submittingEditHabit ? "保存中…" : "保存"}</button>
                                        <button type="button" onClick={() => setEditingHabitId(null)} disabled={submittingEditHabit} className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">取消</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-xl">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">{h.title}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                          {h.scheduled_time}{h.location ? ` · ${h.location}` : ""}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => { setEditingHabitId(h.id); setEditHabit({ title: h.title, scheduled_time: h.scheduled_time, location: h.location }); }}
                                        className="text-xs px-2 py-1 text-blue-500 hover:bg-blue-50 rounded-lg"
                                      >
                                        編集
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteHabit(h.id, t.id)}
                                        disabled={deletingHabitId !== null}
                                        className="text-xs px-2 py-1 text-red-400 hover:bg-red-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        削除
                                      </button>
                                    </div>
                                  )}
                                </li>
                              ))}
                              {(habitsByTemplate[t.id] || []).length === 0 && (
                                <p className="text-xs text-gray-400 text-center py-2">習慣がありません</p>
                              )}
                            </ul>

                            {/* Add habit */}
                            {addingHabitFor === t.id ? (
                              <div className="flex flex-col gap-2 p-3 bg-white border border-blue-200 rounded-xl">
                                <input
                                  value={newHabit.title}
                                  onChange={(e) => setNewHabit((v) => ({ ...v, title: e.target.value }))}
                                  placeholder="タイトル"
                                  autoFocus
                                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                />
                                <div className="flex gap-2">
                                  <select
                                    value={newHabit.scheduled_time}
                                    onChange={(e) => setNewHabit((v) => ({ ...v, scheduled_time: e.target.value }))}
                                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                  >
                                    {TIME_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                  </select>
                                  <input
                                    value={newHabit.location}
                                    onChange={(e) => setNewHabit((v) => ({ ...v, location: e.target.value }))}
                                    placeholder="場所"
                                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                  />
                                </div>
                                <div className="flex gap-2 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleAddHabit(t.id)}
                                    disabled={!newHabit.title.trim() || submittingAddHabit}
                                    className="text-xs px-3 py-1.5 bg-black text-white rounded-lg hover:bg-gray-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {submittingAddHabit ? "追加中…" : "追加"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setAddingHabitFor(null); setNewHabit({ title: "", scheduled_time: "07:00", location: "" }); }}
                                    disabled={submittingAddHabit}
                                    className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    取消
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => { setAddingHabitFor(t.id); setNewHabit({ title: "", scheduled_time: "07:00", location: "" }); }}
                                className="w-full py-2 text-xs text-gray-500 border border-dashed border-gray-300 rounded-xl hover:border-gray-400 hover:text-gray-700 hover:bg-white transition-colors flex items-center justify-center gap-1"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                </svg>
                                習慣を追加
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>

          {/* 新規テンプレート追加 */}
          {addingNew ? (
            <div className="flex gap-2 mb-8">
              <input
                ref={newInputRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); if (e.key === "Escape") { setAddingNew(false); setNewName(""); } }}
                placeholder="テンプレート名を入力"
                className="flex-1 border border-blue-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <button type="button" onClick={handleAdd} disabled={!newName.trim() || submittingAddTemplate} className="px-4 py-3 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{submittingAddTemplate ? "追加中…" : "追加"}</button>
              <button type="button" onClick={() => { setAddingNew(false); setNewName(""); }} disabled={submittingAddTemplate} className="px-4 py-3 bg-gray-100 text-gray-600 text-sm rounded-xl hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">取消</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingNew(true)}
              className="w-full py-3.5 text-sm text-gray-500 border border-dashed border-gray-300 rounded-xl hover:border-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 mb-8"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              新しいテンプレートを追加
            </button>
          )}

          {/* 曜日ごとのテンプレート設定 */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">曜日ごとのテンプレート設定</h2>
              <p className="text-xs text-gray-400 mt-0.5">各曜日に使用するテンプレートを選択してください</p>
            </div>
            <ul className="divide-y divide-gray-100">
              {DAY_LABELS.map((label, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-3 bg-white">
                  <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0 ${i === 0 ? "bg-red-100 text-red-600" : i === 6 ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600"}`}>
                    {label}
                  </span>
                  <select
                    value={dayMap[String(i)] ?? ""}
                    onChange={(e) => handleDayMapChange(String(i), e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value="">-- 選択 --</option>
                    {templates.map((t) => (
                      <option key={t.id} value={String(t.id)}>{t.name}</option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </main>
  );
}

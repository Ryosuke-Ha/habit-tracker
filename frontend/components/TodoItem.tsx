"use client";

import { useState, useRef, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

export interface SubTask {
  id: number;
  title: string;
  is_completed: boolean;
  order: number;
}

export interface HabitEntry {
  kind: "habit";
  logId: number;          // DailyLog id (for toggle, subtask API)
  habitId: number | null; // Habit id (null for standalone one-off logs)
  title: string;
  scheduledTime: string;
  location: string;
  isChecked: boolean;
}

export interface PersistentEntry {
  kind: "persistent";
  id: number;
  title: string;
  scheduledTime: string | null;
  location: string | null;
  isCompleted: boolean;
}

export type TodoEntry = HabitEntry | PersistentEntry;

interface TodoItemProps {
  item: TodoEntry;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: (data: { title: string; scheduled_time: string; location: string }) => Promise<void>;
}

// バーストパーティクルの色リスト
const BURST_COLORS = [
  "bg-green-400",
  "bg-emerald-300",
  "bg-teal-400",
  "bg-lime-400",
  "bg-yellow-300",
  "bg-green-300",
];

// 放射するパーティクル数
const PARTICLE_COUNT = 8;

export default function TodoItem({ item, onToggle, onDelete, onEdit }: TodoItemProps) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");
  const [editTitle, setEditTitle] = useState(item.title);
  const [editTime, setEditTime] = useState(item.scheduledTime ?? "07:00");
  const [editLocation, setEditLocation] = useState(item.location ?? "");
  const [saving, setSaving] = useState(false);

  // Accordion
  const [expanded, setExpanded] = useState(false);
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [subtasksLoaded, setSubtasksLoaded] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- 完了アニメーション用 state ---
  // "idle" | "completing" | "done"
  // completing: チェック直後のアニメーション再生中
  const [checkAnim, setCheckAnim] = useState<"idle" | "completing">("idle");
  const [showBurst, setShowBurst] = useState(false);
  const [rowFlash, setRowFlash] = useState(false);
  const prevIsDoneRef = useRef<boolean>(false);

  const isDone = item.kind === "habit" ? item.isChecked : item.isCompleted;
  const subtaskType = item.kind === "habit" ? "habit_log" : "persistent_todo";
  const subtaskTodoId = item.kind === "habit" ? item.logId : item.id;

  const completedCount = subtasks.filter((s) => s.is_completed).length;
  const totalCount = subtasks.length;
  const allDone = totalCount > 0 && completedCount === totalCount;

  // isDone が false → true になった瞬間にアニメーションを発火
  useEffect(() => {
    const prev = prevIsDoneRef.current;
    prevIsDoneRef.current = isDone;

    if (!prev && isDone) {
      // バウンス + バーストを発火
      setCheckAnim("completing");
      setShowBurst(true);
      setRowFlash(true);

      // バウンスアニメーション終了後にリセット
      const t1 = setTimeout(() => setCheckAnim("idle"), 500);
      // バーストは少し長めに見せてから消す
      const t2 = setTimeout(() => setShowBurst(false), 600);
      // 行フラッシュも同様
      const t3 = setTimeout(() => setRowFlash(false), 750);

      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [isDone]);

  useEffect(() => {
    if (expanded && !subtasksLoaded) {
      fetch(`${API}/subtasks?todo_type=${subtaskType}&todo_id=${subtaskTodoId}`)
        .then((r) => r.json())
        .then((data: SubTask[]) => { setSubtasks(data); setSubtasksLoaded(true); })
        .catch(() => setSubtasksLoaded(true));
    }
  }, [expanded]);

  async function handleAddSubtask() {
    if (!newSubtaskTitle.trim() || isSubmitting) return;
    const title = newSubtaskTitle.trim();
    const tempId = -Date.now();
    const tempSubtask: SubTask = { id: tempId, title, is_completed: false, order: subtasks.length };
    setSubtasks((prev) => [...prev, tempSubtask]);
    setNewSubtaskTitle("");
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todo_type: subtaskType, todo_id: subtaskTodoId, title }),
      });
      const created: SubTask = await res.json();
      setSubtasks((prev) => prev.map((s) => (s.id === tempId ? created : s)));
    } catch {
      setSubtasks((prev) => prev.filter((s) => s.id !== tempId));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleSubtask(id: number) {
    const res = await fetch(`${API}/subtasks/${id}/toggle`, { method: "POST" });
    const updated: SubTask = await res.json();
    setSubtasks((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  async function handleDeleteSubtask(id: number) {
    await fetch(`${API}/subtasks/${id}`, { method: "DELETE" });
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleEditSave() {
    if (!editTitle.trim()) return;
    setSaving(true);
    try {
      await onEdit({ title: editTitle.trim(), scheduled_time: editTime, location: editLocation.trim() });
      setMode("view");
    } finally {
      setSaving(false);
    }
  }

  // ---- EDIT MODE ----
  if (mode === "edit") {
    return (
      <li className="bg-white border-2 border-blue-300 rounded-xl p-4 flex flex-col gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">何をする？</label>
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setMode("view")}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">いつ？</label>
            <select
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">どこで？</label>
            <input
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              placeholder="例: カフェ"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleEditSave}
            disabled={saving || !editTitle.trim()}
            className="flex-1 py-2 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {saving ? "保存中..." : "保存する"}
          </button>
          <button
            onClick={() => setMode("view")}
            className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition-colors"
          >
            取消
          </button>
        </div>
      </li>
    );
  }

  // ---- VIEW MODE ----
  return (
    <li
      className={`rounded-xl border overflow-hidden transition-colors cursor-pointer ${
        rowFlash
          ? "animate-row-complete-flash"
          : isDone
          ? "bg-gray-50 border-gray-100"
          : item.kind === "persistent"
          ? "bg-amber-50 border-amber-300"
          : "bg-white border-gray-200"
      }`}
      onClick={() => setExpanded((v) => !v)}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 p-4">
        {/* Check button — バーストパーティクル用に relative */}
        <div className="relative flex-shrink-0 w-6 h-6">
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
              checkAnim === "completing" ? "animate-check-bounce" : ""
            } ${
              isDone ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-black"
            }`}
          >
            {isDone && (
              <svg
                className={`w-3 h-3 ${checkAnim === "completing" ? "animate-checkmark-pop" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          {/* バーストパーティクル */}
          {showBurst &&
            Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
              const angle = (360 / PARTICLE_COUNT) * i;
              const colorClass = BURST_COLORS[i % BURST_COLORS.length];
              return (
                <span
                  key={i}
                  className={`burst-particle ${colorClass}`}
                  style={{ "--angle": `${angle}deg` } as React.CSSProperties}
                />
              );
            })}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className={`text-xs mb-0.5 flex items-center gap-2 flex-wrap ${isDone ? "text-gray-300" : "text-gray-400"}`}>
            {item.scheduledTime && <span>🕐 {item.scheduledTime}</span>}
            {item.location && <span>📍 {item.location}</span>}
          </div>
          <p className={`text-sm font-semibold ${isDone ? "text-gray-300 line-through" : "text-gray-900"}`}>
            {item.title}
          </p>
          {/* Subtask summary badge (collapsed) */}
          {!expanded && subtasksLoaded && totalCount > 0 && (
            <p className={`text-xs mt-0.5 font-medium ${allDone ? "text-green-500" : "text-gray-400"}`}>
              {completedCount}/{totalCount} サブタスク
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center gap-0.5">
          {mode === "confirm-delete" ? (
            <>
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-xs px-2 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600">削除</button>
              <button onClick={(e) => { e.stopPropagation(); setMode("view"); }} className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 ml-1">取消</button>
            </>
          ) : (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setEditTitle(item.title); setEditTime(item.scheduledTime ?? "07:00"); setEditLocation(item.location ?? ""); setMode("edit"); }}
                className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-blue-400 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setMode("confirm-delete"); }}
                className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-400 rounded-lg hover:bg-red-50 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              {/* Accordion chevron */}
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                  allDone ? "text-green-500 hover:bg-green-50" : "text-gray-300 hover:text-gray-600 hover:bg-gray-100"
                }`}
              >
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Progress bar (collapsed, when subtasks exist) */}
      {!expanded && subtasksLoaded && totalCount > 0 && (
        <div className="px-4 pb-3">
          <div className="w-full bg-gray-100 rounded-full h-1">
            <div
              className={`h-1 rounded-full transition-all ${allDone ? "bg-green-400" : "bg-indigo-400"}`}
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* "Undo complete" for persistent todos */}
      {item.kind === "persistent" && item.isCompleted && mode === "view" && (
        <div className="px-4 pb-3">
          <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="text-xs text-gray-400 hover:text-gray-600 underline">
            完了を取り消す
          </button>
        </div>
      )}

      {/* Accordion: subtasks */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expanded ? "max-h-[500px]" : "max-h-0"}`}>
        <div className="px-4 pb-4 border-t border-gray-100">
          {subtasksLoaded ? (
            <>
              {totalCount > 0 && (
                <>
                  <ul className="mt-3 space-y-2">
                    {subtasks.map((s) => (
                      <li key={s.id} className="flex items-center gap-2 group">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleSubtask(s.id); }}
                          className={`w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center transition-colors ${
                            s.is_completed ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-gray-500"
                          }`}
                        >
                          {s.is_completed && (
                            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <span className={`flex-1 text-xs ${s.is_completed ? "line-through text-gray-300" : "text-gray-700"}`}>
                          {s.title}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteSubtask(s.id); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 flex items-center justify-center text-gray-300 hover:text-red-400"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {/* Progress bar (expanded) */}
                  <div className="mt-3 mb-3">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>進捗</span>
                      <span>{completedCount}/{totalCount}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${allDone ? "bg-green-400" : "bg-indigo-400"}`}
                        style={{ width: `${(completedCount / totalCount) * 100}%` }}
                      />
                    </div>
                  </div>
                </>
              )}
              {/* Add subtask input + button */}
              <div className={`flex items-center gap-2 ${totalCount > 0 ? "" : "mt-3"}`}>
                <input
                  type="text"
                  value={newSubtaskTitle}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); handleAddSubtask(); } }}
                  placeholder="サブタスクを追加"
                  className="flex-1 text-xs border-b border-gray-200 py-1.5 focus:outline-none focus:border-indigo-400 bg-transparent text-gray-700 placeholder-gray-300"
                />
                <button
                  onClick={(e) => { e.stopPropagation(); handleAddSubtask(); }}
                  disabled={!newSubtaskTitle.trim() || isSubmitting}
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="サブタスクを追加"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </>
          ) : (
            <p className="mt-3 text-xs text-gray-400 text-center py-2">読み込み中...</p>
          )}
        </div>
      </div>
    </li>
  );
}

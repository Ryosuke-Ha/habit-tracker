"use client";

import { useState } from "react";

interface Habit {
  id: number;
  title: string;
  scheduled_time: string;
  location: string;
}

interface HabitItemProps {
  habit: Habit;
  isChecked: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: (data: { title: string; scheduled_time: string; location: string }) => Promise<void>;
}

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

export default function HabitItem({ habit, isChecked, onToggle, onDelete, onEdit }: HabitItemProps) {
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [editTitle, setEditTitle] = useState(habit.title);
  const [editTime, setEditTime] = useState(habit.scheduled_time);
  const [editLocation, setEditLocation] = useState(habit.location);
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setEditTitle(habit.title);
    setEditTime(habit.scheduled_time);
    setEditLocation(habit.location);
    setMode("edit");
  }

  async function handleSave() {
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
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
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
            onClick={handleSave}
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
      className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${
        isChecked ? "bg-gray-50 border-gray-100" : "bg-white border-gray-200"
      }`}
    >
      {/* check button */}
      <button
        onClick={onToggle}
        className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
          isChecked
            ? "bg-green-500 border-green-500 text-white"
            : "border-gray-300 hover:border-black"
        }`}
        aria-label={isChecked ? "チェックを外す" : "チェックする"}
      >
        {isChecked && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* content — new layout: meta on top, title below */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs mb-0.5 flex items-center gap-2 ${isChecked ? "text-gray-300" : "text-gray-400"}`}>
          <span>🕐 {habit.scheduled_time}</span>
          {habit.location && <span>📍 {habit.location}</span>}
        </p>
        <p className={`text-sm font-semibold ${isChecked ? "text-gray-300 line-through" : "text-gray-900"}`}>
          {habit.title}
        </p>
      </div>

      {/* actions */}
      <div className="flex-shrink-0 flex items-center gap-1">
        {mode === "delete" ? (
          <>
            <button
              onClick={onDelete}
              className="text-xs px-2 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              削除
            </button>
            <button
              onClick={() => setMode("view")}
              className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300"
            >
              取消
            </button>
          </>
        ) : (
          <>
            {/* edit pencil */}
            <button
              onClick={startEdit}
              className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-blue-400 transition-colors rounded-lg hover:bg-blue-50"
              aria-label="編集"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            {/* delete trash */}
            <button
              onClick={() => setMode("delete")}
              className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50"
              aria-label="削除"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </>
        )}
      </div>
    </li>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Template {
  id: number;
  name: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const newInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (editingId !== null) editInputRef.current?.focus();
  }, [editingId]);

  useEffect(() => {
    if (addingNew) newInputRef.current?.focus();
  }, [addingNew]);

  async function fetchTemplates() {
    try {
      const res = await fetch(`${API}/templates`);
      setTemplates(await res.json());
      setError("");
    } catch {
      setError("バックエンドに接続できません。サーバーを起動してください。");
    }
  }

  async function handleRename(id: number) {
    if (!editingName.trim()) return;
    await fetch(`${API}/templates/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingName.trim() }),
    });
    setEditingId(null);
    fetchTemplates();
  }

  async function handleDelete(id: number) {
    await fetch(`${API}/templates/${id}`, { method: "DELETE" });
    setConfirmDeleteId(null);
    fetchTemplates();
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    await fetch(`${API}/templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setNewName("");
    setAddingNew(false);
    fetchTemplates();
  }

  return (
    <main>
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <button
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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm mb-4">
          {error}
        </div>
      )}

      {/* テンプレート一覧 */}
      <ul className="flex flex-col gap-2 mb-4">
        {templates.map((t) => (
          <li key={t.id}>
            {confirmDeleteId === t.id ? (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="flex-1 text-sm text-red-700 font-medium">
                  「{t.name}」を削除しますか？
                  <span className="block text-xs font-normal text-red-500 mt-0.5">
                    紐付く習慣もすべて削除されます
                  </span>
                </p>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="text-xs px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium"
                >
                  削除する
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="text-xs px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
              </div>
            ) : editingId === t.id ? (
              <div className="flex items-center gap-2 p-4 bg-white border-2 border-blue-300 rounded-xl">
                <input
                  ref={editInputRef}
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(t.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="flex-1 border border-blue-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <button
                  onClick={() => handleRename(t.id)}
                  className="text-xs px-3 py-1.5 bg-black text-white rounded-lg hover:bg-gray-800 font-medium"
                >
                  保存
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                >
                  取消
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl">
                <span className="flex-1 text-sm font-semibold text-gray-800">
                  {t.name}
                </span>
                <button
                  onClick={() => {
                    setEditingId(t.id);
                    setEditingName(t.name);
                    setConfirmDeleteId(null);
                  }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  編集
                </button>
                <button
                  onClick={() => {
                    setConfirmDeleteId(t.id);
                    setEditingId(null);
                  }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors font-medium"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  削除
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* 新規追加 */}
      {addingNew ? (
        <div className="flex gap-2">
          <input
            ref={newInputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") {
                setAddingNew(false);
                setNewName("");
              }
            }}
            placeholder="テンプレート名を入力"
            className="flex-1 border border-blue-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="px-4 py-3 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            追加
          </button>
          <button
            onClick={() => {
              setAddingNew(false);
              setNewName("");
            }}
            className="px-4 py-3 bg-gray-100 text-gray-600 text-sm rounded-xl hover:bg-gray-200 transition-colors"
          >
            取消
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAddingNew(true)}
          className="w-full py-3.5 text-sm text-gray-500 border border-dashed border-gray-300 rounded-xl hover:border-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          新しいテンプレートを追加
        </button>
      )}
    </main>
  );
}

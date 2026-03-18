"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Template {
  id: number;
  name: string;
}

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** 指定した場合はナビゲーションせずにこのコールバックを呼ぶ（テンプレートから追加モード） */
  onSelect?: (templateId: number) => void;
  /** モーダルのタイトル（デフォルト: 今日はどっち？） */
  title?: string;
}

export default function TemplateSelectorModal({
  isOpen,
  onClose,
  onSelect,
  title = "今日はどっち？",
}: Props) {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) fetchTemplates();
  }, [isOpen]);

  async function fetchTemplates() {
    try {
      const res = await fetch(`${API}/templates`);
      setTemplates(await res.json());
      setError("");
    } catch {
      setError("バックエンドに接続できません。サーバーを起動してください。");
    }
  }

  function handleSelect(templateId: number) {
    if (onSelect) {
      onSelect(templateId);
      onClose();
      return;
    }
    // ナビゲーションモード: 日付 + テンプレートIDを保存してから遷移
    const today = new Date().toISOString().split("T")[0];
    localStorage.setItem("habit_last_visit_date", today);
    localStorage.setItem("habit_last_template_id", String(templateId));
    router.push(`/habits?template_id=${templateId}`);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* modal */}
      <div className="relative z-50 bg-white rounded-2xl w-80 max-w-[calc(100vw-2rem)] mx-4 shadow-2xl overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            ✕
          </button>
        </div>

        {/* body */}
        <div className="px-5 pb-5 flex flex-col gap-2">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-xs">
              {error}
            </div>
          )}

          {templates.length === 0 && !error && (
            <p className="text-center text-gray-400 text-sm py-4">
              テンプレートがありません。
              <br />
              <a href="/templates" className="text-blue-500 underline text-xs">
                テンプレートを追加する
              </a>
            </p>
          )}

          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => handleSelect(t.id)}
              className="w-full py-4 text-base font-semibold bg-white border-2 border-gray-200 rounded-xl hover:border-black hover:bg-gray-50 transition-all"
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

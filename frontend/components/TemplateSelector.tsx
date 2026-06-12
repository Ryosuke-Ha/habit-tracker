"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

interface Template {
  id: number;
  name: string;
}

export default function TemplateSelector() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`/templates`)
      .then((r) => r.json())
      .then(setTemplates)
      .catch(() => setError("バックエンドに接続できません。サーバーを起動してください。"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-center text-gray-400">読み込み中...</p>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {templates.map((t) => (
        <button
          key={t.id}
          onClick={() => router.push(`/habits?template_id=${t.id}`)}
          className="w-full py-5 text-lg font-semibold bg-white border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors shadow-sm"
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}

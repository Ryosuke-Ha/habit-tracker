"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";

interface LoadingOverlayProps {
  onComplete: () => void;
}

export default function LoadingOverlay({ onComplete }: LoadingOverlayProps) {
  const [textVisible, setTextVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // 200ms後にスライドアップ開始（0.8s アニメーション）→ 約1000msで表示完了
    // 1000msキープ → 2000msでフェードアウト開始
    // 600msフェードアウト → 2600msで完了コールバック
    const t1 = setTimeout(() => setTextVisible(true), 200);
    const t2 = setTimeout(() => setFadeOut(true), 2000);
    const t3 = setTimeout(() => onComplete(), 2600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 bg-black z-50 flex flex-col items-center justify-center transition-opacity duration-500 ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <TrendingUp
        className={`text-white w-16 h-16 mb-4 ${
          textVisible ? "animate-slide-up-fade-in" : "opacity-0 translate-y-5"
        }`}
      />
      <p
        className={`text-white text-2xl font-light tracking-[0.2em] ${
          textVisible ? "animate-slide-up-fade-in" : "opacity-0 translate-y-5"
        }`}
      >
        1%の改善をしよう
      </p>
    </div>
  );
}

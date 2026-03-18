"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export interface MenuItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

interface UserInfo {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface HamburgerMenuProps {
  items: MenuItem[];
  user?: UserInfo;
  onSignOut?: () => void;
}

export default function HamburgerMenu({ items, user, onSignOut }: HamburgerMenuProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* ハンバーガーボタン */}
      <button
        onClick={() => setOpen(true)}
        className="w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="メニューを開く"
        aria-expanded={open}
      >
        <span className="block w-5 h-0.5 bg-gray-700" />
        <span className="block w-5 h-0.5 bg-gray-700" />
        <span className="block w-5 h-0.5 bg-gray-700" />
      </button>

      {/* ドロワー全体コンテナ */}
      <div
        className={`fixed inset-0 z-40 flex justify-end transition-all duration-300 ${
          open ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        {/* 左: 半透明オーバーレイ */}
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
            open ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setOpen(false)}
        />

        {/* 右2/3: ドロワー本体 */}
        <div
          className={`relative w-2/3 h-full bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {/* ドロワーヘッダー */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <span className="text-sm font-bold text-gray-900 tracking-widest uppercase">
              Menu
            </span>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="メニューを閉じる"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ユーザー情報 */}
          {user && (
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50">
              {user.image ? (
                <Image
                  src={user.image}
                  alt={user.name ?? "ユーザー"}
                  width={40}
                  height={40}
                  className="rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-semibold">
                  {user.name?.[0] ?? "U"}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {user.name ?? "ユーザー"}
                </p>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              </div>
            </div>
          )}

          {/* メニュー項目 */}
          <nav className="flex-1 py-3 overflow-y-auto">
            {items.map((item, i) => (
              <button
                key={i}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                {item.icon && (
                  <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center text-gray-400">
                    {item.icon}
                  </span>
                )}
                <span className="text-base font-medium text-gray-800">
                  {item.label}
                </span>
              </button>
            ))}
          </nav>

          {/* ログアウト */}
          {onSignOut && (
            <div className="border-t border-gray-100 p-4">
              <button
                onClick={() => {
                  setOpen(false);
                  onSignOut();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="text-sm font-medium">ログアウト</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

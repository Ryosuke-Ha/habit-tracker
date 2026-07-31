"use client";

import { useEffect } from "react";

export default function CoachingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#ffffff";
    return () => {
      document.body.style.backgroundColor = prev;
    };
  }, []);

  return (
    <div className="-mx-4 -my-8 px-4 py-8 min-h-screen bg-white">
      {children}
    </div>
  );
}

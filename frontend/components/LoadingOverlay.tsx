"use client";

import { useEffect, useRef, useState } from "react";

const TEXT = "1%の改善をしよう";
const TYPEWRITER_START_MS = 500;
const CHAR_INTERVAL_MS = 150;
const FADE_START_MS = 3000;
const COMPLETE_MS = 3500;

interface LoadingOverlayProps {
  onComplete: () => void;
}

export default function LoadingOverlay({ onComplete }: LoadingOverlayProps) {
  const [typedCount, setTypedCount] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    TEXT.split("").forEach((_, i) => {
      timers.push(
        setTimeout(() => setTypedCount(i + 1), TYPEWRITER_START_MS + i * CHAR_INTERVAL_MS)
      );
    });

    const cursorInterval = setInterval(
      () => setCursorVisible((v) => !v),
      500
    );

    timers.push(setTimeout(() => setFadeOut(true), FADE_START_MS));
    timers.push(setTimeout(() => onCompleteRef.current(), COMPLETE_MS));

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(cursorInterval);
    };
  }, []);

  return (
    <>
      <style>{`
        @keyframes pixelRun {
          from { left: -64px; }
          to   { left: 100%; }
        }
        @keyframes showFrame1 {
          0%, 49.9% { opacity: 1; }
          50%, 100%  { opacity: 0; }
        }
        @keyframes showFrame2 {
          0%, 49.9% { opacity: 0; }
          50%, 100%  { opacity: 1; }
        }
        @keyframes progressFill {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: [
            "repeating-linear-gradient(",
            "  0deg,",
            "  transparent,",
            "  transparent 2px,",
            "  rgba(255,255,255,0.02) 2px,",
            "  rgba(255,255,255,0.02) 4px",
            "), #000000",
          ].join(""),
          transition: "opacity 0.5s ease",
          opacity: fadeOut ? 0 : 1,
          pointerEvents: fadeOut ? "none" : "auto",
        }}
      >
        {/* Running character */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: 64,
            marginBottom: 24,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: -64,
              width: 64,
              height: 64,
              animation: "pixelRun 3s linear forwards",
            }}
          >
            {/* Frame 1 */}
            <svg
              viewBox="0 0 16 16"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 64,
                height: 64,
                imageRendering: "pixelated",
                animation: "showFrame1 0.2s steps(1, end) infinite",
              }}
            >
              <rect x="6" y="0" width="4" height="4" fill="#ffd700" />
              <rect x="5" y="4" width="6" height="5" fill="#ff6b35" />
              <rect x="3" y="6" width="2" height="3" fill="#ff6b35" />
              <rect x="11" y="4" width="2" height="3" fill="#ff6b35" />
              <rect x="5" y="9" width="2" height="4" fill="#4a90d9" />
              <rect x="9" y="9" width="2" height="3" fill="#4a90d9" />
              <rect x="7" y="1" width="1" height="1" fill="#000" />
              <rect x="9" y="1" width="1" height="1" fill="#000" />
            </svg>
            {/* Frame 2 */}
            <svg
              viewBox="0 0 16 16"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 64,
                height: 64,
                imageRendering: "pixelated",
                animation: "showFrame2 0.2s steps(1, end) infinite",
              }}
            >
              <rect x="6" y="0" width="4" height="4" fill="#ffd700" />
              <rect x="5" y="4" width="6" height="5" fill="#ff6b35" />
              <rect x="3" y="4" width="2" height="3" fill="#ff6b35" />
              <rect x="11" y="6" width="2" height="3" fill="#ff6b35" />
              <rect x="5" y="9" width="2" height="3" fill="#4a90d9" />
              <rect x="9" y="9" width="2" height="4" fill="#4a90d9" />
              <rect x="7" y="1" width="1" height="1" fill="#000" />
              <rect x="9" y="1" width="1" height="1" fill="#000" />
            </svg>
          </div>
        </div>

        {/* Pixel progress bar */}
        <div
          style={{
            width: "calc(100% - 48px)",
            maxWidth: 400,
            height: 12,
            backgroundColor: "#000",
            border: "2px solid #00ff88",
            marginBottom: 32,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              backgroundColor: "#00ff88",
              animation: "progressFill 3s steps(25, end) forwards",
            }}
          />
        </div>

        {/* Typewriter text */}
        <div
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 12,
            color: "#ff6b35",
            letterSpacing: "0.05em",
          }}
        >
          {TEXT.slice(0, typedCount)}
          <span style={{ opacity: cursorVisible ? 1 : 0 }}>|</span>
        </div>
      </div>
    </>
  );
}

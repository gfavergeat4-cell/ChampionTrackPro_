import React, { useState, useEffect } from "react";
import { Platform } from "react-native";

const DISMISSED_KEY = "pwa-banner-dismissed";

export default function PWAInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed) return;

    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isIOS && !isStandalone) {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "#0D1526",
        borderTop: "1px solid #00D4FF",
        padding: "16px 20px 28px",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        boxShadow: "0 -4px 24px rgba(0, 212, 255, 0.12)",
      }}
    >
      {/* Share icon */}
      <div
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: 8,
          background: "rgba(0,212,255,0.1)",
          border: "1px solid rgba(0,212,255,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 2,
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#00D4FF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      </div>

      {/* Text */}
      <div style={{ flex: 1 }}>
        <p
          style={{
            margin: "0 0 4px",
            fontSize: 14,
            fontWeight: 700,
            color: "#FFFFFF",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          Enable Notifications
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "rgba(255,255,255,0.6)",
            lineHeight: 1.5,
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          Tap{" "}
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.8)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ display: "inline", verticalAlign: "middle", marginBottom: 1 }}
          >
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>{" "}
          then{" "}
          <span style={{ color: "#00D4FF", fontWeight: 600 }}>
            &lsquo;Add to Home Screen&rsquo;
          </span>{" "}
          to receive training alerts
        </p>
      </div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        style={{
          flexShrink: 0,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 4,
          color: "rgba(255,255,255,0.4)",
          lineHeight: 1,
        }}
        aria-label="Dismiss"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { Platform } from "react-native";
import { registerWebPushTokenForCurrentUser } from "../services/webNotifications";

const DISMISSED_KEY = "pwa-banner-dismissed";

export default function PWAInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [deniedMsg, setDeniedMsg] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed) return;

    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    const alreadyGranted =
      typeof Notification !== "undefined" && Notification.permission === "granted";

    if (isIOS && isStandalone && !alreadyGranted) {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  };

  const handleEnableNotifications = async () => {
    try {
      await registerWebPushTokenForCurrentUser();
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        localStorage.setItem(DISMISSED_KEY, "1");
        setVisible(false);
      } else {
        setDeniedMsg(true);
      }
    } catch {
      setDeniedMsg(true);
    }
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

      {/* Text + button */}
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

        {deniedMsg ? (
          <p
            style={{
              margin: "0 0 10px",
              fontSize: 13,
              color: "#FFB347",
              lineHeight: 1.5,
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            Go to iPhone Settings → Notifications → ChampionTrackPro → Allow
          </p>
        ) : (
          <p
            style={{
              margin: "0 0 10px",
              fontSize: 13,
              color: "rgba(255,255,255,0.6)",
              lineHeight: 1.5,
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            Receive training alerts and reminders
          </p>
        )}

        <button
          onClick={handleEnableNotifications}
          style={{
            background: "#00D4FF",
            color: "#000000",
            border: "none",
            borderRadius: 6,
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          Enable Notifications
        </button>
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

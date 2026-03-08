import React, { useState, useEffect } from "react";
import { Platform } from "react-native";
import { registerWebPushTokenForCurrentUser } from "../services/webNotifications";

const DISMISSED_KEY = "pwa-banner-dismissed";

type BannerState = "install" | "enable" | "hidden";

export default function PWAInstallBanner() {
  const [bannerState, setBannerState] = useState<BannerState>("hidden");
  const [deniedMsg, setDeniedMsg] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    if (localStorage.getItem(DISMISSED_KEY) === "true") return;
    if (typeof Notification !== "undefined" && Notification.permission === "granted") return;

    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (!isIOS) return;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    setBannerState(isStandalone ? "enable" : "install");
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setBannerState("hidden");
  };

  const handleEnableNotifications = async () => {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      try {
        await registerWebPushTokenForCurrentUser();
      } catch (e) {
        console.warn("[PWA] registerWebPushTokenForCurrentUser failed:", e);
      }
      localStorage.setItem(DISMISSED_KEY, "true");
      setBannerState("hidden");
    } else {
      setDeniedMsg(true);
    }
  };

  if (bannerState === "hidden") return null;

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
        boxShadow: "0 -4px 24px rgba(0, 212, 255, 0.12)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        style={{
          position: "absolute",
          top: 12,
          right: 16,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 4,
          color: "rgba(255,255,255,0.4)",
          lineHeight: 1,
        }}
        aria-label="Dismiss"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {bannerState === "install" ? (
        /* STATE 1 — not yet installed as PWA */
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{
            flexShrink: 0, width: 36, height: 36, borderRadius: 8,
            background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>
              For the best experience, install the app:
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
              Tap{" "}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline", verticalAlign: "middle" }}>
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              {" "}then{" "}
              <span style={{ color: "#00D4FF", fontWeight: 600 }}>'Add to Home Screen'</span>
            </p>
          </div>
        </div>
      ) : (
        /* STATE 2 — PWA installed, need notification permission */
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>
            Enable Notifications
          </p>
          {deniedMsg ? (
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#FFB347", lineHeight: 1.5 }}>
              To enable: Settings → Notifications → ChampionTrackPro → Allow
            </p>
          ) : (
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
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
              WebkitTapHighlightColor: "transparent",
            } as React.CSSProperties}
          >
            Enable Notifications
          </button>
        </div>
      )}
    </div>
  );
}

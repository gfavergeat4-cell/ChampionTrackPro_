/**
 * CreateTeamModal.tsx
 * Full-screen modal for creating a new team.
 * On save: writes Firestore doc, triggers calendar sync if URL provided,
 * then navigates to AdminTeamDetailScreen with initialTab="Settings".
 */

import React, { useState, useRef } from "react";
import { Platform, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";
import { useIsDesktop } from "../hooks/useIsDesktop";

// ── Constants ─────────────────────────────────────────────────────────────────

const SPORTS = ["Basketball", "Soccer", "Volleyball", "Football", "Baseball", "Swimming", "Track & Field", "Tennis", "Other"];
const DIVISIONS = ["NCAA D1", "NCAA D2", "NCAA D3", "NAIA", "JUCO", "High School", "Pro", "Club", "Other"];

const DAR_QUESTIONS = [
  { key: "fatigue", label: "Fatigue", icon: "⚡" },
  { key: "stress", label: "Stress", icon: "🧠" },
  { key: "sleep", label: "Sleep Quality", icon: "😴" },
  { key: "soreness", label: "Muscle Soreness", icon: "💪" },
  { key: "mood", label: "Mood", icon: "😊" },
  { key: "motivation", label: "Motivation", icon: "🎯" },
];

function generateCode(len = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// ── Input style ───────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,212,255,0.20)",
  background: "rgba(255,255,255,0.05)",
  color: "#fff",
  fontSize: 13,
  fontFamily: "'DM Sans', system-ui",
  outline: "none",
  boxSizing: "border-box",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CreateTeamModal() {
  const navigation = useNavigation<any>();
  const isDesktop = useIsDesktop();

  const [name, setName] = useState("");
  const [sport, setSport] = useState("");
  const [division, setDivision] = useState("");
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [seasonStart, setSeasonStart] = useState("");
  const [seasonEnd, setSeasonEnd] = useState("");
  const [activeDARMetrics, setActiveDARMetrics] = useState<string[]>(DAR_QUESTIONS.map(q => q.key));
  const [calendarUrl, setCalendarUrl] = useState("");
  const [calendarActive, setCalendarActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (Platform.OS !== "web") return null;

  const handleLogoChange = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoBase64((ev.target?.result as string) || null);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!name.trim()) { setError("Team name is required."); return; }
    if (activeDARMetrics.length < 3) { setError("Select at least 3 DAR metrics."); return; }
    setSaving(true);
    setError(null);
    try {
      const inviteCode = generateCode(6);
      const docRef = await addDoc(collection(db, "teams"), {
        name: name.trim(),
        sport,
        division,
        logoUrl: logoBase64 || null,
        seasonStart,
        seasonEnd,
        activeDARMetrics,
        calendarUrl: calendarUrl.trim(),
        icsUrl: calendarUrl.trim(),
        calendarActive: calendarUrl.trim() ? calendarActive : false,
        inviteCode,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Trigger calendar sync if URL provided
      if (calendarUrl.trim()) {
        try {
          const fn = httpsCallable(functions, "syncIcsNow");
          await fn({ teamId: docRef.id });
        } catch {}
      }

      navigation.navigate("AdminTeamDetailScreen", {
        teamId: docRef.id,
        teamName: name.trim(),
        initialTab: "Settings",
      });
    } catch (e: any) {
      setError(e?.message || String(e));
      setSaving(false);
    }
  };

  const contentWidth = isDesktop ? 600 : "100%";

  return (
    <div style={{ minHeight: "100vh", overflowY: "auto", background: "radial-gradient(ellipse at top, #0D1F3C 0%, #0A0F1E 60%)", color: "#fff", fontFamily: "'DM Sans', system-ui, sans-serif", padding: isDesktop ? "32px 48px 80px 48px" : "20px 16px 80px 16px" }}>
      <div style={{ maxWidth: contentWidth, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <button type="button" onClick={() => navigation.goBack()} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, color: "rgba(255,255,255,0.55)", padding: "8px 14px", cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', system-ui" }}>
            ← Cancel
          </button>
          <h1 style={{ margin: 0, fontSize: isDesktop ? 22 : 18, fontWeight: 700, color: "#fff" }}>
            Create New Team
          </h1>
        </div>

        {/* Team Name */}
        <Field label="Team Name *">
          <input
            value={name}
            onChange={(e: any) => setName(e.target.value)}
            placeholder="e.g. Wildcats Basketball"
            style={inputStyle}
          />
        </Field>

        {/* Sport + Division */}
        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: 14, marginBottom: 20 }}>
          <Field label="Sport">
            <select value={sport} onChange={(e: any) => setSport(e.target.value)} style={inputStyle}>
              <option value="">— Select sport —</option>
              {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Division">
            <select value={division} onChange={(e: any) => setDivision(e.target.value)} style={inputStyle}>
              <option value="">— Select division —</option>
              {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
        </div>

        {/* Logo upload */}
        <Field label="Team Logo">
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {logoBase64 ? (
              <div style={{ width: 60, height: 60, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(0,212,255,0.3)", flexShrink: 0 }}>
                <img src={logoBase64} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            ) : (
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(0,212,255,0.08)", border: "2px dashed rgba(0,212,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 22 }}>🏆</span>
              </div>
            )}
            <div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoChange} style={{ display: "none" }} />
              <button type="button" onClick={() => fileInputRef.current?.click()} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(0,212,255,0.30)", background: "transparent", color: "#00D4FF", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', system-ui" }}>
                {logoBase64 ? "Change Logo" : "Upload Logo"}
              </button>
              {logoBase64 && (
                <button type="button" onClick={() => setLogoBase64(null)} style={{ marginLeft: 8, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,77,77,0.25)", background: "transparent", color: "rgba(255,77,77,0.60)", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', system-ui" }}>
                  Remove
                </button>
              )}
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", marginTop: 4 }}>PNG, JPG — max 200KB recommended</div>
            </div>
          </div>
        </Field>

        {/* Season dates */}
        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: 14, marginBottom: 20 }}>
          <Field label="Season Start">
            <input type="date" value={seasonStart} onChange={(e: any) => setSeasonStart(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Season End">
            <input type="date" value={seasonEnd} onChange={(e: any) => setSeasonEnd(e.target.value)} style={inputStyle} />
          </Field>
        </div>

        {/* Active DAR Metrics */}
        <Field label="Active DAR Metrics (min. 3)">
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 10, marginTop: 4 }}>
            {DAR_QUESTIONS.map(q => {
              const active = activeDARMetrics.includes(q.key);
              return (
                <button key={q.key} type="button"
                  onClick={() => {
                    if (active && activeDARMetrics.length <= 3) return;
                    setActiveDARMetrics(prev => active ? prev.filter(k => k !== q.key) : [...prev, q.key]);
                  }}
                  style={{ padding: "7px 16px", borderRadius: 20, border: active ? "1px solid #00D4FF" : "1px solid rgba(255,255,255,0.15)", background: active ? "rgba(0,212,255,0.12)" : "transparent", color: active ? "#00D4FF" : "rgba(255,255,255,0.40)", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', system-ui", fontWeight: active ? 600 : 400, display: "flex", alignItems: "center", gap: 5 }}>
                  <span>{q.icon}</span>{q.label}
                </button>
              );
            })}
          </div>
        </Field>

        {/* ICS Calendar URL */}
        <Field label="ICS Calendar URL (optional)">
          <input type="url" value={calendarUrl} onChange={(e: any) => setCalendarUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/..." style={{ ...inputStyle, fontFamily: "'Space Mono', monospace" }} />
        </Field>

        {/* Auto-sync toggle */}
        {calendarUrl.trim() && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, padding: "12px 14px", borderRadius: 10, background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.12)" }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>Auto-sync (every 15 min)</span>
            <button type="button" onClick={() => setCalendarActive(v => !v)} style={{ width: 44, height: 24, borderRadius: 12, border: "none", background: calendarActive ? "#00D4FF" : "rgba(255,255,255,0.15)", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 3, left: calendarActive ? 22 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,77,77,0.08)", border: "1px solid rgba(255,77,77,0.25)", color: "#FCA5A5", fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{ width: "100%", padding: "16px", borderRadius: 12, border: "none", background: saving ? "rgba(0,212,255,0.3)" : "linear-gradient(135deg,#00BFFF,#0066FF)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: saving ? "not-allowed" : "pointer", fontFamily: "'DM Sans', system-ui", letterSpacing: 0.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
        >
          {saving ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <span>Creating…</span>
            </>
          ) : (
            "Create Team"
          )}
        </button>

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.40)", letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 8 }}>{label}</label>
      {children}
    </div>
  );
}

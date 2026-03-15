/**
 * AdminTeamDetailScreen.tsx
 * 5-tab team detail screen for admins.
 * Route params: { teamId: string, teamName?: string, initialTab?: string }
 */

import React, { useEffect, useState, useCallback } from "react";
import { Platform, ActivityIndicator } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  doc, getDoc, getDocs, updateDoc, setDoc, deleteDoc,
  serverTimestamp, collection, query, orderBy, where,
  getCountFromServer,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";
import { useIsDesktop } from "../hooks/useIsDesktop";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeamDoc {
  name?: string;
  sport?: string;
  division?: string;
  logoUrl?: string;
  seasonStart?: string;
  seasonEnd?: string;
  inviteCode?: string;
  calendarUrl?: string;
  icsUrl?: string;
  calendarActive?: boolean;
  calendarLastSyncStatus?: "ok" | "error" | "syncing";
  calendarSyncError?: string;
  calendarLastSyncAt?: any;
  activeDARMetrics?: string[];
}

interface MemberDoc {
  uid: string;
  name?: string;
  email?: string;
  role?: "coach" | "athlete";
  joinedAt?: any;
}

interface TrainingEvent {
  id: string;
  date?: string;
  sessionType?: string;
  isGame?: boolean;
  durationMinutes?: number;
  title?: string;
}

type Tab = "Overview" | "Members" | "Calendar" | "Settings" | "Questionnaire";
type CopiedKey = "coach-code" | "coach-link" | "athlete-code" | "athlete-link" | null;

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS: Tab[] = ["Overview", "Members", "Calendar", "Settings", "Questionnaire"];
const JOIN_BASE = "https://champion-track-pro.vercel.app";

const DAR_QUESTIONS = [
  { key: "fatigue", label: "Fatigue", description: "Overall physical fatigue level after session", icon: "⚡" },
  { key: "stress", label: "Stress", description: "General psychological stress level", icon: "🧠" },
  { key: "sleep", label: "Sleep Quality", description: "Quality of sleep last night", icon: "😴" },
  { key: "soreness", label: "Muscle Soreness", description: "Post-session muscle soreness", icon: "💪" },
  { key: "mood", label: "Mood", description: "General mood and emotional state", icon: "😊" },
  { key: "motivation", label: "Motivation", description: "Motivation level for training", icon: "🎯" },
];

const SPORTS = ["Basketball", "Soccer", "Volleyball", "Football", "Baseball", "Swimming", "Track & Field", "Tennis", "Other"];
const DIVISIONS = ["NCAA D1", "NCAA D2", "NCAA D3", "NAIA", "JUCO", "High School", "Pro", "Club", "Other"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateCode(len = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function copyText(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const el = document.createElement("textarea");
  el.value = text;
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

function formatDate(val: any): string {
  if (!val) return "—";
  try {
    const d = val instanceof Date ? val : val?.toDate ? val.toDate() : new Date(val);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return "—"; }
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

export default function AdminTeamDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isDesktop = useIsDesktop();
  const { teamId, teamName: routeTeamName, initialTab } = route.params || {};

  const [activeTab, setActiveTab] = useState<Tab>((initialTab as Tab) || "Overview");

  // Team data
  const [team, setTeam] = useState<TeamDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState(0);

  // Members tab
  const [members, setMembers] = useState<MemberDoc[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [removingUid, setRemovingUid] = useState<string | null>(null);

  // Calendar tab
  const [trainings, setTrainings] = useState<TrainingEvent[]>([]);
  const [trainingsLoaded, setTrainingsLoaded] = useState(false);
  const [calendarFilter, setCalendarFilter] = useState<"all" | "past" | "upcoming">("all");

  // Calendar/settings form state
  const [calendarUrl, setCalendarUrl] = useState("");
  const [calendarActive, setCalendarActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  // Team info form
  const [editName, setEditName] = useState("");
  const [editSport, setEditSport] = useState("");
  const [editDivision, setEditDivision] = useState("");
  const [editSeasonStart, setEditSeasonStart] = useState("");
  const [editSeasonEnd, setEditSeasonEnd] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // DAR metrics
  const [activeDARMetrics, setActiveDARMetrics] = useState<string[]>(DAR_QUESTIONS.map(q => q.key));

  // Access codes
  const [copied, setCopied] = useState<CopiedKey>(null);

  // ── Load team ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!teamId) { setError("Missing teamId"); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const [snap, countSnap] = await Promise.all([
          getDoc(doc(db, "teams", teamId)),
          getCountFromServer(collection(db, "teams", teamId, "members")).catch(() => null),
        ]);
        if (cancelled) return;
        if (!snap.exists()) { setError("Team not found"); setLoading(false); return; }
        const data = snap.data() as TeamDoc;
        setTeam(data);
        setCalendarUrl(data.calendarUrl || data.icsUrl || "");
        setCalendarActive(data.calendarActive !== false);
        setEditName(data.name || "");
        setEditSport(data.sport || "");
        setEditDivision(data.division || "");
        setEditSeasonStart(data.seasonStart || "");
        setEditSeasonEnd(data.seasonEnd || "");
        if (data.activeDARMetrics?.length) setActiveDARMetrics(data.activeDARMetrics);
        if (countSnap) setMemberCount(countSnap.data().count);
        let code = data.inviteCode;
        if (!code) {
          code = generateCode(6);
          await setDoc(doc(db, "teams", teamId), { inviteCode: code }, { merge: true });
        }
        setInviteCode(code);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [teamId]);

  // ── Load members (lazy) ───────────────────────────────────────────────────

  useEffect(() => {
    if (activeTab !== "Members" || membersLoaded || !teamId) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(collection(db, "teams", teamId, "members"));
        if (cancelled) return;
        const items: MemberDoc[] = snap.docs.map(d => ({ uid: d.id, ...d.data() } as MemberDoc));
        setMembers(items.sort((a, b) => {
          if (a.role === "coach" && b.role !== "coach") return -1;
          if (b.role === "coach" && a.role !== "coach") return 1;
          return (a.name || "").localeCompare(b.name || "");
        }));
        setMembersLoaded(true);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [activeTab, teamId, membersLoaded]);

  // ── Load trainings (lazy) ─────────────────────────────────────────────────

  useEffect(() => {
    if (activeTab !== "Calendar" || trainingsLoaded || !teamId) return;
    let cancelled = false;
    (async () => {
      try {
        const now = new Date();
        const past30Str = new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];
        const future30Str = new Date(now.getTime() + 30 * 86400000).toISOString().split("T")[0];
        const q = query(
          collection(db, "teams", teamId, "trainings"),
          where("date", ">=", past30Str),
          where("date", "<=", future30Str),
          orderBy("date", "desc"),
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        setTrainings(snap.docs.map(d => ({ id: d.id, ...d.data() } as TrainingEvent)));
        setTrainingsLoaded(true);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [activeTab, teamId, trainingsLoaded]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleRemoveMember = useCallback(async (member: MemberDoc) => {
    if (!teamId) return;
    const ok = window.confirm(`Remove ${member.name || member.email || member.uid} from the team?`);
    if (!ok) return;
    setRemovingUid(member.uid);
    try {
      await deleteDoc(doc(db, "teams", teamId, "members", member.uid));
      try { await setDoc(doc(db, "users", member.uid), { teamId: null }, { merge: true }); } catch {}
      setMembers(prev => prev.filter(m => m.uid !== member.uid));
      setMemberCount(prev => Math.max(0, prev - 1));
    } catch (e: any) {
      alert("Error removing member: " + (e?.message || String(e)));
    } finally {
      setRemovingUid(null);
    }
  }, [teamId]);

  const handleSaveCalendar = useCallback(async () => {
    if (!teamId) return;
    setSaving(true); setSaveMsg(null);
    try {
      await updateDoc(doc(db, "teams", teamId), {
        calendarUrl: calendarUrl.trim(),
        icsUrl: calendarUrl.trim(),
        calendarActive,
        updatedAt: serverTimestamp(),
      });
      setSaveMsg("Saved.");
      setTimeout(() => setSaveMsg(null), 2500);
    } catch (e: any) {
      setSaveMsg("Error: " + (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
  }, [teamId, calendarUrl, calendarActive]);

  const handleSyncNow = useCallback(async () => {
    if (!teamId) return;
    setSyncing(true); setSyncMsg(null);
    try {
      const fn = httpsCallable(functions, "syncIcsNow");
      const result: any = await fn({ teamId });
      const d = result?.data || {};
      setSyncMsg(`Done — ${d.created ?? 0} created, ${d.updated ?? 0} updated`);
      setTrainingsLoaded(false);
    } catch (e: any) {
      setSyncMsg("Error: " + (e?.message || String(e)));
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 4000);
    }
  }, [teamId]);

  const handleSaveTeamInfo = useCallback(async () => {
    if (!teamId) return;
    setSavingInfo(true); setInfoMsg(null);
    try {
      await updateDoc(doc(db, "teams", teamId), {
        name: editName.trim(),
        sport: editSport,
        division: editDivision,
        seasonStart: editSeasonStart,
        seasonEnd: editSeasonEnd,
        updatedAt: serverTimestamp(),
      });
      setInfoMsg("Saved.");
      setTimeout(() => setInfoMsg(null), 2500);
    } catch (e: any) {
      setInfoMsg("Error: " + (e?.message || String(e)));
    } finally {
      setSavingInfo(false);
    }
  }, [teamId, editName, editSport, editDivision, editSeasonStart, editSeasonEnd]);

  const handleSaveDARMetrics = useCallback(async () => {
    if (!teamId) return;
    if (activeDARMetrics.length < 3) { alert("Select at least 3 DAR metrics."); return; }
    try {
      await updateDoc(doc(db, "teams", teamId), { activeDARMetrics, updatedAt: serverTimestamp() });
    } catch (e: any) {
      alert("Error: " + (e?.message || String(e)));
    }
  }, [teamId, activeDARMetrics]);

  const handleCopy = useCallback(async (key: CopiedKey, text: string) => {
    try {
      await copyText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const teamName = team?.name || routeTeamName || teamId;
  const coachCode = inviteCode ? `${inviteCode}-C` : "—";
  const athleteCode = inviteCode ? `${inviteCode}-A` : "—";
  const coachLink = inviteCode ? `${JOIN_BASE}/?code=${inviteCode}-C` : "";
  const athleteLink = inviteCode ? `${JOIN_BASE}/?code=${inviteCode}-A` : "";

  const syncStatus = team?.calendarLastSyncStatus;
  const syncDot = syncStatus === "ok" ? "#00FF9D" : syncStatus === "error" ? "#FF4D4D" : syncStatus === "syncing" ? "#FFB800" : "rgba(255,255,255,0.25)";
  const syncLabel = syncStatus === "ok" ? "Synced" : syncStatus === "error" ? (team?.calendarSyncError ? `Error: ${team.calendarSyncError}` : "Sync error") : syncStatus === "syncing" ? "Syncing…" : (!team?.calendarUrl && !team?.icsUrl) ? "No calendar URL set" : "Never synced";

  const today = new Date().toISOString().split("T")[0];
  const filteredTrainings = trainings.filter(t => {
    if (calendarFilter === "past") return t.date && t.date < today;
    if (calendarFilter === "upcoming") return t.date && t.date >= today;
    return true;
  });

  const coaches = members.filter(m => m.role === "coach");
  const athletes = members.filter(m => m.role !== "coach");

  // ── Guards ────────────────────────────────────────────────────────────────

  if (Platform.OS !== "web") return null;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0F1E", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#00D4FF" />
      </div>
    );
  }

  if (error || !team) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0F1E", display: "flex", alignItems: "center", justifyContent: "center", color: "#FCA5A5", fontFamily: "'DM Sans', system-ui", fontSize: 14 }}>
        {error || "Team not found"}
      </div>
    );
  }

  // ── Tab renderers ─────────────────────────────────────────────────────────

  function renderOverview() {
    return (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(4,1fr)" : "repeat(2,1fr)", gap: 12, marginBottom: 20 }}>
          <StatCard label="Members" value={memberCount} color="#00D4FF" />
          <StatCard label="Coaches" value={coaches.length > 0 ? coaches.length : "—"} color="#00FF9D" />
          <StatCard label="Sync" value={syncStatus === "ok" ? "OK" : syncStatus === "error" ? "ERROR" : syncStatus === "syncing" ? "..." : "—"} color={syncDot} />
          <StatCard label="Calendar" value={team?.calendarUrl || team?.icsUrl ? "Active" : "None"} color={team?.calendarUrl || team?.icsUrl ? "#00FF9D" : "rgba(255,255,255,0.30)"} />
        </div>

        <Section title="Analytics" icon="📊">
          <p style={{ margin: "0 0 14px 0", fontSize: 13, color: "rgba(255,255,255,0.50)", lineHeight: 1.6 }}>
            Open the full performance dashboard — Morning Brief, EMA trends, readiness scores, and DAR metrics.
          </p>
          <ActionBtn primary onClick={() => navigation.navigate("AdminPerformanceDashboard", { role: "admin", teamId, teamName })}>
            Open Analytics Dashboard →
          </ActionBtn>
        </Section>

        <Section title="Team Info" icon="ℹ️">
          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(3,1fr)" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <InfoRow label="Sport" value={team?.sport || "—"} />
            <InfoRow label="Division" value={team?.division || "—"} />
            <InfoRow label="Season Start" value={team?.seasonStart || "—"} />
            <InfoRow label="Season End" value={team?.seasonEnd || "—"} />
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("Settings")}
            style={{ background: "transparent", border: "1px solid rgba(0,212,255,0.3)", borderRadius: 8, color: "#00D4FF", fontSize: 12, padding: "6px 14px", cursor: "pointer", fontFamily: "'DM Sans', system-ui" }}
          >
            Edit Settings →
          </button>
        </Section>
      </div>
    );
  }

  function renderMembers() {
    if (!membersLoaded) {
      return (
        <div style={{ display: "flex", justifyContent: "center", padding: 64 }}>
          <ActivityIndicator color="#00D4FF" />
        </div>
      );
    }

    if (coaches.length === 0 && athletes.length === 0) {
      return (
        <Section title="No Members Yet" icon="👥">
          <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "rgba(255,255,255,0.50)" }}>
            Share the access codes to invite coaches and athletes.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: 16 }}>
            <CodeCard label="Coach Code" color="#00D4FF" code={coachCode} link={coachLink} copied={copied} codeKey="coach-code" linkKey="coach-link" onCopyCode={() => handleCopy("coach-code", coachCode)} onCopyLink={() => handleCopy("coach-link", coachLink)} />
            <CodeCard label="Athlete Code" color="#00FF9D" code={athleteCode} link={athleteLink} copied={copied} codeKey="athlete-code" linkKey="athlete-link" onCopyCode={() => handleCopy("athlete-code", athleteCode)} onCopyLink={() => handleCopy("athlete-link", athleteLink)} />
          </div>
        </Section>
      );
    }

    return (
      <div>
        {coaches.length > 0 && (
          <Section title={`Coaches (${coaches.length})`} icon="🎓">
            <MemberTable members={coaches} removingUid={removingUid} onRemove={handleRemoveMember} />
          </Section>
        )}
        <Section title={`Athletes (${athletes.length})`} icon="🏃">
          {athletes.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.40)" }}>No athletes yet.</p>
          ) : (
            <MemberTable members={athletes} removingUid={removingUid} onRemove={handleRemoveMember} />
          )}
        </Section>
      </div>
    );
  }

  function renderCalendar() {
    const hasCalendar = !!(team?.calendarUrl || team?.icsUrl);
    return (
      <div>
        <Section title="Sync Status" icon="🔄">
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${syncDot}22`, border: `2px solid ${syncDot}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: syncDot }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{syncLabel}</div>
              {team?.calendarLastSyncAt && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                  Last sync: {formatDate(team.calendarLastSyncAt)}
                </div>
              )}
            </div>
          </div>
          <ActionBtn onClick={handleSyncNow} disabled={syncing || !hasCalendar}>
            {syncing ? "Syncing…" : "Sync Now"}
          </ActionBtn>
          {syncMsg && <p style={{ margin: "8px 0 0 0", fontSize: 12, color: syncMsg.startsWith("Error") ? "#FCA5A5" : "#00FF9D" }}>{syncMsg}</p>}
        </Section>

        <Section title="Training Events" icon="📅">
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" as const }}>
            {(["all", "past", "upcoming"] as const).map(f => (
              <button key={f} type="button" onClick={() => setCalendarFilter(f)} style={{ padding: "5px 14px", borderRadius: 20, border: calendarFilter === f ? "1px solid #00D4FF" : "1px solid rgba(255,255,255,0.15)", background: calendarFilter === f ? "rgba(0,212,255,0.12)" : "transparent", color: calendarFilter === f ? "#00D4FF" : "rgba(255,255,255,0.50)", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', system-ui", textTransform: "capitalize" as const }}>
                {f}
              </button>
            ))}
          </div>

          {!trainingsLoaded ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 32 }}><ActivityIndicator color="#00D4FF" /></div>
          ) : filteredTrainings.length === 0 ? (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", padding: "12px 0" }}>No training events found for this period.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredTrainings.map(t => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.isGame ? "#FFB800" : "#00D4FF", flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>
                        {t.title || t.sessionType || "Training"}
                        {t.isGame && <span style={{ marginLeft: 6, fontSize: 10, color: "#FFB800", letterSpacing: 1 }}>GAME</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>
                        {t.date || "—"}{t.durationMinutes ? ` · ${t.durationMinutes}min` : ""}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: t.date && t.date < today ? "rgba(255,255,255,0.30)" : "#00D4FF", flexShrink: 0 }}>
                    {t.date && t.date < today ? "Past" : "Upcoming"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Calendar URL" icon="🔗">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>Auto-sync (every 15 min)</span>
            <Toggle value={calendarActive} onChange={setCalendarActive} />
          </div>
          <input type="url" value={calendarUrl} onChange={(e: any) => setCalendarUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/..." style={{ ...inputStyle, fontFamily: "'Space Mono', monospace", marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const }}>
            <ActionBtn primary onClick={handleSaveCalendar} disabled={saving}>{saving ? "Saving…" : "Save"}</ActionBtn>
            <ActionBtn onClick={handleSyncNow} disabled={syncing || !calendarUrl.trim()}>{syncing ? "Syncing…" : "Sync Now"}</ActionBtn>
          </div>
          {saveMsg && <p style={{ margin: "8px 0 0 0", fontSize: 12, color: saveMsg.startsWith("Error") ? "#FCA5A5" : "#00FF9D" }}>{saveMsg}</p>}
        </Section>
      </div>
    );
  }

  function renderSettings() {
    return (
      <div>
        <Section title="Team Info" icon="✏️">
          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: 14, marginBottom: 16 }}>
            <FormField label="Team Name">
              <input value={editName} onChange={(e: any) => setEditName(e.target.value)} style={inputStyle} />
            </FormField>
            <FormField label="Sport">
              <select value={editSport} onChange={(e: any) => setEditSport(e.target.value)} style={inputStyle}>
                <option value="">— Select sport —</option>
                {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Division">
              <select value={editDivision} onChange={(e: any) => setEditDivision(e.target.value)} style={inputStyle}>
                <option value="">— Select division —</option>
                {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </FormField>
            <FormField label="Season Start">
              <input type="date" value={editSeasonStart} onChange={(e: any) => setEditSeasonStart(e.target.value)} style={inputStyle} />
            </FormField>
            <FormField label="Season End">
              <input type="date" value={editSeasonEnd} onChange={(e: any) => setEditSeasonEnd(e.target.value)} style={inputStyle} />
            </FormField>
          </div>
          <ActionBtn primary onClick={handleSaveTeamInfo} disabled={savingInfo}>{savingInfo ? "Saving…" : "Save Team Info"}</ActionBtn>
          {infoMsg && <p style={{ margin: "8px 0 0 0", fontSize: 12, color: infoMsg.startsWith("Error") ? "#FCA5A5" : "#00FF9D" }}>{infoMsg}</p>}
        </Section>

        <Section title="Access Codes" icon="🔑">
          <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
            Share these codes with staff and athletes to join the team.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: 16 }}>
            <CodeCard label="Coach Code" color="#00D4FF" code={coachCode} link={coachLink} copied={copied} codeKey="coach-code" linkKey="coach-link" onCopyCode={() => handleCopy("coach-code", coachCode)} onCopyLink={() => handleCopy("coach-link", coachLink)} />
            <CodeCard label="Athlete Code" color="#00FF9D" code={athleteCode} link={athleteLink} copied={copied} codeKey="athlete-code" linkKey="athlete-link" onCopyCode={() => handleCopy("athlete-code", athleteCode)} onCopyLink={() => handleCopy("athlete-link", athleteLink)} />
          </div>
        </Section>

        <Section title="Calendar Sync" icon="📅">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: syncDot, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.50)" }}>{syncLabel}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>Auto-sync (every 15 min)</span>
            <Toggle value={calendarActive} onChange={setCalendarActive} />
          </div>
          <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" as const }}>ICS Calendar URL</label>
          <input type="url" value={calendarUrl} onChange={(e: any) => setCalendarUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/..." style={{ ...inputStyle, fontFamily: "'Space Mono', monospace", marginBottom: 8 }} />
          <button type="button" onClick={() => setShowInstructions(v => !v)} style={{ background: "transparent", border: "none", color: "rgba(0,212,255,0.65)", fontSize: 12, cursor: "pointer", padding: "4px 0", fontFamily: "'DM Sans', system-ui", marginBottom: showInstructions ? 10 : 4 }}>
            {showInstructions ? "▲" : "▼"} How to get the Google Calendar link
          </button>
          {showInstructions && (
            <div style={{ background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.15)", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, marginBottom: 12 }}>
              <strong style={{ color: "rgba(255,255,255,0.80)" }}>Google Calendar:</strong>
              <ol style={{ margin: "6px 0 0 0", paddingLeft: 18 }}>
                <li>Open Google Calendar → Settings (gear icon)</li>
                <li>Click on your calendar under "Settings for my calendars"</li>
                <li>Scroll to "Integrate calendar"</li>
                <li>Copy the <strong>Public URL to this calendar</strong> (ending in <code>.ics</code>)</li>
                <li>The calendar must be set to <strong>Public</strong> for sync to work</li>
              </ol>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const }}>
            <ActionBtn primary onClick={handleSaveCalendar} disabled={saving}>{saving ? "Saving…" : "Save"}</ActionBtn>
            <ActionBtn onClick={handleSyncNow} disabled={syncing || !calendarUrl.trim()}>{syncing ? "Syncing…" : "Sync Now"}</ActionBtn>
          </div>
          {saveMsg && <p style={{ margin: "8px 0 0 0", fontSize: 12, color: saveMsg.startsWith("Error") ? "#FCA5A5" : "#00FF9D" }}>{saveMsg}</p>}
          {syncMsg && <p style={{ margin: "8px 0 0 0", fontSize: 12, color: syncMsg.startsWith("Error") ? "#FCA5A5" : "#00FF9D" }}>{syncMsg}</p>}
        </Section>

        <Section title="Active DAR Metrics" icon="📊">
          <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
            Select which metrics athletes fill in after each session. Minimum 3 required.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 10, marginBottom: 16 }}>
            {DAR_QUESTIONS.map(q => {
              const active = activeDARMetrics.includes(q.key);
              return (
                <button key={q.key} type="button"
                  onClick={() => {
                    if (active && activeDARMetrics.length <= 3) return;
                    setActiveDARMetrics(prev => active ? prev.filter(k => k !== q.key) : [...prev, q.key]);
                  }}
                  style={{ padding: "7px 16px", borderRadius: 20, border: active ? "1px solid #00D4FF" : "1px solid rgba(255,255,255,0.15)", background: active ? "rgba(0,212,255,0.12)" : "transparent", color: active ? "#00D4FF" : "rgba(255,255,255,0.40)", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', system-ui", fontWeight: active ? 600 : 400, transition: "all 0.2s", display: "flex", alignItems: "center", gap: 5 }}>
                  <span>{q.icon}</span>{q.label}
                </button>
              );
            })}
          </div>
          <ActionBtn primary onClick={handleSaveDARMetrics}>Save Metrics</ActionBtn>
        </Section>

        <Section title="Danger Zone" icon="⚠️">
          <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
            Archiving a team hides it from all dashboards. This action can be reversed by an admin.
          </p>
          <button type="button" onClick={() => alert("Archive team — coming soon.")} style={{ padding: "10px 24px", borderRadius: 10, border: "1px solid rgba(255,77,77,0.35)", background: "rgba(255,77,77,0.08)", color: "#FF4D4D", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', system-ui" }}>
            Archive Team
          </button>
        </Section>
      </div>
    );
  }

  function renderQuestionnaire() {
    return (
      <div>
        <Section title="DAR Questionnaire" icon="📋">
          <p style={{ margin: "0 0 20px 0", fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
            Athletes complete these questions after each session. Responses drive the Daily Athlete Response (DAR) algorithm.
            <br /><span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>Enable/disable metrics via Settings → Active DAR Metrics.</span>
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {DAR_QUESTIONS.map((q, i) => {
              const active = activeDARMetrics.includes(q.key);
              return (
                <div key={q.key} style={{ background: active ? "rgba(0,212,255,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${active ? "rgba(0,212,255,0.18)" : "rgba(255,255,255,0.06)"}`, borderRadius: 12, padding: "16px 18px", opacity: active ? 1 : 0.45, transition: "opacity 0.2s" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 16 }}>{q.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{i + 1}. {q.label}</span>
                        {!active && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: 1, textTransform: "uppercase" as const }}>INACTIVE</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", marginBottom: 12 }}>{q.description}</div>
                      <SliderPreview />
                    </div>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: active ? "#00D4FF" : "rgba(255,255,255,0.20)", marginTop: 4, flexShrink: 0 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="Readiness Formula" icon="🧮">
          <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
            DAR zones are determined by deviation from the 28-day exponential moving average:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <FormulaRow dot="#00FF9D" label="GREEN zone" desc="Response within ±15% of 28d EMA — normal training load" />
            <FormulaRow dot="#00D4FF" label="BLUE zone" desc="Response >15% below EMA — underloaded or recovered" />
            <FormulaRow dot="#FFB800" label="YELLOW zone" desc="Response >15% above EMA — overloaded or fatigued" />
          </div>
        </Section>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", overflowY: "auto", background: "radial-gradient(ellipse at top, #0D1F3C 0%, #0A0F1E 60%)", color: "#FFFFFF", fontFamily: "'DM Sans', system-ui, sans-serif", padding: isDesktop ? "32px 48px 80px 48px" : "20px 16px 80px 16px" }}>
      <div style={{ maxWidth: isDesktop ? 960 : "100%", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <button type="button" onClick={() => navigation.goBack()} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, color: "rgba(255,255,255,0.55)", padding: "8px 14px", cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', system-ui" }}>
            ← Back
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: isDesktop ? 22 : 18, fontWeight: 700, color: "#fff" }}>{teamName}</h1>
            {(team?.sport || team?.division) && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", marginTop: 2 }}>
                {[team.sport, team.division].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 0, marginBottom: 24, overflowX: "auto", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          {TABS.map(tab => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} style={{ background: "transparent", border: "none", borderBottom: activeTab === tab ? "2px solid #00D4FF" : "2px solid transparent", color: activeTab === tab ? "#00D4FF" : "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: activeTab === tab ? 600 : 400, padding: "10px 16px", cursor: "pointer", whiteSpace: "nowrap" as const, transition: "color 0.2s", fontFamily: "'DM Sans', system-ui" }}>
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === "Overview" && renderOverview()}
        {activeTab === "Members" && renderMembers()}
        {activeTab === "Calendar" && renderCalendar()}
        {activeTab === "Settings" && renderSettings()}
        {activeTab === "Questionnaire" && renderQuestionnaire()}

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#0D1526", border: "1px solid rgba(0,212,255,0.14)", borderRadius: 16, padding: "20px", marginBottom: 20 }}>
      <h2 style={{ margin: "0 0 16px 0", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.80)", letterSpacing: 1.5, textTransform: "uppercase" as const, display: "flex", alignItems: "center", gap: 8 }}>
        <span>{icon}</span>{title}
      </h2>
      {children}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ background: "#0D1526", border: "1px solid rgba(0,212,255,0.10)", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "'Space Mono', monospace" }}>{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#fff", fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} style={{ width: 44, height: 24, borderRadius: 12, border: "none", background: value ? "#00D4FF" : "rgba(255,255,255,0.15)", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 3, left: value ? 22 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
    </button>
  );
}

function ActionBtn({ children, onClick, disabled, primary }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ padding: "10px 24px", borderRadius: 10, border: primary ? "none" : "1px solid rgba(0,212,255,0.35)", background: primary ? "linear-gradient(135deg,#00BFFF,#0066FF)" : "transparent", color: primary ? "#fff" : "#00D4FF", fontWeight: 600, fontSize: 13, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, fontFamily: "'DM Sans', system-ui" }}>
      {children}
    </button>
  );
}

function MemberTable({ members, removingUid, onRemove }: { members: MemberDoc[]; removingUid: string | null; onRemove: (m: MemberDoc) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {members.map(m => (
        <div key={m.uid} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: m.role === "coach" ? "rgba(0,212,255,0.18)" : "rgba(0,255,157,0.12)", color: m.role === "coach" ? "#00D4FF" : "#00FF9D", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {(m.name || m.email || "?").slice(0, 2).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{m.name || "—"}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{m.email || m.uid}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{formatDate(m.joinedAt)}</span>
            <button type="button" onClick={() => onRemove(m)} disabled={removingUid === m.uid} style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(255,77,77,0.28)", background: "transparent", color: "rgba(255,77,77,0.65)", fontSize: 11, cursor: removingUid === m.uid ? "not-allowed" : "pointer", fontFamily: "'DM Sans', system-ui", opacity: removingUid === m.uid ? 0.5 : 1 }}>
              {removingUid === m.uid ? "…" : "Remove"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

interface CodeCardProps {
  label: string; color: string; code: string; link: string;
  copied: CopiedKey; codeKey: CopiedKey; linkKey: CopiedKey;
  onCopyCode: () => void; onCopyLink: () => void;
}

function CodeCard({ label, color, code, link, copied, codeKey, linkKey, onCopyCode, onCopyLink }: CodeCardProps) {
  return (
    <div style={{ background: "rgba(0,212,255,0.04)", border: `1px solid ${color}33`, borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", letterSpacing: 1.5, textTransform: "uppercase" as const, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color, letterSpacing: 4, marginBottom: 14 }}>{code}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
        <CopyBtn label={copied === codeKey ? "✓ Copied!" : "Copy Code"} onClick={onCopyCode} active={copied === codeKey} />
        {link && <CopyBtn label={copied === linkKey ? "✓ Copied!" : "Copy Link"} onClick={onCopyLink} active={copied === linkKey} />}
      </div>
    </div>
  );
}

function CopyBtn({ label, onClick, active }: { label: string; onClick: () => void; active: boolean }) {
  return (
    <button type="button" onClick={onClick} style={{ padding: "7px 14px", borderRadius: 8, border: active ? "1px solid #00FF9D" : "1px solid rgba(255,255,255,0.15)", background: active ? "rgba(0,255,157,0.10)" : "transparent", color: active ? "#00FF9D" : "rgba(255,255,255,0.60)", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', system-ui", fontWeight: 500 }}>
      {label}
    </button>
  );
}

function SliderPreview() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "'Space Mono', monospace" }}>1</span>
      <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.10)", borderRadius: 2, position: "relative" }}>
        <div style={{ width: "50%", height: "100%", background: "rgba(0,212,255,0.4)", borderRadius: 2 }} />
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 12, height: 12, borderRadius: "50%", background: "#00D4FF", boxShadow: "0 0 8px rgba(0,212,255,0.5)" }} />
      </div>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "'Space Mono', monospace" }}>10</span>
    </div>
  );
}

function FormulaRow({ dot, label, desc }: { dot: string; label: string; desc: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)" }}>
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: dot, flexShrink: 0, marginTop: 2 }} />
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.40)" }}>{desc}</div>
      </div>
    </div>
  );
}

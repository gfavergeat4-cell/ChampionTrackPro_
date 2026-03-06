import React, { useEffect, useState } from "react";
import { Platform, ActivityIndicator, View, Text, ScrollView, Pressable } from "react-native";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useIsDesktop } from "../hooks/useIsDesktop";

const BG = "#0A0F1E";
const CYAN = "#00E0FF";
const CARD_BG = "#0D1526";
const BORDER = "rgba(0,224,255,0.15)";
const ORANGE = "#FF8C42";

interface Training {
  id: string;
  title: string;
  startUtc: number;
  endUtc: number;
}

interface Member {
  uid: string;
  name: string;
}

interface MemberStatus {
  uid: string;
  name: string;
  status: "completed" | "pending" | "pain";
}

interface TrainingWithStats extends Training {
  total: number;
  completed: number;
  memberStatuses: MemberStatus[];
}

type FilterMode = "week" | "month";

function formatCardDate(startMs: number, endMs: number): { date: string; time: string } {
  const start = new Date(startMs);
  const end = new Date(endMs);
  const date = start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const startTime = start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const endTime = end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return { date, time: `${startTime} - ${endTime}` };
}

export default function CoachScheduleScreen() {
  const isDesktop = useIsDesktop();

  const [teamId, setTeamId] = useState<string | null>(null);
  const [trainings, setTrainings] = useState<TrainingWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("week");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const user = auth.currentUser;
        if (!user) throw new Error("Not authenticated");

        const userSnap = await getDoc(doc(db, "users", user.uid));
        const userData = (userSnap.data() as any) || {};
        const tid: string | null = userData.teamId || null;
        if (!tid) throw new Error("No team linked to your account.");
        if (!cancelled) setTeamId(tid);

        // Load members
        const membersSnap = await getDocs(collection(db, "teams", tid, "members"));
        const memberList: Member[] = [];
        await Promise.all(
          membersSnap.docs.map(async (d) => {
            const mData = d.data() as any;
            let name = mData.fullName || mData.displayName || mData.name || d.id;
            try {
              const uSnap = await getDoc(doc(db, "users", d.id));
              if (uSnap.exists()) {
                const uData = uSnap.data() as any;
                if (uData.fullName) name = uData.fullName;
              }
            } catch { /* ignore */ }
            memberList.push({ uid: d.id, name });
          })
        );

        // Load trainings ordered by startUtc desc
        const trainingsSnap = await getDocs(
          query(collection(db, "teams", tid, "trainings"), orderBy("startUtc", "desc"))
        );

        const result: TrainingWithStats[] = [];

        await Promise.all(
          trainingsSnap.docs.map(async (tDoc) => {
            const tData = tDoc.data() as any;
            const startUtc: number =
              tData.startUtc instanceof Object && typeof tData.startUtc.toMillis === "function"
                ? tData.startUtc.toMillis()
                : typeof tData.startUtc === "number"
                ? tData.startUtc
                : 0;
            const endUtc: number =
              tData.endUtc instanceof Object && typeof tData.endUtc.toMillis === "function"
                ? tData.endUtc.toMillis()
                : typeof tData.endUtc === "number"
                ? tData.endUtc
                : startUtc;

            // Load responses
            const responsesSnap = await getDocs(
              collection(db, "teams", tid, "trainings", tDoc.id, "responses")
            );
            const responseMap: Record<string, any> = {};
            responsesSnap.docs.forEach((r) => {
              responseMap[r.id] = r.data();
            });

            const memberStatuses: MemberStatus[] = memberList.map((m) => {
              const resp = responseMap[m.uid];
              if (!resp) return { uid: m.uid, name: m.name, status: "pending" as const };
              if (resp.physicalPain === true) return { uid: m.uid, name: m.name, status: "pain" as const };
              return { uid: m.uid, name: m.name, status: "completed" as const };
            });

            const completed = memberStatuses.filter((s) => s.status === "completed" || s.status === "pain").length;

            result.push({
              id: tDoc.id,
              title: tData.title || tData.name || "Training",
              startUtc,
              endUtc,
              total: memberList.length,
              completed,
              memberStatuses,
            });
          })
        );

        // Sort desc
        result.sort((a, b) => b.startUtc - a.startUtc);

        if (!cancelled) {
          setTrainings(result);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || "Error loading schedule");
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const filteredTrainings = trainings.filter((t) => {
    const now = Date.now();
    if (filter === "week") {
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      return Math.abs(now - t.startUtc) <= weekMs;
    }
    const monthMs = 30 * 24 * 60 * 60 * 1000;
    return Math.abs(now - t.startUtc) <= monthMs;
  });

  if (Platform.OS !== "web") {
    return (
      <View style={{ flex: 1, backgroundColor: BG, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#fff" }}>Schedule is available on web.</Text>
      </View>
    );
  }

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    backgroundColor: BG,
    padding: isDesktop ? "40px 60px" : "20px 16px",
    fontFamily: "'Inter', sans-serif",
    color: "#fff",
  };

  const filterTabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 20px",
    borderRadius: 20,
    border: `1px solid ${active ? CYAN : "rgba(255,255,255,0.15)"}`,
    backgroundColor: active ? "rgba(0,224,255,0.12)" : "transparent",
    color: active ? CYAN : "rgba(255,255,255,0.5)",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: active ? 600 : 400,
    transition: "all 0.2s",
  });

  const cardStyle: React.CSSProperties = {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    border: `1px solid ${BORDER}`,
    marginBottom: 16,
    overflow: "hidden",
  };

  if (loading) {
    return (
      <div style={{ ...containerStyle, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 40, height: 40, border: `3px solid ${CYAN}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Loading schedule...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={{ backgroundColor: "rgba(255,60,60,0.1)", border: "1px solid rgba(255,60,60,0.3)", borderRadius: 12, padding: "16px 20px", color: "#FF6B6B" }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: isDesktop ? 28 : 22, fontWeight: 700, color: "#fff" }}>
          Training Schedule
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: "rgba(255,255,255,0.4)" }}>
          Track completion rates for each session
        </p>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        {(["week", "month"] as FilterMode[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={filterTabStyle(filter === f)}
          >
            {f === "week" ? "This Week" : "This Month"}
          </button>
        ))}
      </div>

      {/* Trainings list */}
      {filteredTrainings.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(255,255,255,0.3)", fontSize: 15 }}>
          No trainings found for this period.
        </div>
      ) : (
        <div style={{ maxWidth: isDesktop ? 860 : "100%" }}>
          {filteredTrainings.map((t) => {
            const { date, time } = formatCardDate(t.startUtc, t.endUtc);
            const pct = t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0;
            const isGood = pct >= 50;
            const expanded = expandedId === t.id;

            return (
              <div key={t.id} style={cardStyle}>
                {/* Card header — clickable */}
                <div
                  onClick={() => setExpandedId(expanded ? null : t.id)}
                  style={{ padding: "18px 20px", cursor: "pointer", display: "flex", flexDirection: isDesktop ? "row" : "column", gap: isDesktop ? 0 : 12, alignItems: isDesktop ? "center" : "flex-start", justifyContent: "space-between" }}
                >
                  {/* Left: date + title */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: CYAN, fontWeight: 600 }}>{date}</span>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{time}</span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>{t.title}</div>
                  </div>

                  {/* Right: badge + chevron */}
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{
                      padding: "5px 14px",
                      borderRadius: 20,
                      fontSize: 13,
                      fontWeight: 600,
                      backgroundColor: isGood ? "rgba(0,224,255,0.12)" : "rgba(255,140,66,0.12)",
                      color: isGood ? CYAN : ORANGE,
                      border: `1px solid ${isGood ? "rgba(0,224,255,0.3)" : "rgba(255,140,66,0.3)"}`,
                    }}>
                      {t.completed}/{t.total} completed
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{expanded ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ height: 3, backgroundColor: "rgba(255,255,255,0.06)", margin: "0 20px 16px" }}>
                  <div style={{
                    height: "100%",
                    width: `${pct}%`,
                    backgroundColor: isGood ? CYAN : ORANGE,
                    borderRadius: 2,
                    transition: "width 0.4s ease",
                  }} />
                </div>

                {/* Expanded: member list */}
                {expanded && (
                  <div style={{ borderTop: `1px solid ${BORDER}`, padding: "16px 20px" }}>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Team Members
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {t.memberStatuses.map((ms) => {
                        const isPain = ms.status === "pain";
                        const isCompleted = ms.status === "completed";
                        const isPending = ms.status === "pending";

                        const statusColor = isPain ? "#FF4D4D" : isCompleted ? "#4ADE80" : ORANGE;
                        const statusLabel = isPain ? "Pain reported" : isCompleted ? "Completed" : "Pending";
                        const statusIcon = isPain ? "🔴" : isCompleted ? "✅" : "⏳";

                        return (
                          <div
                            key={ms.uid}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "10px 14px",
                              backgroundColor: "rgba(255,255,255,0.03)",
                              borderRadius: 8,
                              border: "1px solid rgba(255,255,255,0.06)",
                            }}
                          >
                            <span style={{ fontSize: 14, color: "#fff" }}>{ms.name}</span>
                            <span style={{ fontSize: 13, color: statusColor, display: "flex", alignItems: "center", gap: 6 }}>
                              {statusIcon} {statusLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { Platform, ActivityIndicator, View, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useIsDesktop } from "../hooks/useIsDesktop";
import ChampionTrackProLogo from "../components/ChampionTrackProLogo";
import { SliderDivider } from "../components/SliderDivider";
import { theme } from "../constants/theme";

interface AlertEntry {
  uid: string;
  name: string;
  type: "no_response" | "pain";
}

export default function CoachHomeScreen() {
  const navigation = useNavigation<any>();
  const isDesktop = useIsDesktop();

  const [coachName, setCoachName] = useState<string>("");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string>("");
  const [athleteCount, setAthleteCount] = useState<number>(0);
  const [weekTrainings, setWeekTrainings] = useState<number>(0);
  const [responseRate, setResponseRate] = useState<number | null>(null);
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const user = auth.currentUser;
        if (!user) throw new Error("Not authenticated");

        // 1. Fetch coach user doc
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const userData = (userSnap.data() as any) || {};
        setCoachName(userData.fullName || userData.displayName || user.email || "Coach");
        const tid: string | null = userData.teamId || null;

        if (!tid) {
          if (!cancelled) { setError("No team linked to your account."); setLoading(false); }
          return;
        }
        if (!cancelled) setTeamId(tid);

        // 2. Fetch team doc
        const teamSnap = await getDoc(doc(db, "teams", tid));
        if (!teamSnap.exists()) throw new Error("Team not found.");
        const teamData = teamSnap.data() as any;
        if (!cancelled) setTeamName(teamData.name || tid);

        // 3. Athlete count
        let memberCount = 0;
        try {
          const countSnap = await getCountFromServer(collection(db, "teams", tid, "members"));
          memberCount = countSnap.data().count;
        } catch { /* ignore */ }
        if (!cancelled) setAthleteCount(memberCount);

        // 4. This week's training count
        const now = new Date();
        const dayOfWeek = now.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday start
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() + diff);
        weekStart.setHours(0, 0, 0, 0);
        const weekStartTs = Timestamp.fromDate(weekStart);

        let weekCount = 0;
        try {
          const weekSnap = await getDocs(
            query(
              collection(db, "teams", tid, "trainings"),
              where("startUtc", ">=", weekStartTs)
            )
          );
          weekCount = weekSnap.size;
        } catch { /* ignore */ }
        if (!cancelled) setWeekTrainings(weekCount);

        // 5. Response rate + alerts from last training
        try {
          const lastTrainingSnap = await getDocs(
            query(
              collection(db, "teams", tid, "trainings"),
              orderBy("startUtc", "desc"),
              limit(1)
            )
          );

          if (!lastTrainingSnap.empty && memberCount > 0) {
            const lastTrainingId = lastTrainingSnap.docs[0].id;

            // Fetch all members to build uid→name map
            const membersSnap = await getDocs(collection(db, "teams", tid, "members"));
            const memberMap: Record<string, string> = {};
            membersSnap.docs.forEach((d) => {
              const data = d.data() as any;
              memberMap[d.id] = data.displayName || data.name || data.fullName || d.id;
            });

            // Fetch responses for last training
            const responsesSnap = await getDocs(
              collection(db, "teams", tid, "trainings", lastTrainingId, "responses")
            );

            const respondedUids = new Set<string>();
            const painUids: string[] = [];

            responsesSnap.docs.forEach((d) => {
              const data = d.data() as any;
              respondedUids.add(d.id);
              // Pain: impactMusculaire >= 70 or fatigue >= 80 or douleur flag
              const hasPain =
                (typeof data.impactMusculaire === "number" && data.impactMusculaire >= 70) ||
                (typeof data.fatigue === "number" && data.fatigue >= 80) ||
                (data.values && (
                  (typeof data.values.douleur === "number" && data.values.douleur > 5) ||
                  (typeof data.values.impactMusculaire === "number" && data.values.impactMusculaire >= 70)
                ));
              if (hasPain) painUids.push(d.id);
            });

            const rate = Math.round((respondedUids.size / memberCount) * 100);
            if (!cancelled) setResponseRate(rate);

            // Build alerts list
            const alertList: AlertEntry[] = [];
            // No response alerts
            Object.keys(memberMap).forEach((uid) => {
              if (!respondedUids.has(uid)) {
                alertList.push({ uid, name: memberMap[uid], type: "no_response" });
              }
            });
            // Pain alerts
            painUids.forEach((uid) => {
              alertList.push({ uid, name: memberMap[uid] || uid, type: "pain" });
            });
            if (!cancelled) setAlerts(alertList);
          } else {
            if (!cancelled) setResponseRate(0);
          }
        } catch (e) {
          console.warn("[CoachHome] alerts/rate error", e);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  if (Platform.OS !== "web") {
    return (
      <View style={{ flex: 1, backgroundColor: "#0A0F1E", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#fff" }}>Coach home is optimized for web.</Text>
      </View>
    );
  }

  const maxWidth = isDesktop ? 960 : 480;

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at top, #0D1F3C 0%, #0A0F1E 60%)",
      backgroundColor: "#0A0F1E",
      color: "#FFFFFF",
      fontFamily: "system-ui, -apple-system, 'Inter', sans-serif",
      padding: isDesktop ? "32px 48px 80px" : "24px 16px 80px",
      overflowY: "auto",
    }}>
      <div style={{ maxWidth, margin: "0 auto" }}>

        {/* Logo */}
        <div style={{ paddingTop: 24, paddingBottom: 28, textAlign: "center", background: "none", border: "none" }}>
          <ChampionTrackProLogo />
        </div>

        {loading ? (
          <div style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <ActivityIndicator color="#00D4FF" />
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Loading your team...</span>
          </div>
        ) : error ? (
          <div style={{ color: "#FCA5A5", fontSize: 14, textAlign: "center", padding: 40 }}>{error}</div>
        ) : (
          <>
            {/* Welcome header */}
            <div style={{ marginBottom: 32 }}>
              <h1 style={{ fontSize: isDesktop ? 28 : 22, fontWeight: 700, color: "#FFFFFF", margin: "0 0 4px", fontFamily: theme.fonts.serif }}>
                Welcome back, {coachName}
              </h1>
              <p style={{ margin: 0, fontSize: 15, color: "#00D4FF", fontWeight: 500 }}>{teamName}</p>
            </div>

            <SliderDivider />

            {/* Stat cards */}
            <div style={{
              display: "grid",
              gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "repeat(3, 1fr)",
              gap: 12,
              marginBottom: 32,
            }}>
              {[
                { label: "Athletes", value: athleteCount, color: "#00D4FF" },
                { label: "This Week", value: weekTrainings, color: "#A855F7" },
                { label: "Response Rate", value: responseRate !== null ? `${responseRate}%` : "—", color: "#00FF88" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  background: theme.colors.bgCard,
                  border: "1px solid rgba(0,212,255,0.15)",
                  borderTop: "2px solid rgba(0,212,255,0.4)",
                  borderRadius: theme.borderRadius.card,
                  padding: isDesktop ? "20px 24px" : "16px 12px",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: isDesktop ? 32 : 26, fontWeight: 800, color, lineHeight: 1.1 }}>
                    {value}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>

            {/* Alerts */}
            <div style={{
              background: theme.colors.bgCard,
              border: "1px solid rgba(0,212,255,0.15)",
              borderTop: "2px solid rgba(0,212,255,0.4)",
              borderRadius: theme.borderRadius.card,
              padding: isDesktop ? "20px 24px" : "16px",
              marginBottom: 28,
            }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "#FFFFFF", margin: "0 0 16px", letterSpacing: "0.04em" }}>
                ALERTS
              </h2>

              {alerts.length === 0 ? (
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", padding: "12px 0" }}>
                  All athletes are up to date ✓
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {alerts.map((a) => {
                    const isPain = a.type === "pain";
                    return (
                      <div key={`${a.uid}-${a.type}`} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: isPain ? "rgba(251,113,0,0.08)" : "rgba(239,68,68,0.08)",
                        border: `1px solid ${isPain ? "rgba(251,113,0,0.25)" : "rgba(239,68,68,0.25)"}`,
                      }}>
                        <div style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: isPain ? "#FB7100" : "#EF4444",
                          flexShrink: 0,
                        }} />
                        <span style={{ fontSize: 14, color: "#FFFFFF", flex: 1 }}>{a.name}</span>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: isPain ? "#FB7100" : "#EF4444",
                          padding: "2px 8px",
                          borderRadius: 20,
                          background: isPain ? "rgba(251,113,0,0.15)" : "rgba(239,68,68,0.15)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}>
                          {isPain ? "Pain reported" : "No response"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* CTA Button */}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => navigation.navigate("Analytics", { teamId, teamName, role: "coach" })}
                style={{
                  padding: "16px 48px",
                  borderRadius: theme.borderRadius.button,
                  background: theme.gradients.buttonPrimary,
                  border: "none",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: 15,
                  letterSpacing: 1,
                  cursor: "pointer",
                  boxShadow: theme.shadows.buttonPrimary,
                  textTransform: "uppercase",
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
              >
                View Performance Dashboard
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

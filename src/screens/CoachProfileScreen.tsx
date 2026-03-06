import React, { useEffect, useState } from "react";
import { Platform, View, Text, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { CommonActions } from "@react-navigation/native";

export default function CoachProfileScreen() {
  const navigation = useNavigation<any>();
  const isDesktop = useIsDesktop();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [teamName, setTeamName] = useState("");
  const [coachCode, setCoachCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        setEmail(user.email || "");

        const userSnap = await getDoc(doc(db, "users", user.uid));
        const userData = (userSnap.data() as any) || {};
        if (!cancelled) setFullName(userData.fullName || userData.displayName || "");

        const tid: string | null = userData.teamId || null;
        if (tid) {
          const teamSnap = await getDoc(doc(db, "teams", tid));
          if (teamSnap.exists()) {
            const teamData = teamSnap.data() as any;
            if (!cancelled) setTeamName(teamData.name || tid);
            if (!cancelled) setCoachCode(teamData.coachCode || "");
          }
        }
      } catch (e) {
        console.error("[CoachProfile] load error", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Auth" }] }));
    } catch (e) {
      console.error("[CoachProfile] logout error", e);
    }
  };

  const handleCopyCode = () => {
    if (!coachCode) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(coachCode).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  if (Platform.OS !== "web") {
    return (
      <View style={{ flex: 1, backgroundColor: "#0A0F1E", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#fff" }}>Profile is optimized for web.</Text>
      </View>
    );
  }

  const maxWidth = isDesktop ? 640 : 480;

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at top, #0D1F3C 0%, #0A0F1E 60%)",
      backgroundColor: "#0A0F1E",
      color: "#FFFFFF",
      fontFamily: "system-ui, -apple-system, 'Inter', sans-serif",
      padding: isDesktop ? "40px 48px 80px" : "24px 16px 80px",
      overflowY: "auto",
    }}>
      <div style={{ maxWidth, margin: "0 auto" }}>

        {/* Header */}
        <h1 style={{ fontSize: isDesktop ? 28 : 22, fontWeight: 700, color: "#FFFFFF", margin: "0 0 32px" }}>
          Profile
        </h1>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 40 }}>
            <ActivityIndicator color="#00D4FF" />
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Loading...</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Avatar + name */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              background: "#0D1526",
              border: "1px solid rgba(0,212,255,0.15)",
              borderRadius: 16,
              padding: "20px 24px",
            }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #00D4FF33, #4A67FF44)",
                border: "1px solid rgba(0,212,255,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                fontWeight: 700,
                color: "#00D4FF",
                flexShrink: 0,
              }}>
                {(fullName || email || "C").slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#FFFFFF" }}>
                  {fullName || "Coach"}
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{email}</div>
              </div>
            </div>

            {/* Team info */}
            <div style={{
              background: "#0D1526",
              border: "1px solid rgba(0,212,255,0.15)",
              borderRadius: 16,
              padding: "20px 24px",
            }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                Team
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#00D4FF" }}>
                {teamName || "—"}
              </div>
            </div>

            {/* Coach code */}
            {coachCode ? (
              <div style={{
                background: "#0D1526",
                border: "1px solid rgba(0,212,255,0.15)",
                borderRadius: 16,
                padding: "20px 24px",
              }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                  Coach Code
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "#FFFFFF",
                    letterSpacing: "0.15em",
                    flex: 1,
                  }}>
                    {coachCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,212,255,0.35)",
                      background: copied ? "rgba(0,255,136,0.15)" : "rgba(0,212,255,0.1)",
                      color: copied ? "#00FF88" : "#00D4FF",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {copied ? "Copied ✓" : "Copy"}
                  </button>
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 8 }}>
                  Share this code with coaches to join your team
                </div>
              </div>
            ) : null}

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: 12,
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#EF4444",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.2s",
                marginTop: 8,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.18)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.1)"; }}
            >
              Log Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

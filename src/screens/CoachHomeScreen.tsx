import React, { useEffect, useState } from "react";
import { Platform, ActivityIndicator, View, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { collection, getDocs, getCountFromServer, doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useIsDesktop } from "../hooks/useIsDesktop";
import ChampionTrackProLogo from "../components/ChampionTrackProLogo";

interface TeamDoc {
  id: string;
  name?: string;
  logoUrl?: string;
  memberCount?: number;
}

export default function CoachHomeScreen() {
  const navigation = useNavigation();
  const isDesktop = useIsDesktop();

  const [team, setTeam] = useState<TeamDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const user = auth.currentUser;
        if (!user) {
          if (!cancelled) setError("Utilisateur non connecté");
          return;
        }

        let teamId: string | null = null;

        const userSnap = await getDoc(doc(db, "users", user.uid));
        const userData = (userSnap.data() as any) || {};
        teamId = userData.teamId || null;

        if (!teamId) {
          const teamsSnap = await getDocs(collection(db, "teams"));
          for (const d of teamsSnap.docs) {
            const data = d.data() as any;
            const coaches = data.coaches;
            if (Array.isArray(coaches) && coaches.includes(user.uid)) {
              teamId = d.id;
              break;
            }
            if (data.coachId === user.uid || data.coach === user.uid) {
              teamId = d.id;
              break;
            }
          }
        }

        if (cancelled) return;
        if (!teamId) {
          setTeam(null);
          setError("Aucune équipe associée à votre compte.");
          setLoading(false);
          return;
        }

        const teamSnap = await getDoc(doc(db, "teams", teamId));
        if (cancelled) return;
        if (!teamSnap.exists()) {
          setTeam(null);
          setError("Équipe introuvable.");
          setLoading(false);
          return;
        }

        const data = teamSnap.data() as any;
        let memberCount = 0;
        try {
          const countSnap = await getCountFromServer(collection(db, "teams", teamId, "members"));
          memberCount = countSnap.data().count;
        } catch {
          // ignore
        }

        setTeam({
          id: teamId,
          name: data.name,
          logoUrl: data.logoUrl,
          memberCount,
        });
        setError(null);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpenPerformance = () => {
    if (!team) return;
    navigation.navigate("Analytics" as never, {
      teamId: team.id,
      teamName: team.name || team.id,
      role: "coach",
    } as never);
  };

  if (Platform.OS !== "web") {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0A0F1E",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
        }}
      >
        <Text style={{ color: "white", fontSize: 16, textAlign: "center" }}>
          Coach home is optimized for web.
        </Text>
      </View>
    );
  }

  const contentWidth = isDesktop ? 960 : 420;

  return (
    <div
      style={{
        minHeight: "100vh",
        overflowY: "auto",
        paddingBottom: 80,
        background: "radial-gradient(ellipse at top, #0D1F3C 0%, #0A0F1E 60%)",
        backgroundColor: "#0A0F1E",
        color: "#FFFFFF",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
        padding: isDesktop ? "32px 48px 80px 48px" : "24px 16px 80px 16px",
      }}
    >
      <div style={{ maxWidth: contentWidth, margin: "0 auto" }}>
        {/* Logo — no background/border so transparent logo floats on screen */}
        <div style={{ paddingTop: 32, paddingBottom: 32, background: "none", backgroundColor: "transparent", border: "none" }}>
          <ChampionTrackProLogo />
        </div>

        {loading ? (
          <div
            style={{
              minHeight: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <ActivityIndicator color="#00E0FF" />
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
              Chargement de votre équipe...
            </span>
          </div>
        ) : error ? (
          <div
            style={{
              minHeight: 160,
              color: "#FCA5A5",
              fontSize: 14,
              textAlign: "center",
            }}
          >
            {error}
          </div>
        ) : team ? (
          <>
            <div
              style={{
                borderRadius: 16,
                border: "1px solid rgba(0,224,255,0.2)",
                background: "#0D1526",
                padding: 16,
                transition: "box-shadow 0.2s ease",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,224,255,0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: "rgba(0,224,255,0.15)",
                  color: "#00E0FF",
                  fontSize: 14,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {(team.name || team.id || "CT").trim().slice(0, 2).toUpperCase()}
              </div>
              <div
                style={{
                  marginTop: 12,
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#FFFFFF",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  width: "100%",
                }}
              >
                {team.name || team.id}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 13,
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                {team.memberCount ?? 0} membre{(team.memberCount ?? 0) !== 1 ? "s" : ""}
              </div>
              <div
                style={{
                  marginTop: 12,
                  padding: "4px 10px",
                  borderRadius: 20,
                  background: "rgba(0,224,255,0.1)",
                  color: "#00E0FF",
                  fontSize: 11,
                  letterSpacing: 2,
                  display: "inline-block",
                }}
              >
                OPERATIONAL
              </div>
            </div>

            <div
              style={{
                marginTop: 32,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <button
                type="button"
                onClick={handleOpenPerformance}
                style={{
                  padding: "16px 48px",
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #00BFFF, #0066FF)",
                  border: "none",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  boxShadow: "0 4px 20px rgba(0,200,255,0.4)",
                }}
              >
                Voir les performances
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

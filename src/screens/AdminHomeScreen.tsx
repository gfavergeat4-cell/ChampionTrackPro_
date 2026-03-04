import React, { useEffect, useState } from "react";
import { Platform, ActivityIndicator, View, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useIsDesktop } from "../hooks/useIsDesktop";

interface TeamDoc {
  id: string;
  name?: string;
  athleteCode?: string;
  coachCode?: string;
  coaches?: any[];
  members?: any[];
}

export default function AdminHomeScreen() {
  const navigation = useNavigation();
  const isDesktop = useIsDesktop();

  const [teams, setTeams] = useState<TeamDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const snap = await getDocs(collection(db, "teams"));
        if (cancelled) return;
        const items: TeamDoc[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name,
            athleteCode: data.athleteCode,
            coachCode: data.coachCode,
            coaches: data.coaches || [],
            members: data.members || [],
          };
        });
        setTeams(items);
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

  const handleOpenTeam = (team: TeamDoc) => {
    navigation.navigate("AdminPerformanceDashboard" as never, {
      role: "admin",
      teamId: team.id,
      teamName: team.name || team.id,
    } as never);
  };

  // Native fallback: simple message
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
          Admin home is optimized for web.
        </Text>
      </View>
    );
  }

  const containerPaddingX = isDesktop ? 48 : 16;

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0A0F1E",
        color: "#F9FAFB",
        padding: `24px ${containerPaddingX}px 40px`,
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: isDesktop ? 32 : 24,
                fontWeight: 700,
                margin: 0,
              }}
            >
              Admin • Teams Overview
            </h1>
            <p
              style={{
                marginTop: 4,
                fontSize: 14,
                color: "#9CA3AF",
              }}
            >
              Sélectionne une équipe pour explorer ses performances.
            </p>
          </div>
        </header>

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
            <span style={{ color: "#9CA3AF", fontSize: 14 }}>
              Chargement des équipes...
            </span>
          </div>
        ) : error ? (
          <div
            style={{
              minHeight: 160,
              color: "#FCA5A5",
              fontSize: 14,
            }}
          >
            {error}
          </div>
        ) : teams.length === 0 ? (
          <div
            style={{
              minHeight: 160,
              color: "#9CA3AF",
              fontSize: 14,
            }}
          >
            Aucune équipe trouvée.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isDesktop
                ? "repeat(3, minmax(0, 1fr))"
                : "repeat(1, minmax(0, 1fr))",
              gap: 20,
            }}
          >
            {teams.map((team) => {
              const coachesCount = Array.isArray(team.coaches)
                ? team.coaches.length
                : 0;
              const membersCount = Array.isArray(team.members)
                ? team.members.length
                : 0;

              return (
                <button
                  key={team.id}
                  onClick={() => handleOpenTeam(team)}
                  style={{
                    textAlign: "left",
                    borderRadius: 16,
                    padding: 20,
                    background:
                      "linear-gradient(145deg, #0E1528 0%, #020617 100%)",
                    border: "1px solid rgba(0,224,255,0.5)",
                    boxShadow:
                      "0 20px 40px rgba(15,23,42,0.9), 0 0 0 1px rgba(15,23,42,0.8)",
                    cursor: "pointer",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "radial-gradient(circle at 0% 0%, rgba(0,224,255,0.18) 0%, transparent 55%)",
                      opacity: 0.7,
                      pointerEvents: "none",
                    }}
                  />
                  <div style={{ position: "relative", zIndex: 1 }}>
                    <h2
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        margin: 0,
                        marginBottom: 6,
                        color: "#F9FAFB",
                      }}
                    >
                      {team.name || team.id}
                    </h2>
                    <p
                      style={{
                        fontSize: 12,
                        color: "#9CA3AF",
                        margin: 0,
                        marginBottom: 12,
                      }}
                    >
                      Team ID: {team.id}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        marginBottom: 12,
                      }}
                    >
                      <div
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          backgroundColor: "rgba(148, 163, 184, 0.1)",
                          color: "#E5E7EB",
                          fontSize: 12,
                        }}
                      >
                        {membersCount} membres
                      </div>
                      <div
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          backgroundColor: "rgba(56, 189, 248, 0.14)",
                          color: "#7DD3FC",
                          fontSize: 12,
                        }}
                      >
                        {coachesCount} coaches
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 12,
                        color: "#9CA3AF",
                      }}
                    >
                      <span>Voir les performances</span>
                      <span style={{ color: "#00E0FF" }}>→</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


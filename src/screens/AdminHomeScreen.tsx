import React, { useEffect, useState } from "react";
import { Platform, ActivityIndicator, View, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { collection, getDocs, getCountFromServer } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { useIsDesktop } from "../hooks/useIsDesktop";
import ChampionTrackProLogo from "../components/ChampionTrackProLogo";

interface TeamDoc {
  id: string;
  name?: string;
  logoUrl?: string;
  memberCount?: number;
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
        const items: TeamDoc[] = await Promise.all(
          snap.docs.map(async (d) => {
            const data = d.data() as any;
            let memberCount = 0;
            try {
              const countSnap = await getCountFromServer(collection(db, "teams", d.id, "members"));
              memberCount = countSnap.data().count;
            } catch {
              // ignore
            }
            return {
              id: d.id,
              name: data.name,
              logoUrl: data.logoUrl,
              memberCount,
            };
          })
        );
        if (cancelled) return;
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
    navigation.navigate("TeamDetails" as never, {
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

  const renderLoadingOrError = () => {
    if (loading) {
      return (
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
      );
    }

    if (error) {
      return (
        <div
          style={{
            minHeight: 160,
            color: "#FCA5A5",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      );
    }

    if (teams.length === 0) {
      return (
        <div
          style={{
            minHeight: 160,
            color: "#9CA3AF",
            fontSize: 14,
          }}
        >
          Aucune équipe trouvée.
        </div>
      );
    }

    return null;
  };

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
      <div
        style={{
          maxWidth: contentWidth,
          margin: "0 auto",
        }}
      >
        {/* Barre haut : bouton déconnexion à droite */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            paddingTop: 16,
            paddingBottom: 8,
          }}
        >
          <button
            type="button"
            onClick={() => signOut(auth)}
            style={{
              padding: "10px 20px",
              borderRadius: 12,
              border: "1px solid #00E0FF",
              background: "transparent",
              color: "#00E0FF",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Se déconnecter
          </button>
        </div>

        {/* Logo — no background/border so transparent logo floats on screen */}
        <div style={{ paddingTop: 32, paddingBottom: 32, background: "none", backgroundColor: "transparent", border: "none" }}>
          <ChampionTrackProLogo />
        </div>

        {/* Grille des équipes */}
        {renderLoadingOrError() || (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "1fr",
              gap: 16,
            }}
          >
            {teams.map((team) => {
              const initials = (team.name || team.id || "CT")
                .trim()
                .slice(0, 2)
                .toUpperCase();
              const memberCount = team.memberCount ?? 0;

              return (
                <button
                  key={team.id}
                  onClick={() => handleOpenTeam(team)}
                  type="button"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    textAlign: "left",
                    width: "100%",
                    padding: 16,
                    borderRadius: 16,
                    border: "1px solid rgba(0,224,255,0.2)",
                    background: "#0D1526",
                    cursor: "pointer",
                    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,224,255,0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {/* Badge initiales en haut à gauche */}
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
                    {initials}
                  </div>
                  {/* Nom équipe */}
                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 18,
                      fontWeight: 700,
                      color: "#ffffff",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      width: "100%",
                    }}
                  >
                    {team.name || team.id}
                  </div>
                  {/* Nombre de membres */}
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 13,
                      color: "rgba(255,255,255,0.6)",
                    }}
                  >
                    {memberCount} membre{memberCount !== 1 ? "s" : ""}
                  </div>
                  {/* Badge OPERATIONAL */}
                  <div
                    style={{
                      marginTop: 12,
                      padding: "4px 10px",
                      borderRadius: 20,
                      background: "rgba(0,224,255,0.1)",
                      color: "#00E0FF",
                      fontSize: 11,
                      letterSpacing: 2,
                    }}
                  >
                    OPERATIONAL
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Bouton Create Team */}
        {!loading && !error && (
          <div
            style={{
              marginTop: 32,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <button
              onClick={() => alert("Fonctionnalité à venir")}
              type="button"
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
              + CREATE TEAM
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


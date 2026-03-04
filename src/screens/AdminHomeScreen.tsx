import React, { useEffect, useState } from "react";
import { Platform, ActivityIndicator, View, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useIsDesktop } from "../hooks/useIsDesktop";

interface TeamDoc {
  id: string;
  name?: string;
  logoUrl?: string;
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
            logoUrl: data.logoUrl,
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
    navigation.navigate("TeamDetails" as never, {
      teamId: team.id,
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
        backgroundColor: "#0A0F1E",
        color: "#F9FAFB",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
        padding: isDesktop ? "32px 48px 40px" : "24px 16px 32px",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          maxWidth: contentWidth,
          margin: "0 auto",
        }}
      >
        {/* Logo en haut */}
        <header
          style={{
            marginBottom: 32,
            textAlign: "center",
            paddingTop: 32,
            paddingBottom: 32,
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <img
              src="/logo/logo.jpeg"
              alt="ChampionTrackPro"
              style={{ maxWidth: 280, width: "100%", display: "block", margin: "0 auto" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
            <img
              src="/icons/icon-192.png"
              alt=""
              style={{ width: 48, height: 48, borderRadius: 0 }}
            />
          </div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "6px",
              textTransform: "uppercase",
              color: "#9CA3AF",
            }}
          >
            THE TRAINING INTELLIGENCE
          </div>

          {/* Fine ligne séparatrice */}
          <div
            style={{
              marginTop: 24,
              height: 1,
              width: "100%",
              backgroundColor: "rgba(0,224,255,0.2)",
            }}
          />
        </header>

        {/* Liste des équipes */}
        {renderLoadingOrError() || (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {teams.map((team) => {
              const logoUrl = team.logoUrl;
              const fallbackInitial = (team.name || team.id || "CT")
                .trim()
                .charAt(0)
                .toUpperCase();

              return (
                <button
                  key={team.id}
                  onClick={() => handleOpenTeam(team)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    width: "100%",
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid rgba(15,23,42,0.9)",
                    backgroundColor: "#0E1528",
                    cursor: "pointer",
                  }}
                >
                  {/* Logo équipe */}
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={team.name || team.id}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        objectFit: "cover",
                        border: "1px solid rgba(15,23,42,0.9)",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background:
                          "linear-gradient(135deg, #00E0FF, #3B82F6, #4C1D95)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#020617",
                        fontWeight: 700,
                        fontSize: 16,
                      }}
                    >
                      {fallbackInitial}
                    </div>
                  )}

                  {/* Infos équipe */}
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 17,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                      }}
                    >
                      {team.name || team.id}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "#9CA3AF",
                      }}
                    >
                      ID: {team.id}
                    </span>
                  </div>

                  {/* Chevron */}
                  <span
                    style={{
                      fontSize: 16,
                      color: "#6B7280",
                    }}
                  >
                    →
                  </span>
                </button>
              );
            })}

            {/* Bouton Create Team */}
            <div
              style={{
                marginTop: 24,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <button
                onClick={() => alert("Fonctionnalité à venir")}
                style={{
                  padding: "16px 48px",
                  borderRadius: 8,
                  backgroundColor: "#00E0FF",
                  border: "none",
                  color: "#020617",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  boxShadow: "0 14px 30px rgba(8,47,73,0.7)",
                }}
              >
                + CREATE TEAM
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


import React, { useEffect, useState } from "react";
import { Platform, ActivityIndicator, View, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
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

  const currentUser = auth?.currentUser;
  const adminName =
    currentUser?.displayName ||
    (currentUser?.email ? currentUser.email.split("@")[0] : "Gab");

  const managedTeamsCount = teams.length;

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

  const renderTeamsGridDesktop = () => {
    if (loading || error || teams.length === 0) {
      return renderLoadingOrError();
    }

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
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
                borderRadius: 18,
                padding: 20,
                background: "#0E1528",
                border: "1px solid rgba(15, 23, 42, 0.8)",
                boxShadow:
                  "0 20px 45px rgba(15,23,42,0.9), 0 0 0 1px rgba(15,23,42,0.9)",
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
                    "radial-gradient(circle at 0% 0%, rgba(0,224,255,0.28) 0%, transparent 55%)",
                  opacity: 0.5,
                  pointerEvents: "none",
                }}
              />
              <div style={{ position: "relative", zIndex: 1 }}>
                {/* Top meta row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                    fontSize: 11,
                    color: "#9CA3AF",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "999px",
                        backgroundColor: "#00E0FF",
                        boxShadow: "0 0 8px rgba(0,224,255,0.8)",
                      }}
                    />
                    <span style={{ letterSpacing: "0.12em" }}>
                      UNIT ID: {team.id}
                    </span>
                  </div>
                  <span style={{ opacity: 0.7 }}>RPE FEED ACTIVE</span>
                </div>

                {/* Team name */}
                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    margin: 0,
                    marginBottom: 4,
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
                  {team.athleteCode
                    ? `Athlete code: ${team.athleteCode}`
                    : "No public code assigned"}
                </p>

                {/* Status + counts */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: "1px solid rgba(34,197,94,0.5)",
                      backgroundColor: "rgba(22,163,74,0.15)",
                      fontSize: 11,
                      color: "#A7F3D0",
                      letterSpacing: "0.08em",
                    }}
                  >
                    STATUS: OPERATIONAL
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 11,
                      color: "#9CA3AF",
                    }}
                  >
                    <span>{membersCount} athletes</span>
                    <span>|</span>
                    <span>{coachesCount} coaches</span>
                  </div>
                </div>

                {/* CTA */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 12,
                    color: "#9CA3AF",
                  }}
                >
                  <span>Open performance feed</span>
                  <span style={{ color: "#00E0FF", fontWeight: 600 }}>→</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderDesktop = () => {
    const nonGridContent = renderLoadingOrError();

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "row",
          backgroundColor: "#050816",
          color: "#F9FAFB",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
        }}
      >
        {/* Sidebar */}
        <aside
          style={{
            width: 72,
            minHeight: "100vh",
            backgroundColor: "#070B14",
            borderRight: "1px solid rgba(15,23,42,0.9)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 0",
          }}
        >
          {/* Top icon */}
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background:
                "radial-gradient(circle at 30% 0%, rgba(0,224,255,0.7), transparent 60%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 18px rgba(0,224,255,0.7)",
            }}
          >
            <svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>

          {/* Nav icons */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 18,
              marginTop: 32,
            }}
          >
            {["Dashboard", "Teams", "Analytics", "Settings"].map((item, idx) => {
              const isActive = idx === 0;
              const baseCircleStyle: React.CSSProperties = {
                width: 40,
                height: 40,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                border: isActive
                  ? "1px solid rgba(0,224,255,0.8)"
                  : "1px solid transparent",
                backgroundColor: isActive
                  ? "rgba(15,118,220,0.18)"
                  : "rgba(15,23,42,0.95)",
              };

              return (
                <div key={item} style={baseCircleStyle}>
                  {/* simple glyphs */}
                  {idx === 0 && (
                    <svg
                      width={20}
                      height={20}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={isActive ? "#00E0FF" : "#64748B"}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 13h8V3H3zM13 21h8V11h-8zM13 3h8v6h-8zM3 21h8v-6H3z" />
                    </svg>
                  )}
                  {idx === 1 && (
                    <svg
                      width={20}
                      height={20}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#64748B"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                      <circle cx="10" cy="7" r="4" />
                      <path d="M21 21v-2a3 3 0 0 0-2-2.82" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  )}
                  {idx === 2 && (
                    <svg
                      width={20}
                      height={20}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#64748B"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 3v18h18" />
                      <path d="M7 14l4-4 3 3 4-5" />
                      <circle cx="7" cy="14" r="1" />
                      <circle cx="11" cy="10" r="1" />
                      <circle cx="14" cy="13" r="1" />
                      <circle cx="18" cy="8" r="1" />
                    </svg>
                  )}
                  {idx === 3 && (
                    <svg
                      width={20}
                      height={20}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#64748B"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15A1.65 1.65 0 0 0 21 13.35a1.65 1.65 0 0 0-.33-1l-1.45-2.11a1.65 1.65 0 0 0-.94-.64l-1.8-.36a1.65 1.65 0 0 0-1.51.45l-.8.8a4 4 0 0 0-1.9 0l-.8-.8a1.65 1.65 0 0 0-1.51-.45l-1.8.36a1.65 1.65 0 0 0-.94.64L3.33 12.3a1.65 1.65 0 0 0 0 2l1.45 2.11a1.65 1.65 0 0 0 .94.64l1.8.36a1.65 1.65 0 0 0 1.51-.45l.8-.8a4 4 0 0 0 1.9 0l.8.8a1.65 1.65 0 0 0 1.51.45l1.8-.36a1.65 1.65 0 0 0 .94-.64z" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>

          {/* Avatar bottom */}
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "999px",
              border: "1px solid rgba(148,163,184,0.6)",
              background:
                "radial-gradient(circle at 0% 0%, rgba(0,224,255,0.7), transparent 60%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 600,
              color: "#E5E7EB",
            }}
          >
            {adminName.charAt(0).toUpperCase()}
          </div>
        </aside>

        {/* Main content */}
        <main
          style={{
            flex: 1,
            minHeight: "100vh",
            backgroundColor: "#0A0F1E",
            padding: "24px 48px 40px",
          }}
        >
          <div style={{ maxWidth: 1280, margin: "0 auto" }}>
            {/* Header */}
            <header
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 32,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.18em",
                    color: "#6B7280",
                    marginBottom: 4,
                    textTransform: "uppercase",
                  }}
                >
                  CHAMPIONTRACKPRO
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: "#F9FAFB",
                  }}
                >
                  THE TRAINING INTELLIGENCE
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <div style={{ textAlign: "right", fontSize: 12 }}>
                  <div style={{ color: "#E5E7EB", fontWeight: 500 }}>
                    Admin Panel
                  </div>
                  <div
                    style={{
                      color: "#22C55E",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "999px",
                        backgroundColor: "#22C55E",
                        boxShadow: "0 0 8px rgba(34,197,94,0.8)",
                      }}
                    />
                    <span>Secure session active</span>
                  </div>
                </div>

                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "999px",
                    background:
                      "linear-gradient(135deg, #00E0FF, #4F46E5, #0EA5E9)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#0B1020",
                    boxShadow: "0 16px 35px rgba(15,23,42,0.8)",
                  }}
                >
                  {adminName.charAt(0).toUpperCase()}
                </div>
              </div>
            </header>

            {/* Welcome section */}
            <section style={{ marginBottom: 24 }}>
              <h2
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  margin: 0,
                  marginBottom: 6,
                }}
              >
                Welcome back,{" "}
                <span style={{ color: "#00E0FF" }}>{adminName}</span>
                <span style={{ fontSize: 16, color: "#6B7280" }}> (Admin)</span>
              </h2>
              <p
                style={{
                  margin: 0,
                  marginBottom: 2,
                  fontSize: 14,
                  color: "#9CA3AF",
                }}
              >
                {managedTeamsCount} managed teams reporting.
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>
                All questionnaire streams are being ingested into the analytics
                engine.
              </p>
            </section>

            {/* Managed units header */}
            <section style={{ marginBottom: 24 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.18em",
                    color: "#6B7280",
                  }}
                >
                  MANAGED UNITS
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                  Last updated: live feed
                </div>
              </div>
              <div
                style={{
                  height: 1,
                  width: "100%",
                  background:
                    "linear-gradient(90deg, rgba(15,23,42,0.2), rgba(148,163,184,0.6), rgba(15,23,42,0.2))",
                  marginBottom: 16,
                }}
              />

              {nonGridContent ? nonGridContent : renderTeamsGridDesktop()}
            </section>

            {/* Bottom cards */}
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
                gap: 20,
                marginTop: 24,
                marginBottom: 24,
              }}
            >
              {/* Create team */}
              <div
                style={{
                  borderRadius: 18,
                  padding: 20,
                  background:
                    "radial-gradient(circle at 0% 0%, rgba(0,224,255,0.15), transparent 60%), rgba(15,23,42,0.9)",
                  border: "1px solid rgba(0,224,255,0.5)",
                  boxShadow: "0 24px 55px rgba(15,23,42,0.9)",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    marginBottom: 4,
                    fontSize: 16,
                    fontWeight: 600,
                  }}
                >
                  Create new team
                </h3>
                <p
                  style={{
                    margin: 0,
                    marginBottom: 16,
                    fontSize: 13,
                    color: "#9CA3AF",
                  }}
                >
                  Onboard a new squad, configure membership, and connect their
                  training calendar.
                </p>
                <button
                  style={{
                    padding: "10px 18px",
                    borderRadius: 999,
                    border: "none",
                    background:
                      "linear-gradient(135deg, #00E0FF 0%, #3B82F6 100%)",
                    color: "#020617",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: "0 14px 30px rgba(8,47,73,0.9)",
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "999px",
                      backgroundColor: "#020617",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#00E0FF",
                      fontSize: 14,
                    }}
                  >
                    +
                  </span>
                  CREATE TEAM
                </button>
              </div>

              {/* Global system overview */}
              <div
                style={{
                  borderRadius: 18,
                  padding: 20,
                  backgroundColor: "#020617",
                  border: "1px solid rgba(30,64,175,0.8)",
                  boxShadow: "0 20px 50px rgba(15,23,42,1)",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    marginBottom: 4,
                    fontSize: 16,
                    fontWeight: 600,
                  }}
                >
                  Global system overview
                </h3>
                <p
                  style={{
                    margin: 0,
                    marginBottom: 16,
                    fontSize: 13,
                    color: "#9CA3AF",
                  }}
                >
                  Open the analytics cockpit for cross-team performance
                  insights.
                </p>
                <button
                  style={{
                    padding: "9px 16px",
                    borderRadius: 999,
                    border: "1px solid #00E0FF",
                    backgroundColor: "transparent",
                    color: "#E0F2FE",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  OPEN ANALYTICS
                </button>
              </div>
            </section>

            {/* Footer */}
            <footer
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 11,
                color: "#6B7280",
                borderTop: "1px solid rgba(31,41,55,0.9)",
                paddingTop: 12,
              }}
            >
              <span>SERVER NODE: EU-WEST-1</span>
              <span>© 2025 CHAMPIONTRACKPRO SYSTEMS</span>
            </footer>
          </div>
        </main>
      </div>
    );
  };

  const renderMobile = () => {
    const initialsForTeam = (team: TeamDoc) => {
      const name = (team.name || team.id || "").trim();
      if (!name) return "CT";
      const parts = name.split(" ");
      if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
      }
      return (parts[0][0] + parts[1][0]).toUpperCase();
    };

    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#020617",
          color: "#F9FAFB",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header simple */}
        <header
          style={{
            padding: "18px 20px 10px 20px",
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.16em",
              color: "#6B7280",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            CHAMPIONTRACKPRO
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 600,
            }}
          >
            Admin Units
          </h1>
          <p
            style={{
              margin: 0,
              marginTop: 2,
              fontSize: 12,
              color: "#9CA3AF",
            }}
          >
            {managedTeamsCount} managed teams reporting.
          </p>
        </header>

        {/* Teams list */}
        <div style={{ padding: "10px 12px 70px 12px", flex: 1 }}>
          {loading || error || teams.length === 0 ? (
            renderLoadingOrError()
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => handleOpenTeam(team)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid rgba(31,41,55,0.9)",
                    background:
                      "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(15,23,42,0.9))",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 14,
                      background:
                        "linear-gradient(135deg, #00E0FF, #3B82F6, #4C1D95)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#020617",
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    {initialsForTeam(team)}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
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
                      UNIT ID: {team.id}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 16,
                      color: "#6B7280",
                    }}
                  >
                    →
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bottom nav */}
        <nav
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            height: 64,
            backgroundColor: "#020617",
            borderTop: "1px solid rgba(31,41,55,0.9)",
            display: "flex",
            justifyContent: "space-around",
            alignItems: "center",
            fontSize: 11,
          }}
        >
          {["Dashboard", "Teams", "Reports", "Settings"].map((label, idx) => {
            const active = idx === 1;
            return (
              <div
                key={label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  color: active ? "#00E0FF" : "#9CA3AF",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "999px",
                    backgroundColor: active ? "#00E0FF" : "#4B5563",
                  }}
                />
                <span>{label}</span>
              </div>
            );
          })}
        </nav>
      </div>
    );
  };

  return isDesktop ? renderDesktop() : renderMobile();
}


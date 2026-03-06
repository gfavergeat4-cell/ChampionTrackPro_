import React from "react";
import { Platform, View, Text } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import PerformanceDashboard from "./PerformanceDashboard";

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export default function AthleteDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const { athleteId, athleteName, jerseyNumber, position, teamId, teamName } =
    (route.params || {}) as {
      athleteId?: string;
      athleteName?: string;
      jerseyNumber?: number;
      position?: string;
      teamId?: string;
      teamName?: string;
    };

  if (Platform.OS !== "web") {
    return (
      <View style={{ flex: 1, backgroundColor: "#0A0F1E", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#fff" }}>Athlete detail is optimized for web.</Text>
      </View>
    );
  }

  const initials = getInitials(athleteName || "?");

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at top, #0D1F3C 0%, #0A0F1E 60%)",
      backgroundColor: "#0A0F1E",
      color: "#FFFFFF",
      fontFamily: "system-ui, -apple-system, 'Inter', sans-serif",
      overflowY: "auto",
    }}>
      {/* Sticky header bar */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "rgba(10,15,30,0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(0,212,255,0.12)",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}>
        {/* Back button */}
        <button
          type="button"
          onClick={() => navigation.goBack()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: "none",
            color: "#00D4FF",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            padding: "6px 10px",
            borderRadius: 8,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.08)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Team
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.12)" }} />

        {/* Athlete identity */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          {jerseyNumber != null && (
            <div style={{
              minWidth: 28,
              height: 28,
              borderRadius: 6,
              background: "rgba(0,212,255,0.12)",
              border: "1px solid rgba(0,212,255,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              color: "#00D4FF",
              flexShrink: 0,
              padding: "0 5px",
            }}>
              #{jerseyNumber}
            </div>
          )}
          <div style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #00D4FF22, #4A67FF33)",
            border: "1px solid rgba(0,212,255,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            color: "#00D4FF",
            flexShrink: 0,
          }}>
            {initials || "?"}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {athleteName || "Athlete"}
            </div>
            {position ? (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{position}</div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Embedded PerformanceDashboard for this athlete */}
      <PerformanceDashboard
        route={{
          params: {
            role: "coach",
            teamId,
            teamName,
            athleteId,
          },
        }}
      />
    </div>
  );
}

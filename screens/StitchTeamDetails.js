import React, { useState, useEffect } from "react";
import { View, Text, Platform } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../services/firebaseConfig";
import { DateTime } from "luxon";
import PerformanceDashboard from "../src/screens/PerformanceDashboard";
import { useIsDesktop } from "../src/hooks/useIsDesktop";

const PAGE_SIZE = 20;

function getDateFromValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  if (typeof value?.toDate === "function") return value.toDate();
  if (value?.seconds != null) return new Date(value.seconds * 1000);
  return null;
}

function toMillis(value) {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const p = Date.parse(value);
    return Number.isNaN(p) ? null : p;
  }
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value?.seconds != null && value?.nanoseconds != null) {
    return value.seconds * 1000 + Math.floor(value.nanoseconds / 1e6);
  }
  return null;
}

function getEventDateTimeRange(event) {
  const tzid = event?.displayTz || event?.tzid || event?.timeZone || event?.calendarTz || "Europe/Paris";
  const startMillis = toMillis(event?.startUtc ?? event?.startUTC);
  if (startMillis == null) return null;
  const endMillis = toMillis(event?.endUtc ?? event?.endUTC) ?? startMillis + 3600000;
  const start = DateTime.fromMillis(startMillis, { zone: "utc" }).setZone(tzid);
  const end = DateTime.fromMillis(endMillis, { zone: "utc" }).setZone(tzid);
  return { start, end };
}

function formatEventDateFR(event) {
  const range = getEventDateTimeRange(event);
  if (!range) return "Date non définie";
  return range.start.setLocale("fr").toFormat("cccc d LLLL yyyy");
}

function formatEventTimeRange(event) {
  const range = getEventDateTimeRange(event);
  if (!range) return "──:──";
  const startStr = range.start.toFormat("HH:mm");
  const endStr = range.end.toFormat("HH:mm");
  return `${startStr} – ${endStr}`;
}

export default function StitchTeamDetails() {
  const navigation = useNavigation();
  const route = useRoute();
  const isDesktop = useIsDesktop();
  const { teamId, teamName: paramTeamName } = route.params || {};

  const [members, setMembers] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [trainingsPage, setTrainingsPage] = useState(0);
  const [membersOpen, setMembersOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const teamName = paramTeamName || teamId || "Équipe";

  useEffect(() => {
    if (!teamId) return;
    (async () => {
      try {
        const q = query(collection(db, "users"), where("teamId", "==", teamId));
        const snap = await getDocs(q);
        setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("Load members error", e);
      }
    })();
  }, [teamId]);

  useEffect(() => {
    if (!teamId) return;
    (async () => {
      try {
        const coll = collection(db, "teams", teamId, "trainings");
        const q = query(coll, orderBy("startUtc", "asc"));
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const ma = toMillis(a?.startUtc ?? a?.startUTC) ?? 0;
          const mb = toMillis(b?.startUtc ?? b?.startUTC) ?? 0;
          return ma - mb;
        });
        setTrainings(list);
      } catch (e) {
        try {
          const snap = await getDocs(collection(db, "teams", teamId, "trainings"));
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          list.sort((a, b) => {
            const ma = toMillis(a?.startUtc ?? a?.startUTC) ?? 0;
            const mb = toMillis(b?.startUtc ?? b?.startUTC) ?? 0;
            return ma - mb;
          });
          setTrainings(list);
        } catch (e2) {
          console.error("Load trainings error", e2);
        }
      }
    })();
  }, [teamId]);

  const paginatedTrainings = trainings.slice(
    trainingsPage * PAGE_SIZE,
    (trainingsPage + 1) * PAGE_SIZE
  );
  const totalPages = Math.max(1, Math.ceil(trainings.length / PAGE_SIZE));
  const hasPrev = trainingsPage > 0;
  const hasNext = trainingsPage < totalPages - 1;

  if (Platform.OS !== "web") {
    return (
      <View style={{ flex: 1, backgroundColor: "#0A0F1E", justifyContent: "center", alignItems: "center", padding: 24 }}>
        <Text style={{ color: "#fff", fontSize: 16 }}>Team details is optimized for web.</Text>
      </View>
    );
  }

  const contentPadding = isDesktop ? 48 : 24;
  const panelStyle = {
    position: "fixed",
    top: 0,
    right: 0,
    width: 380,
    height: "100vh",
    backgroundColor: "#0D1526",
    borderLeft: "1px solid rgba(0,224,255,0.15)",
    boxShadow: "-8px 0 24px rgba(0,0,0,0.4)",
    zIndex: 1000,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  const headerRow = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: isDesktop ? "20px 48px 16px" : "16px 24px 12px",
    flexWrap: "wrap",
    gap: 12,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at top, #0D1F3C 0%, #0A0F1E 60%)",
        backgroundColor: "#0A0F1E",
        color: "#FFFFFF",
        fontFamily: "system-ui, sans-serif",
        overflowY: "auto",
        paddingBottom: 80,
      }}
    >
      {/* Header */}
      <header style={{ flexShrink: 0 }}>
        <div style={headerRow}>
          <button
            type="button"
            onClick={() => navigation.goBack()}
            style={{
              background: "transparent",
              border: "none",
              color: "#00E0FF",
              fontSize: 15,
              cursor: "pointer",
              padding: "4px 0",
            }}
          >
            ← Retour
          </button>
          <h1
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 28,
              fontWeight: 700,
              color: "#FFFFFF",
              margin: 0,
              minWidth: 0,
            }}
          >
            {teamName}
          </h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => { setCalendarOpen(false); setMembersOpen((v) => !v); }}
              style={{
                background: "transparent",
                border: "1px solid #00E0FF",
                color: "#00E0FF",
                padding: "8px 14px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              👥 Membres
            </button>
            <button
              type="button"
              onClick={() => { setMembersOpen(false); setCalendarOpen((v) => !v); }}
              style={{
                background: "transparent",
                border: "1px solid #00E0FF",
                color: "#00E0FF",
                padding: "8px 14px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              📅 Calendrier
            </button>
          </div>
        </div>
        <div style={{ height: 1, background: "rgba(0,224,255,0.2)", margin: `0 ${contentPadding}px` }} />
      </header>

      {/* Contenu principal : PerformanceDashboard */}
      <main
        style={{
          padding: isDesktop ? `24px 48px 48px` : "24px 24px 48px",
          maxWidth: "100%",
        }}
      >
        <PerformanceDashboard
          route={{
            params: {
              teamId,
              teamName,
              role: "admin",
            },
          }}
        />
      </main>

      {/* Modale Membres */}
      {membersOpen && (
        <div style={panelStyle}>
          <div style={{ padding: 16, borderBottom: "1px solid rgba(0,224,255,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#ffffff" }}>Membres</span>
            <button
              type="button"
              onClick={() => setMembersOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.6)",
                fontSize: 18,
                cursor: "pointer",
                padding: 4,
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {members.length === 0 ? (
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, margin: 0 }}>Aucun membre</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {members.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border: "1px solid rgba(0,224,255,0.2)",
                      backgroundColor: "#0D1526",
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#FFFFFF", marginBottom: 4 }}>
                      {m.fullName || [m.firstName, m.lastName].filter(Boolean).join(" ") || "—"}
                    </div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>
                      {m.email || "—"}
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#00E0FF",
                        textTransform: "uppercase",
                        letterSpacing: 1,
                      }}
                    >
                      {(m.role || "athlete").toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modale Calendrier */}
      {calendarOpen && (
        <div style={panelStyle}>
          <div style={{ padding: 16, borderBottom: "1px solid rgba(0,224,255,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#ffffff" }}>Calendrier</span>
            <button
              type="button"
              onClick={() => setCalendarOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.6)",
                fontSize: 18,
                cursor: "pointer",
                padding: 4,
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {paginatedTrainings.length === 0 ? (
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, margin: 0 }}>Aucun entraînement</p>
            ) : (
              <>
                {paginatedTrainings.map((ev) => (
                  <div
                    key={ev.id}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border: "1px solid rgba(0,224,255,0.2)",
                      backgroundColor: "#0D1526",
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF", marginBottom: 4 }}>
                      {ev.title || ev.summary || "Entraînement"}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                      {formatEventDateFR(ev)} · {formatEventTimeRange(ev)}
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(0,224,255,0.2)" }}>
                  <button
                    type="button"
                    disabled={!hasPrev}
                    onClick={() => setTrainingsPage((p) => p - 1)}
                    style={{
                      padding: "6px 12px",
                      border: "1px solid rgba(0,224,255,0.2)",
                      background: hasPrev ? "transparent" : "#0A0F1E",
                      color: hasPrev ? "#00E0FF" : "rgba(255,255,255,0.6)",
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: hasPrev ? "pointer" : "default",
                    }}
                  >
                    Précédent
                  </button>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                    {trainingsPage + 1} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={!hasNext}
                    onClick={() => setTrainingsPage((p) => p + 1)}
                    style={{
                      padding: "6px 12px",
                      border: "1px solid rgba(0,224,255,0.2)",
                      background: hasNext ? "transparent" : "#0A0F1E",
                      color: hasNext ? "#00E0FF" : "rgba(255,255,255,0.6)",
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: hasNext ? "pointer" : "default",
                    }}
                  >
                    Suivant
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Overlay pour fermer les modales au clic à l'extérieur (optionnel) */}
      {(membersOpen || calendarOpen) && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
            background: "rgba(0,0,0,0.3)",
          }}
          onClick={() => { setMembersOpen(false); setCalendarOpen(false); }}
        />
      )}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import MobileViewport from "../src/components/MobileViewport";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../services/firebaseConfig";
import { DateTime } from "luxon";

export default function StitchTeamDetails() {
  const navigation = useNavigation();
  const route = useRoute();
  const { teamId, teamName, teamData } = route.params || {};
  
  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (teamId) {
      loadTeamData();
    }
  }, [teamId]);

  const loadTeamData = async () => {
    try {
      setLoading(true);
      
      // Charger les membres de l'équipe
      const membersQuery = query(
        collection(db, "users"),
        where("teamId", "==", teamId)
      );
      const membersSnapshot = await getDocs(membersQuery);
      const membersData = membersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMembers(membersData);

      // Charger les événements de l'équipe
      try {
        const eventsQuery = query(
          collection(db, "teams", teamId, "trainings"),
          orderBy("startUtc", "asc")
        );
        const eventsSnapshot = await getDocs(eventsQuery);
        const eventsData = eventsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setEvents(eventsData);
      } catch (orderError) {
        console.warn("⚠️ Impossible de trier par startUTC, fallback sans tri Firestore:", orderError);
        const fallbackSnapshot = await getDocs(collection(db, "teams", teamId, "trainings"));
        const eventsData = fallbackSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        eventsData.sort((a, b) => {
          const startA = getEventStartDate(a)?.getTime() ?? 0;
          const startB = getEventStartDate(b)?.getTime() ?? 0;
          return startA - startB;
        });
        setEvents(eventsData);
      }

    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
    } finally {
      setLoading(false);
    }
  };

  function getDateFromValue(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    if (typeof value.toDate === 'function') {
      const parsed = value.toDate();
      if (!isNaN(parsed?.getTime?.())) return parsed;
    }
    if (value.seconds !== undefined) {
      return new Date(value.seconds * 1000);
    }
    return null;
  }

  function getEventStartDate(event) {
    return (
      getDateFromValue(event?.startUTC) ||
      getDateFromValue(event?.startDate) ||
      getDateFromValue(event?.startLocalISO) ||
      getDateFromValue(event?.start)
    );
  }

  function getEventEndDate(event) {
    return (
      getDateFromValue(event?.endUTC) ||
      getDateFromValue(event?.endDate) ||
      getDateFromValue(event?.endLocalISO) ||
      getDateFromValue(event?.end)
    );
  }

  let adminDebugCount = 0;

  function toMillis(value) {
    if (value == null) return null;
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? null : parsed;
    }
    if (typeof value.toMillis === "function") {
      return value.toMillis();
    }
    if (
      typeof value === "object" &&
      value.seconds != null &&
      value.nanoseconds != null
    ) {
      return value.seconds * 1000 + Math.floor(value.nanoseconds / 1e6);
    }
    return null;
  }

  function getEventDateTimeRange(event) {
    const tzid =
      event?.displayTz ||
      event?.tzid ||
      event?.timeZone ||
      event?.calendarTz ||
      "Europe/Paris";

    const startMillis = toMillis(event?.startUtc ?? event?.startUTC);
    if (startMillis == null) {
      if (adminDebugCount < 3) {
        console.warn(
          `[UI][CHECK][Admin] id=${event?.id} missing startUtc value:`,
          event?.startUtc
        );
        adminDebugCount += 1;
      }
      return null;
    }

    const endMillis =
      toMillis(event?.endUtc ?? event?.endUTC) ?? startMillis + 60 * 60 * 1000;

    const start = DateTime.fromMillis(startMillis, { zone: "utc" }).setZone(tzid);
    const end = DateTime.fromMillis(endMillis, { zone: "utc" }).setZone(tzid);

    if (adminDebugCount < 3) {
      console.log(
        `[UI][CHECK][Admin] id=${event?.id} typeof=${typeof event?.startUtc} millis=${startMillis} tz=${tzid} local=${start.toFormat(
          "HH:mm"
        )}`
      );
      adminDebugCount += 1;
    }

    return { start, end, tzid };
  }

  function formatEventDate(event) {
    const range = getEventDateTimeRange(event);
    if (!range) return "Date non définie";
    return range.start.setLocale("fr").toFormat("cccc d LLLL yyyy");
  }

  function formatEventTimeRange(event) {
    const range = getEventDateTimeRange(event);
    if (!range) return "──:──";
    const startStr = range.start.toFormat("HH:mm");
    if (!range.end) {
      return `${startStr}`;
    }
    const endStr = range.end.toFormat("HH:mm");
    return `${startStr} – ${endStr}`;
  }

  if (Platform.OS === "web") {
    return (
      <MobileViewport>
        <div style={{
          width: "100%",
          maxWidth: "375px",
          height: "100%",
          background: "linear-gradient(to bottom, #0B0F1A, #020409)",
          display: "flex",
          flexDirection: "column",
          color: "white",
          fontFamily: "'Inter', sans-serif",
          overflow: "hidden",
          margin: "0 auto"
        }}>
          {/* Header */}
          <header style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            background: "rgba(0, 0, 0, 0.3)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <button
                  onClick={() => navigation.goBack()}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#00E0FF",
                    fontSize: "16px",
                    cursor: "pointer",
                    marginRight: "12px"
                  }}
                >
                  ← Retour
                </button>
                <h1 style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                  margin: "4px 0 0 0",
                  background: "linear-gradient(135deg, #00E0FF, #4A67FF)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent"
                }}>
                  {teamName || "Détails de l'équipe"}
                </h1>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main style={{
            flex: 1,
            padding: "16px 20px",
            overflow: "auto",
            paddingBottom: "100px"
          }}>
            {loading ? (
              <div style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "#9AA3B2"
              }}>
                <div style={{ fontSize: "24px", marginBottom: "16px" }}>⏳</div>
                <p style={{ fontSize: "14px", margin: 0 }}>Chargement des données...</p>
              </div>
            ) : (
              <>
                {/* Membres de l'équipe */}
                <div style={{
                  background: "rgba(0, 224, 255, 0.1)",
                  border: "1px solid rgba(0, 224, 255, 0.2)",
                  borderRadius: "12px",
                  padding: "16px",
                  marginBottom: "20px"
                }}>
                  <h2 style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    margin: "0 0 12px 0",
                    color: "#00E0FF"
                  }}>
                    Membres de l'équipe ({members.length})
                  </h2>
                  
                  {members.length === 0 ? (
                    <p style={{
                      fontSize: "12px",
                      color: "#9AA3B2",
                      margin: 0,
                      fontStyle: "italic"
                    }}>
                      Aucun membre dans cette équipe
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {members.map((member) => (
                        <div
                          key={member.id}
                          style={{
                            background: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: "8px",
                            padding: "12px"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <h3 style={{
                                fontSize: "14px",
                                fontWeight: "600",
                                margin: "0 0 4px 0",
                                color: "#E5E7EB"
                              }}>
                                {member.fullName || member.firstName + " " + member.lastName}
                              </h3>
                              <p style={{
                                fontSize: "11px",
                                color: "#9AA3B2",
                                margin: "0 0 4px 0"
                              }}>
                                {member.email}
                              </p>
                            </div>
                            <span style={{
                              fontSize: "10px",
                              fontWeight: "500",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              background: member.role === "admin" ? "rgba(239, 68, 68, 0.1)" : 
                                         member.role === "coach" ? "rgba(0, 224, 255, 0.1)" : 
                                         "rgba(74, 103, 255, 0.1)",
                              color: member.role === "admin" ? "#EF4444" : 
                                     member.role === "coach" ? "#00E0FF" : "#4A67FF",
                              textTransform: "uppercase"
                            }}>
                              {member.role}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Calendrier d'entraînement */}
                <div style={{
                  background: "rgba(74, 103, 255, 0.1)",
                  border: "1px solid rgba(74, 103, 255, 0.2)",
                  borderRadius: "12px",
                  padding: "16px"
                }}>
                  <h2 style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    margin: "0 0 12px 0",
                    color: "#4A67FF"
                  }}>
                    Calendrier d'entraînement ({events.length})
                  </h2>
                  
                  {events.length === 0 ? (
                    <p style={{
                      fontSize: "12px",
                      color: "#9AA3B2",
                      margin: 0,
                      fontStyle: "italic"
                    }}>
                      Aucun événement programmé
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {events.slice(0, 10).map((event) => (
                        <div
                          key={event.id}
                          style={{
                            background: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: "8px",
                            padding: "12px"
                          }}
                        >
                          <h3 style={{
                            fontSize: "14px",
                            fontWeight: "600",
                            margin: "0 0 4px 0",
                            color: "#E5E7EB"
                          }}>
                            {event.title || event.summary || "Entraînement"}
                          </h3>
                          <p style={{
                            fontSize: "11px",
                            color: "#9AA3B2",
                            margin: "0 0 4px 0"
                          }}>
                            {formatEventDate(event)} • {formatEventTimeRange(event)}
                          </p>
                          {event.description && (
                            <p style={{
                              fontSize: "10px",
                              color: "#9AA3B2",
                              margin: 0,
                              fontStyle: "italic"
                            }}>
                              {event.description}
                            </p>
                          )}
                        </div>
                      ))}
                      {events.length > 10 && (
                        <p style={{
                          fontSize: "11px",
                          color: "#9AA3B2",
                          margin: "8px 0 0 0",
                          textAlign: "center",
                          fontStyle: "italic"
                        }}>
                          ... et {events.length - 10} autres événements
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </main>
        </div>
      </MobileViewport>
    );
  }

  // Native fallback
  return (
    <MobileViewport>
      <View style={styles.container}>
        <Text style={styles.title}>Team Details</Text>
        <Text style={styles.subtitle}>Team management interface coming soon...</Text>
      </View>
    </MobileViewport>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0E1528",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00E0FF",
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    color: "#9CA3AF",
    textAlign: "center",
  },
});
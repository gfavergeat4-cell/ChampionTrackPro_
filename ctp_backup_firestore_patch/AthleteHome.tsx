import React, { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions, Platform, Image } from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { makePress } from "../utils/press";
import { doc, getDoc, collection, getDocs, limit, query } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { tokens } from "../theme/tokens";
import UnifiedAthleteNavigation from "./UnifiedAthleteNavigation";
import { getUpcomingTrainings } from "../lib/scheduleQueries";
import { DateTime } from "luxon";
import { auth, db } from "../lib/firebase";
import { getApp } from "firebase/app";
import { resolveAthleteTeamId } from "../lib/teamContext";

interface AthleteHomeProps {
  sessions?: Array<{ id: string; title: string; time: string; hasResponse?: boolean }>;
  onRespond?: (sessionId: string, eventData?: any) => void;
  onOpenSession?: (sessionId: string) => void;
  onNavigateToTab?: (tab: 'Home' | 'Schedule' | 'Profile') => void;
}

export default function AthleteHome({
  sessions = [],
  onRespond,
  onOpenSession,
  onNavigateToTab
}: AthleteHomeProps) {
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState(null);

  console.log("🏠 AthleteHome component loaded - this is the modified component");

  // Fonction de rechargement forcé
  const forceRefresh = () => {
    console.log("🔄 Rechargement forcé des données...");
    setRefreshKey(prev => prev + 1);
    setCalendarEvents([]);
    setLoading(true);
  };

  // Charger les entraînements Google Calendar pour l'équipe de l'athlète
  useEffect(() => {
    const loadCalendarEvents = async () => {
      try {
        setLoading(true);
        setError(null);

        const currentUser =
          auth.currentUser ??
          (await new Promise((resolve) => {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
              unsubscribe();
              resolve(user ?? null);
            });
          }));

        if (!currentUser) {
          console.log("No authenticated user");
          setLoading(false);
          return;
        }

        console.log('[FB][PROJECT][ATHLETE]', getApp()?.options?.projectId);
        const teamId = await resolveAthleteTeamId(db, currentUser.uid);
        console.log('[READY]', { hasUser: !!currentUser, teamId });

        if (!teamId) {
          console.log("No team ID found for user");
          setLoading(false);
          return;
        }
        console.log('[ATHLETE][TEAM]', { teamId, uid: currentUser.uid });
        console.log('[ATHLETE][PATH]', `teams/${teamId}/trainings`);

        try {
          const dbgSnapshot = await getDocs(
            query(collection(db, `teams/${teamId}/trainings`), limit(3))
          );
          console.log('[ATHLETE][DBG_LIST] count=', dbgSnapshot.size);
          dbgSnapshot.forEach((docSnap) => {
            console.log('[ATHLETE][DBG_ITEM]', docSnap.id, docSnap.data());
          });
        } catch (dbgError) {
          console.error('[ATHLETE][FS_ERROR][DBG]', dbgError);
        }

        const teamSnap = await getDoc(doc(db, "teams", teamId));
        const teamData = teamSnap.exists() ? teamSnap.data() : null;

        if (teamData && teamData.calendarImported === false) {
          console.log("📅 Aucun calendrier importé pour cette équipe");
          setCalendarEvents([]);
          setLoading(false);
          return;
        }

        const fallbackTz = (teamData?.timeZone as string) || 'Europe/Paris';
        let upcomingTrainings;
        try {
          upcomingTrainings = await getUpcomingTrainings(
            teamId,
            currentUser.uid,
            3,
            30
          );
        } catch (fetchError) {
          console.error('[ATHLETE][FS_ERROR]', fetchError);
          throw fetchError;
        }

        console.log('[ATHLETE] training snapshot size (client):', upcomingTrainings.length);
        console.log('[UI][MAPPED_FIRST]', upcomingTrainings.slice(0, 3));

        let loggedKickboxingDebug = false;
        const events = upcomingTrainings.map((event, index) => {
          const displayTz =
            event.displayTz || event.tzid || event.timeZone || fallbackTz;

          const startLocal = event.startDate
            ? DateTime.fromJSDate(event.startDate, { zone: 'utc' }).setZone(displayTz)
            : null;
          const endLocal = event.endDate
            ? DateTime.fromJSDate(event.endDate, { zone: 'utc' }).setZone(displayTz)
            : startLocal;

          const hasTime = Boolean(startLocal && endLocal);
          const title = event.title || event.summary || "Training";
          const displayTime = hasTime
            ? `${startLocal!.toFormat('HH:mm')} - ${endLocal!.toFormat('HH:mm')}`
            : '──:──';
          const displayDate = startLocal
            ? startLocal.setLocale('fr').toFormat("cccc d LLLL")
            : 'Date à confirmer';
          const displayDateShort = startLocal
            ? startLocal.setLocale('fr').toFormat("d LLL")
            : '--';
          const isToday = startLocal
            ? startLocal.hasSame(DateTime.now().setZone(displayTz), 'day')
            : false;
          const displayLabel = `${displayDateShort} • ${displayTime}`;

          if (!startLocal) {
            console.log(
              `[UI][WARN] id=${event.id} startDate malformed`,
              { title, displayTz, startDate: event.startDate }
            );
          }

          if (index < 3 && startLocal) {
            console.log(
              `[UI][CHECK][Athlete] id=${event.id} millis=${event.startUTC} tz=${displayTz} local=${startLocal.toFormat('HH:mm')}`
            );
          }

          if (!loggedKickboxingDebug && /kickboxing/i.test(title)) {
            console.log(
              `[UI][CHECK] Kickboxing id=${event.id} millis=${event.startUTC} tz=${displayTz} local=${startLocal?.toFormat('HH:mm')}`
            );
            loggedKickboxingDebug = true;
          }

          return {
            ...event,
            title,
            tzid: displayTz,
            timeZone: displayTz,
            displayTz,
            displayTime,
            displayDate,
            displayDateShort,
            displayLabel,
            startDate: startLocal?.toJSDate() ?? null,
            endDate: endLocal?.toJSDate() ?? null,
            startLocalIso: startLocal?.toISO() ?? null,
            endLocalIso: endLocal?.toISO() ?? null,
            isToday,
            hasTime,
          };
        });

        setCalendarEvents(events);
      } catch (error) {
        console.error("❌ Erreur lors du chargement des événements:", error);
        setError(error instanceof Error ? error.message : 'Unknown error');
        setCalendarEvents([]);
      } finally {
        setLoading(false);
      }
    };

    loadCalendarEvents();
  }, [refreshKey]);

  // Recharger les données quand l'utilisateur revient sur l'écran
  useEffect(() => {
    const handleFocus = () => {
      console.log("🔄 Écran d'accueil refocusé, rechargement des données...");
      forceRefresh();
    };

    // Pour le web, recharger à chaque fois et écouter les changements de focus
    if (Platform.OS === 'web') {
      handleFocus();
      
      // Écouter les changements de focus de la fenêtre
      window.addEventListener('focus', handleFocus);
      
      // Écouter les événements de stockage pour détecter les changements
      const handleStorageChange = (e) => {
        if (e.key === 'questionnaireSubmitted') {
          console.log("🔄 Questionnaire soumis détecté, rechargement...");
          forceRefresh();
        }
      };
      
      window.addEventListener('storage', handleStorageChange);

      return () => {
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('storage', handleStorageChange);
      };
    }
  }, []);

  // Toujours utiliser les événements du calendrier (pas de sessions par défaut)
  const displaySessions = calendarEvents;
  return (
    <View style={styles.container}>
      {/* Background gradient effects */}
      <View style={styles.backgroundEffect1} pointerEvents="none" />
      <View style={styles.backgroundEffect2} pointerEvents="none" />
      
      {/* Profile avatar */}
      <View style={styles.profileContainer} pointerEvents="none">
        <View style={styles.avatar} />
      </View>

      {/* Main content */}
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.welcomeText}>WELCOME BACK</Text>
              <Text style={styles.subtitle}>Here are your sessions for today.</Text>
              <Text style={styles.dateText}>
                {new Date().toLocaleDateString('fr-FR', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </Text>
            </View>
            <Pressable 
              style={styles.refreshButton}
              onPress={() => {
                console.log("🔄 Rafraîchissement manuel des données...");
                forceRefresh();
              }}
            >
              <Text style={styles.refreshButtonText}>🔄</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sessionsSection}>
          <Text style={styles.sectionTitle}>
            {calendarEvents.length > 0 && calendarEvents[0].isToday
             ? "Today's Sessions" : "Your Sessions"}
          </Text>
          <Text style={styles.sectionSubtitle}>
            {calendarEvents.length > 0 && calendarEvents[0].isToday
             ? "Your training events for today."
             : "Your upcoming training events."}
          </Text>

          <View style={styles.sessionsList}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading calendar...</Text>
              </View>
            ) : displaySessions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No sessions today</Text>
                <Text style={styles.emptySubtext}>No training scheduled for today</Text>
              </View>
            ) : (
              displaySessions.map((session) => (
              <View key={session.id} style={styles.sessionCard}>
                <Pressable 
                  style={[
                    styles.sessionInfo,
                    session.hasResponse && styles.completedSessionCard
                  ]}
                  onPress={makePress(() => {
                    if (session.hasResponse) {
                      console.log("Session already completed, access denied");
                      return; // Empêcher l'accès si déjà complété
                    }
                    console.log("Session clicked:", session.id);
                    onOpenSession?.(session.id);
                  })}
                  role={Platform.OS === "web" ? "button" : undefined}
                  tabIndex={Platform.OS === "web" ? 0 : undefined}
                  accessible={true}
                  accessibilityLabel={`Session ${session.title} at ${session.displayLabel || session.displayTime}`}
                  disabled={session.hasResponse} // Désactiver si déjà complété
                >
                  <Text style={[
                    styles.sessionTime,
                    session.hasResponse && styles.completedSessionText
                  ]}>
                    {session.displayLabel || session.displayTime || session.time || "──:──"}
                  </Text>
                  <Text style={[
                    styles.sessionTitle,
                    session.hasResponse && styles.completedSessionText
                  ]}>
                    {session.title || session.summary || "Entraînement"}
                  </Text>
                </Pressable>
                <View style={styles.sessionStatus}>
                  {session.hasResponse ? (
                    <View style={styles.completedBadge}>
                      <View style={styles.checkmarkCircle}>
                        <Text style={styles.checkmark}>✓</Text>
                      </View>
                      <Text style={styles.completedText}>Completed</Text>
                    </View>
                  ) : (
                    <>
                      <Pressable 
                        style={styles.respondButton} 
                        onPress={makePress(() => {
                          console.log("Respond button clicked for session:", session.id);
                          console.log("Event data:", session);
                          onRespond?.(session.id, session);
                        })}
                        role={Platform.OS === "web" ? "button" : undefined}
                        tabIndex={Platform.OS === "web" ? 0 : undefined}
                        accessible={true}
                        accessibilityLabel={`Respond to ${session.title}`}
                      >
                        <Text style={styles.respondButtonText}>Respond</Text>
                      </Pressable>
                      <View style={styles.notificationDot} />
                    </>
                  )}
                </View>
              </View>
              ))
            )}
          </View>
        </View>
      </View>

      {/* Navigation unifiée pour les athlètes */}
      {Platform.OS === 'web' && onNavigateToTab && (
        <UnifiedAthleteNavigation 
          activeTab="Home" 
          onNavigate={onNavigateToTab} 
        />
      )}
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0F1A", // brand-navy from Stitch
    minHeight: 884, // Exact height from Stitch
    width: "100%",
    maxWidth: 375, // Mobile viewport width
    alignSelf: "center",
    position: "relative",
    overflow: "hidden",
  },
  backgroundEffect1: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 288, // w-72 = 288px
    height: 288,
    backgroundColor: "#00C6FF", // brand-cyan
    opacity: 0.15,
    borderRadius: 144,
    // blur-3xl effect approximated
    shadowColor: "#00C6FF",
    shadowOpacity: 0.6,
    shadowRadius: 50,
    elevation: 0,
  },
  backgroundEffect2: {
    position: "absolute",
    bottom: -64, // -bottom-16 = -64px
    right: 0,
    width: 320, // w-80 = 320px
    height: 320,
    backgroundColor: "#0066FF", // brand-blue
    opacity: 0.3,
    borderRadius: 160,
    // blur-3xl effect approximated
    shadowColor: "#0066FF",
    shadowOpacity: 0.6,
    shadowRadius: 50,
    elevation: 0,
  },
  profileContainer: {
    position: "absolute",
    top: 48, // top-12 = 48px
    right: 24, // right-6 = 24px
    zIndex: 20,
  },
  avatar: {
    width: 36, // w-9 = 36px
    height: 36,
    borderRadius: 18,
    backgroundColor: "#00C6FF", // brand-cyan
    borderWidth: 2,
    borderColor: "rgba(0, 198, 255, 0.6)", // border-brand-cyan/60
    // avatar-glow effect
    shadowColor: "#00C6FF",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24, // px-6 = 24px
    paddingTop: 48, // pt-12 = 48px
    zIndex: 10,
  },
  header: {
    marginBottom: 32, // mb-8 = 32px
  },
  welcomeText: {
    color: "#E5E4E2", // platinum
    fontSize: 24, // text-2xl
    fontWeight: "700",
    letterSpacing: -0.5, // tracking-tighter
    textTransform: "uppercase",
    fontFamily: Platform.OS === "web" ? "Poppins" : "System",
  },
  subtitle: {
    color: "rgba(229, 228, 226, 0.8)", // text-platinum/80
    fontSize: 14, // text-sm
    textTransform: "uppercase",
    letterSpacing: 1, // tracking-wide
    marginTop: 4,
    fontFamily: Platform.OS === "web" ? "Poppins" : "System",
  },
  sessionsSection: {
    alignItems: "center",
    marginBottom: 24, // mb-6 = 24px
  },
  sectionTitle: {
    color: "rgba(229, 228, 226, 0.9)", // text-platinum/90
    fontSize: 12, // text-xs
    fontWeight: "600",
    letterSpacing: 2, // tracking-widest
    textTransform: "uppercase",
    marginBottom: 4,
    fontFamily: Platform.OS === "web" ? "Poppins" : "System",
  },
  sectionSubtitle: {
    color: "rgba(229, 228, 226, 0.7)", // text-platinum/70
    fontSize: 12, // text-xs
    fontFamily: Platform.OS === "web" ? "Poppins" : "System",
  },
  sessionsList: {
    width: "100%",
    gap: 12, // space-y-3 = 12px
  },
  sessionCard: {
    backgroundColor: "rgba(20, 26, 36, 0.5)", // card-glass background
    borderRadius: 16, // rounded-2xl
    paddingHorizontal: 16, // px-4 = 16px
    paddingVertical: 12, // py-3 = 12px
    borderWidth: 1,
    borderColor: "rgba(0, 198, 255, 0.2)", // border-brand-cyan/20
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    // Glass effect shadow
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 4,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTime: {
    color: "rgba(229, 228, 226, 0.7)", // text-platinum/70
    fontSize: 12, // text-xs
    marginBottom: 4, // mb-1 = 4px
    fontFamily: Platform.OS === "web" ? "Poppins" : "System",
  },
  sessionTitle: {
    color: "#E5E4E2", // platinum
    fontSize: 16, // text-base
    fontWeight: "600",
    letterSpacing: -0.5, // tracking-tight
    fontFamily: Platform.OS === "web" ? "Poppins" : "System",
  },
  sessionStatus: {
    marginLeft: 16, // ml-4 = 16px
    position: "relative",
  },
  respondButton: {
    backgroundColor: "#00C6FF", // brand-cyan
    borderRadius: 20, // rounded-full
    paddingHorizontal: 20, // px-5 = 20px
    paddingVertical: 10, // py-2.5 = 10px
    // respond-button-glow effect
    shadowColor: "#00C6FF",
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 4,
  },
  respondButtonText: {
    color: "#FFFFFF",
    fontSize: 14, // text-sm
    fontWeight: "600",
    fontFamily: Platform.OS === "web" ? "Poppins" : "System",
  },
  notificationDot: {
    position: "absolute",
    top: -4, // -top-1 = -4px
    right: -4, // -right-1 = -4px
    width: 10, // w-2.5 = 10px
    height: 10,
    backgroundColor: "#FF1D7C", // brand-pink
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#0A0F1A", // border-brand-navy
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  loadingText: {
    color: "rgba(229, 228, 226, 0.7)",
    fontSize: 14,
    fontFamily: Platform.OS === "web" ? "Poppins" : "System",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  emptyText: {
    color: "rgba(229, 228, 226, 0.7)",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    fontFamily: Platform.OS === "web" ? "Poppins" : "System",
  },
  emptySubtext: {
    color: "rgba(229, 228, 226, 0.5)",
    fontSize: 12,
    textAlign: "center",
    fontFamily: Platform.OS === "web" ? "Poppins" : "System",
  },
  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F2937", // Dark background like in the image
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: "#374151",
  },
  completedText: {
    color: "#F9FAFB", // Light gray text like in the image
    fontSize: 14,
    fontWeight: "500",
    fontFamily: Platform.OS === "web" ? "Inter" : "System",
  },
  checkmark: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: Platform.OS === "web" ? "Inter" : "System",
    textAlign: "center",
  },
  completedSessionCard: {
    opacity: 0.6, // Dim completed sessions more
    backgroundColor: "rgba(16, 185, 129, 0.05)", // Subtle green tint
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderWidth: 1,
    // Add a subtle disabled effect
    shadowColor: "transparent",
    elevation: 0,
  },
  completedSessionText: {
    color: "rgba(255, 255, 255, 0.5)", // More dimmed text
  },
  checkmarkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#10B981", // Green circle like in the image
    alignItems: "center",
    justifyContent: "center",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  refreshButton: {
    backgroundColor: "rgba(0, 224, 255, 0.1)",
    borderRadius: 20,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 224, 255, 0.3)",
  },
  refreshButtonText: {
    color: "#00E0FF",
    fontSize: 16,
    fontWeight: "bold",
  },
  dateText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    fontFamily: Platform.OS === "web" ? "Inter" : "System",
    marginTop: 4,
    textTransform: "capitalize",
  },
});
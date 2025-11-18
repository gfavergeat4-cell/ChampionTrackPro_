import React, { useState, useEffect, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions, Platform, Image, ScrollView } from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { makePress } from "../utils/press";
import { doc, getDoc, collection, getDocs, limit, query } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { tokens } from "../theme/tokens";
import { useDevice } from "../hooks/useDevice";
import { getResponsiveSpacing, getResponsiveFontSize, getMainContainerStyle } from "../utils/responsive";
import { getUpcomingTrainings } from "../lib/scheduleQueries";
import { QuestionnaireState } from "../utils/questionnaire";
import { DateTime } from "luxon";
import { auth, db } from "../lib/firebase";
import { getApp } from "firebase/app";
import { resolveAthleteTeamId } from "../lib/teamContext";
import MobileViewport from "../components/MobileViewport";
import UnifiedAthleteNavigation from "./UnifiedAthleteNavigation";
import BrandHeader from "../components/BrandHeader";

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
  const [userData, setUserData] = useState<{ firstName?: string; profileImage?: string } | null>(null);
  const device = useDevice();
  
  // Tabs configuration (active tab fixed to 'Home' on this screen)
  const tabs: Array<'Home' | 'Schedule' | 'Profile'> = ['Home', 'Schedule', 'Profile'];
  const activeTab = tabs[0];

  // Fonction de rechargement forcé
  const forceRefresh = () => {
    console.log("🔄 Rechargement forcé des données...");
    setRefreshKey(prev => prev + 1);
    setCalendarEvents([]);
    setLoading(true);
  };

  // Charger les entraînements du calendrier Google
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
        
        // Fetch user data for header
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const userDataFromDoc = userDoc.data() as any;
          setUserData({
            firstName: userDataFromDoc.displayName?.split(' ')[0] || userDataFromDoc.firstName,
            profileImage: userDataFromDoc.profileImage || userDataFromDoc.photoURL,
          });
        }
        
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

        const teamDoc = await getDoc(doc(db, "teams", teamId));
        const teamData = teamDoc.exists() ? teamDoc.data() : null;
        const fallbackTz = (teamData?.timeZone as string) || 'Europe/Paris';

        let upcomingTrainings;
        try {
          upcomingTrainings = await getUpcomingTrainings(
            teamId,
            currentUser.uid,
            5,
            30
          );
        } catch (fetchError) {
          console.error('[ATHLETE][FS_ERROR]', fetchError);
          throw fetchError;
        }
        console.log('[ATHLETE] training snapshot size (client):', upcomingTrainings.length);
        console.log('[UI][MAPPED_FIRST]', upcomingTrainings.slice(0, 3));

        let loggedKickboxingDebug = false;
        const formattedEvents = upcomingTrainings.map((event, index) => {
          console.log('[UI][EVENT]', event.id, {
            title: event.title,
            startDate: event.startDate?.toISOString?.() ?? null,
            startMillis: event.startUTC ?? null,
            tz: event.displayTz,
          });

          const displayTz =
            event.displayTz || event.tzid || event.timeZone || fallbackTz;

          const startLocal = event.startDate
            ? DateTime.fromJSDate(event.startDate, { zone: 'utc' }).setZone(displayTz)
            : null;
          const endLocal = event.endDate
            ? DateTime.fromJSDate(event.endDate, { zone: 'utc' }).setZone(displayTz)
            : startLocal;

          const hasTime = Boolean(startLocal && endLocal);
          const title = event.title || event.summary || 'Training';
          // Format commun : "18:30 - 19:45" pour Next Session et Upcoming
          const timeLabelForNextSession = hasTime
            ? `${startLocal!.toFormat('HH:mm')} - ${endLocal!.toFormat('HH:mm')}`
            : '──:──';
          const timeLabelForUpcoming = hasTime
            ? `${startLocal!.toFormat('HH:mm')} - ${endLocal!.toFormat('HH:mm')}`
            : '──:──';
          const displayDate = startLocal
            ? startLocal.setLocale('fr').toFormat("cccc d LLLL")
            : 'Date à confirmer';

          if (index < 3 && startLocal) {
            console.log(
              `[UI][CHECK][AthleteWeb] id=${event.id} millis=${event.startUTC} tz=${displayTz} local=${startLocal.toFormat('HH:mm')}`
            );
          }

          if (!loggedKickboxingDebug && /kickboxing/i.test(title) && startLocal) {
            console.log(
              `[UI][CHECK][web] Kickboxing id=${event.id} millis=${event.startUTC} tz=${displayTz} local=${startLocal.toFormat('HH:mm')}`
            );
            loggedKickboxingDebug = true;
          }

          if (!startLocal) {
            console.log(
              `[UI][WARN] id=${event.id} startDate malformed`,
              { title, displayTz, startDate: event.startDate }
            );
          }

          return {
            id: event.id,
            title,
            time: timeLabelForUpcoming, // Default for list
            timeForNextSession: timeLabelForNextSession, // Special format for NEXT SESSION
            displayDate,
            hasResponse: event.hasResponse ?? false,
            questionnaireState: (event as any).questionnaireState,
            source: event.source,
            tzid: displayTz,
            displayTz,
            hasTime,
            ...event, // Include all other event properties
          };
        });

        setCalendarEvents(formattedEvents);
      } catch (error) {
        console.error("❌ Error loading events:", error);
        setError(error instanceof Error ? error.message : 'Unknown error');
        setCalendarEvents([]);
      } finally {
        setLoading(false);
      }
    };

    loadCalendarEvents();
  }, [refreshKey]);

  // Auto-refresh for web
  useEffect(() => {
    if (Platform.OS === 'web') {
      return () => {};
    }
  }, []);

  const todayEvents = calendarEvents;
  const nextSession = calendarEvents.length > 0 ? calendarEvents[0] : null;
  const upcomingSessions = calendarEvents.length > 1 ? calendarEvents.slice(1) : [];

  const containerStyle = getMainContainerStyle(device);
  const headerPadding = getResponsiveSpacing('xl', device);
  const sectionPadding = getResponsiveSpacing('lg', device);

  const sanitizedContainerStyle = useMemo(() => {
    const style = { ...(containerStyle as Record<string, any>) };
    if (typeof style.marginHorizontal === 'string') {
      style.marginHorizontal = 0;
    }
    return style;
  }, [containerStyle]);

  // Render questionnaire action based on state
  const renderQuestionnaireAction = (session: any) => {
    const state: QuestionnaireState | undefined = session?.questionnaireState;
    
    if (!state) {
      console.error("[HOME][STATE][ACTION] questionnaireState missing for", session.id, session.title);
      return null;
    }

    const nowMillis = DateTime.utc().toMillis();
    const endMillis = session?.endMillis ?? (session?.endDate ? new Date(session.endDate).getTime() : null);

    console.log("[HOME][STATE][ACTION]", {
      id: session.id,
      title: session.title,
      state,
      endMillis,
      now: nowMillis,
    });

    switch (state) {
      case 'completed':
        return (
          <View style={styles.completedBadge}>
            <Text style={styles.completedIcon}>✔️</Text>
            <Text style={[
              styles.completedText,
              { fontSize: getResponsiveFontSize('sm', device) }
            ]}>
              Completed
            </Text>
          </View>
        );

      case 'comingSoon':
        return (
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonIcon}>⏳</Text>
            <Text style={styles.comingSoonText}>Coming soon</Text>
          </View>
        );

      case 'expired':
        return (
          <View style={styles.expiredBadge}>
            <Text style={styles.expiredIcon}>🔒</Text>
            <Text style={[
              styles.expiredText,
              { fontSize: getResponsiveFontSize('sm', device) }
            ]}>
              Expired
            </Text>
          </View>
        );

      case 'respond':
        return (
          <View style={{
            backgroundColor: 'transparent',
            borderRadius: 12,
            overflow: 'hidden',
            shadowColor: '#00E0FF',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 5,
          }}>
            <LinearGradient
              colors={['#00E0FF', '#4A67FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                height: 36,
                paddingHorizontal: 16,
                borderRadius: 12,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Pressable
                onPress={() => {
                  console.log("[HOME][RESPOND][CLICK] Respond clicked for session:", session.id, session.title);
                  if (onRespond) {
                    onRespond(session.id, session);
                  }
                }}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.9 : 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                })}
              >
                <Text style={{
                  color: '#FFFFFF',
                  fontFamily: 'Inter',
                  fontSize: 14,
                  fontWeight: '500',
                  letterSpacing: 0.03,
                }}>
                  Respond
                </Text>
                <View style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: '#00E0FF',
                  shadowColor: '#00E0FF',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.8,
                  shadowRadius: 4,
                }} />
              </Pressable>
            </LinearGradient>
          </View>
        );

      default:
        console.warn("[HOME][STATE][ACTION] Unknown questionnaire state:", state);
        return null;
    }
  };

  // Render questionnaire action for web
  const renderQuestionnaireActionWeb = (session: any) => {
    const state: QuestionnaireState | undefined = session?.questionnaireState;
    
    if (!state) {
      return null;
    }

    const nowMillis = DateTime.utc().toMillis();
    const endMillis = session?.endMillis ?? (session?.endDate ? new Date(session.endDate).getTime() : null);

    switch (state) {
      case 'completed':
        return (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            height: '36px',
            padding: '0 16px',
            borderRadius: '12px',
            background: 'rgba(0, 255, 200, 0.15)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '0.5px solid rgba(0, 255, 200, 0.4)',
            color: '#00FFC8',
            fontFamily: "'Inter', sans-serif",
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 0 12px rgba(0, 255, 200, 0.3)',
            letterSpacing: '0.03em',
            cursor: 'not-allowed',
            userSelect: 'none'
          }}>
            <span>✔️</span>
            <span>Completed</span>
          </div>
        );

      case 'comingSoon':
        return (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            height: '36px',
            padding: '0 16px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(0, 224, 255, 0.18) 0%, rgba(0, 141, 255, 0.28) 100%)',
            border: '0.5px solid rgba(0, 224, 255, 0.45)',
            boxShadow: '0 0 18px rgba(0, 224, 255, 0.25), inset 0 0 12px rgba(0, 224, 255, 0.15)',
            color: '#DFF8FF',
            fontFamily: "'Inter', sans-serif",
            fontSize: '14px',
            fontWeight: '500',
            letterSpacing: '0.03em',
            cursor: 'not-allowed',
            userSelect: 'none'
          }}>
            <span style={{ color: '#8DEBFF', textShadow: '0 0 8px rgba(0, 224, 255, 0.8)' }}>⏳</span>
            <span>Coming soon</span>
          </div>
        );

      case 'expired':
        return (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            height: '36px',
            padding: '0 16px',
            borderRadius: '12px',
            background: '#1A1A1A',
            color: '#9CA3AF',
            fontFamily: "'Inter', sans-serif",
            fontSize: '14px',
            fontWeight: '500',
            letterSpacing: '0.03em',
            cursor: 'not-allowed',
            userSelect: 'none'
          }}>
            <span>🔒</span>
            <span>Expired</span>
          </div>
        );

      case 'respond':
        return (
          <button
            onClick={() => {
              if (onRespond) {
                onRespond(session.id, session);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              height: '36px',
              padding: '0 16px',
              borderRadius: '12px',
              background: 'linear-gradient(90deg, #00E0FF 0%, #4A67FF 100%)',
              border: 'none',
              color: '#FFFFFF',
              fontFamily: "'Inter', sans-serif",
              fontSize: '14px',
              fontWeight: '500',
              letterSpacing: '0.03em',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 0 12px rgba(0, 224, 255, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2)',
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 0 16px rgba(0, 224, 255, 0.6), 0 4px 12px rgba(0, 0, 0, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 224, 255, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2)';
            }}
          >
            <span>Respond</span>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#00E0FF',
              boxShadow: '0 0 8px rgba(0, 224, 255, 0.8)',
            }} />
          </button>
        );

      default:
        return null;
    }
  };

  const handleTabNavigation = (tab: 'Home' | 'Schedule' | 'Profile') => {
    if (onNavigateToTab) {
      onNavigateToTab(tab);
    }
  };

  // Web version with same style as Profile
  if (Platform.OS === 'web') {
    return (
      <MobileViewport>
        <div style={{
          width: "100%",
          maxWidth: "375px",
          height: "812px",
          backgroundColor: "#0A0F1A",
          overflow: "hidden",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          fontFamily: Platform.select({ web: "'Inter', sans-serif", default: "System" }),
          color: "white",
          pointerEvents: "auto",
          margin: "0 auto",
          boxSizing: "border-box"
        }}>
          {/* Background Gradient - Futuristic Dark → Deep Navy → Black */}
          <div style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            // Nuit profonde ChampionTrackPro + halos data
            background: "linear-gradient(180deg, #0E1528 0%, #090F1F 35%, #050910 100%), radial-gradient(circle at 50% 0%, rgba(0, 224, 255, 0.08) 0%, rgba(0, 0, 0, 0) 55%), radial-gradient(circle at 0% 100%, rgba(74, 103, 255, 0.12) 0%, rgba(0, 0, 0, 0) 60%)",
            zIndex: 0,
            pointerEvents: "none"
          }} />

          {/* ==== BRAND HEADER – CHAMPIONTRACKPRO ==== */}
          <div style={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}>
            <BrandHeader />
          </div>

          {/* Main Content */}
          <div style={{
            position: "relative",
            zIndex: 1,
            flex: 1,
            width: "100%",
            padding: "0 22px 120px 22px",
            overflowY: "auto",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            boxSizing: "border-box"
          }}>
            <div style={{ 
              paddingTop: "60px",
              paddingBottom: "28px",
              width: "100%",
              maxWidth: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              boxSizing: "border-box"
            }}>
              {loading ? (
                <div style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "200px"
                }}>
                  <div style={{
                    fontSize: "16px",
                    color: "#9AA3B2"
                  }}>
                    Loading sessions...
                  </div>
                </div>
              ) : (
                <div style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center"
                }}>
                  {/* NEXT SESSION Section */}
                  {nextSession && (
                    <div style={{
                      marginBottom: "30px",
                      width: "100%",
                      maxWidth: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      boxSizing: "border-box"
                    }}>
                      <div style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "#FFFFFF",
                        marginBottom: "6px",
                        letterSpacing: "0.5px",
                        textTransform: "uppercase",
                        textAlign: "center",
                        width: "100%"
                      }}>
                        NEXT SESSION
                      </div>
                      <div style={{
                        fontSize: "14px",
                        color: "rgba(255,255,255,0.65)",
                        marginBottom: "14px",
                        fontWeight: 500,
                        textAlign: "center",
                        width: "100%"
                      }}>
                        Your upcoming training session.
                      </div>
                      {/* Separator Line - Neon Cyan */}
                      <div style={{
                        height: "2px",
                        width: "40%",
                        margin: "0 auto 18px auto",
                        background: "linear-gradient(90deg, transparent 0%, rgba(0, 224, 255, 0.25) 50%, transparent 100%)",
                        boxShadow: "0 0 6px rgba(0, 224, 255, 0.25)"
                      }} />
                      <div style={{
                        background: "rgba(255, 255, 255, 0.06)",
                        backdropFilter: "blur(22px)",
                        WebkitBackdropFilter: "blur(22px)",
                        border: "1px solid #00E0FF30",
                        borderRadius: "16px",
                        padding: "28px 22px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 10px 26px rgba(0, 0, 0, 0.45), inset 0 0 18px rgba(0, 224, 255, 0.05)",
                        width: "100%",
                        maxWidth: "100%",
                        gap: "20px",
                        margin: "0 auto",
                        minHeight: "100px",
                        boxSizing: "border-box"
                      }}>
                        <div style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          textAlign: "center",
                          width: "100%",
                          justifyContent: "center"
                        }}>
                          <div style={{
                            fontSize: "18px",
                            fontWeight: 700,
                            color: "#FFFFFF",
                            letterSpacing: "0.2px",
                            marginBottom: "8px",
                            textAlign: "center"
                          }}>
                            {nextSession.title}
                          </div>
                          <div style={{
                            fontSize: "14px",
                            color: "rgba(255,255,255,0.8)",
                            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                            fontWeight: 600,
                            letterSpacing: "0.4px",
                            textAlign: "center"
                          }}>
                            {(nextSession as any).timeForNextSession || nextSession.time}
                          </div>
                        </div>
                        <div style={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          width: "100%"
                        }}>
                          {renderQuestionnaireActionWeb(nextSession)}
                        </div>
                      </div>
                    </div>
                  )}

          {/* UPCOMING SESSIONS Section - hidden on Home (Next session only) */}
          {false && upcomingSessions.length > 0 && (
                    <div>
                      <div style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "#FFFFFF",
                        marginBottom: "6px",
                        letterSpacing: "0.5px",
                        textTransform: "uppercase"
                      }}>
                        UPCOMING SESSIONS
                      </div>
                      <div style={{
                        fontSize: "14px",
                        color: "rgba(255,255,255,0.65)",
                        marginBottom: "14px",
                        fontWeight: 500
                      }}>
                        Your next training events.
                      </div>
                      {/* Separator Line - Neon Cyan */}
                      <div style={{
                        height: "2px",
                        width: "40%",
                        margin: "0 auto 18px auto",
                        background: "linear-gradient(90deg, transparent 0%, rgba(0, 224, 255, 0.25) 50%, transparent 100%)",
                        boxShadow: "0 0 6px rgba(0, 224, 255, 0.25)"
                      }} />
                      <div style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "18px"
                      }}>
                        {upcomingSessions.map((session: any, index: number) => (
                          <div
                            key={session.id || index}
                            style={{
                              background: "rgba(255, 255, 255, 0.06)",
                              backdropFilter: "blur(22px)",
                              WebkitBackdropFilter: "blur(22px)",
                              border: "1px solid rgba(0, 224, 255, 0.35)",
                              borderRadius: "18px",
                              padding: "16px 18px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.45), inset 0 0 22px rgba(0, 224, 255, 0.04)",
                              transition: "all 0.3s cubic-bezier(0.4, 0.1, 0.2, 1)"
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = "translateY(-2px)";
                              e.currentTarget.style.boxShadow = "0 12px 40px rgba(0, 0, 0, 0.4), 0 0 30px rgba(0, 234, 255, 0.1), inset 0 0 20px rgba(0, 234, 255, 0.08)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "translateY(0)";
                              e.currentTarget.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(0, 234, 255, 0.05)";
                            }}
                          >
                            <div>
                              <div style={{
                                fontSize: "16px",
                                fontWeight: 700,
                                color: "#FFFFFF",
                                letterSpacing: "0.2px",
                                marginBottom: "4px"
                              }}>
                                {session.title}
                              </div>
                              <div style={{
                                fontSize: "12px",
                                color: "rgba(255,255,255,0.7)",
                                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                                fontWeight: 600,
                                letterSpacing: "0.4px"
                              }}>
                                {session.time}
                              </div>
                            </div>
                            {renderQuestionnaireActionWeb(session)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!nextSession && upcomingSessions.length === 0 && (
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "40px 20px",
                      textAlign: "center"
                    }}>
                      <div style={{
                        fontSize: "18px",
                        fontWeight: "600",
                        color: "#FFFFFF",
                        marginBottom: "8px"
                      }}>
                        No training scheduled
                      </div>
                      <div style={{
                        fontSize: "14px",
                        color: "#9AA3B2"
                      }}>
                        No training is scheduled at the moment. Check the Schedule tab to see all events.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Navigation unifiée pour les athlètes */}
          <UnifiedAthleteNavigation 
            activeTab="Home" 
            onNavigate={handleTabNavigation} 
          />
        </div>
      </MobileViewport>
    );
  }

  // React Native version (unchanged)
  return (
    <LinearGradient
      colors={['#0A0F1A', '#0F1623', '#1A1F2E', '#0D1117', '#000000']}
      style={[styles.container, sanitizedContainerStyle]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Profile */}
        <View style={[styles.header, { paddingHorizontal: headerPadding }]}>
          <View style={[
            styles.headerContent,
            device.isMobile ? styles.headerContentMobile : styles.headerContentDesktop
          ]}>
            <View style={styles.welcomeSection}>
              <Text style={[
                styles.welcomeText,
                { fontSize: getResponsiveFontSize('xxxl', device) }
              ]}>
                WELCOME {userData?.firstName ? userData.firstName.toUpperCase() : 'ATHLETE'}
              </Text>
              <Text style={[
                styles.subtitleText,
                { fontSize: getResponsiveFontSize('md', device) }
              ]}>
                HERE IS YOUR NEXT SESSION.
              </Text>
            </View>
            <View style={styles.profileContainer}>
              {userData?.profileImage ? (
                <Image
                  source={{ uri: userData.profileImage }}
                  style={[
                    styles.profileImage,
                    { 
                      width: device.isMobile ? 36 : 40,
                      height: device.isMobile ? 36 : 40
                    }
                  ]}
                />
              ) : (
                <View style={[
                  styles.profileImage,
                  { 
                    width: device.isMobile ? 36 : 40,
                    height: device.isMobile ? 36 : 40
                  }
                ]}>
                  <Text style={[
                    styles.profileInitial,
                    { fontSize: getResponsiveFontSize('lg', device) }
                  ]}>
                    {userData?.firstName ? userData.firstName.charAt(0).toUpperCase() : 'U'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* NEXT SESSION Section */}
        <View style={[styles.nextSessionSection, { paddingHorizontal: sectionPadding }]}>
          <Text style={[
            styles.nextSessionTitle,
            { fontSize: getResponsiveFontSize('lg', device) }
          ]}>
            NEXT SESSION
          </Text>
          <Text style={[
            styles.nextSessionSubtitle,
            { fontSize: getResponsiveFontSize('sm', device) }
          ]}>
            Your upcoming training session.
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={[
                styles.loadingText,
                { fontSize: getResponsiveFontSize('sm', device) }
              ]}>
                Loading calendar...
              </Text>
            </View>
          ) : nextSession ? (
            <View style={styles.nextSessionCard}>
              <View style={styles.sessionInfo}>
                <Text style={[
                  styles.sessionTitle,
                  { fontSize: getResponsiveFontSize('md', device) }
                ]}>
                  {nextSession.title}
                </Text>
                <Text style={[
                  styles.sessionTime,
                  { fontSize: getResponsiveFontSize('xs', device) }
                ]}>
                  {(nextSession as any).timeForNextSession || nextSession.time}
                </Text>
              </View>
              <View style={styles.sessionAction}>
                {renderQuestionnaireAction(nextSession)}
              </View>
            </View>
          ) : (
            <View style={styles.noSessionsContainer}>
              <Text style={[
                styles.noSessionsText,
                { fontSize: getResponsiveFontSize('md', device) }
              ]}>
                No training scheduled
              </Text>
              <Text style={[
                styles.noSessionsSubtext,
                { fontSize: getResponsiveFontSize('sm', device) }
              ]}>
                No training is scheduled at the moment. Check the Schedule tab to see all events.
              </Text>
            </View>
          )}
        </View>

        {/* UPCOMING SESSIONS Section - hidden on Home (Next session only) */}
        {false && upcomingSessions.length > 0 && (
          <View style={[styles.sessionsSection, { paddingHorizontal: sectionPadding }]}>
            <View style={styles.sectionHeader}>
              <Text style={[
                styles.sectionTitle,
                { fontSize: getResponsiveFontSize('xl', device) }
              ]}>
                UPCOMING SESSIONS
              </Text>
              <Text style={[
                styles.sectionSubtitle,
                { fontSize: getResponsiveFontSize('sm', device) }
              ]}>
                Your next training events.
              </Text>
            </View>
          
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={[
                  styles.loadingText,
                  { fontSize: getResponsiveFontSize('md', device) }
                ]}>
                  Loading sessions...
                </Text>
              </View>
            ) : (
              <View style={[
                styles.sessionsList,
                device.isDesktop && styles.sessionsListDesktop
              ]}>
                {upcomingSessions.map((session, index) => (
                  <View 
                    key={session.id || index} 
                    style={[
                      styles.sessionCard,
                      device.isDesktop && styles.sessionCardDesktop
                    ]}
                  >
                    <View style={styles.sessionInfo}>
                      <Text style={[
                        styles.sessionTime,
                        { fontSize: getResponsiveFontSize('sm', device) }
                      ]}>
                        {session.time}
                      </Text>
                      <Text style={[
                        styles.sessionTitle,
                        { fontSize: getResponsiveFontSize('lg', device) }
                      ]}>
                        {session.title}
                      </Text>
                    </View>
                    <View style={styles.sessionAction}>
                      {renderQuestionnaireAction(session)}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation Bar */}
      {onNavigateToTab && (
        <View style={styles.bottomNav}>
          <Pressable
            style={styles.navItem}
            onPress={() => onNavigateToTab('Home')}
          >
            <View style={[
              styles.navIconContainer,
              activeTab === 'Home' && styles.navIconContainerActive
            ]}>
              <Text style={[
                styles.navIcon,
                activeTab === 'Home' && styles.navIconActive
              ]}>🏠</Text>
            </View>
            <Text style={[
              styles.navLabel,
              activeTab === 'Home' && styles.navLabelActive
            ]}>Home</Text>
            {activeTab === 'Home' && <View style={styles.activeIndicator} />}
          </Pressable>
          <Pressable
            style={styles.navItem}
            onPress={() => onNavigateToTab('Schedule')}
          >
            <View style={[
              styles.navIconContainer,
              activeTab === 'Schedule' && styles.navIconContainerActive
            ]}>
              <Text style={[
                styles.navIcon,
                activeTab === 'Schedule' && styles.navIconActive
              ]}>📅</Text>
            </View>
            <Text style={[
              styles.navLabel,
              activeTab === 'Schedule' && styles.navLabelActive
            ]}>Schedule</Text>
            {activeTab === 'Schedule' && <View style={styles.activeIndicator} />}
          </Pressable>
          <Pressable
            style={styles.navItem}
            onPress={() => onNavigateToTab('Profile')}
          >
            <View style={[
              styles.navIconContainer,
              activeTab === 'Profile' && styles.navIconContainerActive
            ]}>
              <Text style={[
                styles.navIcon,
                activeTab === 'Profile' && styles.navIconActive
              ]}>👤</Text>
            </View>
            <Text style={[
              styles.navLabel,
              activeTab === 'Profile' && styles.navLabelActive
            ]}>Profile</Text>
            {activeTab === 'Profile' && <View style={styles.activeIndicator} />}
          </Pressable>
        </View>
      )}
    </LinearGradient>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
    paddingTop: Platform.OS === 'web' ? 60 : 0,
  },
  
  scrollView: {
    flex: 1,
  },
  
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
  },
  
  header: {
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: tokens.spacing.xxl,
    paddingBottom: tokens.spacing.lg,
    alignItems: 'center',
    width: '100%',
  },
  
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  
  headerContentMobile: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.lg,
    width: '100%',
  },
  
  headerContentDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  
  welcomeSection: {
    flex: 1,
    alignItems: 'center',
  },
  
  welcomeText: {
    fontSize: tokens.fontSizes.xxxl,
    fontWeight: tokens.fontWeights.semibold,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    letterSpacing: 0.5,
    marginBottom: tokens.spacing.sm,
    textShadowColor: 'rgba(0, 234, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    textAlign: 'center',
  },
  
  subtitleText: {
    fontSize: tokens.fontSizes.md,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
    lineHeight: 22,
    textAlign: 'center',
  },
  
  profileContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  profileImage: {
    width: 36,
    height: 36,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.primary,
    borderWidth: 2,
    borderColor: 'rgba(0, 224, 255, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    ...tokens.shadows.glow,
  },
  
  profileInitial: {
    fontSize: tokens.fontSizes.xl,
    fontWeight: tokens.fontWeights.bold,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
  },
  
  nextSessionSection: {
    marginBottom: tokens.spacing.xxl,
    paddingTop: tokens.spacing.lg,
    alignItems: 'center',
  },
  
  nextSessionTitle: {
    fontSize: tokens.fontSizes.lg,
    fontWeight: tokens.fontWeights.bold,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: tokens.spacing.xs,
    textAlign: 'center',
  },
  
  nextSessionSubtitle: {
    fontSize: tokens.fontSizes.sm,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
    marginBottom: tokens.spacing.lg,
    textAlign: 'center',
  },
  
  nextSessionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 18,
    padding: tokens.spacing.lg,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(0, 234, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 32,
    elevation: 10,
    width: '100%',
  },
  
  sessionsSection: {
    marginTop: tokens.spacing.xxl,
    paddingTop: tokens.spacing.lg,
  },
  
  sectionHeader: {
    marginBottom: tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  
  sectionTitle: {
    fontSize: tokens.fontSizes.lg,
    fontWeight: tokens.fontWeights.bold,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: tokens.spacing.xs,
    textAlign: 'center',
  },
  
  sectionSubtitle: {
    fontSize: tokens.fontSizes.sm,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
    textAlign: 'center',
  },
  
  sessionsList: {
    gap: tokens.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  
  sessionsListDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  
  sessionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 18,
    padding: tokens.spacing.md,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(0, 234, 255, 0.3)',
    marginBottom: tokens.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 32,
    elevation: 10,
    width: '100%',
  },
  
  sessionCardDesktop: {
    width: '48%',
    marginBottom: tokens.spacing.lg,
  },
  
  sessionInfo: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
  },
  
  sessionTime: {
    fontSize: tokens.fontSizes.sm,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
    marginBottom: tokens.spacing.xs,
    textAlign: 'center',
  },
  
  sessionTitle: {
    fontSize: tokens.fontSizes.lg,
    fontWeight: tokens.fontWeights.semibold,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    textAlign: 'center',
  },
  
  sessionAction: {
    alignItems: 'center',
    width: '100%',
    marginTop: tokens.spacing.md,
  },
  
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 255, 200, 0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(0, 255, 200, 0.4)',
    shadowColor: '#00FFC8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  
  completedIcon: {
    fontSize: tokens.fontSizes.sm,
    color: '#00FFC8',
    marginRight: 6,
  },
  
  completedText: {
    fontSize: 14,
    color: '#00FFC8',
    fontFamily: tokens.typography.ui,
    fontWeight: tokens.fontWeights.medium,
    letterSpacing: 0.03,
  },
  
  respondButton: {
    position: 'relative',
    backgroundColor: 'transparent',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 0,
    shadowColor: '#00EAFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  
  respondText: {
    fontSize: 13,
    fontWeight: tokens.fontWeights.semibold,
    color: '#FFFFFF',
    fontFamily: tokens.typography.ui,
    letterSpacing: 0.3,
  },
  
  notificationDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 10,
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: tokens.spacing.xxxl,
  },
  
  loadingText: {
    fontSize: tokens.fontSizes.md,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
  },
  
  noSessionsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: tokens.spacing.xxxl,
  },
  
  noSessionsText: {
    fontSize: tokens.fontSizes.lg,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    fontWeight: tokens.fontWeights.medium,
    marginBottom: tokens.spacing.sm,
  },
  
  noSessionsSubtext: {
    fontSize: tokens.fontSizes.sm,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
  },
  
  // Bottom Navigation Bar
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 21, 40, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: Platform.OS === 'ios' ? 20 : 12,
    paddingHorizontal: tokens.spacing.lg,
    height: Platform.OS === 'ios' ? 88 : 68,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    zIndex: 1000,
    ...tokens.shadows.card,
  },
  
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.xs,
    gap: 4,
  },
  
  navIconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  
  navIconContainerActive: {
    transform: [{ scale: 1.1 }],
  },
  
  navIcon: {
    fontSize: 24,
  },
  
  navIconActive: {
    // Shadow effect handled by container
  },
  
  navLabel: {
    fontSize: 12,
    fontWeight: tokens.fontWeights.medium,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
  },
  
  navLabelActive: {
    color: tokens.colors.accentCyan,
    fontWeight: tokens.fontWeights.semibold,
  },
  
  activeIndicator: {
    position: 'absolute',
    bottom: -10,
    left: '50%',
    marginLeft: -16,
    width: 32,
    height: 3,
    backgroundColor: tokens.colors.accentCyan,
    borderRadius: 2,
    ...tokens.shadows.glow,
  },
  
  // Questionnaire state badges
  comingSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 224, 255, 0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(0, 224, 255, 0.45)',
    shadowColor: '#00E0FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  
  comingSoonIcon: {
    fontSize: tokens.fontSizes.sm,
    marginRight: 8,
    color: '#8DEBFF',
  },
  
  comingSoonText: {
    fontSize: 14,
    color: '#E3FBFF',
    fontFamily: tokens.typography.ui,
    fontWeight: tokens.fontWeights.medium,
    letterSpacing: 0.03,
  },
  
  expiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
  },
  
  expiredIcon: {
    fontSize: tokens.fontSizes.sm,
    marginRight: 6,
  },
  
  expiredText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontFamily: tokens.typography.ui,
    fontWeight: tokens.fontWeights.medium,
    letterSpacing: 0.03,
  },
});

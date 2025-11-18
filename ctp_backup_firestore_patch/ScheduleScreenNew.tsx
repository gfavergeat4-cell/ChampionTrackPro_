import React, { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions, Platform, ScrollView } from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { collection, getDocs, limit, query } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { tokens } from "../theme/tokens";
import { useDevice } from "../hooks/useDevice";
import { getResponsiveSpacing, getResponsiveFontSize, getMainContainerStyle } from "../utils/responsive";
import { getEventsForDay, getEventsForWeek, getEventsForMonth } from "../lib/scheduleQueries";
import { DateTime } from "luxon";
import { toJSDate } from "../utils/time";
import { auth, db } from "../lib/firebase";
import { getApp } from "firebase/app";
import { resolveAthleteTeamId } from "../lib/teamContext";

interface ScheduleScreenProps {
  onRespond?: (sessionId: string, eventData?: any) => void;
}

export default function ScheduleScreen({ onRespond }: ScheduleScreenProps) {
  const [activeTab, setActiveTab] = useState('Day');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const device = useDevice();
  const safeSelectedDateForHeader = toJSDate(selectedDate);
  const headerDisplayDate = DateTime.fromJSDate(safeSelectedDateForHeader)
    .setLocale('en')
    .toFormat('cccc d LLLL');

  // Load events for the selected date
  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);
        setEvents([]);

        const safeSelectedDate = toJSDate(selectedDate);

        const currentUser =
          auth.currentUser ??
          (await new Promise((resolve) => {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
              unsubscribe();
              resolve(user ?? null);
            });
          }));

        if (!currentUser) {
          console.log("[Schedule] No authenticated user");
          setLoading(false);
          return;
        }

        const teamId = await resolveAthleteTeamId(db, currentUser.uid);
        if (!teamId) {
          console.log('[READY]', { hasUser: !!currentUser, teamId: null });
          setLoading(false);
          return;
        }
        console.log('[FB][PROJECT][ATHLETE]', getApp()?.options?.projectId);
        console.log('[READY]', { hasUser: !!currentUser, teamId });
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

        let eventsData = [];
        console.log(
          `[Schedule] Loading events for team=${teamId} tab=${activeTab} date=${safeSelectedDate.toString()} user=${currentUser.uid}`
        );
        if (activeTab === 'Day') {
          eventsData = await getEventsForDay(teamId, safeSelectedDate, currentUser.uid);
        } else if (activeTab === 'Week') {
          eventsData = await getEventsForWeek(teamId, safeSelectedDate, currentUser.uid);
        } else {
          const monthAnchor = new Date(safeSelectedDate.getFullYear(), safeSelectedDate.getMonth(), 1);
          eventsData = await getEventsForMonth(teamId, monthAnchor, currentUser.uid);
        }

        setEvents(eventsData);
        console.log('[ATHLETE] training snapshot size (client):', eventsData.length);
        console.log('[UI][MAPPED_FIRST]', eventsData.slice(0, 3));

      } catch (error) {
        console.error("Error loading events:", error);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, [activeTab, selectedDate]);

  const normalizeEvent = (event: any) => {
    const displayTz =
      event?.displayTz ||
      event?.timeZone ||
      event?.tzid ||
      'Europe/Paris';
    const startDateValue = event?.startDate instanceof Date ? event.startDate : null;
    const endDateValue = event?.endDate instanceof Date ? event.endDate : null;

    if (!startDateValue) {
      console.log('[UI][WARN] normalizeEvent startDate malformed', {
        id: event?.id,
        title: event?.title,
        displayTz,
      });
      return null;
    }

    const startDateTime = DateTime.fromJSDate(startDateValue, {
      zone: 'utc',
    }).setZone(displayTz);
    const endDateTime = endDateValue
      ? DateTime.fromJSDate(endDateValue, {
          zone: 'utc',
        }).setZone(displayTz)
      : startDateTime;

    return {
      ...event,
      title: event?.title || event?.summary || 'Training',
      startDateTime,
      endDateTime,
      displayTz,
      hasTime: Boolean(startDateTime && endDateTime),
    };
  };

  const renderDayView = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading events...</Text>
        </View>
      );
    }

    const normalizedEvents = events
      .map(normalizeEvent)
      .filter(Boolean) as Array<any>;

    normalizedEvents.slice(0, 3).forEach((event) => {
      console.log(
        `[UI][CHECK][Schedule][Day] id=${event.id} millis=${event.startDateTime?.toMillis()} tz=${event.displayTz} local=${event.startDateTime?.toFormat('HH:mm')}`
      );
    });

    if (normalizedEvents.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No events on this day</Text>
        </View>
      );
    }

    return (
      <View style={styles.eventsList}>
        {normalizedEvents.map((event, index) => (
          <View key={event.id || index} style={styles.eventCard}>
            <View style={styles.eventInfo}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventTime}>
                {event.startDateTime.toFormat('HH:mm')} - {event.endDateTime.toFormat('HH:mm')}
              </Text>
            </View>
            <View style={styles.eventAction}>
              {event.hasResponse ? (
                <View style={styles.completedBadge}>
                  <Text style={styles.completedIcon}>✓</Text>
                  <Text style={styles.completedText}>Completed</Text>
                </View>
              ) : (
                <Pressable
                  style={styles.respondButton}
                  onPress={() => onRespond?.(event.id, event)}
                >
                  <Text style={styles.respondText}>Respond</Text>
                  <View style={styles.notificationDot} />
                </Pressable>
              )}
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderWeekView = () => {
    // Group events by day
    const normalizedEvents = events
      .map(normalizeEvent)
      .filter(Boolean) as Array<any>;

    const eventsByDay: Record<string, any[]> = {};
    normalizedEvents.forEach((event) => {
      const dayKey = event.startDateTime.toISODate();
      if (!eventsByDay[dayKey]) {
        eventsByDay[dayKey] = [];
      }
      eventsByDay[dayKey].push(event);
    });

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    return (
      <ScrollView style={styles.weekContainer}>
        {days.map((day, index) => {
          const startOfWeek = DateTime.fromJSDate(toJSDate(selectedDate)).startOf('week');
          const dayDate = startOfWeek.plus({ days: index });
          const dayEvents = eventsByDay[dayDate.toISODate()] || [];
          
          return (
            <View key={day} style={styles.dayColumn}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayName}>{day}</Text>
                <Text style={styles.dayDate}>{dayDate.day}</Text>
              </View>
              <View style={styles.dayEvents}>
                {dayEvents.length === 0 ? (
                  <Text style={styles.noEventsText}>No events</Text>
                ) : (
                  dayEvents.map((event, eventIndex) => (
                    <View key={event.id || eventIndex} style={styles.weekEventCard}>
                      <Text style={styles.weekEventTitle}>{event.title}</Text>
                      <Text style={styles.weekEventTime}>
                        {event.startDateTime.toFormat('HH:mm')} - {event.endDateTime.toFormat('HH:mm')}
                      </Text>
                      {event.hasResponse ? (
                        <View style={styles.weekCompletedBadge}>
                          <Text style={styles.weekCompletedText}>✓ Completed</Text>
                        </View>
                      ) : (
                        <Pressable
                          style={styles.weekRespondButton}
                          onPress={() => onRespond?.(event.id, event)}
                        >
                          <Text style={styles.weekRespondText}>Respond</Text>
                        </Pressable>
                      )}
                    </View>
                  ))
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const renderMonthView = () => {
    // Simple month view with dots for days with events
    const normalizedEvents = events
      .map(normalizeEvent)
      .filter(Boolean) as Array<any>;

    const monthDate = DateTime.fromJSDate(toJSDate(selectedDate));
    const daysInMonth = monthDate.daysInMonth;

    const daysWithEvents = new Set<number>();
    normalizedEvents.forEach((event) => {
      if (event.startDateTime.hasSame(monthDate, 'month')) {
        daysWithEvents.add(event.startDateTime.day);
      }
    });

    return (
      <View style={styles.monthContainer}>
        <Text style={styles.monthTitle}>
          {monthDate.setLocale('en').toFormat('LLLL yyyy')}
        </Text>
        <View style={styles.monthGrid}>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
            <View key={day} style={styles.monthDay}>
              <Text style={[
                styles.monthDayText,
                day === DateTime.now().setZone('Europe/Paris').day &&
                DateTime.now().setZone('Europe/Paris').month === monthDate.month &&
                DateTime.now().setZone('Europe/Paris').year === monthDate.year
                  ? styles.monthDayTextToday : {}
              ]}>
                {day}
              </Text>
              {daysWithEvents.has(day) && <View style={styles.monthEventDot} />}
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <LinearGradient
      colors={[tokens.colors.bg, tokens.colors.bgSecondary]}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Schedule</Text>
        <Text style={styles.headerDate}>{headerDisplayDate}</Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {['Day', 'Week', 'Month'].map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[
              styles.tabText,
              activeTab === tab && styles.activeTabText
            ]}>
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'Day' && renderDayView()}
        {activeTab === 'Week' && renderWeekView()}
        {activeTab === 'Month' && renderMonthView()}
      </View>
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
  
  header: {
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: tokens.spacing.xxl,
    paddingBottom: tokens.spacing.lg,
    alignItems: 'center',
  },
  
  headerTitle: {
    fontSize: tokens.fontSizes.xxxl,
    fontWeight: tokens.fontWeights.bold,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    marginBottom: tokens.spacing.sm,
  },
  
  headerDate: {
    fontSize: tokens.fontSizes.md,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
  },
  
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: tokens.spacing.xl,
    marginBottom: tokens.spacing.xl,
  },
  
  tab: {
    flex: 1,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  
  activeTab: {
    borderBottomColor: tokens.colors.accentCyan,
  },
  
  tabText: {
    fontSize: tokens.fontSizes.md,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
    fontWeight: tokens.fontWeights.medium,
  },
  
  activeTabText: {
    color: tokens.colors.accentCyan,
    fontWeight: tokens.fontWeights.semibold,
  },
  
  content: {
    flex: 1,
    paddingHorizontal: tokens.spacing.xl,
  },
  
  // Day View Styles
  eventsList: {
    gap: tokens.spacing.lg,
  },
  
  eventCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.surfaceHover,
    ...tokens.shadows.card,
  },
  
  eventInfo: {
    flex: 1,
  },
  
  eventTitle: {
    fontSize: tokens.fontSizes.lg,
    fontWeight: tokens.fontWeights.semibold,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    marginBottom: tokens.spacing.xs,
  },
  
  eventTime: {
    fontSize: tokens.fontSizes.sm,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
  },
  
  eventAction: {
    marginLeft: tokens.spacing.lg,
  },
  
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceHover,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.success,
  },
  
  completedIcon: {
    fontSize: tokens.fontSizes.sm,
    color: tokens.colors.success,
    marginRight: tokens.spacing.xs,
  },
  
  completedText: {
    fontSize: tokens.fontSizes.sm,
    color: tokens.colors.success,
    fontFamily: tokens.typography.ui,
    fontWeight: tokens.fontWeights.medium,
  },
  
  respondButton: {
    position: 'relative',
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    ...tokens.shadows.button,
  },
  
  respondText: {
    fontSize: tokens.fontSizes.sm,
    fontWeight: tokens.fontWeights.semibold,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
  },
  
  notificationDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.danger,
  },
  
  // Week View Styles
  weekContainer: {
    flex: 1,
  },
  
  dayColumn: {
    marginBottom: tokens.spacing.xl,
  },
  
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
    paddingBottom: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.surfaceHover,
  },
  
  dayName: {
    fontSize: tokens.fontSizes.lg,
    fontWeight: tokens.fontWeights.semibold,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
  },
  
  dayDate: {
    fontSize: tokens.fontSizes.md,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
  },
  
  dayEvents: {
    gap: tokens.spacing.md,
  },
  
  weekEventCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceHover,
  },
  
  weekEventTitle: {
    fontSize: tokens.fontSizes.md,
    fontWeight: tokens.fontWeights.medium,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    marginBottom: tokens.spacing.xs,
  },
  
  weekEventTime: {
    fontSize: tokens.fontSizes.sm,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
    marginBottom: tokens.spacing.sm,
  },
  
  weekCompletedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.success,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.sm,
  },
  
  weekCompletedText: {
    fontSize: tokens.fontSizes.xs,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    fontWeight: tokens.fontWeights.medium,
  },
  
  weekRespondButton: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.sm,
  },
  
  weekRespondText: {
    fontSize: tokens.fontSizes.xs,
    fontWeight: tokens.fontWeights.semibold,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
  },
  
  // Month View Styles
  monthContainer: {
    flex: 1,
  },
  
  monthTitle: {
    fontSize: tokens.fontSizes.xl,
    fontWeight: tokens.fontWeights.semibold,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    textAlign: 'center',
    marginBottom: tokens.spacing.xl,
  },
  
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  
  monthDay: {
    width: (width - tokens.spacing.xl * 2) / 7 - tokens.spacing.sm,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
    position: 'relative',
  },
  
  monthDayText: {
    fontSize: tokens.fontSizes.sm,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
  },
  
  monthDayTextToday: {
    color: tokens.colors.accentCyan,
    fontWeight: tokens.fontWeights.semibold,
  },
  
  monthEventDot: {
    position: 'absolute',
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.accentCyan,
  },
  
  // Common Styles
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
  
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: tokens.spacing.xxxl,
  },
  
  emptyText: {
    fontSize: tokens.fontSizes.lg,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
  },
  
  noEventsText: {
    fontSize: tokens.fontSizes.sm,
    color: tokens.colors.textMuted,
    fontFamily: tokens.typography.ui,
    fontStyle: 'italic',
  },
});

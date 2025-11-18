// src/services/notifications.ts
import { Platform } from 'react-native';
import { DateTime } from 'luxon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventWithResponse } from '@/lib/scheduleQueries';

// Import conditionnel de expo-notifications (non disponible sur web)
let Notifications: any = null;
if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
  } catch (error) {
    console.warn('[NOTIF] expo-notifications not available:', error);
  }
}

const STORAGE_KEY = 'ctp_scheduled_questionnaire_notifications';

type Stored = Record<string, boolean>; // trainingId -> scheduled

/**
 * Planifie une notification locale pour rappeler à l'athlète de remplir le questionnaire
 * 30 minutes après la fin du training
 */
export async function scheduleQuestionnaireNotification(event: EventWithResponse) {
  // Ne pas planifier de notifications sur le web
  if (Platform.OS === 'web') {
    console.log('[NOTIF] Notifications not available on web platform');
    return;
  }

  if (!Notifications) {
    console.log('[NOTIF] expo-notifications not available');
    return;
  }

  if (!event.endMillis || !event.id) {
    console.log('[NOTIF] Cannot schedule: missing endMillis or id', { eventId: event.id });
    return;
  }

  try {
    // Charger le cache des notifications déjà planifiées
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const cache: Stored = raw ? JSON.parse(raw) : {};
    
    if (cache[event.id]) {
      console.log('[NOTIF] Already scheduled for training', event.id);
      return; // Déjà planifiée
    }

    // Calculer l'heure d'ouverture (30 min après la fin)
    const openAt = DateTime.fromMillis(event.endMillis, { zone: 'utc' })
      .plus({ minutes: 30 });

    // Vérifier que la date n'est pas passée
    if (openAt < DateTime.utc()) {
      console.log('[NOTIF] Too late to schedule for training', event.id);
      return; // Trop tard
    }

    // Planifier la notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Time to fill your questionnaire",
        body: `Please log your feelings for ${event.title}.`,
        data: { trainingId: event.id, teamId: event.teamId },
        sound: true,
      },
      trigger: openAt.toJSDate(),
    });

    // Mettre à jour le cache
    cache[event.id] = true;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));

    console.log('[NOTIF] Scheduled notification for training', event.id, 'at', openAt.toISO());
  } catch (error) {
    console.error('[NOTIF] Error scheduling notification', error);
  }
}

/**
 * Annule une notification planifiée pour un training
 */
export async function cancelQuestionnaireNotification(trainingId: string) {
  // Ne pas planifier de notifications sur le web
  if (Platform.OS === 'web') {
    return;
  }

  try {
    // Note: expo-notifications ne permet pas d'annuler facilement une notification
    // par ID. On peut seulement marquer dans le cache qu'elle ne doit plus être planifiée.
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const cache: Stored = raw ? JSON.parse(raw) : {};
    delete cache[trainingId];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    console.log('[NOTIF] Cancelled notification for training', trainingId);
  } catch (error) {
    console.error('[NOTIF] Error cancelling notification', error);
  }
}

/**
 * Planifie les notifications pour tous les trainings avec questionnaire "not_open_yet"
 */
export async function scheduleNotificationsForPendingQuestionnaires(events: EventWithResponse[]) {
  for (const event of events) {
    if (event.questionnaireStatus === 'not_open_yet' && !event.response?.status) {
      await scheduleQuestionnaireNotification(event);
    }
  }
}



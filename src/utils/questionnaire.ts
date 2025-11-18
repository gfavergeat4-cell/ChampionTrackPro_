// src/utils/questionnaire.ts
import { DateTime } from 'luxon';

export type QuestionnaireWindow = {
  openAt: DateTime;   // when the form becomes available
  closeAt: DateTime;  // when it closes
};

const OPEN_DELAY_MINUTES = 30;
const AVAILABLE_HOURS = 5;

/**
 * Calcule la fenêtre temporelle du questionnaire à partir de l'heure de fin du training
 * @param endMillis - Heure de fin du training en millisecondes UTC
 * @returns Fenêtre avec openAt et closeAt
 */
export function getQuestionnaireWindowFromEnd(
  endMillis: number
): QuestionnaireWindow {
  const end = DateTime.fromMillis(endMillis, { zone: 'utc' });
  const openAt = end.plus({ minutes: OPEN_DELAY_MINUTES });
  const closeAt = openAt.plus({ hours: AVAILABLE_HOURS });
  return { openAt, closeAt };
}

export type QuestionnaireStatus =
  | 'not_open_yet'
  | 'open'
  | 'closed'
  | 'completed';

/**
 * Nouveau type pour les états du questionnaire (noms simplifiés)
 */
export type QuestionnaireState =
  | 'respond'      // Questionnaire ouvert et disponible (bleu, cliquable) - 0 min < (now - end) ≤ 30 min
  | 'comingSoon'   // Training futur ou en cours (gris, désactivé) - now < endMillis
  | 'expired'      // Questionnaire fermé, fenêtre dépassée (gris foncé, désactivé) - now > end + 5h
  | 'completed';   // Questionnaire déjà répondu (vert, désactivé)

/**
 * Calcule le statut du questionnaire pour un training donné
 * @param endMillis - Heure de fin du training en millisecondes UTC (null si pas de fin)
 * @param responseCompleted - Si l'athlète a déjà complété le questionnaire
 * @param now - DateTime actuelle (par défaut: maintenant UTC)
 * @returns Statut du questionnaire (ancien format pour compatibilité)
 */
export function computeQuestionnaireStatus(
  endMillis: number | null,
  responseCompleted: boolean,
  now: DateTime = DateTime.utc()
): QuestionnaireStatus {
  if (responseCompleted) return 'completed';
  if (!endMillis) return 'closed';

  const nowMillis = now.toMillis();
  const endMillisNum = typeof endMillis === 'number' ? endMillis : (endMillis ? Number(endMillis) : null);

  // Si l'entraînement n'est pas encore terminé, le questionnaire n'est pas disponible
  if (nowMillis < endMillisNum) {
    return 'closed'; // L'entraînement n'est pas encore terminé
  }

  const { openAt, closeAt } = getQuestionnaireWindowFromEnd(endMillisNum);
  const openAtMillis = openAt.toMillis();
  const closeAtMillis = closeAt.toMillis();

  // Le questionnaire s'ouvre 30 minutes après la fin de l'entraînement
  if (nowMillis < openAtMillis) return 'not_open_yet';
  if (nowMillis > closeAtMillis) return 'closed';
  return 'open';
}

/**
 * Calcule l'état du questionnaire pour un training donné (nouveau format)
 * @param trainingEndTime - Heure de fin du training en millisecondes UTC (null si pas de fin)
 * @param hasResponded - Si l'athlète a déjà répondu au questionnaire
 * @param now - DateTime actuelle (par défaut: maintenant UTC)
 * @param trainingStartTime - Heure de début du training en millisecondes UTC (optionnel, pour détecter les trainings futurs)
 * @returns État du questionnaire ('respond', 'comingSoon', 'expired', 'completed')
 */
export function getQuestionnaireState(
  trainingEndTime: number | null,
  hasResponded: boolean,
  now: DateTime = DateTime.utc(),
  trainingStartTime?: number | null
): QuestionnaireState {
  // État 4 : Completed - Si l'utilisateur a déjà répondu, le questionnaire est complété
  if (hasResponded) {
    return 'completed';
  }

  // Si pas d'heure de fin, le questionnaire est expiré
  if (!trainingEndTime) {
    return 'expired';
  }

  const nowMillis = now.toMillis();
  
  // Normaliser trainingEndTime en nombre
  let endMillisNum: number | null = null;
  if (trainingEndTime !== null && trainingEndTime !== undefined) {
    if (typeof trainingEndTime === 'number') {
      endMillisNum = trainingEndTime;
    } else {
      endMillisNum = Number(trainingEndTime);
    }
  }
  
  // Vérifier que endMillisNum est valide
  if (endMillisNum === null || isNaN(endMillisNum) || endMillisNum <= 0) {
    console.warn("[QUESTIONNAIRE][WARN] invalid trainingEndTime in getQuestionnaireState", { trainingEndTime, endMillisNum });
    return 'expired';
  }

  // État 2 : Coming Soon - Training futur ou en cours (nowMillis < endMillis)
  if (nowMillis < endMillisNum) {
    return 'comingSoon';
  }

  // Calculer les fenêtres temporelles
  const thirtyMinutesInMs = 30 * 60 * 1000; // 30 minutes en millisecondes
  const fiveHoursInMs = 5 * 60 * 60 * 1000; // 5 heures en millisecondes

  // État 1 : Respond - Training terminé ET 0 min < (nowMillis - endMillis) ≤ 30 minutes
  // Condition : endMillis < nowMillis <= endMillis + 30 min
  const timeSinceEnd = nowMillis - endMillisNum;
  if (timeSinceEnd > 0 && timeSinceEnd <= thirtyMinutesInMs) {
    return 'respond';
  }

  // État 3 : Expired - Fenêtre dépassée (nowMillis > endMillis + 5h)
  // Note: Selon les règles, la fenêtre de réponse est de 0-30 min après la fin
  // Au-delà de 30 min, c'est expiré. Mais l'utilisateur mentionne "> 5h", donc on garde cette logique.
  if (timeSinceEnd > fiveHoursInMs) {
    return 'expired';
  }

  // Entre 30 min et 5h après la fin, c'est aussi expiré (fenêtre de réponse fermée)
  if (timeSinceEnd > thirtyMinutesInMs) {
    return 'expired';
  }

  // Par défaut, expiré
  return 'expired';
}



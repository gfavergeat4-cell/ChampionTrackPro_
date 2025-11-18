import IcalExpander from 'ical-expander';
import { DateTime } from 'luxon';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  query,
  where,
  deleteField,
} from 'firebase/firestore';
import { db } from './firebase';

export interface ICSImportResult {
  success: boolean;
  message: string;
  importedCount: number;
  updatedCount: number;
  removedCount: number;
  errors: string[];
}

interface NormalizedTraining {
  docId: string;
  title: string;
  summary: string;
  description: string | null;
  location: string | null;
  source: string;
  sourceUid: string;
  startUtc: Timestamp;
  endUtc: Timestamp;
  displayTz: string;
  originalTzid: string | null;
  calendarTz: string | null;
  hasUtcSuffix: boolean;
  players: string[];
  deepLink: string;
  debug?: {
    rawDtStart?: string;
    eventTzid?: string | null;
    calendarTz?: string | null;
    hasUtc?: boolean;
  };
}

const WINDOW_PAST_DAYS = 1;
const WINDOW_FUTURE_DAYS = 60;
const CLEANUP_MARGIN_DAYS = 2;
const MAX_ITERATIONS = 2000;

function sanitizeId(input: string): string {
  return input.replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 80);
}

function extractCalendarTimezone(icsContent: string): string | null {
  const match = icsContent.match(/^X-WR-TIMEZONE:(.+)$/im);
  if (match) {
    return match[1].trim();
  }
  return null;
}

function resolveDisplayTimezone(
  start: any,
  component: any,
  calendarTz: string | null,
  defaultTz: string
): { displayTz: string; eventTz?: string | null; paramTz?: string | null; isUtc: boolean } {
  let eventTz: string | null = null;
  let paramTz: string | null = null;
  let isUtc = false;

  if (!start) {
    const fallback =
      (calendarTz && calendarTz !== 'UTC' && calendarTz !== 'Etc/UTC' ? calendarTz : null) ||
      (defaultTz && defaultTz !== 'UTC' && defaultTz !== 'Etc/UTC' ? defaultTz : null) ||
      'Europe/Paris';
    return { displayTz: fallback, eventTz, paramTz, isUtc };
  }

  const zoneTz =
    (start.zone && start.zone.tzid) ||
    start.timezone ||
    start.tzid ||
    null;

  if (zoneTz && zoneTz !== 'floating') {
    if (zoneTz === 'UTC' || zoneTz === 'Etc/UTC') {
      isUtc = true;
    } else {
      eventTz = zoneTz;
    }
  }

  try {
    const dtstartProp = component?.getFirstProperty?.('dtstart');
    paramTz = dtstartProp?.getParameter?.('tzid') ?? null;
    if (paramTz && paramTz !== 'floating' && paramTz !== 'UTC' && paramTz !== 'Etc/UTC') {
      eventTz = paramTz;
    }
  } catch (error) {
    console.warn('⚠️ Unable to resolve tzid from component', error);
  }

  let displayTz =
    (eventTz && eventTz !== 'UTC' && eventTz !== 'Etc/UTC' ? eventTz : null) ||
    (calendarTz && calendarTz !== 'UTC' && calendarTz !== 'Etc/UTC' ? calendarTz : null) ||
    (defaultTz && defaultTz !== 'UTC' && defaultTz !== 'Etc/UTC' ? defaultTz : null) ||
    'Europe/Paris';

  if ((displayTz === 'UTC' || displayTz === 'Etc/UTC') && defaultTz && defaultTz !== 'UTC' && defaultTz !== 'Etc/UTC') {
    displayTz = defaultTz;
  }

  if ((displayTz === 'UTC' || displayTz === 'Etc/UTC') && calendarTz && calendarTz !== 'UTC' && calendarTz !== 'Etc/UTC') {
    displayTz = calendarTz;
  }

  if (displayTz === 'UTC' || displayTz === 'Etc/UTC') {
    displayTz = 'Europe/Paris';
  }

  return { displayTz, eventTz, paramTz, isUtc };
}

function buildDocId(sourceUid: string, startUtcMillis: number): string {
  const base = sanitizeId(sourceUid || 'event');
  return `${base}_${startUtcMillis}`;
}

function isAllDay(start: any): boolean {
  try {
    return Boolean(start?.isDate);
  } catch {
    return false;
  }
}

function toUtcMillis(
  icalString: string | null,
  tzHint: string | null,
  fallback: any,
  calendarTz: string | null,
  defaultTz: string,
  hasZ: boolean
): number | null {
  const tzCandidate =
    (tzHint && tzHint !== 'floating' ? tzHint : null) ||
    (calendarTz && calendarTz !== 'UTC' && calendarTz !== 'Etc/UTC'
      ? calendarTz
      : null) ||
    (defaultTz && defaultTz !== 'UTC' && defaultTz !== 'Etc/UTC'
      ? defaultTz
      : null) ||
    'Europe/Paris';

  if (icalString) {
    const cleaned = icalString.trim();
    const zone = hasZ ? 'utc' : tzCandidate;
    const parsed = DateTime.fromISO(cleaned, { zone });
    if (parsed.isValid) {
      return parsed.toUTC().toMillis();
    }
  }

  if (fallback?.toJSDate) {
    const date = fallback.toJSDate();
    if (date instanceof Date && !Number.isNaN(date.getTime())) {
      const luxon = DateTime.fromJSDate(date, {
        zone: hasZ ? 'utc' : tzCandidate,
      }).toUTC();
      if (luxon.isValid) {
        return luxon.toMillis();
      }
    }
  }

  return null;
}

export async function importICSToFirestore({
  teamId,
  icsText,
  source = 'google',
  defaultTimeZone = 'Europe/Paris',
}: {
  teamId: string;
  icsText: string;
  source?: string;
  defaultTimeZone?: string;
}): Promise<ICSImportResult> {
  const trainingsRef = collection(db, 'teams', teamId, 'trainings');
  const nowUtc = DateTime.utc();
  const windowStart = nowUtc.minus({ days: WINDOW_PAST_DAYS });
  const windowEnd = nowUtc.plus({ days: WINDOW_FUTURE_DAYS });
  const cleanupThreshold = nowUtc.minus({ days: CLEANUP_MARGIN_DAYS });

  let importedCount = 0;
  let updatedCount = 0;
  let removedCount = 0;
  const errors: string[] = [];
  let loggedSampleDebug = false;

  try {
    const calendarTz = extractCalendarTimezone(icsText);
    if (calendarTz) {
      console.log(`[ICS][DEBUG] Calendar header timezone=${calendarTz}`);
    } else {
      console.log('[ICS][DEBUG] Calendar header timezone=none');
    }

    const icalExpander = new IcalExpander({
      ics: icsText,
      skipInvalidDates: true,
      maxIterations: MAX_ITERATIONS,
    });

    const expansion = icalExpander.between(
      windowStart.toJSDate(),
      windowEnd.toJSDate()
    );

    const instances = [
      ...(expansion.events || []).map((event) => ({
        event,
        startDate: event.startDate,
        endDate: event.endDate,
      })),
      ...(expansion.occurrences || []).map((occurrence) => ({
        event: occurrence.item,
        startDate: occurrence.startDate,
        endDate: occurrence.endDate,
      })),
    ];

    const normalizedEvents: NormalizedTraining[] = [];

    for (const instance of instances) {
      try {
        const { event, startDate, endDate } = instance;
        if (!startDate || !endDate) {
          console.warn('⚠️ Ignoring event without start/end', event?.uid);
          continue;
        }

        if (isAllDay(startDate) || isAllDay(endDate)) {
          console.log('ℹ️ Skipping all-day event', event?.uid);
          continue;
        }

        const dtstartProp =
          event?.component?.getFirstProperty?.('dtstart') ?? null;
        const dtstartString =
          dtstartProp?.toICALString?.() ?? dtstartProp?.toString?.() ?? '';
        const dtstartHasZ =
          typeof dtstartString === 'string'
            ? /Z$/i.test(dtstartString.trim())
            : false;
        const startZoneTzid =
          startDate?.zone &&
          typeof startDate.zone.tzid === 'string' &&
          startDate.zone.tzid !== 'floating'
            ? startDate.zone.tzid
            : null;

        const {
          displayTz,
          eventTz,
          paramTz,
          isUtc,
        } = resolveDisplayTimezone(
          startDate,
          event?.component,
          calendarTz,
          defaultTimeZone
        );

        const dtendProp =
          event?.component?.getFirstProperty?.('dtend') ?? null;
        const dtendString =
          dtendProp?.toICALString?.() ?? dtendProp?.toString?.() ?? '';
        const dtendHasZ =
          typeof dtendString === 'string'
            ? /Z$/i.test(dtendString.trim())
            : false;

        const primaryTzHint = paramTz || eventTz || startZoneTzid || null;

        const startUtcMillis = toUtcMillis(
          dtstartString,
          primaryTzHint,
          startDate,
          calendarTz,
          defaultTimeZone,
          dtstartHasZ || isUtc
        );
        const endUtcMillis = toUtcMillis(
          dtendString,
          primaryTzHint,
          endDate,
          calendarTz,
          defaultTimeZone,
          dtendHasZ || isUtc
        );

        if (
          startUtcMillis === null ||
          endUtcMillis === null ||
          Number.isNaN(startUtcMillis) ||
          Number.isNaN(endUtcMillis)
        ) {
          console.warn('⚠️ Invalid start/end for event', event?.uid);
          continue;
        }

        const sourceUid =
          event?.uid ||
          event?.component?.getFirstPropertyValue?.('uid') ||
          sanitizeId(event?.summary || 'event');

        const title =
          event?.summary ||
          event?.component?.getFirstPropertyValue?.('summary') ||
          'Training';

        const description =
          event?.description ||
          event?.component?.getFirstPropertyValue?.('description') ||
          null;

        const location =
          event?.location ||
          event?.component?.getFirstPropertyValue?.('location') ||
          null;

        const docId = buildDocId(sourceUid, startUtcMillis);

        const training: NormalizedTraining = {
          docId,
          title,
          summary: title,
          description,
          location,
          source,
          sourceUid,
          startUtc: Timestamp.fromMillis(startUtcMillis),
          endUtc: Timestamp.fromMillis(endUtcMillis),
          displayTz,
          originalTzid: paramTz || eventTz || startZoneTzid || null,
          calendarTz: calendarTz || null,
          hasUtcSuffix: dtstartHasZ || isUtc,
          players: [],
          deepLink: `/questionnaire?trainingId=${docId}`,
          debug: {
            rawDtStart: dtstartString,
            eventTzid: paramTz || eventTz || startZoneTzid || null,
            calendarTz: calendarTz || null,
            hasUtc: dtstartHasZ || isUtc,
          },
        };

        normalizedEvents.push(training);

        if (!loggedSampleDebug) {
          const eventZoneForLog =
            paramTz || eventTz || startZoneTzid || calendarTz || 'none';
          const startUtcIso = DateTime.fromMillis(startUtcMillis, {
            zone: 'utc',
          }).toISO();
          const endUtcIso = DateTime.fromMillis(endUtcMillis, {
            zone: 'utc',
          }).toISO();
          const hasUtc = dtstartHasZ || isUtc;
          const displayPreview = DateTime.fromMillis(startUtcMillis, {
            zone: 'utc',
          })
            .setZone(displayTz)
            .toFormat('dd MMM HH:mm');
          console.log(
            `[ICS][DEBUG] headerTZ=${calendarTz || 'none'}, eventTZID=${eventZoneForLog}, hasZ=${hasUtc}, displayTz=${displayTz}`
          );
          console.log(
            `[ICS][DEBUG] startUtcSaved=${startUtcIso}, endUtcSaved=${endUtcIso}, localPreview=${displayPreview}`
          );
          loggedSampleDebug = true;
        }
      } catch (eventError) {
        console.error('❌ Error normalizing event:', eventError);
        errors.push(
          eventError instanceof Error ? eventError.message : String(eventError)
        );
      }
    }

    for (const training of normalizedEvents) {
      try {
        const docRef = doc(trainingsRef, training.docId);
        const existingSnap = await getDoc(docRef);
        const existingData = existingSnap.data() || {};
        const players = Array.isArray(existingData.players)
          ? (existingData.players as string[])
          : [];

        const basePayload: Record<string, any> = {
          teamId,
          title: training.title,
          summary: training.summary,
          description: training.description,
          location: training.location,
          source: training.source,
          sourceUid: training.sourceUid,
          startUtc: training.startUtc,
          endUtc: training.endUtc,
          displayTz: training.displayTz,
          originalTzid: training.originalTzid,
          calendarTz: training.calendarTz,
          hasUtcSuffix: training.hasUtcSuffix,
          players: players.length ? players : [],
          deepLink: training.deepLink,
          updatedAt: serverTimestamp(),
          timeZone: training.displayTz,
        };

        const cleanupFields = {
          startUtcMillis: deleteField(),
          endUtcMillis: deleteField(),
          startUTC: deleteField(),
          endUTC: deleteField(),
          tzid: deleteField(),
        };

        if (existingSnap.exists()) {
          await setDoc(
            docRef,
            {
              ...basePayload,
              ...cleanupFields,
              createdAt:
                existingData.createdAt && existingData.createdAt.toMillis
                  ? existingData.createdAt
                  : existingData.createdAt ?? serverTimestamp(),
            },
            { merge: true }
          );
          updatedCount += 1;
        } else {
          await setDoc(
            docRef,
            {
              ...basePayload,
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );
          importedCount += 1;
        }
      } catch (writeError) {
        console.error('❌ Error writing training:', writeError);
        errors.push(
          writeError instanceof Error
            ? writeError.message
            : String(writeError)
        );
      }
    }

    // Cleanup old sessions (ended more than CLEANUP_MARGIN_DAYS ago)
    try {
      const cleanupQuery = query(
        trainingsRef,
        where('endUtc', '<', Timestamp.fromMillis(cleanupThreshold.toMillis()))
      );
      const outdatedSnapshot = await getDocs(cleanupQuery);
      for (const snap of outdatedSnapshot.docs) {
        await deleteDoc(snap.ref);
        removedCount += 1;
      }
    } catch (cleanupError) {
      console.error('⚠️ Cleanup error:', cleanupError);
      errors.push(
        cleanupError instanceof Error
          ? cleanupError.message
          : String(cleanupError)
      );
    }

    if (!loggedSampleDebug) {
      console.log('[ICS][DEBUG] Kickboxing event not found in import window.');
    }

    return {
      success: errors.length === 0,
      message: `Import terminé · ${importedCount} créés · ${updatedCount} mis à jour · ${removedCount} nettoyés`,
      importedCount,
      updatedCount,
      removedCount,
      errors,
    };
  } catch (fatalError) {
    console.error('❌ Fatal ICS import error', fatalError);
    if (!loggedSampleDebug) {
      console.warn('[ICS][DEBUG] Kickboxing event not found during import.');
    }
    return {
      success: false,
      message:
        fatalError instanceof Error ? fatalError.message : String(fatalError),
      importedCount,
      updatedCount,
      removedCount,
      errors: [
        fatalError instanceof Error ? fatalError.message : String(fatalError),
        ...errors,
      ],
    };
  }
}

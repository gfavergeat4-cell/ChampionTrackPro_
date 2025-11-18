import { DateTime } from 'luxon';
import IcalExpander from 'ical-expander';
import * as crypto from 'crypto';
import * as admin from 'firebase-admin';

type IcalLikeDate = {
  toJSDate(): Date;
  isDate?: boolean;
  timezone?: string | null;
  tzid?: string | null;
  tz?: string | null;
  zone?: { tzid?: string | null };
};

type IcalLikeEvent = {
  uid?: string;
  summary?: string;
  description?: string;
  location?: string;
  startDate: IcalLikeDate;
  endDate: IcalLikeDate;
};

type ExpandedOccurrence = {
  item: IcalLikeEvent;
  startDate: IcalLikeDate;
  endDate: IcalLikeDate;
};

type TrainingPayload = {
  uid: string;
  title: string;
  summary: string;
  description: string | null;
  location: string | null;
  startUtc: admin.firestore.Timestamp;
  endUtc: admin.firestore.Timestamp;
  tzid: string;
  teamId: string;
  source: 'google';
  deepLink: string;
  players: string[];
};

type OccurrenceToPersist = {
  payload: Omit<TrainingPayload, 'teamId' | 'deepLink' | 'players'>;
  startUtcMillis: number;
  endUtcMillis: number;
};

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const TRAININGS_COLLECTION = 'trainings';
const SOURCE_TAG: TrainingPayload['source'] = 'google';
const DEFAULT_TZ = 'Europe/Paris';
const MAX_ITERATIONS = 8000;
const LOOKBACK_DAYS = 1;
const LOOKAHEAD_DAYS = 90;
const CLEANUP_DAYS = 2;
const DEEP_LINK_BASE = 'https://champion-track-pro.vercel.app/questionnaire?trainingId=';

function sanitizeUid(uid: string): string {
  const cleaned = uid.replace(/[^A-Za-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^[-]+|[-]+$/g, '');
  return cleaned.length > 0 ? cleaned.slice(0, 80) : 'training';
}

function makeDocId(uid: string, startUtcMillis: number): string {
  const safeUid = sanitizeUid(uid);
  const base = `${safeUid}_${startUtcMillis}`;
  if (base.length <= 120) {
    return base;
  }
  const hash = crypto.createHash('sha1').update(base).digest('hex').slice(0, 16);
  return `${safeUid.slice(0, 40)}_${hash}_${startUtcMillis}`;
}

function isAllDay(dateLike?: IcalLikeDate | null): boolean {
  return Boolean(dateLike && dateLike.isDate);
}

function resolveTimezone(dateLike: IcalLikeDate | null | undefined, fallback: string): string {
  if (dateLike) {
    const tz =
      dateLike.timezone ??
      dateLike.tzid ??
      dateLike.tz ??
      (dateLike.zone && typeof dateLike.zone.tzid === 'string' ? dateLike.zone.tzid : null);
    if (typeof tz === 'string' && tz.trim().length > 0) {
      return tz;
    }
  }
  return fallback;
}

function computeUtcMillis(dateLike: IcalLikeDate, tzid: string): { millis: number; valid: boolean } {
  const dt = DateTime.fromJSDate(dateLike.toJSDate(), { zone: tzid }).toUTC();
  return { millis: dt.toMillis(), valid: dt.isValid };
}

function buildOccurrence(
  source: IcalLikeEvent,
  startDate: IcalLikeDate,
  endDate: IcalLikeDate,
  defaultTz: string,
  rangeStartUtc: number,
  rangeEndUtc: number
): OccurrenceToPersist | null {
  if (!startDate || !endDate) {
    return null;
  }

  if (isAllDay(startDate) || isAllDay(endDate)) {
    return null;
  }

  const tzid = resolveTimezone(startDate, defaultTz);
  const { millis: startUtc, valid: startValid } = computeUtcMillis(startDate, tzid);
  const { millis: endUtc, valid: endValid } = computeUtcMillis(endDate, tzid);

  if (!startValid || !endValid) {
    return null;
  }

  if (endUtc <= startUtc) {
    return null;
  }

  if (startUtc < rangeStartUtc || startUtc > rangeEndUtc) {
    return null;
  }

  const rawSummary = source.summary?.trim() ?? '';
  const summary = rawSummary.length > 0 ? rawSummary : 'Training Session';
  const uid = (source.uid ?? summary).trim() || `training-${startUtc}`;

  return {
    payload: {
      uid,
      title: summary,
      summary,
      description: source.description?.trim() || null,
      location: source.location?.trim() || null,
      startUtc: admin.firestore.Timestamp.fromMillis(startUtc),
      endUtc: admin.firestore.Timestamp.fromMillis(endUtc),
      tzid,
      source: SOURCE_TAG,
    },
    startUtcMillis: startUtc,
    endUtcMillis: endUtc,
  };
}

function hasTrainingChanged(existing: admin.firestore.DocumentData, next: TrainingPayload): boolean {
  const existingStart =
    existing.startUtc && typeof existing.startUtc.toMillis === 'function'
      ? existing.startUtc.toMillis()
      : typeof existing.startUtc === 'number'
      ? existing.startUtc
      : null;
  const existingEnd =
    existing.endUtc && typeof existing.endUtc.toMillis === 'function'
      ? existing.endUtc.toMillis()
      : typeof existing.endUtc === 'number'
      ? existing.endUtc
      : null;

  const comparisons: Array<[unknown, unknown]> = [
    [existing.uid, next.uid],
    [existing.title, next.title],
    [existing.summary, next.summary],
    [existing.description ?? null, next.description ?? null],
    [existing.location ?? null, next.location ?? null],
    [existing.tzid, next.tzid],
    [existing.source, next.source],
    [existing.teamId, next.teamId],
    [existing.deepLink, next.deepLink],
    [existingStart, next.startUtc.toMillis()],
    [existingEnd, next.endUtc.toMillis()],
  ];

  return comparisons.some(([prev, curr]) => prev !== curr);
}

export async function importIcsForTeam(teamId: string, icsUrl: string, defaultTz: string = DEFAULT_TZ) {
  const teamRef = admin.firestore().doc(`teams/${teamId}`);
  const teamSnap = await teamRef.get();
  const team = teamSnap.data() || {};
  const tz = (team.timeZone as string) || defaultTz;

  console.log(`[ICS] Starting import for teamId=${teamId}, icsUrl=${icsUrl}, timezone=${tz}`);

  const response = await fetch(icsUrl);
  if (!response.ok) {
    throw new Error(`ICS fetch failed: ${response.status} ${response.statusText}`);
  }
  const ics = await response.text();

  console.log(`[ICS] Fetched ${ics.length} characters of ICS data`);

  const expander = new IcalExpander({ ics, maxIterations: MAX_ITERATIONS });
  const nowInTz = DateTime.now().setZone(tz);
  const windowStart = nowInTz.minus({ days: LOOKBACK_DAYS }).startOf('day');
  const windowEnd = nowInTz.plus({ days: LOOKAHEAD_DAYS }).endOf('day');
  const rangeStartUtc = windowStart.toUTC().toMillis();
  const rangeEndUtc = windowEnd.toUTC().toMillis();

  console.log(
    `[ICS] Expanding events between ${windowStart.toISO()} and ${windowEnd.toISO()} (${tz})`
  );

  const { events, occurrences } = expander.between(windowStart.toJSDate(), windowEnd.toJSDate());

  console.log(
    `[ICS] Found ${events.length} single events and ${occurrences.length} recurring occurrences before filtering`
  );

  const occurrencesToPersist: OccurrenceToPersist[] = [];

  for (const event of events) {
    const candidate = buildOccurrence(event, event.startDate, event.endDate, tz, rangeStartUtc, rangeEndUtc);
    if (candidate) {
      occurrencesToPersist.push(candidate);
    }
  }

  for (const occurrence of occurrences as ExpandedOccurrence[]) {
    const candidate = buildOccurrence(
      occurrence.item,
      occurrence.startDate,
      occurrence.endDate,
      tz,
      rangeStartUtc,
      rangeEndUtc
    );
    if (candidate) {
      occurrencesToPersist.push(candidate);
    }
  }

  occurrencesToPersist.sort((a, b) => a.startUtcMillis - b.startUtcMillis);

  const trainingsCollection = teamRef.collection(TRAININGS_COLLECTION);
  const processedDocIds = new Set<string>();

  let processed = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let cleaned = 0;
  const errors: string[] = [];

  for (const occurrence of occurrencesToPersist) {
    try {
      processed++;
      const docId = makeDocId(occurrence.payload.uid, occurrence.startUtcMillis);
      if (processedDocIds.has(docId)) {
        console.log(`[ICS] Duplicate occurrence detected, skipping docId=${docId}`);
        skipped++;
        continue;
      }
      processedDocIds.add(docId);

      const docRef = trainingsCollection.doc(docId);
      const docSnap = await docRef.get();

      const existingPlayers: string[] = docSnap.exists
        ? Array.isArray(docSnap.data()?.players)
          ? [...(docSnap.data()!.players as string[])]
          : []
        : [];

      const trainingPayload: TrainingPayload = {
        ...occurrence.payload,
        teamId,
        source: SOURCE_TAG,
        deepLink: `${DEEP_LINK_BASE}${docId}`,
        players: existingPlayers.length > 0 ? existingPlayers : [],
      };

      const baseWrite = {
        uid: trainingPayload.uid,
        title: trainingPayload.title,
        summary: trainingPayload.summary,
        description: trainingPayload.description,
        location: trainingPayload.location,
        startUtc: trainingPayload.startUtc,
        endUtc: trainingPayload.endUtc,
        tzid: trainingPayload.tzid,
        timeZone: trainingPayload.tzid,
        teamId: trainingPayload.teamId,
        source: trainingPayload.source,
        deepLink: trainingPayload.deepLink,
        players: trainingPayload.players,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (!docSnap.exists) {
        await docRef.set({
          ...baseWrite,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        created++;
        console.log(`[ICS] Created training ${docId} (${trainingPayload.summary})`);
      } else {
        const existingData = docSnap.data()!;
        const changed = hasTrainingChanged(existingData, trainingPayload);

        if (changed) {
          await docRef.set(
            {
              ...baseWrite,
              createdAt: existingData.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          updated++;
          console.log(`[ICS] Updated training ${docId} (${trainingPayload.summary})`);
        } else {
          skipped++;
          console.log(`[ICS] Skipped unchanged training ${docId}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
      console.error('[ICS] Error while processing occurrence:', error);
    }
  }

  const cleanupCutoffUtc = DateTime.now().toUTC().minus({ days: CLEANUP_DAYS }).toMillis();
  const cleanupQuery = await trainingsCollection
    .where('source', '==', SOURCE_TAG)
    .where('startUtc', '<', admin.firestore.Timestamp.fromMillis(cleanupCutoffUtc))
    .get();

  for (const doc of cleanupQuery.docs) {
    await doc.ref.delete();
    cleaned++;
    console.log(`[ICS] Deleted outdated training ${doc.id}`);
  }

  console.log(
    `[ICS] teamId=${teamId} processed=${processed} created=${created} updated=${updated} skipped=${skipped} cleaned=${cleaned} errors=${errors.length}`
  );

  return { processed, created, updated, skipped, cleaned, errors };
}



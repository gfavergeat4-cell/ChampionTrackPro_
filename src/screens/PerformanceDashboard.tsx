import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, Platform } from "react-native";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "../../services/firebaseConfig";
import { calculateEMA, calculateDeviation, calculateReadiness, extractV2Metrics } from "../utils/analytics";
import type { V2Metrics, RawResponse } from "../utils/analytics";
import { getMorinDataForResponses, MORIN_COLORS } from "../utils/useMorinAlgorithm";
import type { MorinDataPoint } from "../utils/useMorinAlgorithm";
import MorinPerformanceChart from "../components/MorinPerformanceChart";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

type Role = "admin" | "coach";

type DurationKey = "7d" | "14d" | "30d" | "90d";
type CategoryKey = "physical" | "mental" | "technical";
type ViewMode = "categories" | "individual";
type ChartType = "line" | "bar" | "radar" | "deviation" | "workload" | "morin";
type DashTab = "brief" | "analytics";

interface PerformanceDashboardProps {
  route: {
    params?: {
      role?: Role;
      teamId?: string;
      teamName?: string;
      athleteId?: string;
    };
  };
}

interface Team {
  id: string;
  name?: string;
}

interface Member {
  id: string;
  displayName?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  jerseyNumber?: number;
  role?: string;
}

// V2Metrics and RawResponse imported from ../utils/analytics

interface ChartPoint {
  date: string;
  [seriesKey: string]: number | string | null;
}

const CATEGORY_FIELDS: Record<CategoryKey, string[]> = {
  physical:  ["cardioLoad", "neuroLoad", "sessionRPE"],
  mental:    ["sleepQuality", "stressLevel"],
  technical: ["motorControl", "tacticalLucidity"],
};

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  physical: "#00D4FF",
  mental: "#00FF88",
  technical: "#A855F7",
};

const INDICATOR_COLORS: Record<CategoryKey, string[]> = {
  physical:  ["#00D4FF", "#00B8CC", "#0088AA", "#005577", "#003344"],
  mental:    ["#00FF88", "#00CC66", "#009944", "#006622", "#004411"],
  technical: ["#A855F7", "#8833DD", "#6611BB", "#440099", "#220077"],
};

const CATEGORY_LABEL: Record<CategoryKey, string> = {
  physical: "Physical",
  mental: "Mental",
  technical: "Technical",
};

const DURATION_LABEL: Record<DurationKey, string> = {
  "7d": "7 days",
  "14d": "14 days",
  "30d": "30 days",
  "90d": "3 months",
};

const INDICATOR_LABELS: Record<string, string> = {
  // V2 fields
  cardioLoad:       "Cardio Load",
  neuroLoad:        "Neuro Load",
  sessionRPE:       "Session RPE",
  sleepQuality:     "Sleep Quality",
  stressLevel:      "Stress Level",
  motorControl:     "Motor Control",
  tacticalLucidity: "Tactical Lucidity",
  // V1 French legacy
  intensiteMoyenne: "Average Intensity",
  hautesIntensites: "High Intensity",
  impactCardiaque:  "Cardiac Impact",
  impactMusculaire: "Muscular Impact",
  fatigue:          "Fatigue",
  concentration:    "Concentration",
  confiance:        "Confidence",
  bienEtre:         "Well-being",
  nervosite:        "Nervousness",
  sommeil:          "Sleep",
  technique:        "Technique",
  tactique:         "Tactics",
  dynamisme:        "Dynamism",
};

const ALL_INDICATORS_BY_CATEGORY: Record<CategoryKey, string[]> = {
  physical:  ["cardioLoad", "neuroLoad", "sessionRPE"],
  mental:    ["sleepQuality", "stressLevel"],
  technical: ["motorControl", "tacticalLucidity"],
};

function getDateRangeFromKey(key: DurationKey): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  const days = key === "7d" ? 7 : key === "14d" ? 14 : key === "30d" ? 30 : 90;
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getDateRange(
  mode: "preset" | "custom",
  durationKey: DurationKey,
  customStart?: string,
  customEnd?: string
): { start: Date; end: Date } {
  if (mode === "custom" && customStart && customEnd) {
    const start = new Date(customStart);
    const end = new Date(customEnd);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) return { start, end };
  }
  return getDateRangeFromKey(durationKey);
}

function formatDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getMetricValue(resp: RawResponse, key: string): number | null {
  const flat = (resp as any)[key];
  if (typeof flat === "number") return flat;
  if (resp.values && typeof resp.values[key] === "number") return resp.values[key] as number;
  if (resp.metrics && typeof (resp.metrics as any)[key] === "number") return (resp.metrics as any)[key];
  return null;
}

// Morning Brief: per-player latest readiness
function getRiskLevel(score: number, deviation: number): "danger" | "monitor" | "optimal" {
  if (score < 40 || deviation > 20) return "danger";
  if (score < 65 || deviation > 10) return "monitor";
  return "optimal";
}

export default function PerformanceDashboard({ route }: PerformanceDashboardProps) {
  // Limiter aux plateformes web pour Recharts
  if (Platform.OS !== "web") {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0A0F1E",
        }}
      >
        <Text style={{ color: "white", fontSize: 16 }}>
          Performance dashboard is available on web only.
        </Text>
      </View>
    );
  }

  const role: Role = (route?.params?.role as Role) || "coach";
  const teamNameFromRoute = route?.params?.teamName;

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(() => {
    const t = route?.params?.teamId;
    return typeof t === "string" && t.trim() ? t.trim() : null;
  });

  const [members, setMembers] = useState<Member[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(() => {
    const aid = route?.params?.athleteId;
    return typeof aid === "string" && aid.trim() ? [aid.trim()] : [];
  });
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);

  const [durationMode, setDurationMode] = useState<"preset" | "custom">("preset");
  const [duration, setDuration] = useState<DurationKey>("30d");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  const [indicatorMode, setIndicatorMode] = useState<"category" | "indicator">("category");
  const [category, setCategory] = useState<CategoryKey>("physical");
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);

  const [viewMode, setViewMode] = useState<ViewMode>("categories");
  const [chartType, setChartType] = useState<ChartType>("line");

  const [loadingInit, setLoadingInit] = useState<boolean>(true);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [responses, setResponses] = useState<RawResponse[]>([]);
  const [activeTab, setActiveTab] = useState<DashTab>("brief");

  const CYAN = "#00D4FF";
  const BG = "#0A0F1E";

  // Initialisation : teamId fixé par les props (admin) ou résolu depuis l'utilisateur (coach)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadingInit(true);
      try {
        const user = auth.currentUser;
        if (!user) {
          throw new Error("User not authenticated");
        }

        const raw = route?.params?.teamId;
        const teamIdFromParams =
          typeof raw === "string" && raw.trim() ? raw.trim() : null;

        if (role === "coach") {
          let teamId = teamIdFromParams ?? null;
          if (!teamId) {
            const userSnap = await getDoc(doc(db, "users", user.uid));
            const data = userSnap.data() || {};
            teamId = data.teamId || null;
          }
          if (!teamId) {
            const teamsSnap = await getDocs(collection(db, "teams"));
            for (const d of teamsSnap.docs) {
              const data = d.data() as any;
              const coaches = data.coaches;
              if (Array.isArray(coaches) && coaches.includes(user.uid)) {
                teamId = d.id;
                break;
              }
              if (data.coachId === user.uid || data.coach === user.uid) {
                teamId = d.id;
                break;
              }
            }
          }
          if (!teamId) {
            throw new Error("No team associated with this coach.");
          }
          if (!cancelled) setSelectedTeamId(teamId);
        } else {
          if (teamIdFromParams && !cancelled) setSelectedTeamId(teamIdFromParams);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || String(e));
        }
      } finally {
        if (!cancelled) setLoadingInit(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [role, route?.params?.teamId]);

  // Resynchroniser selectedTeamId si la route change (ex. navigation avec un autre teamId)
  useEffect(() => {
    const raw = route?.params?.teamId;
    const next =
      typeof raw === "string" && raw.trim() ? raw.trim() : null;
    if (role === "admin" && next !== null) {
      setSelectedTeamId((prev) => (prev !== next ? next : prev));
    }
  }, [route?.params?.teamId, role]);

  // Load team members — member doc is source of truth, user doc enriches if it exists
  useEffect(() => {
    let cancelled = false;
    if (!selectedTeamId) return;

    const parseJersey = (v: any): number | undefined => {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string") { const n = parseInt(v, 10); return Number.isFinite(n) ? n : undefined; }
      return undefined;
    };

    (async () => {
      try {
        const memSnap = await getDocs(collection(db, "teams", selectedTeamId, "members"));
        if (cancelled) return;

        const loaded: Member[] = await Promise.all(
          memSnap.docs.map(async (d) => {
            const md = d.data() as any;
            // Seed member doc as baseline
            let fullName: string | undefined = md.fullName || md.displayName || md.name || undefined;
            let position: string | undefined = md.position || undefined;
            let jerseyNumber: number | undefined = parseJersey(md.jerseyNumber);
            let role: string | undefined = md.role || undefined;

            // Enrich from users/{uid} when the document exists
            try {
              const userSnap = await getDoc(doc(db, "users", d.id));
              if (userSnap.exists()) {
                const ud = userSnap.data() as any;
                if (ud.fullName) fullName = ud.fullName;
                else if (ud.displayName && !fullName) fullName = ud.displayName;
                if (ud.position) position = ud.position;
                const uj = parseJersey(ud.jerseyNumber);
                if (uj != null) jerseyNumber = uj;
                if (ud.role) role = ud.role;
              }
            } catch {
              // user doc unreadable — member doc data is used as-is
            }

            return { id: d.id, fullName, displayName: fullName, position, jerseyNumber, role };
          })
        );

        const athletes = loaded.filter((m) => m.role !== "coach");
        console.log("members loaded:", athletes);
        if (!cancelled) setMembers(athletes);
      } catch (e) {
        console.error("[PERF][DASH] load members error", e);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedTeamId]);

  // Charger les réponses de l'équipe sur la période sélectionnée
  useEffect(() => {
    let cancelled = false;
    if (!selectedTeamId) return;

    (async () => {
      setLoadingData(true);
      setError(null);
      try {
        const { start, end } = getDateRange(
          durationMode,
          duration,
          customStart || undefined,
          customEnd || undefined
        );
        const startTs = Timestamp.fromDate(start);
        const endTs = Timestamp.fromDate(end);

        const cg = collectionGroup(db, "responses");
        // isTest filter removed server-side: legacy responses lack the field (undefined ≠ false).
        // Client-side guard below (data.isTest check) handles exclusion.
        const qy = query(
          cg,
          where("teamId", "==", selectedTeamId),
          where("submittedAt", ">=", startTs),
          where("submittedAt", "<=", endTs)
        );
        const snap = await getDocs(qy);
        console.log("[Dashboard] responses loaded:", snap.size, "| teamId:", selectedTeamId, "| range:", start.toISOString(), "→", end.toISOString());
        if (cancelled) return;

        const resps: RawResponse[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          if (!data || !data.userId || !data.trainingId) return;
          if (data.isTest) return;
          resps.push({
            ...(data as RawResponse),
          });
        });

        setResponses(resps);
      } catch (e: any) {
        console.error("[PERF][DASH] load responses error", e);
        if (!cancelled) {
          setError(e?.message || String(e));
        }
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedTeamId, durationMode, duration, customStart, customEnd]);

  const positions = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      if (m.position && m.position.trim()) set.add(m.position.trim());
    });
    return Array.from(set).sort();
  }, [members]);

  const membersFilteredByPosition = useMemo(() => {
    if (selectedPositions.length === 0) return members;
    return members.filter((m) => m.position && selectedPositions.includes(m.position));
  }, [members, selectedPositions]);

  const filteredResponses = useMemo(() => {
    // When specific players are selected, filter by those players
    if (selectedPlayerIds.length > 0) {
      const set = new Set(selectedPlayerIds);
      return responses.filter((r) => set.has(r.userId));
    }
    // When positions are selected but no specific players, filter by position
    if (selectedPositions.length > 0) {
      const positionUids = new Set(membersFilteredByPosition.map((m) => m.id));
      return responses.filter((r) => positionUids.has(r.userId));
    }
    return responses;
  }, [responses, selectedPlayerIds, selectedPositions, membersFilteredByPosition]);

  const activeFields = useMemo(() => {
    if (indicatorMode === "category") return CATEGORY_FIELDS[category];
    if (selectedIndicators.length > 0) return selectedIndicators;
    return CATEGORY_FIELDS.physical;
  }, [indicatorMode, category, selectedIndicators]);

  const chartData: ChartPoint[] = useMemo(() => {
    if (!selectedTeamId || filteredResponses.length === 0) return [];

    const { start, end } = getDateRange(
      durationMode,
      duration,
      customStart || undefined,
      customEnd || undefined
    );

    const byDate: Record<
      string,
      { byUser: Record<string, RawResponse[]> }
    > = {};

    for (const r of filteredResponses) {
      if (!r.submittedAt) continue;
      const dt: Date =
        typeof (r.submittedAt as any).toDate === "function"
          ? (r.submittedAt as any).toDate()
          : new Date(r.submittedAt);
      if (dt < start || dt > end) continue;

      const dateKey = formatDateKey(dt);
      if (!byDate[dateKey]) byDate[dateKey] = { byUser: {} };
      if (!byDate[dateKey].byUser[r.userId]) {
        byDate[dateKey].byUser[r.userId] = [];
      }
      byDate[dateKey].byUser[r.userId].push(r);
    }

    const dates = Object.keys(byDate).sort();
    const fields = activeFields;

    if (viewMode === "categories") {
      const data: ChartPoint[] = [];

      for (const dateKey of dates) {
        const entry = byDate[dateKey];
        const point: ChartPoint = { date: dateKey };

        for (const field of fields) {
          let sum = 0;
          let count = 0;

          Object.values(entry.byUser).forEach((list) => {
            list.forEach((resp) => {
              const v = getMetricValue(resp, field);
              if (typeof v === "number") {
                sum += v;
                count += 1;
              }
            });
          });

          point[field] = count > 0 ? Math.round(sum / count) : null;
        }

        data.push(point);
      }

      return data;
    }

    // Individual: une série par athlète, valeur = moyenne des indicateurs par jour
    const userIdsSet = new Set<string>();
    Object.values(byDate).forEach((entry) => {
      Object.keys(entry.byUser).forEach((uid) => userIdsSet.add(uid));
    });
    const userIds = Array.from(userIdsSet.values());

    const data: ChartPoint[] = [];

    for (const dateKey of dates) {
      const entry = byDate[dateKey];
      const point: ChartPoint = { date: dateKey };

      for (const uid of userIds) {
        const list = entry.byUser[uid] || [];
        if (list.length === 0) {
          point[uid] = null;
          continue;
        }
        let sum = 0;
        let count = 0;
        list.forEach((resp) => {
          for (const field of fields) {
            const v = getMetricValue(resp, field);
            if (typeof v === "number") {
              sum += v;
              count += 1;
            }
          }
        });
        const avg = count > 0 ? Math.round(sum / count) : null;
        point[uid] = avg;
      }

      data.push(point);
    }

    return data;
  }, [filteredResponses, durationMode, duration, customStart, customEnd, viewMode, selectedTeamId, activeFields]);

  function formatPlayerName(fullName: string, jerseyNumber: number): string {
    const parts = fullName.trim().split(' ');
    const first = parts[0]?.[0] || '';
    const last = parts[parts.length - 1] || '';
    return `${first}. ${last} #${jerseyNumber}`;
  }

  const athleteLabel = (uid: string): string => {
    const m = members.find((x) => x.id === uid);
    if (!m) return uid;
    const name =
      m.fullName ||
      m.displayName ||
      (m.firstName || m.lastName ? `${m.firstName || ""} ${m.lastName || ""}`.trim() : null);
    if (!name) return uid;
    if (m.jerseyNumber != null) return formatPlayerName(name, m.jerseyNumber);
    return name;
  };

  const seriesKeys: string[] = useMemo(() => {
    if (chartData.length === 0) return [];
    const sample = chartData[0];
    return Object.keys(sample).filter((k) => k !== "date");
  }, [chartData]);

  // ─── V2: Morning Brief — per-player readiness sorted by risk ──────────────
  const morningBriefData = useMemo(() => {
    if (filteredResponses.length === 0 || members.length === 0) return [];

    // Per player: collect readiness scores chronologically, compute EMA
    const byPlayer: Record<string, { name: string; uid: string; position?: string; scores: number[]; latest: number; ema: number; deviation: number }> = {};

    const sortedResponses = [...filteredResponses].sort((a, b) => {
      const ta = a.submittedAt?.seconds ?? 0;
      const tb = b.submittedAt?.seconds ?? 0;
      return ta - tb;
    });

    sortedResponses.forEach((r) => {
      const m2 = extractV2Metrics(r) ?? {};
      const rs = r.readinessScore ?? calculateReadiness(m2);
      if (!byPlayer[r.userId]) {
        const member = members.find((m) => m.id === r.userId);
        byPlayer[r.userId] = { name: member?.displayName || r.userId, uid: r.userId, position: member?.position, scores: [], latest: 0, ema: 0, deviation: 0 };
      }
      byPlayer[r.userId].scores.push(rs);
    });

    return Object.values(byPlayer).map((p) => {
      const emaArr = calculateEMA(p.scores, 28);
      const latest = p.scores[p.scores.length - 1];
      const emaLatest = emaArr[emaArr.length - 1];
      const deviation = calculateDeviation(latest, emaLatest);
      const risk = getRiskLevel(latest, deviation);
      return { name: p.name, uid: p.uid, position: p.position, readinessScore: latest, ema: emaLatest, deviation, risk };
    }).sort((a, b) => {
      const order = { danger: 0, monitor: 1, optimal: 2 };
      return order[a.risk] - order[b.risk];
    });
  }, [filteredResponses, members]);

  // ─── V2: Deviation Chart data (readiness vs EMA) ─────────────────────────
  const deviationChartData = useMemo(() => {
    const teamResponses = [...filteredResponses].sort((a, b) => {
      const ta = a.submittedAt?.seconds ?? 0;
      const tb = b.submittedAt?.seconds ?? 0;
      return ta - tb;
    });
    if (teamResponses.length === 0) return [];

    const scores = teamResponses.map((r) => {
      const m2 = extractV2Metrics(r) ?? {};
      return r.readinessScore ?? calculateReadiness(m2);
    });
    const emaArr = calculateEMA(scores, 28);

    return teamResponses.map((r, i) => ({
      date: formatDateKey(new Date((r.submittedAt?.seconds ?? 0) * 1000)),
      readiness: scores[i],
      ema: emaArr[i],
      deviation: calculateDeviation(scores[i], emaArr[i]),
    }));
  }, [filteredResponses]);

  // ─── V2: Workload Chart data (EMA 7d + EMA 28d + danger zone) ────────────
  const workloadChartData = useMemo(() => {
    const teamResponses = [...filteredResponses].sort((a, b) => {
      const ta = a.submittedAt?.seconds ?? 0;
      const tb = b.submittedAt?.seconds ?? 0;
      return ta - tb;
    });
    if (teamResponses.length === 0) return [];

    const workloads = teamResponses.map((r) => r.workloadAU ?? (r.metrics?.sessionRPE ?? 5) * 60);
    const ema7 = calculateEMA(workloads, 7);
    const ema28 = calculateEMA(workloads, 28);

    return teamResponses.map((r, i) => ({
      date: formatDateKey(new Date((r.submittedAt?.seconds ?? 0) * 1000)),
      ema7: Math.round(ema7[i]),
      ema28: Math.round(ema28[i]),
      danger: 700, // threshold line
    }));
  }, [filteredResponses]);

  // ─── Morin: Physical Engine (avg tankLevel + legBounce + invertedCardioLoad) ─
  const morinPhysicalData: MorinDataPoint[] = useMemo(() => {
    const extractor = (r: RawResponse): number | null => {
      const m = (r.metrics ?? {}) as any;
      if (m.tankLevel == null || m.legBounce == null || m.cardioLoad == null) return null;
      return Math.round((m.tankLevel + m.legBounce + (101 - m.cardioLoad)) / 3);
    };
    return getMorinDataForResponses(filteredResponses, extractor);
  }, [filteredResponses]);

  // ─── Morin: Mental Energy (teamChemistry) ─────────────────────────────────
  const morinMentalData: MorinDataPoint[] = useMemo(() => {
    const extractor = (r: RawResponse): number | null => {
      const m = (r.metrics ?? {}) as any;
      return typeof m.teamChemistry === 'number' ? m.teamChemistry : null;
    };
    return getMorinDataForResponses(filteredResponses, extractor);
  }, [filteredResponses]);

  // ─── Morin: Technical Execution (avg motorControl + tacticalSharpness) ────
  const morinTechnicalData: MorinDataPoint[] = useMemo(() => {
    const extractor = (r: RawResponse): number | null => {
      const m = (r.metrics ?? {}) as any;
      if (m.motorControl == null || m.tacticalSharpness == null) return null;
      return Math.round((m.motorControl + m.tacticalSharpness) / 2);
    };
    return getMorinDataForResponses(filteredResponses, extractor);
  }, [filteredResponses]);

  // ─── Morin: Per-player zone distribution (Physical Engine, all responses) ─
  const playerZoneDistributions = useMemo(() => {
    if (members.length === 0) return [];
    const physExtractor = (r: RawResponse): number | null => {
      const m = (r.metrics ?? {}) as any;
      if (m.tankLevel == null || m.legBounce == null || m.cardioLoad == null) return null;
      return Math.round((m.tankLevel + m.legBounce + (101 - m.cardioLoad)) / 3);
    };
    return members
      .map((member) => {
        const playerResps = responses.filter((r) => r.userId === member.id);
        const morinData = getMorinDataForResponses(playerResps, physExtractor);
        const withData = morinData.filter((d) => d.rawScore !== null);
        if (withData.length === 0) return null;
        const total = withData.length;
        const greenPct  = Math.round(withData.filter((d) => d.zone === 'GREEN').length  / total * 100);
        const bluePct   = Math.round(withData.filter((d) => d.zone === 'BLUE').length   / total * 100);
        const yellowPct = Math.round(withData.filter((d) => d.zone === 'YELLOW').length / total * 100);
        const name = member.fullName || member.displayName || member.id;
        return { member, name, greenPct, bluePct, yellowPct };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [members, responses]);

  // ─── V2: Radar data (latest team averages Physical/Mental/Technical) ──────
  const radarData = useMemo(() => {
    if (filteredResponses.length === 0) return [];
    const recent = filteredResponses.slice(-30);
    const metrics = {
      cardioLoad: recent.map(r => (extractV2Metrics(r) ?? {}).cardioLoad ?? 5),
      neuroLoad: recent.map(r => (extractV2Metrics(r) ?? {}).neuroLoad ?? 5),
      sleepQuality: recent.map(r => (extractV2Metrics(r) ?? {}).sleepQuality ?? 5),
      stressLevel: recent.map(r => (extractV2Metrics(r) ?? {}).stressLevel ?? 5),
      motorControl: recent.map(r => (extractV2Metrics(r) ?? {}).motorControl ?? 5),
      sessionRPE: recent.map(r => (extractV2Metrics(r) ?? {}).sessionRPE ?? 5),
    };
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    // Convert to readiness (inverted: high metric = bad)
    return [
      { subject: "Cardio",   value: Math.round((10 - avg(metrics.cardioLoad)) * 10) },
      { subject: "Neuro",    value: Math.round((10 - avg(metrics.neuroLoad)) * 10) },
      { subject: "Sleep",    value: Math.round((10 - avg(metrics.sleepQuality)) * 10) },
      { subject: "Stress",   value: Math.round((10 - avg(metrics.stressLevel)) * 10) },
      { subject: "Motor",    value: Math.round((10 - avg(metrics.motorControl)) * 10) },
      { subject: "Load",     value: Math.round((10 - avg(metrics.sessionRPE)) * 10) },
    ];
  }, [filteredResponses]);

  function getIndicatorCategory(key: string): CategoryKey {
    if (CATEGORY_FIELDS.physical.includes(key)) return "physical";
    if (CATEGORY_FIELDS.mental.includes(key)) return "mental";
    return "technical";
  }

  const categoryColor = CATEGORY_COLORS[category];

  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const [showPositionDropdown, setShowPositionDropdown] = useState(false);
  const [openIndicators, setOpenIndicators] = useState(false);

  const togglePlayer = (uid: string) => {
    setSelectedPlayerIds((ids) =>
      ids.includes(uid) ? ids.filter((id) => id !== uid) : [...ids, uid]
    );
  };

  const togglePosition = (pos: string) => {
    setSelectedPositions((arr) =>
      arr.includes(pos) ? arr.filter((p) => p !== pos) : [...arr, pos]
    );
  };

  // ─── V2 Chart Renderer (extracted for ResponsiveContainer compatibility) ──
  const renderChartContent = () => {
    const tooltipStyle = { backgroundColor: "#0E1528", border: "1px solid #00D4FF", borderRadius: 8, color: "#FFFFFF" };
    const xAxisProps = {
      dataKey: "date" as string,
      stroke: "rgba(255,255,255,0.6)",
      tick: { fill: "rgba(255,255,255,0.6)", fontSize: 11 },
      angle: -35,
      textAnchor: "end" as const,
      interval: "preserveStartEnd" as const,
      tickFormatter: (d: string) => { const dt = new Date(d); return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); },
    };
    const gridProps = { strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.08)" };
    const margin = { top: 20, right: 30, left: 20, bottom: 60 };

    if (chartType === "radar") {
      return (
        <RadarChart data={radarData} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
          <PolarGrid stroke="rgba(255,255,255,0.1)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }} />
          <Radar name="Team Readiness" dataKey="value" stroke="#00D4FF" fill="#00D4FF" fillOpacity={0.18} strokeWidth={2} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v}`, "Readiness"]} />
        </RadarChart>
      );
    }

    if (chartType === "deviation") {
      return (
        <ComposedChart data={deviationChartData} margin={margin}>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} />
          <YAxis stroke="rgba(255,255,255,0.6)" />
          <Tooltip contentStyle={tooltipStyle} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4" />
          <Bar dataKey="deviation" name="Deviation %" fill="#00D4FF" fillOpacity={0.7} radius={[4, 4, 0, 0] as any} />
          <Line type="monotone" dataKey="ema" name="EMA 28d" stroke="#0066FF" strokeWidth={2} dot={false} strokeDasharray="4 2" />
        </ComposedChart>
      );
    }

    if (chartType === "workload") {
      return (
        <ComposedChart data={workloadChartData} margin={margin}>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} />
          <YAxis stroke="rgba(255,255,255,0.6)" />
          <Tooltip contentStyle={tooltipStyle} />
          <ReferenceLine y={700} stroke="#FF3B30" strokeDasharray="4 4" label={{ value: "Danger", fill: "#FF3B30", fontSize: 10 }} />
          <Area type="monotone" dataKey="ema7" name="EMA 7d" stroke="#00D4FF" fill="#00D4FF" fillOpacity={0.12} strokeWidth={2} />
          <Line type="monotone" dataKey="ema28" name="EMA 28d" stroke="#0066FF" strokeWidth={2} dot={false} strokeDasharray="5 3" />
        </ComposedChart>
      );
    }

    // line or bar (legacy)
    return null;
  };

  const filterBoxStyle = {
    background: "#0D1526",
    borderRadius: 12,
    padding: 12,
    border: "1px solid rgba(0,212,255,0.14)",
  } as const;
  const labelStyle = { fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 6, display: "block" as const };
  const checkboxStyle = { accentColor: CYAN };
  const btnActiveStyle = {
    background: "linear-gradient(135deg, #00BFFF, #0066FF)",
    color: "#FFFFFF",
    border: "none",
  };
  const btnInactiveStyle = {
    background: "#0A0F1E",
    color: "rgba(255,255,255,0.7)",
    border: "1px solid rgba(255,255,255,0.2)",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        overflowY: "auto",
        background: "radial-gradient(ellipse at top, #0D1F3C 0%, #0A0F1E 60%)",
        backgroundColor: BG,
        color: "#FFFFFF",
        padding: 24,
        paddingBottom: 120,
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: "#FFFFFF",
                marginBottom: 4,
                fontFamily: "'Palatino Linotype', Palatino, Georgia, serif",
              }}
            >
              Performance Analytics
            </h1>
            {teamNameFromRoute && (
              <p style={{ margin: "2px 0 4px", fontSize: 14, color: "#00D4FF", fontWeight: 600 }}>
                {teamNameFromRoute}
              </p>
            )}
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, margin: 0 }}>
              Questionnaire data visualization by player, category and period.
            </p>
          </div>
        </div>

        {/* ─── Tab bar ──────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "1px solid rgba(0,212,255,0.15)" }}>
          {([
            { key: "brief" as DashTab, label: "Morning Brief" },
            { key: "analytics" as DashTab, label: "Analytics" },
          ]).map(({ key, label }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                style={{
                  padding: "10px 24px",
                  background: "none",
                  border: "none",
                  borderBottom: active ? "2px solid #00D4FF" : "2px solid transparent",
                  color: active ? "#00D4FF" : "rgba(255,255,255,0.45)",
                  fontWeight: active ? 700 : 400,
                  fontSize: 14,
                  cursor: "pointer",
                  letterSpacing: "0.04em",
                  marginBottom: -1,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* ─── Morning Brief Tab ────────────────────────────────────────── */}
        {activeTab === "brief" && (
          <div>
            {/* Duration filter (compact) */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginRight: 4 }}>Period:</span>
              {(["7d", "14d", "30d", "90d"] as DurationKey[]).map((d) => {
                const active = duration === d && durationMode === "preset";
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => { setDurationMode("preset"); setDuration(d); }}
                    style={{
                      padding: "5px 12px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                      ...(active ? { background: "linear-gradient(135deg, #00BFFF, #0066FF)", color: "#FFF", border: "none" }
                                 : { background: "#0A0F1E", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.2)" }),
                      cursor: "pointer",
                    }}
                  >
                    {DURATION_LABEL[d]}
                  </button>
                );
              })}
            </div>
            {loadingInit || loadingData ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}>
                <ActivityIndicator color={CYAN} />
                <span style={{ marginLeft: 12, color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Loading...</span>
              </div>
            ) : morningBriefData.length === 0 ? (
              <div style={{ textAlign: "center" as const, padding: 60, color: "rgba(255,255,255,0.35)", fontSize: 14 }}>
                No readiness data for the selected period.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {morningBriefData.map((p) => {
                  const riskColor = p.risk === "danger" ? "#FF3B30" : p.risk === "monitor" ? "#FFB800" : "#00FF9D";
                  const bgColor   = p.risk === "danger" ? "rgba(255,59,48,0.07)" : p.risk === "monitor" ? "rgba(255,184,0,0.07)" : "rgba(0,255,157,0.05)";
                  const borderClr = p.risk === "danger" ? "rgba(255,59,48,0.25)" : p.risk === "monitor" ? "rgba(255,184,0,0.25)" : "rgba(0,255,157,0.2)";
                  const initials  = p.name.split(" ").map((w: string) => w[0] || "").slice(0, 2).join("").toUpperCase();
                  return (
                    <div key={p.uid || p.name} style={{
                      display: "flex", alignItems: "center", gap: 14,
                      background: bgColor,
                      borderRadius: 12,
                      padding: "14px 18px",
                      border: `1px solid ${borderClr}`,
                      borderLeft: `4px solid ${riskColor}`,
                    }}>
                      {/* Avatar */}
                      <div style={{
                        width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                        background: `rgba(${p.risk === "danger" ? "255,59,48" : p.risk === "monitor" ? "255,184,0" : "0,212,255"},0.15)`,
                        border: `1.5px solid ${riskColor}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 700, color: riskColor,
                      }}>
                        {initials}
                      </div>
                      {/* Name + position */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#FFFFFF", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p.name}
                        </div>
                        {p.position && (
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{p.position}</div>
                        )}
                      </div>
                      {/* EMA + deviation */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, minWidth: 72 }}>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>EMA {Math.round(p.ema)}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: p.deviation > 0 ? "#FF3B30" : "#00FF9D" }}>
                          {p.deviation > 0 ? "+" : ""}{p.deviation.toFixed(0)}%
                        </span>
                      </div>
                      {/* Readiness score circle */}
                      <div style={{
                        width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
                        background: riskColor,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, fontWeight: 800, color: "#000",
                      }}>
                        {p.readinessScore}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── Analytics Tab ────────────────────────────────────────────── */}
        {activeTab === "analytics" && (<>

        {/* Filtres */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          {/* Players (multi-select) */}
          <div style={{ ...filterBoxStyle, position: "relative", zIndex: showPlayerDropdown ? 100 : 1 }}>
            <span style={labelStyle}>Players</span>
            <button
              type="button"
              onClick={() => { setShowPositionDropdown(false); setOpenIndicators(false); setShowPlayerDropdown((v) => !v); }}
              style={{
                width: "100%",
                background: "#0D1526",
                border: "1px solid rgba(0,212,255,0.14)",
                borderRadius: 8,
                padding: "10px 14px",
                cursor: "pointer",
                color: "#FFFFFF",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 14,
              }}
            >
              <span>
                {selectedPlayerIds.length === 0
                  ? "All Players"
                  : `${selectedPlayerIds.length} player(s) selected`}
              </span>
              <span style={{ fontSize: 10, opacity: 0.7 }}>{showPlayerDropdown ? "▲" : "▼"}</span>
            </button>
            {showPlayerDropdown && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  zIndex: 1000,
                  background: "#0E1528",
                  border: "1px solid rgba(0,212,255,0.3)",
                  borderRadius: 8,
                  maxHeight: 260,
                  overflowY: "auto",
                  marginTop: 4,
                }}
              >
                <div
                  onClick={() => setSelectedPlayerIds([])}
                  style={{ padding: "10px 14px", cursor: "pointer", color: selectedPlayerIds.length === 0 ? CYAN : "#FFFFFF", display: "flex", gap: 8, alignItems: "center" }}
                >
                  <input type="checkbox" checked={selectedPlayerIds.length === 0} readOnly style={checkboxStyle} />
                  All Players
                </div>
                {membersFilteredByPosition.map((m) => {
                  const playerName = m.fullName || m.displayName || m.id;
                  const label = m.jerseyNumber != null
                    ? formatPlayerName(playerName, m.jerseyNumber) + (m.position ? ` — ${m.position}` : "")
                    : playerName + (m.position ? ` — ${m.position}` : "");
                  return (
                    <div
                      key={m.id}
                      onClick={() => togglePlayer(m.id)}
                      style={{ padding: "10px 14px", cursor: "pointer", color: selectedPlayerIds.includes(m.id) ? CYAN : "#FFFFFF", display: "flex", gap: 8, alignItems: "center" }}
                    >
                      <input type="checkbox" checked={selectedPlayerIds.includes(m.id)} readOnly style={checkboxStyle} />
                      {label}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Position (multi-select) */}
          <div style={{ ...filterBoxStyle, position: "relative", zIndex: showPositionDropdown ? 100 : 1 }}>
            <span style={labelStyle}>Position</span>
            <button
              type="button"
              onClick={() => { setShowPlayerDropdown(false); setOpenIndicators(false); setShowPositionDropdown((v) => !v); }}
              style={{
                width: "100%",
                background: "#0D1526",
                border: "1px solid rgba(0,212,255,0.14)",
                borderRadius: 8,
                padding: "10px 14px",
                cursor: "pointer",
                color: "#FFFFFF",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 14,
              }}
            >
              <span>{selectedPositions.length === 0 ? "All Positions" : `${selectedPositions.length} position(s)`}</span>
              <span style={{ fontSize: 10, opacity: 0.7 }}>{showPositionDropdown ? "▲" : "▼"}</span>
            </button>
            {showPositionDropdown && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  zIndex: 1000,
                  background: "#0E1528",
                  border: "1px solid rgba(0,212,255,0.3)",
                  borderRadius: 8,
                  maxHeight: 220,
                  overflowY: "auto",
                  marginTop: 4,
                }}
              >
                <div
                  onClick={() => setSelectedPositions([])}
                  style={{ padding: "10px 14px", cursor: "pointer", color: selectedPositions.length === 0 ? CYAN : "#FFFFFF", display: "flex", gap: 8, alignItems: "center" }}
                >
                  <input type="checkbox" checked={selectedPositions.length === 0} readOnly style={checkboxStyle} />
                  All Positions
                </div>
                {positions.map((p) => (
                  <div
                    key={p}
                    onClick={() => togglePosition(p)}
                    style={{ padding: "10px 14px", cursor: "pointer", color: selectedPositions.includes(p) ? CYAN : "#FFFFFF", display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <input type="checkbox" checked={selectedPositions.includes(p)} readOnly style={checkboxStyle} />
                    {p}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Duration */}
          <div style={filterBoxStyle}>
            <label style={labelStyle}>Duration</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => setDurationMode("preset")}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  ...(durationMode === "preset" ? btnActiveStyle : btnInactiveStyle),
                  cursor: "pointer",
                }}
              >
                Preset Period
              </button>
              <button
                type="button"
                onClick={() => setDurationMode("custom")}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  ...(durationMode === "custom" ? btnActiveStyle : btnInactiveStyle),
                  cursor: "pointer",
                }}
              >
                Custom Dates
              </button>
            </div>
            {durationMode === "preset" ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(["7d", "14d", "30d", "90d"] as DurationKey[]).map((d) => {
                  const active = duration === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        ...(active ? btnActiveStyle : btnInactiveStyle),
                        cursor: "pointer",
                      }}
                    >
                      {DURATION_LABEL[d]}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid rgba(0,212,255,0.2)",
                      background: "#0D1526",
                      color: "#FFFFFF",
                      fontSize: 14,
                      colorScheme: "dark",
                    }}
                  />
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid rgba(0,212,255,0.2)",
                    background: "#0D1526",
                    color: "#FFFFFF",
                    fontSize: 14,
                    colorScheme: "dark",
                  }}
                />
              </div>
            )}
          </div>

          {/* Indicators */}
          <div style={{ ...filterBoxStyle, position: "relative", gridColumn: "span 1" }}>
            <label style={labelStyle}>Indicators</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => { setIndicatorMode("category"); setOpenIndicators(false); }}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  ...(indicatorMode === "category" ? btnActiveStyle : btnInactiveStyle),
                  cursor: "pointer",
                }}
              >
                By Category
              </button>
              <button
                type="button"
                onClick={() => setIndicatorMode("indicator")}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  ...(indicatorMode === "indicator" ? btnActiveStyle : btnInactiveStyle),
                  cursor: "pointer",
                }}
              >
                By Indicator
              </button>
            </div>
            {indicatorMode === "category" ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(["physical", "mental", "technical"] as CategoryKey[]).map((c) => {
                  const active = category === c;
                  const color = CATEGORY_COLORS[c];
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        ...(active ? { ...btnActiveStyle, color: "#FFFFFF" } : btnInactiveStyle),
                        border: active ? "none" : "1px solid rgba(255,255,255,0.2)",
                        cursor: "pointer",
                      }}
                    >
                      {CATEGORY_LABEL[c]}
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setOpenIndicators((v) => !v)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid rgba(0,212,255,0.2)",
                    background: "#0D1526",
                    color: "#FFFFFF",
                    fontSize: 14,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  {selectedIndicators.length === 0 ? "All" : `${selectedIndicators.length} indicator(s) selected`}
                </button>
                {openIndicators && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      marginTop: 4,
                      padding: 8,
                      background: "#0D1526",
                      border: "1px solid rgba(0,212,255,0.2)",
                      borderRadius: 8,
                      zIndex: 10,
                      maxHeight: 320,
                      overflowY: "auto",
                    }}
                  >
                    {(Object.keys(ALL_INDICATORS_BY_CATEGORY) as CategoryKey[]).map((cat) => (
                      <div key={cat} style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, color: CATEGORY_COLORS[cat], marginBottom: 6 }}>
                          {cat === "physical" && "🔵 Physical"}
                          {cat === "mental" && "🟢 Mental"}
                          {cat === "technical" && "🟡 Technical"}
                        </div>
                        {ALL_INDICATORS_BY_CATEGORY[cat].map((key) => {
                          const checked = selectedIndicators.includes(key);
                          return (
                            <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", color: "#FFFFFF", cursor: "pointer" }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  if (checked) setSelectedIndicators((arr) => arr.filter((x) => x !== key));
                                  else setSelectedIndicators((arr) => [...arr, key]);
                                }}
                                style={checkboxStyle}
                              />
                              {INDICATOR_LABELS[key] || key}
                            </label>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* View Mode + Chart Type */}
          <div style={filterBoxStyle}>
            <label style={labelStyle}>View Mode</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {(["categories", "individual"] as ViewMode[]).map((m) => {
                const active = viewMode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setViewMode(m)}
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      ...(active ? btnActiveStyle : btnInactiveStyle),
                      cursor: "pointer",
                    }}
                  >
                    {m === "categories" ? "Categories" : "Individual"}
                  </button>
                );
              })}
            </div>
            <label style={labelStyle}>Chart Type</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {([
                { key: "line",      label: "Line" },
                { key: "bar",       label: "Bar" },
                { key: "radar",     label: "Radar" },
                { key: "deviation", label: "Deviation" },
                { key: "workload",  label: "Workload" },
              { key: "morin",     label: "Morin" },
              ] as { key: ChartType; label: string }[]).map(({ key, label }) => {
                const active = chartType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setChartType(key)}
                    style={{
                      flex: "1 1 auto",
                      padding: "6px 8px",
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 600,
                      ...(active ? btnActiveStyle : btnInactiveStyle),
                      cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>


        <div
          style={{
            background: "#0D1526",
            borderRadius: 16,
            padding: 20,
            border: "1px solid rgba(0,212,255,0.15)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }}
        >
          {loadingInit || loadingData ? (
            <div
              style={{
                height: 320,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator color={CYAN} />
              <span
                style={{
                  marginLeft: 12,
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 14,
                }}
              >
                Loading data...
              </span>
            </div>
          ) : !selectedTeamId ? (
            <div
              style={{
                minHeight: 160,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#F87171",
                fontSize: 14,
              }}
            >
              No team selected
            </div>
          ) : error ? (
            <div
              style={{
                minHeight: 160,
                color: "#F87171",
                fontSize: 14,
              }}
            >
              {error}
            </div>
          ) : chartType === "morin" ? (
            /* ── Morin Algorithm View ── */
            <div style={{ paddingBottom: 8 }}>
              {/* 3-chart grid */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 28,
                marginBottom: 36,
              }}>
                <MorinPerformanceChart
                  data={morinPhysicalData}
                  metricLabel="Physical Engine"
                  height={220}
                />
                <MorinPerformanceChart
                  data={morinMentalData}
                  metricLabel="Mental Energy"
                  height={220}
                />
                <MorinPerformanceChart
                  data={morinTechnicalData}
                  metricLabel="Technical Execution"
                  height={220}
                />
              </div>

              {/* Zone distribution summary — per player */}
              {playerZoneDistributions.length > 0 && (
                <div style={{
                  borderTop: "1px solid rgba(0,212,255,0.10)",
                  paddingTop: 20,
                }}>
                  <div style={{
                    fontSize: 10,
                    fontFamily: "'Space Mono', monospace",
                    letterSpacing: "1.5px",
                    textTransform: "uppercase",
                    color: "rgba(0,212,255,0.55)",
                    marginBottom: 14,
                  }}>
                    Zone Distribution — Physical Engine
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {playerZoneDistributions.map(({ member, name, greenPct, bluePct, yellowPct }) => (
                      <div key={member.id}>
                        {/* Label row */}
                        <div style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.60)",
                          fontFamily: "'DM Sans', system-ui",
                          marginBottom: 5,
                        }}>
                          {name}
                          {" — "}
                          <span style={{ color: MORIN_COLORS.GREEN }}>{greenPct}% Normal</span>
                          {" · "}
                          <span style={{ color: MORIN_COLORS.BLUE }}>{bluePct}% Under-load</span>
                          {" · "}
                          <span style={{ color: MORIN_COLORS.YELLOW }}>{yellowPct}% Spike</span>
                        </div>
                        {/* Mini horizontal bar */}
                        <div style={{
                          display: "flex",
                          height: 6,
                          borderRadius: 3,
                          overflow: "hidden",
                          background: "rgba(255,255,255,0.06)",
                        }}>
                          <div style={{ width: `${greenPct}%`,  background: MORIN_COLORS.GREEN,  transition: "width 0.3s" }} />
                          <div style={{ width: `${bluePct}%`,   background: MORIN_COLORS.BLUE,   transition: "width 0.3s" }} />
                          <div style={{ width: `${yellowPct}%`, background: MORIN_COLORS.YELLOW, transition: "width 0.3s" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state when no V3 data */}
              {morinPhysicalData.length === 0 && morinMentalData.length === 0 && morinTechnicalData.length === 0 && (
                <div style={{ textAlign: "center" as const, padding: "40px 0", color: "rgba(255,255,255,0.28)", fontSize: 13 }}>
                  No V3 questionnaire data in the selected period.
                </div>
              )}
            </div>
          ) : chartData.length === 0 ? (
            <div
              style={{
                minHeight: 160,
                color: "#9CA3AF",
                fontSize: 14,
              }}
            >
              No data for the selected period.
            </div>
          ) : (
            <div style={{ minHeight: 400, marginBottom: 16 }}>
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "line" ? (
                  <LineChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.6)" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} angle={-35} textAnchor="end" interval="preserveStartEnd" tickFormatter={(dateStr) => { const d = new Date(dateStr); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }} />
                    <YAxis domain={[1, 10]} stroke="rgba(255,255,255,0.6)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0E1528",
                        border: "1px solid #00D4FF",
                        borderRadius: 8,
                        color: "#FFFFFF",
                      }}
                    />
                    {seriesKeys.map((k, idx) => {
                      const playerPalette = ["#00D4FF","#00FF88","#A855F7","#FFB800","#FF6B6B","#4ECDC4","#45B7D1","#96CEB4"];
                      let color: string;
                      if (viewMode === "categories") {
                        if (indicatorMode === "indicator") {
                          const cat = getIndicatorCategory(k);
                          const catIdx = ALL_INDICATORS_BY_CATEGORY[cat].indexOf(k);
                          color = INDICATOR_COLORS[cat][catIdx >= 0 ? catIdx : idx % INDICATOR_COLORS[cat].length];
                        } else {
                          color = INDICATOR_COLORS[category][idx % INDICATOR_COLORS[category].length];
                        }
                      } else {
                        color = playerPalette[idx % playerPalette.length];
                      }
                      const name =
                        viewMode === "categories"
                          ? (indicatorMode === "indicator" ? (INDICATOR_LABELS[k] || k) : (INDICATOR_LABELS[k] || k))
                          : athleteLabel(k);
                      return (
                        <Line
                          key={k}
                          type="monotone"
                          dataKey={k}
                          name={name}
                          stroke={color}
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                      );
                    })}
                  </LineChart>
                ) : (
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.6)" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} angle={-35} textAnchor="end" interval="preserveStartEnd" tickFormatter={(dateStr) => { const d = new Date(dateStr); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }} />
                    <YAxis domain={[1, 10]} stroke="rgba(255,255,255,0.6)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0E1528",
                        border: "1px solid #00D4FF",
                        borderRadius: 8,
                        color: "#FFFFFF",
                      }}
                    />
                    {seriesKeys.map((k, idx) => {
                      const playerPalette = ["#00D4FF","#00FF88","#A855F7","#FFB800","#FF6B6B","#4ECDC4","#45B7D1","#96CEB4"];
                      let color: string;
                      if (viewMode === "categories") {
                        if (indicatorMode === "indicator") {
                          const cat = getIndicatorCategory(k);
                          const catIdx = ALL_INDICATORS_BY_CATEGORY[cat].indexOf(k);
                          color = INDICATOR_COLORS[cat][catIdx >= 0 ? catIdx : idx % INDICATOR_COLORS[cat].length];
                        } else {
                          color = INDICATOR_COLORS[category][idx % INDICATOR_COLORS[category].length];
                        }
                      } else {
                        color = playerPalette[idx % playerPalette.length];
                      }
                      const name =
                        viewMode === "categories"
                          ? (indicatorMode === "indicator" ? (INDICATOR_LABELS[k] || k) : (INDICATOR_LABELS[k] || k))
                          : athleteLabel(k);
                      return (
                        <Bar
                          key={k}
                          dataKey={k}
                          name={name}
                          fill={color}
                          radius={[6, 6, 0, 0]}
                        />
                      );
                    })}
                  </BarChart>
                )}
              </ResponsiveContainer>

              {/* V2 charts rendered separately (avoid ResponsiveContainer child type issues) */}
              {(chartType === "radar" || chartType === "deviation" || chartType === "workload") && (
                <ResponsiveContainer width="100%" height={360}>
                  {renderChartContent() as React.ReactElement}
                </ResponsiveContainer>
              )}
              {/* Custom legend */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 20px", padding: "16px 20px 4px", justifyContent: "center" }}>
                {seriesKeys.map((k, idx) => {
                  const playerPalette = ["#00D4FF","#00FF88","#A855F7","#FFB800","#FF6B6B","#4ECDC4","#45B7D1","#96CEB4"];
                  let color: string;
                  if (viewMode === "categories") {
                    if (indicatorMode === "indicator") {
                      const cat = getIndicatorCategory(k);
                      const catIdx = ALL_INDICATORS_BY_CATEGORY[cat].indexOf(k);
                      color = INDICATOR_COLORS[cat][catIdx >= 0 ? catIdx : idx % INDICATOR_COLORS[cat].length];
                    } else {
                      color = INDICATOR_COLORS[category][idx % INDICATOR_COLORS[category].length];
                    }
                  } else {
                    color = playerPalette[idx % playerPalette.length];
                  }
                  const label = viewMode === "categories" ? (INDICATOR_LABELS[k] || k) : athleteLabel(k);
                  return (
                    <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        </>)}
      </div>
    </div>
  );
}


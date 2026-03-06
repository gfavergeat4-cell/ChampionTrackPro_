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
import {
  LineChart,
  Line,
  BarChart,
  Bar,
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
type ChartType = "line" | "bar";

interface PerformanceDashboardProps {
  route: {
    params?: {
      role?: Role;
      teamId?: string;
      teamName?: string;
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

interface RawResponse {
  userId: string;
  teamId: string;
  trainingId: string;
  submittedAt?: any;
  status?: string;
  intensiteMoyenne?: number;
  hautesIntensites?: number;
  impactCardiaque?: number;
  impactMusculaire?: number;
  fatigue?: number;
  concentration?: number;
  confiance?: number;
  bienEtre?: number;
  nervosite?: number;
  sommeil?: number;
  technique?: number;
  tactique?: number;
  dynamisme?: number;
  values?: { [key: string]: number | undefined };
}

interface ChartPoint {
  date: string;
  [seriesKey: string]: number | string | null;
}

const CATEGORY_FIELDS: Record<CategoryKey, string[]> = {
  physical: [
    "intensiteMoyenne",
    "hautesIntensites",
    "impactCardiaque",
    "impactMusculaire",
    "fatigue",
  ],
  mental: ["concentration", "confiance", "bienEtre", "nervosite", "sommeil"],
  technical: ["technique", "tactique", "dynamisme"],
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
  intensiteMoyenne: "Average Intensity",
  hautesIntensites: "High Intensity",
  impactCardiaque: "Cardiac Impact",
  impactMusculaire: "Muscular Impact",
  fatigue: "Fatigue",
  concentration: "Concentration",
  confiance: "Confidence",
  bienEtre: "Well-being",
  nervosite: "Nervousness",
  sommeil: "Sleep",
  technique: "Technique",
  tactique: "Tactics",
  dynamisme: "Dynamism",
};

const ALL_INDICATORS_BY_CATEGORY: Record<CategoryKey, string[]> = {
  physical: ["intensiteMoyenne", "hautesIntensites", "impactCardiaque", "impactMusculaire", "fatigue"],
  mental: ["concentration", "confiance", "bienEtre", "nervosite", "sommeil"],
  technical: ["technique", "tactique", "dynamisme"],
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
  if (resp.values && typeof resp.values[key] === "number") {
    return resp.values[key] as number;
  }
  return null;
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
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
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
        const qy = query(
          cg,
          where("teamId", "==", selectedTeamId),
          where("submittedAt", ">=", startTs),
          where("submittedAt", "<=", endTs)
        );
        const snap = await getDocs(qy);
        if (cancelled) return;

        const resps: RawResponse[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          if (!data || !data.userId || !data.trainingId) return;
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
    if (selectedPlayerIds.length === 0) return responses;
    const set = new Set(selectedPlayerIds);
    return responses.filter((r) => set.has(r.userId));
  }, [responses, selectedPlayerIds]);

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

  const filterBoxStyle = {
    background: "#0D1526",
    borderRadius: 12,
    padding: 12,
    border: "1px solid rgba(0,212,255,0.2)",
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
                background: "#0E1528",
                border: "1px solid rgba(0,212,255,0.3)",
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
                background: "#0E1528",
                border: "1px solid rgba(0,212,255,0.3)",
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
            <div style={{ display: "flex", gap: 6 }}>
              {(["line", "bar"] as ChartType[]).map((t) => {
                const active = chartType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setChartType(t)}
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
                    {t === "line" ? "Line" : "Bar"}
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
                    <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.6)" />
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
                    <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.6)" />
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
      </div>
    </div>
  );
}


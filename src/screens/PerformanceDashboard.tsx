import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, Platform } from "react-native";
import {
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
  physical: "#00E0FF",
  mental: "#00FF88",
  technical: "#A855F7",
};

const CATEGORY_LABEL: Record<CategoryKey, string> = {
  physical: "Physical",
  mental: "Mental",
  technical: "Technical",
};

const DURATION_LABEL: Record<DurationKey, string> = {
  "7d": "7j",
  "14d": "14j",
  "30d": "30j",
  "90d": "3 mois",
};

const INDICATOR_LABELS_FR: Record<string, string> = {
  intensiteMoyenne: "Intensité moyenne",
  hautesIntensites: "Hautes intensités",
  impactCardiaque: "Impact cardiaque",
  impactMusculaire: "Impact musculaire",
  fatigue: "Fatigue",
  concentration: "Concentration",
  confiance: "Confiance",
  bienEtre: "Bien-être",
  nervosite: "Nervosité",
  sommeil: "Sommeil",
  technique: "Technique",
  tactique: "Tactique",
  dynamisme: "Dynamisme",
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

  const CYAN = "#00E0FF";
  const BG = "#0A0F1E";

  // Initialisation : teamId fixé par les props (admin) ou résolu depuis l'utilisateur (coach)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadingInit(true);
      try {
        const user = auth.currentUser;
        if (!user) {
          throw new Error("Utilisateur non authentifié");
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
            throw new Error("Aucune équipe associée au coach.");
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

  // Charger les membres de l'équipe + poste depuis users/{uid}
  useEffect(() => {
    let cancelled = false;
    if (!selectedTeamId) return;

    (async () => {
      try {
        console.log("selectedTeamId:", selectedTeamId);
        const memSnap = await getDocs(
          collection(db, "teams", selectedTeamId, "members")
        );
        if (cancelled) return;
        const baseList: Member[] = memSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            displayName: data.displayName || data.name || undefined,
            fullName: data.fullName || undefined,
            firstName: data.firstName || undefined,
            lastName: data.lastName || undefined,
          };
        });
        const withPosition: Member[] = await Promise.all(
          baseList.map(async (m) => {
            try {
              const userSnap = await getDoc(doc(db, "users", m.id));
              const userData = (userSnap.data() as any) || {};
              const position = userData.position ?? undefined;
              return { ...m, position };
            } catch {
              return m;
            }
          })
        );
        if (!cancelled) setMembers(withPosition);
      } catch (e) {
        console.error("[PERF][DASH] load members error", e);
      }
    })();

    return () => {
      cancelled = true;
    };
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

  const athleteLabel = (uid: string): string => {
    const m = members.find((x) => x.id === uid);
    if (!m) return uid;
    if (m.fullName) return m.fullName;
    if (m.displayName) return m.displayName;
    if (m.firstName || m.lastName) {
      return `${m.firstName || ""} ${m.lastName || ""}`.trim();
    }
    return uid;
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

  const [openPlayers, setOpenPlayers] = useState(false);
  const [openPosition, setOpenPosition] = useState(false);
  const [openIndicators, setOpenIndicators] = useState(false);

  const filterBoxStyle = {
    background: "#0D1526",
    borderRadius: 12,
    padding: 12,
    border: "1px solid rgba(0,224,255,0.2)",
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
        background: "radial-gradient(ellipse at top, #0D1F3C 0%, #0A0F1E 60%)",
        backgroundColor: BG,
        color: "#FFFFFF",
        padding: 24,
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
              }}
            >
              {teamNameFromRoute
                ? `Performance • ${teamNameFromRoute}`
                : "Performance Dashboard"}
            </h1>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
              Visualisation des questionnaires par joueur, catégorie et période.
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
          {/* Joueurs (multi-select) */}
          <div style={{ ...filterBoxStyle, position: "relative" }}>
            <label style={labelStyle}>Joueurs</label>
            <button
              type="button"
              onClick={() => { setOpenPosition(false); setOpenIndicators(false); setOpenPlayers((v) => !v); }}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid rgba(0,224,255,0.2)",
                background: "#0D1526",
                color: "#FFFFFF",
                fontSize: 14,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              {selectedPlayerIds.length === 0
                ? "Tous les joueurs"
                : selectedPlayerIds.length === 1
                  ? athleteLabel(selectedPlayerIds[0])
                  : `${selectedPlayerIds.length} joueurs sélectionnés`}
            </button>
            {openPlayers && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  marginTop: 4,
                  padding: 8,
                  background: "#0D1526",
                  border: "1px solid rgba(0,224,255,0.2)",
                  borderRadius: 8,
                  zIndex: 10,
                  maxHeight: 280,
                  overflowY: "auto",
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", color: "#FFFFFF", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={selectedPlayerIds.length === 0}
                    onChange={() => setSelectedPlayerIds([])}
                    style={checkboxStyle}
                  />
                  Tous les joueurs
                </label>
                {membersFilteredByPosition.map((m) => {
                  const name = m.fullName || [m.firstName, m.lastName].filter(Boolean).join(" ") || m.id;
                  const checked = selectedPlayerIds.includes(m.id);
                  return (
                    <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", color: "#fff", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          if (checked) setSelectedPlayerIds((ids) => ids.filter((id) => id !== m.id));
                          else setSelectedPlayerIds((ids) => [...ids, m.id]);
                        }}
                        style={checkboxStyle}
                      />
                      {name}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Poste (multi-select) */}
          <div style={{ ...filterBoxStyle, position: "relative" }}>
            <label style={labelStyle}>Poste</label>
            <button
              type="button"
              onClick={() => { setOpenPlayers(false); setOpenIndicators(false); setOpenPosition((v) => !v); }}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid rgba(0,224,255,0.2)",
                background: "#0D1526",
                color: "#FFFFFF",
                fontSize: 14,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              {selectedPositions.length === 0 ? "Tous les postes" : `${selectedPositions.length} poste(s)`}
            </button>
            {openPosition && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  marginTop: 4,
                  padding: 8,
                  background: "#0D1526",
                  border: "1px solid rgba(0,224,255,0.2)",
                  borderRadius: 8,
                  zIndex: 10,
                  maxHeight: 220,
                  overflowY: "auto",
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", color: "#FFFFFF", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={selectedPositions.length === 0}
                    onChange={() => setSelectedPositions([])}
                    style={checkboxStyle}
                  />
                  Tous les postes
                </label>
                {positions.map((p) => {
                  const checked = selectedPositions.includes(p);
                  return (
                    <label key={p} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", color: "#fff", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          if (checked) setSelectedPositions((arr) => arr.filter((x) => x !== p));
                          else setSelectedPositions((arr) => [...arr, p]);
                        }}
                        style={checkboxStyle}
                      />
                      {p}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Durée : toggle Période prédéfinie / Dates personnalisées */}
          <div style={filterBoxStyle}>
            <label style={labelStyle}>Durée</label>
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
                Période prédéfinie
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
                Dates personnalisées
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
                      border: "1px solid rgba(0,224,255,0.2)",
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
                    border: "1px solid rgba(0,224,255,0.2)",
                    background: "#0D1526",
                    color: "#FFFFFF",
                    fontSize: 14,
                    colorScheme: "dark",
                  }}
                />
              </div>
            )}
          </div>

          {/* Indicateurs : toggle Par catégorie / Par indicateur */}
          <div style={{ ...filterBoxStyle, position: "relative", gridColumn: "span 1" }}>
            <label style={labelStyle}>Indicateurs</label>
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
                Par catégorie
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
                Par indicateur
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
                    border: "1px solid rgba(0,224,255,0.2)",
                    background: "#0D1526",
                    color: "#FFFFFF",
                    fontSize: 14,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  {selectedIndicators.length === 0 ? "Tous" : `${selectedIndicators.length} indicateur(s)`}
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
                      border: "1px solid rgba(0,224,255,0.2)",
                      borderRadius: 8,
                      zIndex: 10,
                      maxHeight: 320,
                      overflowY: "auto",
                    }}
                  >
                    {(Object.keys(ALL_INDICATORS_BY_CATEGORY) as CategoryKey[]).map((cat) => (
                      <div key={cat} style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, color: CATEGORY_COLORS[cat], marginBottom: 6 }}>
                          {cat === "physical" && "🔵 Physique"}
                          {cat === "mental" && "🟢 Mental"}
                          {cat === "technical" && "🟡 Technique"}
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
                              {INDICATOR_LABELS_FR[key] || key}
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

          {/* View Mode */}
          <div style={filterBoxStyle}>
            <label style={labelStyle}>View Mode</label>
            <div style={{ display: "flex", gap: 6 }}>
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
          </div>

          {/* Chart Type */}
          <div style={filterBoxStyle}>
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
            border: "1px solid rgba(0,224,255,0.15)",
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
                Chargement des données...
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
              Aucune équipe sélectionnée
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
              Aucune donnée sur la période sélectionnée.
            </div>
          ) : (
            <div style={{ height: 360 }}>
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "line" ? (
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.6)" />
                    <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.6)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0E1528",
                        border: "1px solid #00E0FF",
                        borderRadius: 8,
                        color: "#FFFFFF",
                      }}
                    />
                    <Legend />
                    {seriesKeys.map((k, idx) => {
                      const color =
                        viewMode === "categories"
                          ? (indicatorMode === "indicator" ? CATEGORY_COLORS[getIndicatorCategory(k)] : categoryColor)
                          : `hsl(${(idx * 55) % 360}, 85%, 60%)`;
                      const name =
                        viewMode === "categories"
                          ? (indicatorMode === "indicator" ? (INDICATOR_LABELS_FR[k] || k) : k)
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
                    margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.6)" />
                    <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.6)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0E1528",
                        border: "1px solid #00E0FF",
                        borderRadius: 8,
                        color: "#FFFFFF",
                      }}
                    />
                    <Legend />
                    {seriesKeys.map((k, idx) => {
                      const color =
                        viewMode === "categories"
                          ? (indicatorMode === "indicator" ? CATEGORY_COLORS[getIndicatorCategory(k)] : categoryColor)
                          : `hsl(${(idx * 55) % 360}, 85%, 60%)`;
                      const name =
                        viewMode === "categories"
                          ? (indicatorMode === "indicator" ? (INDICATOR_LABELS_FR[k] || k) : k)
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


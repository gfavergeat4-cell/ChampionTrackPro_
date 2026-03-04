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
  "7d": "7 jours",
  "14d": "14 jours",
  "30d": "30 jours",
  "90d": "3 mois",
};

function getDateRange(key: DurationKey): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  const days = key === "7d" ? 7 : key === "14d" ? 14 : key === "30d" ? 30 : 90;
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
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

  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(
    route?.params?.teamId || null
  );

  const [members, setMembers] = useState<Member[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | "all">(
    "all"
  );

  const [duration, setDuration] = useState<DurationKey>("30d");
  const [category, setCategory] = useState<CategoryKey>("physical");
  const [viewMode, setViewMode] = useState<ViewMode>("categories");
  const [chartType, setChartType] = useState<ChartType>("line");

  const [loadingInit, setLoadingInit] = useState<boolean>(true);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [responses, setResponses] = useState<RawResponse[]>([]);

  const CYAN = "#00E0FF";
  const BG = "#0A0F1E";

  // Initialisation : résolution du teamId + chargement des teams pour l'admin
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadingInit(true);
      try {
        const user = auth.currentUser;
        if (!user) {
          throw new Error("Utilisateur non authentifié");
        }

        let teamId = selectedTeamId;

        if (role === "coach") {
          if (!teamId) {
            const userSnap = await getDoc(doc(db, "users", user.uid));
            const data = userSnap.data() || {};
            teamId = data.teamId || null;
          }
          if (!teamId) {
            throw new Error("Aucune équipe associée au coach.");
          }
          if (!cancelled) setSelectedTeamId(teamId);
        } else if (role === "admin") {
          const snap = await getDocs(collection(db, "teams"));
          const t: Team[] = snap.docs.map((d) => ({
            id: d.id,
            name: (d.data() as any)?.name,
          }));
          if (!cancelled) {
            setTeams(t);
            if (!teamId && t.length > 0) {
              setSelectedTeamId(t[0].id);
            }
          }
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
  }, [role]);

  // Charger les membres de l'équipe sélectionnée
  useEffect(() => {
    let cancelled = false;
    if (!selectedTeamId) return;

    (async () => {
      try {
        const memSnap = await getDocs(
          collection(db, "teams", selectedTeamId, "members")
        );
        if (cancelled) return;
        const m: Member[] = memSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            displayName: data.displayName || data.name || undefined,
            fullName: data.fullName || undefined,
            firstName: data.firstName || undefined,
            lastName: data.lastName || undefined,
          };
        });
        setMembers(m);
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
        const { start, end } = getDateRange(duration);
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
  }, [selectedTeamId, duration]);

  const filteredResponses = useMemo(() => {
    if (selectedAthleteId === "all") return responses;
    return responses.filter((r) => r.userId === selectedAthleteId);
  }, [responses, selectedAthleteId]);

  const chartData: ChartPoint[] = useMemo(() => {
    if (!selectedTeamId || filteredResponses.length === 0) return [];

    const { start, end } = getDateRange(duration);

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

    if (viewMode === "categories") {
      const fields = CATEGORY_FIELDS[category];
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

    // Individual: une série par athlète, valeur = moyenne de la catégorie par jour
    const fields = CATEGORY_FIELDS[category];
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
  }, [filteredResponses, duration, category, viewMode, selectedTeamId]);

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

  const categoryColor = CATEGORY_COLORS[category];

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: BG,
        color: "white",
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
            <p style={{ color: "#9CA3AF", fontSize: 14 }}>
              Visualisation des questionnaires par joueur, catégorie et période.
            </p>
          </div>
        </div>

        {/* Filtres */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          {role === "admin" && (
            <div
              style={{
                background: "#111827",
                borderRadius: 12,
                padding: 12,
                border: "1px solid rgba(156,163,175,0.35)",
              }}
            >
              <label
                style={{
                  fontSize: 12,
                  color: "#9CA3AF",
                  marginBottom: 4,
                  display: "block",
                }}
              >
                Team
              </label>
              <select
                value={selectedTeamId || ""}
                onChange={(e) =>
                  setSelectedTeamId(e.target.value || null)
                }
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(55,65,81,0.9)",
                  background: "#020617",
                  color: "white",
                  fontSize: 14,
                }}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name || t.id}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div
            style={{
              background: "#111827",
              borderRadius: 12,
              padding: 12,
              border: "1px solid rgba(156,163,175,0.35)",
            }}
          >
            <label
              style={{
                fontSize: 12,
                color: "#9CA3AF",
                marginBottom: 4,
                display: "block",
              }}
            >
              Athlète
            </label>
            <select
              value={selectedAthleteId}
              onChange={(e) =>
                setSelectedAthleteId(e.target.value as any)
              }
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid rgba(55,65,81,0.9)",
                background: "#020617",
                color: "white",
                fontSize: 14,
              }}
            >
              <option value="all">All Players</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {athleteLabel(m.id)}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              background: "#111827",
              borderRadius: 12,
              padding: 12,
              border: "1px solid rgba(156,163,175,0.35)",
            }}
          >
            <label
              style={{
                fontSize: 12,
                color: "#9CA3AF",
                marginBottom: 4,
                display: "block",
              }}
            >
              Durée
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              {(["7d", "14d", "30d", "90d"] as DurationKey[]).map((d) => {
                const active = duration === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      borderRadius: 999,
                      fontSize: 12,
                      border: active
                        ? `1px solid ${CYAN}`
                        : "1px solid rgba(75,85,99,1)",
                      background: active
                        ? "rgba(0,224,255,0.15)"
                        : "transparent",
                      color: active ? CYAN : "#D1D5DB",
                      cursor: "pointer",
                    }}
                  >
                    {DURATION_LABEL[d]}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            style={{
              background: "#111827",
              borderRadius: 12,
              padding: 12,
              border: "1px solid rgba(156,163,175,0.35)",
            }}
          >
            <label
              style={{
                fontSize: 12,
                color: "#9CA3AF",
                marginBottom: 4,
                display: "block",
              }}
            >
              Category
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              {(["physical", "mental", "technical"] as CategoryKey[]).map(
                (c) => {
                  const active = category === c;
                  const color = CATEGORY_COLORS[c];
                  return (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      style={{
                        flex: 1,
                        padding: "6px 8px",
                        borderRadius: 999,
                        fontSize: 12,
                        border: active
                          ? `1px solid ${color}`
                          : "1px solid rgba(75,85,99,1)",
                        background: active
                          ? "rgba(17,24,39,0.9)"
                          : "transparent",
                        color: active ? color : "#D1D5DB",
                        cursor: "pointer",
                      }}
                    >
                      {CATEGORY_LABEL[c]}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          <div
            style={{
              background: "#111827",
              borderRadius: 12,
              padding: 12,
              border: "1px solid rgba(156,163,175,0.35)",
            }}
          >
            <label
              style={{
                fontSize: 12,
                color: "#9CA3AF",
                marginBottom: 4,
                display: "block",
              }}
            >
              View Mode
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              {(["categories", "individual"] as ViewMode[]).map((m) => {
                const active = viewMode === m;
                return (
                  <button
                    key={m}
                    onClick={() => setViewMode(m)}
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      borderRadius: 999,
                      fontSize: 12,
                      border: active
                        ? `1px solid ${CYAN}`
                        : "1px solid rgba(75,85,99,1)",
                      background: active
                        ? "rgba(0,224,255,0.15)"
                        : "transparent",
                      color: active ? CYAN : "#D1D5DB",
                      cursor: "pointer",
                    }}
                  >
                    {m === "categories" ? "Categories" : "Individual"}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            style={{
              background: "#111827",
              borderRadius: 12,
              padding: 12,
              border: "1px solid rgba(156,163,175,0.35)",
            }}
          >
            <label
              style={{
                fontSize: 12,
                color: "#9CA3AF",
                marginBottom: 4,
                display: "block",
              }}
            >
              Chart Type
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              {(["line", "bar"] as ChartType[]).map((t) => {
                const active = chartType === t;
                return (
                  <button
                    key={t}
                    onClick={() => setChartType(t)}
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      borderRadius: 999,
                      fontSize: 12,
                      border: active
                        ? `1px solid ${CYAN}`
                        : "1px solid rgba(75,85,99,1)",
                      background: active
                        ? "rgba(0,224,255,0.15)"
                        : "transparent",
                      color: active ? CYAN : "#D1D5DB",
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
            background: "#020617",
            borderRadius: 16,
            padding: 20,
            border: "1px solid rgba(30,64,175,0.6)",
            boxShadow: "0 24px 60px rgba(15,23,42,0.8)",
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
                  color: "#9CA3AF",
                  fontSize: 14,
                }}
              >
                Chargement des données...
              </span>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                    <XAxis dataKey="date" stroke="#9CA3AF" />
                    <YAxis domain={[0, 100]} stroke="#9CA3AF" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#020617",
                        border: "1px solid #1F2937",
                        borderRadius: 8,
                        color: "#F9FAFB",
                      }}
                    />
                    <Legend />
                    {seriesKeys.map((k, idx) => {
                      const color =
                        viewMode === "categories"
                          ? categoryColor
                          : `hsl(${(idx * 55) % 360}, 85%, 60%)`;
                      const name =
                        viewMode === "categories" ? k : athleteLabel(k);
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                    <XAxis dataKey="date" stroke="#9CA3AF" />
                    <YAxis domain={[0, 100]} stroke="#9CA3AF" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#020617",
                        border: "1px solid #1F2937",
                        borderRadius: 8,
                        color: "#F9FAFB",
                      }}
                    />
                    <Legend />
                    {seriesKeys.map((k, idx) => {
                      const color =
                        viewMode === "categories"
                          ? categoryColor
                          : `hsl(${(idx * 55) % 360}, 85%, 60%)`;
                      const name =
                        viewMode === "categories" ? k : athleteLabel(k);
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


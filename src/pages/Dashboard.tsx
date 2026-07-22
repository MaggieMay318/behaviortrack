import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useLegacyToken } from "../lib/auth";
import { BarChart3, Sparkles, ClipboardList, Users, AlertTriangle, Bell, TrendingUp, Phone, FileText, CheckCircle, Star } from "lucide-react";

/* ── Types ─────────────────────────────────────────── */
interface DashboardStats {
  totalEntriesThisWeek: number;
  weeklyChangePct: number;
  positiveCount: number;
  correctiveCount: number;
  activeStudentsCount: number;
  pendingDocs: number;
  followUpsDue: number;
  parentContactsPending: number;
  interventionSuccessRate: number;
}

interface DayEntry { day: string; positive: number; corrective: number; }
interface TimeEntry { label: string; count: number; }
interface CategoryEntry { name: string; count: number; }
interface InterventionEntry {
  name: string;
  stopped: number;
  decreased: number;
  continued: number;
  escalated: number;
}
interface StudentTrend { id: number; name: string; initials: string; recent: number; prior: number; change: number; }
interface DashboardEntry {
  id: number;
  student_name: string;
  student_initials: string;
  entry_type: string;
  date: string;
  time: string;
  objective_observation: string;
  doc_status: string;
}
interface AlertItem { type: string; message: string; detail: string; priority: string; }

interface DashboardData {
  stats: DashboardStats;
  entriesByDay: DayEntry[];
  entriesByTime: TimeEntry[];
  positiveVsCorrective: { positive: number; corrective: number };
  topCategories: CategoryEntry[];
  topTriggers: CategoryEntry[];
  interventionEffectiveness: InterventionEntry[];
  studentsIncreased: StudentTrend[];
  studentsImproved: StudentTrend[];
  recentEntries: DashboardEntry[];
  byType: { entry_type: string; count: number }[];
  alerts: AlertItem[];
}

/* ── Helpers ───────────────────────────────────────── */
const entryTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    positive: "Positive", minor_concern: "Minor", moderate_concern: "Moderate",
    major_concern: "Major", crisis: "Crisis",
  };
  return labels[type] || type;
};
const entryTypeClass = (type: string): string => {
  const classes: Record<string, string> = {
    positive: "badge--positive", minor_concern: "badge--minor",
    moderate_concern: "badge--moderate", major_concern: "badge--major",
    crisis: "badge--crisis",
  };
  return classes[type] || "badge--neutral";
};
const timeAgo = (dateStr: string): string => {
  const d = new Date(dateStr + "T12:00:00");
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff}d ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  return `${Math.floor(diff / 30)}mo ago`;
};

/* ── Chart colors ──────────────────────────────────── */
const CHART_POS = "var(--color-chart-positive)";
const CHART_CORR = "var(--color-chart-corrective)";

/* ── SVG Chart Components ──────────────────────────── */

function EntriesByDayChart({ data }: { data: DayEntry[] }) {
  if (!data.length || data.every(d => d.positive + d.corrective === 0)) {
    return <div className="text-sm text-muted text-center" style={{ padding: "var(--space-xl)" }}>No entries this week</div>;
  }
  const maxVal = Math.max(...data.map(d => d.positive + d.corrective), 1);
  const w = 300; const h = 160; const pad = { top: 8, right: 8, bottom: 24, left: 8 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const barW = chartW / data.length - 4;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Entries by day of week">
      {data.map((d, i) => {
        const x = pad.left + i * (chartW / data.length) + 2;
        const total = d.positive + d.corrective;
        const barH = maxVal > 0 ? (total / maxVal) * chartH : 0;
        const posH = maxVal > 0 ? (d.positive / maxVal) * chartH : 0;
        const corrH = maxVal > 0 ? (d.corrective / maxVal) * chartH : 0;
        const y = pad.top + chartH - barH;
        return (
          <g key={d.day}>
            {d.corrective > 0 && (
              <rect x={x} y={pad.top + chartH - corrH} width={barW} height={Math.max(corrH, 1)} fill={CHART_CORR} rx="3" />
            )}
            {d.positive > 0 && (
              <rect x={x} y={pad.top + chartH - barH} width={barW} height={Math.max(posH, 1)} fill={CHART_POS} rx="3" />
            )}
            <text x={x + barW / 2} y={h - 4} textAnchor="middle" fontSize="9" fill="var(--color-gray-500)">{d.day}</text>
            {total > 0 && (
              <text x={x + barW / 2} y={y - 2} textAnchor="middle" fontSize="9" fill="var(--color-gray-600)">{total}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function TimeOfDayChart({ data }: { data: TimeEntry[] }) {
  if (!data.length) return null;
  const maxVal = Math.max(...data.map(d => d.count), 1);
  const w = 240; const h = 140; const pad = { top: 8, right: 16, bottom: 24, left: 16 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const barH = chartH / data.length - 8;
  const colors = ["var(--color-chart-neutral)", "#E0A04A", "var(--color-chart-positive)"];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Entries by time of day">
      {data.map((d, i) => {
        const y = pad.top + i * (chartH / data.length);
        const bw = maxVal > 0 ? (d.count / maxVal) * chartW : 0;
        return (
          <g key={d.label}>
            <text x={pad.left} y={y + barH / 2 + 3} fontSize="10" fill="var(--color-gray-600)" textAnchor="end">{d.label}</text>
            <rect x={pad.left + 4} y={y} width={Math.max(bw, 2)} height={barH} fill={colors[i] || "var(--color-primary)"} rx="3" />
            <text x={pad.left + 4 + bw + 4} y={y + barH / 2 + 4} fontSize="10" fill="var(--color-gray-700)" fontWeight="600">{d.count}</text>
          </g>
        );
      })}
    </svg>
  );
}

function DonutChart({ positive, corrective }: { positive: number; corrective: number }) {
  const total = positive + corrective;
  if (total === 0) return <div className="text-sm text-muted text-center" style={{ padding: "var(--space-xl)" }}>No entries yet</div>;
  const r = 46; const c = 64; const circ = 2 * Math.PI * r;
  const posPct = positive / total;
  const posLen = circ * posPct;
  const corrLen = circ - posLen;

  return (
    <svg viewBox="0 0 128 128" style={{ width: "100%", maxWidth: "180px", height: "auto" }} role="img" aria-label={`${positive} positive, ${corrective} corrective`}>
      <defs>
        <filter id="donutShadow">
          <feDropShadow dx="0" dy="0" stdDeviation="2" floodOpacity="0.12" />
        </filter>
      </defs>
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--color-gray-100)" strokeWidth="18" />
      <circle cx={c} cy={c} r={r} fill="none" stroke={CHART_POS} strokeWidth="18"
        strokeDasharray={`${posLen} ${circ - posLen}`} strokeDashoffset="0" transform={`rotate(-90 ${c} ${c})`}
        strokeLinecap="round" filter="url(#donutShadow)" />
      {corrective > 0 && (
        <circle cx={c} cy={c} r={r} fill="none" stroke={CHART_CORR} strokeWidth="18"
          strokeDasharray={`${corrLen} ${circ - corrLen}`}
          strokeDashoffset={-posLen} transform={`rotate(-90 ${c} ${c})`}
          strokeLinecap="round" />
      )}
      <text x={c} y={c - 4} textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--color-gray-800)">{total}</text>
      <text x={c} y={c + 14} textAnchor="middle" fontSize="10" fill="var(--color-gray-500)">entries</text>
    </svg>
  );
}

function HorizontalBarChart({ data, color }: { data: CategoryEntry[]; color: string }) {
  if (!data.length) return <div className="text-sm text-muted text-center" style={{ padding: "var(--space-xl)" }}>No data available</div>;
  const maxVal = Math.max(...data.map(d => d.count), 1);
  const barH = 22; const gap = 6;
  const h = data.length * (barH + gap) + 8;

  return (
    <svg viewBox={`0 0 320 ${h}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Horizontal bar chart">
      {data.map((d, i) => {
        const y = i * (barH + gap) + 4;
        const bw = Math.max((d.count / maxVal) * 180, 4);
        return (
          <g key={d.name}>
            <text x={0} y={y + barH / 2 + 3} fontSize="10" fill="var(--color-gray-700)">
              {d.name.length > 18 ? d.name.slice(0, 17) + "\u2026" : d.name}
            </text>
            <rect x={190} y={y} width={bw} height={barH} fill={color} rx="3" opacity="0.85" />
            <text x={190 + bw + 4} y={y + barH / 2 + 3} fontSize="10" fill="var(--color-gray-600)" fontWeight="600">{d.count}</text>
          </g>
        );
      })}
    </svg>
  );
}

function InterventionChart({ data }: { data: InterventionEntry[] }) {
  if (!data.length) return <div className="text-sm text-muted text-center" style={{ padding: "var(--space-xl)" }}>No intervention data</div>;
  const colors = { stopped: "var(--color-chart-positive)", decreased: "#7CC89A", continued: "#E0A04A", escalated: "var(--color-chart-corrective)" };
  const labels = { stopped: "Stopped", decreased: "Decreased", continued: "Continued", escalated: "Escalated" };
  const maxTotal = Math.max(...data.map(d => d.stopped + d.decreased + d.continued + d.escalated), 1);
  const barH = 22; const gap = 6;
  const h = data.length * (barH + gap) + 40;

  return (
    <svg viewBox={`0 0 360 ${h}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Intervention effectiveness">
      {Object.entries(colors).map(([key, c], li) => (
        <g key={key}>
          <rect x={li * 80} y={0} width={10} height={10} fill={c} rx="2" />
          <text x={li * 80 + 14} y={10} fontSize="9" fill="var(--color-gray-500)">{labels[key as keyof typeof labels]}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const y = i * (barH + gap) + 20;
        const total = d.stopped + d.decreased + d.continued + d.escalated;
        const scale = total > 0 ? 200 / maxTotal : 0;
        let xOff = 0;
        const segments = [
          { val: d.stopped, c: colors.stopped },
          { val: d.decreased, c: colors.decreased },
          { val: d.continued, c: colors.continued },
          { val: d.escalated, c: colors.escalated },
        ];
        return (
          <g key={d.name}>
            <text x={95} y={y + barH / 2 + 3} fontSize="9" fill="var(--color-gray-700)" textAnchor="end">
              {d.name.length > 12 ? d.name.slice(0, 11) + "\u2026" : d.name}
            </text>
            {segments.map(seg => {
              const sw = Math.max(seg.val * scale, 0);
              const rect = seg.val > 0 ? (
                <rect key={`${d.name}-${seg.c}`} x={100 + xOff} y={y} width={sw} height={barH} fill={seg.c} rx="2" opacity="0.85" />
              ) : null;
              xOff += sw;
              return rect;
            })}
            <text x={100 + xOff + 4} y={y + barH / 2 + 3} fontSize="9" fill="var(--color-gray-600)">{total}</text>
          </g>
        );
      })}
    </svg>
  );
}

function StudentTrendChart({ data, type }: { data: StudentTrend[]; type: "increased" | "improved" }) {
  if (!data.length) {
    const msg = type === "increased" ? "No students showing increased incidents" : "No students showing improvement trends";
    return <div className="text-sm text-muted text-center" style={{ padding: "var(--space-lg)" }}>{msg}</div>;
  }
  const color = type === "increased" ? CHART_CORR : CHART_POS;
  const maxVal = Math.max(...data.map(d => Math.max(d.recent, d.prior)), 1);
  const w = 280; const h = Math.max(data.length * 36 + 24, 80);
  const barH = 14; const gap = 22;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }} role="img" aria-label={`Students ${type}`}>
      {data.map((d, i) => {
        const y = i * (barH * 2 + gap) + 10;
        const rw = (d.recent / maxVal) * 80;
        const pw = (d.prior / maxVal) * 80;
        return (
          <g key={d.id}>
            <text x={0} y={y + barH - 2} fontSize="10" fill="var(--color-gray-700)" fontWeight="600">{d.initials}</text>
            <text x={32} y={y + barH - 2} fontSize="9" fill="var(--color-gray-500)">Recent</text>
            <rect x={82} y={y} width={Math.max(rw, 2)} height={barH} fill={color} rx="3" opacity="0.85" />
            <text x={82 + rw + 4} y={y + barH - 3} fontSize="9" fill="var(--color-gray-600)">{d.recent}</text>

            <text x={32} y={y + barH + 16} fontSize="9" fill="var(--color-gray-400)">Prior</text>
            <rect x={82} y={y + barH + 4} width={Math.max(pw, 2)} height={barH} fill="var(--color-gray-300)" rx="3" />
            <text x={82 + pw + 4} y={y + barH + 14} fontSize="9" fill="var(--color-gray-500)">{d.prior}</text>

            <text x={180} y={y + barH / 2 + 8} fontSize="10" fill={color} fontWeight="600">
              {type === "increased" ? `+${d.change}%` : `-${d.change}%`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Main Dashboard ────────────────────────────────── */
export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const { legacyToken: token } = useLegacyToken();

  const fetchDashboard = () => {
    if (!token) return;
    setLoading(true);
    setError("");
    fetch("/api/dashboard/stats", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDashboard();
  }, [token]);

  if (loading) return (
    <div className="loading" aria-busy="true">
      <span className="spinner spinner--lg" style={{ marginRight: "var(--space-sm)" }} />
      Loading dashboard...
    </div>
  );
  if (error) return (
    <div className="alert alert--error">
      <p style={{ marginBottom: "var(--space-sm)" }}>
        Failed to load dashboard: {error}
      </p>
      <button className="btn btn--primary btn--sm" onClick={fetchDashboard}>
        Retry
      </button>
    </div>
  );
  if (!data) return <div className="empty-state"><span className="empty-state__icon"><BarChart3 size={40} /></span><p>No dashboard data available.</p></div>;

  const { stats, entriesByDay, entriesByTime, positiveVsCorrective, topCategories, topTriggers,
    interventionEffectiveness, studentsIncreased, studentsImproved, recentEntries, alerts } = data;
  const changeArrow = stats.weeklyChangePct >= 0 ? "\u2191" : "\u2193";
  const changeClass = stats.weeklyChangePct >= 0
    ? (stats.weeklyChangePct > 20 ? "var(--color-danger)" : "var(--color-gray-500)")
    : "var(--color-success)";

  return (
    <div>
      <div className="flex items-center justify-between mb-md">
        <h1>Dashboard</h1>
        <Link to="/entry" className="btn btn--primary btn--sm">+ New Entry</Link>
      </div>

      {/* Alerts */}
      {alerts.filter((_, i) => !dismissedAlerts.has(i)).length > 0 && (
        <div style={{ marginBottom: "var(--space-md)" }}>
          {alerts.map((a, i) => {
            if (dismissedAlerts.has(i)) return null;
            const bg = a.priority === "high" ? "var(--color-danger-bg)" : "var(--color-warning-bg)";
            const border = a.priority === "high" ? "#F0C5C5" : "#F0D9B0";
            const textColor = a.priority === "high" ? "#8A1A1A" : "#8A571A";
            return (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: "var(--space-sm)",
                padding: "var(--space-sm) var(--space-md)", marginBottom: "var(--space-sm)",
                background: bg, border: `1px solid ${border}`, borderRadius: "var(--radius-md)",
                fontSize: "0.85rem", color: textColor,
              }}>
                <span style={{ flex: 1 }}>
                  <strong>{a.message}</strong>{" "}
                  <span style={{ opacity: 0.8 }}>{a.detail}</span>
                </span>
                <button
                  onClick={() => setDismissedAlerts(prev => new Set(prev).add(i))}
                  style={{
                    background: "none", border: "none", cursor: "pointer", fontSize: "1rem",
                    color: textColor, opacity: 0.6, padding: "0 4px", lineHeight: 1,
                    display: "flex", alignItems: "center",
                  }}
                  aria-label="Dismiss alert"
                ><AlertTriangle size={16} /></button>
              </div>
            );
          })}
        </div>
      )}

      {/* Stat Cards */}
      <div className="stat-cards-grid">
        <StatCard label="Entries this week" value={stats.totalEntriesThisWeek}
          sub={`${changeArrow} ${Math.abs(stats.weeklyChangePct)}% vs last week`} subColor={changeClass} />
        <StatCard label="Positive entries" value={stats.positiveCount}
          icon={<Star size={18} />} color="var(--color-success)" />
        <StatCard label="Corrective entries" value={stats.correctiveCount}
          icon={<FileText size={18} />} color={stats.correctiveCount > 0 ? "var(--color-danger)" : "var(--color-gray-500)"} />
        <StatCard label="Active students" value={stats.activeStudentsCount}
          icon={<Users size={18} />} color="var(--color-primary)" />
        <StatCard label="Docs pending" value={stats.pendingDocs}
          icon={<ClipboardList size={18} />} color={stats.pendingDocs > 0 ? "var(--color-warning)" : "var(--color-gray-400)"} link="/documentation" />
        <StatCard label="Follow-ups due" value={stats.followUpsDue}
          icon={<Bell size={18} />} color={stats.followUpsDue > 0 ? "var(--color-warning)" : "var(--color-gray-400)"} />
        <StatCard label="Parent contacts" value={stats.parentContactsPending}
          icon={<Phone size={18} />} color={stats.parentContactsPending > 0 ? "var(--color-warning)" : "var(--color-gray-400)"} />
        <StatCard label="Intervention success" value={`${stats.interventionSuccessRate}%`}
          icon={<CheckCircle size={18} />} color={stats.interventionSuccessRate >= 50 ? "var(--color-success)" : "var(--color-warning)"} />
      </div>

      {/* Charts Grid */}
      <h2 className="mb-sm" style={{ marginTop: "var(--space-lg)" }}>Charts &amp; Analysis</h2>
      <div className="charts-grid">
        <ChartCard title="Entries by Day (This Week)">
          <EntriesByDayChart data={entriesByDay} />
        </ChartCard>

        <ChartCard title="Entries by Time of Day">
          <TimeOfDayChart data={entriesByTime} />
        </ChartCard>

        <ChartCard title="Positive vs Corrective">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", flexWrap: "wrap" }}>
            <DonutChart positive={positiveVsCorrective.positive} corrective={positiveVsCorrective.corrective} />
            <div style={{ fontSize: "0.85rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-xs)" }}>
                <span style={{ width: 12, height: 12, background: CHART_POS, borderRadius: 3, display: "inline-block" }} />
                Positive: {positiveVsCorrective.positive}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                <span style={{ width: 12, height: 12, background: CHART_CORR, borderRadius: 3, display: "inline-block" }} />
                Corrective: {positiveVsCorrective.corrective}
              </div>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Top Behavior Categories">
          <HorizontalBarChart data={topCategories} color="var(--color-primary)" />
        </ChartCard>

        <ChartCard title="Possible Triggers">
          <HorizontalBarChart data={topTriggers} color="var(--color-warning)" />
        </ChartCard>

        <ChartCard title="Intervention Effectiveness">
          <InterventionChart data={interventionEffectiveness} />
        </ChartCard>

        <ChartCard title="Students with Increased Incidents (14-day trend)">
          <StudentTrendChart data={studentsIncreased} type="increased" />
        </ChartCard>

        <ChartCard title="Students Showing Improvement (14-day trend)">
          <StudentTrendChart data={studentsImproved} type="improved" />
        </ChartCard>
      </div>

      {/* Recent Activity */}
      <h2 className="mb-sm" style={{ marginTop: "var(--space-lg)" }}>Recent Activity</h2>
      {recentEntries.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__icon"><FileText size={40} /></span>
          <p>No behavior entries yet.</p>
          <Link to="/entry" className="btn btn--primary mt-md">Create First Entry</Link>
        </div>
      ) : (
        <>
          {recentEntries.map((entry) => (
            <Link to={`/entry/${entry.id}`} key={entry.id}
              style={{ textDecoration: "none", color: "inherit", display: "block" }}>
              <div className="card" style={{ cursor: "pointer" }}>
                <div className="card__header">
                  <div className="flex items-center gap-sm">
                    <span className="student-avatar">{entry.student_initials}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.925rem" }}>{entry.student_name}</div>
                      <div className="text-sm text-muted">{timeAgo(entry.date)} at {entry.time || "\u2014"}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
                    <span className={`badge ${entryTypeClass(entry.entry_type)}`}>
                      {entryTypeLabel(entry.entry_type)}
                    </span>
                    {entry.doc_status === "required_pending" && (
                      <span className="badge badge--pending">Docs needed</span>
                    )}
                  </div>
                </div>
                <div className="card__body">
                  <p style={{ marginBottom: 0, fontSize: "0.875rem" }}>
                    {entry.objective_observation
                      ? entry.objective_observation.slice(0, 150) + (entry.objective_observation.length > 150 ? "..." : "")
                      : <span className="text-muted">No observation recorded</span>}
                  </p>
                </div>
              </div>
            </Link>
          ))}
          <div className="text-center mt-md">
            <Link to="/reports" className="btn btn--ghost">View all entries \u2192</Link>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, subColor, icon, color, link }: {
  label: string;
  value: string | number;
  sub?: string;
  subColor?: string;
  icon?: React.ReactNode;
  color?: string;
  link?: string;
}) {
  const content = (
    <div className="stat-card">
      {icon && <div className="stat-card__icon" style={color ? { color } : {}}>{icon}</div>}
      <div className="stat-card__value" style={color ? { color } : {}}>{value}</div>
      <div className="stat-card__label">{label}</div>
      {sub && <div className="stat-card__sub" style={subColor ? { color: subColor } : {}}>{sub}</div>}
    </div>
  );

  if (link) {
    return <Link to={link} style={{ textDecoration: "none" }}>{content}</Link>;
  }
  return content;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="chart-card">
      <div className="chart-card__title">{title}</div>
      <div className="chart-card__body">{children}</div>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useLegacyToken } from "../lib/auth";
import {
  FileText, Star, Users, CalendarClock, Phone, Building2, ClipboardList, Bell,
  PlusCircle, Target, User, AlertTriangle, ChevronDown, ChevronRight
} from "lucide-react";

/* ── Types ─────────────────────────────────────────── */
interface StudentData {
  id: number; display_name: string; initials: string; local_id: string;
  grade: string; classroom: string; active: number;
}
interface ProfileStats {
  totalEntries: number; positiveEntries: number; correctiveEntries: number;
  entriesThisWeek: number; parentContacts: number; counselorAdminContacts: number;
  pendingDocs: number; followUpsDue: number;
  pointsAwarded: number; pointsThisWeek: number;
}
interface Goal {
  id: number; title: string; description: string; status: string;
  start_date: string; review_date: string; target_behavior: string;
  measurement_method: string; baseline: string; target: string;
  tracking_frequency: string; responsible_staff: string; supports: string;
  latestProgress: { rating: number; date: string; notes: string } | null;
  progressCount: number;
}
interface Entry {
  id: number; student_id: number; date: string; time: string;
  subject_activity: string; location: string; entry_type: string;
  behavior_categories: string; objective_observation: string;
  possible_triggers: string; interventions: string; student_response: string;
  outcome: string; people_involved: string; duration_minutes: number;
  parent_contact_status: string; admin_contact_status: string;
  counselor_contact_status: string; follow_up_date: string;
  doc_status: string; doc_system_name: string;
  points: number;
}
interface ChartCategory { name: string; count: number; }
interface ChartWeek { week: string; positive: number; corrective: number; }
interface ChartDay { day: string; count: number; }
interface ChartIntervention {
  name: string; stopped: number; decreased: number; continued: number; escalated: number;
}
interface EntryStats {
  byWeek: ChartWeek[]; pointsByWeek: { week: string; points: number }[]; byDayOfWeek: ChartDay[];
  bySubject: ChartCategory[]; byLocation: ChartCategory[]; byCategory: ChartCategory[];
  byTrigger: ChartCategory[]; byIntervention: ChartIntervention[];
  positiveVsCorrectiveOverTime: ChartWeek[];
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
const goalStatusLabel = (status: string): string => {
  const l: Record<string, string> = {
    not_started: "Not Started", in_progress: "In Progress", improving: "Improving",
    goal_met: "Goal Met", needs_revision: "Needs Revision", discontinued: "Discontinued",
  };
  return l[status] || status;
};
const goalStatusClass = (status: string): string => {
  const c: Record<string, string> = {
    not_started: "badge--neutral", in_progress: "badge--minor", improving: "badge--positive",
    goal_met: "badge--completed", needs_revision: "badge--moderate", discontinued: "badge--major",
  };
  return c[status] || "badge--neutral";
};
function parseJsonArray(val: string): string[] {
  try { return JSON.parse(val); } catch { return []; }
}

/* ── Chart colors ──────────────────────────────────── */
const CP = "var(--color-chart-positive)";
const CC = "var(--color-chart-corrective)";

/* ── SVG Chart Components ──────────────────────────── */
function BarChartWeek({ data }: { data: ChartWeek[] }) {
  const totalPerWeek = data.map(d => d.positive + d.corrective);
  const maxVal = Math.max(...totalPerWeek, 1);
  if (totalPerWeek.every(v => v === 0)) {
    return <div className="text-sm text-muted text-center" style={{ padding: "var(--space-xl)" }}>No entries in this period</div>;
  }
  const w = 320; const h = 170; const pad = { top: 10, right: 8, bottom: 30, left: 8 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const barW = Math.max(chartW / data.length - 6, 8);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Entries by week">
      {data.map((d, i) => {
        const x = pad.left + i * (chartW / data.length) + 3;
        const total = d.positive + d.corrective;
        const barH = (total / maxVal) * chartH;
        const posH = (d.positive / maxVal) * chartH;
        const corrH = (d.corrective / maxVal) * chartH;
        return (
          <g key={d.week}>
            {d.corrective > 0 && <rect x={x} y={pad.top + chartH - corrH} width={barW} height={Math.max(corrH, 1)} fill={CC} rx="3" />}
            {d.positive > 0 && <rect x={x} y={pad.top + chartH - barH} width={barW} height={Math.max(posH, 1)} fill={CP} rx="3" />}
            <text x={x + barW / 2} y={h - 6} textAnchor="middle" fontSize="8" fill="var(--color-gray-500)" transform={`rotate(-35 ${x + barW / 2} ${h - 6})`}>{d.week.slice(5)}</text>
            {total > 0 && <text x={x + barW / 2} y={pad.top + chartH - barH - 3} textAnchor="middle" fontSize="9" fill="var(--color-gray-600)">{total}</text>}
          </g>
        );
      })}
      <rect x={pad.left} y={4} width={10} height={10} fill={CP} rx="2" />
      <text x={pad.left + 14} y={13} fontSize="9" fill="var(--color-gray-500)">Positive</text>
      <rect x={pad.left + 60} y={4} width={10} height={10} fill={CC} rx="2" />
      <text x={pad.left + 74} y={13} fontSize="9" fill="var(--color-gray-500)">Corrective</text>
    </svg>
  );
}
function BarChartDay({ data }: { data: ChartDay[] }) {
  const maxVal = Math.max(...data.map(d => d.count), 1);
  if (data.every(d => d.count === 0)) return <div className="text-sm text-muted text-center" style={{ padding: "var(--space-xl)" }}>No entries recorded</div>;
  const w = 300; const h = 150; const pad = { top: 8, right: 8, bottom: 24, left: 8 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const barW = chartW / data.length - 4;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Entries by day of week">
      {data.map((d, i) => {
        const x = pad.left + i * (chartW / data.length) + 2;
        const bh = (d.count / maxVal) * chartH;
        return (
          <g key={d.day}>
            <rect x={x} y={pad.top + chartH - bh} width={barW} height={Math.max(bh, 1)} fill="var(--color-primary)" rx="3" opacity="0.85" />
            <text x={x + barW / 2} y={h - 4} textAnchor="middle" fontSize="9" fill="var(--color-gray-500)">{d.day}</text>
            {d.count > 0 && <text x={x + barW / 2} y={pad.top + chartH - bh - 3} textAnchor="middle" fontSize="9" fill="var(--color-gray-600)">{d.count}</text>}
          </g>
        );
      })}
    </svg>
  );
}
function HorizontalBarChart({ data, color }: { data: ChartCategory[]; color: string }) {
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
            <text x={0} y={y + barH / 2 + 3} fontSize="10" fill="var(--color-gray-700)">{d.name.length > 18 ? d.name.slice(0, 17) + "\u2026" : d.name}</text>
            <rect x={190} y={y} width={bw} height={barH} fill={color} rx="3" opacity="0.85" />
            <text x={190 + bw + 4} y={y + barH / 2 + 3} fontSize="10" fill="var(--color-gray-600)" fontWeight="600">{d.count}</text>
          </g>
        );
      })}
    </svg>
  );
}
function InterventionChart({ data }: { data: ChartIntervention[] }) {
  if (!data.length) return <div className="text-sm text-muted text-center" style={{ padding: "var(--space-xl)" }}>No intervention data</div>;
  const colors = { stopped: CP, decreased: "#7CC89A", continued: "#E0A04A", escalated: CC };
  const labels: Record<string, string> = { stopped: "Stopped", decreased: "Decreased", continued: "Continued", escalated: "Escalated" };
  const maxTotal = Math.max(...data.map(d => d.stopped + d.decreased + d.continued + d.escalated), 1);
  const barH = 22; const gap = 6;
  const h = data.length * (barH + gap) + 40;
  return (
    <svg viewBox={`0 0 360 ${h}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Intervention effectiveness">
      {Object.entries(colors).map(([key, c], li) => (
        <g key={key}><rect x={li * 80} y={0} width={10} height={10} fill={c} rx="2" /><text x={li * 80 + 14} y={10} fontSize="9" fill="var(--color-gray-500)">{labels[key]}</text></g>
      ))}
      {data.map((d, i) => {
        const y = i * (barH + gap) + 20;
        const total = d.stopped + d.decreased + d.continued + d.escalated;
        const scale = total > 0 ? 200 / maxTotal : 0;
        let xOff = 0;
        return (
          <g key={d.name}>
            <text x={95} y={y + barH / 2 + 3} fontSize="9" fill="var(--color-gray-700)" textAnchor="end">{d.name.length > 12 ? d.name.slice(0, 11) + "\u2026" : d.name}</text>
            {[{ val: d.stopped, c: colors.stopped }, { val: d.decreased, c: colors.decreased }, { val: d.continued, c: colors.continued }, { val: d.escalated, c: colors.escalated }].map(seg => {
              const sw = Math.max(seg.val * scale, 0);
              const rect = seg.val > 0 ? <rect key={`${d.name}-${seg.c}`} x={100 + xOff} y={y} width={sw} height={barH} fill={seg.c} rx="2" opacity="0.85" /> : null;
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
function PositiveCorrectiveOverTime({ data }: { data: ChartWeek[] }) {
  if (!data.length) return <div className="text-sm text-muted text-center" style={{ padding: "var(--space-xl)" }}>No data available</div>;
  const maxVal = Math.max(...data.map(d => Math.max(d.positive, d.corrective)), 1);
  const w = 320; const h = 170; const pad = { top: 10, right: 20, bottom: 30, left: 30 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const barW = Math.max(chartW / data.length / 2 - 2, 5);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Positive vs corrective over time">
      {data.map((d, i) => {
        const x = pad.left + i * (chartW / data.length);
        const posH = (d.positive / maxVal) * chartH;
        const corrH = (d.corrective / maxVal) * chartH;
        return (
          <g key={d.week}>
            {d.positive > 0 && <rect x={x + 2} y={pad.top + chartH - posH} width={barW} height={Math.max(posH, 1)} fill={CP} rx="3" />}
            {d.corrective > 0 && <rect x={x + barW + 4} y={pad.top + chartH - corrH} width={barW} height={Math.max(corrH, 1)} fill={CC} rx="3" />}
            <text x={x + barW + 2} y={h - 6} textAnchor="middle" fontSize="8" fill="var(--color-gray-500)" transform={`rotate(-35 ${x + barW + 2} ${h - 6})`}>{d.week.slice(5)}</text>
          </g>
        );
      })}
      <rect x={pad.left} y={4} width={10} height={10} fill={CP} rx="2" />
      <text x={pad.left + 14} y={13} fontSize="9" fill="var(--color-gray-500)">Positive</text>
      <rect x={pad.left + 60} y={4} width={10} height={10} fill={CC} rx="2" />
      <text x={pad.left + 74} y={13} fontSize="9" fill="var(--color-gray-500)">Corrective</text>
    </svg>
  );
}

function PointsPerWeekChart({ data }: { data: { week: string; points: number }[] }) {
  if (!data.length || data.every(d => d.points === 0)) {
    return <div className="text-sm text-muted text-center" style={{ padding: "var(--space-xl)" }}>No points earned in this period</div>;
  }
  const maxVal = Math.max(...data.map(d => d.points), 1);
  const w = 300; const h = 150; const pad = { top: 8, right: 8, bottom: 30, left: 8 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const barW = Math.max(chartW / data.length - 6, 10);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Points earned per week">
      {data.map((d, i) => {
        const x = pad.left + i * (chartW / data.length) + 3;
        const bh = (d.points / maxVal) * chartH;
        return (
          <g key={d.week}>
            <rect x={x} y={pad.top + chartH - bh} width={barW} height={Math.max(bh, 1)} fill="var(--color-success)" rx="3" opacity="0.9" />
            <text x={x + barW / 2} y={h - 6} textAnchor="middle" fontSize="8" fill="var(--color-gray-500)" transform={`rotate(-35 ${x + barW / 2} ${h - 6})`}>{d.week.slice(5)}</text>
            {d.points > 0 && <text x={x + barW / 2} y={pad.top + chartH - bh - 3} textAnchor="middle" fontSize="9" fill="var(--color-success-dark)" fontWeight="600">{d.points}</text>}
          </g>
        );
      })}
      <rect x={pad.left} y={4} width={10} height={10} fill="var(--color-success)" rx="2" />
      <text x={pad.left + 14} y={13} fontSize="9" fill="var(--color-gray-500)">Points</text>
    </svg>
  );
}

function StatCard({ label, value, color, icon, className }: { label: string; value: string | number; color?: string; icon?: React.ReactNode; className?: string }) {
  return (
    <div className={`stat-card${className ? ` ${className}` : ""}`}>
      {icon && <div className="stat-card__icon" style={color ? { color } : {}}>{icon}</div>}
      <div className="stat-card__value" style={color ? { color } : {}}>{value}</div>
      <div className="stat-card__label">{label}</div>
    </div>
  );
}
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="chart-card"><div className="chart-card__title">{title}</div><div className="chart-card__body">{children}</div></div>;
}

function PatternsToReview({ student, stats, entryStats }: { student: StudentData; stats: ProfileStats; entryStats: EntryStats | null }) {
  const patterns: string[] = [];
  if (!entryStats) {
    patterns.push("Not enough data to identify patterns. Patterns will appear as more entries are recorded.");
  } else {
    if (entryStats.bySubject.length > 0) {
      const top = entryStats.bySubject[0];
      const total = entryStats.bySubject.reduce((s, c) => s + c.count, 0);
      if (total > 0 && top.count / total >= 0.3) patterns.push(`Entries are more frequent during ${top.name} (${top.count} of ${total} total entries).`);
    }
    if (stats.correctiveEntries > stats.positiveEntries && stats.totalEntries >= 10) patterns.push(`A possible pattern is more corrective than positive entries overall (${stats.correctiveEntries} corrective vs ${stats.positiveEntries} positive).`);
    if (entryStats.byTrigger.length > 0) {
      const tt = entryStats.byTrigger[0];
      if (tt.count >= 2) patterns.push(`"${tt.name}" appears as a common antecedent (observed in ${tt.count} entries).`);
    }
    if (stats.totalEntries >= 5 && stats.positiveEntries >= stats.totalEntries * 0.4) patterns.push(`The available entries suggest the student responds well to positive reinforcement and recognition.`);
    if (entryStats.byIntervention.length > 0) {
      const eff = entryStats.byIntervention.filter(i => i.stopped + i.decreased > i.continued + i.escalated);
      if (eff.length >= 1) patterns.push(`The available entries suggest the student responds positively to ${eff[0].name.toLowerCase()} and similar interventions.`);
    }
    if (entryStats.byLocation.length > 0) {
      const tl = entryStats.byLocation[0];
      const tlt = entryStats.byLocation.reduce((s, c) => s + c.count, 0);
      if (tlt > 0 && tl.count / tlt >= 0.35 && tl.name !== "Classroom") patterns.push(`A possible pattern is increased entries in ${tl.name} (${tl.count} of ${tlt} entries).`);
    }
    if (patterns.length === 0) patterns.push("More data may be needed to confirm any patterns. Continue recording entries to build a clearer picture.");
  }
  return (
    <div className="card" style={{ marginBottom: "var(--space-md)" }}>
      <h2 style={{ marginBottom: "var(--space-sm)" }}>Patterns to Review</h2>
      <ul style={{ paddingLeft: "var(--space-lg)", fontSize: "0.9rem", lineHeight: 1.8 }}>
        {patterns.map((p, i) => <li key={i} style={{ marginBottom: "var(--space-xs)" }}>{p}</li>)}
      </ul>
      <div className="alert alert--demo" style={{ marginTop: "var(--space-sm)", marginBottom: 0 }}>
        <strong>Disclaimer:</strong> These observations are based on recorded entries only and do not constitute a formal assessment or diagnosis. Patterns should be considered alongside other data sources when making decisions about student support.
      </div>
    </div>
  );
}

export default function StudentProfile() {
  const { id } = useParams();
  const [student, setStudent] = useState<StudentData | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [entryStats, setEntryStats] = useState<EntryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [entryLoading, setEntryLoading] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);
  const [entryOffset, setEntryOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const LIMIT = 10;
  const { legacyToken: token } = useLegacyToken();

  useEffect(() => {
    fetch(`/api/students/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(data => { setStudent(data.student); setStats(data.stats); setGoals(data.goals || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);
  useEffect(() => {
    fetch(`/api/entries/stats?student_id=${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(data => setEntryStats(data)).catch(() => {});
  }, [id]);
  const fetchEntries = useCallback((reset: boolean) => {
    const offset = reset ? 0 : entryOffset;
    let url = `/api/entries?student_id=${id}&limit=${LIMIT}&offset=${offset}`;
    if (filterType) url += `&entry_type=${filterType}`;
    setEntryLoading(true);
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(data => {
        const newEntries = data.entries || [];
        if (reset) { setEntries(newEntries); setEntryOffset(LIMIT); }
        else { setEntries(prev => [...prev, ...newEntries]); setEntryOffset(prev => prev + LIMIT); }
        setHasMore(newEntries.length === LIMIT);
        setEntryLoading(false);
      }).catch(() => setEntryLoading(false));
  }, [id, filterType, entryOffset]);
  useEffect(() => { setEntries([]); setEntryOffset(0); setHasMore(true); fetchEntries(true); }, [id, filterType]);
  const handleLoadMore = () => fetchEntries(false);

  if (loading) return <div className="loading" aria-busy="true"><span className="spinner spinner--lg" style={{ marginRight: "var(--space-sm)" }} />Loading student profile...</div>;
  if (!student) return <div className="empty-state"><span className="empty-state__icon"><AlertTriangle size={40} /></span><p>Student not found.</p><Link to="/students" className="btn btn--primary btn--sm mt-md">Back to Students</Link></div>;

  const goalCount = goals.filter(g => !["goal_met", "discontinued"].includes(g.status)).length;

  return (
    <div className="student-profile">
      <div className="card">
        <div className="flex items-start gap-md" style={{ flexWrap: "wrap" }}>
          <div className="student-profile__avatar" style={{ background: "var(--color-primary)" }}>{student.initials}</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="flex items-center gap-sm" style={{ flexWrap: "wrap" }}>
              <h1 style={{ marginBottom: 0 }}>{student.display_name}</h1>
              {student.local_id && <span className="badge badge--neutral">{student.local_id}</span>}
            </div>
            <div className="text-sm text-muted" style={{ marginTop: "var(--space-xs)" }}>Grade {student.grade} \u00b7 {student.classroom}</div>
            {goals.length > 0 && (
              <div style={{ marginTop: "var(--space-sm)" }}>
                <span className="text-sm text-muted"><strong>{goalCount} active goal{goalCount !== 1 ? "s" : ""}</strong>: </span>
                {goals.filter(g => !["goal_met", "discontinued"].includes(g.status)).slice(0, 3).map((g, i) => (
                  <span key={g.id}><span className={`badge ${goalStatusClass(g.status)}`} style={{ marginRight: 4 }}>{g.title}</span>{i < Math.min(goalCount, 3) - 1 && " "}</span>
                ))}
                {goalCount > 3 && <span className="text-sm text-muted">+{goalCount - 3} more</span>}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-sm mt-md" style={{ flexWrap: "wrap" }}>
          <Link to={`/entry?student=${student.id}`} className="btn btn--primary btn--sm"><PlusCircle size={14} /> Record Entry</Link>
          <Link to={`/goals/new?student=${student.id}`} className="btn btn--secondary btn--sm"><Target size={14} /> Add Goal</Link>
          <Link to={`/reports?student=${student.id}`} className="btn btn--ghost btn--sm">Generate Report</Link>
        </div>
      </div>

      {stats && (
        <div className="stat-cards-grid" style={{ marginBottom: "var(--space-md)" }}>
          <StatCard label="Points Earned" value={stats.pointsAwarded} icon={<Star size={18} />} color="var(--color-success)" className="stat-card--points" />
          <StatCard label="Points This Week" value={stats.pointsThisWeek} icon={<Star size={18} />} color="var(--color-success)" />
          <StatCard label="Total Entries" value={stats.totalEntries} icon={<FileText size={18} />} />
          <StatCard label="Positive" value={stats.positiveEntries} icon={<Star size={18} />} color="var(--color-success)" />
          <StatCard label="Corrective" value={stats.correctiveEntries} icon={<FileText size={18} />} color={stats.correctiveEntries > 0 ? "var(--color-danger)" : "var(--color-gray-500)"} />
          <StatCard label="This Week" value={stats.entriesThisWeek} icon={<CalendarClock size={18} />} color="var(--color-primary)" />
          <StatCard label="Parent Contacts" value={stats.parentContacts} icon={<Phone size={18} />} color={stats.parentContacts > 0 ? "var(--color-info)" : "var(--color-gray-400)"} />
          <StatCard label="Staff Contacts" value={stats.counselorAdminContacts} icon={<Building2 size={18} />} color={stats.counselorAdminContacts > 0 ? "var(--color-info)" : "var(--color-gray-400)"} />
          <StatCard label="Docs Pending" value={stats.pendingDocs} icon={<ClipboardList size={18} />} color={stats.pendingDocs > 0 ? "var(--color-warning)" : "var(--color-gray-400)"} />
          <StatCard label="Follow-ups Due" value={stats.followUpsDue} icon={<Bell size={18} />} color={stats.followUpsDue > 0 ? "var(--color-warning)" : "var(--color-gray-400)"} />
        </div>
      )}

      <h2 className="mb-sm">Behavior Timeline</h2>
      <div className="flex gap-sm mb-md" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ minWidth: 120 }}><label className="form-label" style={{ fontSize: "0.75rem" }}>Entry Type</label>
          <select className="form-select" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ minHeight: 36, fontSize: "0.85rem", padding: "2px 8px" }}>
            <option value="">All</option><option value="positive">Positive</option><option value="minor_concern">Minor Concern</option><option value="moderate_concern">Moderate Concern</option><option value="major_concern">Major Concern</option><option value="crisis">Crisis</option>
          </select></div>
        <div style={{ minWidth: 110 }}><label className="form-label" style={{ fontSize: "0.75rem" }}>From</label><input type="date" className="form-input" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={{ minHeight: 36, fontSize: "0.85rem", padding: "2px 8px" }} /></div>
        <div style={{ minWidth: 110 }}><label className="form-label" style={{ fontSize: "0.75rem" }}>To</label><input type="date" className="form-input" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} style={{ minHeight: 36, fontSize: "0.85rem", padding: "2px 8px" }} /></div>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state"><span className="empty-state__icon"><FileText size={40} /></span><p>No behavior entries recorded yet.</p><Link to={`/entry?student=${student.id}`} className="btn btn--primary btn--sm mt-md">Record First Entry</Link></div>
      ) : (
        <>
          {entries.filter(e => { if (filterDateFrom && e.date < filterDateFrom) return false; if (filterDateTo && e.date > filterDateTo) return false; return true; }).map((entry) => {
            const isExpanded = expandedEntry === entry.id;
            const cats = parseJsonArray(entry.behavior_categories);
            const trigs = parseJsonArray(entry.possible_triggers);
            const intvs = parseJsonArray(entry.interventions);
            const outcomes = parseJsonArray(entry.outcome);
            const responses = parseJsonArray(entry.student_response);
            return (
              <div key={entry.id} className="card" style={{ cursor: "pointer" }} onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}>
                <div className="flex items-center justify-between gap-sm" style={{ flexWrap: "wrap" }}>
                  <div className="flex items-center gap-sm" style={{ flexWrap: "wrap", flex: 1 }}>
                    <span className={`badge ${entryTypeClass(entry.entry_type)}`}>{entryTypeLabel(entry.entry_type)}</span>
                    <span className="text-sm text-muted">{entry.date} at {entry.time}</span>
                    {entry.subject_activity && <span className="text-sm text-muted">\u00b7 {entry.subject_activity}</span>}
                  </div>
                  <div className="flex gap-sm items-center">
                    {entry.doc_status === "required_pending" && <span className="badge badge--pending">Docs needed</span>}
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                </div>
                <div style={{ marginTop: "var(--space-xs)", fontSize: "0.9rem" }}>
                  {entry.objective_observation ? entry.objective_observation.slice(0, 120) + (entry.objective_observation.length > 120 ? "..." : "") : <span className="text-muted">No observation recorded</span>}
                </div>
                {cats.length > 0 && <div className="flex gap-sm mt-sm" style={{ flexWrap: "wrap" }}>{cats.slice(0, 4).map((c, ci) => <span key={ci} className="badge badge--neutral" style={{ fontSize: "0.7rem" }}>{c}</span>)}{cats.length > 4 && <span className="text-sm text-muted">+{cats.length - 4}</span>}</div>}
                {isExpanded && (
                  <div style={{ marginTop: "var(--space-md)", paddingTop: "var(--space-md)", borderTop: "1px solid var(--color-gray-100)" }}>
                    <div className="entry-detail-grid">
                      {entry.objective_observation && <div><div className="text-sm" style={{ fontWeight: 600, marginBottom: 2 }}>Observation</div><div className="text-sm">{entry.objective_observation}</div></div>}
                      {trigs.length > 0 && <div><div className="text-sm" style={{ fontWeight: 600, marginBottom: 2 }}>Possible Triggers</div><div className="flex gap-sm" style={{ flexWrap: "wrap" }}>{trigs.map((t, ti) => <span key={ti} className="badge badge--moderate">{t}</span>)}</div></div>}
                      {intvs.length > 0 && <div><div className="text-sm" style={{ fontWeight: 600, marginBottom: 2 }}>Interventions</div><div className="flex gap-sm" style={{ flexWrap: "wrap" }}>{intvs.map((iv, ii) => <span key={ii} className="badge badge--minor">{iv}</span>)}</div></div>}
                      {responses.length > 0 && <div><div className="text-sm" style={{ fontWeight: 600, marginBottom: 2 }}>Student Response</div><div className="flex gap-sm" style={{ flexWrap: "wrap" }}>{responses.map((r, ri) => <span key={ri} className="badge badge--neutral">{r}</span>)}</div></div>}
                      {outcomes.length > 0 && <div><div className="text-sm" style={{ fontWeight: 600, marginBottom: 2 }}>Outcome</div><div className="flex gap-sm" style={{ flexWrap: "wrap" }}>{outcomes.map((o, oi) => <span key={oi} className="badge badge--neutral">{o}</span>)}</div></div>}
                      {entry.location && <div><span className="text-sm" style={{ fontWeight: 600 }}>Location: </span><span className="text-sm">{entry.location}</span></div>}
                      {entry.duration_minutes > 0 && <div><span className="text-sm" style={{ fontWeight: 600 }}>Duration: </span><span className="text-sm">{entry.duration_minutes} min</span></div>}
                      {entry.people_involved && <div><span className="text-sm" style={{ fontWeight: 600 }}>People Involved: </span><span className="text-sm">{entry.people_involved}</span></div>}
                      {(entry.parent_contact_status || entry.admin_contact_status || entry.counselor_contact_status) && <div><div className="text-sm" style={{ fontWeight: 600, marginBottom: 2 }}>Contacts</div><div className="flex gap-sm" style={{ flexWrap: "wrap" }}>{entry.parent_contact_status && <span className="badge badge--neutral">Parent: {entry.parent_contact_status.replace(/_/g, " ")}</span>}{entry.admin_contact_status && <span className="badge badge--neutral">Admin: {entry.admin_contact_status.replace(/_/g, " ")}</span>}{entry.counselor_contact_status && <span className="badge badge--neutral">Counselor: {entry.counselor_contact_status.replace(/_/g, " ")}</span>}</div></div>}
                      {entry.doc_status !== "not_required" && <div><div className="text-sm" style={{ fontWeight: 600, marginBottom: 2 }}>Official Documentation</div><span className={`badge ${entry.doc_status === "required_pending" ? "badge--pending" : entry.doc_status === "completed" ? "badge--completed" : "badge--neutral"}`}>{entry.doc_status.replace(/_/g, " ")}</span>{entry.doc_system_name && <span className="text-sm text-muted"> \u00b7 {entry.doc_system_name}</span>}</div>}
                      {entry.follow_up_date && <div><span className="text-sm" style={{ fontWeight: 600 }}>Follow-up: </span><span className="text-sm">{entry.follow_up_date}</span></div>}
                    </div>
                    <div style={{ marginTop: "var(--space-sm)" }}><Link to={`/entry/${entry.id}`} className="btn btn--ghost btn--sm" onClick={(e) => e.stopPropagation()}>Edit Entry</Link></div>
                  </div>
                )}
              </div>
            );
          })}
          {hasMore && <div className="text-center mt-md mb-md"><button className="btn btn--ghost" onClick={handleLoadMore} disabled={entryLoading}>{entryLoading ? "Loading..." : "Load More"}</button></div>}
        </>
      )}

      <h2 className="mb-sm" style={{ marginTop: "var(--space-lg)" }}>Charts &amp; Analysis</h2>
      <div className="charts-grid">
        <ChartCard title="Entries by Week (Last 8 Weeks)"><BarChartWeek data={entryStats?.byWeek || []} /></ChartCard>
        <ChartCard title="Entries by Day of Week"><BarChartDay data={entryStats?.byDayOfWeek || []} /></ChartCard>
        <ChartCard title="Positive vs Corrective Over Time"><PositiveCorrectiveOverTime data={entryStats?.positiveVsCorrectiveOverTime || []} /></ChartCard>
        <ChartCard title="Entries by Subject"><HorizontalBarChart data={entryStats?.bySubject || []} color="var(--color-primary)" /></ChartCard>
        <ChartCard title="Entries by Location"><HorizontalBarChart data={entryStats?.byLocation || []} color="var(--color-info)" /></ChartCard>
        <ChartCard title="Behavior Categories"><HorizontalBarChart data={entryStats?.byCategory || []} color="var(--color-primary)" /></ChartCard>
        <ChartCard title="Possible Triggers"><HorizontalBarChart data={entryStats?.byTrigger || []} color="var(--color-warning)" /></ChartCard>
        <ChartCard title="Intervention Effectiveness"><InterventionChart data={entryStats?.byIntervention || []} /></ChartCard>
      </div>

      {/* Points Per Week Chart */}
      <h2 className="mb-sm" style={{ marginTop: "var(--space-lg)" }}>Points History</h2>
      <div className="charts-grid">
        <ChartCard title="Points Earned Per Week">
          <PointsPerWeekChart data={entryStats?.pointsByWeek || []} />
        </ChartCard>
        <div className="chart-card">
          <div className="chart-card__title">Recent Points Earned</div>
          <div className="chart-card__body">
            {entries.filter(e => e.entry_type === "positive").slice(0, 5).length === 0 ? (
              <div className="text-sm text-muted text-center" style={{ padding: "var(--space-xl)" }}>No points earned yet</div>
            ) : (
              <div className="points-history">
                {entries.filter(e => e.entry_type === "positive").slice(0, 5).map((entry) => (
                  <div key={entry.id} className="points-history-item">
                    <span className="points-history-item__date">{entry.date}</span>
                    <span className="points-history-item__points">+{entry.points || 0} pts</span>
                    <span className="points-history-item__note">
                      {entry.objective_observation ? entry.objective_observation.slice(0, 60) + (entry.objective_observation.length > 60 ? "..." : "") : entry.subject_activity || "Positive recognition"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {stats && <div style={{ marginTop: "var(--space-lg)" }}><PatternsToReview student={student} stats={stats} entryStats={entryStats} /></div>}

      <h2 className="mb-sm">Behavior Goals</h2>
      {goals.length === 0 ? (
        <div className="empty-state"><span className="empty-state__icon"><Target size={40} /></span><p>No goals set for this student.</p><Link to={`/goals/new?student=${student.id}`} className="btn btn--primary btn--sm mt-md">Add First Goal</Link></div>
      ) : (
        goals.map((goal) => {
          const supports = parseJsonArray(goal.supports);
          return (
            <div key={goal.id} className="card">
              <div className="card__header">
                <div><div className="card__title">{goal.title}</div><div className="card__subtitle">Since {goal.start_date}{goal.review_date ? ` \u00b7 Review: ${goal.review_date}` : ""}</div></div>
                <span className={`badge ${goalStatusClass(goal.status)}`}>{goalStatusLabel(goal.status)}</span>
              </div>
              <div className="card__body">
                <div style={{ marginBottom: "var(--space-sm)" }}>
                  <div className="flex justify-between text-sm" style={{ marginBottom: 4 }}><span>Progress</span><span>{goal.progressCount} update{goal.progressCount !== 1 ? "s" : ""}</span></div>
                  <div style={{ height: 8, background: "var(--color-gray-100)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                    {goal.status === "goal_met" ? <div style={{ height: "100%", width: "100%", background: "var(--color-success)", borderRadius: "var(--radius-full)" }} /> : goal.status === "improving" ? <div style={{ height: "100%", width: "65%", background: "var(--color-success)", borderRadius: "var(--radius-full)" }} /> : goal.status === "in_progress" ? <div style={{ height: "100%", width: "35%", background: "var(--color-primary)", borderRadius: "var(--radius-full)" }} /> : goal.status === "not_started" ? <div style={{ height: "100%", width: "5%", background: "var(--color-gray-300)", borderRadius: "var(--radius-full)" }} /> : goal.status === "needs_revision" ? <div style={{ height: "100%", width: "45%", background: "var(--color-warning)", borderRadius: "var(--radius-full)" }} /> : <div style={{ height: "100%", width: "10%", background: "var(--color-gray-300)", borderRadius: "var(--radius-full)" }} />}
                  </div>
                </div>
                {goal.latestProgress && <div className="text-sm" style={{ background: "var(--color-gray-50)", padding: "var(--space-sm)", borderRadius: "var(--radius-sm)", marginBottom: "var(--space-sm)" }}><strong>Latest ({goal.latestProgress.date}):</strong> Rating {goal.latestProgress.rating}/5{goal.latestProgress.notes && ` \u2014 "${goal.latestProgress.notes}"`}</div>}
                <div className="text-sm text-muted">{goal.target_behavior && <span>Target: {goal.target_behavior} \u00b7 </span>}{goal.measurement_method && <span>{goal.measurement_method} \u00b7 </span>}{goal.tracking_frequency && <span>{goal.tracking_frequency} \u00b7 </span>}{goal.responsible_staff && <span>{goal.responsible_staff}</span>}</div>
                {supports.length > 0 && <div className="flex gap-sm mt-sm" style={{ flexWrap: "wrap" }}>{supports.map((s, si) => <span key={si} className="badge badge--minor">{s}</span>)}</div>}
              </div>
              <div className="card__footer"><Link to={`/goals/${goal.id}`} className="btn btn--ghost btn--sm">View Details</Link></div>
            </div>
          );
        })
      )}
      <div style={{ height: "var(--space-2xl)" }} />
    </div>
  );
}

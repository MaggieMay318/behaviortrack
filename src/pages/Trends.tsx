import { useState, useEffect } from "react";
import { useLegacyToken } from "../lib/auth";
import { TrendingUp, FileText, Star, BarChart3, Target, ClipboardList, CheckCircle, Search, Tag, AlertTriangle } from "lucide-react";

/* ── Chart colors ──────────────────────────────────── */
const CP = "var(--color-chart-positive)";
const CC = "var(--color-chart-corrective)";
interface TrendsSummary {
  totalEntries: number;
  positiveCount: number;
  correctiveCount: number;
  positivePct: number;
  correctivePct: number;
  ratio: number;
  mostCommonBehavior: string;
  mostCommonTrigger: string;
  mostEffectiveIntervention: string;
  docCompletionRate: number;
}

interface DayEntry { day: string; positive: number; corrective: number; }
interface TimeEntry { label: string; count: number; }
interface NameCount { name: string; count: number; }
interface InterventionEntry {
  name: string;
  stopped: number;
  decreased: number;
  continued: number;
  escalated: number;
}
interface SeverityEntry { entry_type: string; count: number; }
interface DailyEntry { date: string; positive: number; corrective: number; }
interface DocCompletion { completed: number; pending: number; notRequired: number; }
interface ContactStatus {
  parentContacted: number;
  parentPending: number;
  adminContacted: number;
  adminPending: number;
  counselorContacted: number;
  counselorPending: number;
}

interface TrendsData {
  summary: TrendsSummary;
  byDayOfWeek: DayEntry[];
  byTimeOfDay: TimeEntry[];
  bySubject: NameCount[];
  byLocation: NameCount[];
  positiveVsCorrective: { positive: number; corrective: number };
  topCategories: NameCount[];
  topTriggers: NameCount[];
  interventionEffectiveness: InterventionEntry[];
  severityDistribution: SeverityEntry[];
  entriesOverTime: DailyEntry[];
  documentationCompletion: DocCompletion;
  contactStatus: ContactStatus;
  filters: {
    grades: string[];
    subjects: string[];
    locations: string[];
  };
}

type DatePreset = "this-week" | "last-week" | "this-month" | "last-30" | "last-90" | "custom";

/* ── Helpers ───────────────────────────────────────── */
const entryTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    positive: "Positive", minor_concern: "Minor", moderate_concern: "Moderate",
    major_concern: "Major", crisis: "Crisis",
  };
  return labels[type] || type;
};

const severityBadgeClass = (type: string): string => {
  const classes: Record<string, string> = {
    positive: "badge--positive", minor_concern: "badge--minor",
    moderate_concern: "badge--moderate", major_concern: "badge--major",
    crisis: "badge--crisis",
  };
  return classes[type] || "badge--neutral";
};

function dateRangeForPreset(preset: DatePreset): { from: string; to: string } {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);

  switch (preset) {
    case "this-week": {
      const dow = today.getDay();
      const mondayOffset = dow === 0 ? 6 : dow - 1;
      const monday = new Date(today);
      monday.setDate(monday.getDate() - mondayOffset);
      return { from: monday.toISOString().slice(0, 10), to };
    }
    case "last-week": {
      const dow = today.getDay();
      const mondayOffset = dow === 0 ? 6 : dow - 1;
      const lastMonday = new Date(today);
      lastMonday.setDate(lastMonday.getDate() - mondayOffset - 7);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastSunday.getDate() + 6);
      return { from: lastMonday.toISOString().slice(0, 10), to: lastSunday.toISOString().slice(0, 10) };
    }
    case "this-month": {
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: firstOfMonth.toISOString().slice(0, 10), to };
    }
    case "last-30": {
      const d = new Date(today);
      d.setDate(d.getDate() - 29);
      return { from: d.toISOString().slice(0, 10), to };
    }
    case "last-90": {
      const d = new Date(today);
      d.setDate(d.getDate() - 89);
      return { from: d.toISOString().slice(0, 10), to };
    }
    default:
      return { from: "", to: "" };
  }
}

const ALL_CATEGORIES = [
  "Off-task behavior", "Calling out", "Leaving seat", "Physical aggression",
  "Verbal outburst", "Refusal to follow directions", "Disrupting peers",
  "Inappropriate language", "Tantrum", "Property misuse",
  "Peer conflict", "Elopement", "Self-regulation difficulty",
];

const SEVERITY_TYPES = [
  { value: "minor_concern", label: "Minor" },
  { value: "moderate_concern", label: "Moderate" },
  { value: "major_concern", label: "Major" },
  { value: "crisis", label: "Crisis" },
];

function formatDateShort(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/* ── SVG Chart Components ──────────────────────────── */

// 1. Entries by Day of Week (stacked bar, Mon-Sun)
function EntriesByDayChart({ data }: { data: DayEntry[] }) {
  if (!data.length || data.every(d => d.positive + d.corrective === 0)) {
    return <div className="text-sm text-muted text-center" style={{ padding: "var(--space-xl)" }}>No entries in this period</div>;
  }
  const maxVal = Math.max(...data.map(d => d.positive + d.corrective), 1);
  const w = 320; const h = 170; const pad = { top: 8, right: 8, bottom: 26, left: 8 };
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
              <rect x={x} y={pad.top + chartH - corrH} width={barW} height={Math.max(corrH, 1)} fill={CC} rx="3" />
            )}
            {d.positive > 0 && (
              <rect x={x} y={pad.top + chartH - barH} width={barW} height={Math.max(posH, 1)} fill={CP} rx="3" />
            )}
            <text x={x + barW / 2} y={h - 6} textAnchor="middle" fontSize="9" fill="var(--color-gray-500)">{d.day}</text>
            {total > 0 && (
              <text x={x + barW / 2} y={y - 2} textAnchor="middle" fontSize="9" fill="var(--color-gray-600)" fontWeight="600">{total}</text>
            )}
          </g>
        );
      })}
      {/* Legend */}
      <rect x={pad.left} y={2} width={8} height={8} fill={CP} rx="2" />
      <text x={pad.left + 12} y={10} fontSize="8" fill="var(--color-gray-500)">Positive</text>
      <rect x={pad.left + 60} y={2} width={8} height={8} fill={CC} rx="2" />
      <text x={pad.left + 72} y={10} fontSize="8" fill="var(--color-gray-500)">Corrective</text>
    </svg>
  );
}

// 2. By Time of Day (3 buckets)
function TimeOfDayChart({ data }: { data: TimeEntry[] }) {
  if (!data.length || data.every(d => d.count === 0)) {
    return <div className="text-sm text-muted text-center" style={{ padding: "var(--space-xl)" }}>No time data</div>;
  }
  const maxVal = Math.max(...data.map(d => d.count), 1);
  const w = 260; const h = 140; const pad = { top: 8, right: 16, bottom: 8, left: 48 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const barH = chartH / data.length - 8;
  const colors = ["#5b9bd5", "#ed7d31", "#70ad47"];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Entries by time of day">
      {data.map((d, i) => {
        const y = pad.top + i * (chartH / data.length);
        const bw = maxVal > 0 ? (d.count / maxVal) * chartW : 0;
        return (
          <g key={d.label}>
            <text x={pad.left - 4} y={y + barH / 2 + 4} fontSize="10" fill="var(--color-gray-600)" textAnchor="end" fontWeight="500">{d.label}</text>
            <rect x={pad.left} y={y} width={Math.max(bw, 2)} height={barH} fill={colors[i]} rx="3" opacity="0.85" />
            <text x={pad.left + bw + 6} y={y + barH / 2 + 4} fontSize="10" fill="var(--color-gray-700)" fontWeight="600">{d.count}</text>
          </g>
        );
      })}
    </svg>
  );
}

// 3/4. Horizontal bar chart (for categories, triggers, subjects, locations)
function HorizontalBarChart({ data, color, maxItems }: { data: NameCount[]; color: string; maxItems?: number }) {
  const shown = maxItems ? data.slice(0, maxItems) : data;
  if (!shown.length) return <div className="text-sm text-muted text-center" style={{ padding: "var(--space-xl)" }}>No data available</div>;
  const maxVal = Math.max(...shown.map(d => d.count), 1);
  const barH = 22; const gap = 6;
  const h = shown.length * (barH + gap) + 8;

  return (
    <svg viewBox={`0 0 320 ${h}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Horizontal bar chart">
      {shown.map((d, i) => {
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

// 5. Positive vs Corrective Donut with ratio
function RatioDonutChart({ positive, corrective }: { positive: number; corrective: number }) {
  const total = positive + corrective;
  if (total === 0) return <div className="text-sm text-muted text-center" style={{ padding: "var(--space-xl)" }}>No entries yet</div>;
  const ratio = corrective > 0 ? (positive / corrective) : (positive > 0 ? positive : 0);
  const ratioStr = corrective > 0 ? `${Math.round(ratio * 10) / 10}:1` : `${positive}:0`;
  const r = 50; const c = 64; const circ = 2 * Math.PI * r;
  const posPct = positive / total;
  const posLen = circ * posPct;
  const corrLen = circ - posLen;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", flexWrap: "wrap" }}>
      <svg viewBox="0 0 128 128" style={{ width: "100%", maxWidth: "160px", height: "auto" }} role="img" aria-label={`Ratio ${ratioStr}`}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--color-gray-100)" strokeWidth="18" />
        <circle cx={c} cy={c} r={r} fill="none" stroke={CP} strokeWidth="18"
          strokeDasharray={`${posLen} ${circ - posLen}`} strokeDashoffset="0" transform={`rotate(-90 ${c} ${c})`}
          strokeLinecap="round" />
        {corrective > 0 && (
          <circle cx={c} cy={c} r={r} fill="none" stroke={CC} strokeWidth="18"
            strokeDasharray={`${corrLen} ${circ - corrLen}`}
            strokeDashoffset={-posLen} transform={`rotate(-90 ${c} ${c})`}
            strokeLinecap="round" />
        )}
        <text x={c} y={c - 2} textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--color-gray-800)">{ratioStr}</text>
        <text x={c} y={c + 14} textAnchor="middle" fontSize="9" fill="var(--color-gray-500)">pos:corr</text>
      </svg>
      <div style={{ fontSize: "0.85rem", lineHeight: 1.8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <span style={{ width: 12, height: 12, background: CP, borderRadius: 3, display: "inline-block" }} />
          Positive: <strong>{positive}</strong> ({total > 0 ? Math.round((positive / total) * 100) : 0}%)
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <span style={{ width: 12, height: 12, background: CC, borderRadius: 3, display: "inline-block" }} />
          Corrective: <strong>{corrective}</strong> ({total > 0 ? Math.round((corrective / total) * 100) : 0}%)
        </div>
      </div>
    </div>
  );
}

// 8. Intervention Effectiveness (stacked horizontal bar)
function InterventionChart({ data }: { data: InterventionEntry[] }) {
  if (!data.length) return <div className="text-sm text-muted text-center" style={{ padding: "var(--space-xl)" }}>No intervention data</div>;
  const colors = { stopped: CP, decreased: "#7CC89A", continued: "#E0A04A", escalated: CC };
  const labels = { stopped: "Stopped", decreased: "Decreased", continued: "Continued", escalated: "Escalated" };
  const maxTotal = Math.max(...data.map(d => d.stopped + d.decreased + d.continued + d.escalated), 1);
  const barH = 20; const gap = 6;
  const h = data.length * (barH + gap) + 40;

  return (
    <svg viewBox={`0 0 360 ${h}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Intervention effectiveness">
      {/* Legend */}
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

// 9. Severity Distribution (grouped bar chart)
function SeverityDistChart({ data }: { data: SeverityEntry[] }) {
  if (!data.length) return <div className="text-sm text-muted text-center" style={{ padding: "var(--space-xl)" }}>No severity data</div>;
  const maxVal = Math.max(...data.map(d => d.count), 1);
  const w = 280; const h = 150; const pad = { top: 8, right: 8, bottom: 30, left: 8 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const barW = chartW / data.length - 6;
  const colors: Record<string, string> = {
    positive: CP, minor_concern: "var(--color-chart-severity-minor)",
    moderate_concern: "var(--color-chart-severity-moderate)", major_concern: "var(--color-chart-severity-major)", crisis: "var(--color-chart-severity-crisis)",
  };

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Severity distribution">
      {data.map((d, i) => {
        const x = pad.left + i * (chartW / data.length) + 3;
        const barHVal = maxVal > 0 ? (d.count / maxVal) * chartH : 0;
        const y = pad.top + chartH - barHVal;
        const c = colors[d.entry_type] || "var(--color-gray-400)";
        return (
          <g key={d.entry_type}>
            <rect x={x} y={y} width={barW} height={Math.max(barHVal, 1)} fill={c} rx="3" opacity="0.85" />
            <text x={x + barW / 2} y={h - 8} textAnchor="middle" fontSize="8" fill="var(--color-gray-500)">
              {entryTypeLabel(d.entry_type)}
            </text>
            <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize="9" fill="var(--color-gray-700)" fontWeight="600">{d.count}</text>
          </g>
        );
      })}
    </svg>
  );
}

// 10. Entries Over Time (line chart, daily)
function LineChart({ data }: { data: DailyEntry[] }) {
  if (!data.length) return <div className="text-sm text-muted text-center" style={{ padding: "var(--space-xl)" }}>No trend data</div>;
  const maxVal = Math.max(...data.map(d => d.positive + d.corrective), 1);
  const w = 340; const h = 160; const pad = { top: 8, right: 16, bottom: 24, left: 30 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  const pointsPos: [number, number][] = [];
  const pointsCorr: [number, number][] = [];
  data.forEach((d, i) => {
    const x = pad.left + (i / Math.max(data.length - 1, 1)) * chartW;
    const yPos = pad.top + chartH - (d.positive / maxVal) * chartH;
    const yCorr = pad.top + chartH - (d.corrective / maxVal) * chartH;
    pointsPos.push([x, yPos]);
    pointsCorr.push([x, yCorr]);
  });

  const linePos = pointsPos.map(([x, y]) => `${x},${y}`).join(" ");
  const lineCorr = pointsCorr.map(([x, y]) => `${x},${y}`).join(" ");

  // X-axis labels (show ~6 dates)
  const labelEvery = Math.max(1, Math.floor(data.length / 6));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Entries over time">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(pct => {
        const y = pad.top + chartH * (1 - pct);
        return <line key={pct} x1={pad.left} y1={y} x2={pad.left + chartW} y2={y} stroke="var(--color-gray-200)" strokeWidth="0.5" />;
      })}
      {/* Lines */}
      <polyline points={linePos} fill="none" stroke={CP} strokeWidth="2.5" strokeLinejoin="round" />
      <polyline points={lineCorr} fill="none" stroke={CC} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Dots for sparse data */}
      {data.map((d, i) => {
        if (data.length <= 30) {
          const x = pad.left + (i / Math.max(data.length - 1, 1)) * chartW;
          return (
            <g key={d.date}>
              {d.positive > 0 && <circle cx={x} cy={pad.top + chartH - (d.positive / maxVal) * chartH} r="4" fill={CP} />}
              {d.corrective > 0 && <circle cx={x} cy={pad.top + chartH - (d.corrective / maxVal) * chartH} r="4" fill={CC} />}
            </g>
          );
        }
        return null;
      })}
      {/* X-axis labels */}
      {data.map((d, i) => {
        if (i % labelEvery === 0 || i === data.length - 1) {
          const x = pad.left + (i / Math.max(data.length - 1, 1)) * chartW;
          return <text key={d.date} x={x} y={h - 4} textAnchor="middle" fontSize="8" fill="var(--color-gray-500)">{formatDateShort(d.date)}</text>;
        }
        return null;
      })}
      {/* Legend */}
      <line x1={pad.left + 100} y1={2} x2={pad.left + 118} y2={2} stroke={CP} strokeWidth="2.5" />
      <text x={pad.left + 122} y={6} fontSize="8" fill="var(--color-gray-500)">Positive</text>
      <line x1={pad.left + 170} y1={2} x2={pad.left + 188} y2={2} stroke={CC} strokeWidth="2.5" />
      <text x={pad.left + 192} y={6} fontSize="8" fill="var(--color-gray-500)">Corrective</text>
    </svg>
  );
}

// 11. Documentation Completion (donut-like bar)
function DocCompletionChart({ data }: { data: DocCompletion }) {
  const total = data.completed + data.pending + data.notRequired;
  if (total === 0) return <div className="text-sm text-muted text-center" style={{ padding: "var(--space-xl)" }}>No documentation data</div>;
  const items = [
    { label: "Completed", value: data.completed, color: CP },
    { label: "Pending", value: data.pending, color: "#E0A04A" },
    { label: "Not Required", value: data.notRequired, color: "var(--color-gray-300)" },
  ];
  const barH = 28; const gap = 10;
  const w = 300; const h = items.length * (barH + gap) + 4;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Documentation completion">
      {items.map((item, i) => {
        const y = i * (barH + gap) + 2;
        const pct = total > 0 ? (item.value / total) * 220 : 0;
        return (
          <g key={item.label}>
            <text x={0} y={y + barH / 2 + 4} fontSize="11" fill="var(--color-gray-700)" fontWeight="500">{item.label}</text>
            <rect x={100} y={y} width={Math.max(pct, 2)} height={barH} fill={item.color} rx="4" opacity="0.9" />
            <text x={105 + pct} y={y + barH / 2 + 4} fontSize="11" fill="var(--color-gray-700)" fontWeight="600">
              {item.value} ({total > 0 ? Math.round((item.value / total) * 100) : 0}%)
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// 12. Contact Status (summary bars)
function ContactStatusChart({ data }: { data: ContactStatus }) {
  const contacts = [
    { label: "Parent", contacted: data.parentContacted, pending: data.parentPending },
    { label: "Admin", contacted: data.adminContacted, pending: data.adminPending },
    { label: "Counselor", contacted: data.counselorContacted, pending: data.counselorPending },
  ];
  const total = contacts.reduce((s, c) => s + c.contacted + c.pending, 0);
  const maxVal = Math.max(...contacts.map(c => c.contacted + c.pending), 1);
  if (total === 0) return <div className="text-sm text-muted text-center" style={{ padding: "var(--space-xl)" }}>No contact data</div>;

  const barH = 24; const gap = 12;
  const w = 300; const h = contacts.length * (barH + gap) + 4;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Contact status">
      {contacts.map((c, i) => {
        const y = i * (barH + gap) + 2;
        const conW = maxVal > 0 ? (c.contacted / maxVal) * 160 : 0;
        const penW = maxVal > 0 ? (c.pending / maxVal) * 160 : 0;
        return (
          <g key={c.label}>
            <text x={0} y={y + barH / 2 + 4} fontSize="11" fill="var(--color-gray-700)" fontWeight="500">{c.label}</text>
            <rect x={65} y={y} width={Math.max(conW, 2)} height={barH} fill={CP} rx="4" opacity="0.85" />
            {c.pending > 0 && (
              <rect x={65 + conW} y={y} width={Math.max(penW, 2)} height={barH} fill="#E0A04A" rx="4" opacity="0.85" />
            )}
            <text x={68 + conW + penW} y={y + barH / 2 + 4} fontSize="10" fill="var(--color-gray-600)">
              {c.contacted} done{c.pending > 0 ? `, ${c.pending} pending` : ""}
            </text>
          </g>
        );
      })}
      {/* Legend */}
      <rect x={65} y={contacts.length * (barH + gap)} width={8} height={8} fill={CP} rx="2" />
      <text x={77} y={contacts.length * (barH + gap) + 10} fontSize="8" fill="var(--color-gray-500)">Contacted</text>
      <rect x={130} y={contacts.length * (barH + gap)} width={8} height={8} fill="#E0A04A" rx="2" />
      <text x={142} y={contacts.length * (barH + gap) + 10} fontSize="8" fill="var(--color-gray-500)">Pending</text>
    </svg>
  );
}

/* ── Chart Card Wrapper ────────────────────────────── */
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="chart-card">
      <div className="chart-card__title">{title}</div>
      <div className="chart-card__body">{children}</div>
    </div>
  );
}

/* ── Main Trends Page ──────────────────────────────── */
export default function Trends() {
  const { legacyToken: token } = useLegacyToken();
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter state
  const [datePreset, setDatePreset] = useState<DatePreset>("last-30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [entryTypeFilter, setEntryTypeFilter] = useState<string>("all");
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [filtersVisible, setFiltersVisible] = useState(false);

  const activeFilterCount = [
    datePreset !== "last-30" ? 1 : 0,
    gradeFilter ? 1 : 0,
    subjectFilter ? 1 : 0,
    locationFilter ? 1 : 0,
    selectedCategories.length,
    entryTypeFilter !== "all" ? 1 : 0,
    selectedSeverities.length,
  ].reduce((a, b) => a + b, 0);

  // Fetch data
  useEffect(() => {
    if (!token) return;
    setLoading(true);

    const range = datePreset === "custom"
      ? { from: customFrom, to: customTo }
      : dateRangeForPreset(datePreset);

    const params = new URLSearchParams();
    if (range.from) params.set("date_from", range.from);
    if (range.to) params.set("date_to", range.to);
    if (gradeFilter) params.set("grade", gradeFilter);
    if (subjectFilter) params.set("subject", subjectFilter);
    if (locationFilter) params.set("location", locationFilter);
    if (selectedCategories.length === 1) params.set("behavior_category", selectedCategories[0]);
    if (entryTypeFilter !== "all") params.set("entry_type", entryTypeFilter);
    if (selectedSeverities.length > 0) params.set("severity", selectedSeverities.join(","));

    fetch(`/api/trends/stats?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(json => { setData(json); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [token, datePreset, customFrom, customTo, gradeFilter, subjectFilter, locationFilter,
      selectedCategories, entryTypeFilter, selectedSeverities]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const toggleSeverity = (sev: string) => {
    setSelectedSeverities(prev =>
      prev.includes(sev) ? prev.filter(s => s !== sev) : [...prev, sev]
    );
  };

  if (loading && !data) return (
    <div className="loading" aria-busy="true">
      <span className="spinner spinner--lg" style={{ marginRight: "var(--space-sm)" }} />
      Loading trends...
    </div>
  );
  if (error && !data) return (
    <div className="alert alert--error">
      <p style={{ marginBottom: "var(--space-sm)" }}>Failed to load trends: {error}</p>
      <button className="btn btn--primary btn--sm" onClick={() => { setError(""); setLoading(true); }}>
        Retry
      </button>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-md">
        <h1>Classroom Trends</h1>
        <button
          className="btn btn--ghost btn--sm hide-desktop"
          onClick={() => setFiltersVisible(!filtersVisible)}
        >
          {filtersVisible ? "Hide Filters" : `Filters${activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}`}
        </button>
      </div>

      <div className="alert alert--demo mb-md">
        <strong><AlertTriangle size={14} style={{ display: "inline", marginRight: 4 }} /> BehaviorTrack is a supplemental tool.</strong> It does not replace official district documentation systems. Use the Official Documentation Queue to track which entries still need to be entered into your district's system.
      </div>

      {/* ── Filters Bar ──────────────────────────────── */}
      <div className={`card mb-md ${!filtersVisible ? "hide-mobile-filters" : ""}`}>
        <div className="card__body">
          {/* Date presets */}
          <div className="form-group">
            <label className="form-label">Date Range</label>
            <div className="chip-group" style={{ marginBottom: "var(--space-sm)" }}>
              {([
                ["this-week", "This Week"],
                ["last-week", "Last Week"],
                ["this-month", "This Month"],
                ["last-30", "Last 30 Days"],
                ["last-90", "Last 90 Days"],
                ["custom", "Custom"],
              ] as [DatePreset, string][]).map(([val, label]) => (
                <button
                  key={val}
                  className={`chip ${datePreset === val ? "chip--selected" : ""}`}
                  onClick={() => setDatePreset(val)}
                >{label}</button>
              ))}
            </div>
            {datePreset === "custom" && (
              <div className="flex gap-sm items-center" style={{ flexWrap: "wrap" }}>
                <input type="date" className="form-input" style={{ width: "auto", minWidth: "140px" }}
                  value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
                <span className="text-sm text-muted">to</span>
                <input type="date" className="form-input" style={{ width: "auto", minWidth: "140px" }}
                  value={customTo} onChange={e => setCustomTo(e.target.value)} />
              </div>
            )}
          </div>

          {/* Grade, Subject, Location row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Grade</label>
              <select className="form-select" value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}>
                <option value="">All Grades</option>
                {data?.filters.grades.map(g => <option key={g} value={g}>Grade {g}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Subject</label>
              <select className="form-select" value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
                <option value="">All Subjects</option>
                {data?.filters.subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Location</label>
              <select className="form-select" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
                <option value="">All Locations</option>
                {data?.filters.locations.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Entry Type */}
          <div className="form-group">
            <label className="form-label">Entry Type</label>
            <div className="chip-group">
              {[
                ["all", "All"],
                ["positive", "Positive Only"],
                ["corrective", "Corrective Only"],
              ].map(([val, label]) => (
                <button
                  key={val}
                  className={`chip ${entryTypeFilter === val ? "chip--selected" : ""}`}
                  onClick={() => setEntryTypeFilter(val)}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Severity (only when corrective/all is selected) */}
          {entryTypeFilter !== "positive" && (
            <div className="form-group">
              <label className="form-label">Severity</label>
              <div className="chip-group">
                {SEVERITY_TYPES.map(s => (
                  <button
                    key={s.value}
                    className={`chip ${selectedSeverities.includes(s.value) ? "chip--selected" : ""}`}
                    onClick={() => toggleSeverity(s.value)}
                  >{s.label}</button>
                ))}
              </div>
            </div>
          )}

          {/* Behavior Category chips */}
          <div className="form-group">
            <label className="form-label">Behavior Categories</label>
            <div className="chip-group">
              {ALL_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  className={`chip ${selectedCategories.includes(cat) ? "chip--selected" : ""}`}
                  onClick={() => toggleCategory(cat)}
                >{cat}</button>
              ))}
            </div>
          </div>

          {/* Reset */}
          <div className="flex items-center justify-between">
            <div>
              {activeFilterCount > 0 && (
                <span className="badge badge--neutral">
                  {activeFilterCount} active filter{activeFilterCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {activeFilterCount > 0 && (
              <button className="btn btn--ghost btn--sm" onClick={() => {
                setDatePreset("last-30");
                setCustomFrom(""); setCustomTo("");
                setGradeFilter(""); setSubjectFilter(""); setLocationFilter("");
                setSelectedCategories([]); setEntryTypeFilter("all"); setSelectedSeverities([]);
              }}>Reset All Filters</button>
            )}
          </div>
        </div>
      </div>

      {!data ? (
        <div className="empty-state">
          <span className="empty-state__icon"><TrendingUp size={40} /></span>
          <p>No trend data available for the selected filters.</p>
        </div>
      ) : (
        <>
          {/* ── Summary Stats Row ───────────────────── */}
          <div className="stat-cards-grid mb-md">
            <div className="stat-card">
              <div className="stat-card__icon"><FileText size={18} /></div>
              <div className="stat-card__value">{data.summary.totalEntries}</div>
              <div className="stat-card__label">Total Entries</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__icon"><Star size={18} /></div>
              <div className="stat-card__value" style={{ color: "var(--color-success)" }}>
                {data.summary.positiveCount}
              </div>
              <div className="stat-card__label">Positive</div>
              <div className="stat-card__sub">{data.summary.positivePct}%</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__icon"><FileText size={18} /></div>
              <div className="stat-card__value" style={{ color: data.summary.correctiveCount > 0 ? "var(--color-danger)" : "var(--color-gray-500)" }}>
                {data.summary.correctiveCount}
              </div>
              <div className="stat-card__label">Corrective</div>
              <div className="stat-card__sub">{data.summary.correctivePct}%</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__icon"><BarChart3 size={18} /></div>
              <div className="stat-card__value">{data.summary.ratio}{data.summary.ratio === Math.floor(data.summary.ratio) ? ":1" : ":1"}</div>
              <div className="stat-card__label">Pos:Corr Ratio</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__icon"><Tag size={18} /></div>
              <div className="stat-card__value" style={{ fontSize: "0.95rem" }}>{data.summary.mostCommonBehavior}</div>
              <div className="stat-card__label">Most Common Behavior</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__icon"><Search size={18} /></div>
              <div className="stat-card__value" style={{ fontSize: "0.95rem" }}>{data.summary.mostCommonTrigger}</div>
              <div className="stat-card__label">Most Common Trigger</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__icon"><CheckCircle size={18} /></div>
              <div className="stat-card__value" style={{ fontSize: "0.85rem" }}>{data.summary.mostEffectiveIntervention}</div>
              <div className="stat-card__label">Most Effective Intervention</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__icon"><ClipboardList size={18} /></div>
              <div className="stat-card__value">{data.summary.docCompletionRate}%</div>
              <div className="stat-card__label">Doc Completion</div>
            </div>
          </div>

          {/* ── Charts Grid ─────────────────────────── */}
          <h2 className="mb-sm">Charts &amp; Analysis</h2>
          <div className="charts-grid">
            {/* 1. Entries by Day of Week */}
            <ChartCard title="Entries by Day of Week">
              <EntriesByDayChart data={data.byDayOfWeek} />
            </ChartCard>

            {/* 2. Entries by Time of Day */}
            <ChartCard title="Entries by Time of Day">
              <TimeOfDayChart data={data.byTimeOfDay} />
            </ChartCard>

            {/* 3. Entries by Subject */}
            <ChartCard title="Entries by Subject">
              <HorizontalBarChart data={data.bySubject} color="var(--color-primary)" />
            </ChartCard>

            {/* 4. Entries by Location */}
            <ChartCard title="Entries by Location">
              <HorizontalBarChart data={data.byLocation} color="var(--color-info)" />
            </ChartCard>

            {/* 5. Positive vs Corrective Ratio */}
            <ChartCard title="Positive vs Corrective Ratio">
              <RatioDonutChart
                positive={data.positiveVsCorrective.positive}
                corrective={data.positiveVsCorrective.corrective}
              />
            </ChartCard>

            {/* 6. Top Behavior Categories */}
            <ChartCard title="Top Behavior Categories">
              <HorizontalBarChart data={data.topCategories} color="var(--color-primary)" maxItems={10} />
            </ChartCard>

            {/* 7. Top Possible Triggers */}
            <ChartCard title="Top Possible Triggers">
              <HorizontalBarChart data={data.topTriggers} color="var(--color-warning)" maxItems={10} />
            </ChartCard>

            {/* 8. Intervention Effectiveness */}
            <ChartCard title="Intervention Effectiveness">
              <InterventionChart data={data.interventionEffectiveness} />
            </ChartCard>

            {/* 9. Severity Distribution */}
            <ChartCard title="Severity Distribution">
              <SeverityDistChart data={data.severityDistribution} />
            </ChartCard>

            {/* 10. Entries Over Time */}
            <ChartCard title="Entries Over Time">
              <LineChart data={data.entriesOverTime} />
            </ChartCard>

            {/* 11. Documentation Completion */}
            <ChartCard title="Official Documentation Completion">
              <DocCompletionChart data={data.documentationCompletion} />
            </ChartCard>

            {/* 12. Contact Status */}
            <ChartCard title="Contact Status">
              <ContactStatusChart data={data.contactStatus} />
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

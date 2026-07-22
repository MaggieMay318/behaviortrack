import { useState, useEffect, useMemo } from "react";
import { useLegacyToken } from "../lib/auth";
import { Printer, Copy, FileDown, X, FileText, ClipboardList, Target, BarChart3, Calendar, MessageSquare, Users, Shield } from "lucide-react";

/* ───────────────────────────────────────────
   Type definitions
   ─────────────────────────────────────────── */

interface Student {
  id: number; display_name: string; initials: string;
  grade: string; classroom: string;
}

interface Entry {
  id: number; student_id: number; student_name: string;
  student_initials: string; student_grade: string;
  date: string; time: string; subject_activity: string;
  location: string; entry_type: string;
  behavior_categories: string; objective_observation: string;
  possible_triggers: string; interventions: string;
  student_response: string; outcome: string;
  parent_contact_status: string; admin_contact_status: string;
  counselor_contact_status: string; follow_up_date: string;
  doc_status: string; doc_system_name: string;
  doc_reference_number: string; doc_completion_date: string;
}

interface Goal {
  id: number; student_id: number; title: string;
  description: string; start_date: string; review_date: string;
  target_behavior: string; measurement_method: string;
  baseline: string; target: string; tracking_frequency: string;
  responsible_staff: string; supports: string; status: string;
  progressCount: number; avgRating: number | null;
  student_name: string; student_initials: string;
}

interface StatData {
  byWeek: { week: string; positive: number; corrective: number }[];
  byDayOfWeek: { day: string; count: number }[];
  bySubject: { name: string; count: number }[];
  byLocation: { name: string; count: number }[];
  byCategory: { name: string; count: number }[];
  byTrigger: { name: string; count: number }[];
  byIntervention: { name: string; stopped: number; decreased: number; continued: number; escalated: number }[];
}

interface ReportData {
  reportType: string;
  studentName: string;
  studentGrade: string;
  dateFrom: string;
  dateTo: string;
  generatedDate: string;
  teacherName: string;
  entries: Entry[];
  stats: StatData | null;
  goals: Goal[];
  selectedSections: string[];
}

/* ───────────────────────────────────────────
   Constants
   ─────────────────────────────────────────── */

const reportIconMap: Record<string, React.ReactNode> = {
  parent_conference: <Users size={20} />,
  admin_referral: <ClipboardList size={20} />,
  counselor_meeting: <MessageSquare size={20} />,
  sblc_meeting: <Shield size={20} />,
  iep_504: <FileText size={20} />,
  support_planning: <Target size={20} />,
  weekly_review: <BarChart3 size={20} />,
  monthly_student: <Calendar size={20} />,
  doc_summary: <FileText size={20} />,
};

const REPORT_TYPES = [
  { id: "parent_conference", label: "Parent Conference" },
  { id: "admin_referral", label: "Administrative Referral" },
  { id: "counselor_meeting", label: "Counselor Meeting" },
  { id: "sblc_meeting", label: "Intervention / SBLC Meeting" },
  { id: "iep_504", label: "504 / IEP Discussion" },
  { id: "support_planning", label: "Behavior Support Planning" },
  { id: "weekly_review", label: "Weekly Classroom Review" },
  { id: "monthly_student", label: "Monthly Student Summary" },
  { id: "doc_summary", label: "Official Documentation Summary" },
];

const SECTION_OPTIONS = [
  { id: "behavior_summary", label: "Behavior entries", default: true },
  { id: "positive_highlights", label: "Positive behavior highlights", default: true },
  { id: "goal_progress", label: "Behavior goals + progress", default: true },
  { id: "contacts", label: "Parent/counselor/admin contacts", default: true },
  { id: "interventions", label: "Interventions used + effectiveness", default: true },
  { id: "outcomes", label: "Outcomes summary", default: false },
  { id: "follow_ups", label: "Follow-ups", default: true },
  { id: "doc_status", label: "Official documentation status", default: true },
  { id: "patterns", label: "Patterns observed", default: false },
];

const DATE_PRESETS = [
  { id: "this_week", label: "This Week" },
  { id: "last_week", label: "Last Week" },
  { id: "this_month", label: "This Month" },
  { id: "last_30", label: "Last 30 Days" },
  { id: "custom", label: "Custom" },
];

/* ───────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────── */

function fmtDate(d: string) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function parseArray(s: string): string[] {
  try { return JSON.parse(s); } catch { return []; }
}

function daysInRange(from: string, to: string): number {
  const f = new Date(from + "T00:00:00");
  const t = new Date(to + "T00:00:00");
  return Math.max(1, Math.round((t.getTime() - f.getTime()) / 86400000) + 1);
}

function getDateRange(preset: string): { from: string; to: string } {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  if (preset === "this_week") {
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const mon = new Date(now);
    mon.setDate(mon.getDate() - mondayOffset);
    return { from: mon.toISOString().slice(0, 10), to: today };
  }
  if (preset === "last_week") {
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const lastMon = new Date(now);
    lastMon.setDate(lastMon.getDate() - mondayOffset - 7);
    const lastSun = new Date(lastMon);
    lastSun.setDate(lastSun.getDate() + 6);
    return { from: lastMon.toISOString().slice(0, 10), to: lastSun.toISOString().slice(0, 10) };
  }
  if (preset === "this_month") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: first.toISOString().slice(0, 10), to: today };
  }
  if (preset === "last_30") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return { from: d.toISOString().slice(0, 10), to: today };
  }
  return { from: "", to: "" };
}

/* ───────────────────────────────────────────
   SVG Bar chart
   ─────────────────────────────────────────── */

function HBarChart({ data, maxWidth, colorClass }: {
  data: { name: string; count: number }[];
  maxWidth?: number;
  colorClass?: string;
}) {
  if (!data.length) return <p className="text-sm text-muted">No data available.</p>;
  const max = Math.max(...data.map(d => d.count), 1);
  const width = maxWidth || 300;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", fontSize: "0.8rem" }}>
          <span style={{ width: 140, flexShrink: 0, textAlign: "right", color: "var(--color-gray-600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {d.name}
          </span>
          <div style={{ flex: 1, background: "var(--color-gray-100)", borderRadius: "var(--radius-sm)", height: 18, overflow: "hidden" }}>
            <div style={{
              width: `${(d.count / max) * 100}%`,
              height: "100%",
              background: colorClass || "var(--color-primary)",
              borderRadius: "var(--radius-sm)",
              minWidth: d.count > 0 ? 4 : 0,
              transition: "width 0.3s",
            }} />
          </div>
          <span style={{ width: 30, flexShrink: 0, fontWeight: 600, color: "var(--color-gray-700)", textAlign: "right" }}>
            {d.count}
          </span>
        </div>
      ))}
    </div>
  );
}

function MiniProgressChart({ goal }: { goal: Goal }) {
  const avg = goal.avgRating || 0;
  const pct = (avg / 5) * 100;
  const color = avg >= 4 ? "var(--color-success)" : avg >= 3 ? "var(--color-warning)" : "var(--color-danger)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
      <div style={{ flex: 1, height: 8, background: "var(--color-gray-100)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "var(--radius-full)" }} />
      </div>
      <span style={{ fontSize: "0.75rem", fontWeight: 600, color }}>{avg.toFixed(1)}/5</span>
    </div>
  );
}

/* ───────────────────────────────────────────
   Auto-generated questions
   ─────────────────────────────────────────── */

function generateQuestions(entries: Entry[], stats: StatData | null, goals: Goal[]): string[] {
  const qs: string[] = [];
  if (!entries.length) return ["No entries available to generate team discussion questions."];

  const correctiveCount = entries.filter(e => e.entry_type !== "positive").length;
  const totalCount = entries.length;

  if (totalCount > 0 && correctiveCount / totalCount > 0.6) {
    qs.push("The available data suggests that corrective entries outnumber positive observations during this period — the team may want to discuss strategies for increasing positive reinforcement opportunities.");
  }

  if (stats?.bySubject?.length) {
    const topSubject = stats.bySubject[0];
    const correctiveInSubject = entries.filter(e => e.entry_type !== "positive" && e.subject_activity === topSubject.name).length;
    if (correctiveInSubject >= 3) {
      qs.push(`Corrective entries appear more frequent during ${topSubject.name} — the team may want to discuss instructional supports or environmental adjustments for this context.`);
    }
  }

  if (stats?.byTrigger?.length) {
    const topTriggers = stats.byTrigger.slice(0, 3).map(t => t.name).join(", ");
    qs.push(`The most frequently observed triggers were: ${topTriggers}. The team may want to discuss proactive strategies for these contexts.`);
  }

  if (stats?.byIntervention?.length) {
    const effectiveIntvs = stats.byIntervention.filter(i => (i.stopped + i.decreased) >= (i.continued + i.escalated) && (i.stopped + i.decreased) > 0);
    if (effectiveIntvs.length >= 2) {
      const names = effectiveIntvs.slice(0, 2).map(i => i.name).join(" and ");
      qs.push(`${names} were among the more effective interventions — the team may want to discuss incorporating these into a consistent support plan.`);
    }
  }

  const goalsInProgress = goals.filter(g => g.status === "in_progress" || g.status === "improving");
  if (goalsInProgress.length > 0 && goalsInProgress.some(g => (g.avgRating || 0) < 3)) {
    qs.push("Some behavior goals show ratings below the midpoint — the team may want to review whether current supports are adequately matched to the student's needs.");
  }

  if (stats?.byLocation?.length) {
    const topLoc = stats.byLocation[0];
    if (topLoc.count >= 3) {
      qs.push(`Entries were most frequently recorded in ${topLoc.name} — the team may want to discuss environmental factors in this setting.`);
    }
  }

  const pendingDocs = entries.filter(e => e.doc_status === "required_pending").length;
  if (pendingDocs >= 3) {
    qs.push(`${pendingDocs} entries still require official documentation — the team may want to allocate time to complete these before upcoming meetings or deadlines.`);
  }

  if (qs.length === 0) {
    qs.push("The available data does not suggest specific discussion points. The team may want to review overall trends and celebrate successes observed during this period.");
  }

  return qs;
}

/* ───────────────────────────────────────────
   Report Output Component
   ─────────────────────────────────────────── */

function ReportOutput({ data, onClose }: { data: ReportData; onClose: () => void }) {
  const { reportType, studentName, studentGrade, dateFrom, dateTo, generatedDate, teacherName, entries, stats, goals, selectedSections } = data;
  const include = (s: string) => selectedSections.includes(s);

  const positiveCount = entries.filter(e => e.entry_type === "positive").length;
  const correctiveCount = entries.filter(e => e.entry_type !== "positive").length;
  const allCategories = new Map<string, number>();
  const allTriggers = new Map<string, number>();
  const allInterventions = new Map<string, { total: number; stopped: number; decreased: number; continued: number; escalated: number }>();

  for (const e of entries) {
    for (const c of parseArray(e.behavior_categories)) allCategories.set(c, (allCategories.get(c) || 0) + 1);
    for (const t of parseArray(e.possible_triggers)) allTriggers.set(t, (allTriggers.get(t) || 0) + 1);
    if (e.entry_type !== "positive") {
      const intvs = parseArray(e.interventions);
      const outcomes = parseArray(e.outcome);
      const outcome = outcomes[0] || "";
      for (const iv of intvs) {
        if (!allInterventions.has(iv)) allInterventions.set(iv, { total: 0, stopped: 0, decreased: 0, continued: 0, escalated: 0 });
        const rec = allInterventions.get(iv)!;
        rec.total++;
        if (outcome === "Stopped") rec.stopped++;
        else if (outcome === "Decreased") rec.decreased++;
        else if (outcome === "Escalated") rec.escalated++;
        else rec.continued++;
      }
    }
  }

  const sortedCategories = [...allCategories.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));
  const sortedTriggers = [...allTriggers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));
  const sortedInterventions = [...allInterventions.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([name, d]) => ({ name, ...d }));

  const questions = useMemo(() => generateQuestions(entries, stats, goals), [entries, stats, goals]);

  const entryTypeLabel = (t: string) => t.replace(/_/g, " ");
  const statusLabel = (s: string) => {
    const map: Record<string, string> = { not_started: "Not Started", in_progress: "In Progress", improving: "Improving", goal_met: "Goal Met", needs_revision: "Needs Revision", discontinued: "Discontinued" };
    return map[s] || s;
  };

  const printReport = () => window.print();
  const copyReport = () => {
    const text = buildReportText();
    navigator.clipboard.writeText(text).then(() => alert("Report copied to clipboard")).catch(() => {});
  };

  function buildReportText(): string {
    let txt = `BehaviorTrack Report\n${"=".repeat(40)}\n`;
    txt += `Report Type: ${REPORT_TYPES.find(r => r.id === reportType)?.label || reportType}\n`;
    if (studentName) txt += `Student: ${studentName}${studentGrade ? ` (Grade ${studentGrade})` : ""}\n`;
    txt += `Date Range: ${fmtDate(dateFrom)} – ${fmtDate(dateTo)}\n`;
    txt += `Generated: ${generatedDate}\n`;
    txt += `Generated by: ${teacherName}\n`;
    txt += `\n--- Behavior Summary ---\n`;
    txt += `Total entries: ${entries.length} | Positive: ${positiveCount} | Corrective: ${correctiveCount}\n`;
    for (const e of entries) {
      txt += `  ${e.date} ${e.time} [${entryTypeLabel(e.entry_type)}] ${e.student_name}: ${e.objective_observation.slice(0, 100)}\n`;
    }
    if (include("positive_highlights")) {
      txt += `\n--- Positive Highlights ---\n`;
      const pos = entries.filter(e => e.entry_type === "positive");
      for (const e of pos) txt += `  ${e.date}: ${e.objective_observation.slice(0, 100)}\n`;
    }
    if (include("interventions")) {
      txt += `\n--- Intervention Effectiveness ---\n`;
      for (const iv of sortedInterventions) {
        txt += `  ${iv.name}: ${iv.total} uses (Stopped: ${iv.stopped}, Decreased: ${iv.decreased}, Continued: ${iv.continued}, Escalated: ${iv.escalated})\n`;
      }
    }
    if (include("goal_progress")) {
      txt += `\n--- Goal Progress ---\n`;
      for (const g of goals) txt += `  ${g.title} — ${statusLabel(g.status)} — Avg Rating: ${g.avgRating || "N/A"}\n`;
    }
    if (include("contacts")) {
      txt += `\n--- Contacts ---\n`;
      const withContact = entries.filter(e => e.parent_contact_status || e.admin_contact_status || e.counselor_contact_status);
      for (const e of withContact) {
        if (e.parent_contact_status) txt += `  ${e.date}: Parent contact — ${e.parent_contact_status}\n`;
        if (e.admin_contact_status) txt += `  ${e.date}: Admin contact — ${e.admin_contact_status}\n`;
        if (e.counselor_contact_status) txt += `  ${e.date}: Counselor contact — ${e.counselor_contact_status}\n`;
      }
    }
    if (include("follow_ups")) {
      txt += `\n--- Follow-ups ---\n`;
      const withFU = entries.filter(e => e.follow_up_date);
      for (const e of withFU) txt += `  ${e.date}: Follow-up due ${e.follow_up_date} — ${e.objective_observation.slice(0, 80)}\n`;
    }
    if (include("doc_status")) {
      txt += `\n--- Documentation Status ---\n`;
      const pending = entries.filter(e => e.doc_status === "required_pending");
      const completed = entries.filter(e => e.doc_status === "completed");
      txt += `  Pending: ${pending.length} | Completed: ${completed.length}\n`;
    }
    txt += `\n--- Questions for the Team to Consider ---\n`;
    for (const q of questions) txt += `  • ${q}\n`;
    txt += `\nBehaviorTrack is a supplemental tracking tool and does not replace documentation required by the school district or other official educational records.\n`;
    return txt;
  }

  return (
    <div className="report-output">
      <style>{printStyles}</style>

      {/* Action bar */}
      <div className="report-actions no-print" style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "var(--space-md)", flexWrap: "wrap" }}>
        <button className="btn btn--secondary btn--sm" onClick={printReport}><Printer size={14} /> Print</button>
        <button className="btn btn--secondary btn--sm" onClick={copyReport}><Copy size={14} /> Copy</button>
        <button className="btn btn--secondary btn--sm" onClick={printReport}><FileDown size={14} /> Export PDF</button>
        <button className="btn btn--ghost btn--sm" onClick={onClose}><X size={14} /> Close</button>
      </div>

      {/* Report Header */}
      <div className="card report-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-sm)" }}>
          <div>
            <h1 style={{ fontSize: "1.35rem", marginBottom: "var(--space-xs)" }}>BehaviorTrack Report</h1>
            <p style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--color-primary)", marginBottom: "var(--space-xs)" }}>
              {REPORT_TYPES.find(r => r.id === reportType)?.label || reportType}
            </p>
          </div>
          {import.meta.env.VITE_DEMO_MODE === "true" && (
            <div className="badge badge--neutral" style={{ fontSize: "0.75rem" }}>Demo Mode — Fictional Data</div>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm) var(--space-lg)", fontSize: "0.85rem", color: "var(--color-gray-600)" }}>
          {studentName && <span><strong>Student:</strong> {studentName}{studentGrade ? ` (Grade ${studentGrade})` : ""}</span>}
          <span><strong>Date Range:</strong> {fmtDate(dateFrom)} – {fmtDate(dateTo)}</span>
          <span><strong>Generated:</strong> {generatedDate}</span>
          <span><strong>By:</strong> {teacherName}</span>
        </div>
      </div>

      {/* Behavior Summary */}
      {include("behavior_summary") && (
        <div className="card">
          <h2 style={{ marginBottom: "var(--space-sm)" }}>Behavior Summary</h2>
          <div style={{ display: "flex", gap: "var(--space-lg)", marginBottom: "var(--space-md)", flexWrap: "wrap" }}>
            <div className="stat-card" style={{ minWidth: 100, minHeight: 70, padding: "var(--space-sm) var(--space-md)" }}>
              <div className="stat-card__value">{entries.length}</div>
              <div className="stat-card__label">Total Entries</div>
            </div>
            <div className="stat-card" style={{ minWidth: 100, minHeight: 70, padding: "var(--space-sm) var(--space-md)" }}>
              <div className="stat-card__value" style={{ color: "var(--color-success)" }}>{positiveCount}</div>
              <div className="stat-card__label">Positive</div>
            </div>
            <div className="stat-card" style={{ minWidth: 100, minHeight: 70, padding: "var(--space-sm) var(--space-md)" }}>
              <div className="stat-card__value" style={{ color: "var(--color-danger)" }}>{correctiveCount}</div>
              <div className="stat-card__label">Corrective</div>
            </div>
          </div>

          {sortedCategories.length > 0 && (
            <div style={{ marginBottom: "var(--space-md)" }}>
              <h3 style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--color-gray-500)", marginBottom: "var(--space-sm)" }}>Most Common Behaviors</h3>
              <HBarChart data={sortedCategories} colorClass="var(--color-primary)" />
            </div>
          )}

          {sortedTriggers.length > 0 && (
            <div style={{ marginBottom: "var(--space-md)" }}>
              <h3 style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--color-gray-500)", marginBottom: "var(--space-sm)" }}>Most Common Triggers</h3>
              <HBarChart data={sortedTriggers} colorClass="#b86e1c" />
            </div>
          )}

          {sortedInterventions.length > 0 && (
            <div style={{ marginBottom: "var(--space-md)" }}>
              <h3 style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--color-gray-500)", marginBottom: "var(--space-sm)" }}>Most-Used Interventions</h3>
              <HBarChart data={sortedInterventions.map(i => ({ name: i.name, count: i.total }))} colorClass="var(--color-success)" />
            </div>
          )}

          <details>
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", color: "var(--color-gray-600)", padding: "var(--space-sm) 0" }}>
              Entry Timeline ({entries.length} entries)
            </summary>
            <div style={{ maxHeight: 400, overflowY: "auto", marginTop: "var(--space-sm)" }}>
              {entries.map(e => (
                <div key={e.id} style={{ padding: "var(--space-sm) 0", borderBottom: "1px solid var(--color-gray-100)", fontSize: "0.82rem" }}>
                  <span style={{ fontWeight: 600 }}>{e.date} {e.time}</span>
                  {" — "}
                  <span className={`badge ${e.entry_type === "positive" ? "badge--positive" : e.entry_type === "minor_concern" ? "badge--minor" : e.entry_type === "moderate_concern" ? "badge--moderate" : e.entry_type === "major_concern" ? "badge--major" : "badge--crisis"}`}>
                    {entryTypeLabel(e.entry_type)}
                  </span>
                  {studentName ? "" : <> — <strong>{e.student_name}</strong></>}
                  <span style={{ color: "var(--color-gray-500)" }}> — {e.subject_activity || "N/A"} | {e.location || "N/A"}</span>
                  <p style={{ marginTop: 2, marginBottom: 0 }}>{e.objective_observation.slice(0, 200)}</p>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* Positive Behavior Highlights */}
      {include("positive_highlights") && (
        <div className="card">
          <h2 style={{ marginBottom: "var(--space-sm)" }}>Positive Behavior Highlights</h2>
          {entries.filter(e => e.entry_type === "positive").length === 0 ? (
            <p className="text-sm text-muted">No positive entries recorded during this period.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              {entries.filter(e => e.entry_type === "positive").map(e => (
                <div key={e.id} style={{ padding: "var(--space-sm)", background: "var(--color-success-bg)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem" }}>
                  <span style={{ fontWeight: 600 }}>{e.date}</span>
                  {studentName ? "" : <> — <strong>{e.student_name}</strong></>}
                  <p style={{ marginTop: 2, marginBottom: 0 }}>{e.objective_observation}</p>
                </div>
              ))}
            </div>
          )}
          {positiveCount >= 3 && (
            <div className="alert alert--info" style={{ marginTop: "var(--space-md)" }}>
              <strong>Trend:</strong> {positiveCount} positive entries recorded over {daysInRange(dateFrom, dateTo)} days. Recognizing and reinforcing positive behaviors supports a constructive classroom environment.
            </div>
          )}
        </div>
      )}

      {/* Intervention Effectiveness */}
      {include("interventions") && (
        <div className="card">
          <h2 style={{ marginBottom: "var(--space-sm)" }}>Intervention Effectiveness</h2>
          {sortedInterventions.length === 0 ? (
            <p className="text-sm text-muted">No intervention data available.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              {sortedInterventions.map(iv => {
                const effective = iv.stopped + iv.decreased;
                const total = iv.total;
                const rate = total > 0 ? Math.round((effective / total) * 100) : 0;
                return (
                  <div key={iv.name} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{iv.name}</span>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: rate >= 50 ? "var(--color-success)" : "var(--color-gray-500)" }}>
                        {effective}/{total} effective ({rate}%)
                      </span>
                    </div>
                    <div style={{ display: "flex", height: 6, borderRadius: "var(--radius-full)", overflow: "hidden", background: "var(--color-gray-100)" }}>
                      {iv.stopped > 0 && <div title={`Stopped: ${iv.stopped}`} style={{ width: `${(iv.stopped/total)*100}%`, background: "var(--color-success)", transition: "width 0.3s" }} />}
                      {iv.decreased > 0 && <div title={`Decreased: ${iv.decreased}`} style={{ width: `${(iv.decreased/total)*100}%`, background: "#5ba870" }} />}
                      {iv.continued > 0 && <div title={`Continued: ${iv.continued}`} style={{ width: `${(iv.continued/total)*100}%`, background: "var(--color-warning)" }} />}
                      {iv.escalated > 0 && <div title={`Escalated: ${iv.escalated}`} style={{ width: `${(iv.escalated/total)*100}%`, background: "var(--color-danger)" }} />}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--color-gray-500)", display: "flex", gap: "var(--space-md)" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-success)", display: "inline-block" }} /> Stopped: {iv.stopped}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7CC89A", display: "inline-block" }} /> Decreased: {iv.decreased}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#E0A04A", display: "inline-block" }} /> Continued: {iv.continued}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-chart-corrective)", display: "inline-block" }} /> Escalated: {iv.escalated}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Goal Progress */}
      {include("goal_progress") && (
        <div className="card">
          <h2 style={{ marginBottom: "var(--space-sm)" }}>Goal Progress</h2>
          {goals.length === 0 ? (
            <p className="text-sm text-muted">No behavior goals found for this student.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
              {goals.map(g => (
                <div key={g.id} style={{ padding: "var(--space-sm) var(--space-md)", border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-md)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-sm)", flexWrap: "wrap", marginBottom: "var(--space-xs)" }}>
                    <strong style={{ fontSize: "0.9rem" }}>{g.title}</strong>
                    <span className={`badge ${g.status === "goal_met" ? "badge--positive" : g.status === "improving" ? "badge--minor" : g.status === "needs_revision" ? "badge--moderate" : "badge--neutral"}`}>
                      {statusLabel(g.status)}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "var(--color-gray-600)", marginBottom: "var(--space-xs)" }}>{g.target_behavior}</p>
                  <div style={{ fontSize: "0.78rem", color: "var(--color-gray-500)", marginBottom: "var(--space-sm)" }}>
                    Target: {g.target} | Baseline: {g.baseline} | {g.progressCount} progress entries
                  </div>
                  <MiniProgressChart goal={g} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contacts */}
      {include("contacts") && (
        <div className="card">
          <h2 style={{ marginBottom: "var(--space-sm)" }}>Contacts</h2>
          {(() => {
            const parentContacts = entries.filter(e => e.parent_contact_status && e.parent_contact_status !== "not_contacted");
            const adminContacts = entries.filter(e => e.admin_contact_status && e.admin_contact_status !== "not_contacted");
            const counselorContacts = entries.filter(e => e.counselor_contact_status && e.counselor_contact_status !== "not_contacted");

            if (!parentContacts.length && !adminContacts.length && !counselorContacts.length) {
              return <p className="text-sm text-muted">No contacts recorded during this period.</p>;
            }

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                {parentContacts.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: "0.85rem", color: "var(--color-gray-600)", marginBottom: "var(--space-xs)" }}>Parent Contacts</h3>
                    {parentContacts.map(e => (
                      <div key={e.id} style={{ fontSize: "0.82rem", padding: "var(--space-xs) 0", borderBottom: "1px solid var(--color-gray-100)" }}>
                        <strong>{e.date}</strong> — {e.parent_contact_status.replace(/_/g, " ")}
                        {studentName ? "" : <> — {e.student_name}</>}
                        {e.objective_observation && <p style={{ marginTop: 2, marginBottom: 0, color: "var(--color-gray-600)" }}>{e.objective_observation.slice(0, 150)}</p>}
                      </div>
                    ))}
                  </div>
                )}
                {adminContacts.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: "0.85rem", color: "var(--color-gray-600)", marginBottom: "var(--space-xs)" }}>Administrator Contacts</h3>
                    {adminContacts.map(e => (
                      <div key={e.id} style={{ fontSize: "0.82rem", padding: "var(--space-xs) 0", borderBottom: "1px solid var(--color-gray-100)" }}>
                        <strong>{e.date}</strong> — {e.admin_contact_status.replace(/_/g, " ")}
                        {studentName ? "" : <> — {e.student_name}</>}
                      </div>
                    ))}
                  </div>
                )}
                {counselorContacts.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: "0.85rem", color: "var(--color-gray-600)", marginBottom: "var(--space-xs)" }}>Counselor Contacts</h3>
                    {counselorContacts.map(e => (
                      <div key={e.id} style={{ fontSize: "0.82rem", padding: "var(--space-xs) 0", borderBottom: "1px solid var(--color-gray-100)" }}>
                        <strong>{e.date}</strong> — {e.counselor_contact_status.replace(/_/g, " ")}
                        {studentName ? "" : <> — {e.student_name}</>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Outcomes */}
      {include("outcomes") && (
        <div className="card">
          <h2 style={{ marginBottom: "var(--space-sm)" }}>Outcomes Summary</h2>
          {(() => {
            const outcomeMap = new Map<string, number>();
            for (const e of entries) {
              const outcomes = parseArray(e.outcome);
              for (const o of outcomes) if (o) outcomeMap.set(o, (outcomeMap.get(o) || 0) + 1);
            }
            if (!outcomeMap.size) return <p className="text-sm text-muted">No outcome data recorded.</p>;
            return (
              <HBarChart
                data={[...outcomeMap.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))}
                colorClass="var(--color-info)"
              />
            );
          })()}
        </div>
      )}

      {/* Follow-ups */}
      {include("follow_ups") && (
        <div className="card">
          <h2 style={{ marginBottom: "var(--space-sm)" }}>Follow-ups</h2>
          {(() => {
            const withFU = entries.filter(e => e.follow_up_date);
            if (!withFU.length) return <p className="text-sm text-muted">No follow-ups recorded.</p>;
            const pending = withFU.filter(e => {
              const fuDate = new Date(e.follow_up_date + "T00:00:00");
              return fuDate >= new Date() || e.doc_status !== "completed";
            });
            const completed = withFU.filter(e => {
              const fuDate = new Date(e.follow_up_date + "T00:00:00");
              return fuDate < new Date() && e.doc_status === "completed";
            });
            return (
              <>
                {pending.length > 0 && (
                  <div style={{ marginBottom: "var(--space-md)" }}>
                    <h3 style={{ fontSize: "0.85rem", color: "var(--color-warning)", marginBottom: "var(--space-xs)" }}>Pending ({pending.length})</h3>
                    {pending.map(e => (
                      <div key={e.id} style={{ fontSize: "0.82rem", padding: "var(--space-xs) 0", borderBottom: "1px solid var(--color-gray-100)" }}>
                        <strong>{e.date}</strong> — Follow-up: {e.follow_up_date}
                        {studentName ? "" : <> — {e.student_name}</>}
                        <p style={{ marginTop: 2, marginBottom: 0, color: "var(--color-gray-500)" }}>{e.objective_observation.slice(0, 120)}</p>
                      </div>
                    ))}
                  </div>
                )}
                {completed.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: "0.85rem", color: "var(--color-success)", marginBottom: "var(--space-xs)" }}>Completed ({completed.length})</h3>
                    {completed.map(e => (
                      <div key={e.id} style={{ fontSize: "0.82rem", padding: "var(--space-xs) 0", borderBottom: "1px solid var(--color-gray-100)" }}>
                        <strong>{e.date}</strong> — Follow-up: {e.follow_up_date}
                        {studentName ? "" : <> — {e.student_name}</>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Documentation Status */}
      {include("doc_status") && (
        <div className="card">
          <h2 style={{ marginBottom: "var(--space-sm)" }}>Documentation Status</h2>
          {(() => {
            const pending = entries.filter(e => e.doc_status === "required_pending");
            const completed = entries.filter(e => e.doc_status === "completed");
            const needsClarification = entries.filter(e => e.doc_status === "needs_clarification");
            const notRequired = entries.filter(e => e.doc_status === "not_required");

            return (
              <div>
                <div style={{ display: "flex", gap: "var(--space-md)", marginBottom: "var(--space-md)", flexWrap: "wrap" }}>
                  <div className="stat-card" style={{ minWidth: 80, padding: "var(--space-sm) var(--space-md)", minHeight: 60 }}>
                    <div className="stat-card__value" style={{ color: "var(--color-warning)" }}>{pending.length}</div>
                    <div className="stat-card__label">Required — Pending</div>
                  </div>
                  <div className="stat-card" style={{ minWidth: 80, padding: "var(--space-sm) var(--space-md)", minHeight: 60 }}>
                    <div className="stat-card__value" style={{ color: "var(--color-success)" }}>{completed.length}</div>
                    <div className="stat-card__label">Completed</div>
                  </div>
                  {needsClarification.length > 0 && (
                    <div className="stat-card" style={{ minWidth: 80, padding: "var(--space-sm) var(--space-md)", minHeight: 60 }}>
                      <div className="stat-card__value" style={{ color: "var(--color-primary)" }}>{needsClarification.length}</div>
                      <div className="stat-card__label">Needs Clarification</div>
                    </div>
                  )}
                </div>

                {pending.length > 0 && (
                  <div style={{ marginBottom: "var(--space-sm)" }}>
                    <h3 style={{ fontSize: "0.85rem", color: "var(--color-warning)", marginBottom: "var(--space-xs)" }}>Entries requiring documentation</h3>
                    {pending.map(e => (
                      <div key={e.id} style={{ fontSize: "0.82rem", padding: "var(--space-xs) 0", borderBottom: "1px solid var(--color-gray-100)" }}>
                        <span style={{ fontWeight: 600 }}>{e.date}</span>
                        {studentName ? "" : <> — {e.student_name}</>}
                        <span className="badge badge--pending" style={{ marginLeft: "var(--space-sm)" }}>Pending</span>
                        {e.doc_system_name && <span style={{ marginLeft: "var(--space-sm)", color: "var(--color-gray-500)" }}>System: {e.doc_system_name}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {completed.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: "0.85rem", color: "var(--color-success)", marginBottom: "var(--space-xs)" }}>Completed documentation</h3>
                    {completed.slice(0, 10).map(e => (
                      <div key={e.id} style={{ fontSize: "0.82rem", padding: "var(--space-xs) 0", borderBottom: "1px solid var(--color-gray-100)" }}>
                        <span style={{ fontWeight: 600 }}>{e.date}</span>
                        {studentName ? "" : <> — {e.student_name}</>}
                        <span className="badge badge--completed" style={{ marginLeft: "var(--space-sm)" }}>Completed</span>
                        {e.doc_completion_date && <span style={{ marginLeft: "var(--space-sm)", color: "var(--color-gray-500)" }}>on {e.doc_completion_date}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Patterns */}
      {include("patterns") && (
        <div className="card">
          <h2 style={{ marginBottom: "var(--space-sm)" }}>Patterns Observed</h2>
          {stats ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
              {stats.byDayOfWeek.some(d => d.count > 0) && (
                <div>
                  <h3 style={{ fontSize: "0.85rem", color: "var(--color-gray-600)", marginBottom: "var(--space-xs)" }}>By Day of Week</h3>
                  <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 80 }}>
                    {stats.byDayOfWeek.map(d => {
                      const maxDay = Math.max(...stats.byDayOfWeek.map(x => x.count), 1);
                      const h = (d.count / maxDay) * 70;
                      return (
                        <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                          <span style={{ fontSize: "0.65rem", fontWeight: 600 }}>{d.count || ""}</span>
                          <div style={{ width: "100%", maxWidth: 30, height: h, background: d.count > 0 ? "var(--color-primary-light)" : "var(--color-gray-100)", borderRadius: "var(--radius-sm) 0 0 0", minHeight: d.count > 0 ? 4 : 1, transition: "height 0.3s" }} />
                          <span style={{ fontSize: "0.65rem", color: "var(--color-gray-500)" }}>{d.day}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {stats.bySubject.length > 0 && (
                <div>
                  <h3 style={{ fontSize: "0.85rem", color: "var(--color-gray-600)", marginBottom: "var(--space-xs)" }}>By Subject / Activity</h3>
                  <HBarChart data={stats.bySubject} colorClass="var(--color-primary)" />
                </div>
              )}
              {stats.byLocation.length > 0 && (
                <div>
                  <h3 style={{ fontSize: "0.85rem", color: "var(--color-gray-600)", marginBottom: "var(--space-xs)" }}>By Location</h3>
                  <HBarChart data={stats.byLocation} colorClass="#5b6e8a" />
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">Pattern data not available for this report.</p>
          )}
        </div>
      )}

      {/* Questions for the Team */}
      <div className="card" style={{ borderLeft: "4px solid var(--color-primary-light)" }}>
        <h2 style={{ marginBottom: "var(--space-sm)", fontSize: "1rem" }}>Questions for the Team to Consider</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          {questions.map((q, i) => (
            <div key={i} style={{ display: "flex", gap: "var(--space-sm)", alignItems: "flex-start", fontSize: "0.85rem" }}>
              <span style={{ color: "var(--color-primary)", fontWeight: 700, flexShrink: 0 }}>•</span>
              <span style={{ color: "var(--color-gray-700)" }}>{q}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="card" style={{ background: "var(--color-gray-50)", border: "1px dashed var(--color-gray-300)", textAlign: "center", fontSize: "0.78rem", color: "var(--color-gray-500)" }}>
        <p style={{ marginBottom: 0 }}>
          <strong>BehaviorTrack</strong> is a supplemental tracking tool and does not replace documentation required by the school district or other official educational records.
        </p>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────
   Print styles
   ─────────────────────────────────────────── */

const printStyles = `
@media print {
  body * { visibility: hidden; }
  .report-output, .report-output * { visibility: visible; }
  .report-output { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
  .no-print { display: none !important; }
  .card { box-shadow: none !important; border: 1px solid #ddd !important; break-inside: avoid; }
  .app-header, .bottom-nav, .side-nav, .fab-add, .alert--demo { display: none !important; }
}
`;

/* ───────────────────────────────────────────
   Main Reports Component
   ─────────────────────────────────────────── */

export default function Reports() {
  const { legacyToken: token, user } = useLegacyToken();

  /* Builder state */
  const [reportType, setReportType] = useState("");
  const [studentId, setStudentId] = useState<number | null>(null);
  const [datePreset, setDatePreset] = useState("last_30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedSections, setSelectedSections] = useState<string[]>(
    SECTION_OPTIONS.filter(s => s.default).map(s => s.id)
  );

  /* Data state */
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [error, setError] = useState("");

  const needsStudent = reportType !== "weekly_review";

  /* Fetch students on mount */
  useEffect(() => {
    if (!token) return;
    fetch("/api/students", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setStudents(data.students || []))
      .catch(() => {});
  }, [token]);

  const dateRange = useMemo(() => {
    if (datePreset === "custom") return { from: customFrom, to: customTo };
    return getDateRange(datePreset);
  }, [datePreset, customFrom, customTo]);

  function toggleSection(id: string) {
    setSelectedSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  }

  async function generateReport() {
    if (!token) return;
    setError("");
    setLoading(true);
    setReportData(null);

    try {
      const { from, to } = dateRange;
      if (!from || !to) { setError("Please select a valid date range."); setLoading(false); return; }

      // Fetch entries
      const entryParams = new URLSearchParams({ date_from: from, date_to: to, limit: "200" });
      if (needsStudent && studentId) entryParams.set("student_id", String(studentId));

      const entriesRes = await fetch(`/api/entries?${entryParams}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const entriesData = await entriesRes.json();
      const entries: Entry[] = entriesData.entries || [];

      // Fetch stats (per-student)
      let stats: StatData | null = null;
      if (needsStudent && studentId) {
        const statsRes = await fetch(`/api/entries/stats?student_id=${studentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        stats = await statsRes.json();
      }

      // Fetch goals (per-student only, for goals section)
      let goals: Goal[] = [];
      if (selectedSections.includes("goal_progress") && needsStudent && studentId) {
        const goalsRes = await fetch(`/api/goals?student_id=${studentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const goalsData = await goalsRes.json();
        goals = goalsData.goals || [];
      }

      const selectedStudent = studentId ? students.find(s => s.id === studentId) : null;

      setReportData({
        reportType,
        studentName: selectedStudent ? selectedStudent.display_name : (needsStudent ? "" : "All Students"),
        studentGrade: selectedStudent ? selectedStudent.grade : "",
        dateFrom: from,
        dateTo: to,
        generatedDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        teacherName: user?.name || "Teacher",
        entries,
        stats,
        goals,
        selectedSections,
      });
    } catch (err: any) {
      setError(err.message || "Failed to generate report.");
    } finally {
      setLoading(false);
    }
  }

  const canGenerate = reportType && dateRange.from && dateRange.to && (!needsStudent || studentId) && selectedSections.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-md">
        <h1>Reports</h1>
        {reportData && (
          <button className="btn btn--ghost btn--sm" onClick={() => setReportData(null)}>
            ← New Report
          </button>
        )}
      </div>

      {reportData ? (
        <ReportOutput data={reportData} onClose={() => setReportData(null)} />
      ) : (
        <>
          {/* Step 1: Report Type */}
          <div className="card">
            <h2 style={{ marginBottom: "var(--space-sm)", fontSize: "1rem" }}>Step 1: Select Report Type</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "var(--space-sm)" }}>
              {REPORT_TYPES.map(rt => (
                <button
                  key={rt.id}
                  className={`type-chip${reportType === rt.id ? " type-chip--selected" : ""}`}
                  style={reportType === rt.id ? { borderColor: "var(--color-primary)", background: "var(--color-primary-bg)" } : {}}
                  onClick={() => {
                    setReportType(rt.id);
                    if (rt.id === "weekly_review") setStudentId(null);
                  }}
                >
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span style={{ display: "flex", color: reportType === rt.id ? "var(--color-primary)" : "var(--color-gray-400)" }}>
                      {reportIconMap[rt.id]}
                    </span>
                    <span style={{ fontSize: "0.78rem", lineHeight: 1.3 }}>{rt.label}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Student */}
          {needsStudent && (
            <div className="card">
              <h2 style={{ marginBottom: "var(--space-sm)", fontSize: "1rem" }}>
                Step 2: Select Student
                {!needsStudent && <span className="text-sm text-muted"> (not required for classroom-wide reports)</span>}
              </h2>
              <select
                className="form-select"
                value={studentId || ""}
                onChange={e => setStudentId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">— Select a student —</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.display_name} ({s.initials}) — Grade {s.grade}, {s.classroom}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Step 3: Date Range */}
          <div className="card">
            <h2 style={{ marginBottom: "var(--space-sm)", fontSize: "1rem" }}>Step {needsStudent ? 3 : 2}: Date Range</h2>
            <div className="chip-group" style={{ marginBottom: "var(--space-sm)" }}>
              {DATE_PRESETS.map(p => (
                <button
                  key={p.id}
                  className={`chip${datePreset === p.id ? " chip--selected" : ""}`}
                  onClick={() => setDatePreset(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {datePreset === "custom" && (
              <div style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap" }}>
                <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
                  <label className="form-label">From</label>
                  <input type="date" className="form-input" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
                  <label className="form-label">To</label>
                  <input type="date" className="form-input" value={customTo} onChange={e => setCustomTo(e.target.value)} />
                </div>
              </div>
            )}
            {datePreset !== "custom" && (
              <p className="text-sm text-muted">
                {dateRange.from ? `${fmtDate(dateRange.from)} – ${fmtDate(dateRange.to)}` : "Select a preset"}
              </p>
            )}
          </div>

          {/* Step 4: Content */}
          <div className="card">
            <h2 style={{ marginBottom: "var(--space-sm)", fontSize: "1rem" }}>Step {needsStudent ? 4 : 3}: Content to Include</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              {SECTION_OPTIONS.map(opt => (
                <label key={opt.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", cursor: "pointer", minHeight: "var(--touch-min)", fontSize: "0.9rem" }}>
                  <input
                    type="checkbox"
                    checked={selectedSections.includes(opt.id)}
                    onChange={() => toggleSection(opt.id)}
                    style={{ width: 18, height: 18, cursor: "pointer", accentColor: "var(--color-primary)" }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Step 5: Generate */}
          <div className="card">
            {error && <div className="alert alert--error" style={{ marginBottom: "var(--space-md)" }}>{error}</div>}
            <button
              className="btn btn--primary btn--lg btn--full"
              onClick={generateReport}
              disabled={!canGenerate || loading}
            >
              {loading ? "Generating Report..." : "Generate Report"}
            </button>
            {loading && <div className="loading" style={{ padding: "var(--space-md)" }}>Loading data...</div>}
            {!canGenerate && !loading && (
              <p className="text-sm text-muted" style={{ marginTop: "var(--space-sm)", textAlign: "center" }}>
                {!reportType ? "Select a report type to continue." :
                 !dateRange.from ? "Select a date range to continue." :
                 needsStudent && !studentId ? "Select a student to continue." :
                 selectedSections.length === 0 ? "Select at least one content section." : ""}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

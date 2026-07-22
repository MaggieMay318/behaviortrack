import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLegacyToken } from "../lib/auth";
import { Target, X, Search } from "lucide-react";

/* ── Types ─────────────────────────────────────────── */
interface Goal {
  id: number; student_id: number; student_name: string; student_initials: string;
  student_grade: string; title: string; description: string; start_date: string;
  review_date: string; target_behavior: string; measurement_method: string;
  baseline: string; target: string; tracking_frequency: string; responsible_staff: string;
  supports: string; status: string; progressCount: number; avgRating: number | null;
  created_at: string; updated_at: string;
}
interface Student { id: number; display_name: string; initials: string; grade: string; }

const statuses = [
  { value: "", label: "All" }, { value: "in_progress", label: "In Progress" },
  { value: "improving", label: "Improving" }, { value: "goal_met", label: "Goal Met" },
  { value: "needs_revision", label: "Needs Revision" }, { value: "not_started", label: "Not Started" },
  { value: "discontinued", label: "Discontinued" },
];
const statusLabel = (s: string): string => {
  const m: Record<string, string> = { not_started: "Not Started", in_progress: "In Progress", improving: "Improving", goal_met: "Goal Met", needs_revision: "Needs Revision", discontinued: "Discontinued" };
  return m[s] || s;
};
const statusBadgeClass = (s: string): string => {
  const m: Record<string, string> = { not_started: "badge--neutral", in_progress: "badge--minor", improving: "badge--positive", goal_met: "badge--completed", needs_revision: "badge--moderate", discontinued: "badge--major" };
  return m[s] || "badge--neutral";
};
const statusProgressColor = (s: string): string => {
  const m: Record<string, string> = { goal_met: "var(--color-success)", improving: "var(--color-success)", in_progress: "var(--color-primary)", not_started: "var(--color-gray-300)", needs_revision: "var(--color-warning)", discontinued: "var(--color-gray-400)" };
  return m[s] || "var(--color-gray-300)";
};
function parseSupports(val: string): string[] { try { return JSON.parse(val); } catch { return []; } }

function AddGoalModal({ students, token, onClose, onCreated }: { students: Student[]; token: string | null; onClose: () => void; onCreated: () => void }) {
  const [studentId, setStudentId] = useState(""); const [title, setTitle] = useState("");
  const [description, setDescription] = useState(""); const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [reviewDate, setReviewDate] = useState(""); const [targetBehavior, setTargetBehavior] = useState("");
  const [measurementMethod, setMeasurementMethod] = useState(""); const [baseline, setBaseline] = useState("");
  const [target, setTarget] = useState(""); const [frequency, setFrequency] = useState("Daily");
  const [staff, setStaff] = useState(""); const [supports, setSupports] = useState("");
  const [status, setStatus] = useState("not_started"); const [saving, setSaving] = useState(false); const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (!studentId || !title || !startDate) { setError("Student, title, and start date are required."); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/goals", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ student_id: Number(studentId), title, description, start_date: startDate, review_date: reviewDate, target_behavior: targetBehavior, measurement_method: measurementMethod, baseline, target, tracking_frequency: frequency, responsible_staff: staff, supports: supports ? supports.split(",").map(s => s.trim()).filter(Boolean) : [], status }) });
      if (!r.ok) { const d = await r.json(); setError(d.error || "Failed to create goal"); setSaving(false); return; }
      onCreated(); onClose();
    } catch { setError("Network error"); setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal__header"><h2 className="modal__title">Add Behavior Goal</h2><button className="modal__close" onClick={onClose}><X size={18} /></button></div>
      <form onSubmit={handleSubmit}><div className="modal__body">
        {error && <div className="alert alert--error" style={{ marginBottom: "var(--space-md)" }}>{error}</div>}
        <div className="form-group"><label className="form-label" htmlFor="goal-student">Student</label><select id="goal-student" className="form-select" value={studentId} onChange={e => setStudentId(e.target.value)} required><option value="">Select student...</option>{students.map(s => <option key={s.id} value={s.id}>{s.display_name} (Grade {s.grade})</option>)}</select></div>
        <div className="form-group"><label className="form-label" htmlFor="goal-title">Goal Title</label><input id="goal-title" className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Stay on task during independent work" required /></div>
        <div className="form-group"><label className="form-label" htmlFor="goal-desc">Description</label><textarea id="goal-desc" className="form-textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe what the student will work toward..." rows={3} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}><div className="form-group"><label className="form-label" htmlFor="goal-start">Start Date</label><input id="goal-start" type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} required /></div><div className="form-group"><label className="form-label" htmlFor="goal-review">Review Date</label><input id="goal-review" type="date" className="form-input" value={reviewDate} onChange={e => setReviewDate(e.target.value)} /></div></div>
        <div className="form-group"><label className="form-label" htmlFor="goal-target-beh">Target Behavior</label><input id="goal-target-beh" className="form-input" value={targetBehavior} onChange={e => setTargetBehavior(e.target.value)} placeholder="e.g., Staying on task during independent work" /></div>
        <div className="form-group"><label className="form-label" htmlFor="goal-measure">Measurement Method</label><input id="goal-measure" className="form-input" value={measurementMethod} onChange={e => setMeasurementMethod(e.target.value)} placeholder="e.g., Duration observation, frequency count" /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}><div className="form-group"><label className="form-label" htmlFor="goal-baseline">Baseline</label><input id="goal-baseline" className="form-input" value={baseline} onChange={e => setBaseline(e.target.value)} placeholder="e.g., 5 minutes" /></div><div className="form-group"><label className="form-label" htmlFor="goal-target">Target</label><input id="goal-target" className="form-input" value={target} onChange={e => setTarget(e.target.value)} placeholder="e.g., 15 minutes" /></div></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}><div className="form-group"><label className="form-label" htmlFor="goal-freq">Tracking Frequency</label><select id="goal-freq" className="form-select" value={frequency} onChange={e => setFrequency(e.target.value)}><option value="Daily">Daily</option><option value="Weekly">Weekly</option><option value="Per class period">Per class period</option><option value="Per transition">Per transition</option></select></div><div className="form-group"><label className="form-label" htmlFor="goal-staff">Responsible Staff</label><input id="goal-staff" className="form-input" value={staff} onChange={e => setStaff(e.target.value)} placeholder="e.g., Ms. Rodriguez" /></div></div>
        <div className="form-group"><label className="form-label" htmlFor="goal-status">Status</label><select id="goal-status" className="form-select" value={status} onChange={e => setStatus(e.target.value)}>{statuses.filter(s => s.value).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
        <div className="form-group"><label className="form-label" htmlFor="goal-supports">Supports (comma-separated)</label><input id="goal-supports" className="form-input" value={supports} onChange={e => setSupports(e.target.value)} placeholder="e.g., Visual timer, Preferential seating" /></div>
      </div><div className="modal__footer"><button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button><button type="submit" className="btn btn--primary" disabled={saving}>{saving ? "Creating..." : "Create Goal"}</button></div></form>
    </div></div>
  );
}

export default function Goals() {
  const { legacyToken: token } = useLegacyToken(); const navigate = useNavigate();
  const [goals, setGoals] = useState<Goal[]>([]); const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("created"); const [showAddModal, setShowAddModal] = useState(false);

  const fetchGoals = useCallback(() => {
    if (!token) return; setLoading(true); setError("");
    const params = new URLSearchParams(); if (statusFilter) params.set("status", statusFilter); if (search) params.set("search", search);
    fetch(`/api/goals?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(data => { setGoals(data.goals || []); setLoading(false); }).catch((err) => { setError(err.message); setLoading(false); });
  }, [statusFilter, search, token]);
  useEffect(() => { fetchGoals(); }, [fetchGoals]);
  useEffect(() => { fetch("/api/students?active=true", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(data => setStudents(data.students || [])).catch(() => {}); }, [token]);

  const sortedGoals = [...goals].sort((a, b) => {
    if (sortBy === "student") return a.student_name.localeCompare(b.student_name);
    if (sortBy === "review") { if (!a.review_date && !b.review_date) return 0; if (!a.review_date) return 1; if (!b.review_date) return -1; return a.review_date.localeCompare(b.review_date); }
    if (sortBy === "status") return a.status.localeCompare(b.status);
    return b.created_at.localeCompare(a.created_at);
  });
  const daysUntilReview = (reviewDate: string): { days: number; overdue: boolean } => {
    if (!reviewDate) return { days: 0, overdue: false };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const review = new Date(reviewDate + "T00:00:00");
    const diff = Math.ceil((review.getTime() - today.getTime()) / 86400000);
    return { days: Math.abs(diff), overdue: diff < 0 };
  };

  return (
    <div>
      <div className="section-header"><h1 style={{ marginBottom: 0 }}>Behavior Goals</h1><button className="btn btn--primary btn--sm" onClick={() => setShowAddModal(true)}>+ Add Goal</button></div>
      <div style={{ marginBottom: "var(--space-md)" }}>
        <div className="chip-group" style={{ marginBottom: "var(--space-sm)" }}>{statuses.map(s => <button key={s.value} className={`chip${statusFilter === s.value ? " chip--selected" : ""}`} onClick={() => setStatusFilter(s.value)}>{s.label}</button>)}</div>
        <div className="flex gap-sm" style={{ flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 180 }}><label htmlFor="goal-search" className="form-label" style={{ fontSize: "0.75rem" }}>Search Goals</label><div style={{ position: "relative" }}><Search size={16} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-gray-400)", pointerEvents: "none" }} /><input id="goal-search" className="form-input" type="search" placeholder="Search by student name or goal title..." value={search} onChange={e => setSearch(e.target.value)} style={{ minHeight: 40, fontSize: "0.875rem", paddingLeft: 34 }} /></div></div>
          <select className="form-select" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ minHeight: 40, width: "auto", maxWidth: 180, fontSize: "0.85rem" }}><option value="created">Sort: Newest First</option><option value="student">Sort: By Student</option><option value="review">Sort: By Review Date</option><option value="status">Sort: By Status</option></select>
        </div>
      </div>
      {loading ? <div className="loading" aria-busy="true"><span className="spinner spinner--lg" style={{ marginRight: "var(--space-sm)" }} />Loading goals...</div> : error ? <div className="alert alert--error"><p style={{ marginBottom: "var(--space-sm)" }}>Failed to load goals: {error}</p><button className="btn btn--primary btn--sm" onClick={fetchGoals}>Retry</button></div> : sortedGoals.length === 0 ? <div className="empty-state"><span className="empty-state__icon"><Target size={40} /></span><p>No goals yet. Create your first behavior goal to start tracking student progress.</p><button className="btn btn--primary btn--sm mt-md" onClick={() => setShowAddModal(true)}>+ Add First Goal</button></div> : (
        <div className="goal-card-grid">
          {sortedGoals.map(goal => {
            const review = daysUntilReview(goal.review_date);
            const progressPct = goal.avgRating ? Math.round((goal.avgRating / 5) * 100) : goal.progressCount > 0 ? 20 : 5;
            const supports = parseSupports(goal.supports);
            return (
              <div key={goal.id} className="goal-card" onClick={() => navigate(`/goals/${goal.id}`)}>
                <div className="goal-card__header"><div className="goal-card__avatar">{goal.student_initials}</div><div className="goal-card__student-info"><div className="goal-card__student-name">{goal.student_name}</div><div className="goal-card__student-meta">Grade {goal.student_grade}</div></div><span className={`badge ${statusBadgeClass(goal.status)}`}>{statusLabel(goal.status)}</span></div>
                <div className="goal-card__title">{goal.title}</div>
                {goal.target_behavior && <div className="goal-card__behavior"><Target size={13} style={{ display: "inline", marginRight: 4 }} />{goal.target_behavior}</div>}
                <div className="goal-card__progress"><div className="goal-card__progress-bar"><div className="goal-card__progress-fill" style={{ width: `${progressPct}%`, background: statusProgressColor(goal.status) }} /></div><span className="goal-card__progress-label">{goal.avgRating ? `${goal.avgRating}/5 avg` : `${goal.progressCount} update${goal.progressCount !== 1 ? "s" : ""}`}</span></div>
                <div className="goal-card__dates"><span>{goal.start_date} \u2192 {goal.review_date || "\u2014"}</span>{goal.review_date && <span className={`goal-card__review${review.overdue ? " goal-card__review--overdue" : ""}`}>{review.overdue ? "Overdue" : review.days === 0 ? "Today" : `${review.days} day${review.days !== 1 ? "s" : ""} left`}</span>}</div>
                {supports.length > 0 && <div className="flex gap-sm" style={{ flexWrap: "wrap", marginTop: "auto" }}>{supports.slice(0, 3).map((s, i) => <span key={i} className="badge badge--neutral" style={{ fontSize: "0.68rem" }}>{s}</span>)}{supports.length > 3 && <span className="text-sm text-muted">+{supports.length - 3}</span>}</div>}
              </div>
            );
          })}
        </div>
      )}
      {showAddModal && <AddGoalModal students={students} token={token} onClose={() => setShowAddModal(false)} onCreated={fetchGoals} />}
    </div>
  );
}

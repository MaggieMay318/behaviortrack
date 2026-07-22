import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useLegacyToken } from "../lib/auth";
import { Target, X, Edit3, Trash2, BarChart3, AlertTriangle } from "lucide-react";

/* ── Types ─────────────────────────────────────────── */
interface GoalData {
  id: number; student_id: number; student_name: string; student_initials: string;
  student_grade: string; title: string; description: string; start_date: string;
  review_date: string; target_behavior: string; measurement_method: string;
  baseline: string; target: string; tracking_frequency: string;
  responsible_staff: string; supports: string; status: string;
  created_at: string; updated_at: string;
}
interface ProgressEntry { id: number; goal_id: number; date: string; notes: string; rating: number; created_at: string; }

const statusOptions = [
  { value: "not_started", label: "Not Started" }, { value: "in_progress", label: "In Progress" },
  { value: "improving", label: "Improving" }, { value: "goal_met", label: "Goal Met" },
  { value: "needs_revision", label: "Needs Revision" }, { value: "discontinued", label: "Discontinued" },
];
const statusLabel = (s: string): string => {
  const m: Record<string, string> = { not_started: "Not Started", in_progress: "In Progress", improving: "Improving", goal_met: "Goal Met", needs_revision: "Needs Revision", discontinued: "Discontinued" };
  return m[s] || s;
};
const statusBadgeClass = (s: string): string => {
  const m: Record<string, string> = { not_started: "badge--neutral", in_progress: "badge--minor", improving: "badge--positive", goal_met: "badge--completed", needs_revision: "badge--moderate", discontinued: "badge--major" };
  return m[s] || "badge--neutral";
};
function parseSupports(val: string): string[] { try { return JSON.parse(val); } catch { return []; } }

function ProgressChart({ progress, goal }: { progress: ProgressEntry[]; goal: GoalData }) {
  const data = [...progress].reverse();
  if (data.length === 0) return <div className="text-sm text-muted text-center" style={{ padding: "var(--space-xl)" }}>No progress data yet. Add the first progress update below.</div>;
  const w = 340; const h = 200; const pad = { top: 20, right: 20, bottom: 35, left: 30 };
  const chartW = w - pad.left - pad.right; const chartH = h - pad.top - pad.bottom;
  const yMin = 1; const yMax = 5;
  const yScale = (r: number) => pad.top + chartH - ((r - yMin) / (yMax - yMin)) * chartH;
  let targetVal: number | null = null;
  const targetMatch = goal.target.match(/(\d+)/);
  if (targetMatch) targetVal = Math.min(5, Math.max(1, parseInt(targetMatch[1])));
  const points = data.map((d, i) => {
    const x = pad.left + (i / Math.max(data.length - 1, 1)) * chartW;
    return { x, y: yScale(d.rating), rating: d.rating, date: d.date };
  });
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const yTicks = [1, 2, 3, 4, 5];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Progress chart">
      {yTicks.map(t => <g key={`y-${t}`}><line x1={pad.left} y1={yScale(t)} x2={w - pad.right} y2={yScale(t)} stroke="var(--color-gray-200)" strokeWidth="1" strokeDasharray="4 4" /><text x={pad.left - 6} y={yScale(t) + 4} textAnchor="end" fontSize="10" fill="var(--color-gray-400)">{t}</text></g>)}
      {targetVal !== null && <g><line x1={pad.left} y1={yScale(targetVal)} x2={w - pad.right} y2={yScale(targetVal)} stroke="var(--color-success)" strokeWidth="2.5" strokeDasharray="6 3" /><text x={w - pad.right} y={yScale(targetVal) - 5} textAnchor="end" fontSize="9" fill="var(--color-success)" fontWeight="600">Target</text></g>}
      <path d={linePath} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => <g key={`pt-${i}`}><circle cx={p.x} cy={p.y} r="5" fill="var(--color-white)" stroke="var(--color-primary)" strokeWidth="2" /><text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="9" fill="var(--color-gray-600)" fontWeight="600">{p.rating}</text>{(i === 0 || i === points.length - 1) && <text x={p.x} y={h - 5} textAnchor="middle" fontSize="9" fill="var(--color-gray-500)">{p.date.slice(5)}</text>}</g>)}
      {goal.baseline && <text x={pad.left} y={pad.top - 6} fontSize="9" fill="var(--color-gray-500)">Baseline: {goal.baseline}</text>}
    </svg>
  );
}

function EditGoalModal({ goal, token, onClose, onUpdated }: { goal: GoalData; token: string | null; onClose: () => void; onUpdated: (g: GoalData) => void }) {
  const [title, setTitle] = useState(goal.title); const [description, setDescription] = useState(goal.description || "");
  const [startDate, setStartDate] = useState(goal.start_date); const [reviewDate, setReviewDate] = useState(goal.review_date || "");
  const [targetBehavior, setTargetBehavior] = useState(goal.target_behavior || ""); const [measurementMethod, setMeasurementMethod] = useState(goal.measurement_method || "");
  const [baseline, setBaseline] = useState(goal.baseline || ""); const [target, setTarget] = useState(goal.target || "");
  const [frequency, setFrequency] = useState(goal.tracking_frequency || "Daily"); const [staff, setStaff] = useState(goal.responsible_staff || "");
  const [supports, setSupports] = useState(parseSupports(goal.supports).join(", ")); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); setError(""); setSaving(true);
    try { const r = await fetch(`/api/goals/${goal.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ title, description, start_date: startDate, review_date: reviewDate, target_behavior: targetBehavior, measurement_method: measurementMethod, baseline, target, tracking_frequency: frequency, responsible_staff: staff, supports: supports ? supports.split(",").map(s => s.trim()).filter(Boolean) : [] }) });
      if (!r.ok) { const d = await r.json(); setError(d.error || "Failed to update"); setSaving(false); return; }
      const data = await r.json(); onUpdated(data.goal); onClose();
    } catch { setError("Network error"); setSaving(false); } };
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
      <div className="modal__header"><h2 className="modal__title">Edit Goal</h2><button className="modal__close" onClick={onClose}><X size={18} /></button></div>
      <form onSubmit={handleSubmit}><div className="modal__body" style={{ maxHeight: "60vh", overflowY: "auto" }}>
        {error && <div className="alert alert--error" style={{ marginBottom: "var(--space-md)" }}>{error}</div>}
        <div className="form-group"><label className="form-label">Goal Title</label><input className="form-input" value={title} onChange={e => setTitle(e.target.value)} required /></div>
        <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={description} onChange={e => setDescription(e.target.value)} rows={3} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}><div className="form-group"><label className="form-label">Start Date</label><input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} /></div><div className="form-group"><label className="form-label">Review Date</label><input type="date" className="form-input" value={reviewDate} onChange={e => setReviewDate(e.target.value)} /></div></div>
        <div className="form-group"><label className="form-label">Target Behavior</label><input className="form-input" value={targetBehavior} onChange={e => setTargetBehavior(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Measurement Method</label><input className="form-input" value={measurementMethod} onChange={e => setMeasurementMethod(e.target.value)} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}><div className="form-group"><label className="form-label">Baseline</label><input className="form-input" value={baseline} onChange={e => setBaseline(e.target.value)} /></div><div className="form-group"><label className="form-label">Target</label><input className="form-input" value={target} onChange={e => setTarget(e.target.value)} /></div></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}><div className="form-group"><label className="form-label">Tracking Frequency</label><select className="form-select" value={frequency} onChange={e => setFrequency(e.target.value)}><option value="Daily">Daily</option><option value="Weekly">Weekly</option><option value="Per class period">Per class period</option><option value="Per transition">Per transition</option></select></div><div className="form-group"><label className="form-label">Responsible Staff</label><input className="form-input" value={staff} onChange={e => setStaff(e.target.value)} /></div></div>
        <div className="form-group"><label className="form-label">Supports (comma-separated)</label><input className="form-input" value={supports} onChange={e => setSupports(e.target.value)} /></div>
      </div><div className="modal__footer"><button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button><button type="submit" className="btn btn--primary" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button></div></form>
    </div></div>
  );
}

function DeleteConfirmModal({ goalTitle, onConfirm, onClose }: { goalTitle: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal__header"><h2 className="modal__title">Delete Goal</h2><button className="modal__close" onClick={onClose}><X size={18} /></button></div>
      <div className="modal__body"><p>Are you sure you want to delete <strong>"{goalTitle}"</strong>?</p><p className="text-sm text-muted">This will also delete all progress entries for this goal. This action cannot be undone.</p></div>
      <div className="modal__footer"><button className="btn btn--ghost" onClick={onClose}>Cancel</button><button className="btn btn--danger" onClick={onConfirm}>Delete Goal</button></div>
    </div></div>
  );
}

export default function GoalDetail() {
  const { id } = useParams(); const navigate = useNavigate(); const { legacyToken: token } = useLegacyToken();
  const [goal, setGoal] = useState<GoalData | null>(null); const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [showEditModal, setShowEditModal] = useState(false); const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showAddProgress, setShowAddProgress] = useState(false);
  const [progressDate, setProgressDate] = useState(new Date().toISOString().slice(0, 10));
  const [progressRating, setProgressRating] = useState(3); const [progressNotes, setProgressNotes] = useState("");
  const [savingProgress, setSavingProgress] = useState(false);

  const fetchGoal = () => { if (!id) return; fetch(`/api/goals/${id}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(data => { if (data.error) { setError(data.error); setLoading(false); return; } setGoal(data.goal); setProgress(data.progress || []); setLoading(false); }).catch(() => { setError("Failed to load goal"); setLoading(false); }); };
  useEffect(() => { fetchGoal(); }, [id, token]);

  const handleStatusChange = async (newStatus: string) => { if (!goal || !token) return; setUpdatingStatus(true); try { const r = await fetch(`/api/goals/${goal.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: newStatus }) }); if (r.ok) { const data = await r.json(); setGoal(data.goal); } } catch {} setUpdatingStatus(false); };
  const handleAddProgress = async (e: React.FormEvent) => { e.preventDefault(); if (!goal || !token) return; setSavingProgress(true); try { const r = await fetch(`/api/goals/${goal.id}/progress`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ date: progressDate, rating: progressRating, notes: progressNotes }) }); if (r.ok) { const data = await r.json(); setProgress(data.progress); setShowAddProgress(false); setProgressNotes(""); setProgressRating(3); setProgressDate(new Date().toISOString().slice(0, 10)); } } catch {} setSavingProgress(false); };
  const handleDelete = async () => { if (!goal || !token) return; try { const r = await fetch(`/api/goals/${goal.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); if (r.ok) navigate("/goals"); } catch {} };

  if (loading) return <div className="loading" aria-busy="true"><span className="spinner spinner--lg" style={{ marginRight: "var(--space-sm)" }} />Loading goal details...</div>;
  if (error || !goal) return <div className="empty-state"><span className="empty-state__icon"><AlertTriangle size={40} /></span><p>{error || "Goal not found"}</p><Link to="/goals" className="btn btn--primary btn--sm mt-md">Back to Goals</Link></div>;

  const supports = parseSupports(goal.supports);
  const avgRating = progress.length > 0 ? Math.round((progress.reduce((s, p) => s + p.rating, 0) / progress.length) * 10) / 10 : null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const reviewDate = goal.review_date ? new Date(goal.review_date + "T00:00:00") : null;
  const reviewDays = reviewDate ? Math.ceil((reviewDate.getTime() - today.getTime()) / 86400000) : null;

  return (
    <div className="goal-detail">
      <Link to="/goals" className="text-sm" style={{ color: "var(--color-gray-500)" }}>\u2190 Back to Goals</Link>
      <div className="card">
        <div className="goal-overview__header">
          <div className="flex items-center gap-md"><div className="goal-card__avatar" style={{ width: 48, height: 48, fontSize: "1rem" }}>{goal.student_initials}</div><div><Link to={`/students/${goal.student_id}`} className="card__title" style={{ fontSize: "1.1rem" }}>{goal.student_name}</Link><div className="text-sm text-muted">Grade {goal.student_grade}</div></div></div>
          <div className="flex items-center gap-sm"><select className="status-select-inline" value={goal.status} onChange={e => handleStatusChange(e.target.value)} disabled={updatingStatus}>{statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select>{updatingStatus && <span className="text-sm text-muted">Updating...</span>}</div>
        </div>
        <h2 style={{ marginTop: "var(--space-sm)", marginBottom: "var(--space-xs)" }}>{goal.title}</h2>
        {goal.description && <p className="text-sm" style={{ color: "var(--color-gray-600)", marginBottom: "var(--space-md)" }}>{goal.description}</p>}
        <div className="goal-overview__fields">
          <div className="goal-field"><span className="goal-field__label">Start Date</span><span className="goal-field__value">{goal.start_date}</span></div>
          <div className="goal-field"><span className="goal-field__label">Review Date</span><span className="goal-field__value" style={reviewDays !== null && reviewDays < 0 ? { color: "var(--color-danger)" } : {}}>{goal.review_date || "Not set"}{reviewDays !== null && <span style={{ marginLeft: 4, fontWeight: 600 }}>{reviewDays < 0 ? "(Overdue)" : reviewDays === 0 ? "(Today)" : `(${reviewDays} days)`}</span>}</span></div>
          {goal.target_behavior && <div className="goal-field"><span className="goal-field__label">Target Behavior</span><span className="goal-field__value">{goal.target_behavior}</span></div>}
          {goal.measurement_method && <div className="goal-field"><span className="goal-field__label">Measurement Method</span><span className="goal-field__value">{goal.measurement_method}</span></div>}
          {(goal.baseline || goal.target) && <div className="goal-field"><span className="goal-field__label">Baseline \u2192 Target</span><span className="goal-field__value">{goal.baseline || "\u2014"} \u2192 {goal.target || "\u2014"}</span></div>}
          {goal.tracking_frequency && <div className="goal-field"><span className="goal-field__label">Tracking Frequency</span><span className="goal-field__value">{goal.tracking_frequency}</span></div>}
          {goal.responsible_staff && <div className="goal-field"><span className="goal-field__label">Responsible Staff</span><span className="goal-field__value">{goal.responsible_staff}</span></div>}
          {supports.length > 0 && <div className="goal-field" style={{ gridColumn: "1 / -1" }}><span className="goal-field__label">Supports</span><div className="flex gap-sm" style={{ flexWrap: "wrap", marginTop: 2 }}>{supports.map((s, i) => <span key={i} className="badge badge--minor">{s}</span>)}</div></div>}
        </div>
        <div className="flex gap-sm mt-md" style={{ flexWrap: "wrap" }}>
          <button className="btn btn--secondary btn--sm" onClick={() => setShowEditModal(true)}><Edit3 size={14} /> Edit Goal</button>
          <button className="btn btn--danger btn--sm" onClick={() => setShowDeleteConfirm(true)}><Trash2 size={14} /> Delete</button>
        </div>
      </div>
      <div className="card"><div className="section-header"><h2 style={{ marginBottom: 0 }}>Progress Chart</h2>{avgRating !== null && <span className="badge badge--minor">Avg: {avgRating}/5</span>}</div><div style={{ overflowX: "auto" }}><ProgressChart progress={progress} goal={goal} /></div></div>
      <div className="card"><div className="section-header"><h2 style={{ marginBottom: 0 }}>Progress Updates <span className="text-sm text-muted" style={{ marginLeft: "var(--space-sm)", fontWeight: 400 }}>({progress.length} total)</span></h2><button className="btn btn--primary btn--sm" onClick={() => setShowAddProgress(!showAddProgress)}>{showAddProgress ? "Cancel" : "+ Add Update"}</button></div>
        {showAddProgress && (
          <form onSubmit={handleAddProgress} style={{ background: "var(--color-gray-50)", border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-md)", padding: "var(--space-md)", marginBottom: "var(--space-md)" }}>
            <div className="form-group"><label className="form-label" htmlFor="progress-date">Date</label><input id="progress-date" type="date" className="form-input" value={progressDate} onChange={e => setProgressDate(e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">Rating (1\u20135)</label><div className="rating-dots">{[1, 2, 3, 4, 5].map(r => <button key={r} type="button" className={`rating-dot rating-dot--${r}${progressRating === r ? " rating-dot--selected" : ""}`} onClick={() => setProgressRating(r)} aria-label={`Rating ${r}`} />)}<span className="text-sm text-muted" style={{ marginLeft: "var(--space-sm)" }}>{progressRating === 1 ? "Significant concern" : progressRating === 2 ? "Below target" : progressRating === 3 ? "Making progress" : progressRating === 4 ? "Near target" : "At or above target"}</span></div></div>
            <div className="form-group"><label className="form-label" htmlFor="progress-notes">Notes</label><textarea id="progress-notes" className="form-textarea" value={progressNotes} onChange={e => setProgressNotes(e.target.value)} placeholder="Describe today's progress observation..." rows={3} /></div>
            <button type="submit" className="btn btn--primary btn--sm" disabled={savingProgress}>{savingProgress ? "Saving..." : "Save Progress Update"}</button>
          </form>
        )}
        {progress.length === 0 ? <div className="empty-state" style={{ padding: "var(--space-lg)" }}><span className="empty-state__icon"><BarChart3 size={40} /></span><p>No progress updates recorded yet.</p><p className="text-sm text-muted">Add regular progress updates to track how the student is doing toward this goal.</p></div> : (
          <div className="progress-timeline">
            {progress.map((entry) => (
              <div key={entry.id} className="progress-entry">
                <div className="progress-entry__date">{entry.date}</div>
                <div className="progress-entry__content">
                  <div className="progress-entry__rating">{[1, 2, 3, 4, 5].map(r => <div key={r} className={`progress-entry__dot${r <= entry.rating ? " progress-entry__dot--filled" : ""}`} />)}<span className="text-sm text-muted" style={{ marginLeft: "var(--space-sm)", fontWeight: 600 }}>{entry.rating}/5</span></div>
                  {entry.notes && <div className="progress-entry__notes">{entry.notes}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showEditModal && <EditGoalModal goal={goal} token={token} onClose={() => setShowEditModal(false)} onUpdated={(updated) => setGoal(updated)} />}
      {showDeleteConfirm && <DeleteConfirmModal goalTitle={goal.title} onClose={() => setShowDeleteConfirm(false)} onConfirm={handleDelete} />}
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useLegacyToken } from "../lib/auth";
import { Users, Search, Target, FileText, ClipboardList, ChevronRight, X, Plus, Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { getAvatarUrl } from "../lib/avatars";

/* ── Types ─────────────────────────────────────────── */
interface Student {
  id: number;
  display_name: string;
  initials: string;
  local_id: string;
  grade: string;
  classroom: string;
  active: number;
  activeGoals: number;
  entriesThisWeek: number;
  positiveThisWeek: number;
  pendingDocs: number;
}

/* ── Color helpers ─────────────────────────────────── */
const AVATAR_COLORS = [
  "#3B6FB6", "#4CAF82", "#D4893A", "#7B5BA8", "#E0705E",
  "#5A8ECF", "#5A8A3C", "#C48A30", "#6B3A6B", "#8A3A3A",
];

function avatarColor(initials: string): string {
  let hash = 0;
  for (let i = 0; i < initials.length; i++) hash = initials.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function entryColor(positive: number, total: number): string {
  if (total === 0) return "var(--color-gray-400)";
  const ratio = positive / total;
  if (ratio >= 0.6) return "var(--color-success)";
  if (ratio >= 0.35) return "var(--color-warning)";
  return "var(--color-danger)";
}

/* ── Add Student Modal ─────────────────────────────── */
function AddStudentModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [initials, setInitials] = useState("");
  const [localId, setLocalId] = useState("");
  const [grade, setGrade] = useState("");
  const [classroom, setClassroom] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { legacyToken: token } = useLegacyToken();

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !initials.trim()) {
      setError("Name and initials are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          display_name: displayName.trim(),
          initials: initials.trim().toUpperCase(),
          local_id: localId.trim(),
          grade: grade.trim(),
          classroom: classroom.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add student");
      }
      setDisplayName("");
      setInitials("");
      setLocalId("");
      setGrade("");
      setClassroom("");
      onAdded();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Add Student</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal__body">
            {error && <div className="alert alert--error">{error}</div>}
            <div className="form-group">
              <label className="form-label" htmlFor="add-name">Display Name *</label>
              <input id="add-name" className="form-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Alex Johnson" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="add-initials">Initials *</label>
              <input id="add-initials" className="form-input" value={initials} onChange={(e) => setInitials(e.target.value.toUpperCase())} placeholder="e.g. AJ" maxLength={4} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="add-localid">Local ID</label>
              <input id="add-localid" className="form-input" value={localId} onChange={(e) => setLocalId(e.target.value)} placeholder="e.g. S1009" />
            </div>
            <div className="flex gap-sm">
              <div className="form-group flex-1">
                <label className="form-label" htmlFor="add-grade">Grade</label>
                <input id="add-grade" className="form-input" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. 3" />
              </div>
              <div className="form-group flex-1">
                <label className="form-label" htmlFor="add-classroom">Classroom</label>
                <input id="add-classroom" className="form-input" value={classroom} onChange={(e) => setClassroom(e.target.value)} placeholder="e.g. Room 204" />
              </div>
            </div>
          </div>
          <div className="modal__footer">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? "Adding..." : "Add Student"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Helpers for bulk parsing ───────────────────────── */
interface ParsedStudent {
  display_name: string;
  initials: string;
}

function parseStudentNames(raw: string): ParsedStudent[] {
  // Split on commas, newlines, or tabs
  const parts = raw
    .split(/[\n\r\t,]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // Deduplicate
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(p);
    }
  }

  return unique.map(name => {
    // Derive initials from first letter of each word
    const words = name.split(/\s+/).filter(w => w.length > 0);
    const initials = words.map(w => w[0].toUpperCase()).join("").slice(0, 4);
    return { display_name: name, initials };
  });
}

/* ── Bulk Add Student Modal ─────────────────────────── */
function BulkAddStudentsModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [rawInput, setRawInput] = useState("");
  const [grade, setGrade] = useState("");
  const [classroom, setClassroom] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<{ display_name: string; success: boolean; error?: string }[] | null>(null);
  const { legacyToken: token } = useLegacyToken();

  const parsed = useMemo(() => parseStudentNames(rawInput), [rawInput]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsed.length === 0) {
      setError("Enter at least one student name.");
      return;
    }
    if (parsed.length > 50) {
      setError("You can add up to 50 students at once. You have " + parsed.length + ".");
      return;
    }
    setSubmitting(true);
    setError("");
    setResults(null);
    try {
      const res = await fetch("/api/students/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          students: parsed,
          grade: grade.trim(),
          classroom: classroom.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add students");
      }
      setResults(data.results);
      if (data.summary.failed === 0) {
        // All succeeded — clear and close after short delay
        setTimeout(() => {
          setRawInput("");
          setGrade("");
          setClassroom("");
          setResults(null);
          onAdded();
          onClose();
        }, 1500);
      } else {
        // Some failed — let user review, but still refresh
        onAdded();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setRawInput("");
      setGrade("");
      setClassroom("");
      setError("");
      setResults(null);
      onClose();
    }
  };

  const allSucceeded = results && results.every(r => r.success);
  const someFailed = results && results.some(r => !r.success);

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Bulk Add Students</h2>
          <button className="modal__close" onClick={handleClose} aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal__body">
            {error && <div className="alert alert--error">{error}</div>}

            {/* Results summary */}
            {results && (
              <div className={`alert ${allSucceeded ? "alert--success" : "alert--warning"}`} style={{ marginBottom: "var(--space-md)" }}>
                {allSucceeded ? (
                  <><CheckCircle2 size={16} style={{ marginRight: 6 }} />All {results.length} students added successfully!</>
                ) : (
                  <><AlertCircle size={16} style={{ marginRight: 6 }} />{results.filter(r => r.success).length} added, {results.filter(r => !r.success).length} failed</>
                )}
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="bulk-names">
                Student Names *
              </label>
              <p className="form-help" style={{ fontSize: "0.75rem", color: "var(--color-gray-400)", marginTop: 2, marginBottom: "var(--space-sm)" }}>
                Paste names separated by commas or new lines. Example: John Smith, Jane Doe
              </p>
              <textarea
                id="bulk-names"
                className="form-input"
                rows={5}
                style={{ resize: "vertical", minHeight: 100, fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}
                value={rawInput}
                onChange={(e) => { setRawInput(e.target.value); setResults(null); }}
                placeholder={"John Smith\nJane Doe\nAlex Johnson"}
                autoFocus
                disabled={submitting}
              />
            </div>

            {/* Preview */}
            {parsed.length > 0 && !results && (
              <div style={{ marginBottom: "var(--space-md)" }}>
                <p className="form-label" style={{ marginBottom: "var(--space-sm)" }}>
                  Preview ({parsed.length} student{parsed.length !== 1 ? "s" : ""})
                </p>
                <div style={{
                  maxHeight: 180,
                  overflowY: "auto",
                  border: "1px solid var(--color-gray-200)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-gray-50)",
                }}>
                  {parsed.map((s, i) => (
                    <div key={i} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-sm)",
                      padding: "var(--space-xs) var(--space-sm)",
                      borderBottom: i < parsed.length - 1 ? "1px solid var(--color-gray-200)" : "none",
                      fontSize: "0.85rem",
                    }}>
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 28,
                        height: 28,
                        borderRadius: "var(--radius-sm)",
                        background: "var(--color-primary-bg)",
                        color: "var(--color-primary)",
                        fontWeight: 700,
                        fontSize: "0.75rem",
                        flexShrink: 0,
                      }}>
                        {s.initials}
                      </span>
                      <span style={{ flex: 1 }}>{s.display_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Results list (when some failed) */}
            {someFailed && (
              <div style={{ marginBottom: "var(--space-md)" }}>
                <p className="form-label" style={{ marginBottom: "var(--space-sm)", color: "var(--color-danger)" }}>
                  Failed entries
                </p>
                <div style={{
                  maxHeight: 140,
                  overflowY: "auto",
                  border: "1px solid var(--color-danger-bg)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-danger-bg)",
                }}>
                  {results!.filter(r => !r.success).map((r, i) => (
                    <div key={i} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-sm)",
                      padding: "var(--space-xs) var(--space-sm)",
                      borderBottom: "1px solid #fecaca",
                      fontSize: "0.8rem",
                      color: "var(--color-danger-dark)",
                    }}>
                      <AlertCircle size={14} style={{ flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{r.display_name}</span>
                      <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>{r.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-sm">
              <div className="form-group flex-1">
                <label className="form-label" htmlFor="bulk-grade">Grade (optional)</label>
                <input id="bulk-grade" className="form-input" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. 3" disabled={submitting} />
              </div>
              <div className="form-group flex-1">
                <label className="form-label" htmlFor="bulk-classroom">Classroom (optional)</label>
                <input id="bulk-classroom" className="form-input" value={classroom} onChange={(e) => setClassroom(e.target.value)} placeholder="e.g. Room 204" disabled={submitting} />
              </div>
            </div>
            <p className="form-help" style={{ fontSize: "0.75rem", color: "var(--color-gray-400)", marginTop: 2 }}>
              Grade and classroom apply to all students in this batch.
            </p>
          </div>
          <div className="modal__footer">
            <button type="button" className="btn btn--ghost" onClick={handleClose} disabled={submitting}>Cancel</button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={submitting || parsed.length === 0 || (allSucceeded === true)}
            >
              {submitting ? "Adding..." : allSucceeded ? "Done!" : `Add ${parsed.length} Student${parsed.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main Students Page ────────────────────────────── */
export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const { legacyToken: token } = useLegacyToken();

  const fetchStudents = () => {
    if (!token) return;
    setLoading(true);
    setError("");
    fetch("/api/students", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setStudents(data.students || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => { fetchStudents(); }, [token]);

  const filtered = students.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.display_name.toLowerCase().includes(q) ||
      s.initials.toLowerCase().includes(q) ||
      s.local_id.toLowerCase().includes(q)
    );
  });

  if (loading) return (
    <div className="loading" aria-busy="true">
      <span className="spinner spinner--lg" style={{ marginRight: "var(--space-sm)" }} />
      Loading students...
    </div>
  );

  if (error) return (
    <div className="alert alert--error">
      <p style={{ marginBottom: "var(--space-sm)" }}>Failed to load students: {error}</p>
      <button className="btn btn--primary btn--sm" onClick={fetchStudents}>Retry</button>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-md">
        <h1>Students</h1>
        <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
          <button className="btn btn--secondary btn--sm" onClick={() => setShowBulkAddModal(true)}>
            <Upload size={16} /> Bulk Add
          </button>
          <button className="btn btn--primary btn--sm" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Add Student
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-md">
        <label htmlFor="student-search" className="form-label">Search Students</label>
        <div style={{ position: "relative", maxWidth: 400 }}>
          <Search size={18} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-gray-400)", pointerEvents: "none" }} />
          <input
            id="student-search"
            className="form-input"
            type="search"
            placeholder="Search by name, initials, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 40 }}
          />
        </div>
      </div>

      {/* Student Cards */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__icon"><Users size={40} /></span>
          <p>{search ? "No students match your search." : "No students added yet."}</p>
          {!search && (
            <button className="btn btn--primary mt-md" onClick={() => setShowAddModal(true)}>
              Add Your First Student
            </button>
          )}
        </div>
      ) : (
        <div className="student-grid">
          {filtered.map((s) => {
            const badgeColor = entryColor(s.positiveThisWeek, s.entriesThisWeek);
            return (
              <Link
                key={s.id}
                to={`/students/${s.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="student-list-card">
                  <div
                    className="student-list-card__avatar"
                    style={{ background: "var(--color-primary-bg)" }}
                  >
                    <img
                      src={getAvatarUrl(s.initials)}
                      alt=""
                      onError={(e) => {
                        const el = e.currentTarget;
                        el.style.display = "none";
                        const parent = el.parentElement;
                        if (parent) {
                          parent.textContent = s.initials;
                          parent.style.display = "flex";
                          parent.style.alignItems = "center";
                          parent.style.justifyContent = "center";
                          parent.style.fontWeight = "700";
                          parent.style.fontSize = "0.85rem";
                          parent.style.color = "var(--color-primary)";
                        }
                      }}
                    />
                  </div>

                  <div className="student-list-card__info">
                    <div className="student-list-card__name">{s.display_name}</div>
                    <div className="student-list-card__meta">
                      Grade {s.grade} \u00b7 {s.classroom}
                      {s.local_id && ` \u00b7 ${s.local_id}`}
                    </div>
                  </div>

                  <div className="student-list-card__badges">
                    {s.activeGoals > 0 && (
                      <span className="badge badge--neutral" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <Target size={12} /> {s.activeGoals} goal{s.activeGoals !== 1 ? "s" : ""}
                      </span>
                    )}
                    <span
                      className="badge"
                      style={{
                        background: badgeColor + "18",
                        color: badgeColor,
                      }}
                    >
                      <FileText size={12} style={{ marginRight: 3 }} />
                      {s.entriesThisWeek} this week
                    </span>
                    {s.pendingDocs > 0 && (
                      <span className="badge badge--pending" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <ClipboardList size={12} /> {s.pendingDocs} pending
                      </span>
                    )}
                  </div>

                  <ChevronRight size={18} className="student-list-card__arrow" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <AddStudentModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={fetchStudents}
      />

      <BulkAddStudentsModal
        open={showBulkAddModal}
        onClose={() => setShowBulkAddModal(false)}
        onAdded={fetchStudents}
      />
    </div>
  );
}

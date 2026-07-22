import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useLegacyToken } from "../lib/auth";
import { Users, Search, Target, FileText, ClipboardList, ChevronRight, X, Plus } from "lucide-react";
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
      const token = localStorage.getItem("bt_token");
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

/* ── Main Students Page ────────────────────────────── */
export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
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

  useEffect(() => { fetchStudents(); }, []);

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
        <button className="btn btn--primary btn--sm" onClick={() => setShowAddModal(true)}>
          <Plus size={16} /> Add Student
        </button>
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
                    <img src={getAvatarUrl(s.initials)} alt="" />
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
    </div>
  );
}

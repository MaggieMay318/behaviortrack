import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useLegacyToken } from "../lib/auth";
import { FileText, HelpCircle, CheckCircle, TrendingUp, ClipboardList, Copy, X, ChevronDown, ChevronUp, Check, Edit, Bell } from "lucide-react";

/* ── Types ─────────────────────────────────────────── */

interface DocStats {
  pendingCount: number;
  needsClarificationCount: number;
  completedThisWeek: number;
  completionRate: number;
  overdueCount: number;
}

interface Entry {
  id: number;
  student_name: string;
  student_initials: string;
  student_grade: string;
  student_id: number;
  date: string;
  time: string;
  subject_activity: string;
  location: string;
  entry_type: string;
  behavior_categories: string;
  objective_observation: string;
  possible_triggers: string;
  interventions: string;
  student_response: string;
  outcome: string;
  people_involved: string;
  parent_contact_status: string;
  admin_contact_status: string;
  counselor_contact_status: string;
  follow_up_date: string;
  additional_notes: string;
  confidential_notes: string;
  doc_status: string;
  doc_system_name: string;
  doc_completion_date: string;
  doc_reference_number: string;
  doc_note: string;
}

interface Student {
  id: number;
  display_name: string;
  initials: string;
  grade: string;
  classroom: string;
}

interface FilterState {
  search: string;
  statuses: string[];
  studentId: number | null;
  dateFrom: string;
  dateTo: string;
  severity: string[];
  contactPending: string | null;
}

/* ── Constants ─────────────────────────────────────── */

const DOC_STATUS_LABELS: Record<string, string> = {
  not_required: "Not Required",
  required_pending: "Required — Pending",
  completed: "Completed",
  needs_clarification: "Needs Clarification",
};

const DOC_STATUS_COLORS: Record<string, string> = {
  not_required: "badge--neutral",
  required_pending: "badge--moderate",
  completed: "badge--positive",
  needs_clarification: "badge--major",
};

const SEVERITY_LABELS: Record<string, string> = {
  positive: "Positive",
  minor_concern: "Minor",
  moderate_concern: "Moderate",
  major_concern: "Major",
  crisis: "Crisis",
};

const SEVERITY_COLORS: Record<string, string> = {
  positive: "badge--positive",
  minor_concern: "badge--minor",
  moderate_concern: "badge--moderate",
  major_concern: "badge--major",
  crisis: "badge--crisis",
};

const SAVED_FILTERS = [
  { label: "Pending Documentation", statuses: "required_pending" },
  { label: "Overdue", statuses: "required_pending", overdue: true },
  { label: "Needs Clarification", statuses: "needs_clarification" },
  { label: "Completed This Week", statuses: "completed", thisWeek: true },
];

const CONTACT_LABELS: Record<string, string> = {
  parent: "Parent",
  admin: "Admin",
  counselor: "Counselor",
};

/* ── Component ──────────────────────────────────────── */

export default function Documentation() {
  const { legacyToken: token } = useLegacyToken();

  // Data
  const [entries, setEntries] = useState<Entry[]>([]);
  const [stats, setStats] = useState<DocStats | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    statuses: ["required_pending", "needs_clarification"],
    studentId: null,
    dateFrom: "",
    dateTo: "",
    severity: [],
    contactPending: null,
  });

  // UI state
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [savedSystemName, setSavedSystemName] = useState<string>(
    () => localStorage.getItem("bt_doc_system_name") || ""
  );

  // Mark Completed modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEntry, setModalEntry] = useState<Entry | null>(null);
  const [completionForm, setCompletionForm] = useState({
    completionDate: new Date().toISOString().slice(0, 10),
    systemName: savedSystemName,
    referenceNumber: "",
    note: "",
  });
  const [completing, setCompleting] = useState(false);

  // Reminder prefs
  const [reminderPref, setReminderPref] = useState<string>(
    () => localStorage.getItem("bt_reminder_pref") || "none"
  );

  // Show filters panel on mobile
  const [filtersOpen, setFiltersOpen] = useState(false);

  /* ── Fetch stats ─────────────────────────────────── */
  useEffect(() => {
    if (!token) return;
    fetch("/api/documentation/stats", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, [token]);

  /* ── Fetch students ───────────────────────────────── */
  useEffect(() => {
    if (!token) return;
    fetch("/api/students?active=true", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setStudents(d.students || []))
      .catch(() => {});
  }, [token]);

  /* ── Fetch entries ────────────────────────────────── */
  const fetchEntries = useCallback(() => {
    if (!token) return;
    setLoading(true);

    const params = new URLSearchParams();
    params.set("limit", "200");

    if (filters.statuses.length > 0) {
      params.set("doc_status", filters.statuses.join(","));
    }
    if (filters.studentId) {
      params.set("student_id", String(filters.studentId));
    }
    if (filters.search) {
      params.set("search", filters.search);
    }
    if (filters.dateFrom) {
      params.set("date_from", filters.dateFrom);
    }
    if (filters.dateTo) {
      params.set("date_to", filters.dateTo);
    }
    if (filters.severity.length > 0) {
      params.set("severity", filters.severity.join(","));
    }

    fetch(`/api/entries?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.entries || []);
        setError("");
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [token, filters]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  /* ── Active filter count ──────────────────────────── */
  const activeFilterCount = (() => {
    let n = 0;
    if (filters.search) n++;
    if (filters.studentId) n++;
    if (filters.dateFrom || filters.dateTo) n++;
    if (filters.severity.length > 0) n++;
    if (filters.contactPending) n++;
    // Status filter is active if not the default
    const defaultStatuses = ["required_pending", "needs_clarification"];
    if (
      filters.statuses.length !== defaultStatuses.length ||
      !filters.statuses.every((s) => defaultStatuses.includes(s))
    ) {
      n++;
    }
    return n;
  })();

  /* ── Helpers ──────────────────────────────────────── */
  const parseArray = (val: string): string[] => {
    try {
      return JSON.parse(val);
    } catch {
      return [];
    }
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (timeStr: string): string => {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  const isOverdue = (entry: Entry): boolean => {
    if (entry.doc_status !== "required_pending") return false;
    const entryDate = new Date(entry.date + "T12:00:00");
    const now = new Date();
    // Overdue: more than 7 calendar days old
    const diffMs = now.getTime() - entryDate.getTime();
    return diffMs > 7 * 86400000;
  };

  const isFollowUpOverdue = (entry: Entry): boolean => {
    if (!entry.follow_up_date) return false;
    const today = new Date().toISOString().slice(0, 10);
    return entry.follow_up_date < today;
  };

  /* ── Copy Summary ─────────────────────────────────── */
  const copySummary = (entry: Entry) => {
    const categories = parseArray(entry.behavior_categories);
    const triggers = parseArray(entry.possible_triggers);
    const interventions = parseArray(entry.interventions);
    const response = parseArray(entry.student_response);
    const outcomes = parseArray(entry.outcome);

    const summary = [
      "BEHAVIORTRACK — OFFICIAL DOCUMENTATION SUMMARY",
      `Date: ${formatDate(entry.date)} | Time: ${formatTime(entry.time)}`,
      `Student: ${entry.student_name} (Grade ${entry.student_grade || "—"})`,
      `Location/Subject: ${entry.location || "N/A"} / ${entry.subject_activity || "N/A"}`,
      `Observed Behavior: ${entry.objective_observation || "No observation recorded"}`,
      `Antecedent/Context: ${triggers.length > 0 ? triggers.join(", ") : "None recorded"}`,
      `Intervention(s): ${interventions.length > 0 ? interventions.join(", ") : "None recorded"}`,
      `Student Response: ${response.length > 0 ? response.join(", ") : "N/A"}`,
      `Outcome: ${outcomes.length > 0 ? outcomes.join(", ") : "N/A"}`,
      `Contacts Made: ${[
        entry.parent_contact_status ? `Parent: ${entry.parent_contact_status.replace(/_/g, " ")}` : "",
        entry.admin_contact_status ? `Admin: ${entry.admin_contact_status.replace(/_/g, " ")}` : "",
        entry.counselor_contact_status ? `Counselor: ${entry.counselor_contact_status.replace(/_/g, " ")}` : "",
      ].filter(Boolean).join("; ") || "None"}`,
      `Follow-Up Required: ${entry.follow_up_date ? `Yes — ${formatDate(entry.follow_up_date)}` : "No"}`,
      `Documentation Status: ${DOC_STATUS_LABELS[entry.doc_status] || entry.doc_status}`,
      "---",
      "This summary was generated by BehaviorTrack, a supplemental tracking tool.",
      "The educator remains responsible for entering required documentation into",
      "the district's official record system.",
    ].join("\n");

    navigator.clipboard.writeText(summary).then(() => {
      setToast("Summary copied to clipboard");
      setTimeout(() => setToast(null), 2500);
    }).catch(() => {
      setToast("Failed to copy — please try again");
      setTimeout(() => setToast(null), 2500);
    });
  };

  /* ── Mark Completed ───────────────────────────────── */
  const openCompleteModal = (entry: Entry) => {
    setModalEntry(entry);
    setCompletionForm({
      completionDate: new Date().toISOString().slice(0, 10),
      systemName: savedSystemName,
      referenceNumber: "",
      note: "",
    });
    setModalOpen(true);
  };

  const handleMarkComplete = async () => {
    if (!token || !modalEntry) return;
    setCompleting(true);

    try {
      const res = await fetch(`/api/entries/${modalEntry.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doc_status: "completed",
          doc_completion_date: completionForm.completionDate,
          doc_system_name: completionForm.systemName,
          doc_reference_number: completionForm.referenceNumber,
          doc_note: completionForm.note,
        }),
      });

      if (res.ok) {
        // Save system name for next time
        localStorage.setItem("bt_doc_system_name", completionForm.systemName);
        setSavedSystemName(completionForm.systemName);

        setModalOpen(false);
        setModalEntry(null);
        setToast("Entry marked as completed");

        // Refresh
        fetchEntries();
        // Refresh stats
        fetch("/api/documentation/stats", {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => r.json())
          .then(setStats)
          .catch(() => {});

        setTimeout(() => setToast(null), 2500);
      } else {
        setToast("Failed to update entry");
        setTimeout(() => setToast(null), 2500);
      }
    } catch {
      setToast("Network error — please try again");
      setTimeout(() => setToast(null), 2500);
    } finally {
      setCompleting(false);
    }
  };

  /* ── Toggle expand ────────────────────────────────── */
  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ── Status chip toggle ───────────────────────────── */
  const toggleStatus = (status: string) => {
    setFilters((prev) => ({
      ...prev,
      statuses: prev.statuses.includes(status)
        ? prev.statuses.filter((s) => s !== status)
        : [...prev.statuses, status],
    }));
  };

  /* ── Severity chip toggle ─────────────────────────── */
  const toggleSeverity = (sev: string) => {
    setFilters((prev) => ({
      ...prev,
      severity: prev.severity.includes(sev)
        ? prev.severity.filter((s) => s !== sev)
        : [...prev.severity, sev],
    }));
  };

  /* ── Saved filters ────────────────────────────────── */
  const applySavedFilter = (name: string) => {
    const saved = SAVED_FILTERS.find((f) => f.label === name);
    if (!saved) return;

    const newFilters: FilterState = {
      search: "",
      statuses: saved.statuses ? [saved.statuses] : [],
      studentId: null,
      dateFrom: "",
      dateTo: "",
      severity: [],
      contactPending: null,
    };

    if (saved.thisWeek) {
      const dayOfWeek = new Date().getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date();
      monday.setDate(monday.getDate() - mondayOffset);
      newFilters.dateFrom = monday.toISOString().slice(0, 10);
    }

    setFilters(newFilters);
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      statuses: ["required_pending", "needs_clarification"],
      studentId: null,
      dateFrom: "",
      dateTo: "",
      severity: [],
      contactPending: null,
    });
  };

  /* ── Reminder preference ──────────────────────────── */
  const setReminder = (pref: string) => {
    setReminderPref(pref);
    localStorage.setItem("bt_reminder_pref", pref);
  };

  /* ── Alert items ──────────────────────────────────── */
  const overdueEntries = entries.filter(
    (e) => e.doc_status === "required_pending" && isOverdue(e)
  );
  const needsClarificationEntries = entries.filter(
    (e) => e.doc_status === "needs_clarification"
  );
  const missingFollowUpEntries = entries.filter(
    (e) => e.follow_up_date && isFollowUpOverdue(e) && !e.outcome
  );

  /* ── Client-side filtering ────────────────────────── */
  const filteredEntries = entries.filter((e) => {
    // Contact pending filter (client-side since API doesn't support it directly)
    if (filters.contactPending) {
      const fieldMap: Record<string, string> = {
        parent: e.parent_contact_status,
        admin: e.admin_contact_status,
        counselor: e.counselor_contact_status,
      };
      const status = fieldMap[filters.contactPending];
      if (!status || status === "contacted") return false;
    }
    return true;
  });

  /* ── Render ───────────────────────────────────────── */
  if (loading) {
    return (
      <div>
        <h1>Documentation Queue</h1>
        <div className="loading" aria-busy="true">
          <span className="spinner spinner--lg" style={{ marginRight: "var(--space-sm)" }} />
          Loading queue...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1>Documentation Queue</h1>
        <div className="alert alert--error">
          <p style={{ marginBottom: "var(--space-sm)" }}>Failed to load queue: {error}</p>
          <button className="btn btn--primary btn--sm" onClick={fetchEntries}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Toast notification */}
      {toast && <div className="toast">{toast}</div>}

      {/* Page header */}
      <div className="flex items-center justify-between mb-md">
        <h1>Documentation Queue</h1>
      </div>

      {/* Disclaimer */}
      <div className="alert alert--info mb-lg">
        <strong>Important:</strong> BehaviorTrack supplements, but does <em>not</em> replace, your
        district's official documentation system. This queue reminds you which entries still need to
        be entered into your official system. Mark entries as completed once they are entered into
        the required system.
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="stat-cards-grid mb-lg">
          <div className="stat-card">
            <div className="stat-card__icon"><FileText size={18} /></div>
            <div className="stat-card__value">
              {stats.pendingCount}
              {stats.overdueCount > 0 && (
                <span
                  style={{
                    fontSize: "0.65rem",
                    background: "var(--color-danger-bg)",
                    color: "var(--color-danger)",
                    borderRadius: "var(--radius-full)",
                    padding: "2px 6px",
                    marginLeft: "6px",
                    verticalAlign: "middle",
                  }}
                >
                  {stats.overdueCount} overdue
                </span>
              )}
            </div>
            <div className="stat-card__label">Pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__icon"><HelpCircle size={18} /></div>
            <div className="stat-card__value">{stats.needsClarificationCount}</div>
            <div className="stat-card__label">Needs Clarification</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__icon"><CheckCircle size={18} /></div>
            <div className="stat-card__value">{stats.completedThisWeek}</div>
            <div className="stat-card__label">Completed This Week</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__icon"><TrendingUp size={18} /></div>
            <div className="stat-card__value">{stats.completionRate}%</div>
            <div className="stat-card__label">Completion Rate</div>
          </div>
        </div>
      )}

      {/* Alerts Section */}
      {(overdueEntries.length > 0 ||
        needsClarificationEntries.length > 0 ||
        missingFollowUpEntries.length > 0) && (
        <div className="mb-lg" style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          {overdueEntries.length > 0 && !dismissedAlerts.has("overdue") && (
            <div className="alert alert--error" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>{overdueEntries.length} entries</strong> are overdue for official
                documentation (pending &gt; 7 days). These should be prioritized.
              </div>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => setDismissedAlerts((s) => new Set(s).add("overdue"))}
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {needsClarificationEntries.length > 0 && !dismissedAlerts.has("needs_clarification") && (
            <div className="alert alert--warning" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>{needsClarificationEntries.length} entries</strong> need clarification before
                they can be documented. Review and update as needed.
              </div>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => setDismissedAlerts((s) => new Set(s).add("needs_clarification"))}
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {missingFollowUpEntries.length > 0 && !dismissedAlerts.has("missing_followup") && (
            <div className="alert alert--info" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>{missingFollowUpEntries.length} entries</strong> with overdue follow-ups and
                missing outcome data. Update outcomes to close the loop.
              </div>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => setDismissedAlerts((s) => new Set(s).add("missing_followup"))}
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filters Bar */}
      <div className="card mb-lg" style={{ padding: "var(--space-md)" }}>
        {/* Mobile toggle */}
        <button
          className="btn btn--ghost btn--sm mb-sm hide-desktop"
          onClick={() => setFiltersOpen(!filtersOpen)}
          style={{ width: "100%", justifyContent: "space-between" }}
        >
          <span>Filters {activeFilterCount > 0 && `(${activeFilterCount})`}</span>
          {filtersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        <div className={filtersOpen ? "" : "hide-mobile-filters"}>
          {/* Search */}
          <div className="form-group" style={{ marginBottom: "var(--space-sm)" }}>
            <input
              className="form-input"
              type="text"
              placeholder="Search by student name..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              style={{ maxWidth: "400px" }}
            />
          </div>

          {/* Status chips */}
          <div className="mb-sm">
            <span className="text-sm text-muted" style={{ display: "block", marginBottom: "4px" }}>
              Documentation Status:
            </span>
            <div className="chip-group">
              {Object.entries(DOC_STATUS_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  className={`chip ${filters.statuses.includes(key) ? "chip--selected" : ""}`}
                  onClick={() => toggleStatus(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Severity chips */}
          <div className="mb-sm">
            <span className="text-sm text-muted" style={{ display: "block", marginBottom: "4px" }}>
              Entry Type:
            </span>
            <div className="chip-group">
              {Object.entries(SEVERITY_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  className={`chip ${filters.severity.includes(key) ? "chip--selected" : ""}`}
                  onClick={() => toggleSeverity(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Student dropdown */}
          <div className="mb-sm">
            <span className="text-sm text-muted" style={{ display: "block", marginBottom: "4px" }}>
              Student:
            </span>
            <select
              className="form-select"
              value={filters.studentId || ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  studentId: e.target.value ? Number(e.target.value) : null,
                }))
              }
              style={{ maxWidth: "300px" }}
            >
              <option value="">All Students</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name} ({s.initials}) — Grade {s.grade}
                </option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div className="mb-sm" style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", alignItems: "center" }}>
            <span className="text-sm text-muted">Date:</span>
            <input
              className="form-input"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
              style={{ width: "auto", flex: "1", minWidth: "140px" }}
            />
            <span className="text-sm text-muted">to</span>
            <input
              className="form-input"
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
              style={{ width: "auto", flex: "1", minWidth: "140px" }}
            />
          </div>

          {/* Contact status */}
          <div className="mb-sm">
            <span className="text-sm text-muted" style={{ display: "block", marginBottom: "4px" }}>
              Contact Status (pending):
            </span>
            <div className="chip-group">
              {Object.entries(CONTACT_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  className={`chip ${filters.contactPending === key ? "chip--selected" : ""}`}
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      contactPending: f.contactPending === key ? null : key,
                    }))
                  }
                >
                  {label} pending
                </button>
              ))}
            </div>
          </div>

          {/* Saved filters */}
          <div className="mb-sm">
            <span className="text-sm text-muted" style={{ display: "block", marginBottom: "4px" }}>
              Saved Filters:
            </span>
            <div className="chip-group">
              {SAVED_FILTERS.map((sf) => (
                <button
                  key={sf.label}
                  className="chip chip--selected"
                  onClick={() => applySavedFilter(sf.label)}
                >
                  {sf.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <button className="btn btn--ghost btn--sm" onClick={clearFilters}>
              Clear all filters ({activeFilterCount})
            </button>
          )}
        </div>
      </div>

      {/* Reminder Preferences */}
      <details className="card mb-lg" style={{ padding: "var(--space-md)" }}>
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <Bell size={16} /> Reminder Preferences
        </summary>
        <div style={{ marginTop: "var(--space-sm)" }}>
          <div className="chip-group">
            {[
              { value: "none", label: "None" },
              { value: "end_of_day", label: "End of School Day" },
              { value: "next_morning", label: "Next School Morning" },
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
            ].map((opt) => (
              <button
                key={opt.value}
                className={`chip ${reminderPref === opt.value ? "chip--selected" : ""}`}
                onClick={() => setReminder(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted mt-sm">
            Current: <strong>{(() => {
              const labels: Record<string, string> = {
                none: "No reminders",
                end_of_day: "End of School Day",
                next_morning: "Next School Morning",
                daily: "Daily",
                weekly: "Weekly",
              };
              return labels[reminderPref] || reminderPref;
            })()}</strong>
          </p>
          <p className="text-sm text-muted">
            Reminders are in-app only. BehaviorTrack does not send external notifications.
          </p>
        </div>
      </details>

      {/* Queue Items */}
      {loading ? (
        <div className="loading">Loading entries...</div>
      ) : filteredEntries.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__icon"><CheckCircle size={40} /></span>
          <p>No entries match your filters.</p>
          <p className="text-sm text-muted">
            {entries.length === 0
              ? "All entries are either completed or don't require official documentation."
              : "Try adjusting your filters to see more entries."}
          </p>
        </div>
      ) : (
        <div>
          <p className="text-sm text-muted mb-md">
            {filteredEntries.length} {filteredEntries.length === 1 ? "entry" : "entries"} in queue
          </p>

          {filteredEntries.map((entry) => {
            const cats = parseArray(entry.behavior_categories);
            const isExpanded = expandedIds.has(entry.id);
            const docStatusLabel = DOC_STATUS_LABELS[entry.doc_status] || entry.doc_status;
            const docStatusColor = DOC_STATUS_COLORS[entry.doc_status] || "badge--neutral";
            const severityLabel = SEVERITY_LABELS[entry.entry_type] || entry.entry_type;
            const severityColor = SEVERITY_COLORS[entry.entry_type] || "badge--neutral";

            return (
              <div
                key={entry.id}
                className="card"
                style={{
                  borderLeft: `3px solid ${
                    entry.doc_status === "required_pending" && isOverdue(entry)
                      ? "var(--color-danger)"
                      : entry.doc_status === "required_pending"
                      ? "var(--color-warning)"
                      : entry.doc_status === "needs_clarification"
                      ? "var(--color-info)"
                      : "var(--color-success)"
                  }`,
                }}
              >
                {/* Card Header */}
                <div className="card__header">
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                    <div className="student-avatar">{entry.student_initials}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                        {entry.student_name}
                      </div>
                      <div className="text-sm text-muted">
                        {formatDate(entry.date)} at {formatTime(entry.time)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center", flexWrap: "wrap" }}>
                    <span className={`badge ${severityColor}`}>{severityLabel}</span>
                    <span className={`badge ${docStatusColor}`}>{docStatusLabel}</span>
                  </div>
                </div>

                {/* Card Body (compact) */}
                <div className="card__body">
                  {/* Behavior categories */}
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "var(--space-sm)" }}>
                    {cats.slice(0, 3).map((cat, i) => (
                      <span key={i} className="badge badge--neutral">
                        {cat}
                      </span>
                    ))}
                    {cats.length > 3 && (
                      <span className="badge badge--neutral">+{cats.length - 3} more</span>
                    )}
                    {cats.length === 0 && (
                      <span className="text-sm text-muted">No categories</span>
                    )}
                  </div>

                  {/* Observation snippet */}
                  <p style={{ marginBottom: "var(--space-xs)", fontSize: "0.9rem" }}>
                    {entry.objective_observation
                      ? isExpanded
                        ? entry.objective_observation
                        : entry.objective_observation.slice(0, 120) +
                          (entry.objective_observation.length > 120 ? "..." : "")
                      : <span className="text-muted">No observation recorded</span>}
                  </p>

                  {/* Follow-up date */}
                  {entry.follow_up_date && (
                    <p
                      className="text-sm"
                      style={{
                        color: isFollowUpOverdue(entry) ? "var(--color-danger)" : "var(--color-gray-500)",
                        fontWeight: isFollowUpOverdue(entry) ? 600 : 400,
                      }}
                    >
                      Follow-up: {formatDate(entry.follow_up_date)}
                      {isFollowUpOverdue(entry) && " (overdue)"}
                    </p>
                  )}

                  {/* Expanded details */}
                  {isExpanded && (
                    <div style={{ marginTop: "var(--space-md)", paddingTop: "var(--space-md)", borderTop: "1px solid var(--color-gray-100)" }}>
                      <DocDetailSection label="Full Observation" content={entry.objective_observation} />
                      <DocDetailSection label="Behavior Categories">
                        {cats.length > 0 ? (
                          <div className="chip-group">
                            {cats.map((c, i) => (
                              <span key={i} className="chip" style={{ cursor: "default" }}>{c}</span>
                            ))}
                          </div>
                        ) : <span className="text-muted text-sm">None</span>}
                      </DocDetailSection>
                      <DocDetailSection label="Triggers / Context">
                        {(() => {
                          const t = parseArray(entry.possible_triggers);
                          return t.length > 0 ? (
                            <div className="chip-group">
                              {t.map((x, i) => (
                                <span key={i} className="chip" style={{ cursor: "default" }}>{x}</span>
                              ))}
                            </div>
                          ) : <span className="text-muted text-sm">None recorded</span>;
                        })()}
                      </DocDetailSection>
                      <DocDetailSection label="Interventions">
                        {(() => {
                          const t = parseArray(entry.interventions);
                          return t.length > 0 ? (
                            <div className="chip-group">
                              {t.map((x, i) => (
                                <span key={i} className="chip" style={{ cursor: "default" }}>{x}</span>
                              ))}
                            </div>
                          ) : <span className="text-muted text-sm">None recorded</span>;
                        })()}
                      </DocDetailSection>
                      <DocDetailSection label="Student Response">
                        <span>{parseArray(entry.student_response).join(", ") || <span className="text-muted text-sm">N/A</span>}</span>
                      </DocDetailSection>
                      <DocDetailSection label="Outcome">
                        <span>{parseArray(entry.outcome).join(", ") || <span className="text-muted text-sm">N/A</span>}</span>
                      </DocDetailSection>

                      {/* Contact statuses */}
                      <DocDetailSection label="Contacts">
                        <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                          {entry.parent_contact_status && (
                            <span className={`badge ${entry.parent_contact_status === "contacted" ? "badge--positive" : "badge--moderate"}`}>
                              Parent: {entry.parent_contact_status.replace(/_/g, " ")}
                            </span>
                          )}
                          {entry.admin_contact_status && (
                            <span className={`badge ${entry.admin_contact_status === "contacted" ? "badge--positive" : "badge--moderate"}`}>
                              Admin: {entry.admin_contact_status.replace(/_/g, " ")}
                            </span>
                          )}
                          {entry.counselor_contact_status && (
                            <span className={`badge ${entry.counselor_contact_status === "contacted" ? "badge--positive" : "badge--moderate"}`}>
                              Counselor: {entry.counselor_contact_status.replace(/_/g, " ")}
                            </span>
                          )}
                          {!entry.parent_contact_status && !entry.admin_contact_status && !entry.counselor_contact_status && (
                            <span className="text-sm text-muted">No contacts recorded</span>
                          )}
                        </div>
                      </DocDetailSection>

                      {/* Follow-up details */}
                      {entry.follow_up_date && (
                        <DocDetailSection label="Follow-Up">
                          <span>{formatDate(entry.follow_up_date)}</span>
                        </DocDetailSection>
                      )}

                      {/* Confidential notes */}
                      {entry.confidential_notes && (
                        <DocDetailSection label="Confidential Notes (Private)">
                          <div
                            style={{
                              background: "var(--color-warning-bg)",
                              border: "1px dashed var(--color-warning)",
                              borderRadius: "var(--radius-sm)",
                              padding: "var(--space-sm) var(--space-md)",
                              fontStyle: "italic",
                              fontSize: "0.875rem",
                            }}
                          >
                            {entry.confidential_notes}
                          </div>
                        </DocDetailSection>
                      )}

                      {/* Documentation trail */}
                      {entry.doc_status === "completed" && (
                        <DocDetailSection label="Documentation Trail">
                          <div className="text-sm" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <span>
                              <strong>System:</strong> {entry.doc_system_name || "N/A"}
                            </span>
                            {entry.doc_reference_number && (
                              <span>
                                <strong>Reference #:</strong> {entry.doc_reference_number}
                              </span>
                            )}
                            {entry.doc_completion_date && (
                              <span>
                                <strong>Completed:</strong> {formatDate(entry.doc_completion_date)}
                              </span>
                            )}
                            {entry.doc_note && (
                              <span>
                                <strong>Note:</strong> {entry.doc_note}
                              </span>
                            )}
                          </div>
                        </DocDetailSection>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="card__footer" style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => toggleExpand(entry.id)}
                  >
                    {isExpanded ? <><ChevronUp size={14} /> Collapse</> : <><ChevronDown size={14} /> Details</>}
                  </button>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => copySummary(entry)}
                    style={{ color: "var(--color-primary)" }}
                  >
                    <Copy size={14} /> Copy Summary
                  </button>
                  {entry.doc_status !== "completed" && (
                    <button
                      className="btn btn--success btn--sm"
                      onClick={() => openCompleteModal(entry)}
                    >
                      <Check size={14} /> Mark Completed
                    </button>
                  )}
                  <Link
                    to={`/entry/${entry.id}`}
                    className="btn btn--ghost btn--sm"
                  >
                    <Edit size={14} /> Edit Entry
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mark Completed Modal */}
      {modalOpen && modalEntry && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">Mark Documentation Complete</h2>
              <button className="modal__close" onClick={() => setModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal__body">
              <p className="text-sm text-muted mb-md">
                <strong>Entry:</strong> {modalEntry.student_name} — {formatDate(modalEntry.date)}{" "}
                {formatTime(modalEntry.time)}
              </p>

              <div className="form-group">
                <label className="form-label">Completion Date</label>
                <input
                  className="form-input"
                  type="date"
                  value={completionForm.completionDate}
                  onChange={(e) =>
                    setCompletionForm((f) => ({ ...f, completionDate: e.target.value }))
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">District System Name</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g., PowerSchool, Infinite Campus, district SIS"
                  value={completionForm.systemName}
                  onChange={(e) =>
                    setCompletionForm((f) => ({ ...f, systemName: e.target.value }))
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">Reference Number (optional)</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g., DOC-12345"
                  value={completionForm.referenceNumber}
                  onChange={(e) =>
                    setCompletionForm((f) => ({ ...f, referenceNumber: e.target.value }))
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">Note (optional)</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="Any relevant notes about this documentation..."
                  value={completionForm.note}
                  onChange={(e) =>
                    setCompletionForm((f) => ({ ...f, note: e.target.value }))
                  }
                />
              </div>

              <div className="alert alert--warning" style={{ fontSize: "0.8rem" }}>
                <strong>Disclaimer:</strong> Marking this complete does not transfer information into
                the district system. The educator remains responsible for following district
                documentation requirements.
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn--success"
                onClick={handleMarkComplete}
                disabled={completing}
              >
                {completing ? "Saving..." : "Mark Completed"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Small helper component ────────────────────────── */

function DocDetailSection({
  label,
  children,
  content,
}: {
  label: string;
  children?: React.ReactNode;
  content?: string;
}) {
  return (
    <div style={{ marginBottom: "var(--space-sm)" }}>
      <div
        style={{
          fontWeight: 600,
          fontSize: "0.78rem",
          color: "var(--color-gray-500)",
          textTransform: "uppercase",
          letterSpacing: "0.03em",
          marginBottom: "2px",
        }}
      >
        {label}
      </div>
      {children || (
        <span style={{ fontSize: "0.875rem" }}>
          {content || <span className="text-muted text-sm">N/A</span>}
        </span>
      )}
    </div>
  );
}

import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLegacyToken } from "../lib/auth";
import { CheckCircle, AlertTriangle } from "lucide-react";

// ─── Inline Critical Styles (build workaround) ──────────────────────

const ENTRY_FORM_STYLES = `
.chip-group{display:flex;flex-wrap:wrap;gap:8px}
.chip{display:inline-flex;align-items:center;padding:8px 16px;font-size:.85rem;font-weight:500;font-family:var(--font-sans);border:1px solid var(--color-gray-200);border-radius:9999px;background:var(--color-white);color:var(--color-gray-700);cursor:pointer;min-height:40px;transition:background .15s,border-color .15s,color .15s;white-space:nowrap;user-select:none}
.chip:hover{background:var(--color-gray-100);border-color:var(--color-gray-300)}
.chip--selected{background:var(--color-primary-bg);border-color:var(--color-primary-light);color:var(--color-primary-dark);font-weight:600}
.chip--custom{border-style:dashed;color:var(--color-gray-400)}
.chip--custom:hover{color:var(--color-primary);border-color:var(--color-primary-light)}
.chip-custom-input-wrapper{display:inline-flex;align-items:center;gap:0}
.chip-custom-input{width:110px;padding:8px 16px;font-size:.85rem;font-family:var(--font-sans);border:1px dashed var(--color-gray-300);border-radius:9999px 0 0 9999px;background:var(--color-white);color:var(--color-gray-800);min-height:40px;outline:none}
.chip-custom-input:focus{border-color:var(--color-primary)}
.chip-custom-ok{display:inline-flex;align-items:center;justify-content:center;padding:8px 16px;background:var(--color-primary);color:var(--color-white);border:1px solid var(--color-primary);border-radius:0 9999px 9999px 0;min-height:40px;cursor:pointer;font-weight:700;font-size:.85rem}
.type-chip-group{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
.type-chip{display:flex;align-items:center;justify-content:center;padding:16px 8px;font-size:.9rem;font-weight:500;font-family:var(--font-sans);border:2px solid var(--color-gray-200);border-radius:8px;background:var(--color-white);color:var(--color-gray-700);cursor:pointer;min-height:52px;transition:background .15s,border-color .15s,color .15s,transform .1s;text-align:center;line-height:1.2;user-select:none}
.type-chip:hover{border-color:var(--color-gray-300);transform:translateY(-1px)}
.type-chip--selected{border-width:2px}
.student-dropdown{position:absolute;top:100%;left:0;right:0;background:var(--color-white);border:1px solid var(--color-gray-200);border-radius:8px;box-shadow:var(--shadow-lg);max-height:300px;overflow-y:auto;z-index:200;margin-top:4px}
.student-dropdown__item{display:flex;align-items:center;gap:16px;width:100%;padding:8px 16px;border:none;background:none;cursor:pointer;font-family:var(--font-sans);text-align:left;min-height:44px;transition:background .1s}
.student-dropdown__item:hover{background:var(--color-gray-50)}
.student-dropdown__item:not(:last-child){border-bottom:1px solid var(--color-gray-100)}
.student-dropdown__empty{padding:16px;color:var(--color-gray-400);text-align:center}
.student-card{background:var(--color-gray-50);border:1px solid var(--color-gray-200);border-radius:8px;padding:16px}
.student-avatar{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:9999px;background:var(--color-primary-bg);color:var(--color-primary-dark);font-weight:700;font-size:.85rem;flex-shrink:0}
.student-avatar--lg{width:48px;height:48px;font-size:1rem}
.student-info{display:flex;flex-direction:column;gap:2px}
.collapsible{margin-bottom:16px}
.collapsible__header{display:flex;align-items:center;justify-content:space-between;width:100%;padding:16px;background:var(--color-white);border:1px solid var(--color-gray-200);border-radius:8px;font-size:1rem;font-weight:600;font-family:var(--font-sans);color:var(--color-gray-800);cursor:pointer;min-height:44px;transition:background .15s}
.collapsible__header:hover{background:var(--color-gray-50)}
.collapsible__arrow{font-size:1.2rem;transition:transform .2s;color:var(--color-gray-400)}
.collapsible__body{padding:16px;border:1px solid var(--color-gray-200);border-top:none;border-radius:0 0 8px 8px;background:var(--color-white)}
`;

// ─── TypeScript Types ───────────────────────────────────────────────

interface Student {
  id: number;
  display_name: string;
  initials: string;
  local_id: string;
  grade: string;
  classroom: string;
  active: number;
}

interface Goal {
  id: number;
  student_id: number;
  status: string;
  title: string;
}

interface EntryData {
  student_id: string;
  date: string;
  time: string;
  subject_activity: string;
  location: string;
  staff_member: string;
  entry_type: string;
  behavior_categories: string[];
  objective_observation: string;
  possible_triggers: string[];
  interventions: string[];
  student_response: string[];
  outcome: string[];
  people_involved: string;
  duration_minutes: string;
  frequency: string;
  property_damage: boolean;
  injury: boolean;
  parent_contact_status: string;
  admin_contact_status: string;
  counselor_contact_status: string;
  follow_up_date: string;
  additional_notes: string;
  confidential_notes: string;
  doc_status: string;
  doc_completion_date: string;
  doc_system_name: string;
  doc_reference_number: string;
  doc_note: string;
}

const EMPTY_FORM: EntryData = {
  student_id: "",
  date: new Date().toISOString().slice(0, 10),
  time: new Date().toTimeString().slice(0, 5),
  subject_activity: "",
  location: "",
  staff_member: "",
  entry_type: "",
  behavior_categories: [],
  objective_observation: "",
  possible_triggers: [],
  interventions: [],
  student_response: [],
  outcome: [],
  people_involved: "",
  duration_minutes: "",
  frequency: "",
  property_damage: false,
  injury: false,
  parent_contact_status: "",
  admin_contact_status: "",
  counselor_contact_status: "",
  follow_up_date: "",
  additional_notes: "",
  confidential_notes: "",
  doc_status: "not_required",
  doc_completion_date: "",
  doc_system_name: "",
  doc_reference_number: "",
  doc_note: "",
};

// ─── Option Lists ────────────────────────────────────────────────────

const SUBJECT_OPTIONS = [
  "Math", "Reading", "Writing", "Science", "Social Studies",
  "Art", "Music", "PE", "Recess", "Lunch", "Transition",
  "Morning Meeting", "Independent Work", "Group Work", "Testing", "Other",
];

const LOCATION_OPTIONS = [
  "Classroom", "Hallway", "Cafeteria", "Playground", "Gym",
  "Library", "Music Room", "Art Room", "Bathroom", "Bus", "Other",
];

const ENTRY_TYPES = [
  { value: "positive", label: "Positive", color: "#2d7d46", bg: "#eaf5ed", border: "#c5e5cc" },
  { value: "minor_concern", label: "Minor Concern", color: "#5b6e8a", bg: "#e8f0f8", border: "#c5d8ed" },
  { value: "moderate_concern", label: "Moderate Concern", color: "#b86e1c", bg: "#fdf3e4", border: "#f0d9b0" },
  { value: "major_concern", label: "Major Concern", color: "#b82828", bg: "#fde8e8", border: "#f0c5c5" },
  { value: "crisis", label: "Crisis / Urgent Safety", color: "#8a1a1a", bg: "#fce8e8", border: "#d88", },
];

const BEHAVIOR_CORRECTIVE = [
  "Off Task", "Disruption", "Defiance/Refusal",
  "Disrespectful/Inappropriate Language", "Aggression", "Peer Conflict",
  "Leaving Assigned Area", "Property Misuse", "Emotional Dysregulation",
  "Work Avoidance", "Incomplete Work", "Excessive Talking",
  "Unsafe Behavior", "Technology Misuse",
];

const BEHAVIOR_POSITIVE = [
  "Positive Participation", "Following Directions", "Helping Others",
  "Kindness", "Staying On Task", "Successful Transition",
  "Improved Effort", "Emotional Regulation", "Meeting a Goal",
];

const POSSIBLE_TRIGGERS = [
  "Difficult Task", "Independent Work", "Group Work", "Transition",
  "Peer Interaction", "Adult Correction", "Unstructured Time",
  "Change in Routine", "Denied Preferred Activity", "Asked to Stop Preferred Activity",
  "Seeking Attention", "Avoiding Work", "Hunger/Fatigue", "Sensory Overload",
  "Frustration", "Unknown",
];

const INTERVENTIONS = [
  "Verbal Reminder", "Redirection", "Proximity", "Nonverbal Cue",
  "Choice Provided", "Task Broken Into Smaller Steps", "Additional Instruction",
  "Break Offered", "Calm-Down Space", "Seat Change", "Private Conference",
  "Restorative Conversation", "Behavior Reflection", "Positive Reinforcement",
  "Parent Contact", "Counselor Support", "Administrator Support",
  "Removal from Activity", "Safety Procedure",
];

const STUDENT_RESPONSES = [
  "Behavior Stopped", "Behavior Decreased", "Behavior Continued", "Behavior Escalated",
  "Accepted Redirection", "Refused Intervention", "Completed Work", "Returned to Activity",
  "Used Coping Strategy", "Repaired Harm", "Needed Additional Support", "Unknown",
];

const OUTCOMES = [
  "Resolved in Classroom", "Returned to Instruction", "Work Completed",
  "Break Completed", "Parent Contacted", "Counselor Contacted", "Administrator Contacted",
  "Referral Created", "Removed from Setting", "Safety Support Requested",
  "Follow-Up Required", "No Resolution Recorded",
];

const CONTACT_STATUSES = [
  { value: "not_contacted", label: "Not Contacted" },
  { value: "contacted", label: "Contacted" },
  { value: "voicemail", label: "Voicemail Left" },
  { value: "email_sent", label: "Message Sent" },
  { value: "letter_sent", label: "Letter Sent" },
];

const DOC_STATUSES = [
  { value: "not_required", label: "Not Required" },
  { value: "required_pending", label: "Required — Pending" },
  { value: "completed", label: "Completed" },
  { value: "needs_clarification", label: "Needs Clarification" },
];

const FREQUENCY_OPTIONS = ["Once", "2-3 times", "Repeated", "Throughout period"];

// ─── localStorage helpers ────────────────────────────────────────────

function loadDefaults(): Partial<EntryData> {
  try {
    const raw = localStorage.getItem("bt-defaults");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDefaults(form: EntryData) {
  const defaults: Partial<EntryData> = {
    subject_activity: form.subject_activity,
    location: form.location,
    staff_member: form.staff_member,
    entry_type: form.entry_type,
  };
  localStorage.setItem("bt-defaults", JSON.stringify(defaults));
}

function loadDraft(): Partial<EntryData> | null {
  try {
    const raw = localStorage.getItem("bt-draft");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDraft(form: EntryData) {
  localStorage.setItem("bt-draft", JSON.stringify(form));
}

function clearDraft() {
  localStorage.removeItem("bt-draft");
}

// ─── Parse JSON array fields from API response ──────────────────────

function parseJsonArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return val ? val.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
    }
  }
  return [];
}

// ─── Chip Component ─────────────────────────────────────────────────

function ChipGroup({
  options,
  selected,
  onChange,
  multi = false,
  colorMap,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  multi?: boolean;
  colorMap?: Record<string, { color: string; bg: string; border: string }>;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");

  const toggle = (opt: string) => {
    if (multi) {
      if (selected.includes(opt)) {
        onChange(selected.filter((s) => s !== opt));
      } else {
        onChange([...selected, opt]);
      }
    } else {
      onChange(selected.includes(opt) ? [] : [opt]);
    }
  };

  const addCustom = () => {
    const trimmed = customValue.trim();
    if (trimmed && !selected.includes(trimmed)) {
      onChange([...selected, trimmed]);
    }
    setCustomValue("");
    setCustomOpen(false);
  };

  return (
    <div className="chip-group">
      {options.map((opt) => {
        const isSel = selected.includes(opt);
        const colors = colorMap?.[opt];
        return (
          <button
            key={opt}
            type="button"
            className={`chip${isSel ? " chip--selected" : ""}`}
            style={
              isSel && colors
                ? { backgroundColor: colors.bg, borderColor: colors.border, color: colors.color }
                : undefined
            }
            onClick={() => toggle(opt)}
          >
            {opt}
          </button>
        );
      })}
      {multi && (
        customOpen ? (
          <span className="chip-custom-input-wrapper">
            <input
              className="chip-custom-input"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
              placeholder="Custom..."
              autoFocus
              onBlur={() => { if (!customValue.trim()) setCustomOpen(false); }}
            />
            <button type="button" className="chip-custom-ok" onMouseDown={(e) => { e.preventDefault(); addCustom(); }}>✓</button>
          </span>
        ) : (
          <button
            type="button"
            className="chip chip--custom"
            onClick={() => setCustomOpen(true)}
          >
            + Custom
          </button>
        )
      )}
    </div>
  );
}

// ─── Type Chip (single-select, prominent) ───────────────────────────

function TypeChipGroup({
  options,
  selected,
  onChange,
}: {
  options: { value: string; label: string; color: string; bg: string; border: string }[];
  selected: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="type-chip-group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`type-chip${selected === opt.value ? " type-chip--selected" : ""}`}
          style={
            selected === opt.value
              ? { backgroundColor: opt.bg, borderColor: opt.border, color: opt.color, fontWeight: 600 }
              : undefined
          }
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Collapsible Section ────────────────────────────────────────────

function Collapsible({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="collapsible">
      <button type="button" className="collapsible__header" onClick={onToggle}>
        <span>{title}</span>
        <span className="collapsible__arrow" style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
      </button>
      {open && <div className="collapsible__body">{children}</div>}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export default function EntryForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [activeGoalsCount, setActiveGoalsCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  const [form, setForm] = useState<EntryData>(EMPTY_FORM);
  const studentDropdownRef = useRef<HTMLDivElement>(null);

  // Legacy token from Clerk bridge
  const { legacyToken: token } = useLegacyToken();

  // ─── Load students and optionally entry data ─────────────────────

  useEffect(() => {
    if (!token) return;
    fetch("/api/students?active=true", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setStudents(data.students || []))
      .catch(() => {});

    // Load goals on mount too for when student selected later
    if (id) {
      fetch(`/api/entries/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.entry) {
            const e = data.entry;
            const restored: EntryData = {
              student_id: String(e.student_id || ""),
              date: e.date || "",
              time: e.time || "",
              subject_activity: e.subject_activity || "",
              location: e.location || "",
              staff_member: e.staff_member || "",
              entry_type: e.entry_type || "",
              behavior_categories: parseJsonArray(e.behavior_categories),
              objective_observation: e.objective_observation || "",
              possible_triggers: parseJsonArray(e.possible_triggers),
              interventions: parseJsonArray(e.interventions),
              student_response: parseJsonArray(e.student_response),
              outcome: parseJsonArray(e.outcome),
              people_involved: e.people_involved || "",
              duration_minutes: String(e.duration_minutes || ""),
              frequency: e.frequency || "",
              property_damage: !!e.property_damage,
              injury: !!e.injury,
              parent_contact_status: e.parent_contact_status || "",
              admin_contact_status: e.admin_contact_status || "",
              counselor_contact_status: e.counselor_contact_status || "",
              follow_up_date: e.follow_up_date || "",
              additional_notes: e.additional_notes || "",
              confidential_notes: e.confidential_notes || "",
              doc_status: e.doc_status || "not_required",
              doc_completion_date: e.doc_completion_date || "",
              doc_system_name: e.doc_system_name || "",
              doc_reference_number: e.doc_reference_number || "",
              doc_note: e.doc_note || "",
            };
            setForm(restored);
            // Find and set student
            const s = students.find((st) => st.id === e.student_id);
            if (s) {
              setSelectedStudent(s);
              fetchGoals(s.id, token!);
            } else if (data.entry.student_name) {
              setSelectedStudent({
                id: e.student_id,
                display_name: data.entry.student_name,
                initials: data.entry.student_initials || "?",
                local_id: "",
                grade: "",
                classroom: "",
                active: 1,
              });
            }
          }
        })
        .catch(() => {});
    }
  }, [id, token]);

  // ─── When students load (for edit mode), match student ─────────

  useEffect(() => {
    if (isEditing && students.length > 0 && form.student_id && !selectedStudent && token) {
      const s = students.find((st) => st.id === Number(form.student_id));
      if (s) {
        setSelectedStudent(s);
        fetchGoals(s.id, token);
      }
    }
  }, [students, isEditing, form.student_id, token]);

  // ─── Apply defaults on first mount if not editing ──────────────

  useEffect(() => {
    if (!isEditing && !draftRestored) {
      const draft = loadDraft();
      if (draft) {
        setForm((prev) => ({ ...prev, ...draft }));
        if (draft.student_id && token) {
          const s = students.find((st) => st.id === Number(draft.student_id));
          if (s) {
            setSelectedStudent(s);
            fetchGoals(s.id, token);
          }
        }
        setDraftRestored(true);
      } else {
        const defaults = loadDefaults();
        if (Object.keys(defaults).length > 0) {
          setForm((prev) => ({ ...prev, ...defaults }));
        }
      }
    }
  }, [isEditing, draftRestored, students]);

  // ─── Auto-save draft (debounced) ───────────────────────────────

  const debouncedSaveDraft = useCallback((f: EntryData) => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      saveDraft(f);
    }, 500);
  }, []);

  useEffect(() => {
    if (!isEditing && !success) {
      debouncedSaveDraft(form);
    }
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [form, isEditing, success, debouncedSaveDraft]);

  // ─── Click-outside for student dropdown ─────────────────────────

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (studentDropdownRef.current && !studentDropdownRef.current.contains(e.target as Node)) {
        setShowStudentDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─── Fetch goals count ────────────────────────────────────────

  const fetchGoals = (studentId: number, token: string) => {
    fetch(`/api/goals?student_id=${studentId}&status=in_progress`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const goals = data.goals || [];
        setActiveGoalsCount(goals.length);
        // Also count improving
        return fetch(`/api/goals?student_id=${studentId}&status=improving`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      })
      .then((r) => r?.json())
      .then((data) => {
        if (data?.goals) {
          setActiveGoalsCount((prev) => prev + data.goals.length);
        }
      })
      .catch(() => {});
  };

  // ─── Filtered students ────────────────────────────────────────

  const filteredStudents = studentSearch
    ? students.filter(
        (s) =>
          s.display_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
          s.grade.includes(studentSearch) ||
          s.classroom.toLowerCase().includes(studentSearch.toLowerCase())
      )
    : students;

  // ─── Handlers ─────────────────────────────────────────────────

  const updateForm = (patch: Partial<EntryData>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const selectStudent = (s: Student) => {
    setSelectedStudent(s);
    updateForm({ student_id: String(s.id) });
    setStudentSearch("");
    setShowStudentDropdown(false);
    if (token) fetchGoals(s.id, token);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.student_id) {
      setError("Please select a student.");
      return;
    }
    setError("");
    setSubmitting(true);

    if (!token) {
      setError("Authentication error. Please try signing in again.");
      setSubmitting(false);
      return;
    }

    const url = isEditing ? `/api/entries/${id}` : "/api/entries";
    const method = isEditing ? "PUT" : "POST";

    try {
      const body: Record<string, unknown> = {
        student_id: Number(form.student_id),
        date: form.date,
        time: form.time,
        entry_type: form.entry_type,
        subject_activity: form.subject_activity,
        location: form.location,
        staff_member: form.staff_member,
        behavior_categories: form.behavior_categories,
        objective_observation: form.objective_observation,
        possible_triggers: form.possible_triggers,
        interventions: form.interventions,
        student_response: form.student_response,
        outcome: form.outcome,
        people_involved: form.people_involved,
        duration_minutes: Number(form.duration_minutes) || 0,
        frequency: form.frequency,
        property_damage: form.property_damage,
        injury: form.injury,
        parent_contact_status: form.parent_contact_status,
        admin_contact_status: form.admin_contact_status,
        counselor_contact_status: form.counselor_contact_status,
        follow_up_date: form.follow_up_date,
        additional_notes: form.additional_notes,
        confidential_notes: form.confidential_notes,
        doc_status: form.doc_status,
        doc_completion_date: form.doc_completion_date,
        doc_system_name: form.doc_system_name,
        doc_reference_number: form.doc_reference_number,
        doc_note: form.doc_note,
      };

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        // Save defaults for future
        saveDefaults(form);
        clearDraft();
        if (isEditing) {
          navigate("/dashboard", { replace: true });
        } else {
          setSuccess(true);
        }
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save entry. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setSubmitting(false);
  };

  const handleNewEntry = () => {
    setSuccess(false);
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10), time: new Date().toTimeString().slice(0, 5) });
    setSelectedStudent(null);
    setActiveGoalsCount(0);
    setError("");
    clearDraft();
    // Re-apply defaults
    const defaults = loadDefaults();
    if (Object.keys(defaults).length > 0) {
      setForm((prev) => ({ ...prev, ...defaults }));
    }
    window.scrollTo(0, 0);
  };

  // ─── Success screen ───────────────────────────────────────────

  if (success) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "var(--space-2xl) var(--space-md)" }}>
        <div style={{ fontSize: "3rem", marginBottom: "var(--space-md)", color: "var(--color-success)", display: "flex", justifyContent: "center" }}>
          <CheckCircle size={56} />
        </div>
        <h1 className="mb-sm">Entry Saved</h1>
        <p className="text-muted mb-lg">
          Your observation has been recorded successfully.
        </p>
        <div className="alert alert--info mb-lg" style={{ textAlign: "left" }}>
          <strong>Reminder:</strong> Enter any required behavior, intervention, parent contact,
          referral, or disciplinary documentation into your district&apos;s official LMS, student
          information system, discipline platform, IEP system, or other approved record system.
        </div>
        <div className="flex gap-md justify-center">
          <button className="btn btn--primary btn--lg" onClick={handleNewEntry}>
            Add Another Entry
          </button>
          {selectedStudent && (
            <button
              className="btn btn--secondary btn--lg"
              onClick={() => navigate(`/students/${selectedStudent.id}`)}
            >
              View Student Profile
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── Render Form ──────────────────────────────────────────────

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: ENTRY_FORM_STYLES }} />
      <h1 className="mb-sm">{isEditing ? "Edit Entry" : "Quick Entry"}</h1>
      <p className="text-sm text-muted mb-md">
        Record a behavior observation in under 30 seconds. Use neutral, objective language.
      </p>

      {error && <div className="alert alert--error">{error}</div>}

      <form onSubmit={handleSubmit} noValidate>
        {/* ── 1. Student Selection ─────────────────────────────── */}
        <section className="card">
          <h2 className="card__title mb-sm">1. Student</h2>
          <div ref={studentDropdownRef} style={{ position: "relative" }}>
            {!selectedStudent ? (
              <>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Search by name, grade, or classroom..."
                  value={studentSearch}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    setShowStudentDropdown(true);
                  }}
                  onFocus={() => setShowStudentDropdown(true)}
                />
                {showStudentDropdown && (
                  <div className="student-dropdown">
                    {filteredStudents.length === 0 ? (
                      <div className="student-dropdown__empty">No students found</div>
                    ) : (
                      filteredStudents.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="student-dropdown__item"
                          onClick={() => selectStudent(s)}
                        >
                          <span className="student-avatar">{s.initials}</span>
                          <span className="student-info">
                            <strong>{s.display_name}</strong>
                            <span className="text-sm text-muted">
                              Grade {s.grade} &middot; {s.classroom}
                            </span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="student-card">
                <div className="flex items-center gap-md">
                  <span className="student-avatar student-avatar--lg">{selectedStudent.initials}</span>
                  <div>
                    <strong style={{ fontSize: "1.05rem" }}>{selectedStudent.display_name}</strong>
                    <div className="text-sm text-muted">
                      Grade {selectedStudent.grade} &middot; {selectedStudent.classroom}
                      {activeGoalsCount > 0 && (
                        <span className="badge badge--neutral" style={{ marginLeft: "var(--space-sm)" }}>
                          {activeGoalsCount} active goal{activeGoalsCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    style={{ marginLeft: "auto" }}
                    onClick={() => {
                      setSelectedStudent(null);
                      updateForm({ student_id: "" });
                    }}
                  >
                    Change
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── 2. Incident Basics ──────────────────────────────── */}
        <section className="card">
          <h2 className="card__title mb-sm">2. Incident Basics</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
            <div className="form-group">
              <label className="form-label" htmlFor="date">Date</label>
              <input id="date" className="form-input" type="date" value={form.date} onChange={(e) => updateForm({ date: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="time">Time</label>
              <input id="time" className="form-input" type="time" value={form.time} onChange={(e) => updateForm({ time: e.target.value })} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="subject">Subject / Activity</label>
            <select id="subject" className="form-select" value={form.subject_activity} onChange={(e) => updateForm({ subject_activity: e.target.value })}>
              <option value="">Select...</option>
              {SUBJECT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="location">Location</label>
            <select id="location" className="form-select" value={form.location} onChange={(e) => updateForm({ location: e.target.value })}>
              <option value="">Select...</option>
              {LOCATION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="staff">Staff Member</label>
            <input id="staff" className="form-input" value={form.staff_member} onChange={(e) => updateForm({ staff_member: e.target.value })} placeholder="e.g., Ms. Rodriguez" />
          </div>
        </section>

        {/* ── 3. Entry Type ───────────────────────────────────── */}
        <section className="card">
          <h2 className="card__title mb-sm">3. Entry Type</h2>
          <TypeChipGroup options={ENTRY_TYPES} selected={form.entry_type} onChange={(v) => updateForm({ entry_type: v })} />
        </section>

        {/* ── 4. Behavior Categories ──────────────────────────── */}
        <section className="card">
          <h2 className="card__title mb-sm">4. Behavior Categories</h2>
          <p className="text-sm text-muted mb-sm">Corrective behaviors:</p>
          <ChipGroup options={BEHAVIOR_CORRECTIVE} selected={form.behavior_categories} onChange={(v) => updateForm({ behavior_categories: v })} multi />
          <p className="text-sm text-muted mb-sm mt-md">Positive behaviors:</p>
          <ChipGroup options={BEHAVIOR_POSITIVE} selected={form.behavior_categories} onChange={(v) => updateForm({ behavior_categories: v })} multi />
        </section>

        {/* ── 5. Objective Observation ────────────────────────── */}
        <section className="card">
          <h2 className="card__title mb-sm">5. Objective Observation</h2>
          <div className="form-group">
            <label className="form-label" htmlFor="observation">What was directly observed?</label>
            <p className="text-sm text-muted mb-sm">
              Describe only what was seen or heard. Avoid labels, diagnoses, assumptions, or conclusions.
            </p>
            <textarea
              id="observation"
              className="form-textarea"
              value={form.objective_observation}
              onChange={(e) => updateForm({ objective_observation: e.target.value })}
              placeholder="Student pushed the worksheet away, placed their head on the desk, and said, 'I'm not doing this.'"
              rows={4}
            />
          </div>
        </section>

        {/* ── 6. Possible Triggers ────────────────────────────── */}
        <section className="card">
          <h2 className="card__title mb-sm">6. Possible Triggers</h2>
          <p className="text-sm text-muted mb-sm">Not proven causes — select all that may apply:</p>
          <ChipGroup options={POSSIBLE_TRIGGERS} selected={form.possible_triggers} onChange={(v) => updateForm({ possible_triggers: v })} multi />
        </section>

        {/* ── 7. Interventions ────────────────────────────────── */}
        <section className="card">
          <h2 className="card__title mb-sm">7. Interventions</h2>
          <ChipGroup options={INTERVENTIONS} selected={form.interventions} onChange={(v) => updateForm({ interventions: v })} multi />
        </section>

        {/* ── 8. Student Response ─────────────────────────────── */}
        <section className="card">
          <h2 className="card__title mb-sm">8. Student Response</h2>
          <ChipGroup options={STUDENT_RESPONSES} selected={form.student_response} onChange={(v) => updateForm({ student_response: v })} multi />
        </section>

        {/* ── 9. Outcome ──────────────────────────────────────── */}
        <section className="card">
          <h2 className="card__title mb-sm">9. Outcome</h2>
          <ChipGroup options={OUTCOMES} selected={form.outcome} onChange={(v) => updateForm({ outcome: v })} multi />
        </section>

        {/* ── 10. Additional Details ──────────────────────────── */}
        <Collapsible title="10. Additional Details" open={extraOpen} onToggle={() => setExtraOpen(!extraOpen)}>
          <div className="form-group">
            <label className="form-label" htmlFor="people">People Involved</label>
            <input id="people" className="form-input" value={form.people_involved} onChange={(e) => updateForm({ people_involved: e.target.value })} placeholder="e.g., peer, aide, specialist" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
            <div className="form-group">
              <label className="form-label" htmlFor="duration">Duration (minutes)</label>
              <input id="duration" className="form-input" type="number" min="0" value={form.duration_minutes} onChange={(e) => updateForm({ duration_minutes: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="frequency">Frequency</label>
              <select id="frequency" className="form-select" value={form.frequency} onChange={(e) => updateForm({ frequency: e.target.value })}>
                <option value="">Select...</option>
                {FREQUENCY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-md flex-wrap mb-md">
            <label className="chip" style={{ cursor: "pointer", backgroundColor: form.property_damage ? "var(--color-warning-bg)" : undefined, borderColor: form.property_damage ? "#f0d9b0" : undefined }}>
              <input type="checkbox" checked={form.property_damage} onChange={(e) => updateForm({ property_damage: e.target.checked })} style={{ marginRight: 6 }} />
              Property Damage
            </label>
            <label className="chip" style={{ cursor: "pointer", backgroundColor: form.injury ? "var(--color-danger-bg)" : undefined, borderColor: form.injury ? "#f0c5c5" : undefined }}>
              <input type="checkbox" checked={form.injury} onChange={(e) => updateForm({ injury: e.target.checked })} style={{ marginRight: 6 }} />
              Injury
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
            <div className="form-group">
              <label className="form-label" htmlFor="parent_contact">Parent Contact</label>
              <select id="parent_contact" className="form-select" value={form.parent_contact_status} onChange={(e) => updateForm({ parent_contact_status: e.target.value })}>
                <option value="">Not Contacted</option>
                {CONTACT_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="admin_contact">Admin Contact</label>
              <select id="admin_contact" className="form-select" value={form.admin_contact_status} onChange={(e) => updateForm({ admin_contact_status: e.target.value })}>
                <option value="">Not Contacted</option>
                {CONTACT_STATUSES.filter((c) => c.value !== "letter_sent").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
            <div className="form-group">
              <label className="form-label" htmlFor="counselor_contact">Counselor Contact</label>
              <select id="counselor_contact" className="form-select" value={form.counselor_contact_status} onChange={(e) => updateForm({ counselor_contact_status: e.target.value })}>
                <option value="">Not Contacted</option>
                {CONTACT_STATUSES.filter((c) => c.value !== "letter_sent").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="follow_up">Follow-up Date</label>
              <input id="follow_up" className="form-input" type="date" value={form.follow_up_date} onChange={(e) => updateForm({ follow_up_date: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="add_notes">Additional Objective Notes</label>
            <textarea id="add_notes" className="form-textarea" value={form.additional_notes} onChange={(e) => updateForm({ additional_notes: e.target.value })} rows={3} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="conf_notes">Confidential Teacher Note</label>
            <p className="text-sm text-muted mb-sm">
              <AlertTriangle size={14} style={{ display: "inline", marginRight: 4 }} /> This note stays private and is never included in official documentation summaries.
            </p>
            <textarea id="conf_notes" className="form-textarea" value={form.confidential_notes} onChange={(e) => updateForm({ confidential_notes: e.target.value })} rows={3} />
          </div>
        </Collapsible>

        {/* ── 11. Official Documentation ─────────────────────── */}
        <section className="card">
          <h2 className="card__title mb-sm">11. Official Documentation</h2>
          <div className="alert alert--info mb-md">
            <strong>Reminder:</strong> Enter any required behavior, intervention, parent contact, referral,
            or disciplinary documentation into your district&apos;s official LMS, student information system,
            discipline platform, IEP system, or other approved record system.
          </div>

          <div className="form-group">
            <label className="form-label">Documentation Required?</label>
            <div className="flex flex-wrap gap-sm">
              {DOC_STATUSES.map((ds) => (
                <label
                  key={ds.value}
                  className={`chip${form.doc_status === ds.value ? " chip--selected" : ""}`}
                  style={{ cursor: "pointer" }}
                >
                  <input
                    type="radio"
                    name="doc_status"
                    value={ds.value}
                    checked={form.doc_status === ds.value}
                    onChange={(e) => updateForm({ doc_status: e.target.value })}
                    style={{ marginRight: 4 }}
                  />
                  {ds.label}
                </label>
              ))}
            </div>
          </div>

          {form.doc_status === "completed" && (
            <div className="card" style={{ backgroundColor: "var(--color-gray-50)", border: "1px solid var(--color-gray-200)" }}>
              <h3 className="card__title mb-sm">Documentation Details</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="doc_date">Completion Date</label>
                  <input id="doc_date" className="form-input" type="date" value={form.doc_completion_date} onChange={(e) => updateForm({ doc_completion_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="doc_system">District System</label>
                  <input id="doc_system" className="form-input" value={form.doc_system_name} onChange={(e) => updateForm({ doc_system_name: e.target.value })} placeholder="e.g., PowerSchool, Skyward" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="doc_ref">Reference Number</label>
                  <input id="doc_ref" className="form-input" value={form.doc_reference_number} onChange={(e) => updateForm({ doc_reference_number: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="doc_note">Note</label>
                  <input id="doc_note" className="form-input" value={form.doc_note} onChange={(e) => updateForm({ doc_note: e.target.value })} />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── Submit ─────────────────────────────────────────── */}
        <div className="flex gap-md mt-md mb-lg">
          <button type="submit" className="btn btn--primary btn--lg flex-1" disabled={submitting}>
            {submitting ? "Saving..." : isEditing ? "Update Entry" : "Save Entry"}
          </button>
          <button type="button" className="btn btn--ghost btn--lg" onClick={() => navigate(-1)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

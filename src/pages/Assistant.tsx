import { useState, useCallback, useRef } from "react";
import { Copy, Check } from "lucide-react";

/* ── Types ─────────────────────────────────────────── */
type ToastMessage = { text: string; id: number };

/* ── Helpers ────────────────────────────────────────── */
let toastId = 0;
function nextToastId() {
  return ++toastId;
}

function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
  return Promise.resolve();
}

/* ── Transform helpers ──────────────────────────────── */

const EMOTIONAL_WORDS = /\b(always|never|constantly|terrible|awful|worst|best|amazing|finally|still won['’]t|refuses to|bad attitude|being lazy|so lazy|so rude|so disrespectful|so defiant|incredibly|horrible|horrendous|pathetic|hopeless|impossible|unbearable|obnoxious|infuriating|disgusting)\b/gi;

const LABEL_WORDS = /\b(lazy|bad|defiant|aggressive|disrespectful|rude|mean|naughty|troublemaker|bully|problem child|difficult child|attention seeker|manipulative|loudmouth|smart aleck|know-it-all|slacker|troubled|unmotivated|lacking motivation|lazy student)\b/gi;

function rewriteObjectively(text: string): string {
  let result = text;

  // Remove label words, replacing with empty string or observable placeholder
  result = result.replace(LABEL_WORDS, "");

  // Replace emotional/frequency extremes
  result = result.replace(/\balways\b/gi, "repeatedly");
  result = result.replace(/\bnever\b/gi, "has not yet");
  result = result.replace(/\bconstantly\b/gi, "frequently");
  result = result.replace(/\brefuses to\b/gi, "did not");
  result = result.replace(/\bstill won['']t\b/gi, "continues not to");
  result = result.replace(/\bbad attitude\b/gi, "");
  result = result.replace(/\bbeing lazy\b/gi, "not engaged in the task");
  result = result.replace(/\bso lazy\b/gi, "not engaged in the task");
  result = result.replace(/\bso rude\b/gi, "");
  result = result.replace(/\bso disrespectful\b/gi, "");
  result = result.replace(/\bso defiant\b/gi, "");
  result = result.replace(/\bterrible\b/gi, "challenging");
  result = result.replace(/\bawful\b/gi, "difficult");
  result = result.replace(/\bhorrible\b/gi, "difficult");
  result = result.replace(/\bhorrendous\b/gi, "difficult");

  // Clean up double spaces and spaces before punctuation
  result = result.replace(/\s{2,}/g, " ");
  result = result.replace(/\s+([.,;:!?])/g, "$1");
  result = result.replace(/\s+$/g, "");
  result = result.replace(/^\s+/g, "");

  // If after all replacements the text is very short or empty, keep original but flag
  if (result.trim().length < 10 && text.trim().length > 10) {
    result = "[Could not fully process — please review manually]\n" + text;
  }

  return result;
}

function removeEmotionalLanguage(text: string): string {
  let result = text;

  // Replace emotional extremes
  result = result.replace(/\balways\b/gi, "each time observed");
  result = result.replace(/\bnever\b/gi, "has not");
  result = result.replace(/\bconstantly\b/gi, "on several occasions");
  result = result.replace(/\bterrible\b/gi, "");
  result = result.replace(/\bawful\b/gi, "");
  result = result.replace(/\bworst\b/gi, "");
  result = result.replace(/\bbest\b/gi, "");
  result = result.replace(/\bamazing\b/gi, "");
  result = result.replace(/\bfinally\b/gi, "");
  result = result.replace(/\bstill won['']t\b/gi, "has not yet");
  result = result.replace(/\brefuses to\b/gi, "does not");

  // Clean up
  result = result.replace(/\s{2,}/g, " ");
  result = result.replace(/\s+([.,;:!?])/g, "$1");
  result = result.trim();

  return result || text;
}

interface Separated {
  observed: string[];
  assumptions: string[];
}

const ASSUMPTION_TRIGGERS = [
  /\bseems?\b/i,
  /\bappears?\b/i,
  /\b(looked|looks) like\b/i,
  /\b(must|could|might|may|probably|possibly|likely)\b/i,
  /\bthink\b/i,
  /\bbelieve\b/i,
  /\bfeels?\b/i,
  /\bwanted\b/i,
  /\bintended\b/i,
  /\btrying to\b/i,
  /\bpurposely\b/i,
  /\bon purpose\b/i,
  /\battention\b/i,
  /\bjust wants?\b/i,
  /\b(angry|upset|frustrated|sad|scared|anxious|bored|excited)\b/i,
  /\bdoesn['']?t care\b/i,
  /\bdon['']?t care\b/i,
  /\b(not)? trying\b/i,
  /\blazy\b/i,
  /\bdefiant\b/i,
  /\bmanipulative\b/i,
  /\bdisrespectful\b/i,
];

const OBSERVABLE_TRIGGERS = [
  /\bsaid\b/i,
  /\bwrote\b/i,
  /\bdid\b/i,
  /\bwalked\b/i,
  /\bstood\b/i,
  /\bsat\b/i,
  /\braised\b/i,
  /\bcalled\b/i,
  /\banswered\b/i,
  /\bcompleted\b/i,
  /\bturned in\b/i,
  /\bhanded\b/i,
  /\bleft\b/i,
  /\bentered\b/i,
  /\btimes\b/i,
  /\bminutes\b/i,
  /\bseconds\b/i,
  /\bwhen\b/i,
  /\bduring\b/i,
  /\bafter\b/i,
  /\bbefore\b/i,
  /\btold\b/i,
  /\basked\b/i,
  /\bresponded\b/i,
];

function separateObservations(text: string): Separated {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0);

  const observed: string[] = [];
  const assumptions: string[] = [];

  for (const sentence of sentences) {
    const isAssumption = ASSUMPTION_TRIGGERS.some((t) => t.test(sentence));
    const isObservable = OBSERVABLE_TRIGGERS.some((t) => t.test(sentence));

    if (isAssumption && !isObservable) {
      assumptions.push(sentence.trim());
    } else if (isObservable && !isAssumption) {
      observed.push(sentence.trim());
    } else if (isAssumption && isObservable) {
      // Has both signals — put in assumptions flagged for review
      assumptions.push(sentence.trim());
    } else {
      // No clear signal — lean toward observed if it has concrete details
      const hasConcrete =
        /\d+/.test(sentence) || /\b(AM|PM|am|pm)\b/.test(sentence);
      if (hasConcrete) {
        observed.push(sentence.trim());
      } else {
        assumptions.push(sentence.trim());
      }
    }
  }

  return { observed, assumptions };
}

function generateParentNote(
  student: string,
  summary: string,
  agreed: string,
  tone: string
): string {
  const studentName = student || "[Student]";
  const lines: string[] = [];

  lines.push(`Dear Parent/Guardian,`);
  lines.push("");
  lines.push(
    `I wanted to share an update about ${studentName}'s day today.`
  );
  lines.push("");

  if (summary.trim()) {
    lines.push(`During class, ${summary.trim()}.`);
    lines.push("");
  }

  if (tone === "collaborative") {
    if (agreed.trim()) {
      lines.push(
        `We discussed ways to support ${studentName} and agreed to ${agreed.trim()}.`
      );
    } else {
      lines.push(
        `We discussed ways to support ${studentName} in the classroom.`
      );
    }
  } else if (tone === "informational") {
    lines.push(
      `This is for your awareness. No action is needed at this time.`
    );
  } else if (tone === "follow-up") {
    lines.push(
      `I would appreciate the opportunity to discuss this further. Please let me know a convenient time to connect.`
    );
  }

  lines.push("");
  lines.push(
    `Thank you for your partnership in supporting ${studentName}'s success.`
  );
  lines.push("");
  lines.push(`Best,`);
  lines.push(`[Teacher name]`);

  return lines.join("\n");
}

function generateMeetingSummary(data: {
  student: string;
  meetingType: string;
  discussion: string;
  decisions: string;
  actionItems: string;
  followUp: string;
}): string {
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const lines: string[] = [];

  lines.push(`MEETING SUMMARY`);
  lines.push(`===============`);
  lines.push("");
  lines.push(`Student: ${data.student || "[Student]"}`);
  lines.push(`Meeting Type: ${data.meetingType || "[Type]"}`);
  lines.push(`Date: ${today}`);
  lines.push("");

  if (data.discussion.trim()) {
    lines.push("DISCUSSION POINTS");
    lines.push("-----------------");
    const points = data.discussion
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => l.trim());
    for (const p of points) {
      lines.push(`• ${p}`);
    }
    lines.push("");
  }

  if (data.decisions.trim()) {
    lines.push("DECISIONS MADE");
    lines.push("--------------");
    lines.push(data.decisions.trim());
    lines.push("");
  }

  if (data.actionItems.trim()) {
    lines.push("ACTION ITEMS");
    lines.push("------------");
    const items = data.actionItems
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => l.trim());
    for (const item of items) {
      lines.push(`• ${item}`);
    }
    lines.push("");
  }

  if (data.followUp.trim()) {
    lines.push(`Follow-up Date: ${data.followUp.trim()}`);
  }

  return lines.join("\n");
}

/* ── Tool Card Wrapper ─────────────────────────────── */
function ToolCard({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card" id={id} style={{ scrollMarginTop: "80px" }}>
      <div className="card__body">
        <h3 className="mb-sm" style={{ fontSize: "1.05rem" }}>
          {title}
        </h3>
        <p className="text-sm text-muted mb-md">{description}</p>
        {children}
      </div>
    </div>
  );
}

/* ── Disclaimer ────────────────────────────────────── */
const Disclaimer = () => (
  <div
    className="alert alert--demo"
    style={{
      fontSize: "0.75rem",
      marginTop: "var(--space-md)",
      marginBottom: 0,
    }}
  >
    <strong>Please note:</strong> Review all generated text before using it in an
    official record. The educator remains responsible for accuracy and compliance
    with district policy. This tool does not provide legal, medical,
    psychological, or diagnostic advice.
  </div>
);

/* ── Copy Button ───────────────────────────────────── */
function CopyButton({
  text,
  onCopy,
}: {
  text: string;
  onCopy: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    copyToClipboard(text).then(() => {
      setCopied(true);
      onCopy();
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text, onCopy]);

  return (
    <button
      className={`btn btn--sm ${copied ? "btn--success" : "btn--secondary"}`}
      onClick={handleCopy}
      style={{ marginTop: "var(--space-sm)" }}
    >
      {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
    </button>
  );
}

/* ── Rules Info Box ────────────────────────────────── */
function RulesBox({ rules }: { rules: string[] }) {
  return (
    <div
      className="alert alert--info"
      style={{
        fontSize: "0.8rem",
        padding: "var(--space-sm) var(--space-md)",
        marginBottom: "var(--space-md)",
      }}
    >
      <strong style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Rules applied:
      </strong>
      <ul style={{ margin: "var(--space-xs) 0 0 var(--space-md)", lineHeight: 1.6 }}>
        {rules.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </div>
  );
}

/* ── Collapsible Example ───────────────────────────── */
function CollapsibleExample({
  input,
  output,
}: {
  input: string;
  output: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginBottom: "var(--space-sm)" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "none",
          border: "none",
          color: "var(--color-primary)",
          cursor: "pointer",
          fontSize: "0.85rem",
          fontWeight: 500,
          padding: 0,
          fontFamily: "var(--font-sans)",
        }}
      >
        {open ? "▾ Hide example" : "▸ See example"}
      </button>
      {open && (
        <div
          style={{
            marginTop: "var(--space-sm)",
            padding: "var(--space-md)",
            background: "var(--color-gray-50)",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.85rem",
            border: "1px solid var(--color-gray-200)",
          }}
        >
          <div style={{ marginBottom: "var(--space-sm)" }}>
            <strong style={{ color: "var(--color-gray-600)" }}>Input:</strong>
            <p style={{ margin: "var(--space-xs) 0 0 0", color: "var(--color-gray-700)" }}>
              {input}
            </p>
          </div>
          <div>
            <strong style={{ color: "var(--color-success)" }}>Output:</strong>
            <p style={{ margin: "var(--space-xs) 0 0 0", color: "var(--color-gray-700)" }}>
              {output}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Output Area ───────────────────────────────────── */
function OutputArea({
  text,
  onCopy,
}: {
  text: string;
  onCopy: () => void;
}) {
  if (!text) return null;

  return (
    <div
      style={{
        marginTop: "var(--space-md)",
        padding: "var(--space-md)",
        background: "#f7faf7",
        border: "1px solid #c5e5cc",
        borderRadius: "var(--radius-md)",
        whiteSpace: "pre-wrap",
        fontSize: "0.9rem",
        lineHeight: 1.7,
        color: "var(--color-gray-800)",
        position: "relative",
      }}
    >
      <div
        style={{
          fontSize: "0.7rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--color-success)",
          marginBottom: "var(--space-sm)",
        }}
      >
        Generated output
      </div>
      {text}
      <CopyButton text={text} onCopy={onCopy} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════════════ */
export default function Assistant() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((msg: string) => {
    const id = nextToastId();
    setToasts((prev) => [...prev, { text: msg, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  }, []);

  /* ── Tool 1: Rewrite Objectively ─────────────────── */
  const [t1Input, setT1Input] = useState("");
  const [t1Output, setT1Output] = useState("");

  const handleRewrite = () => {
    if (!t1Input.trim()) return;
    setT1Output(rewriteObjectively(t1Input.trim()));
  };

  /* ── Tool 2: Remove Emotional Language ────────────── */
  const [t2Input, setT2Input] = useState("");
  const [t2Output, setT2Output] = useState("");

  const handleRemoveEmotional = () => {
    if (!t2Input.trim()) return;
    setT2Output(removeEmotionalLanguage(t2Input.trim()));
  };

  /* ── Tool 3: Separate Observations ────────────────── */
  const [t3Input, setT3Input] = useState("");
  const [t3Observed, setT3Observed] = useState<string[]>([]);
  const [t3Assumptions, setT3Assumptions] = useState<string[]>([]);

  const handleSeparate = () => {
    if (!t3Input.trim()) return;
    const { observed, assumptions } = separateObservations(t3Input.trim());
    setT3Observed(observed);
    setT3Assumptions(assumptions);
  };

  /* ── Tool 4: Parent Contact Note ──────────────────── */
  const [t4Student, setT4Student] = useState("");
  const [t4Summary, setT4Summary] = useState("");
  const [t4Agreed, setT4Agreed] = useState("");
  const [t4Tone, setT4Tone] = useState("collaborative");
  const [t4Output, setT4Output] = useState("");

  const handleParentNote = () => {
    setT4Output(generateParentNote(t4Student, t4Summary, t4Agreed, t4Tone));
  };

  /* ── Tool 5: Meeting Summary ──────────────────────── */
  const [t5Student, setT5Student] = useState("");
  const [t5MeetingType, setT5MeetingType] = useState("");
  const [t5Discussion, setT5Discussion] = useState("");
  const [t5Decisions, setT5Decisions] = useState("");
  const [t5ActionItems, setT5ActionItems] = useState("");
  const [t5FollowUp, setT5FollowUp] = useState("");
  const [t5Output, setT5Output] = useState("");

  const handleMeetingSummary = () => {
    setT5Output(
      generateMeetingSummary({
        student: t5Student,
        meetingType: t5MeetingType,
        discussion: t5Discussion,
        decisions: t5Decisions,
        actionItems: t5ActionItems,
        followUp: t5FollowUp,
      })
    );
  };

  /* ── Render ───────────────────────────────────────── */
  return (
    <div>
      {/* Toast container */}
      {toasts.length > 0 && (
        <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", zIndex: 2000, display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          {toasts.map((t) => (
            <div key={t.id} className="toast">
              {t.text}
            </div>
          ))}
        </div>
      )}

      <h1 className="mb-sm">Writing Assistant</h1>
      <p className="text-muted mb-lg" style={{ fontSize: "0.9rem" }}>
        Transform your notes into objective, professional documentation. Review all
        generated text before using it in an official record.
      </p>

      {/* ─── Tool 1: Rewrite Notes Objectively ────────── */}
      <ToolCard
        id="tool-rewrite"
        title="1. Rewrite Notes Objectively"
        description="Takes a raw observation and removes emotional or judgmental language."
      >
        <RulesBox
          rules={[
            "Removes labels like 'lazy,' 'bad,' 'defiant,' 'aggressive'",
            "Replaces with observable descriptions",
            "Keeps all factual details",
            "Uses neutral tone",
          ]}
        />
        <CollapsibleExample
          input="John was being lazy and refused to do his math worksheet. He just sat there with a bad attitude."
          output="John remained seated without beginning his math worksheet. When prompted, he did not start the assigned task."
        />

        <div className="form-group">
          <textarea
            className="form-textarea"
            rows={4}
            placeholder="Enter your raw observation notes..."
            value={t1Input}
            onChange={(e) => setT1Input(e.target.value)}
          />
        </div>
        <button
          className="btn btn--primary"
          onClick={handleRewrite}
          disabled={!t1Input.trim()}
        >
          Rewrite Objectively
        </button>

        <OutputArea text={t1Output} onCopy={() => showToast("Copied!")} />
        <Disclaimer />
      </ToolCard>

      {/* ─── Tool 2: Remove Emotional Language ────────── */}
      <ToolCard
        id="tool-emotional"
        title="2. Remove Emotional Language"
        description="Strips emotional words while preserving all facts."
      >
        <RulesBox
          rules={[
            'Removes words like "always," "never," "constantly," "terrible," "awful," "worst," "best," "amazing," "finally," "still won\'t," "refuses to"',
            'Replaces with specific frequencies: "three times," "during today\'s lesson," "has not yet"',
          ]}
        />

        <div className="form-group">
          <textarea
            className="form-textarea"
            rows={4}
            placeholder="Enter text to review..."
            value={t2Input}
            onChange={(e) => setT2Input(e.target.value)}
          />
        </div>
        <button
          className="btn btn--primary"
          onClick={handleRemoveEmotional}
          disabled={!t2Input.trim()}
        >
          Remove Emotional Language
        </button>

        <OutputArea text={t2Output} onCopy={() => showToast("Copied!")} />
        <Disclaimer />
      </ToolCard>

      {/* ─── Tool 3: Separate Observations from Assumptions ─── */}
      <ToolCard
        id="tool-separate"
        title="3. Separate Observations from Assumptions"
        description="Splits text into two columns — objective facts vs. possible interpretations."
      >
        <RulesBox
          rules={[
            "Observable: what was seen/heard, specific actions, quotes, times, frequencies",
            "Assumptions: motivations, feelings, intentions, labels, predictions",
          ]}
        />

        <div className="form-group">
          <textarea
            className="form-textarea"
            rows={5}
            placeholder="Enter your complete notes..."
            value={t3Input}
            onChange={(e) => setT3Input(e.target.value)}
          />
        </div>
        <button
          className="btn btn--primary"
          onClick={handleSeparate}
          disabled={!t3Input.trim()}
        >
          Separate
        </button>

        {(t3Observed.length > 0 || t3Assumptions.length > 0) && (
          <div
            style={{
              marginTop: "var(--space-md)",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--space-md)",
            }}
            className="separate-columns"
          >
            {/* Observed Facts */}
            <div
              style={{
                padding: "var(--space-md)",
                background: "#f7faf7",
                border: "1px solid #c5e5cc",
                borderRadius: "var(--radius-md)",
              }}
            >
              <div
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--color-success)",
                  marginBottom: "var(--space-sm)",
                }}
              >
                Observed Facts
              </div>
              {t3Observed.length === 0 ? (
                <p className="text-sm text-muted">
                  No clearly observable statements detected.
                </p>
              ) : (
                <ul style={{ paddingLeft: "var(--space-lg)", lineHeight: 1.7, fontSize: "0.88rem", color: "var(--color-gray-800)" }}>
                  {t3Observed.map((s, i) => (
                    <li key={i} style={{ marginBottom: "var(--space-xs)" }}>
                      {s}
                    </li>
                  ))}
                </ul>
              )}
              <CopyButton
                text={
                  t3Observed.length > 0
                    ? t3Observed.join("\n")
                    : "(No observed facts detected)"
                }
                onCopy={() => showToast("Observed facts copied!")}
              />
            </div>

            {/* Assumptions */}
            <div
              style={{
                padding: "var(--space-md)",
                background: "#fef9f0",
                border: "1px solid #f0d9b0",
                borderRadius: "var(--radius-md)",
              }}
            >
              <div
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--color-warning)",
                  marginBottom: "var(--space-sm)",
                }}
              >
                Assumptions / Interpretations
              </div>
              <div
                className="alert alert--warning"
                style={{
                  fontSize: "0.72rem",
                  padding: "var(--space-xs) var(--space-sm)",
                  marginBottom: "var(--space-sm)",
                }}
              >
                Review before including in official records.
              </div>
              {t3Assumptions.length === 0 ? (
                <p className="text-sm text-muted">
                  No assumptions detected.
                </p>
              ) : (
                <ul style={{ paddingLeft: "var(--space-lg)", lineHeight: 1.7, fontSize: "0.88rem", color: "var(--color-gray-800)" }}>
                  {t3Assumptions.map((s, i) => (
                    <li key={i} style={{ marginBottom: "var(--space-xs)" }}>
                      {s}
                    </li>
                  ))}
                </ul>
              )}
              <CopyButton
                text={
                  t3Assumptions.length > 0
                    ? t3Assumptions.join("\n")
                    : "(No assumptions detected)"
                }
                onCopy={() => showToast("Assumptions copied!")}
              />
            </div>
          </div>
        )}
        <Disclaimer />
      </ToolCard>

      {/* ─── Tool 4: Create Parent Contact Note ───────── */}
      <ToolCard
        id="tool-parent"
        title="4. Create Parent Contact Note"
        description="Generates a professional parent communication summary."
      >
        <div className="form-group">
          <label className="form-label" htmlFor="t4-student">
            Student name
          </label>
          <input
            id="t4-student"
            className="form-input"
            type="text"
            placeholder="Enter student name..."
            value={t4Student}
            onChange={(e) => setT4Student(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="t4-summary">
            Behavior summary
          </label>
          <textarea
            id="t4-summary"
            className="form-textarea"
            rows={3}
            placeholder="Brief, objective description of what occurred..."
            value={t4Summary}
            onChange={(e) => setT4Summary(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="t4-agreed">
            What was discussed or agreed
          </label>
          <textarea
            id="t4-agreed"
            className="form-textarea"
            rows={2}
            placeholder="Any agreed actions, accommodations, or follow-up plans..."
            value={t4Agreed}
            onChange={(e) => setT4Agreed(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Tone</label>
          <div className="flex gap-md" style={{ flexWrap: "wrap" }}>
            {(["collaborative", "informational", "follow-up"] as const).map(
              (tone) => (
                <label
                  key={tone}
                  className="flex items-center gap-sm"
                  style={{
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    minHeight: "var(--touch-min)",
                  }}
                >
                  <input
                    type="radio"
                    name="t4-tone"
                    value={tone}
                    checked={t4Tone === tone}
                    onChange={(e) => setT4Tone(e.target.value)}
                    style={{ accentColor: "var(--color-primary)" }}
                  />
                  <span style={{ textTransform: "capitalize" }}>
                    {tone === "follow-up" ? "Follow-up Required" : tone}
                  </span>
                </label>
              )
            )}
          </div>
        </div>

        <button
          className="btn btn--primary"
          onClick={handleParentNote}
          disabled={!t4Student.trim() && !t4Summary.trim()}
        >
          Generate Note
        </button>

        <OutputArea
          text={t4Output}
          onCopy={() => showToast("Note copied!")}
        />
        <Disclaimer />
      </ToolCard>

      {/* ─── Tool 5: Create Meeting Summary ───────────── */}
      <ToolCard
        id="tool-meeting"
        title="5. Create Meeting Summary"
        description="Structures notes into a meeting-ready summary."
      >
        <div className="form-group">
          <label className="form-label" htmlFor="t5-student">
            Student name
          </label>
          <input
            id="t5-student"
            className="form-input"
            type="text"
            placeholder="Enter student name..."
            value={t5Student}
            onChange={(e) => setT5Student(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="t5-type">
            Meeting type
          </label>
          <select
            id="t5-type"
            className="form-select"
            value={t5MeetingType}
            onChange={(e) => setT5MeetingType(e.target.value)}
          >
            <option value="">Select meeting type...</option>
            <option value="Parent Conference">Parent Conference</option>
            <option value="SBLC">SBLC</option>
            <option value="504">504</option>
            <option value="IEP">IEP</option>
            <option value="Counselor">Counselor</option>
            <option value="Intervention">Intervention</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="t5-discussion">
            Key discussion points (one per line)
          </label>
          <textarea
            id="t5-discussion"
            className="form-textarea"
            rows={4}
            placeholder={"Student's academic progress was reviewed.\nBehavior data from the past 4 weeks was discussed.\nParent shared observations from home."}
            value={t5Discussion}
            onChange={(e) => setT5Discussion(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="t5-decisions">
            Decisions made
          </label>
          <textarea
            id="t5-decisions"
            className="form-textarea"
            rows={3}
            placeholder="Describe any decisions or conclusions reached..."
            value={t5Decisions}
            onChange={(e) => setT5Decisions(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="t5-actions">
            Action items (one per line)
          </label>
          <textarea
            id="t5-actions"
            className="form-textarea"
            rows={3}
            placeholder={"Teacher will implement check-in/check-out system.\nParent will reinforce positive behaviors at home.\nFollow-up meeting in 4 weeks."}
            value={t5ActionItems}
            onChange={(e) => setT5ActionItems(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="t5-followup">
            Follow-up date (optional)
          </label>
          <input
            id="t5-followup"
            className="form-input"
            type="date"
            value={t5FollowUp}
            onChange={(e) => setT5FollowUp(e.target.value)}
          />
        </div>

        <button
          className="btn btn--primary"
          onClick={handleMeetingSummary}
          disabled={!t5Student.trim() && !t5Discussion.trim()}
        >
          Generate Summary
        </button>

        <OutputArea
          text={t5Output}
          onCopy={() => showToast("Summary copied!")}
        />
        <Disclaimer />
      </ToolCard>

      {/* ─── Mobile responsive styles for separate columns ─── */}
      <style>{`
        @media (max-width: 600px) {
          .separate-columns {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

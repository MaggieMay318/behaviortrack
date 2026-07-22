import { useState } from "react";
import { Link } from "react-router-dom";
import { Zap, Star, Search, BarChart3, Target, FileText, User, FlaskConical, School, Sparkles, ClipboardList, PlusCircle, TrendingUp, Shield, AlertTriangle } from "lucide-react";

/* ─── Section icons (inline SVGs) ─── */

function ClipboardIcon({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <rect x="14" y="10" width="36" height="46" rx="3" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
      <rect x="22" y="18" width="20" height="3" rx="1.5" fill="rgba(255,255,255,0.5)" />
      <rect x="22" y="25" width="14" height="3" rx="1.5" fill="rgba(255,255,255,0.5)" />
      <rect x="22" y="32" width="18" height="3" rx="1.5" fill="rgba(255,255,255,0.5)" />
      <rect x="22" y="39" width="12" height="3" rx="1.5" fill="rgba(255,255,255,0.5)" />
      <rect x="8" y="12" width="10" height="8" rx="2" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
      <path d="M13 20l3 3 5-5" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="4" y="20" width="7" height="16" rx="2" fill="var(--color-primary)" opacity="0.3" />
      <rect x="14" y="12" width="7" height="24" rx="2" fill="var(--color-primary)" opacity="0.55" />
      <rect x="24" y="6" width="7" height="30" rx="2" fill="var(--color-primary)" opacity="0.8" />
    </svg>
  );
}

function CheckShieldIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M20 4L6 10v12c0 8.4 5.6 16.2 14 18 8.4-1.8 14-9.6 14-18V10L20 4z" fill="var(--color-primary-bg)" stroke="var(--color-primary)" strokeWidth="2" />
      <path d="M13 20l5 5 9-9" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function StepsIcon({ step }: { step: number }) {
  return (
    <span className="landing-steps__number">{step}</span>
  );
}

/* ─── Accordion ─── */

function AccordionItem({
  question,
  children,
  open,
  onToggle,
}: {
  question: string;
  children: React.ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="faq-item">
      <button className="faq-item__trigger" onClick={onToggle} aria-expanded={open}>
        <span>{question}</span>
        <span className={`faq-item__arrow${open ? " faq-item__arrow--open" : ""}`}>▾</span>
      </button>
      {open && <div className="faq-item__body">{children}</div>}
    </div>
  );
}

/* ─── Demo Request Form ─── */

function DemoForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [school, setSchool] = useState("");
  const [interest, setInterest] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState("");

  function validate(): boolean {
    const errs: Record<string, string> = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) errs.name = "Name is required";
    if (!trimmedEmail) {
      errs.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errs.email = "Please enter a valid email address";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), role, school, interest }),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setServerError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="alert alert--success text-center" style={{ padding: "var(--space-xl)" }}>
        <strong>Thank you for your interest!</strong>
        <p style={{ marginTop: "var(--space-sm)", marginBottom: 0 }}>
          We'll be in touch soon.
        </p>
      </div>
    );
  }

  return (
    <form className="demo-form" onSubmit={handleSubmit} noValidate>
      {serverError && (
        <div className="alert alert--error" style={{ marginBottom: "var(--space-md)", fontSize: "0.9rem" }}>
          {serverError}
        </div>
      )}
      <div className="form-group">
        <label className="form-label" htmlFor="demo-name">Name <span className="text-sm text-muted">(required)</span></label>
        <input
          id="demo-name" className={`form-input${errors.name ? " form-input--error" : ""}`}
          type="text" required placeholder="Your name"
          value={name} onChange={(e) => { setName(e.target.value); if (errors.name) setErrors(prev => { const { name: _, ...r } = prev; return r; }); }}
        />
        {errors.name && <span className="form-error">{errors.name}</span>}
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="demo-email">Email <span className="text-sm text-muted">(required)</span></label>
        <input
          id="demo-email" className={`form-input${errors.email ? " form-input--error" : ""}`}
          type="email" required placeholder="you@school.org"
          value={email} onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors(prev => { const { email: _, ...r } = prev; return r; }); }}
        />
        {errors.email && <span className="form-error">{errors.email}</span>}
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="demo-role">Role</label>
        <select id="demo-role" className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Select your role…</option>
          <option value="teacher">Teacher</option>
          <option value="interventionist">Interventionist</option>
          <option value="counselor">Counselor</option>
          <option value="administrator">Administrator</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="demo-school">School / District</label>
        <input id="demo-school" className="form-input" type="text" placeholder="Your school or district" value={school} onChange={(e) => setSchool(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="demo-interest">What interests you most?</label>
        <textarea id="demo-interest" className="form-textarea" rows={3} placeholder="Tell us what you're looking for…" value={interest} onChange={(e) => setInterest(e.target.value)} />
      </div>
      <button type="submit" className="btn btn--primary btn--lg btn--full" disabled={loading}>
        {loading ? "Sending…" : "Request Demo Access"}
      </button>
    </form>
  );
}

/* ─── Dashboard Preview Card ─── */

function DashboardPreview() {
  return (
    <div className="dashboard-preview">
      <div className="dashboard-preview__header">
        <span className="dashboard-preview__title">BehaviorTrack — Demo Dashboard</span>
      </div>
      <div className="dashboard-preview__stats">
        {[
          { value: "127", label: "Entries", sub: "This month" },
          { value: "3.2:1", label: "Pos:Corr", sub: "Ratio" },
          { value: "18", label: "Students", sub: "Active" },
          { value: "4", label: "Pending", sub: "Official docs" },
        ].map((s) => (
          <div key={s.label} className="dashboard-preview__stat">
            <div className="dashboard-preview__stat-value">{s.value}</div>
            <div className="dashboard-preview__stat-label">{s.label}</div>
            <div className="dashboard-preview__stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>
      <div className="dashboard-preview__chart">
        <div className="dashboard-preview__chart-title">Behaviors by Type — This Week</div>
        <div className="dashboard-preview__bars">
          {[
            { label: "On Task", pct: 75, color: "var(--color-success)" },
            { label: "Helped Peer", pct: 60, color: "var(--color-primary-light)" },
            { label: "Disruption", pct: 25, color: "var(--color-warning)" },
            { label: "Off Task", pct: 18, color: "var(--color-info)" },
          ].map((b) => (
            <div key={b.label} className="dashboard-preview__bar-row">
              <span className="dashboard-preview__bar-label">{b.label}</span>
              <div className="dashboard-preview__bar-track">
                <div
                  className="dashboard-preview__bar-fill"
                  style={{ width: `${b.pct}%`, background: b.color }}
                />
              </div>
              <span className="dashboard-preview__bar-val">{b.pct}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="dashboard-preview__footer text-sm text-muted">
        <AlertTriangle size={14} style={{ display: "inline", marginRight: 4 }} /> Demo data — all entries are fictional
      </div>
    </div>
  );
}

/* ─── Main Landing Component ─── */

export default function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: "Is this a replacement for my district's discipline system?",
      a: "No. BehaviorTrack is a supplemental tracking tool designed for classroom-level pattern identification, intervention planning, and meeting preparation. It does not replace required documentation in your district LMS, SIS, discipline platform, or IEP system.",
    },
    {
      q: "Can I import students from my SIS?",
      a: "Currently, students are managed within BehaviorTrack. We recommend entering only the minimum necessary information for classroom tracking. Always use district-approved systems for official records.",
    },
    {
      q: "Is student data secure?",
      a: "BehaviorTrack uses Clerk for authentication and follows security best practices. We recommend never entering full names, IDs, or other personally identifiable information beyond what is necessary for classroom use.",
    },
    {
      q: "Can I share reports with parents?",
      a: "Yes. Reports and summaries can be printed, copied, or exported as PDF. The built-in Copy Summary feature makes it easy to transfer objective observations into emails, conference notes, or official documentation.",
    },
    {
      q: "Does this work on my phone?",
      a: "Yes. BehaviorTrack is designed for phones, tablets, Chromebooks, and desktops. All touch targets meet accessibility guidelines, and the interface adapts to any screen size.",
    },
    {
      q: "What is the Founding User Program?",
      a: "Founding users receive special introductory pricing and direct input into feature development. Join early to lock in reduced rates and help shape BehaviorTrack for real classrooms.",
    },
  ];

  return (
    <div className="landing">
      {/* ─── Hero ─── */}
      <header className="landing-hero" aria-label="BehaviorTrack introduction">
        <div className="landing-hero__inner">
          <div className="landing-hero__text">
            <h1 className="landing-hero__headline">
              Every student has<br />a story worth<br /><span style={{ background: "linear-gradient(135deg, #FCD34D, #FB923C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>celebrating</span>.
            </h1>
            <p className="landing-hero__sub">
              Track behavior, celebrate growth, and document patterns — all in under 30 seconds. Your classroom deserves a tool as warm and supportive as you are.
            </p>
            <div className="landing-hero__actions">
              <Link to="/login" className="btn btn--primary btn--lg">
                <Sparkles size={20} /> Try the Demo
              </Link>
              <a href="#features" className="btn btn--secondary btn--lg">
                See How It Works
              </a>
            </div>
          </div>
          <div className="landing-hero__graphic" aria-hidden="true">
            <div style={{ position: "relative" }}>
              <div style={{
                width: 160, height: 160,
                borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.05))",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 60px rgba(253, 224, 71, 0.3)",
                border: "3px solid rgba(255,255,255,0.25)",
              }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "3rem", lineHeight: 1 }}>⭐</div>
                  <div style={{ fontSize: "2rem", fontWeight: 800, color: "#FCD34D", lineHeight: 1 }}>+5</div>
                  <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.8)", marginTop: 4 }}>points!</div>
                </div>
              </div>
              {/* Decorative mini-monsters */}
              <div style={{
                position: "absolute", top: -16, right: -8,
                width: 44, height: 44, borderRadius: "50%",
                background: "linear-gradient(135deg, #34D399, #10B981)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.4rem", boxShadow: "0 4px 16px rgba(16,185,129,0.4)",
              }}>🦊</div>
              <div style={{
                position: "absolute", bottom: -8, left: -12,
                width: 48, height: 48, borderRadius: "50%",
                background: "linear-gradient(135deg, #A78BFA, #7C3AED)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.5rem", boxShadow: "0 4px 16px rgba(124,58,237,0.4)",
              }}>🐙</div>
              <div style={{
                position: "absolute", bottom: 12, right: -20,
                width: 36, height: 36, borderRadius: "50%",
                background: "linear-gradient(135deg, #FB923C, #F97316)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.2rem", boxShadow: "0 4px 12px rgba(249,115,22,0.4)",
              }}>🐸</div>
            </div>
          </div>
        </div>
      </header>

      {/* ─── How It Works ─── */}
      <section className="landing-section" id="how-it-works" aria-label="How it works">
        <h2 className="landing-section__title">How It Works</h2>
        <div className="landing-steps">
          <div className="landing-steps__item">
            <StepsIcon step={1} />
            <h3>Record in seconds</h3>
            <p>Large touch-friendly buttons, saved defaults, under 30 seconds per entry.</p>
          </div>
          <div className="landing-steps__item">
            <StepsIcon step={2} />
            <h3>Identify patterns</h3>
            <p>Automatic charts, trends, and cautious pattern suggestions across time and context.</p>
          </div>
          <div className="landing-steps__item">
            <StepsIcon step={3} />
            <h3>Document professionally</h3>
            <p>Generate objective summaries for meetings, with official documentation reminders.</p>
          </div>
        </div>
      </section>

      {/* ─── Features Grid ─── */}
      <section className="landing-section landing-section--alt" id="features" aria-label="Features overview">
        <h2 className="landing-section__title">What BehaviorTrack Does</h2>
        <div className="landing-features">
          {[
            { icon: <Zap size={28} />, title: "Fast Behavior Entry", desc: "Record positive and corrective incidents in under 30 seconds with large, touch-friendly controls." },
            { icon: <Star size={28} />, title: "Positive Behavior Tracking", desc: "Celebrate growth and recognize strengths — not just problems. Track what's going well." },
            { icon: <Search size={28} />, title: "Pattern Identification", desc: "Spot trends across time, subjects, locations, and contexts with automatic charts and data views." },
            { icon: <BarChart3 size={28} />, title: "Intervention Effectiveness", desc: "Connect behaviors to interventions, track progress, and see what works and what doesn't." },
            { icon: <Target size={28} />, title: "Behavior Goals", desc: "Set measurable, time-bound goals with progress tracking and review reminders." },
            { icon: <FileText size={28} />, title: "Professional Summaries", desc: "Generate ready-to-share reports and objective summaries for parents, conferences, and support meetings." },
          ].map((f) => (
            <div key={f.title} className="landing-features__item">
              <span className="landing-features__icon">{f.icon}</span>
              <h3 className="landing-features__title">{f.title}</h3>
              <p className="landing-features__desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Intended Users ─── */}
      <section className="landing-section" aria-label="Who BehaviorTrack is for">
        <h2 className="landing-section__title">Who It's For</h2>
        <div className="landing-users">
          <div className="landing-users__card">
            <div className="landing-users__icon"><User size={40} /></div>
            <h3>Classroom Teachers</h3>
            <p>Fast entry, objective documentation, and clear summaries for parent conferences and team meetings.</p>
          </div>
          <div className="landing-users__card">
            <div className="landing-users__icon"><FlaskConical size={40} /></div>
            <h3>Interventionists &amp; Counselors</h3>
            <p>Pattern data across students, goal tracking, and progress monitoring for targeted support.</p>
          </div>
          <div className="landing-users__card">
            <div className="landing-users__icon"><School size={40} /></div>
            <h3>Administrators</h3>
            <p>School-wide trend visibility, documentation compliance, and data-informed support planning.</p>
          </div>
        </div>
      </section>

      {/* ─── Official Documentation ─── */}
      <section className="landing-section landing-section--alt" aria-label="Supplemental tracking information">
        <h2 className="landing-section__title">Supplemental Tracking, Not a Replacement</h2>
        <div className="landing-docs">
          <div className="landing-docs__grid">
            <div className="landing-docs__item">
              <CheckShieldIcon />
              <div>
                <strong>Supports classroom tracking</strong>
                <p>BehaviorTrack helps you record and review behavior patterns for your own classroom use and intervention planning.</p>
              </div>
            </div>
            <div className="landing-docs__item">
              <CheckShieldIcon />
              <div>
                <strong>Does not replace official systems</strong>
                <p>Always enter required documentation in your district's LMS, SIS, discipline platform, or IEP system. BehaviorTrack is supplemental.</p>
              </div>
            </div>
            <div className="landing-docs__item">
              <CheckShieldIcon />
              <div>
                <strong>Built-in reminders</strong>
                <p>The Official Documentation Queue reminds you which entries still need to be transferred into your district's official system.</p>
              </div>
            </div>
            <div className="landing-docs__item">
              <CheckShieldIcon />
              <div>
                <strong>Easy transfer</strong>
                <p>Use the Copy Summary button to quickly transfer objective observations into official documentation, emails, or meeting notes.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Dashboard Preview ─── */}
      <section className="landing-section" aria-label="Dashboard preview">
        <h2 className="landing-section__title">See the Full Picture at a Glance</h2>
        <p className="landing-section__subtitle">A clean, professional dashboard for tracking behavior data across your classroom.</p>
        <DashboardPreview />
      </section>

      {/* ─── Privacy Notice ─── */}
      <section className="landing-section landing-section--alt landing-privacy" aria-label="Privacy and responsible use">
        <h2 className="landing-section__title">Privacy &amp; Responsible Use</h2>
        <div className="landing-privacy__content">
          <p>
            <strong>BehaviorTrack supports classroom tracking, intervention planning, and pattern review.</strong>
          </p>
          <ul>
            <li>Enter only necessary student information for classroom-level tracking.</li>
            <li>Never use real student data in public demos — all demo data is fictional.</li>
            <li>Always use your district-approved systems for official student records.</li>
            <li>This tool does not provide legal, medical, psychological, or diagnostic advice.</li>
          </ul>
          <p className="mt-md">
            <Link to="/help">Read the full Help &amp; Privacy page →</Link>
          </p>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section className="landing-section" id="pricing" aria-label="Plans and pricing">
        <h2 className="landing-section__title">Plans &amp; Pricing</h2>
        <div className="landing-pricing">
          {[
            {
              name: "Individual Teacher",
              desc: "Single account, full core features for one classroom.",
              price: "$9",
              link: "https://buy.stripe.com/4gM00lgGxelKe0T63ReEo01",
              highlight: false,
            },
            {
              name: "Grade-Level Team",
              desc: "Shared student lists, team dashboards, and collaborative tracking.",
              price: "$29",
              link: "https://buy.stripe.com/cNifZjbmdfpO4qj2RFeEo02",
              highlight: true,
            },
            {
              name: "School Pilot",
              desc: "School-wide access, admin controls, and priority support.",
              price: "$99",
              link: "https://buy.stripe.com/28EaEZ2PHcdCf4XfEreEo03",
              highlight: false,
            },
          ].map((p) => (
            <div key={p.name} className={`landing-pricing__card${p.highlight ? " landing-pricing__card--highlight" : ""}`}>
              <h3 className="landing-pricing__name">{p.name}</h3>
              <div className="landing-pricing__price">{p.price}<span>/mo</span></div>
              <p className="landing-pricing__desc">{p.desc}</p>
              <a
                href={p.link}
                className="btn btn--primary btn--full"
                style={{ marginTop: "var(--space-md)" }}
                target="_blank"
                rel="noopener noreferrer"
              >
                Subscribe
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Demo Request / Founding User ─── */}
      <section className="landing-section landing-section--alt" id="demo" aria-label="Request demo access">
        <h2 className="landing-section__title">Request Demo Access</h2>
        <p className="landing-section__subtitle">
          Interested in trying BehaviorTrack? Join the Founding User Program for early access and special rates.
        </p>
        <p className="text-center text-sm text-muted" style={{ marginBottom: "var(--space-md)" }}>
          Or subscribe directly above to get started immediately.
        </p>
        <div className="landing-demo-form-wrapper">
          <DemoForm />
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="landing-section" aria-label="Frequently asked questions">
        <h2 className="landing-section__title">Frequently Asked Questions</h2>
        <div className="landing-faq">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              question={faq.q}
              open={openFaq === i}
              onToggle={() => setOpenFaq(openFaq === i ? null : i)}
            >
              <p>{faq.a}</p>
            </AccordionItem>
          ))}
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="landing-footer">
        <div className="landing-footer__inner">
          <div className="landing-footer__brand">
            <strong>BehaviorTrack</strong>
            <p>A supplemental classroom behavior and intervention tracker.</p>
          </div>
          <div className="landing-footer__links">
            <Link to="/help">Privacy</Link>
            <Link to="/help">Help</Link>
            <Link to="/login">Login</Link>
          </div>
        </div>
        <div className="landing-footer__bottom">
          All demo data is fictional. This tool does not replace official district documentation.
        </div>
      </footer>
    </div>
  );
}

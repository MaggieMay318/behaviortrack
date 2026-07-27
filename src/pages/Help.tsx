import { BookOpen, AlertTriangle, Shield, Play, Tag, Info } from "lucide-react";

export default function Help() {
  return (
    <div>
      <div className="flex items-center gap-sm mb-md">
        <BookOpen size={24} style={{ color: "var(--color-primary)" }} />
        <h1 style={{ marginBottom: 0 }}>Help &amp; Privacy</h1>
      </div>

      {/* About */}
      <div className="card" style={{ borderLeftColor: "var(--color-primary)" }}>
        <div className="flex items-center gap-sm mb-md">
          <Info size={18} style={{ color: "var(--color-primary)" }} />
          <h3 style={{ marginBottom: 0 }}>About BehaviorTrack</h3>
        </div>
        <p className="text-sm" style={{ lineHeight: 1.7 }}>
          BehaviorTrack is a classroom behavior tracking tool designed for K\u20138 educators.
          It helps teachers record behavior observations quickly \u2014 in under 30 seconds \u2014
          using neutral, objective language suitable for parent conferences, referrals,
          SBLC, 504/IEP meetings, and administrative reviews.
        </p>
      </div>

      {/* Disclaimer */}
      <div className="card" style={{ borderLeftColor: "var(--color-warning)" }}>
        <div className="flex items-center gap-sm mb-md">
          <AlertTriangle size={18} style={{ color: "var(--color-warning)" }} />
          <h3 style={{ marginBottom: 0 }}>Important Disclaimer</h3>
        </div>
        <div className="alert alert--warning" style={{ marginBottom: 0 }}>
          <strong>BehaviorTrack supplements, but does not replace, official district documentation systems.</strong>
          {" "}The Documentation Queue reminds teachers which entries still need to be entered into their district's official system.
          BehaviorTrack does not sync with or transfer data to any external system.
        </div>
      </div>

      {/* Privacy */}
      <div className="card" style={{ borderLeftColor: "var(--color-success)" }}>
        <div className="flex items-center gap-sm mb-md">
          <Shield size={18} style={{ color: "var(--color-success)" }} />
          <h3 style={{ marginBottom: 0 }}>Privacy</h3>
        </div>
        <p className="text-sm" style={{ lineHeight: 1.7, color: "var(--color-gray-600)" }}>
          {import.meta.env.VITE_DEMO_MODE === "true"
            ? "This is a demo application. All student names, data, and entries are fictional and created for demonstration purposes only. No real student data is stored or transmitted."
            : "BehaviorTrack tracks behavior observation data for classroom use."}
          {" "}In a production environment, BehaviorTrack would comply with
          FERPA, COPPA, and applicable state privacy regulations.
        </p>
      </div>

      {/* Quick Start Guide */}
      <div className="card" style={{ borderLeftColor: "var(--color-accent)" }}>
        <div className="flex items-center gap-sm mb-md">
          <Play size={18} style={{ color: "var(--color-accent)" }} />
          <h3 style={{ marginBottom: 0 }}>Quick Start Guide</h3>
        </div>
        <ol style={{
          paddingLeft: "var(--space-lg)",
          fontSize: "0.9rem",
          color: "var(--color-gray-700)",
          lineHeight: 2.2,
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-xs)",
        }}>
          {import.meta.env.VITE_DEMO_MODE === "true" ? (
            <>
              <li><strong>Sign in</strong> with your demo account (teacher@demo.edu / demo1234)</li>
              <li><strong>Tap the + button</strong> or go to Quick Entry to record your first behavior observation</li>
              <li><strong>Use neutral language</strong> \u2014 describe what you observe, not what you assume</li>
              <li><strong>Check the Documentation Queue</strong> regularly to see which entries need to be entered into your official system</li>
              <li><strong>Review Reports</strong> to see patterns and prepare for conferences</li>
            </>
          ) : (
            <>
              <li><strong>Sign in</strong> with your account</li>
              <li><strong>Add your students</strong> in the Students section</li>
              <li><strong>Tap the + button</strong> or go to Quick Entry to record your first behavior observation</li>
              <li><strong>Use neutral language</strong> \u2014 describe what you observe, not what you assume</li>
              <li><strong>Check the Documentation Queue</strong> regularly to see which entries need to be entered into your official system</li>
              <li><strong>Review Reports</strong> to see patterns and prepare for conferences</li>
            </>
          )}
        </ol>
      </div>

      {/* Entry Types */}
      <div className="card" style={{ borderLeftColor: "var(--color-info)" }}>
        <div className="flex items-center gap-sm mb-md">
          <Tag size={18} style={{ color: "var(--color-info)" }} />
          <h3 style={{ marginBottom: 0 }}>Entry Types</h3>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", padding: "var(--space-sm) var(--space-md)", background: "var(--color-success-bg)", borderRadius: "var(--radius-sm)" }}>
            <span className="badge badge--positive" style={{ minWidth: 90, textAlign: "center" }}>Positive</span>
            <span className="text-sm" style={{ color: "var(--color-gray-600)" }}>Recognize and reinforce desired behaviors</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", padding: "var(--space-sm) var(--space-md)", background: "var(--color-primary-bg)", borderRadius: "var(--radius-sm)" }}>
            <span className="badge badge--minor" style={{ minWidth: 90, textAlign: "center" }}>Minor Concern</span>
            <span className="text-sm" style={{ color: "var(--color-gray-600)" }}>Low-level behaviors managed within the classroom</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", padding: "var(--space-sm) var(--space-md)", background: "var(--color-warning-bg)", borderRadius: "var(--radius-sm)" }}>
            <span className="badge badge--moderate" style={{ minWidth: 90, textAlign: "center" }}>Moderate Concern</span>
            <span className="text-sm" style={{ color: "var(--color-gray-600)" }}>Behaviors that may require parent contact or team discussion</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", padding: "var(--space-sm) var(--space-md)", background: "var(--color-danger-bg)", borderRadius: "var(--radius-sm)" }}>
            <span className="badge badge--major" style={{ minWidth: 90, textAlign: "center" }}>Major Concern</span>
            <span className="text-sm" style={{ color: "var(--color-gray-600)" }}>Behaviors requiring referral, SBLC, or administrative review</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", padding: "var(--space-sm) var(--space-md)", background: "#FEE2E2", borderRadius: "var(--radius-sm)" }}>
            <span className="badge badge--crisis" style={{ minWidth: 90, textAlign: "center" }}>Crisis</span>
            <span className="text-sm" style={{ color: "var(--color-gray-600)" }}>Immediate safety concerns requiring urgent intervention</span>
          </div>
        </div>
      </div>
    </div>
  );
}

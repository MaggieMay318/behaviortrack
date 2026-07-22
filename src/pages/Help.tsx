export default function Help() {
  return (
    <div>
      <h1 className="mb-md">Help & Privacy</h1>

      <div className="card">
        <h3 className="mb-sm">About BehaviorTrack</h3>
        <p className="text-sm">
          BehaviorTrack is a classroom behavior tracking tool designed for K–8 educators. 
          It helps teachers record behavior observations quickly — in under 30 seconds — 
          using neutral, objective language suitable for parent conferences, referrals, 
          SBLC, 504/IEP meetings, and administrative reviews.
        </p>
      </div>

      <div className="card">
        <h3 className="mb-sm">Important Disclaimer</h3>
        <div className="alert alert--warning" style={{ marginBottom: 0 }}>
          <strong>BehaviorTrack supplements, but does not replace, official district documentation systems.</strong>
          {" "}The Documentation Queue reminds teachers which entries still need to be entered into their district's official system. 
          BehaviorTrack does not sync with or transfer data to any external system.
        </div>
      </div>

      <div className="card">
        <h3 className="mb-sm">Privacy</h3>
        <p className="text-sm text-muted">
          {import.meta.env.VITE_DEMO_MODE === "true"
            ? "This is a demo application. All student names, data, and entries are fictional and created for demonstration purposes only. No real student data is stored or transmitted."
            : "BehaviorTrack tracks behavior observation data for classroom use."}
          {" "}In a production environment, BehaviorTrack would comply with
          FERPA, COPPA, and applicable state privacy regulations.
        </p>
      </div>

      {import.meta.env.VITE_DEMO_MODE === "true" && (
        <div className="card">
          <h3 className="mb-sm">Quick Start Guide</h3>
          <ol style={{ paddingLeft: "var(--space-lg)", fontSize: "0.9rem", color: "var(--color-gray-600)", lineHeight: 2 }}>
            <li><strong>Sign in</strong> with your demo account (teacher@demo.edu / demo1234)</li>
            <li><strong>Tap the + button</strong> or go to Quick Entry to record your first behavior observation</li>
            <li><strong>Use neutral language</strong> — describe what you observe, not what you assume</li>
            <li><strong>Check the Documentation Queue</strong> regularly to see which entries need to be entered into your official system</li>
            <li><strong>Review Reports</strong> to see patterns and prepare for conferences</li>
          </ol>
        </div>
      )}

      {import.meta.env.VITE_DEMO_MODE !== "true" && (
        <div className="card">
          <h3 className="mb-sm">Quick Start Guide</h3>
          <ol style={{ paddingLeft: "var(--space-lg)", fontSize: "0.9rem", color: "var(--color-gray-600)", lineHeight: 2 }}>
            <li><strong>Sign in</strong> with your account</li>
            <li><strong>Add your students</strong> in the Students section</li>
            <li><strong>Tap the + button</strong> or go to Quick Entry to record your first behavior observation</li>
            <li><strong>Use neutral language</strong> — describe what you observe, not what you assume</li>
            <li><strong>Check the Documentation Queue</strong> regularly to see which entries need to be entered into your official system</li>
            <li><strong>Review Reports</strong> to see patterns and prepare for conferences</li>
          </ol>
        </div>
      )}

      <div className="card">
        <h3 className="mb-sm">Entry Types</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", fontSize: "0.875rem" }}>
          <div className="flex items-center gap-sm">
            <span className="badge badge--positive">Positive</span>
            <span className="text-muted">Recognize and reinforce desired behaviors</span>
          </div>
          <div className="flex items-center gap-sm">
            <span className="badge badge--minor">Minor Concern</span>
            <span className="text-muted">Low-level behaviors managed within the classroom</span>
          </div>
          <div className="flex items-center gap-sm">
            <span className="badge badge--moderate">Moderate Concern</span>
            <span className="text-muted">Behaviors that may require parent contact or team discussion</span>
          </div>
          <div className="flex items-center gap-sm">
            <span className="badge badge--major">Major Concern</span>
            <span className="text-muted">Behaviors requiring referral, SBLC, or administrative review</span>
          </div>
          <div className="flex items-center gap-sm">
            <span className="badge badge--crisis">Crisis</span>
            <span className="text-muted">Immediate safety concerns requiring urgent intervention</span>
          </div>
        </div>
      </div>
    </div>
  );
}

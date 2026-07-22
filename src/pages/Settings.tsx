import { useUser } from "@clerk/clerk-react";
import { useLegacyToken } from "../lib/auth";

export default function Settings() {
  const { user: clerkUser } = useUser();
  const { user: legacyUser } = useLegacyToken();

  const name = clerkUser?.fullName || legacyUser?.name || "";
  const email = clerkUser?.primaryEmailAddress?.emailAddress || legacyUser?.email || "";
  const role = legacyUser?.role || "";

  return (
    <div>
      <h1 className="mb-md">Settings</h1>

      <div className="card">
        <h3 className="mb-sm">Account</h3>
        <div className="text-sm">
          <div className="flex justify-between mb-sm">
            <span className="text-muted">Name</span>
            <span style={{ fontWeight: 500 }}>{name || "—"}</span>
          </div>
          <div className="flex justify-between mb-sm">
            <span className="text-muted">Email</span>
            <span style={{ fontWeight: 500 }}>{email || "—"}</span>
          </div>
          <div className="flex justify-between mb-sm">
            <span className="text-muted">Role</span>
            <span style={{ fontWeight: 500, textTransform: "capitalize" }}>{role || "—"}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-sm">Classroom Profile</h3>
        <p className="text-sm text-muted">
          Classroom and grade-level settings will be available in a future update.
          For now, you can manage students and entries from their respective screens.
        </p>
      </div>

      <div className="card">
        <h3 className="mb-sm">Application Mode</h3>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <span
            className={`badge ${import.meta.env.VITE_DEMO_MODE === "true" ? "badge--neutral" : "badge--positive"}`}
            style={{ fontSize: "0.85rem", padding: "var(--space-xs) var(--space-sm)" }}
          >
            {import.meta.env.VITE_DEMO_MODE === "true" ? "Demo Mode" : "Production"}
          </span>
          <span className="text-sm text-muted">
            {import.meta.env.VITE_DEMO_MODE === "true"
              ? "All student data is fictional and for demonstration only."
              : "Live data mode. Demo features are disabled."}
          </span>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-sm">Data & Privacy</h3>
        <p className="text-sm text-muted mb-sm">
          BehaviorTrack stores behavior observation data locally in this {import.meta.env.VITE_DEMO_MODE === "true" ? "demo" : ""} environment.
          {import.meta.env.VITE_DEMO_MODE === "true" && " All student data shown is fictional and for demonstration purposes only."}
        </p>
        <a href="/help" style={{ fontSize: "0.875rem", color: "var(--color-primary)" }}>
          View Privacy Policy →
        </a>
      </div>
    </div>
  );
}

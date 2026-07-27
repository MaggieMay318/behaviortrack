import { useUser } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { useLegacyToken } from "../lib/auth";
import { User, GraduationCap, ShieldCheck, Database, Settings2, Info, Mail, Tag } from "lucide-react";

export default function Settings() {
  const { user: clerkUser } = useUser();
  const { user: legacyUser } = useLegacyToken();

  const name = clerkUser?.fullName || legacyUser?.name || "";
  const email = clerkUser?.primaryEmailAddress?.emailAddress || legacyUser?.email || "";
  const role = legacyUser?.role || "";

  return (
    <div>
      <div className="flex items-center gap-sm mb-md">
        <Settings2 size={24} style={{ color: "var(--color-primary)" }} />
        <h1 style={{ marginBottom: 0 }}>Settings</h1>
      </div>

      {/* Account Card */}
      <div className="card" style={{ borderLeftColor: "var(--color-primary)" }}>
        <div className="flex items-center gap-sm mb-md">
          <User size={18} style={{ color: "var(--color-primary)" }} />
          <h3 style={{ marginBottom: 0 }}>Account</h3>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-sm) var(--space-md)", background: "var(--color-gray-50)", borderRadius: "var(--radius-sm)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", color: "var(--color-gray-500)", fontSize: "0.9rem" }}>
              <User size={15} /> Name
            </span>
            <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{name || "\u2014"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-sm) var(--space-md)", background: "var(--color-gray-50)", borderRadius: "var(--radius-sm)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", color: "var(--color-gray-500)", fontSize: "0.9rem" }}>
              <Mail size={15} /> Email
            </span>
            <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{email || "\u2014"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-sm) var(--space-md)", background: "var(--color-gray-50)", borderRadius: "var(--radius-sm)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", color: "var(--color-gray-500)", fontSize: "0.9rem" }}>
              <Tag size={15} /> Role
            </span>
            <span style={{ fontWeight: 600, fontSize: "0.95rem", textTransform: "capitalize" }}>{role || "\u2014"}</span>
          </div>
        </div>
      </div>

      {/* Classroom Profile Card */}
      <div className="card" style={{ borderLeftColor: "var(--color-accent)" }}>
        <div className="flex items-center gap-sm mb-md">
          <GraduationCap size={18} style={{ color: "var(--color-accent)" }} />
          <h3 style={{ marginBottom: 0 }}>Classroom Profile</h3>
        </div>
        <div className="alert alert--info" style={{ marginBottom: 0 }}>
          <Info size={16} style={{ display: "inline", marginRight: 4, verticalAlign: "text-bottom" }} />
          Classroom and grade-level settings will be available in a future update.
          For now, you can manage students and entries from their respective screens.
        </div>
      </div>

      {/* Application Mode Card */}
      <div className="card" style={{ borderLeftColor: "var(--color-info)" }}>
        <div className="flex items-center gap-sm mb-md">
          <Database size={18} style={{ color: "var(--color-info)" }} />
          <h3 style={{ marginBottom: 0 }}>Application Mode</h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", flexWrap: "wrap" }}>
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

      {/* Data & Privacy Card */}
      <div className="card" style={{ borderLeftColor: "var(--color-success)" }}>
        <div className="flex items-center gap-sm mb-md">
          <ShieldCheck size={18} style={{ color: "var(--color-success)" }} />
          <h3 style={{ marginBottom: 0 }}>Data &amp; Privacy</h3>
        </div>
        <p className="text-sm text-muted mb-sm">
          BehaviorTrack stores behavior observation data locally in this {import.meta.env.VITE_DEMO_MODE === "true" ? "demo" : ""} environment.
          {import.meta.env.VITE_DEMO_MODE === "true" && " All student data shown is fictional and for demonstration purposes only."}
        </p>
        <Link to="/help" style={{ fontSize: "0.875rem", color: "var(--color-primary)", display: "inline-flex", alignItems: "center", gap: "var(--space-xs)" }}>
          View Privacy Policy <span style={{ fontSize: "1rem" }}>\u2192</span>
        </Link>
      </div>
    </div>
  );
}

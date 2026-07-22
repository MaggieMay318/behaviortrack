import { SignIn, useAuth } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";

export default function Login() {
  const { isSignedIn } = useAuth();

  if (isSignedIn) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100dvh",
        background: "var(--color-gray-50)",
        padding: "var(--space-md)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: "var(--space-xl)" }}>
          <h1
            style={{
              color: "var(--color-primary)",
              fontSize: "1.75rem",
              marginBottom: "var(--space-xs)",
            }}
          >
            BehaviorTrack
          </h1>
          <p className="text-muted">Classroom behavior tracking for K–8 educators</p>
        </div>

        <SignIn
          routing="path"
          path="/login"
          signUpUrl="/login?sign_up=true"
          appearance={{
            elements: {
              formButtonPrimary:
                "background-color: var(--color-primary); border-color: var(--color-primary);",
              formButtonPrimaryHover:
                "background-color: var(--color-primary-dark); border-color: var(--color-primary-dark);",
              card: "box-shadow: none; border: 1px solid var(--color-gray-200); border-radius: var(--radius-md);",
              headerTitle: "color: var(--color-gray-900);",
              headerSubtitle: "color: var(--color-gray-500);",
              socialButtonsBlockButton:
                "border: 1px solid var(--color-gray-200); border-radius: var(--radius-sm);",
              formFieldLabel: "color: var(--color-gray-700); font-weight: 600;",
              formFieldInput:
                "border: 1px solid var(--color-gray-300); border-radius: var(--radius-sm); min-height: var(--touch-min);",
              formFieldInputFocus:
                "border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(30,90,138,0.15);",
              footerActionLink: "color: var(--color-primary);",
              dividerLine: "background-color: var(--color-gray-200);",
              dividerText: "color: var(--color-gray-400);",
            },
          }}
        />

        {/* Demo disclaimer — only shown in demo mode */}
        {import.meta.env.VITE_DEMO_MODE === "true" && (
          <div
            className="alert alert--demo"
            style={{
              marginTop: "var(--space-lg)",
              textAlign: "center",
            }}
          >
            <strong>Demo Mode</strong> — All student data is fictional. BehaviorTrack supplements,
            but does not replace, official district documentation systems.
          </div>
        )}

        {import.meta.env.VITE_DEMO_MODE === "true" && (
          <p
            className="text-center text-sm text-muted"
            style={{ marginTop: "var(--space-md)" }}
          >
            Sign in or create an account to access the demo.
          </p>
        )}
      </div>
    </div>
  );
}

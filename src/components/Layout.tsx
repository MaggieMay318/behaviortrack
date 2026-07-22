import { Outlet, Link, useLocation } from "react-router-dom";
import { useUser, UserButton } from "@clerk/clerk-react";
import { useLegacyToken } from "../lib/auth";
import ErrorBoundary from "./ErrorBoundary";
import {
  LayoutDashboard,
  PlusCircle,
  Users,
  FileText,
  ClipboardList,
  Settings,
  Target,
  TrendingUp,
  Sparkles,
  HelpCircle,
  Plus,
} from "lucide-react";

const iconSize = 20;

const navItems = [
  { path: "/dashboard", icon: <LayoutDashboard size={iconSize} />, label: "Dashboard" },
  { path: "/entry", icon: <PlusCircle size={iconSize} />, label: "Quick Entry" },
  { path: "/students", icon: <Users size={iconSize} />, label: "Students" },
  { path: "/reports", icon: <FileText size={iconSize} />, label: "Reports" },
  { path: "/documentation", icon: <ClipboardList size={iconSize} />, label: "Queue" },
  { path: "/settings", icon: <Settings size={iconSize} />, label: "Settings" },
];

const sideNavItems = [
  ...navItems,
  { path: "/goals", icon: <Target size={iconSize} />, label: "Goals" },
  { path: "/trends", icon: <TrendingUp size={iconSize} />, label: "Trends" },
  { path: "/assistant", icon: <Sparkles size={iconSize} />, label: "Assistant" },
  { path: "/help", icon: <HelpCircle size={iconSize} />, label: "Help" },
];

export default function Layout() {
  const location = useLocation();
  const { user: clerkUser } = useUser();
  const { loading, error } = useLegacyToken();

  if (loading) {
    return (
      <div className="loading" aria-busy="true">
        <span className="spinner spinner--lg" style={{ marginRight: "var(--space-sm)" }} />
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading" style={{ flexDirection: "column", gap: "var(--space-md)" }}>
        <p>Unable to connect to the server.</p>
        <p className="text-sm text-muted">{error}</p>
        <button className="btn btn--primary" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  const displayName = clerkUser?.fullName || clerkUser?.primaryEmailAddress?.emailAddress || "";

  return (
    <div className="app-layout">
      {/* Skip to content for keyboard users */}
      <a href="#main-content" className="skip-to-content" aria-label="Skip to main content">
        Skip to content
      </a>

      {/* Side navigation (desktop) */}
      <nav className="side-nav" role="navigation" aria-label="Main navigation">
        <div style={{ padding: "var(--space-md)", marginBottom: "var(--space-md)" }}>
          <Link to="/dashboard" style={{ textDecoration: "none" }}>
            <span
              style={{
                fontSize: "1.2rem",
                fontWeight: 700,
                color: "var(--color-primary)",
              }}
            >
              BehaviorTrack
            </span>
          </Link>
        </div>
        {sideNavItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== "/" && location.pathname.startsWith(item.path + "/"));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`side-nav__item${isActive ? " side-nav__item--active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <span aria-hidden="true" style={{ display: "flex", alignItems: "center" }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
        <div style={{ marginTop: "auto", padding: "var(--space-md)" }}>
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: "width: 32px; height: 32px;",
              },
            }}
          />
        </div>
      </nav>

      {/* Main content area */}
      <div className="app-container" style={{ flex: 1 }}>
        {/* Header */}
        <header className="app-header">
          <Link to="/dashboard" style={{ textDecoration: "none" }}>
            <span className="app-header__title">BehaviorTrack</span>
          </Link>
          <div className="app-header__user">
            {displayName && (
              <span className="hide-mobile-filters" style={{ fontSize: "0.875rem" }}>
                {displayName}
              </span>
            )}
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox: "width: 30px; height: 30px;",
                },
              }}
            />
          </div>
        </header>

        {/* Demo alert — only shown in demo mode */}
        {import.meta.env.VITE_DEMO_MODE === "true" && (
          <div
            className="alert alert--demo"
            role="alert"
            style={{ margin: 0, borderRadius: 0, borderLeft: 0, borderRight: 0 }}
          >
            <strong>Demo Mode</strong> — All student data is fictional. BehaviorTrack supplements,
            but does not replace, official district documentation systems.
          </div>
        )}

        {/* Page content */}
        <main className="app-main" id="main-content" tabIndex={-1}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>

        {/* Bottom navigation (mobile) */}
        <nav className="bottom-nav" role="navigation" aria-label="Mobile navigation">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== "/" && location.pathname.startsWith(item.path + "/"));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`bottom-nav__item${isActive ? " bottom-nav__item--active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
              >
                <span className="bottom-nav__icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* FAB - Quick Entry */}
        {location.pathname !== "/entry" && (
          <Link
            to="/entry"
            className="fab-add"
            title="Add Behavior Entry"
            aria-label="Add Behavior Entry"
          >
            <Plus size={28} />
          </Link>
        )}
      </div>
    </div>
  );
}

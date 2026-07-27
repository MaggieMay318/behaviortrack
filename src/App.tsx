import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SignedIn, SignedOut, useAuth } from "@clerk/clerk-react";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import EntryForm from "./pages/EntryForm";
import Students from "./pages/Students";
import StudentProfile from "./pages/StudentProfile";
import Goals from "./pages/Goals";
import GoalDetail from "./pages/GoalDetail";
import Documentation from "./pages/Documentation";
import Settings from "./pages/Settings";
import Help from "./pages/Help";

// Lazy-loaded pages (less frequently visited, larger bundles)
const Landing = lazy(() => import("./pages/Landing"));
const Reports = lazy(() => import("./pages/Reports"));
const Trends = lazy(() => import("./pages/Trends"));
const Assistant = lazy(() => import("./pages/Assistant"));

function PageFallback() {
  return (
    <div className="page-loading">
      <div className="spinner spinner--lg"></div>
    </div>
  );
}

function HomeRoute() {
  return (
    <>
      <SignedOut>
        <Suspense fallback={<PageFallback />}>
          <Landing />
        </Suspense>
      </SignedOut>
      <SignedIn>
        <Navigate to="/dashboard" replace />
      </SignedIn>
    </>
  );
}

function ProtectedLayout() {
  const { isLoaded, isSignedIn } = useAuth();

  // Show spinner while Clerk verifies the session
  if (!isLoaded) {
    return <PageFallback />;
  }

  // If Clerk confirms user is signed out, redirect to /login
  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
  }

  // All good — render the app layout with nested routes
  return <Layout />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedLayout />}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="entry" element={<EntryForm />} />
        <Route path="entry/:id" element={<EntryForm />} />
        <Route path="students" element={<Students />} />
        <Route path="students/:id" element={<StudentProfile />} />
        <Route path="goals" element={<Goals />} />
        <Route path="goals/:id" element={<GoalDetail />} />
        <Route path="reports" element={<Suspense fallback={<PageFallback />}><Reports /></Suspense>} />
        <Route path="trends" element={<Suspense fallback={<PageFallback />}><Trends /></Suspense>} />
        <Route path="documentation" element={<Documentation />} />
        <Route path="assistant" element={<Suspense fallback={<PageFallback />}><Assistant /></Suspense>} />
        <Route path="settings" element={<Settings />} />
        <Route path="help" element={<Help />} />
      </Route>
      {/* No catch-all — if no route matches, React Router renders nothing (we show spinner via ProtectedLayout) */}
    </Routes>
  );
}

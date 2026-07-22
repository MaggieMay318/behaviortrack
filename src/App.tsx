import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
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

export default function App() {
  return (
    <Routes>
      {/* Public: landing page for signed-out visitors, redirect to dashboard for signed-in */}
      <Route path="/" element={<HomeRoute />} />

      {/* Public: login page — only accessible when signed out */}
      <Route
        path="/login"
        element={
          <SignedOut>
            <Login />
          </SignedOut>
        }
      />

      {/* Protected: all app routes require sign-in */}
      <Route
        element={
          <SignedIn>
            <Layout />
          </SignedIn>
        }
      >
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

      {/* Catch-all: redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

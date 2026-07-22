// BehaviorTrack production server.
// Serves static client assets and API routes on port 3000.
// Run `bun run build` before starting. Restart with `bun run publish`.

import { getDb, seedDemoData } from "./src/db/schema.ts";
import type { Database } from "bun:sqlite";

const PORT = 3000;
const HOST = "0.0.0.0";
const DIST_DIR = `${import.meta.dir}/dist`;

// ---- Auth ----
const sessions = new Map<string, number>(); // token -> user_id

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function getUserFromRequest(req: Request): { id: number; [key: string]: unknown } | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const userId = sessions.get(token);
  if (!userId) return null;
  const db = getDb();
  return db.prepare("SELECT id, email, name, role, school_name, grade_levels, subjects, classroom_name FROM users WHERE id = ?").get(userId) as { id: number; [key: string]: unknown } | null;
}

function requireAuth(req: Request): { id: number; [key: string]: unknown } {
  const user = getUserFromRequest(req);
  if (!user) throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  return user;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseBody(req: Request): Promise<Record<string, unknown>> {
  return req.json().catch(() => ({}));
}

// ---- Route handlers ----
type Handler = (req: Request, params?: Record<string, string>) => Response | Promise<Response>;

const routes: Map<string, Handler> = new Map();

function route(method: string, path: string, handler: Handler): void {
  routes.set(`${method}:${path}`, handler);
}

function matchRoute(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | null {
  // Exact match first
  const exactKey = `${method}:${pathname}`;
  if (routes.has(exactKey)) return { handler: routes.get(exactKey)!, params: {} };

  // Parameterized routes
  for (const [key, handler] of routes) {
    const colonIdx = key.indexOf(":");
    const routeMethod = key.slice(0, colonIdx);
    const routePath = key.slice(colonIdx + 1);
    if (routeMethod !== method) continue;

    const routeParts = routePath.split("/");
    const pathParts = pathname.split("/");
    if (routeParts.length !== pathParts.length) continue;

    const params: Record<string, string> = {};
    let match = true;
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(":")) {
        params[routeParts[i].slice(1)] = pathParts[i];
      } else if (routeParts[i] !== pathParts[i]) {
        match = false;
        break;
      }
    }
    if (match) return { handler, params };
  }

  return null;
}

// ---- Register API routes ----

// Auth
route("POST", "/api/auth/register", async (req) => {
  const body = await parseBody(req);
  const { email, password, name, role } = body as Record<string, string>;
  if (!email || !password || !name) return json({ error: "email, password, and name are required" }, 400);

  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return json({ error: "Email already registered" }, 409);

  const hash = Bun.password.hashSync(password);
  const result = db.prepare(
    "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)"
  ).run(email, hash, name, role || "teacher");

  const token = generateToken();
  sessions.set(token, Number(result.lastInsertRowid));

  return json({ token, user: { id: Number(result.lastInsertRowid), email, name, role: role || "teacher" } }, 201);
});

route("POST", "/api/auth/login", async (req) => {
  const body = await parseBody(req);
  const { email, password } = body as Record<string, string>;
  if (!email || !password) return json({ error: "email and password are required" }, 400);

  const db = getDb();
  const user = db.prepare("SELECT id, email, password_hash, name, role FROM users WHERE email = ?").get(email) as { id: number; email: string; password_hash: string; name: string; role: string } | undefined;
  if (!user) return json({ error: "Invalid email or password" }, 401);

  const valid = Bun.password.verifySync(password, user.password_hash);
  if (!valid) return json({ error: "Invalid email or password" }, 401);

  const token = generateToken();
  sessions.set(token, user.id);

  return json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

route("GET", "/api/auth/me", (req) => {
  const user = requireAuth(req);
  return json({ user });
});

route("POST", "/api/auth/logout", (req) => {
  const auth = req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    sessions.delete(auth.slice(7));
  }
  return json({ ok: true });
});

// Clerk bridge — syncs Clerk-authenticated user with legacy token system
route("POST", "/api/auth/clerk-sync", async (req) => {
  const body = await parseBody(req);
  const { email, name } = body as Record<string, string>;
  if (!email || !name) return json({ error: "email and name are required" }, 400);

  const db = getDb();
  let user = db.prepare("SELECT id, email, name, role FROM users WHERE email = ?").get(email) as { id: number; email: string; name: string; role: string } | undefined;

  if (!user) {
    // Auto-create user for Clerk-authenticated accounts
    const hash = Bun.password.hashSync("clerk-" + crypto.randomUUID());
    const result = db.prepare(
      "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)"
    ).run(email, hash, name, "teacher");
    user = { id: Number(result.lastInsertRowid), email, name, role: "teacher" };
    console.log(`Created user via Clerk sync: ${email}`);
  }

  const token = generateToken();
  sessions.set(token, user.id);

  return json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

// Students
route("GET", "/api/students", (req) => {
  const user = requireAuth(req);
  const db = getDb();
  const url = new URL(req.url);
  const active = url.searchParams.get("active");
  let query = "SELECT * FROM students";
  if (active === "true") query += " WHERE active = 1";
  else if (active === "false") query += " WHERE active = 0";
  query += " ORDER BY display_name";
  const students = db.prepare(query).all() as Record<string, unknown>[];

  // Enrich with stats for list view
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const enriched = students.map((s: any) => {
    const activeGoals = (db.prepare("SELECT COUNT(*) as c FROM behavior_goals WHERE student_id = ? AND status NOT IN ('goal_met','discontinued')").get(s.id) as { c: number }).c;
    const entriesThisWeek = (db.prepare("SELECT COUNT(*) as c FROM behavior_entries WHERE student_id = ? AND date >= ?").get(s.id, weekAgo) as { c: number }).c;
    const positiveThisWeek = (db.prepare("SELECT COUNT(*) as c FROM behavior_entries WHERE student_id = ? AND entry_type = 'positive' AND date >= ?").get(s.id, weekAgo) as { c: number }).c;
    const pendingDocs = (db.prepare("SELECT COUNT(*) as c FROM behavior_entries WHERE student_id = ? AND doc_status = 'required_pending'").get(s.id) as { c: number }).c;
    return { ...s, activeGoals, entriesThisWeek, positiveThisWeek, pendingDocs };
  });

  return json({ students: enriched });
});

route("POST", "/api/students", async (req) => {
  requireAuth(req);
  const body = await parseBody(req);
  const { display_name, initials, local_id, grade, classroom } = body as Record<string, string>;
  if (!display_name || !initials) return json({ error: "display_name and initials are required" }, 400);

  const db = getDb();
  const result = db.prepare(
    "INSERT INTO students (display_name, initials, local_id, grade, classroom) VALUES (?, ?, ?, ?, ?)"
  ).run(display_name, initials, local_id || "", grade || "", classroom || "");

  const student = db.prepare("SELECT * FROM students WHERE id = ?").get(Number(result.lastInsertRowid));
  return json({ student }, 201);
});

route("GET", "/api/students/:id", (req, params) => {
  requireAuth(req);
  const db = getDb();
  const studentId = Number(params!.id);
  const student = db.prepare("SELECT * FROM students WHERE id = ?").get(studentId);
  if (!student) return json({ error: "Student not found" }, 404);

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  function count(sql: string, ...args: unknown[]): number {
    return (db.prepare(sql).get(...args) as { c: number }).c;
  }

  const totalEntries = count("SELECT COUNT(*) as c FROM behavior_entries WHERE student_id = ?", studentId);
  const positiveEntries = count("SELECT COUNT(*) as c FROM behavior_entries WHERE student_id = ? AND entry_type = 'positive'", studentId);
  const correctiveEntries = totalEntries - positiveEntries;
  const entriesThisWeek = count("SELECT COUNT(*) as c FROM behavior_entries WHERE student_id = ? AND date >= ?", studentId, weekAgo);

  const parentContacts = count("SELECT COUNT(*) as c FROM contacts WHERE student_id = ? AND contact_type = 'parent'", studentId);
  const counselorAdminContacts = count("SELECT COUNT(*) as c FROM contacts WHERE student_id = ? AND contact_type IN ('counselor','administrator')", studentId);

  const pendingDocs = count("SELECT COUNT(*) as c FROM behavior_entries WHERE student_id = ? AND doc_status = 'required_pending'", studentId);

  const followUpsDue = count(
    `SELECT COUNT(*) as c FROM follow_ups f
     JOIN behavior_entries e ON f.entry_id = e.id
     WHERE e.student_id = ? AND f.completed = 0 AND f.due_date <= ?`,
    studentId, today
  );

  const goals = db.prepare(
    "SELECT * FROM behavior_goals WHERE student_id = ? ORDER BY created_at DESC"
  ).all(studentId);

  // Enrich goals with latest progress
  const goalsWithProgress = (goals as any[]).map((g: any) => {
    const latestProgress = db.prepare(
      "SELECT * FROM goal_progress WHERE goal_id = ? ORDER BY date DESC LIMIT 1"
    ).get(g.id);
    const progressCount = count("SELECT COUNT(*) as c FROM goal_progress WHERE goal_id = ?", g.id);
    return { ...g, latestProgress, progressCount };
  });

  return json({
    student,
    stats: {
      totalEntries,
      positiveEntries,
      correctiveEntries,
      entriesThisWeek,
      parentContacts,
      counselorAdminContacts,
      pendingDocs,
      followUpsDue,
    },
    goals: goalsWithProgress,
  });
});

// Entries
route("GET", "/api/entries", (req) => {
  const user = requireAuth(req);
  const db = getDb();
  const url = new URL(req.url);
  const studentId = url.searchParams.get("student_id");
  const entryType = url.searchParams.get("entry_type");
  const severity = url.searchParams.get("severity"); // comma-separated entry_types
  const docStatus = url.searchParams.get("doc_status"); // comma-separated
  const dateFrom = url.searchParams.get("date_from");
  const dateTo = url.searchParams.get("date_to");
  const search = url.searchParams.get("search");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  let query = `
    SELECT e.*, s.display_name as student_name, s.initials as student_initials, s.grade as student_grade
    FROM behavior_entries e
    JOIN students s ON e.student_id = s.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (studentId) { query += " AND e.student_id = ?"; params.push(Number(studentId)); }
  if (entryType && !severity) { query += " AND e.entry_type = ?"; params.push(entryType); }

  // severity: comma-separated entry types
  if (severity) {
    const types = severity.split(",").map(s => s.trim()).filter(Boolean);
    if (types.length > 0) {
      query += ` AND e.entry_type IN (${types.map(() => "?").join(",")})`;
      params.push(...types);
    }
  }

  // doc_status: comma-separated
  if (docStatus) {
    const statuses = docStatus.split(",").map(s => s.trim()).filter(Boolean);
    if (statuses.length > 0) {
      query += ` AND e.doc_status IN (${statuses.map(() => "?").join(",")})`;
      params.push(...statuses);
    }
  }

  if (dateFrom) { query += " AND e.date >= ?"; params.push(dateFrom); }
  if (dateTo) { query += " AND e.date <= ?"; params.push(dateTo); }

  // search by student name
  if (search) {
    query += " AND s.display_name LIKE ?";
    params.push(`%${search}%`);
  }

  query += " ORDER BY e.date DESC, e.time DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const entries = db.prepare(query).all(...params);
  return json({ entries });
});

route("POST", "/api/entries", async (req) => {
  const user = requireAuth(req);
  const body = await parseBody(req);
  const { student_id, date, time, entry_type } = body as Record<string, unknown>;
  if (!student_id || !date || !time || !entry_type) {
    return json({ error: "student_id, date, time, and entry_type are required" }, 400);
  }

  const db = getDb();
  // Only include fields that are in the body or have known required values

  const fields: string[] = [];
  const values: unknown[] = [];
  const placeholders: string[] = [];

  const pushField = (name: string, val: unknown) => {
    fields.push(name);
    values.push(val);
    placeholders.push("?");
  };

  // Required
  pushField("student_id", Number(student_id));
  pushField("user_id", user.id);
  pushField("date", String(body.date || ""));
  pushField("time", String(body.time || ""));
  pushField("entry_type", String(body.entry_type || "minor_concern"));

  // Optional — only include if explicitly provided (let DB defaults handle the rest)
  const optionalStrings = [
    "subject_activity", "location", "staff_member", "people_involved",
    "frequency", "follow_up_date", "additional_notes", "attachment_url",
    "doc_system_name", "doc_reference_number", "doc_note", "objective_observation"
  ];
  for (const f of optionalStrings) {
    if (f in body) pushField(f, String(body[f] || ""));
  }

  const jsonArrays = ["behavior_categories", "possible_triggers", "interventions", "student_response", "outcome"];
  for (const f of jsonArrays) {
    if (f in body) pushField(f, JSON.stringify(body[f] || []));
  }

  const integers = ["duration_minutes"];
  for (const f of integers) {
    if (f in body) pushField(f, Number(body[f] || 0));
  }

  const booleans = ["property_damage", "injury"];
  for (const f of booleans) {
    if (f in body) pushField(f, Number(body[f] ? 1 : 0));
  }

  const contactStatuses = ["parent_contact_status", "admin_contact_status", "counselor_contact_status"];
  for (const f of contactStatuses) {
    if (f in body && body[f]) pushField(f, String(body[f]));
  }

  if ("doc_status" in body && body.doc_status) pushField("doc_status", String(body.doc_status));
  if ("doc_completion_date" in body && body.doc_completion_date) pushField("doc_completion_date", String(body.doc_completion_date));
  if ("confidential_notes" in body && body.confidential_notes) pushField("confidential_notes", String(body.confidential_notes));

  const query = `INSERT INTO behavior_entries (${fields.join(", ")}) VALUES (${placeholders.join(", ")})`;
  const result = db.prepare(query).run(...values);

  const entry = db.prepare(`
    SELECT e.*, s.display_name as student_name, s.initials as student_initials
    FROM behavior_entries e
    JOIN students s ON e.student_id = s.id
    WHERE e.id = ?
  `).get(Number(result.lastInsertRowid));

  return json({ entry }, 201);
});

route("GET", "/api/entries/:id", (req, params) => {
  requireAuth(req);
  const db = getDb();
  const entry = db.prepare(`
    SELECT e.*, s.display_name as student_name, s.initials as student_initials
    FROM behavior_entries e
    JOIN students s ON e.student_id = s.id
    WHERE e.id = ?
  `).get(Number(params!.id));
  if (!entry) return json({ error: "Entry not found" }, 404);
  return json({ entry });
});

route("PUT", "/api/entries/:id", async (req, params) => {
  const user = requireAuth(req);
  const db = getDb();
  const existing = db.prepare("SELECT * FROM behavior_entries WHERE id = ?").get(Number(params!.id));
  if (!existing) return json({ error: "Entry not found" }, 404);

  const body = await parseBody(req);
  const updatableFields = [
    "date", "time", "subject_activity", "location", "staff_member", "entry_type",
    "behavior_categories", "objective_observation", "possible_triggers", "interventions",
    "student_response", "outcome", "people_involved", "duration_minutes", "frequency",
    "property_damage", "injury", "parent_contact_status", "admin_contact_status",
    "counselor_contact_status", "follow_up_date", "additional_notes", "attachment_url",
    "confidential_notes", "doc_status", "doc_completion_date", "doc_system_name",
    "doc_reference_number", "doc_note"
  ];

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const f of updatableFields) {
    if (f in body) {
      let val: unknown;
      if (["behavior_categories", "possible_triggers", "interventions", "student_response", "outcome"].includes(f))
        val = JSON.stringify(body[f]);
      else if (["property_damage", "injury", "duration_minutes"].includes(f))
        val = Number(body[f]);
      else val = String(body[f] || "");
      sets.push(`${f} = ?`);
      values.push(val);
    }
  }

  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    values.push(Number(params!.id));
    db.prepare(`UPDATE behavior_entries SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  }

  const entry = db.prepare(`
    SELECT e.*, s.display_name as student_name, s.initials as student_initials
    FROM behavior_entries e
    JOIN students s ON e.student_id = s.id
    WHERE e.id = ?
  `).get(Number(params!.id));
  return json({ entry });
});

// Entry Stats (per-student chart data)
route("GET", "/api/entries/stats", (req) => {
  const user = requireAuth(req);
  const db = getDb();
  const url = new URL(req.url);
  const studentId = url.searchParams.get("student_id");
  if (!studentId) return json({ error: "student_id is required" }, 400);
  const sid = Number(studentId);

  function count(sql: string, ...args: unknown[]): number {
    return (db.prepare(sql).get(...args) as { c: number }).c;
  }

  const today = new Date();

  // By week (last 8 weeks)
  const byWeek: { week: string; positive: number; corrective: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);
    const ws = weekStart.toISOString().slice(0, 10);
    const we = weekEnd.toISOString().slice(0, 10);
    const pos = count(
      "SELECT COUNT(*) as c FROM behavior_entries WHERE student_id = ? AND entry_type = 'positive' AND date >= ? AND date <= ?",
      sid, ws, we
    );
    const corr = count(
      "SELECT COUNT(*) as c FROM behavior_entries WHERE student_id = ? AND entry_type != 'positive' AND date >= ? AND date <= ?",
      sid, ws, we
    );
    byWeek.push({ week: ws, positive: pos, corrective: corr });
  }

  // By day of week
  const dowMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const byDayOfWeek = dowMap.map(day => ({
    day,
    count: count(
      `SELECT COUNT(*) as c FROM behavior_entries WHERE student_id = ? AND CAST(strftime('%w', date) AS INTEGER) = ?`,
      sid, dowMap.indexOf(day)
    ),
  }));

  // By subject
  const bySubject = (db.prepare(
    "SELECT subject_activity as name, COUNT(*) as count FROM behavior_entries WHERE student_id = ? AND subject_activity != '' GROUP BY subject_activity ORDER BY count DESC LIMIT 10"
  ).all(sid) as { name: string; count: number }[]);

  // By location
  const byLocation = (db.prepare(
    "SELECT location as name, COUNT(*) as count FROM behavior_entries WHERE student_id = ? AND location != '' GROUP BY location ORDER BY count DESC LIMIT 10"
  ).all(sid) as { name: string; count: number }[]);

  // Behavior categories
  const allCats = db.prepare("SELECT behavior_categories FROM behavior_entries WHERE student_id = ? AND behavior_categories != '[]'").all(sid) as { behavior_categories: string }[];
  const catMap = new Map<string, number>();
  for (const e of allCats) {
    try { for (const c of JSON.parse(e.behavior_categories)) catMap.set(c, (catMap.get(c) || 0) + 1); } catch {}
  }
  const byCategory = [...catMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));

  // Triggers
  const allTrigs = db.prepare("SELECT possible_triggers FROM behavior_entries WHERE student_id = ? AND possible_triggers != '[]'").all(sid) as { possible_triggers: string }[];
  const trigMap = new Map<string, number>();
  for (const e of allTrigs) {
    try { for (const t of JSON.parse(e.possible_triggers)) trigMap.set(t, (trigMap.get(t) || 0) + 1); } catch {}
  }
  const byTrigger = [...trigMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));

  // Interventions + effectiveness
  const allIntvs = db.prepare(
    "SELECT interventions, outcome FROM behavior_entries WHERE student_id = ? AND entry_type != 'positive' AND interventions != '[]'"
  ).all(sid) as { interventions: string; outcome: string }[];
  const intvMap = new Map<string, { stopped: number; decreased: number; continued: number; escalated: number }>();
  for (const row of allIntvs) {
    try {
      const intvs: string[] = JSON.parse(row.interventions);
      const outcomes: string[] = JSON.parse(row.outcome);
      const outcome = outcomes[0] || "";
      for (const intv of intvs) {
        if (!intvMap.has(intv)) intvMap.set(intv, { stopped: 0, decreased: 0, continued: 0, escalated: 0 });
        const entry = intvMap.get(intv)!;
        if (outcome === "Stopped") entry.stopped++;
        else if (outcome === "Decreased") entry.decreased++;
        else if (outcome === "Escalated") entry.escalated++;
        else entry.continued++;
      }
    } catch {}
  }
  const byIntervention = [...intvMap.entries()]
    .sort((a, b) => (b[1].stopped + b[1].decreased + b[1].continued + b[1].escalated) - (a[1].stopped + a[1].decreased + a[1].continued + a[1].escalated))
    .slice(0, 10)
    .map(([name, counts]) => ({ name, ...counts }));

  // Positive vs corrective over time (reuse byWeek format)
  const positiveVsCorrectiveOverTime = byWeek.map(w => ({ week: w.week, positive: w.positive, corrective: w.corrective }));

  return json({
    byWeek,
    byDayOfWeek,
    bySubject,
    byLocation,
    byCategory,
    byTrigger,
    byIntervention,
    positiveVsCorrectiveOverTime,
  });
});

// Goals
route("GET", "/api/goals", (req) => {
  const user = requireAuth(req);
  const db = getDb();
  const url = new URL(req.url);
  const studentId = url.searchParams.get("student_id");
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search");

  let query = `
    SELECT g.*, s.display_name as student_name, s.initials as student_initials, s.grade as student_grade
    FROM behavior_goals g
    JOIN students s ON g.student_id = s.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];
  if (studentId) { query += " AND g.student_id = ?"; params.push(Number(studentId)); }
  if (status) { query += " AND g.status = ?"; params.push(status); }
  if (search) { query += " AND (s.display_name LIKE ? OR g.title LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }
  query += " ORDER BY g.created_at DESC";

  const goals = (db.prepare(query).all(...params) as any[]).map((g: any) => {
    const progressCount = (db.prepare("SELECT COUNT(*) as c FROM goal_progress WHERE goal_id = ?").get(g.id) as { c: number }).c;
    const avgRating = db.prepare("SELECT AVG(rating) as a FROM goal_progress WHERE goal_id = ?").get(g.id) as { a: number | null };
    return { ...g, progressCount, avgRating: avgRating.a ? Math.round(avgRating.a * 10) / 10 : null };
  });
  return json({ goals });
});

route("POST", "/api/goals", async (req) => {
  const user = requireAuth(req);
  const body = await parseBody(req);
  const { student_id, title, start_date } = body as Record<string, string>;
  if (!student_id || !title || !start_date) return json({ error: "student_id, title, and start_date are required" }, 400);

  const db = getDb();
  const fields = ["student_id", "user_id", "title", "description", "start_date", "review_date",
    "target_behavior", "measurement_method", "baseline", "target", "tracking_frequency",
    "responsible_staff", "supports", "status"];
  const values: unknown[] = [];
  const placeholders: string[] = [];

  for (const f of fields) {
    let val: unknown;
    if (f === "user_id") val = user.id;
    else if (f === "student_id") val = Number(student_id);
    else if (f === "supports") val = JSON.stringify(body[f] || []);
    else val = String(body[f] || "");
    values.push(val);
    placeholders.push("?");
  }

  const result = db.prepare(`INSERT INTO behavior_goals (${fields.join(", ")}) VALUES (${placeholders.join(", ")})`).run(...values);
  const goal = db.prepare("SELECT * FROM behavior_goals WHERE id = ?").get(Number(result.lastInsertRowid));
  return json({ goal }, 201);
});

route("GET", "/api/goals/:id", (req, params) => {
  requireAuth(req);
  const db = getDb();
  const goal = db.prepare(`
    SELECT g.*, s.display_name as student_name, s.initials as student_initials, s.grade as student_grade
    FROM behavior_goals g
    JOIN students s ON g.student_id = s.id
    WHERE g.id = ?
  `).get(Number(params!.id));
  if (!goal) return json({ error: "Goal not found" }, 404);

  const progress = db.prepare("SELECT * FROM goal_progress WHERE goal_id = ? ORDER BY date DESC").all(Number(params!.id));
  return json({ goal, progress });
});

route("PUT", "/api/goals/:id", async (req, params) => {
  const user = requireAuth(req);
  const db = getDb();
  const existing = db.prepare("SELECT * FROM behavior_goals WHERE id = ?").get(Number(params!.id));
  if (!existing) return json({ error: "Goal not found" }, 404);

  const body = await parseBody(req);
  const updatableFields = [
    "title", "description", "start_date", "review_date", "target_behavior",
    "measurement_method", "baseline", "target", "tracking_frequency",
    "responsible_staff", "supports", "status"
  ];

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const f of updatableFields) {
    if (f in body) {
      let val: unknown;
      if (f === "supports") val = JSON.stringify(body[f] || []);
      else val = String(body[f] || "");
      sets.push(`${f} = ?`);
      values.push(val);
    }
  }

  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    values.push(Number(params!.id));
    db.prepare(`UPDATE behavior_goals SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  }

  const goal = db.prepare(`
    SELECT g.*, s.display_name as student_name, s.initials as student_initials, s.grade as student_grade
    FROM behavior_goals g
    JOIN students s ON g.student_id = s.id
    WHERE g.id = ?
  `).get(Number(params!.id));
  return json({ goal });
});

route("POST", "/api/goals/:id/progress", async (req, params) => {
  const user = requireAuth(req);
  const db = getDb();
  const goalId = Number(params!.id);
  const goal = db.prepare("SELECT * FROM behavior_goals WHERE id = ?").get(goalId);
  if (!goal) return json({ error: "Goal not found" }, 404);

  const body = await parseBody(req);
  const { date, notes, rating } = body as Record<string, unknown>;
  if (!date || rating === undefined) return json({ error: "date and rating are required" }, 400);

  const ratingNum = Number(rating);
  if (ratingNum < 1 || ratingNum > 5) return json({ error: "rating must be 1-5" }, 400);

  db.prepare(
    "INSERT INTO goal_progress (goal_id, date, notes, rating) VALUES (?, ?, ?, ?)"
  ).run(goalId, String(date), String(notes || ""), ratingNum);

  const progress = db.prepare("SELECT * FROM goal_progress WHERE goal_id = ? ORDER BY date DESC").all(goalId);
  return json({ progress }, 201);
});

route("DELETE", "/api/goals/:id", (req, params) => {
  const user = requireAuth(req);
  const db = getDb();
  const goalId = Number(params!.id);
  const existing = db.prepare("SELECT * FROM behavior_goals WHERE id = ?").get(goalId);
  if (!existing) return json({ error: "Goal not found" }, 404);

  db.prepare("DELETE FROM goal_progress WHERE goal_id = ?").run(goalId);
  db.prepare("DELETE FROM behavior_goals WHERE id = ?").run(goalId);
  return json({ ok: true });
});

// Demo request — public, no auth required
route("POST", "/api/demo-request", async (req) => {
  const body = await parseBody(req);
  const { name, email, role, school, interest } = body as Record<string, string>;

  if (!name || !name.trim()) return json({ error: "Name is required" }, 400);
  if (!email || !email.trim()) return json({ error: "Email is required" }, 400);

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return json({ error: "Please enter a valid email address" }, 400);
  }

  const submission = {
    name: name.trim(),
    email: email.trim(),
    role: (role || "").trim(),
    school: (school || "").trim(),
    interest: (interest || "").trim(),
    submittedAt: new Date().toISOString(),
  };

  // Ensure data directory exists
  const dataDir = `${import.meta.dir}/data`;
  await Bun.write(`${dataDir}/.gitkeep`, "").catch(() => {});

  const filePath = `${dataDir}/demo-requests.json`;

  // Read existing submissions, append new one
  let submissions: typeof submission[] = [];
  try {
    const existing = await Bun.file(filePath).text();
    submissions = JSON.parse(existing);
  } catch {
    // File doesn't exist yet — start fresh
  }

  submissions.push(submission);

  await Bun.write(filePath, JSON.stringify(submissions, null, 2));

  console.log(`Demo request from ${submission.name} <${submission.email}>`);

  return json({
    success: true,
    message: "Thank you! We'll be in touch.",
  });
});

// Documentation Queue stats
route("GET", "/api/documentation/stats", (req) => {
  const user = requireAuth(req);
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  function count(sql: string, ...params: unknown[]): number {
    return (db.prepare(sql).get(...params) as { c: number }).c;
  }

  // This week (Mon-Sun)
  const dayOfWeek = new Date().getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = new Date();
  thisMonday.setDate(thisMonday.getDate() - mondayOffset);
  const thisMondayStr = thisMonday.toISOString().slice(0, 10);

  const pendingCount = count(
    "SELECT COUNT(*) as c FROM behavior_entries WHERE doc_status = 'required_pending'"
  );
  const needsClarificationCount = count(
    "SELECT COUNT(*) as c FROM behavior_entries WHERE doc_status = 'needs_clarification'"
  );
  const completedThisWeek = count(
    "SELECT COUNT(*) as c FROM behavior_entries WHERE doc_status = 'completed' AND doc_completion_date >= ?",
    thisMondayStr
  );

  const totalRequiring = pendingCount + needsClarificationCount + completedThisWeek;
  const completionRate = totalRequiring > 0
    ? Math.round((completedThisWeek / totalRequiring) * 100)
    : 0;

  // Overdue: required_pending older than 7 calendar days
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const overdueCount = count(
    "SELECT COUNT(*) as c FROM behavior_entries WHERE doc_status = 'required_pending' AND date < ?",
    sevenDaysAgo
  );

  return json({
    pendingCount,
    needsClarificationCount,
    completedThisWeek,
    completionRate,
    overdueCount,
  });
});

// Dashboard stats
route("GET", "/api/dashboard/stats", (req) => {
  const user = requireAuth(req);
  const db = getDb();

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  // Week boundaries (Mon-Sun)
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // days since Monday
  const thisMonday = new Date(today);
  thisMonday.setDate(thisMonday.getDate() - mondayOffset);
  const thisMondayStr = thisMonday.toISOString().slice(0, 10);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  const lastSundayStr = new Date(thisMonday.getTime() - 86400000).toISOString().slice(0, 10);
  const lastMondayStr = lastMonday.toISOString().slice(0, 10);

  function count(sql: string, ...params: unknown[]): number {
    return (db.prepare(sql).get(...params) as { c: number }).c;
  }

  // ---- Stat Cards ----
  const totalThisWeek = count(
    "SELECT COUNT(*) as c FROM behavior_entries WHERE date >= ? AND date <= ?",
    thisMondayStr, todayStr
  );
  const totalLastWeek = count(
    "SELECT COUNT(*) as c FROM behavior_entries WHERE date >= ? AND date <= ?",
    lastMondayStr, lastSundayStr
  );
  const weeklyChange = totalLastWeek > 0
    ? ((totalThisWeek - totalLastWeek) / totalLastWeek * 100)
    : (totalThisWeek > 0 ? 100 : 0);

  const positiveThisWeek = count(
    "SELECT COUNT(*) as c FROM behavior_entries WHERE entry_type = 'positive' AND date >= ? AND date <= ?",
    thisMondayStr, todayStr
  );
  const correctiveThisWeek = totalThisWeek - positiveThisWeek;
  const activeStudentsCount = count("SELECT COUNT(DISTINCT student_id) as c FROM behavior_entries WHERE date >= ?", thisMondayStr);

  const pendingDocs = count(
    "SELECT COUNT(*) as c FROM behavior_entries WHERE doc_status = 'required_pending'"
  );

  const followUpsDue = count(
    `SELECT COUNT(*) as c FROM follow_ups f
     JOIN behavior_entries e ON f.entry_id = e.id
     WHERE f.completed = 0 AND f.due_date <= ?`,
    todayStr
  );

  const parentContactsPending = count(
    `SELECT COUNT(*) as c FROM behavior_entries
     WHERE parent_contact_status IN ('not_contacted','voicemail')
     AND entry_type IN ('major_concern','crisis','moderate_concern')
     AND date >= ?`,
    new Date(today.getTime() - 14 * 86400000).toISOString().slice(0, 10)
  );

  // Intervention success rate: outcomes containing "Stopped" or "Decreased"
  const totalCorrective = count(
    "SELECT COUNT(*) as c FROM behavior_entries WHERE entry_type != 'positive'"
  );
  const successfulOutcomes = count(
    `SELECT COUNT(*) as c FROM behavior_entries
     WHERE entry_type != 'positive'
     AND (outcome LIKE '%Stopped%' OR outcome LIKE '%Decreased%')`
  );
  const interventionSuccessRate = totalCorrective > 0
    ? Math.round(successfulOutcomes / totalCorrective * 100)
    : 0;

  const stats = {
    totalEntriesThisWeek: totalThisWeek,
    weeklyChangePct: Math.round(weeklyChange),
    positiveCount: positiveThisWeek,
    correctiveCount: correctiveThisWeek,
    activeStudentsCount,
    pendingDocs,
    followUpsDue,
    parentContactsPending,
    interventionSuccessRate,
  };

  // ---- Entries by Day (last 7 days as Mon-Sun) ----
  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const entriesByDay: { day: string; positive: number; corrective: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(thisMonday);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const pos = count("SELECT COUNT(*) as c FROM behavior_entries WHERE entry_type='positive' AND date=?", ds);
    const corr = count("SELECT COUNT(*) as c FROM behavior_entries WHERE entry_type!='positive' AND date=?", ds);
    entriesByDay.push({ day: daysOfWeek[(d.getDay() + 6) % 7], positive: pos, corrective: corr });
  }

  // ---- Entries by Time of Day ----
  const morning = count(
    "SELECT COUNT(*) as c FROM behavior_entries WHERE CAST(substr(time,1,2) AS INTEGER) < 12"
  );
  const afternoon = count(
    "SELECT COUNT(*) as c FROM behavior_entries WHERE CAST(substr(time,1,2) AS INTEGER) >= 12"
  );
  const entriesByTime = [
    { label: "Morning", count: morning },
    { label: "Afternoon", count: afternoon },
  ];

  // ---- Positive vs Corrective ----
  const totalPositive = count("SELECT COUNT(*) as c FROM behavior_entries WHERE entry_type='positive'");
  const totalCorrectiveAll = count("SELECT COUNT(*) as c FROM behavior_entries WHERE entry_type!='positive'");

  // ---- Top Behavior Categories ----
  const allEntries = db.prepare("SELECT behavior_categories FROM behavior_entries WHERE behavior_categories != '[]'").all() as { behavior_categories: string }[];
  const catCounts = new Map<string, number>();
  for (const e of allEntries) {
    try {
      const cats: string[] = JSON.parse(e.behavior_categories);
      for (const c of cats) catCounts.set(c, (catCounts.get(c) || 0) + 1);
    } catch {}
  }
  const topCategories = [...catCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  // ---- Top Triggers ----
  const allTriggers = db.prepare("SELECT possible_triggers FROM behavior_entries WHERE possible_triggers != '[]'").all() as { possible_triggers: string }[];
  const trigCounts = new Map<string, number>();
  for (const e of allTriggers) {
    try {
      const trs: string[] = JSON.parse(e.possible_triggers);
      for (const t of trs) trigCounts.set(t, (trigCounts.get(t) || 0) + 1);
    } catch {}
  }
  const topTriggers = [...trigCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  // ---- Intervention Effectiveness ----
  const allInterventions = db.prepare(
    "SELECT interventions, outcome FROM behavior_entries WHERE entry_type != 'positive' AND interventions != '[]'"
  ).all() as { interventions: string; outcome: string }[];
  const intvMap = new Map<string, { stopped: number; decreased: number; continued: number; escalated: number }>();
  for (const row of allInterventions) {
    try {
      const intvs: string[] = JSON.parse(row.interventions);
      const outcomes: string[] = JSON.parse(row.outcome);
      const outcome = outcomes[0] || "";
      for (const intv of intvs) {
        if (!intvMap.has(intv)) intvMap.set(intv, { stopped: 0, decreased: 0, continued: 0, escalated: 0 });
        const entry = intvMap.get(intv)!;
        if (outcome === "Stopped") entry.stopped++;
        else if (outcome === "Decreased") entry.decreased++;
        else if (outcome === "Escalated") entry.escalated++;
        else entry.continued++;
      }
    } catch {}
  }
  const interventionEffectiveness = [...intvMap.entries()]
    .sort((a, b) => (b[1].stopped + b[1].decreased + b[1].continued + b[1].escalated) - (a[1].stopped + a[1].decreased + a[1].continued + a[1].escalated))
    .slice(0, 8)
    .map(([name, counts]) => ({ name, ...counts }));

  // ---- Student Trends (last 14 days vs prior 14 days) ----
  const students = db.prepare("SELECT id, display_name, initials FROM students WHERE active=1").all() as { id: number; display_name: string; initials: string }[];
  const now14 = todayStr;
  const mid14 = new Date(today.getTime() - 14 * 86400000).toISOString().slice(0, 10);
  const start28 = new Date(today.getTime() - 28 * 86400000).toISOString().slice(0, 10);

  const studentsIncreased: { id: number; name: string; initials: string; recent: number; prior: number; change: number }[] = [];
  const studentsImproved: { id: number; name: string; initials: string; recent: number; prior: number; change: number }[] = [];

  for (const s of students) {
    const recent = count(
      "SELECT COUNT(*) as c FROM behavior_entries WHERE student_id=? AND entry_type!='positive' AND date>=? AND date<=?",
      s.id, mid14, now14
    );
    const prior = count(
      "SELECT COUNT(*) as c FROM behavior_entries WHERE student_id=? AND entry_type!='positive' AND date>=? AND date<?",
      s.id, start28, mid14
    );
    const change = prior > 0 ? ((recent - prior) / prior * 100) : (recent > 0 ? 100 : 0);
    if (recent > prior && recent >= 2) {
      studentsIncreased.push({ id: s.id, name: s.display_name, initials: s.initials, recent, prior, change: Math.round(change) });
    } else if (recent < prior && prior >= 2) {
      studentsImproved.push({ id: s.id, name: s.display_name, initials: s.initials, recent, prior, change: Math.round(Math.abs(change)) });
    }
  }
  studentsIncreased.sort((a, b) => b.change - a.change);
  studentsImproved.sort((a, b) => b.change - a.change);

  // ---- Recent Entries ----
  const recentEntries = db.prepare(`
    SELECT e.*, s.display_name as student_name, s.initials as student_initials
    FROM behavior_entries e
    JOIN students s ON e.student_id = s.id
    ORDER BY e.date DESC, e.time DESC
    LIMIT 10
  `).all();

  // ---- By Type ----
  const byType = db.prepare(`
    SELECT entry_type, COUNT(*) as count
    FROM behavior_entries
    GROUP BY entry_type
  `).all();

  // ---- Alerts ----
  const alerts: { type: string; message: string; detail: string; priority: string }[] = [];

  // Overdue documentation (required_pending, older than 5 school days from today)
  const fiveDaysAgo = new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const overdueDocs = db.prepare(`
    SELECT COUNT(*) as c FROM behavior_entries
    WHERE doc_status='required_pending' AND date < ?
  `).get(fiveDaysAgo) as { c: number };
  if (overdueDocs.c > 0) {
    alerts.push({
      type: "overdue_docs",
      message: `${overdueDocs.c} entries overdue for official documentation`,
      detail: "These entries were marked as requiring documentation more than 5 school days ago.",
      priority: "high",
    });
  }

  // Missing outcomes
  const missingOutcomes = count(
    `SELECT COUNT(*) as c FROM behavior_entries
     WHERE entry_type != 'positive' AND (outcome='[]' OR outcome='')`
  );
  if (missingOutcomes > 0) {
    alerts.push({
      type: "missing_outcomes",
      message: `${missingOutcomes} entries missing outcome data`,
      detail: "Recording outcomes helps track intervention effectiveness.",
      priority: "medium",
    });
  }

  // Due follow-ups
  if (followUpsDue > 0) {
    alerts.push({
      type: "due_followups",
      message: `${followUpsDue} follow-ups due or overdue`,
      detail: "Check the Goals page for follow-up actions that need attention.",
      priority: "high",
    });
  }

  // Goals needing review
  const goalsNeedingReview = count(
    "SELECT COUNT(*) as c FROM behavior_goals WHERE review_date <= ? AND status NOT IN ('goal_met','discontinued')",
    todayStr
  );
  if (goalsNeedingReview > 0) {
    alerts.push({
      type: "goals_review",
      message: `${goalsNeedingReview} behavior goals need review`,
      detail: "These goals have review dates that are today or in the past.",
      priority: "medium",
    });
  }

  // Unusual spike alerts (students with >50% increase and >=3 recent entries)
  for (const s of studentsIncreased) {
    if (s.change >= 50 && s.recent >= 3) {
      alerts.push({
        type: "spike",
        message: `Increased incidents: ${s.name} (${s.initials})`,
        detail: `${s.recent} corrective entries in last 14 days vs ${s.prior} in prior 14 days (${s.change}% increase).`,
        priority: "medium",
      });
    }
  }

  return json({
    stats,
    entriesByDay,
    entriesByTime,
    positiveVsCorrective: { positive: totalPositive, corrective: totalCorrectiveAll },
    topCategories,
    topTriggers,
    interventionEffectiveness,
    studentsIncreased,
    studentsImproved,
    recentEntries,
    byType,
    alerts,
  });
});

// Trends stats — classroom-wide aggregated data (no per-student rankings)
route("GET", "/api/trends/stats", (req) => {
  const user = requireAuth(req);
  const db = getDb();
  const url = new URL(req.url);

  const dateFrom = url.searchParams.get("date_from") || "";
  const dateTo = url.searchParams.get("date_to") || "";
  const grade = url.searchParams.get("grade") || "";
  const subject = url.searchParams.get("subject") || "";
  const location = url.searchParams.get("location") || "";
  const behaviorCategory = url.searchParams.get("behavior_category") || "";
  const entryType = url.searchParams.get("entry_type") || "all"; // "positive", "corrective", "all"
  const severity = url.searchParams.get("severity") || ""; // comma-separated entry_types

  function count(sql: string, ...args: unknown[]): number {
    return (db.prepare(sql).get(...args) as { c: number }).c;
  }

  // Build WHERE clause
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (dateFrom) { conditions.push("e.date >= ?"); params.push(dateFrom); }
  if (dateTo) { conditions.push("e.date <= ?"); params.push(dateTo); }
  if (grade) { conditions.push("s.grade = ?"); params.push(grade); }
  if (subject) { conditions.push("e.subject_activity = ?"); params.push(subject); }
  if (location) { conditions.push("e.location = ?"); params.push(location); }
  if (behaviorCategory) { conditions.push("e.behavior_categories LIKE ?"); params.push(`%${behaviorCategory}%`); }

  if (entryType === "positive") {
    conditions.push("e.entry_type = 'positive'");
  } else if (entryType === "corrective") {
    conditions.push("e.entry_type != 'positive'");
  }

  if (severity) {
    const types = severity.split(",").map(s => s.trim()).filter(Boolean);
    if (types.length > 0) {
      conditions.push(`e.entry_type IN (${types.map(() => "?").join(",")})`);
      params.push(...types);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const baseParams = [...params];

  // Helper: run query with join
  function query(sql: string, ...extraParams: (string | number)[]): any[] {
    return db.prepare(sql).all(...[...baseParams, ...extraParams]) as any[];
  }

  function countFiltered(extraCondition = "", ...extraP: (string | number)[]): number {
    let q = `SELECT COUNT(*) as c FROM behavior_entries e JOIN students s ON e.student_id = s.id ${whereClause}`;
    if (extraCondition) q += ` AND ${extraCondition}`;
    return (db.prepare(q).get(...[...baseParams, ...extraP]) as { c: number }).c;
  }

  // ---- 1. By Day of Week ----
  const dowMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const byDayOfWeek = dowMap.map(day => {
    const idx = dowMap.indexOf(day);
    const pos = countFiltered(
      `CAST(strftime('%w', e.date) AS INTEGER) = ? AND e.entry_type = 'positive'`, idx
    );
    const corr = countFiltered(
      `CAST(strftime('%w', e.date) AS INTEGER) = ? AND e.entry_type != 'positive'`, idx
    );
    return { day, positive: pos, corrective: corr };
  });

  // ---- 2. By Time of Day ----
  const morning = countFiltered("CAST(substr(e.time,1,2) AS INTEGER) < 11");
  const lunch = countFiltered("CAST(substr(e.time,1,2) AS INTEGER) >= 11 AND CAST(substr(e.time,1,2) AS INTEGER) < 13");
  const afternoon = countFiltered("CAST(substr(e.time,1,2) AS INTEGER) >= 13");
  const byTimeOfDay = [
    { label: "Morning", count: morning },
    { label: "Lunch", count: lunch },
    { label: "Afternoon", count: afternoon },
  ];

  // ---- 3. By Subject ----
  const bySubject = query(
    `SELECT e.subject_activity as name, COUNT(*) as count
     FROM behavior_entries e JOIN students s ON e.student_id = s.id ${whereClause}
     AND e.subject_activity != '' GROUP BY e.subject_activity ORDER BY count DESC LIMIT 8`
  );

  // ---- 4. By Location ----
  const byLocation = query(
    `SELECT e.location as name, COUNT(*) as count
     FROM behavior_entries e JOIN students s ON e.student_id = s.id ${whereClause}
     AND e.location != '' GROUP BY e.location ORDER BY count DESC LIMIT 8`
  );

  // ---- 5. Positive vs Corrective ----
  const totalPos = countFiltered("e.entry_type = 'positive'");
  const totalCorr = countFiltered("e.entry_type != 'positive'");

  // ---- 6. Top Behavior Categories ----
  const allEntriesCats = query(
    `SELECT e.behavior_categories FROM behavior_entries e JOIN students s ON e.student_id = s.id ${whereClause} AND e.behavior_categories != '[]'`
  );
  const catMap = new Map<string, number>();
  for (const row of allEntriesCats) {
    try { for (const c of JSON.parse(row.behavior_categories)) catMap.set(c, (catMap.get(c) || 0) + 1); } catch {}
  }
  const topCategories = [...catMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));

  // ---- 7. Top Possible Triggers ----
  const allEntriesTrigs = query(
    `SELECT e.possible_triggers FROM behavior_entries e JOIN students s ON e.student_id = s.id ${whereClause} AND e.possible_triggers != '[]'`
  );
  const trigMap = new Map<string, number>();
  for (const row of allEntriesTrigs) {
    try { for (const t of JSON.parse(row.possible_triggers)) trigMap.set(t, (trigMap.get(t) || 0) + 1); } catch {}
  }
  const topTriggers = [...trigMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));

  // ---- 8. Intervention Effectiveness ----
  const allIntvs = query(
    `SELECT e.interventions, e.outcome FROM behavior_entries e JOIN students s ON e.student_id = s.id ${whereClause} AND e.entry_type != 'positive' AND e.interventions != '[]'`
  );
  const intvMap = new Map<string, { stopped: number; decreased: number; continued: number; escalated: number }>();
  for (const row of allIntvs) {
    try {
      const intvs: string[] = JSON.parse(row.interventions);
      const outcomes: string[] = JSON.parse(row.outcome);
      const outcome = outcomes[0] || "";
      for (const intv of intvs) {
        if (!intvMap.has(intv)) intvMap.set(intv, { stopped: 0, decreased: 0, continued: 0, escalated: 0 });
        const entry = intvMap.get(intv)!;
        if (outcome === "Stopped") entry.stopped++;
        else if (outcome === "Decreased") entry.decreased++;
        else if (outcome === "Escalated") entry.escalated++;
        else entry.continued++;
      }
    } catch {}
  }
  const interventionEffectiveness = [...intvMap.entries()]
    .sort((a, b) => (b[1].stopped + b[1].decreased + b[1].continued + b[1].escalated) - (a[1].stopped + a[1].decreased + a[1].continued + a[1].escalated))
    .slice(0, 10)
    .map(([name, counts]) => ({ name, ...counts }));

  // ---- 9. Severity Distribution ----
  const severityDistribution = query(
    `SELECT e.entry_type, COUNT(*) as count
     FROM behavior_entries e JOIN students s ON e.student_id = s.id ${whereClause}
     GROUP BY e.entry_type ORDER BY count DESC`
  );

  // ---- 10. Entries Over Time (daily) ----
  const entriesOverTime = query(
    `SELECT e.date, e.entry_type, COUNT(*) as count
     FROM behavior_entries e JOIN students s ON e.student_id = s.id ${whereClause}
     GROUP BY e.date, e.entry_type ORDER BY e.date`
  ) as { date: string; entry_type: string; count: number }[];

  // Pivot to daily positive/corrective
  const dailyMap = new Map<string, { positive: number; corrective: number }>();
  for (const row of entriesOverTime) {
    if (!dailyMap.has(row.date)) dailyMap.set(row.date, { positive: 0, corrective: 0 });
    const entry = dailyMap.get(row.date)!;
    if (row.entry_type === "positive") entry.positive += row.count;
    else entry.corrective += row.count;
  }
  const entriesOverTimePivoted = [...dailyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, counts]) => ({ date, ...counts }));

  // ---- 11. Documentation Completion ----
  const docCompleted = countFiltered("e.doc_status = 'completed'");
  const docPending = countFiltered("e.doc_status IN ('required_pending','needs_clarification')");
  const docNotRequired = countFiltered("e.doc_status = 'not_required'");

  // ---- 12. Contact Status ----
  const parentContacted = countFiltered("e.parent_contact_status = 'contacted'");
  const parentPending = countFiltered("e.parent_contact_status IN ('not_contacted','voicemail') AND e.parent_contact_status != ''");
  const adminContacted = countFiltered("e.admin_contact_status = 'contacted'");
  const adminPending = countFiltered("e.admin_contact_status IN ('not_contacted','voicemail') AND e.admin_contact_status != ''");
  const counselorContacted = countFiltered("e.counselor_contact_status = 'contacted'");
  const counselorPending = countFiltered("e.counselor_contact_status IN ('not_contacted','voicemail') AND e.counselor_contact_status != ''");

  // ---- Summary stats ----
  const totalEntries = totalPos + totalCorr;
  const ratio = totalCorr > 0 ? (totalPos / totalCorr) : (totalPos > 0 ? totalPos : 0);

  const mostCommonBehavior = topCategories.length > 0 ? topCategories[0].name : "N/A";
  const mostCommonTrigger = topTriggers.length > 0 ? topTriggers[0].name : "N/A";

  const totalRequiring = docCompleted + docPending;
  const docCompletionRate = totalRequiring > 0 ? Math.round((docCompleted / totalRequiring) * 100) : 0;

  // Most effective intervention
  let mostEffective = "N/A";
  if (interventionEffectiveness.length > 0) {
    const ie = interventionEffectiveness[0];
    const successRate = ie.stopped + ie.decreased;
    const totalIE = successRate + ie.continued + ie.escalated;
    if (totalIE > 0) {
      mostEffective = `${ie.name} (${Math.round((successRate / totalIE) * 100)}%)`;
    }
  }

  // ---- Available filter values ----
  const allGrades = db.prepare("SELECT DISTINCT grade FROM students WHERE grade != '' ORDER BY grade").all() as { grade: string }[];
  const allSubjects = db.prepare("SELECT DISTINCT subject_activity FROM behavior_entries WHERE subject_activity != '' ORDER BY subject_activity").all() as { subject_activity: string }[];
  const allLocations = db.prepare("SELECT DISTINCT location FROM behavior_entries WHERE location != '' ORDER BY location").all() as { location: string }[];

  return json({
    summary: {
      totalEntries,
      positiveCount: totalPos,
      correctiveCount: totalCorr,
      positivePct: totalEntries > 0 ? Math.round((totalPos / totalEntries) * 100) : 0,
      correctivePct: totalEntries > 0 ? Math.round((totalCorr / totalEntries) * 100) : 0,
      ratio: Math.round(ratio * 10) / 10,
      mostCommonBehavior,
      mostCommonTrigger,
      mostEffectiveIntervention: mostEffective,
      docCompletionRate,
    },
    byDayOfWeek,
    byTimeOfDay,
    bySubject,
    byLocation,
    positiveVsCorrective: { positive: totalPos, corrective: totalCorr },
    topCategories,
    topTriggers,
    interventionEffectiveness,
    severityDistribution,
    entriesOverTime: entriesOverTimePivoted,
    documentationCompletion: { completed: docCompleted, pending: docPending, notRequired: docNotRequired },
    contactStatus: {
      parentContacted,
      parentPending,
      adminContacted,
      adminPending,
      counselorContacted,
      counselorPending,
    },
    filters: {
      grades: allGrades.map((r: any) => r.grade),
      subjects: allSubjects.map((r: any) => r.subject_activity),
      locations: allLocations.map((r: any) => r.location),
    },
  });
});

// ---- Server ----

const freePort = `for _ in $(seq 1 25); do pids=$(lsof -t -iTCP:${PORT} -sTCP:LISTEN 2>/dev/null || true); if [ -z "$pids" ]; then exit 0; fi; kill $pids 2>/dev/null || true; sleep 0.2; done`;

for (let attempt = 1; ; attempt++) {
  await Bun.$`sudo sh -c ${freePort}`.quiet().nothrow();
  try {
    Bun.serve({
      port: PORT,
      hostname: HOST,
      async fetch(req) {
        const url = new URL(req.url);
        const { pathname } = url;

        // API routes
        if (pathname.startsWith("/api/")) {
          const match = matchRoute(req.method, pathname);
          if (match) {
            try {
              return await match.handler(req, match.params);
            } catch (err) {
              if (err instanceof Response) return err;
              console.error("API error:", err);
              return json({ error: "Internal server error" }, 500);
            }
          }
          return json({ error: "Not found" }, 404);
        }

        // Static files
        const filePath = pathname === "/"
          ? `${DIST_DIR}/index.html`
          : `${DIST_DIR}${pathname}`;

        const file = Bun.file(filePath);
        if (await file.exists()) {
          const contentType = getContentType(filePath);
          return new Response(file, {
            headers: { "Content-Type": contentType },
          });
        }

        // SPA fallback: serve index.html for client-side routing
        const indexFile = Bun.file(`${DIST_DIR}/index.html`);
        if (await indexFile.exists()) {
          return new Response(indexFile, {
            headers: { "Content-Type": "text/html" },
          });
        }

        return new Response("Not found", { status: 404 });
      },
    });

    // Init DB and seed demo data
    const db = getDb();
    seedDemoData(db);

    console.log(`BehaviorTrack serving on http://${HOST}:${PORT}`);
    break;
  } catch (err) {
    if (attempt >= 10) throw err;
    await Bun.sleep(200);
  }
}

function getContentType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    mjs: "application/javascript",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    xml: "application/xml",
    txt: "text/plain",
  };
  return types[ext || ""] || "application/octet-stream";
}

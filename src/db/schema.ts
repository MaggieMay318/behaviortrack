import { Database } from "bun:sqlite";
import { join } from "node:path";

const DB_PATH = join(import.meta.dir, "behaviortrack.db");

let _db: Database | null = null;

export function getDb(): Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.exec("PRAGMA journal_mode = WAL");
    _db.exec("PRAGMA foreign_keys = ON");
    initSchema(_db);
    runMigrations(_db);
  }
  return _db;
}

function runMigrations(db: Database): void {
  // Add points columns if they don't exist (for existing databases)
  const migrators: [string, string][] = [
    ["behavior_entries", "ALTER TABLE behavior_entries ADD COLUMN points INTEGER NOT NULL DEFAULT 0"],
    ["students", "ALTER TABLE students ADD COLUMN points_awarded INTEGER NOT NULL DEFAULT 0"],
  ];

  for (const [table, sql] of migrators) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    const colNames = new Set(cols.map(c => c.name));
    if (!colNames.has(sql.includes("points_awarded") ? "points_awarded" : "points")) {
      try { db.exec(sql); } catch {}
    }
  }
}

function initSchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'teacher' CHECK(role IN ('teacher','interventionist','counselor','admin')),
      school_name TEXT DEFAULT '',
      district_name TEXT DEFAULT '',
      grade_levels TEXT DEFAULT '[]',
      subjects TEXT DEFAULT '[]',
      classroom_name TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_name TEXT NOT NULL,
      initials TEXT NOT NULL,
      local_id TEXT DEFAULT '',
      grade TEXT DEFAULT '',
      classroom TEXT DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      points_awarded INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS behavior_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      subject_activity TEXT DEFAULT '',
      location TEXT DEFAULT '',
      staff_member TEXT DEFAULT '',
      entry_type TEXT NOT NULL DEFAULT 'minor_concern' CHECK(entry_type IN ('positive','minor_concern','moderate_concern','major_concern','crisis')),
      behavior_categories TEXT DEFAULT '[]',
      objective_observation TEXT DEFAULT '',
      possible_triggers TEXT DEFAULT '[]',
      interventions TEXT DEFAULT '[]',
      student_response TEXT DEFAULT '[]',
      outcome TEXT DEFAULT '[]',
      people_involved TEXT DEFAULT '',
      duration_minutes INTEGER DEFAULT 0,
      frequency TEXT DEFAULT '',
      property_damage INTEGER NOT NULL DEFAULT 0,
      injury INTEGER NOT NULL DEFAULT 0,
      points INTEGER NOT NULL DEFAULT 0,
      parent_contact_status TEXT DEFAULT '' CHECK(parent_contact_status IN ('','not_contacted','contacted','voicemail','email_sent','letter_sent')),
      admin_contact_status TEXT DEFAULT '' CHECK(admin_contact_status IN ('','not_contacted','contacted','voicemail','email_sent')),
      counselor_contact_status TEXT DEFAULT '' CHECK(counselor_contact_status IN ('','not_contacted','contacted','voicemail','email_sent')),
      follow_up_date TEXT DEFAULT '',
      additional_notes TEXT DEFAULT '',
      attachment_url TEXT DEFAULT '',
      confidential_notes TEXT DEFAULT '',
      doc_status TEXT NOT NULL DEFAULT 'not_required' CHECK(doc_status IN ('not_required','required_pending','completed','needs_clarification')),
      doc_completion_date TEXT DEFAULT '',
      doc_system_name TEXT DEFAULT '',
      doc_reference_number TEXT DEFAULT '',
      doc_note TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS behavior_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      start_date TEXT NOT NULL,
      review_date TEXT DEFAULT '',
      target_behavior TEXT DEFAULT '',
      measurement_method TEXT DEFAULT '',
      baseline TEXT DEFAULT '',
      target TEXT DEFAULT '',
      tracking_frequency TEXT DEFAULT '',
      responsible_staff TEXT DEFAULT '',
      supports TEXT DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started','in_progress','improving','goal_met','needs_revision','discontinued')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS goal_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id INTEGER NOT NULL REFERENCES behavior_goals(id),
      date TEXT NOT NULL,
      notes TEXT DEFAULT '',
      rating INTEGER NOT NULL DEFAULT 3 CHECK(rating >= 1 AND rating <= 5),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id),
      contact_type TEXT NOT NULL CHECK(contact_type IN ('parent','counselor','administrator')),
      contact_date TEXT NOT NULL,
      method TEXT DEFAULT '',
      summary TEXT DEFAULT '',
      follow_up_required INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS follow_ups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL REFERENCES behavior_entries(id),
      due_date TEXT NOT NULL,
      description TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      completed_date TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS edit_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL REFERENCES behavior_entries(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      changed_fields TEXT NOT NULL DEFAULT '[]',
      changed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_entries_student ON behavior_entries(student_id);
    CREATE INDEX IF NOT EXISTS idx_entries_user ON behavior_entries(user_id);
    CREATE INDEX IF NOT EXISTS idx_entries_date ON behavior_entries(date);
    CREATE INDEX IF NOT EXISTS idx_entries_type ON behavior_entries(entry_type);
    CREATE INDEX IF NOT EXISTS idx_goals_student ON behavior_goals(student_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
  `);
}

function isDemoMode(): boolean {
  return process.env.VITE_DEMO_MODE === "true";
}

export function seedDemoData(db: Database): void {
  // In production mode, skip all demo seeding — tables already exist from initSchema
  if (!isDemoMode()) {
    console.log("Production mode: skipping demo data seeding.");
    return;
  }

  const userCount = db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number };
  const entryCount = db.prepare("SELECT COUNT(*) as c FROM behavior_entries").get() as { c: number };
  const goalCount = db.prepare("SELECT COUNT(*) as c FROM behavior_goals").get() as { c: number };

  // Seed users if none
  if (userCount.c === 0) {
    const hash = Bun.password.hashSync("demo1234");
    db.prepare(`
      INSERT INTO users (email, password_hash, name, role, school_name, grade_levels, subjects, classroom_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "teacher@demo.edu", hash, "Ms. Rodriguez", "teacher",
      "Oakwood Elementary", '["3","4"]', '["Math","Science"]', "Room 204"
    );

    const students = [
      ["Alex Johnson", "AJ", "S1001", "3", "Room 204"],
      ["Maria Garcia", "MG", "S1002", "3", "Room 204"],
      ["James Chen", "JC", "S1003", "3", "Room 204"],
      ["Olivia Brown", "OB", "S1004", "3", "Room 204"],
      ["Ethan Williams", "EW", "S1005", "4", "Room 204"],
      ["Sophia Lee", "SL", "S1006", "4", "Room 204"],
      ["Liam Davis", "LD", "S1007", "4", "Room 204"],
      ["Ava Martinez", "AM", "S1008", "4", "Room 204"],
      ["Jordan Taylor", "JT", "S1009", "3", "Room 204"],
    ];

    const insert = db.prepare(
      "INSERT INTO students (display_name, initials, local_id, grade, classroom) VALUES (?, ?, ?, ?, ?)"
    );
    for (const s of students) {
      insert.run(...s);
    }
    console.log("Seeded demo users: 1 teacher, 9 students");
  }

  // Seed entries if none
  if (entryCount.c === 0) {
    seedDemoEntries(db);
    console.log("Seeded demo entries with varied data");

    // Compute points_awarded for all students from their entries
    const students = db.prepare("SELECT id FROM students").all() as { id: number }[];
    const updatePoints = db.prepare("UPDATE students SET points_awarded = (SELECT COALESCE(SUM(points), 0) FROM behavior_entries WHERE student_id = ? AND entry_type = 'positive') WHERE id = ?");
    for (const s of students) {
      updatePoints.run(s.id, s.id);
    }
  }

  // Seed goals if none (independent of entries)
  if (goalCount.c === 0) {
    seedDemoGoals(db);
    console.log("Seeded demo behavior goals with progress data");
  }
}

function seedDemoEntries(db: Database): void {
  const now = new Date();
  const insertEntry = db.prepare(`
    INSERT INTO behavior_entries (
      student_id, user_id, date, time, subject_activity, location, staff_member,
      entry_type, behavior_categories, objective_observation, possible_triggers,
      interventions, student_response, outcome, people_involved, duration_minutes,
      frequency, property_damage, injury, points, parent_contact_status,
      follow_up_date, doc_status, doc_system_name, doc_reference_number
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertFollowUp = db.prepare(`
    INSERT INTO follow_ups (entry_id, due_date, description, completed, completed_date)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Categories, triggers, interventions pools
  const categories = [
    "Off-task behavior", "Calling out", "Leaving seat", "Physical aggression",
    "Verbal outburst", "Refusal to follow directions", "Disrupting peers",
    "Inappropriate language", "Tantrum", "Property misuse",
    "Peer conflict", "Elopement", "Self-regulation difficulty"
  ];
  const triggers = [
    "Transition between activities", "Peer conflict", "Task frustration",
    "Sensory overload", "Change in routine", "Unclear directions",
    "Tired or hungry", "Seeking attention", "Avoiding task",
    "Overstimulation", "Unstructured time"
  ];
  const interventions = [
    "Verbal redirection", "Non-verbal cue", "Proximity control",
    "Brief break offered", "Calm-down corner", "Check-in conversation",
    "Seating change", "Visual schedule review", "Positive reinforcement",
    "Choice offered", "Sensory tool provided", "Peer mediation"
  ];
  const outcomes = ["Stopped", "Decreased", "Continued", "Escalated"];
  const responses = ["Responsive", "Partially responsive", "Not responsive", "Defiant"];
  const locations = ["Classroom", "Hallway", "Cafeteria", "Playground", "Library", "Specials"];
  const subjects = ["Math", "Reading", "Science", "Social Studies", "Morning Meeting", "Transition", "Lunch"];
  const entryTypes = ["positive", "minor_concern", "moderate_concern", "major_concern", "crisis"];
  // Positive entries more for some students, more concerns for others
  const studentProfiles: Record<number, { positiveBias: number; entries: number }> = {
    1: { positiveBias: 0.5, entries: 18 }, // Alex - balanced
    2: { positiveBias: 0.6, entries: 15 }, // Maria - more positive
    3: { positiveBias: 0.2, entries: 20 }, // James - more concerns
    4: { positiveBias: 0.5, entries: 14 }, // Olivia
    5: { positiveBias: 0.3, entries: 22 }, // Ethan - more concerns (increasing)
    6: { positiveBias: 0.55, entries: 16 }, // Sophia
    7: { positiveBias: 0.4, entries: 24 }, // Liam - concerns (but improving recently)
    8: { positiveBias: 0.65, entries: 12 }, // Ava - mostly positive
  };

  function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
  function pickN<T>(arr: T[], n: number): T[] {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  }
  function formatDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  let entryId = 0;

  for (let studentId = 1; studentId <= 8; studentId++) {
    const profile = studentProfiles[studentId];
    const numEntries = profile.entries;

    for (let i = 0; i < numEntries; i++) {
      // Spread entries over past 30 days
      const daysAgo = Math.floor(Math.random() * 30);
      const entryDate = new Date(now);
      entryDate.setDate(entryDate.getDate() - daysAgo);
      // Skip weekends occasionally
      const dow = entryDate.getDay();
      if (dow === 0 || dow === 6) entryDate.setDate(entryDate.getDate() - (dow === 0 ? 2 : 1));

      const hour = 8 + Math.floor(Math.random() * 7); // 8 AM to 3 PM
      const minute = Math.floor(Math.random() * 60);
      const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

      // Determine entry type based on student profile
      const r = Math.random();
      let entryType: string;
      if (r < profile.positiveBias) {
        entryType = "positive";
      } else {
        const concernR = Math.random();
        if (concernR < 0.45) entryType = "minor_concern";
        else if (concernR < 0.80) entryType = "moderate_concern";
        else if (concernR < 0.95) entryType = "major_concern";
        else entryType = "crisis";
      }

      const isPositive = entryType === "positive";
      const numCats = isPositive ? 1 : 1 + Math.floor(Math.random() * 3);
      const numTrigs = Math.random() > 0.3 ? 1 + Math.floor(Math.random() * 3) : 0;
      const numIntvs = 1 + Math.floor(Math.random() * 3);

      const behaviorCategories = pickN(categories, numCats);
      const possibleTriggers = numTrigs > 0 ? pickN(triggers, numTrigs) : [];
      const interventionList = pickN(interventions, numIntvs);
      const outcome = isPositive ? ["Positive acknowledgment"] : [pick(outcomes)];
      const studentResponse = isPositive ? [] : [pick(responses)];

      // Observations
      const observations: Record<string, string[]> = {
        positive: [
          "Student helped a peer with math problems without being asked.",
          "Student stayed focused during independent reading for the full 20 minutes.",
          "Student used calming strategy independently when feeling frustrated.",
          "Student contributed thoughtfully to class discussion.",
          "Student completed all assignments on time and asked for feedback.",
        ],
        minor_concern: [
          "Student called out answers twice during math lesson.",
          "Student was out of seat without permission during independent work.",
          "Student talked to neighbor during silent reading.",
          "Student took several minutes to transition to the next activity.",
        ],
        moderate_concern: [
          "Student refused to begin writing assignment when directed.",
          "Student used inappropriate language when frustrated with task.",
          "Student disrupted peer's work by making loud noises repeatedly.",
          "Student argued with teacher about assignment requirements.",
        ],
        major_concern: [
          "Student yelled and threw worksheet on the floor during math test.",
          "Student pushed peer during lineup for recess.",
          "Student left classroom without permission and was found in hallway.",
          "Student used profanity directed at another student.",
        ],
        crisis: [
          "Student had a significant outburst involving throwing furniture.",
          "Student physically struck another student during conflict.",
          "Student eloped from classroom and building, requiring admin search.",
        ],
      };

      const obsPool = observations[entryType] || observations.minor_concern;
      const obs = pick(obsPool);

      // Doc status
      let docStatus = "not_required";
      if (!isPositive && entryType !== "minor_concern") {
        const docR = Math.random();
        if (docR < 0.4) docStatus = "completed";
        else if (docR < 0.8) docStatus = "required_pending";
        else docStatus = "not_required";
      }

      const docSystemName = docStatus !== "not_required" ? "District SIS" : "";
      const docRef = docStatus !== "not_required" ? `DOC-${1000 + entryId}` : "";

      // Parent contact
      let parentContact = "";
      if (!isPositive && (entryType === "major_concern" || entryType === "crisis")) {
        parentContact = Math.random() > 0.5 ? "contacted" : pick(["voicemail", "not_contacted"]);
      }

      // Follow up date
      let followUpDate = "";
      if (!isPositive && entryType !== "minor_concern" && Math.random() > 0.6) {
        const fuDate = new Date(entryDate);
        fuDate.setDate(fuDate.getDate() + 3 + Math.floor(Math.random() * 7));
        followUpDate = formatDate(fuDate);
      }

      // Duration
      const duration = isPositive ? 0 : 2 + Math.floor(Math.random() * 25);

      // Points for positive entries
      const points = isPositive ? [1, 1, 2, 2, 3, 3, 5, 10][Math.floor(Math.random() * 8)] : 0;

      const result = insertEntry.run(
        studentId, 1, formatDate(entryDate), timeStr,
        pick(subjects), pick(locations), "Ms. Rodriguez",
        entryType,
        JSON.stringify(behaviorCategories),
        obs,
        JSON.stringify(possibleTriggers),
        JSON.stringify(interventionList),
        JSON.stringify(studentResponse),
        JSON.stringify(outcome),
        "", duration, pick(["once", "2-3 times", "repeatedly"]),
        entryType === "major_concern" ? (Math.random() > 0.8 ? 1 : 0) : 0,
        entryType === "crisis" ? (Math.random() > 0.5 ? 1 : 0) : 0,
        points,
        parentContact,
        followUpDate, docStatus, docSystemName, docRef
      );

      entryId = Number(result.lastInsertRowid);

      // Create follow-ups for some entries
      if (followUpDate && Math.random() > 0.5) {
        const dueDate = new Date(entryDate);
        dueDate.setDate(dueDate.getDate() + 3 + Math.floor(Math.random() * 5));
        insertFollowUp.run(
          entryId, formatDate(dueDate),
          "Check in with student about behavior patterns",
          Math.random() > 0.6 ? 1 : 0,
          Math.random() > 0.6 ? formatDate(dueDate) : ""
        );
      }
    }
  }
}

function seedDemoGoals(db: Database): void {
  const now = new Date();
  function fmt(d: Date): string { return d.toISOString().slice(0, 10); }
  function daysAgo(n: number): string { const d = new Date(now); d.setDate(d.getDate() - n); return fmt(d); }
  function daysFromNow(n: number): string { const d = new Date(now); d.setDate(d.getDate() + n); return fmt(d); }

  const insertGoal = db.prepare(`
    INSERT INTO behavior_goals (student_id, user_id, title, description, start_date, review_date,
      target_behavior, measurement_method, baseline, target, tracking_frequency,
      responsible_staff, supports, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertProgress = db.prepare(`
    INSERT INTO goal_progress (goal_id, date, notes, rating)
    VALUES (?, ?, ?, ?)
  `);

  // Demo goals per spec:
  // 1. "Stay on task during independent work" — in_progress, Alex Johnson (id=1)
  // 2. "Use respectful language with peers" — improving, Ethan Williams (id=5)
  // 3. "Complete transitions with one reminder or fewer" — goal_met, Maria Garcia (id=2)
  // 4. "Request breaks appropriately when frustrated" — in_progress, James Chen (id=3)
  // 5. "Keep hands and feet to self during group activities" — needs_revision, Jordan Taylor (id=9)

  const goals = [
    {
      studentId: 1, title: "Stay on task during independent work",
      description: "Alex will remain engaged with assigned independent work for 15 minutes without teacher redirection.",
      startOffset: 28, reviewOffset: 14,
      targetBehavior: "Staying on task during independent work",
      measurementMethod: "Duration observation (minutes on task)",
      baseline: "5 minutes", target: "15 minutes",
      frequency: "Daily", staff: "Ms. Rodriguez",
      supports: ["Visual timer", "Preferential seating", "Chunked assignments", "Check-in/check-out"],
      status: "in_progress",
      progress: [
        { offset: 25, rating: 2, notes: "Stayed on task for about 4 minutes before needing redirection." },
        { offset: 20, rating: 2, notes: "Focused for ~6 minutes, distracted by peer talking." },
        { offset: 15, rating: 3, notes: "On task for approximately 9 minutes with one visual timer prompt." },
        { offset: 10, rating: 3, notes: "Worked independently for about 11 minutes — showed improvement with chunked assignment." },
        { offset: 5, rating: 3, notes: "On task for ~12 minutes. Responded well to check-in at 10-minute mark." },
      ]
    },
    {
      studentId: 5, title: "Use respectful language with peers",
      description: "Ethan will use respectful language when interacting with peers, replacing sarcasm and name-calling with neutral or positive statements.",
      startOffset: 35, reviewOffset: 7,
      targetBehavior: "Using respectful language with peers",
      measurementMethod: "Frequency count of respectful vs. disrespectful peer interactions",
      baseline: "3 disrespectful comments per day", target: "0 disrespectful comments per day",
      frequency: "Daily", staff: "Ms. Rodriguez",
      supports: ["Social skills group", "Role-play scenarios", "Positive reinforcement chart", "Buddy system"],
      status: "improving",
      progress: [
        { offset: 30, rating: 2, notes: "Used sarcasm twice during group work and called a peer a name once." },
        { offset: 25, rating: 3, notes: "One instance of sarcasm noted; used respectful language when reminded." },
        { offset: 18, rating: 3, notes: "Redirected himself after starting to make a sarcastic comment — self-correction observed." },
        { offset: 10, rating: 4, notes: "Used respectful language throughout the day. Complimented a peer." },
        { offset: 3, rating: 4, notes: "No disrespectful language observed. Used 'please' and 'thank you' with peers unprompted." },
      ]
    },
    {
      studentId: 2, title: "Complete transitions with one reminder or fewer",
      description: "Maria will transition between activities within 2 minutes and with no more than one teacher reminder.",
      startOffset: 50, reviewOffset: -5,
      targetBehavior: "Completing transitions efficiently",
      measurementMethod: "Transition time tracking and reminder count",
      baseline: "3 reminders per transition", target: "1 reminder per transition",
      frequency: "Daily (each transition)", staff: "Ms. Rodriguez",
      supports: ["Visual schedule", "5-minute warnings", "Transition song", "Peer buddy"],
      status: "goal_met",
      progress: [
        { offset: 45, rating: 2, notes: "Needed 3 reminders during math-to-reading transition; took 5 minutes." },
        { offset: 38, rating: 3, notes: "Two reminders needed. Transition completed in about 3 minutes." },
        { offset: 30, rating: 3, notes: "Responded to one reminder and visual schedule cue. Transition time improving." },
        { offset: 22, rating: 4, notes: "Only needed one reminder. Transitioned in under 2 minutes." },
        { offset: 14, rating: 4, notes: "Transitioned with zero reminders when given a 5-minute warning. Excelled with peer buddy system." },
        { offset: 7, rating: 5, notes: "Consistently transitions with 0-1 reminders. Independently checks visual schedule." },
      ]
    },
    {
      studentId: 3, title: "Request breaks appropriately when frustrated",
      description: "James will use the designated break card or verbally request a brief break when feeling frustrated, instead of engaging in disruptive behavior.",
      startOffset: 20, reviewOffset: 10,
      targetBehavior: "Requesting breaks appropriately",
      measurementMethod: "Frequency count: appropriate break requests vs. disruptive incidents",
      baseline: "0 appropriate requests, 4 disruptive incidents per week", target: "3 appropriate requests per week, 0 disruptive incidents",
      frequency: "Daily", staff: "Ms. Rodriguez",
      supports: ["Break card system", "Calm-down corner", "Emotion check-in chart", "Counselor check-in (weekly)"],
      status: "in_progress",
      progress: [
        { offset: 18, rating: 2, notes: "Had a disruptive outburst during math; did not use break card when prompted." },
        { offset: 14, rating: 2, notes: "Used break card once after teacher reminder. Still had one minor disruption earlier in the day." },
        { offset: 10, rating: 3, notes: "Requested a break verbally twice today. No major disruptions observed." },
        { offset: 5, rating: 3, notes: "Used break card independently once. One minor off-task period but self-corrected." },
      ]
    },
    {
      studentId: 9, title: "Keep hands and feet to self during group activities",
      description: "Jordan will maintain appropriate physical boundaries with peers during group work and unstructured social time.",
      startOffset: 40, reviewOffset: -2,
      targetBehavior: "Keeping hands and feet to self",
      measurementMethod: "Frequency count of physical contact incidents",
      baseline: "5 incidents per day", target: "1 incident per day",
      frequency: "Daily", staff: "Ms. Rodriguez",
      supports: ["Social story", "Sensory tools", "Proximity seating", "Structured group roles"],
      status: "needs_revision",
      progress: [
        { offset: 35, rating: 2, notes: "Pushed a peer during group activity. 4 physical contact incidents recorded." },
        { offset: 28, rating: 2, notes: "Kicked peer's chair and touched others' materials without asking. 5 incidents." },
        { offset: 20, rating: 3, notes: "Some improvement with sensory tools. 3 incidents — better than baseline but still above target." },
        { offset: 12, rating: 2, notes: "Regressed today — 5 incidents. Social story not effective as implemented." },
        { offset: 5, rating: 3, notes: "3 incidents today. Responded to proximity seating. May need revised supports." },
      ]
    },
  ];

  for (const g of goals) {
    const startDate = daysAgo(g.startOffset);
    const reviewDate = daysFromNow(g.reviewOffset);

    const result = insertGoal.run(
      g.studentId, 1, g.title, g.description,
      startDate, reviewDate,
      g.targetBehavior, g.measurementMethod,
      g.baseline, g.target,
      g.frequency, g.staff,
      JSON.stringify(g.supports),
      g.status
    );
    const goalId = Number(result.lastInsertRowid);

    for (const p of g.progress) {
      insertProgress.run(goalId, daysAgo(p.offset), p.notes, p.rating);
    }
  }
}

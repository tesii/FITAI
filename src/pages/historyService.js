const supabaseClient = window.supabase.createClient(
  "https://ojzeaqememaevlxcyabn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qemVhcWVtZW1hZXZseGN5YWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NTQxODIsImV4cCI6MjA4OTMzMDE4Mn0.4Dg17eTLAK0AlHXmrCCvxEIa2RngJIu0kr1v5rX439Y"
);

/* ═══════════════════════════════
   USER
═══════════════════════════════ */
const { data: { user } } = await supabase.auth.getUser();

if (!user) {
  window.location.href = "/login";
}

/* ═══════════════════════════════
   SAFE HELPERS
═══════════════════════════════ */
export function safeNumber(v) {
  return Number(v) || 0;
}

export function safeVolume(log) {
  return (
    safeNumber(log.sets) *
    safeNumber(log.reps) *
    safeNumber(log.weight_used)
  );
}

/* ═══════════════════════════════
   WEEK START
═══════════════════════════════ */
export function getStartOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/* ═══════════════════════════════
   WORKOUT DAYS
═══════════════════════════════ */
export async function getWorkoutDays() {
  const { data, error } = await supabase
    .from("user_exercise_logs")
    .select("created_at")
    .eq("user_id", user.id);

  if (error) {
    console.error(error);
    return new Set();
  }

  const set = new Set();
  (data || []).forEach(l => {
    set.add(new Date(l.created_at).toDateString());
  });

  return set;
}
export async function getFirstWorkoutDate() {
  const { data, error } = await supabase
    .from("user_exercise_logs")
    .select("created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error || !data?.length) return null;

  return new Date(data[0].created_at);
}
/* ═══════════════════════════════
   MONTH MAP
═══════════════════════════════ */
export async function getMonthWorkoutMap(year, month) {
  const { data, error } = await supabase
    .from("user_exercise_logs")
    .select("created_at")
    .eq("user_id", user.id);

  if (error) {
    console.error(error);
    return new Set();
  }

  const set = new Set();

  (data || []).forEach((l) => {
    const d = new Date(l.created_at);

    if (
      d.getFullYear() === year &&
      d.getMonth() === month
    ) {
      set.add(d.getDate());
    }
  });

  return set;
}
export async function getMonthRange() {
  const first = await getFirstWorkoutDate();

  if (!first) return [];

  const now = new Date();

  const months = [];

  let cursor = new Date(first.getFullYear(), first.getMonth(), 1);

  while (
    cursor.getFullYear() < now.getFullYear() ||
    (cursor.getFullYear() === now.getFullYear() &&
     cursor.getMonth() <= now.getMonth())
  ) {
    months.push({
      year: cursor.getFullYear(),
      month: cursor.getMonth(),
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}
/* ═══════════════════════════════
   GET DAY LOGS
═══════════════════════════════ */
export async function getDayLogs(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from("user_exercise_logs")
    .select(`*, exercises(id, name)`)
    .eq("user_id", user.id)
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  if (error) {
    console.error(error);
    return [];
  }

  return data || [];
}

/* ═══════════════════════════════
   PREVIOUS WEEK LOGS
═══════════════════════════════ */
export async function getPreviousWeekLogs(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - 7);

  const start = new Date(d);
  start.setHours(0, 0, 0, 0);

  const end = new Date(d);
  end.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from("user_exercise_logs")
    .select("*")
    .eq("user_id", user.id)
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  if (error) {
    console.error(error);
    return [];
  }

  return data || [];
}

/* ═══════════════════════════════
   VOLUME
═══════════════════════════════ */
export function calculateVolume(logs) {
  return logs.reduce((sum, l) => sum + safeVolume(l), 0);
}

/* ═══════════════════════════════
   PROGRESS
═══════════════════════════════ */
export function calculateProgress(current, previous) {
  const diff = current - previous;

  const percent =
    previous > 0
      ? (diff / previous) * 100
      : current > 0
        ? 100
        : 0;

  let status;
  if (previous === 0)      status = "First Session";
  else if (percent >= 10)  status = "Strong Progress";
  else if (percent > 0)    status = "Progress";
  else if (percent < 0)    status = "Decline";
  else                     status = "No Change";

  return { percent, status, diff };
}

/* ═══════════════════════════════
   SAVE WORKOUT DAY
   ─ Logs that already have a session_id  → UPDATE (sets/reps/weight only)
   ─ Logs without a session_id            → INSERT  (DB generates the UUID)
   ─ Never queries .eq("session_id", null) — avoids the UUID type error
═══════════════════════════════ */
export async function saveWorkoutDay(date, logs) {
  console.group("saveWorkoutDay");
  console.log("[saveWorkoutDay] date:", date);
  console.log("[saveWorkoutDay] logs:", JSON.stringify(logs, null, 2));

  const dateObj = date instanceof Date ? date : new Date(date);
  if (isNaN(dateObj.getTime())) {
    console.error("[saveWorkoutDay] Invalid date:", date);
    console.groupEnd();
    return { success: false, error: "Invalid date" };
  }

  if (!Array.isArray(logs) || logs.length === 0) {
    console.warn("[saveWorkoutDay] No logs to save");
    console.groupEnd();
    return { success: false, error: "No logs provided" };
  }

  // One session_id shared across all rows — groups this workout session together
  const session_id = crypto.randomUUID();

  const payload = logs.map(log => ({
    user_id:     user.id,
    exercise_id: log.exercise_id ?? null,
    sets:        safeNumber(log.sets),
    reps:        safeNumber(log.reps),
    weight_used: safeNumber(log.weight_used),
    // Preserve day_of_week from the original log if it exists, else derive from date
    day_of_week: log.day_of_week ?? dateObj.getDay(),
    session_id,
    // created_at: DB default (now())
  }));

  console.log("[INSERT] user.id:", user.id);
  console.log("[INSERT] payload:", JSON.stringify(payload, null, 2));

  const { data, error, status, statusText } = await supabase
    .from("user_exercise_logs")
    .insert(payload)
    .select();

  console.log("[INSERT] status:", status, statusText);
  console.log("[INSERT] data returned:", data);
  console.log("[INSERT] error:", error);

  console.groupEnd();

  if (error) {
    console.error("[INSERT] FAILED:", error.code, error.message, error.details, error.hint);
    return { success: false, error: `${error.message} (code: ${error.code})` };
  }

  if (!data || data.length === 0) {
    console.warn("[INSERT] No rows returned — check RLS INSERT policy allows auth.uid() = user_id");
    return { success: false, error: "Insert blocked — check RLS INSERT policy" };
  }

  console.log("[INSERT] Success —", data.length, "row(s) inserted:", data);
  return { success: true, data };
}

/* ═══════════════════════════════
   FULL DAY WORKOUT
═══════════════════════════════ */
export async function getFullDayWorkout(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from("user_exercise_logs")
    .select(`*, exercises(id, name)`)
    .eq("user_id", user.id)
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }

  return data || [];
}

/* ═══════════════════════════════
   WEEK NAV HELPERS
═══════════════════════════════ */
export function addWeeks(date, weeks) {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

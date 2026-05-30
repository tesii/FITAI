import { supabase } from "../lib/supabaseClient.js";
import {
  getStartOfWeek,
  getWorkoutDays,
  getMonthWorkoutMap,
  getDayLogs,
  getPreviousWeekLogs,
  calculateVolume,
  calculateProgress,
  saveWorkoutDay,
  getMonthRange
} from "./historyService.js";

/* ═══════════════════════════════
   AUTH
═══════════════════════════════ */
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  window.location.href = "/login";
}

/* ═══════════════════════════════
   STATE
═══════════════════════════════ */
let isMonthView = false;
let selectedDate = null;
let selectedLogs = [];
let previousLogs = [];
let currentWeekStart = getStartOfWeek(new Date());

/* ═══════════════════════════════
   INIT
═══════════════════════════════ */
document.addEventListener("DOMContentLoaded", init);

async function init() {
  console.log("🚀 init() started");
  
  setupFilterListeners();
  
  // Force render immediately
  await renderWeeklyCalendar();
  
  await renderWeeklyStats();
  
  console.log("✅ init() completed");
}

/* ═══════════════════════════════
   WEEKLY CALENDAR
═══════════════════════════════ */
/* WEEKLY CALENDAR - Fixed & Robust Version */
async function renderWeeklyCalendar() {
  console.log("🔄 renderWeeklyCalendar() called");

  const container = document.getElementById("calendar-days");
  const title = document.getElementById("week-title");

  if (!container) {
    console.error("❌ #calendar-days NOT FOUND in DOM");
    return;
  }

  // Show loading
  container.innerHTML = `<div class="loading-spinner"></div>`;

  try {
    const workoutDays = await getWorkoutDays().catch(() => {
      console.warn("getWorkoutDays failed");
      return new Set();
    });

    container.innerHTML = ""; // Clear loading

    const start = new Date(currentWeekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    if (title) {
      title.textContent = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);

      const isToday = date.toDateString() === new Date().toDateString();
      const hasWorkout = workoutDays.has(date.toDateString());

      const el = document.createElement("button");
      el.className = `day-pill ${hasWorkout ? "has-workout" : ""} ${isToday ? "today" : ""}`;

      el.innerHTML = `
        <span class="day-name">${date.toLocaleDateString("en-US", { weekday: "short" })}</span>
        <span class="day-num">${date.getDate()}</span>
        ${hasWorkout ? `<span class="dot"></span>` : `<span class="dot empty"></span>`}
      `;

      el.addEventListener("click", () => openDay(date));
      container.appendChild(el);
    }

    console.log("✅ Calendar rendered successfully on load");

  } catch (err) {
    console.error("💥 Error rendering calendar:", err);
    container.innerHTML = `<div class="empty-state">Failed to load calendar</div>`;
  }
}

/* ═══════════════════════════════
   MONTH VIEW
═══════════════════════════════ */
async function renderMonthView() {
  const container = document.getElementById("calendar-days");
  const title = document.getElementById("week-title");
  if (!container || !title) return;

  container.innerHTML = `<div class="loading-spinner"></div>`;
  document.getElementById("week-nav").style.display = "none";

  title.textContent = "Workout History";

  const months = await getMonthRange();

  if (months.length === 0) {
    container.innerHTML = `<div class="empty-state">No workouts yet. Start logging!</div>`;
    return;
  }

  container.innerHTML = "";
  container.style.gridTemplateColumns = "1fr";

  for (const { year, month } of months) {
    const monthEl = await createMonthCalendar(year, month);
    container.appendChild(monthEl);
  }
}

async function createMonthCalendar(year, month) {
  const workoutDays = await getMonthWorkoutMap(year, month);

  const monthDiv = document.createElement("div");
  monthDiv.className = "month-section";
  monthDiv.innerHTML = `
    <h3 class="month-title">
      ${new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
    </h3>
    <div class="month-grid"></div>
  `;

  const grid = monthDiv.querySelector(".month-grid");

  // Weekday headers
  ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].forEach(day => {
    const header = document.createElement("div");
    header.className = "month-header";
    header.textContent = day;
    grid.appendChild(header);
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Blank cells
  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement("div");
    blank.className = "day-pill blank";
    grid.appendChild(blank);
  }

  // Actual days
  for (let day = 1; day <= daysInMonth; day++) {
    const hasWorkout = workoutDays.has(day);
    const date = new Date(year, month, day);

    const el = document.createElement("button");
    el.className = `day-pill ${hasWorkout ? "has-workout" : ""}`;
    el.innerHTML = `
      <span class="day-num">${day}</span>
      ${hasWorkout ? `<span class="dot"></span>` : `<span class="dot empty"></span>`}
    `;

    el.addEventListener("click", () => openDay(date));
    grid.appendChild(el);
  }

  return monthDiv;
}

/* ═══════════════════════════════
   OPEN DAY
═══════════════════════════════ */
async function openDay(date) {
  selectedDate = new Date(date); // Store clean copy
  selectedLogs = [];
  previousLogs = [];

  const container = document.getElementById("day-results");
  if (!container) return;

  document.getElementById("day-panel").classList.add("open");
  container.innerHTML = `<div class="loading-spinner"></div>`;

  try {
    const [logs, prev] = await Promise.all([
      getDayLogs(selectedDate).catch(() => []),
      getPreviousWeekLogs(selectedDate).catch(() => []),
    ]);

    selectedLogs = logs || [];
    previousLogs = prev || [];

    renderPreview(selectedDate, selectedLogs, previousLogs);
  } catch (err) {
    console.error("openDay error:", err);
    container.innerHTML = `<div class="empty-state">Failed to load day data.</div>`;
  }
}

/* ═══════════════════════════════
   PREVIEW + EDIT MODE
═══════════════════════════════ */
function renderPreview(date, logs = [], prevLogs = []) {
  const container = document.getElementById("day-results");
  if (!container || !date) return;

  const volume = calculateVolume(logs);
  const prevVolume = calculateVolume(prevLogs);
  const progress = calculateProgress(volume, prevVolume);
  const hasLogs = logs.length > 0;

  const progressClass = progress.status.includes("Progress") ? "progress-up" :
                        progress.status.includes("Decline") ? "progress-down" : "progress-same";

  container.innerHTML = `
    <div class="day-preview">
      <div class="preview-header">
        <h2>${date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</h2>
        <button class="close-btn" id="close-panel-btn">✕</button>
      </div>

      ${hasLogs ? `
        <div class="stats-row">
          <div class="stat-chip"><span class="stat-label">Volume</span><span class="stat-value">${Math.round(volume)} <small>kg</small></span></div>
          <div class="stat-chip ${progressClass}"><span class="stat-label">vs Last Week</span><span class="stat-value">${progress.status} (${progress.percent.toFixed(1)}%)</span></div>
          <div class="stat-chip"><span class="stat-label">Exercises</span><span class="stat-value">${logs.length}</span></div>
        </div>

        <div class="exercise-preview-list">
          ${logs.map(log => `
            <div class="exercise-preview-row">
              <span class="ex-name">${log.exercises?.name ?? "Exercise"}</span>
              <span class="ex-detail">${log.sets}×${log.reps} @ ${log.weight_used}kg</span>
            </div>
          `).join("")}
        </div>
      ` : `<div class="empty-state">No workout logged for this day.</div>`}

      <button class="start-btn" id="start-workout-btn">
        ${hasLogs ? "✏️ Edit Workout" : "➕ Log Workout"}
      </button>
    </div>
  `;

  document.getElementById("close-panel-btn")?.addEventListener("click", closePanel);
  document.getElementById("start-workout-btn")?.addEventListener("click", startWorkoutView);
}

function startWorkoutView() {
  const container = document.getElementById("day-results");
  if (!container) return;

  if (!selectedLogs.length) {
    selectedLogs = [{
      exercises: { name: "New Exercise" },
      sets: 3,
      reps: 10,
      weight_used: 0,
    }];
  }

  renderEditView(container);
}

/* Edit View, buildExerciseCard, bindEditListeners remain unchanged */
function renderEditView(container) {
  container.innerHTML = `
    <div class="day-summary">
      <div class="preview-header">
        <h2>Edit Workout</h2>
        <button class="close-btn" id="close-panel-btn">✕</button>
      </div>

      <div class="exercise-list" id="exercise-list">
        ${selectedLogs.map((log, i) => buildExerciseCard(log, i)).join("")}
      </div>

      <div class="edit-actions">
        <button class="add-btn" id="add-exercise-btn">+ Add Exercise</button>
        <button class="save-btn" id="save-workout-btn">Save Workout</button>
      </div>
    </div>
  `;

  bindEditListeners();

  document.getElementById("close-panel-btn")?.addEventListener("click", closePanel);
  document.getElementById("add-exercise-btn")?.addEventListener("click", addNewExercise);
  document.getElementById("save-workout-btn")?.addEventListener("click", saveWorkoutEdit);
}

function buildExerciseCard(log, i) {
  return `
    <div class="exercise-card" data-index="${i}">
      <div class="exercise-header">
        <input class="ex-name-input" type="text" value="${log.exercises?.name ?? "Exercise"}" 
          data-index="${i}" data-field="name" placeholder="Exercise name" />
        <button class="remove-btn" data-remove="${i}">✕</button>
      </div>
      <div class="exercise-stats">
        <label><span>Sets</span><input type="number" min="1" value="${log.sets}" data-index="${i}" data-field="sets" /></label>
        <label><span>Reps</span><input type="number" min="1" value="${log.reps}" data-index="${i}" data-field="reps" /></label>
        <label><span>Weight (kg)</span><input type="number" min="0" step="0.5" value="${log.weight_used}" data-index="${i}" data-field="weight_used" /></label>
      </div>
    </div>
  `;
}

function bindEditListeners() {
  // Re-bind inputs
  document.querySelectorAll("[data-field]").forEach(input => {
    const fresh = input.cloneNode(true);
    input.parentNode.replaceChild(fresh, input);

    fresh.addEventListener("change", (e) => {
      const i = Number(e.target.dataset.index);
      const field = e.target.dataset.field;

      if (field === "name") {
        if (!selectedLogs[i].exercises) selectedLogs[i].exercises = {};
        selectedLogs[i].exercises.name = e.target.value;
      } else {
        selectedLogs[i][field] = Number(e.target.value);
      }
    });
  });

  document.querySelectorAll("[data-remove]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const i = Number(e.target.dataset.remove);
      selectedLogs.splice(i, 1);
      renderEditView(document.getElementById("day-results"));
    });
  });
}

function addNewExercise() {
  selectedLogs.push({
    exercises: { name: "New Exercise" },
    sets: 3,
    reps: 10,
    weight_used: 0,
  });
  renderEditView(document.getElementById("day-results"));
}

/* ═══════════════════════════════
   SAVE WORKOUT
═══════════════════════════════ */
async function saveWorkoutEdit() {
  if (!selectedDate) {
    showNotification("No date selected.", false);
    return;
  }

  const btn = document.getElementById("save-workout-btn");
  btn.disabled = true;
  btn.textContent = "Saving…";

  try {
    const result = await saveWorkoutDay(selectedDate, selectedLogs);

    if (!result.success) throw new Error(result.error || "Save failed");

    // Refresh the same date
    const [freshLogs, freshPrev] = await Promise.all([
      getDayLogs(selectedDate),
      getPreviousWeekLogs(selectedDate)
    ]);

    selectedLogs = freshLogs || [];
    previousLogs = freshPrev || [];

    await Promise.all([renderWeeklyCalendar(), renderWeeklyStats()]);
    renderPreview(selectedDate, selectedLogs, previousLogs);

    showNotification("Workout saved successfully!", true);
  } catch (err) {
    console.error(err);
    showNotification("Failed to save workout: " + err.message, false);
  } finally {
    btn.disabled = false;
    btn.textContent = "Save Workout";
  }
}

/* ═══════════════════════════════
   CLOSE PANEL
═══════════════════════════════ */
function closePanel() {
  document.getElementById("day-panel").classList.remove("open");
  document.getElementById("day-results").innerHTML = "";
  selectedDate = null;
  selectedLogs = [];
  previousLogs = [];
}

/* ═══════════════════════════════
   WEEK NAVIGATION
═══════════════════════════════ */
document.getElementById("btn-prev-week")?.addEventListener("click", async () => {
  currentWeekStart.setDate(currentWeekStart.getDate() - 7);
  await renderWeeklyCalendar();
});

document.getElementById("btn-next-week")?.addEventListener("click", async () => {
  currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  await renderWeeklyCalendar();
});

/* ═══════════════════════════════
   TOGGLE VIEW
═══════════════════════════════ */
document.getElementById("toggle-view-btn")?.addEventListener("click", async () => {
  isMonthView = !isMonthView;
  const btn = document.getElementById("toggle-view-btn");

  if (isMonthView) {
    btn.textContent = "Week View";
    await renderMonthView();
  } else {
    btn.textContent = "Month View";
    document.getElementById("week-nav").style.display = "flex";
    await renderWeeklyCalendar();
  }
});

/* ═══════════════════════════════
   FILTER LISTENERS
═══════════════════════════════ */
function setupFilterListeners() {
  const yearEl  = document.getElementById("filter-year");
  const monthEl = document.getElementById("filter-month");

  if (yearEl) {
    const currentYear = new Date().getFullYear();
    yearEl.innerHTML = "";
    for (let y = currentYear - 3; y <= currentYear; y++) {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      if (y === currentYear) opt.selected = true;
      yearEl.appendChild(opt);
    }
  }

  if (monthEl) {
    monthEl.innerHTML = "";
    const months = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December",
    ];
    months.forEach((m, i) => {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = m;
      if (i === new Date().getMonth()) opt.selected = true;
      monthEl.appendChild(opt);
    });
  }

  yearEl?.addEventListener("change",  () => isMonthView && renderMonthView());
  monthEl?.addEventListener("change", () => isMonthView && renderMonthView());
}

/* ═══════════════════════════════
   WEEKLY STATS
═══════════════════════════════ */
async function renderWeeklyStats() {
  const container = document.getElementById("weekly-summary");
  if (!container) return;

  try {
    const { data, error } = await supabase
      .from("user_exercise_logs")
      .select("sets, reps, weight_used, created_at")
      .eq("user_id", user.id);

    if (error) throw error;

    const rows       = data || [];
    const volume     = calculateVolume(rows);
    const totalSets  = rows.reduce((s, l) => s + (l.sets || 0), 0);
    const uniqueDays = new Set(rows.map(l => l.created_at?.split("T")[0])).size;

    container.innerHTML = `
      <div class="stat-card">
        <span class="stat-label">Total Volume</span>
        <strong>${Math.round(volume)} kg</strong>
      </div>
      <div class="stat-card">
        <span class="stat-label">Total Sets</span>
        <strong>${totalSets}</strong>
      </div>
      <div class="stat-card">
        <span class="stat-label">Days Trained</span>
        <strong>${uniqueDays}</strong>
      </div>
    `;
  } catch (err) {
    console.error("Weekly stats error:", err);
    container.innerHTML = `<div class="stat-card">Stats unavailable</div>`;
  }
}

/* ═══════════════════════════════
   NOTIFICATION
═══════════════════════════════ */
function showNotification(message, isSuccess = true) {
  const notif = document.getElementById("notification");
  if (!notif) return;

  notif.textContent = message;
  notif.className   = "notification " + (isSuccess ? "success" : "error");
  notif.style.display = "block";

  setTimeout(() => { notif.style.display = "none"; }, 3000);
}
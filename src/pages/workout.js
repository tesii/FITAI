const supabaseClient = window.supabase.createClient(
  "https://ojzeaqememaevlxcyabn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qemVhcWVtZW1hZXZseGN5YWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NTQxODIsImV4cCI6MjA4OTMzMDE4Mn0.4Dg17eTLAK0AlHXmrCCvxEIa2RngJIu0kr1v5rX439Y"
);
import { generateAIWorkout } from "../ai/recommender.js";
import { normalizeLevel, normalizeMuscle, extractExclusions } from "../utils/parser.js";

// UI
const chatBox = document.getElementById("chatBox");
const input = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

// SESSION
const session = {
  step: 0,
  level: "",
  muscle: "",
  days: 2,
  exclusions: [],
  goal: "",
  weight: 0,
  height: 0,
  age: 0
};

// ─────────────────────────────
// MESSAGE UI
// ─────────────────────────────
function addMessage(text, sender = "ai") {
  const div = document.createElement("div");
  div.className = sender === "user" ? "msg user" : "msg ai";
  div.innerHTML = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ─────────────────────────────
// QUESTIONS
// ─────────────────────────────
function askNext() {
  const questions = [
    "Hi 👋 What is your level? (Beginner / Intermediate / Expert)",
    "Which muscle? (glutes, legs, chest)",
    "What is your goal? (body recomposition, cutting, bulking)",
    "How many days? (2 or 3)",
    "What is your weight in kg?",
    "What is your height in cm?",
    "What is your age?",
    "Any exercises to avoid? (e.g. no squats)"
  ];

  if (session.step < questions.length) {
    addMessage(questions[session.step]);
  } else {
    buildPlan();
  }
}

// ─────────────────────────────
// HANDLE INPUT
// ─────────────────────────────
function handleAnswer(text) {
  text = text.toLowerCase();

  if (session.step === 0) session.level = normalizeLevel(text);
  if (session.step === 1) session.muscle = normalizeMuscle(text);

  if (session.step === 2) {
    if (text.includes("recomp")) session.goal = "recomposition";
    else if (text.includes("cut")) session.goal = "cutting";
    else if (text.includes("bulk")) session.goal = "bulking";
    else session.goal = "recomposition";
  }

  if (session.step === 3) session.days = parseInt(text) || 2;
  if (session.step === 4) session.weight = parseFloat(text);
  if (session.step === 5) session.height = parseFloat(text);
  if (session.step === 6) session.age = parseInt(text);
  if (session.step === 7) session.exclusions = extractExclusions(text);

  session.step++;
  askNext();
}

// ─────────────────────────────
// 🧠 CALENDAR LOGIC (YOUR RULES)
// ─────────────────────────────
function getWorkoutDays(days, muscle) {
  const m = muscle.toLowerCase();

  // GLUTES + LEGS LOGIC
  if (m.includes("glute") || m.includes("leg")) {

    if (days === 2) return [1, 4]; // Monday, Thursday
    if (days === 3) return [7, 2, 4]; // Sunday, Tuesday, Thursday
  }

  // DEFAULT
  if (days === 2) return [2, 5]; // Tue, Fri
  if (days === 3) return [1, 3, 5]; // Mon, Wed, Fri

  return [1, 4];
}

// ─────────────────────────────
// ASSIGN DAYS TO PLAN
// ─────────────────────────────
function assignCalendarDays(plan, days, muscle) {
  const workoutDays = getWorkoutDays(days, muscle);

  return plan.map((day, index) => ({
    ...day,
    day_of_week: workoutDays[index] || workoutDays[0]
  }));
}

// ─────────────────────────────
// BUILD PLAN + SAVE
// ─────────────────────────────
async function buildPlan() {
  addMessage("Building your AI workout... 🧠");

  try {
    const { plan, calories } = await generateAIWorkout(session);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      addMessage("❌ Please login first.");
      return;
    }

    // SAVE SESSION
    const { data, error } = await supabase
      .from("workout_sessions")
      .insert([{
        user_id: user.id,
        goal: session.goal,
        level: session.level,
        muscle: session.muscle,
        days: session.days,
        weight: session.weight,
        height: session.height,
        age: session.age
      }])
      .select();

    if (error) throw error;

    const sessionId = data[0].id;
    const currentWeek = parseInt(localStorage.getItem("currentWeek")) || 1;

    // ✅ ASSIGN CALENDAR DAYS
    const scheduledPlan = assignCalendarDays(plan, session.days, session.muscle);

    // ✅ PREPARE LOGS
    const logRows = [];

    scheduledPlan.forEach(day => {
      const exercises = [
        day.compound,
        day.isolation
      ].filter(Boolean);

      exercises.forEach(ex => {
        logRows.push({
          user_id: user.id,
          session_id: sessionId,
          exercise_id: ex.id,
          day_of_week: day.day,
          day_of_week: day.day_of_week,
          sets: ex.sets || 3,
          reps: parseInt(ex.reps) || 10,
          weight_used: parseFloat(ex.startingWeight) || 10,
          completed: false
        });
      });
    });

    // SAVE LOGS
    const { error: logError } = await supabase
      .from("user_exercise_logs")
      .insert(logRows);

    if (logError) throw logError;

    // UI RESPONSE
    const dayNames = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

    let html = "<b>Your AI Workout 💪</b><br/><br/>";
    html += `<b>🔥 Calories: ${calories} kcal</b><br/><br/>`;

    scheduledPlan.forEach(day => {
      html += `<h4>${dayNames[day.day_of_week - 1]}</h4>`;

      if (day.compound) {
        html += `<div class="card">${day.compound.name}</div>`;
      }

      if (day.isolation) {
        html += `<div class="card">${day.isolation.name}</div>`;
      }
    });

    addMessage(html);

    // STORE MINIMAL DATA
    localStorage.setItem("currentWorkout", JSON.stringify({
      sessionId,
      week: currentWeek
    }));

    // REDIRECT
    setTimeout(() => {
      window.location.href = "history.html";
    }, 1500);

  } catch (err) {
    addMessage("❌ " + err.message);
  }
}

// ─────────────────────────────
// EVENTS
// ─────────────────────────────
sendBtn.addEventListener("click", () => {
  const msg = input.value.trim();
  if (!msg) return;

  input.value = "";
  addMessage(msg, "user");
  handleAnswer(msg);
});

input.addEventListener("keypress", e => {
  if (e.key === "Enter") sendBtn.click();
});

// START
askNext();

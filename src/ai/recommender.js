import { supabase } from "../lib/supabaseClient.js";
import { computeScore } from "./aiScoring.js";
import { buildFeedbackMap } from "./feedback.js";

// ─────────────────────────────────────────────
// 🧠 CALORIE ENGINE
// ─────────────────────────────────────────────
function calculateCalories(weight, height, age, goal) {

  let bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
  let tdee = bmr * 1.55;

  let calories = tdee;

  if (goal === "cutting")       calories = tdee - 400;
  if (goal === "bulking")       calories = tdee + 300;
  if (goal === "recomposition") calories = tdee;

  return Math.round(calories);
}

// ─────────────────────────────────────────────
// 🧠 MAIN AI WORKOUT GENERATOR
// ─────────────────────────────────────────────
export async function generateAIWorkout(session) {

  const { data: exercises, error } = await supabase
    .from("exercises")
    .select("*");

  if (error) throw new Error(error.message);

  const { data: feedback } = await supabase
    .from("user_exercise_feedback")
    .select("*");

  const feedbackMap = buildFeedbackMap(feedback || []);

  // 🔥 SCORE ALL EXERCISES
  const scored = exercises.map(ex => ({
    ...ex,
    aiScore: computeScore(ex, session, feedbackMap)
  }));

  // SORT BY AI SCORE
  const sorted = scored.sort((a, b) => b.aiScore - a.aiScore);

  // APPLY EXCLUSIONS
  let filtered = sorted;

  if (session.exclusions?.length) {
    filtered = filtered.filter(ex =>
      !session.exclusions.some(e =>
        ex.name.toLowerCase().includes(e.toLowerCase())
      )
    );
  }

  // SPLIT TYPES
  const compound = filtered.filter(e =>
    (e.type || e.exercise_type || "").toLowerCase() === "compound"
  );

  const isolation = filtered.filter(e =>
    (e.type || e.exercise_type || "").toLowerCase() === "isolation"
  );

  // ─────────────────────────────────────────────
  // 🧠 WORKOUT RULE ENGINE
  // ─────────────────────────────────────────────
  const getWorkoutParams = (level, goal) => {
    level = (level || "").toLowerCase();
    goal  = (goal  || "").toLowerCase();

    let sets = 3;
    let reps = "10–12";
    let rest = "60 sec";

    if (goal === "cutting")       { reps = "12–15"; rest = "30–45 sec"; }
    if (goal === "bulking")       { reps = "6–8";   rest = "90 sec";    }
    if (goal === "recomposition") { reps = "8–12";  rest = "60 sec";    }

    if (level === "intermediate") sets = 4;
    if (level === "expert")       sets = 5;

    return { sets, reps, rest };
  };

  // ─────────────────────────────────────────────
  // 🧠 STARTING WEIGHT  (1–20 kg gym range)
  //
  //  Logic matrix:
  //    Base by level   → beginner: 5 | intermediate: 10 | expert: 15
  //    Goal modifier   → bulking: +2 (heavier for strength stimulus)
  //                      cutting: -2 (lighter for higher reps / less fatigue)
  //                      recomposition: 0
  //    Type bonus      → compound: +2 (multi-joint = more load capacity)
  //                      isolation: 0
  //    Final clamp     → min 1, max 20
  // ─────────────────────────────────────────────
  const getStartingWeight = (exerciseType) => {
    const level      = (session.level || "beginner").toLowerCase();
    const goal       = (session.goal  || "recomposition").toLowerCase();
    const isCompound = (exerciseType  || "").toLowerCase() === "compound";

    let base = 5;
    if (level === "intermediate") base = 10;
    if (level === "expert")       base = 15;

    let goalModifier = 0;
    if (goal === "bulking")       goalModifier =  2;
    if (goal === "cutting")       goalModifier = -2;

    const typeBonus = isCompound ? 2 : 0;

    const raw = base + goalModifier + typeBonus;

    return Math.min(20, Math.max(1, raw));
  };

  // ─────────────────────────────────────────────
  // 🧠 BUILD PLAN
  // ─────────────────────────────────────────────
  const plan = [];

  const cLen = compound.length  || 1;
  const iLen = isolation.length || 1;

  let cIndex = 0;
  let iIndex = 0;

  for (let d = 1; d <= session.days; d++) {

    const compoundEx  = compound[cIndex  % cLen];
    const isolationEx = isolation[iIndex % iLen];

    plan.push({
      day: d,

      compound: compoundEx
        ? {
            ...compoundEx,
            ...getWorkoutParams(session.level, session.goal),
            startingWeight: getStartingWeight(compoundEx.type || compoundEx.exercise_type)
          }
        : null,

      isolation: isolationEx
        ? {
            ...isolationEx,
            ...getWorkoutParams(session.level, session.goal),
            startingWeight: getStartingWeight(isolationEx.type || isolationEx.exercise_type)
          }
        : null
    });

    cIndex++;
    iIndex++;
  }

  // ─────────────────────────────────────────────
  // 🧠 CALORIES ENGINE OUTPUT
  // ─────────────────────────────────────────────
  const calories = calculateCalories(
    session.weight,
    session.height,
    session.age,
    session.goal
  );

  // ─────────────────────────────────────────────
  // FINAL OUTPUT
  // ─────────────────────────────────────────────
  return {
    plan,
    calories
  };
}
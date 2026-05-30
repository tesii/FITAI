export function computeScore(ex, session, feedbackMap) {

  const rating = ex.rating || 0;

  const muscleMatch =
    (ex.muscle_region || "").toLowerCase().includes(session.muscle) ? 1 : 0;

  const difficultyMatch =
    ex.difficulty?.toLowerCase() === session.level ? 1 : 0;

  const typeScore =
    (ex.type || ex.exercise_type || "").toLowerCase() === "compound"
      ? 0.2
      : 0.15;

  const feedback = feedbackMap[ex.id] || 0;
function getGoalScore(ex, goal) {
  const category = (ex.category || "").toLowerCase();

  if (goal === "recomposition") {
    if (category.includes("strength")) return 1;
    if (category.includes("powerlifting")) return 0.8;
    if (category.includes("cardio")) return 0.6;

  }

  if (goal === "cutting") {
    if (category.includes("cardio")) return 1;
    if (category.includes("plyometrics")) return 0.8;
  }

  if (goal === "bulking") {
    if (category.includes("powerlifting")) return 1;
    if (category.includes("strength")) return 0.9;
  }

  return 0.5;
}
const goalScore = getGoalScore(ex, session.goal);

  return (
    rating * 0.4 +
    muscleMatch * 0.2 +
    difficultyMatch * 0.15 +
    feedback * 0.15 +
    goalScore * 0.15

  );
}
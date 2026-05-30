export function buildFeedbackMap(feedback) {
  const map = {};

  feedback.forEach(f => {
    if (!map[f.exercise_id]) map[f.exercise_id] = 0;

    if (f.liked) map[f.exercise_id] += 1;
    if (f.skipped) map[f.exercise_id] -= 1;
    if (f.completed) map[f.exercise_id] += 0.5;
  });

  return map;
}
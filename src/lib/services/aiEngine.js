import { supabase } from "../lib/supabaseClient";

/**
 * AI WORKOUT ENGINE
 */
export async function getWorkout(userId) {

  // 1. Fetch user
  const { data: user, error: userError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (userError) throw userError;

  // 2. Fetch exercises
  const { data: exercises, error: exError } = await supabase
    .from("exercises")
    .select("*");

  if (exError) throw exError;

  // 3. Scoring logic
  const scoreExercise = (exercise) => {
    let score = 0;

    // 🔥 Primary muscle match (MOST IMPORTANT)
    if (
      exercise.primary_muscle?.some(m =>
        user.goal_muscles.includes(m)
      )
    ) {
      score += 5;
    }

    // Secondary muscle match
    if (
      exercise.muscle_region?.some(m =>
        user.goal_muscles.includes(m)
      )
    ) {
      score += 2;
    }

    // Goal logic
    if (user.fitness_goal === "fat_loss") {
      if (exercise.category === "cardio") score += 3;
      if (exercise.category === "strength") score += 1;
    }

    if (user.fitness_goal === "muscle_gain") {
      if (exercise.category === "strength") score += 3;
      if (exercise.category === "cardio") score -= 1;
    }

    // Experience level
    if (user.experience_level === "beginner" && exercise.difficulty === "Easy") {
      score += 2;
    }

    return score;
  };

  // 4. Rank exercises
  const ranked = exercises
    .map(ex => ({
      ...ex,
      score: scoreExercise(ex)
    }))
    .sort((a, b) => b.score - a.score);

  // 5. Return top 10
  return ranked.slice(0, 10);
}
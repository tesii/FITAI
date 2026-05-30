import { supabase } from "../lib/supabaseClient.js";
/* =========================================================
   FITAI — AI COACH ENGINE
========================================================= */

export async function runAICoach(userId) {
  try {
    if (!userId) return null;

    /* =========================================
       GET LAST 2 PROGRESS ENTRIES
    ========================================= */

    const { data: photos, error: photoError } = await supabase
      .from("progress_photos")
      .select(`
        body_score,
        shoulder_ratio,
        hip_ratio,
        weight,
        created_at
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(2);

    if (photoError || !photos || photos.length < 2) {
      console.log("Not enough progress data");
      return null;
    }

    const current = photos[0];
    const previous = photos[1];

    /* =========================================
       GET USER TRAINING SESSION
    ========================================= */

    const { data: sessions, error: sessionError } = await supabase
      .from("workout_sessions")
      .select("goal, level, muscle")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (sessionError || !sessions?.length) {
      console.log("No workout session found");
      return null;
    }

    const session = sessions[0];

    /* =========================================
       SPAM PROTECTION
       Prevent notifications every login
    ========================================= */

    const { data: existingNotif } = await supabase
      .from("notifications")
      .select("created_at")
      .eq("user_id", userId)
      .eq("type", "coach")
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingNotif?.length) {
      const lastDate = new Date(existingNotif[0].created_at);

      const daysPassed =
        (Date.now() - lastDate.getTime()) /
        (1000 * 60 * 60 * 24);

      // only 1 notification every 3 days
      if (daysPassed < 3) {
        console.log("AI Coach skipped (spam protection)");
        return null;
      }
    }

    /* =========================================
       ANALYZE CHANGES
    ========================================= */

    const deltas = calculateDeltas(current, previous);

    /* =========================================
       GENERATE AI MESSAGE
    ========================================= */

    const message = generateCoachMessage({
      deltas,
      session
    });

    /* =========================================
       SAVE NOTIFICATION
    ========================================= */

    const { data: inserted, error: insertError } = await supabase
      .from("notifications")
      .insert([
        {
          user_id: userId,
          message,
          type: "coach",
          read: false
        }
      ])
      .select()
      .single();

    if (insertError) {
      console.error("Failed to save notification", insertError);
      return null;
    }

    console.log("AI Coach notification created");

    return inserted;

  } catch (err) {
    console.error("AI Coach Error:", err);
    return null;
  }
}

/* =========================================================
   CALCULATE BODY CHANGES
========================================================= */

function calculateDeltas(current, previous) {

  const scoreChange =
    previous.body_score
      ? ((current.body_score - previous.body_score) /
          previous.body_score) * 100
      : 0;

  const shoulderDiff =
    current.shoulder_ratio && previous.shoulder_ratio
      ? Number(current.shoulder_ratio) -
        Number(previous.shoulder_ratio)
      : 0;

  const hipDiff =
    current.hip_ratio && previous.hip_ratio
      ? Number(current.hip_ratio) -
        Number(previous.hip_ratio)
      : 0;

  const weightDiff =
    current.weight && previous.weight
      ? Number(current.weight) -
        Number(previous.weight)
      : 0;

  return {
    scoreChange,
    shoulderDiff,
    hipDiff,
    weightDiff
  };
}

/* =========================================================
   AI MESSAGE GENERATOR
========================================================= */

function generateCoachMessage({ deltas, session }) {

  const {
    scoreChange,
    shoulderDiff,
    hipDiff,
    weightDiff
  } = deltas;

  const {
    goal = "",
    level = "",
    muscle = ""
  } = session;

  /* =====================================================
     GLUTES FOCUS
  ===================================================== */

  if (muscle === "glutes") {

    if (hipDiff > 0.015) {
      return "🍑 Glute development improved this month. Keep prioritising lower body workouts.";
    }

    if (shoulderDiff > 0.015) {
      return "⚠️ Upper body is progressing faster than glutes. Add more glute-focused volume.";
    }

    return "🍑 Stay consistent with hip thrusts and glute training this month.";
  }

  /* =====================================================
     LEGS FOCUS
  ===================================================== */

  if (muscle === "legs") {

    if (scoreChange > 2) {
      return "🦵 Leg development improved this month. Keep pushing your lower body workouts.";
    }

    return "🦵 Increase lower body intensity slightly for better leg progress.";
  }

  /* =====================================================
     CUTTING
  ===================================================== */

  if (goal === "cutting") {

    if (weightDiff < -1 || scoreChange > 0) {
      return "🔥 Great cutting progress this month. Stay consistent with nutrition and cardio.";
    }

    return "⚠️ Cutting progress slowed this month. Tighten nutrition and stay consistent.";
  }

  /* =====================================================
     BULKING
  ===================================================== */

  if (goal === "bulking") {

    if (weightDiff > 1 || scoreChange > 2) {
      return "💪 Muscle gain detected this month. Your bulk is progressing well.";
    }

    return "📈 Increase training intensity and recovery for better muscle growth.";
  }

  /* =====================================================
     RECOMP
  ===================================================== */

  if (goal === "body_recomposition") {

    if (scoreChange > 1) {
      return "⚖️ Recomposition is progressing well. Keep balancing nutrition and training.";
    }

    return "📊 Small progress is still progress. Stay consistent with workouts and protein.";
  }

  /* =====================================================
     BEGINNER
  ===================================================== */

  if (level === "beginner") {
    return "📈 Beginner progress takes time. Consistency matters most right now.";
  }

  /* =====================================================
     DEFAULT
  ===================================================== */

  return "🏋️ Keep training consistently and trust the process.";
}

/* =========================================================
   FETCH NOTIFICATIONS
========================================================= */

export async function fetchCoachNotifications(userId, limit = 8) {

  if (!userId) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select(`
      id,
      message,
      read,
      created_at
    `)
    .eq("user_id", userId)
    .eq("type", "coach")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Notification fetch failed", error);
    return [];
  }

  return data || [];
}

/* =========================================================
   MARK AS READ
========================================================= */

export async function markNotificationRead(notificationId) {

  if (!notificationId) return;

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId);

  if (error) {
    console.error("Mark read failed", error);
  }
}
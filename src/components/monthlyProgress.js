import { supabase } from "../lib/supabaseClient.js";

let grouped   = {};   // progress_photos keyed by "YYYY-MM"
let session   = null; // latest workout_sessions row for this user

/* ================================================================
   FETCH DATA
   – progress_photos for the photo/score timeline
   – workout_sessions for goal / level / muscle (most recent row)
   ================================================================ */
async function loadData() {
  const user = (await supabase.auth.getUser()).data.user;

  // 1. Progress photos
  const { data: photos } = await supabase
    .from("progress_photos")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  grouped = {};
  (photos || []).forEach(item => {
    const month = item.created_at.slice(0, 7);
    if (!grouped[month]) grouped[month] = [];
    grouped[month].push(item);
  });

  // 2. Latest workout session  →  goal / level / muscle
  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("goal, level, muscle, weight, height")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  session = sessions?.[0] ?? null;

  fillDropdowns();
  renderSessionBadges();
}

/* ================================================================
   SESSION BADGES  (goal · level · muscle shown at top)
   ================================================================ */
function renderSessionBadges() {
  const el = document.getElementById("sessionMeta");
  if (!el) return;
  if (!session) { el.innerHTML = ""; return; }

  const goalLabel  = { cutting: "🔥 Cutting", bulking: "💪 Bulking", body_recomposition: "⚖️ Recomposition" };
  const levelLabel = { beginner: "🌱 Beginner", intermediate: "⚡ Intermediate", expert: "🏆 Expert" };
  const muscleLabel = { glutes: "🍑 Glutes", legs: "🦵 Legs" };

  const badges = [
    session.goal   ? `<span class="badge goal">${goalLabel[session.goal]   ?? session.goal}</span>`   : "",
    session.level  ? `<span class="badge level">${levelLabel[session.level] ?? session.level}</span>` : "",
    session.muscle ? `<span class="badge muscle">${muscleLabel[session.muscle] ?? session.muscle}</span>` : "",
  ].filter(Boolean).join("");

  el.innerHTML = badges;
}

/* ================================================================
   FILL MONTH DROPDOWNS
   ================================================================ */
function fillDropdowns() {
  const monthA = document.getElementById("monthA");
  const monthB = document.getElementById("monthB");
  const months = Object.keys(grouped);

  monthA.innerHTML = "";
  monthB.innerHTML = "";

  months.forEach(m => {
    [monthA, monthB].forEach(sel => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.innerText = formatMonth(m);
      sel.appendChild(opt);
    });
  });

  if (months.length > 1) monthB.value = months[months.length - 1];
}

/* ================================================================
   FORMAT MONTH  "2025-03" → "Mar 2025"
   ================================================================ */
function formatMonth(m) {
  const [year, month] = m.split("-");
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${names[parseInt(month) - 1]} ${year}`;
}

/* ================================================================
   RENDER MONTH PHOTOS
   ================================================================ */
function renderMonth(month, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  if (!grouped[month]) {
    container.innerHTML = `<div class="no-data">No photos for this month</div>`;
    return;
  }

  grouped[month].forEach(item => {
    container.innerHTML += `
      <div class="photo-card">
        <div class="photo-wrap">
          <img src="${item.photo_url}" alt="Progress photo" />
        </div>
        <div class="photo-meta">
          <div class="meta-row">
            <span class="meta-label">Score</span>
            <span class="meta-value highlight">${item.body_score?.toFixed(2) ?? "—"}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Weight</span>
            <span class="meta-value">${item.weight ? item.weight + " kg" : "N/A"}</span>
          </div>
          ${item.shoulder_ratio ? `<div class="meta-row"><span class="meta-label">Shoulder Ratio</span><span class="meta-value">${parseFloat(item.shoulder_ratio).toFixed(2)}</span></div>` : ""}
          ${item.hip_ratio      ? `<div class="meta-row"><span class="meta-label">Hip Ratio</span><span class="meta-value">${parseFloat(item.hip_ratio).toFixed(2)}</span></div>` : ""}
          ${item.notes ? `<div class="meta-notes">"${item.notes}"</div>` : ""}
        </div>
      </div>
    `;
  });
}

/* ================================================================
   INTERPRET METRICS BY GOAL
   What counts as "good" depends entirely on the goal:

   CUTTING:
     – Upper body shrinking   → ✅ fat loss working
     – Hip ratio increasing   → ✅ glutes/hips more prominent as waist shrinks
     – Waist increasing       → ❌ cut failed, storing fat not burning it
     – Weight dropping        → ✅ expected
     – Weight gaining         → ⚠️  check if muscle or fat

   BULKING:
     – Upper body growing     → ✅ mass added
     – Weight gaining         → ✅ expected
     – Waist increasing too   → ⚠️  dirty bulk, too much fat gain
     – Hip ratio dropping     → ⚠️  waist widening faster than hips

   BODY_RECOMPOSITION:
     – Upper body same size, more defined → ✅
     – Waist tightening while weight holds → ✅
     – Hip ratio improving                → ✅
   ================================================================ */

function interpretMetrics({ goal, shoulderDiff, hipDiff, weightDiff, scoreDiff }) {
  // shoulder_ratio: higher = wider shoulders relative to waist → upper body bigger
  // hip_ratio:      higher = wider hips relative to waist → curves more pronounced
  // We also separately track waist signal:
  //   if hip_ratio goes UP it means hips grew OR waist shrank — on a cut that's a WIN
  //   if hip_ratio goes DOWN it means waist grew OR hips shrank — on a cut that's a FAIL

  const signals = {
    upperBody: null,  // "good" | "bad" | "neutral"
    waist:     null,
    hips:      null,
    weight:    null,
    overall:   null,
  };

  const g = goal || "body_recomposition";

  /* ---- Upper body (shoulder_ratio) ---- */
  if (shoulderDiff !== null) {
    if (g === "cutting") {
      // Shrinking shoulders = fat leaving upper body = ✅ on a cut
      signals.upperBody = shoulderDiff < -0.01 ? "good"
                        : shoulderDiff >  0.01 ? "warn"   // growing = not cutting well
                        : "neutral";
    } else if (g === "bulking") {
      signals.upperBody = shoulderDiff > 0.01 ? "good"
                        : shoulderDiff < -0.01 ? "bad"
                        : "neutral";
    } else {
      // recomp: stable or slight shrink with better score = good
      signals.upperBody = Math.abs(shoulderDiff) < 0.015 ? "good"
                        : shoulderDiff > 0.02 ? "warn"
                        : "neutral";
    }
  }

  /* ---- Hips & Waist (hip_ratio) ---- */
  if (hipDiff !== null) {
    if (g === "cutting") {
      // hip_ratio UP = hips more prominent = waist shrinking relative to hips = ✅
      // hip_ratio DOWN = waist growing = fat gain = ❌ CUT FAILED
      signals.hips  = hipDiff >  0.01 ? "good" : hipDiff < -0.01 ? "bad" : "neutral";
      signals.waist = hipDiff < -0.01 ? "fail" : hipDiff >  0.01 ? "good" : "neutral";
    } else if (g === "bulking") {
      // hip_ratio dropping = waist widening faster = dirty bulk warning
      signals.hips  = hipDiff > 0.01 ? "good" : "neutral";
      signals.waist = hipDiff < -0.015 ? "warn" : "neutral";
    } else {
      // recomp: any hip_ratio improvement = good
      signals.hips  = hipDiff > 0.01 ? "good" : hipDiff < -0.01 ? "warn" : "neutral";
      signals.waist = hipDiff < -0.01 ? "warn" : "neutral";
    }
  }

  /* ---- Weight ---- */
  if (weightDiff !== null) {
    if (g === "cutting") {
      signals.weight = weightDiff < -0.3 ? "good"
                     : weightDiff >  0.5 ? "bad"
                     : "neutral";
    } else if (g === "bulking") {
      signals.weight = weightDiff > 0.3 ? "good"
                     : weightDiff < -0.3 ? "bad"
                     : "neutral";
    } else {
      // recomp: weight should be stable
      signals.weight = Math.abs(weightDiff) < 0.5 ? "good" : "neutral";
    }
  }

  return signals;
}

/* ================================================================
   GOAL-AWARE COMMENT ENGINE
   ================================================================ */
function goalComment({ goal, level, muscle, signals, scoreDiff, weightDiff, change }) {
  const pct = Math.abs(change).toFixed(1);
  const g   = goal  || "body_recomposition";
  const l   = level || "beginner";

  /* ---- build context sentences from signals ---- */
  const ctxLines = [];

  if (g === "cutting") {
    if (signals.waist === "fail") {
      ctxLines.push("⚠️ Waist has widened — this signals the cut has stalled. Fat is not being burned effectively.");
    }
    if (signals.upperBody === "good") {
      ctxLines.push("✅ Upper body is leaning down — fat is leaving the torso as expected on a cut.");
    }
    if (signals.upperBody === "warn") {
      ctxLines.push("⚠️ Upper body is growing on a cut — check if you're in a true deficit or unintentionally eating at surplus.");
    }
    if (signals.hips === "good") {
      ctxLines.push("✅ Hip ratio has improved — glutes and hips are more prominent as the waist shrinks. This is exactly what a cut should achieve.");
    }
    if (signals.weight === "good") {
      ctxLines.push("✅ Bodyweight is dropping — overall energy balance is in deficit.");
    }
    if (signals.weight === "bad") {
      ctxLines.push("⚠️ Weight is climbing on a cut — audit your calorie tracking, liquid calories, and weekend eating habits.");
    }
  }

  if (g === "bulking") {
    if (signals.upperBody === "good") {
      ctxLines.push("✅ Upper body mass is increasing — bulk is translating into muscle size.");
    }
    if (signals.waist === "warn") {
      ctxLines.push("⚠️ Waist-to-hip ratio shifting — your bulk may be getting dirty. Reduce surplus to 200–300 kcal to limit fat gain.");
    }
    if (signals.weight === "good") {
      ctxLines.push("✅ Weight is climbing as expected on a bulk.");
    }
    if (signals.weight === "bad") {
      ctxLines.push("⚠️ Weight is dropping on a bulk — increase daily calories, especially around training.");
    }
  }

  if (g === "body_recomposition") {
    if (signals.hips === "good" && signals.upperBody === "good") {
      ctxLines.push("✅ Body proportions are improving — losing fat while holding muscle is the recomp goal, and it's working.");
    }
    if (signals.waist === "warn") {
      ctxLines.push("⚠️ Waist is widening during recomp — increase protein intake and reduce processed carbs to shift the balance.");
    }
    if (signals.weight === "good") {
      ctxLines.push("✅ Weight is stable — ideal for recomposition.");
    }
  }

  /* ---- muscle-specific advice ---- */
  const muscleAdvice = {
    glutes: {
      cutting:            "On a cut, glutes can flatten as overall mass drops. Maintain hip thrust volume and keep protein high (2 g/kg) to preserve glute shape.",
      bulking:            "Glutes respond well to a surplus — prioritise hip thrusts, sumo deadlifts, and Bulgarian split squats to direct mass to this area.",
      body_recomposition: "Glutes are a great recomp target — they respond to both fat loss and hypertrophy. Keep hip-dominant work at 3–4 sets twice per week.",
    },
    legs: {
      cutting:            "Legs tend to lean out later in a cut. Add cycling or stair cardio to accelerate leg fat loss while keeping squat volume to maintain muscle.",
      bulking:            "Legs have the most growth potential — squat frequency (2× per week), leg press volume, and adequate sleep are the three levers to pull.",
      body_recomposition: "For leg recomp, alternate between strength (3–5 rep) and hypertrophy (8–12 rep) blocks every 4 weeks to keep the stimulus novel.",
    },
  };

  const muscleLine = muscle && muscleAdvice[muscle]?.[g]
    ? muscleAdvice[muscle][g]
    : "";

  /* ---- level-specific tip ---- */
  const levelTip = {
    cutting: {
      beginner:     "As a beginner cutter, a 200–300 kcal deficit with 1.8 g/kg protein is enough — don't crash diet.",
      intermediate: "At intermediate level, add one refeed day per week at maintenance calories to prevent metabolic adaptation.",
      expert:       "At expert level, consider carb cycling or peak week water manipulation to push definition further.",
    },
    bulking: {
      beginner:     "Beginner bulk tip: compound lifts 3× per week with progressive overload will drive most of your gains.",
      intermediate: "Intermediate bulk tip: track strength PRs weekly — if the bar isn't moving up, neither is the muscle.",
      expert:       "Expert bulk tip: monitor body-fat monthly via DEXA or skinfolds to keep the lean-to-fat gain ratio optimal.",
    },
    body_recomposition: {
      beginner:     "Beginners have elite recomp potential — prioritise sleep (7–9 hrs), protein, and 3–4 resistance sessions per week.",
      intermediate: "Intermediate recomp tip: periodise with 4-week strength blocks followed by 4-week hypertrophy blocks.",
      expert:       "Expert recomp tip: recomp is extremely slow at your level — short dedicated bulk/cut phases will produce faster visible change.",
    },
  };

  const tip = levelTip[g]?.[l] ?? "";

  const context = ctxLines.length
    ? ctxLines.join(" ") + " "
    : `Body score changed ${change >= 0 ? "+" : ""}${change.toFixed(1)}%. `;

  return `${context}${muscleLine ? muscleLine + " " : ""}${tip}`.trim();
}

/* ================================================================
   MUSCLE GROUP BREAKDOWN TAGS
   Goal-aware: "gain" / "loss" tags mean different things per goal
   ================================================================ */
function analyzeMuscleGroups(A, B, muscle, goal) {
  const groups     = [];
  const g          = goal || "body_recomposition";
  const scoreDiff  = B.body_score - A.body_score;
  const weightDiff = A.weight && B.weight ? Number(B.weight) - Number(A.weight) : null;

  const shoulderDiff = (A.shoulder_ratio && B.shoulder_ratio)
    ? Number(B.shoulder_ratio) - Number(A.shoulder_ratio) : null;
  const hipDiff = (A.hip_ratio && B.hip_ratio)
    ? Number(B.hip_ratio) - Number(A.hip_ratio) : null;

  /* ---- Upper body ---- */
  if (shoulderDiff !== null) {
    if (g === "cutting") {
      // Shrinking = fat leaving = GOOD on cut
      if (shoulderDiff < -0.01)
        groups.push({ name: "Upper Body", icon: "💪", status: "gain", detail: "Leaning down ✅ — upper body fat reducing as expected on a cut" });
      else if (shoulderDiff > 0.01)
        groups.push({ name: "Upper Body", icon: "💪", status: "warn", detail: "Growing on a cut ⚠️ — verify you're in a calorie deficit" });
    } else if (g === "bulking") {
      if (shoulderDiff > 0.01)
        groups.push({ name: "Upper Body", icon: "💪", status: "gain", detail: "Mass added ✅ — shoulder width increasing" });
      else if (shoulderDiff < -0.01)
        groups.push({ name: "Upper Body", icon: "💪", status: "loss", detail: "Shrinking on a bulk ⚠️ — increase calorie surplus" });
    } else {
      groups.push({ name: "Upper Body", icon: "💪", status: Math.abs(shoulderDiff) < 0.015 ? "neutral" : "gain", detail: "Proportions holding steady — recomp progressing" });
    }
  }

  /* ---- Waist / Hips (hip_ratio) ---- */
  if (hipDiff !== null) {
    if (g === "cutting") {
      if (hipDiff > 0.01) {
        // Hips more prominent = waist narrower = CUT WORKING
        groups.push({ name: "Hips & Waist", icon: "🔥", status: "gain", detail: "Hip ratio up ✅ — waist is shrinking, curves more defined. Cut is working." });
      } else if (hipDiff < -0.01) {
        // Waist growing = CUT FAILED
        groups.push({ name: "Hips & Waist", icon: "⚠️", status: "fail", detail: "Hip ratio down ❌ — waist is widening. Fat is accumulating. Cut has stalled." });
      } else {
        groups.push({ name: "Hips & Waist", icon: "🔥", status: "neutral", detail: "Waist holding — deficit may need increasing to see change" });
      }
    } else if (g === "bulking") {
      if (hipDiff < -0.015)
        groups.push({ name: "Hips & Waist", icon: "⚠️", status: "warn", detail: "Waist growing faster than hips — dirty bulk. Reduce surplus to 200–300 kcal." });
      else if (hipDiff > 0.01)
        groups.push({ name: "Hips & Waist", icon: "🔥", status: "gain", detail: "Hip-to-waist ratio improving even on a bulk — excellent body composition" });
      else
        groups.push({ name: "Hips & Waist", icon: "🔥", status: "neutral", detail: "Proportions stable on bulk — clean bulk on track" });
    } else {
      if (hipDiff > 0.01)
        groups.push({ name: "Hips & Waist", icon: "🔥", status: "gain", detail: "Waist tightening while shape improves ✅ — recomp working" });
      else if (hipDiff < -0.01)
        groups.push({ name: "Hips & Waist", icon: "⚠️", status: "warn", detail: "Waist widening during recomp — increase protein and reduce refined carbs" });
    }
  }

  /* ---- Glutes ---- */
  if (muscle === "glutes") {
    let status, detail;
    if (g === "cutting") {
      // On a cut, glutes should ideally stay or improve in shape even as fat drops
      status = hipDiff !== null
        ? (hipDiff > 0.01 ? "gain" : hipDiff < -0.01 ? "loss" : "neutral")
        : "neutral";
      detail = status === "gain"
        ? "Glute shape preserved ✅ — hip ratio up even on a cut. Hip thrusts are paying off."
        : status === "loss"
        ? "Glutes flattening on cut ⚠️ — increase hip thrust frequency and keep protein at 2 g/kg."
        : "Glutes holding shape — maintain hip-dominant volume through the cut.";
    } else {
      status = scoreDiff > 0.04 ? "gain" : scoreDiff < -0.04 ? "loss" : "neutral";
      detail = status === "gain"
        ? "Glute hypertrophy visible — hip-dominant training is working."
        : status === "loss"
        ? "Glute volume dipping — add hip thrusts, RDLs, and sumo deadlifts."
        : "Glutes stable — apply progressive overload to break plateau.";
    }
    groups.push({ name: "Glutes", icon: "🍑", status, detail });
  }

  /* ---- Legs ---- */
  if (muscle === "legs") {
    let status, detail;
    if (g === "cutting") {
      status = weightDiff !== null && weightDiff < -0.3 ? "gain" : "neutral";
      detail = status === "gain"
        ? "Legs leaning down ✅ — weight drop on a cut is expected. Maintain squat volume to preserve muscle."
        : "Leg definition holding — increase cardio (cycling, stairs) to accelerate leg fat loss without losing muscle.";
    } else {
      status = weightDiff !== null
        ? (weightDiff > 0.3 ? "gain" : weightDiff < -0.5 ? "loss" : "neutral")
        : (scoreDiff > 0.03 ? "gain" : "neutral");
      detail = status === "gain"
        ? `Leg mass up${weightDiff ? " +" + weightDiff.toFixed(1) + " kg" : ""} — quads & hamstrings responding.`
        : status === "loss"
        ? "Leg volume dropped — prioritise squats and leg press volume."
        : "Legs stable — increase TUT and add a second leg day to break plateau.";
    }
    groups.push({ name: "Legs", icon: "🦵", status, detail });
  }

  /* ---- Generic lower body fallback ---- */
  if (!muscle && weightDiff !== null && g !== "cutting") {
    if (weightDiff > 0.5)
      groups.push({ name: "Lower Body", icon: "🦵", status: "gain", detail: `+${weightDiff.toFixed(1)} kg — mass being added` });
    else if (weightDiff < -1)
      groups.push({ name: "Lower Body", icon: "🦵", status: "loss", detail: `${weightDiff.toFixed(1)} kg change` });
  }

  /* ---- Overall ---- */
  if (scoreDiff > 0.08)
    groups.push({ name: "Overall Physique", icon: "⚡", status: "gain", detail: "Strong all-round improvement in body score" });

  if (groups.length === 0)
    groups.push({ name: "Maintenance Phase", icon: "📊", status: "neutral", detail: "Holding steady — consistency counts" });

  return groups;
}

/* ================================================================
   COMPARE
   ================================================================ */
window.compareMonths = function () {
  const a = document.getElementById("monthA").value;
  const b = document.getElementById("monthB").value;

  renderMonth(a, "viewA");
  renderMonth(b, "viewB");

  const A      = grouped[a]?.[0];
  const B      = grouped[b]?.[0];
  const result = document.getElementById("result");

  if (!A || !B) {
    result.innerHTML = `<div class="no-data">Not enough data to compare</div>`;
    return;
  }

  const scoreDiff  = B.body_score - A.body_score;
  const weightDiff = A.weight && B.weight ? Number(B.weight) - Number(A.weight) : null;
  const change     = (scoreDiff / A.body_score) * 100;
  const improved   = change > 0;

  const muscle       = session?.muscle ?? null;
  const goal         = session?.goal   ?? null;

  const shoulderDiff = (A.shoulder_ratio && B.shoulder_ratio)
    ? Number(B.shoulder_ratio) - Number(A.shoulder_ratio) : null;
  const hipDiff = (A.hip_ratio && B.hip_ratio)
    ? Number(B.hip_ratio) - Number(A.hip_ratio) : null;

  const signals      = interpretMetrics({ goal, shoulderDiff, hipDiff, weightDiff, scoreDiff });
  const muscleGroups = analyzeMuscleGroups(A, B, muscle, goal);

  /* coaching comment */
  const comment = goalComment({
    goal,
    level:  session?.level ?? null,
    muscle,
    signals,
    scoreDiff,
    weightDiff,
    change,
  });

  /* muscle tags HTML */
  const muscleHTML = muscleGroups.map(g => `
    <div class="muscle-tag ${g.status}">
      <span class="muscle-icon">${g.icon}</span>
      <div class="muscle-info">
        <strong>${g.name}</strong>
        <small>${g.detail}</small>
      </div>
      <span class="muscle-badge">${
        g.status === "gain"    ? "▲ Gain"   :
        g.status === "loss"    ? "▼ Loss"   :
        g.status === "warn"    ? "⚠ Check"  :
        g.status === "fail"    ? "✕ Stalled":
        "→ Hold"
      }</span>
    </div>
  `).join("");

  const weightLine = weightDiff !== null
    ? `<div class="stat-row">
         <span>Weight</span>
         <span>${A.weight} kg → ${B.weight} kg
           <em class="${weightDiff >= 0 ? "pos" : "neg"}">(${weightDiff >= 0 ? "+" : ""}${weightDiff.toFixed(1)} kg)</em>
         </span>
       </div>`
    : "";

  result.innerHTML = `
    <div class="result-header">
      <div class="result-title">${improved ? "🚀 Progress Detected" : "📉 Room to Grow"}</div>
      <div class="result-period">${formatMonth(a)} → ${formatMonth(b)}</div>
    </div>

    <div class="stats-grid">
      <div class="stat-row">
        <span>Body Score</span>
        <span>${A.body_score.toFixed(3)} → ${B.body_score.toFixed(3)}
          <em class="${improved ? "pos" : "neg"}">(${improved ? "+" : ""}${change.toFixed(2)}%)</em>
        </span>
      </div>
      ${weightLine}
    </div>

    <div class="coach-comment">
      <div class="coach-label">🧠 Coach Insight</div>
      <p>${comment}</p>
    </div>

    <div class="muscle-section">
      <div class="muscle-heading">Muscle Group Breakdown</div>
      ${muscleHTML}
    </div>
  `;
};

/* ================================================================
   INIT
   ================================================================ */
loadData();
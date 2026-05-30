
// ═══════════════════════════════════════════════════════
// SCREEN 2 — LIVE WORKOUT
// ═══════════════════════════════════════════════════════
const wState = {};
exercises.forEach(ex => {
  wState[ex.id] = {
    sets: ex.sets ?? 3,
    reps: parseReps(ex.reps),
    weight: parseFloat(ex.startingWeight) || 10,
    diff: 0, enjoy: 0, prog: null, done: false,
  };
});


let timerStart = Date.now();
let timerIv    = null;


function startTimer() {
  timerStart = Date.now();
  timerIv = setInterval(() => {
    const s = Math.floor((Date.now() - timerStart) / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const pad = n => String(n).padStart(2, "0");
    document.getElementById("wTimerDisplay").textContent =
      h ? `${pad(h)}:${pad(m%60)}:${pad(s%60)}` : `${pad(m)}:${pad(s%60)}`;
  }, 1000);
}


function updateWorkoutProgress() {
  const total = exercises.length;
  const done  = exercises.filter(e => wState[e.id].done).length;
  document.getElementById("wDoneCount").textContent = `${done} / ${total}`;
  document.getElementById("wProgressFill").style.width = total ? `${(done/total)*100}%` : "0%";
  document.getElementById("finishWorkoutBtn").disabled = done === 0;
}

import { supabase } from "../lib/supabaseClient.js";


const stored    = JSON.parse(localStorage.getItem("currentWorkout")) || {};
const plan      = stored.plan      || [];
const calories  = stored.calories  || 0;
const sessionId = stored.sessionId || null;
const session   = stored.session   || {};
const thisWeek  = stored.week || parseInt(localStorage.getItem("currentWeek")) || 1;
const lastWeek  = Math.max(0, thisWeek - 1);

const { data: { user } } = await supabase.auth.getUser();
if (!user) { 
  window.location.href = "/login"; 
}

// ═══════════════════════════════
// UTILS
// ═══════════════════════════════
function toast(msg, dur = 2400) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), dur);
}

function parseReps(raw) {
  return parseInt((raw || "10").toString().replace(/[–—].*/,"")) || 10;
}

function deltaChip(label, last, curr, unit = "") {
  if (last == null || last === 0) return "";
  const d = curr - last;
  if (d === 0) return `<span class="chip chip-muted">→ ${label}</span>`;
  const cls = d > 0 ? "chip-lime" : "chip-red";
  const arrow = d > 0 ? "↑" : "↓";
  return `<span class="chip ${cls}">${arrow} ${label} ${d > 0 ? "+" : ""}${d}${unit}</span>`;
}
function initWorkout() {
  const body = document.getElementById("workout-body");
  body.innerHTML = "";


  if (!exercises.length) {
    body.innerHTML = `<div class="empty-state"><div class="empty-title">No exercises</div><div class="empty-sub">Build your plan first in the Plan tab.</div></div>`;
    return;
  }


  const dayNames = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];


  plan.forEach((day, di) => {
    const dayExes = [
      day.compound  ? {...day.compound,  exType:"compound"}  : null,
      day.isolation ? {...day.isolation, exType:"isolation"} : null,
    ].filter(Boolean);
    if (!dayExes.length) return;


    const dayHead = document.createElement("div");
    dayHead.style.cssText = "padding:.2rem 1.2rem .5rem;display:flex;align-items:center;gap:8px";
    dayHead.innerHTML = `
      <span style="font-family:'Syne',sans-serif;font-size:.9rem;font-weight:700">Day ${day.day}</span>
      <span style="font-size:11px;color:var(--sub)">${dayNames[di % 7]}</span>
    `;
    body.appendChild(dayHead);


    dayExes.forEach(ex => {
      const s = wState[ex.id];
      const block = document.createElement("div");
      block.className = "ex-block";
      block.id = "wb-" + ex.id;


      block.innerHTML = `
        <div class="ex-block-inner" id="wbi-${ex.id}">
          <div class="ex-head">
            <span class="type-pip pip-${ex.exType}"></span>
            <span class="ex-head-name">${ex.name}</span>
            <span class="ex-head-tag tag-${ex.exType === "compound" ? "c" : "i"}">${ex.exType}</span>
            <div class="check-circle" id="wchk-${ex.id}" onclick="wToggleDone('${ex.id}')">
              <svg viewBox="0 0 14 14"><polyline points="2,7 6,11 12,3" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
          </div>
          <div class="ex-inputs">
            <div class="input-grp">
              <span class="label">Sets</span>
              <input class="num-input" type="number" value="${s.sets}" min="1" max="20"
                     oninput="wField('${ex.id}','sets',this.value)"/>
            </div>
            <div class="input-grp">
              <span class="label">Reps</span>
              <input class="num-input" type="number" value="${s.reps}" min="1" max="100"
                     oninput="wField('${ex.id}','reps',this.value)"/>
            </div>
            <div class="input-grp">
              <span class="label">Weight</span>
              <div class="w-wrap">
                <input class="num-input" type="number" value="${s.weight}" min="1" max="999" step="0.5"
                       oninput="wField('${ex.id}','weight',this.value,true)"/>
                <span class="w-unit">kg</span>
              </div>
            </div>
          </div>
          <div class="ex-ratings">
            <div class="ratings-line">
              <span class="label">Difficulty</span>
              <div class="stars-row" id="wd-${ex.id}">
                ${[1,2,3,4,5].map(n => `<button class="star-btn" data-v="${n}" onclick="wSetRating('${ex.id}','diff',${n})">🔥</button>`).join("")}
              </div>
            </div>
            <div class="ratings-line">
              <span class="label">Enjoyment</span>
              <div class="stars-row" id="we-${ex.id}">
                ${[1,2,3,4,5].map(n => `<button class="star-btn" data-v="${n}" onclick="wSetRating('${ex.id}','enjoy',${n})">★</button>`).join("")}
              </div>
            </div>
            <div>
              <div class="label" style="margin-bottom:5px">Progress vs last week</div>
              <div class="prog-row" id="wp-${ex.id}">
                <button class="prog-pill" onclick="wSetProg('${ex.id}',-1)">↓ Worse</button>
                <button class="prog-pill" onclick="wSetProg('${ex.id}',0)">→ Same</button>
                <button class="prog-pill" onclick="wSetProg('${ex.id}',1)">↑ Better</button>
              </div>
            </div>
          </div>
        </div>
      `;
      body.appendChild(block);
    });
  });


  updateWorkoutProgress();
  startTimer();
}


window.wToggleDone = function(id) {
  wState[id].done = !wState[id].done;
  const chk   = document.getElementById("wchk-"  + id);
  const inner = document.getElementById("wbi-"   + id);
  chk?.classList.toggle("done",    wState[id].done);
  inner?.classList.toggle("done-ex", wState[id].done);
  updateWorkoutProgress();
  if (wState[id].done) toast("Exercise done ✓");
};


window.wField = function(id, field, val, isFloat = false) {
  const v = isFloat ? parseFloat(val) : parseInt(val, 10);
  if (!isNaN(v)) wState[id][field] = v;
};


window.wSetRating = function(id, type, val) {
  wState[id][type] = val;
  const wrap = document.getElementById(`w${type === "diff" ? "d" : "e"}-${id}`);
  const cls  = type === "diff" ? "on-diff" : "on-enjoy";
  wrap?.querySelectorAll(".star-btn").forEach(b => {
    b.classList.toggle(cls, parseInt(b.dataset.v) <= val);
  });
};


window.wSetProg = function(id, val) {
  wState[id].prog = val;
  const wrap = document.getElementById("wp-" + id);
  wrap?.querySelectorAll(".prog-pill").forEach(b =>
    b.classList.remove("sel-worse","sel-same","sel-better")
  );
  const selMap = {"-1":"sel-worse","0":"sel-same","1":"sel-better"};
  const btns = wrap?.querySelectorAll(".prog-pill");
  if (btns) btns[val + 1]?.classList.add(selMap[String(val)]);
};


window.finishWorkout = async function() {
  const btn = document.getElementById("finishWorkoutBtn");
  btn.disabled = true;
  btn.textContent = "Saving…";
  clearInterval(timerIv);


  const dur = Math.floor((Date.now() - timerStart) / 1000);


  try {
    const rows = exercises.map(ex => {
      const s = wState[ex.id];
      return {
        user_id: user.id, session_id: sessionId,
        exercise_id: ex.id, week_number: thisWeek,
        completed: s.done,
        sets:    s.done ? s.sets   : 0,
        reps:    s.done ? s.reps   : 0,
        weight_used:       s.done ? s.weight : 0,
        difficulty_rating: s.done ? (s.diff  || null) : null,
        enjoyment_rating:  s.done ? (s.enjoy || null) : null,
        progress_score:    s.done ? s.prog : null,
        duration_seconds:  s.done ? dur : null,
      };
    });


    const { error } = await supabase.from("user_exercise_logs")
      .upsert(rows, { onConflict: ["user_id","session_id","exercise_id","week_number"] });


    if (error) throw error;


    localStorage.setItem("currentWeek", thisWeek + 1);
    localStorage.removeItem("currentWorkout");
    localStorage.removeItem("workoutEditState");


    toast(`Workout saved 💪 (${exercises.filter(e=>wState[e.id].done).length} done)`);
    setTimeout(() => switchTab("history"), 1800);
  } catch (err) {
    toast("❌ " + (err?.message || "Save failed"));
    btn.disabled = false;
    btn.textContent = "Save Workout";
    startTimer();
  }
};


// ═══════════════════════════════════════════════════════
// SCREEN 3 — PLAN + RATINGS
// ═══════════════════════════════════════════════════════
const planRatings = { overall: 3, feel: "good" };


function initPlan() {
  const body = document.getElementById("plan-body");
  body.innerHTML = "";


  if (!plan.length) {
    body.innerHTML = `
      <div class="page-head"><div><div class="page-title">Your Plan</div></div></div>
      <div class="empty-state">
        <div class="empty-icon">🤖</div>
        <div class="empty-title">No plan generated yet</div>
        <div class="empty-sub">Go to the AI page to generate your personalised workout plan.</div>
      </div>`;
    return;
  }


  const hero = document.createElement("div");
  hero.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title">Your Plan</div>
        <div class="page-sub">${plan.length} training days · ${calories ? calories.toLocaleString() + " kcal/day" : ""}</div>
      </div>
    </div>
    <div class="plan-hero" style="margin:0 1.2rem .9rem">
      <div class="hero-week">Week ${thisWeek}</div>
      <div class="hero-title">${(session.goal || "Training").replace(/^\w/,c=>c.toUpperCase())} Plan</div>
      <div class="hero-sub">${session.level || "Personalised"} · ${exercises.length} exercises total</div>
    </div>
  `;
  body.appendChild(hero);


  const dayNames = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];


  plan.forEach((day, di) => {
    const dayExes = [
      day.compound  ? {...day.compound,  exType:"compound"}  : null,
      day.isolation ? {...day.isolation, exType:"isolation"} : null,
    ].filter(Boolean);
    if (!dayExes.length) return;


    const isToday = di === new Date().getDay() - 1;
    const section = document.createElement("div");
    section.className = "day-section";
    section.innerHTML = `
      <div class="day-head">
        <div class="day-name">Day ${day.day} · ${dayNames[di % 7]}</div>
        ${isToday ? `<span class="day-badge">Today</span>` : ""}
      </div>
    `;


    dayExes.forEach(ex => {
      const row = document.createElement("div");
      row.className = "plan-ex-row";
      row.innerHTML = `
        <span class="type-pip pip-${ex.exType}" style="width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0"></span>
        <div class="plan-ex-info">
          <div class="plan-ex-name">${ex.name}</div>
          <div class="plan-ex-params">
            <span class="plan-param">${ex.sets} sets</span>
            <span class="plan-param">${ex.reps} reps</span>
            <span class="plan-param">rest ${ex.rest}</span>
          </div>
        </div>
        <div class="plan-weight">${ex.startingWeight}kg</div>
      `;
      section.appendChild(row);
    });


    body.appendChild(section);
  });


  const rateCard = document.createElement("div");
  rateCard.className = "rate-card";
  rateCard.innerHTML = `
    <div class="rate-title">Rate this plan</div>
    <div class="rate-grid" id="planRateGrid">
      <div class="rate-option" data-v="1" onclick="selectPlanRating(1)">
        <span class="rate-emoji" style="font-size:22px">😩</span>
        <span class="rate-text">Too hard</span>
      </div>
      <div class="rate-option" data-v="2" onclick="selectPlanRating(2)">
        <span class="rate-emoji" style="font-size:22px">😐</span>
        <span class="rate-text">Too easy</span>
      </div>
      <div class="rate-option" data-v="3" onclick="selectPlanRating(3)">
        <span class="rate-emoji" style="font-size:22px">💪</span>
        <span class="rate-text">Just right</span>
      </div>
      <div class="rate-option" data-v="4" onclick="selectPlanRating(4)">
        <span class="rate-emoji" style="font-size:22px">🔥</span>
        <span class="rate-text">Love it</span>
      </div>
    </div>
    <div class="overall-feel">
      <div class="feel-label">Overall feel: <strong id="feelLabel">Neutral</strong></div>
      <input class="feel-slider" type="range" min="1" max="5" value="3" step="1"
             oninput="updateFeel(this.value)" id="feelSlider"/>
    </div>
    <div style="margin-top:.6rem">
      <div class="label" style="margin-bottom:.4rem">Notes (optional)</div>
      <textarea id="planNotes" style="width:100%;background:var(--s3);border:1px solid var(--border2);border-radius:var(--r-sm);color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;padding:.6rem .8rem;resize:vertical;min-height:60px;outline:none" placeholder="Any feedback about this week's plan…"></textarea>
    </div>
    <button class="btn-primary" style="margin-top:.8rem" onclick="submitPlanRating()">
      Submit rating
    </button>
  `;
  body.appendChild(rateCard);
}


window.selectPlanRating = function(val) {
  planRatings.overall = val;
  document.querySelectorAll("#planRateGrid .rate-option").forEach(el => {
    el.classList.toggle("selected", parseInt(el.dataset.v) === val);
  });
};


const feelLabels = ["","Terrible","Poor","Neutral","Good","Excellent"];
window.updateFeel = function(val) {
  planRatings.feel = val;
  document.getElementById("feelLabel").textContent = feelLabels[parseInt(val)] || "";
};


window.submitPlanRating = async function() {
  const notes = document.getElementById("planNotes")?.value || "";
  const { error } = await supabase.from("user_session_ratings").upsert([{
    user_id: user.id,
    session_id: sessionId,
    week_number: thisWeek,
    plan_rating: planRatings.overall,
    feel_score: parseInt(planRatings.feel),
    notes: notes || null,
  }], { onConflict: ["user_id","session_id","week_number"] }).select();


  if (!error || error.code === "42P01") {
    toast("Plan rated — thanks! 🙌");
  } else {
    toast("❌ " + error.message);
  }
};

initWorkout();
initPlan();


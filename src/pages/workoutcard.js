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

function allExercises() {
  return plan.flatMap(day =>
    [day.compound  ? {...day.compound,  exType:"compound"}  : null,
     day.isolation ? {...day.isolation, exType:"isolation"} : null]
    .filter(Boolean)
  );
}
const exercises = allExercises();

// ═══════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════
let activeTab = "history";
window.switchTab = function(tab) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));

  document.getElementById("screen-" + tab).classList.add("active");
  document.getElementById("nav-" + tab).classList.add("active");

  activeTab = tab;

  if (tab === "all") {
    initAllExercises();
  }
};

// ═══════════════════════════════
// SUPABASE HELPERS
// ═══════════════════════════════

async function fetchLogs(week) {
  if (!week) return {};
  const { data, error } = await supabase
    .from("user_exercise_logs")
    .select(`
  *,
  exercises (
    name
  )
`)
    .eq("user_id", user.id)
    .eq("week_number", week);

  if (error) {
    console.error("fetchLogs error:", error);
    return {};
  }
  const map = {};
  (data || []).forEach(r => map[r.exercise_id] = r);
  return map;
}

async function fetchLog(week) {
  if (!week) return {};

  const { data, error } = await supabase
    .from("user_exercise_logs")
    .select(`
      *,
      exercises (
        name,
        muscle
      )
    `)
    .eq("user_id", user.id)
    .eq("week_number", week);

  if (error) {
    console.error("fetchLogs error:", error);
    return {};
  }

  const map = {};
  (data || []).forEach(r => map[r.exercise_id] = r);
  return map;
}


// ═══════════════════════════════
// ALL EXERCISES TAB
// ═══════════════════════════════

let activeMuscle = "all";
let enriched = [];

async function initAllExercises() {
  const body = document.getElementById("screen-all");
  if (!body) return;

  
  const { data: rows, error } = await supabase
    .from("user_exercise_logs")
    .select(`
      *,
      exercises (
        name,
        muscle
      )
    `)
    .eq("user_id", user.id)
    .order("week_number", { ascending: true });

  if (error || !rows?.length) {
    body.innerHTML += `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-title">No exercise logs yet</div>
      </div>
    `;
    return;
  }

  // ═══════════════════════════════
  // ENRICH DATA
  // ═══════════════════════════════
  enriched = rows.map(r => ({
    ...r,
    name: r.exercises?.name || "Unknown",
    muscle: (r.exercises?.muscle || "unknown").toLowerCase()
  }));

  setupMuscleTabs();
  renderAllExercises();
}
// ═══════════════════════════════
// MUSCLE TABS
// ═══════════════════════════════

function setupMuscleTabs() {
  document.querySelectorAll(".muscle-tab").forEach(btn => {
    btn.addEventListener("click", () => {

      document.querySelectorAll(".muscle-tab")
        .forEach(b => b.classList.remove("active"));

      btn.classList.add("active");

      activeMuscle = btn.textContent.toLowerCase();

      renderAllExercises();
    });
  });
}


// ═══════════════════════════════
// RENDER EXERCISES
// ═══════════════════════════════
// ═══════════════════════════════
// MEDIA SYSTEM (SMART MATCH)
// ═══════════════════════════════
const mediaMap = [
  { keywords: ["hip thrust", "thrust"], file: "hipthrust.gif" },
  { keywords: ["lunge"], file: "lunges.mp4" },
  { keywords: ["squat"], file: "squat.mp4" },
  { keywords: ["step"], file: "stepup.mp4" },
  { keywords: ["abduction"], file: "abduction.gif" },
  { keywords: ["bridge"], file: "glutebridge.gif" },
  { keywords: ["kickback"], file: "kickback.jpg" },
  { keywords: ["leg press", "press"], file: "legpress.gif" },
  { keywords: ["rdl", "deadlift"], file: "singlerdl.jpg" }
];

const defaultImg = "/assets/default.jpg";

// ✅ FIXED PATH FOR VITE / MODERN FRONTEND
function getMedia(name) {
  const lower = name.toLowerCase();

  const match = mediaMap.find(item =>
    item.keywords.some(k => lower.includes(k))
  );

  const file = match ? match.file : "default.jpg";

  return new URL(`../assets/${file}`, import.meta.url).href;
}

function isVideo(file) {
  return file.endsWith(".mp4");
}

function renderAllExercises() {
  const body = document.getElementById("all-body");
  body.innerHTML = "";

  const filtered =
    activeMuscle === "all"
      ? enriched
      : enriched.filter(r => r.muscle === activeMuscle);

  const grouped = {};

  filtered.forEach(r => {
    if (!grouped[r.exercise_id]) grouped[r.exercise_id] = [];
    grouped[r.exercise_id].push(r);
  });

  const container = document.createElement("div");
  container.style.padding = "0 1.2rem 1.2rem";

  Object.entries(grouped).forEach(([exId, logs]) => {

    logs.sort((a, b) => a.week_number - b.week_number);

    const bestWeight = Math.max(...logs.map(l => l.weight_used || 0));
    const exName = logs[0]?.name || `Exercise ${exId}`;
    const muscle = logs[0]?.muscle || "unknown";

    const media = getMedia(exName);

    const card = document.createElement("div");
    card.className = "hist-card";

    card.innerHTML = `
      <div class="hist-media">
        ${
          isVideo(media)
            ? `<video
                src="${media}"
                muted
                loop
                playsinline
                preload="metadata"
              ></video>`
            : `<img src="${media}" alt="${exName}" loading="lazy" />`
        }
      </div>

      <div class="hist-head" onclick="toggleHistCard('all-${exId}')">
        <div class="hist-meta">
          <span class="hist-name">${exName}</span>
          <span class="chip chip-muted">${muscle}</span>
          <span class="chip chip-lime">🏆 ${bestWeight}kg</span>
          <span class="chip chip-muted">${logs.length} logs</span>
          
        </div>
      </div>

      <div class="hist-body" id="all-${exId}" style="display:none">
        <div style="overflow-x:auto">
          <table class="hist-table">
            <thead>
              <tr>
                <th>Week</th>
                <th>Sets</th>
                <th>Reps</th>
                <th>Weight</th>
                <th>Done</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(l => `
                <tr>
                  <td>Wk ${l.week_number}</td>
                  <td>${l.sets || "—"}</td>
                  <td>${l.reps || "—"}</td>
                  <td>${l.weight_used || "—"}kg</td>
                  <td>${l.completed ? "✓" : "✗"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // ✅ VIDEO CONTROL FIX
    const video = card.querySelector("video");

    if (video) {
      video.muted = true;
      video.playsInline = true;
      video.loop = true;

      video.play().catch(() => {});

      card.addEventListener("mouseenter", () => video.play());
      card.addEventListener("mouseleave", () => video.pause());
    }

    container.appendChild(card);
  });

  body.appendChild(container);
}
// ═══════════════════════════════════════════════════════
// HISTORY SCREEN
// ═══════════════════════════════════════════════════════
async function initHistory() {
  const body = document.getElementById("hist-body");
  const chipWrap = document.getElementById("hist-chips");

  if (session.goal)  chipWrap.innerHTML += `<span class="chip chip-lime">${session.goal}</span>`;
  if (session.level) chipWrap.innerHTML += `<span class="chip chip-muted">${session.level}</span>`;
  document.getElementById("hist-sub").textContent = `Week ${thisWeek} · ${exercises.length} exercises`;

  if (!exercises.length) {
    body.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📋</div>
      <div class="empty-title">No plan yet</div>
      <div class="empty-sub">Generate a plan first.</div>
    </div>`;
    return;
  }

  body.innerHTML = `<div class="empty-state"><div class="empty-sub">Loading all history…</div></div>`;

  const [ lastLogs, thisLogs] = await Promise.all([
    // fetchAllLogs(),
    fetchLogs(lastWeek),
    fetchLogs(thisWeek)
  ]);

  // Stats
  let improved = 0, declined = 0;
  exercises.forEach(ex => {
    const l = lastLogs[ex.id], t = thisLogs[ex.id];
    if (!l || !t) return;
    const delta = (t.weight_used - l.weight_used) + (t.reps - l.reps);
    if (delta > 0) improved++;
    else if (delta < 0) declined++;
  });
  document.getElementById("st-improved").textContent = improved;
  document.getElementById("st-declined").textContent = declined;
  document.getElementById("st-streak").textContent   = thisWeek;

  const allWeeks = [...new Set(Object.values(allLogsMap).flat().map(r => r.week_number))].sort((a,b)=>a-b);

  // Inline edit state
  const hState = {};
  exercises.forEach(ex => hState[ex.id] = { diff: 0, enjoy: 0, prog: null });

  window.hSetRating = function(id, type, val) {
    hState[id][type] = val;
    const container = document.getElementById(`h-${type}-${id}`);
    const cls = type === "diff" ? "on-diff" : "on-enjoy";
    container?.querySelectorAll(".star-btn").forEach(b => {
      b.classList.toggle(cls, parseInt(b.dataset.v) <= val);
    });
  };

  window.hSetProg = function(id, val) {
    hState[id].prog = val;
    const wrap = document.getElementById("h-prog-" + id);
    wrap?.querySelectorAll(".prog-pill").forEach(b => b.classList.remove("sel-worse","sel-same","sel-better"));
    const selMap = {"-1":"sel-worse","0":"sel-same","1":"sel-better"};
    wrap?.querySelectorAll(".prog-pill")[val + 1]?.classList.add(selMap[val]);
  };

  window.hSaveEx = async function(exId) {
    const s = hState[exId];
    const sets = parseInt(document.getElementById("h-sets-" + exId)?.value) || 3;
    const reps = parseInt(document.getElementById("h-reps-" + exId)?.value) || 10;
    const weight = parseFloat(document.getElementById("h-weight-" + exId)?.value) || 10;

    const { error } = await supabase.from("user_exercise_logs").upsert([{
      user_id: user.id,
      session_id: sessionId,
      exercise_id: exId,
      week_number: thisWeek,
      completed: true,
      sets, reps, weight_used: weight,
      difficulty_rating: s.diff || null,
      enjoyment_rating: s.enjoy || null,
      progress_score: s.prog,
    }], { onConflict: ["user_id","session_id","exercise_id","week_number"] });

    if (error) return toast("❌ " + error.message);

    toast("Saved ✓");
    initHistory(); // refresh
  };

  // Render function (condensed but complete)
 function renderHistory(weekFilter) {
    const container  = document.getElementById("hist-cards-container");
    const totalsBarEl = document.getElementById("hist-totals-bar");
    container.innerHTML  = "";
    totalsBarEl.innerHTML = "";


    // Determine which weeks to show
    const weeksToShow = weekFilter === "All"
      ? allWeeks
      : allWeeks.filter(w => `Wk ${w}` === weekFilter);


    // Aggregate totals for filter
    let totalSets = 0, totalReps = 0, totalSessions = 0;
    const weightPRs = {};


    exercises.forEach(ex => {
      const rows = (allLogsMap[ex.id] || []).filter(r => weeksToShow.includes(r.week_number));
      rows.forEach(r => {
        if (r.completed) {
          totalSets    += r.sets    || 0;
          totalReps    += r.reps    || 0;
          totalSessions++;
          if (!weightPRs[ex.id] || r.weight_used > weightPRs[ex.id]) {
            weightPRs[ex.id] = r.weight_used;
          }
        }
      });
    });


    const maxPR = Object.values(weightPRs).length
      ? Math.max(...Object.values(weightPRs))
      : 0;


    // Totals chips
    [
      [`💪 ${totalSessions} logged sets`, "chip-lime"],
      [`🔁 ${totalSets} total sets`,      "chip-muted"],
      [`🔢 ${totalReps} total reps`,      "chip-muted"],
      [`🏆 ${maxPR}kg top weight`,        "chip-muted"],
    ].forEach(([text, cls]) => {
      if (totalSessions === 0) return;
      const chip = document.createElement("span");
      chip.className = `chip ${cls}`;
      chip.textContent = text;
      totalsBarEl.appendChild(chip);
    });


    const dayNames = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];


    plan.forEach((day, di) => {
      const dayExes = [
        day.compound  ? {...day.compound,  exType:"compound"}  : null,
        day.isolation ? {...day.isolation, exType:"isolation"} : null,
      ].filter(Boolean);
      if (!dayExes.length) return;


      // Check if any exercise in this day has logs in the filtered weeks
      const hasLogs = dayExes.some(ex =>
        (allLogsMap[ex.id] || []).some(r => weeksToShow.includes(r.week_number))
      );
      if (!hasLogs && weekFilter !== "All") return;


      const group = document.createElement("div");
      group.className = "week-group";
      group.innerHTML = `<div class="week-label">Day ${day.day} — ${dayNames[di % 7]}</div>`;


      dayExes.forEach(ex => {
        const allRows = (allLogsMap[ex.id] || [])
          .filter(r => weeksToShow.includes(r.week_number));


        const curr = thisLogs[ex.id];
        const last = lastLogs[ex.id];


        // Current week vals for edit form
        const currSets   = curr?.sets       ?? "—";
        const currReps   = curr?.reps       ?? "—";
        const currWeight = curr?.weight_used != null ? curr.weight_used + "kg" : "—";
        const lastSets   = last?.sets       ?? "—";
        const lastReps   = last?.reps       ?? "—";
        const lastWeight = last?.weight_used != null ? last.weight_used + "kg" : "—";


        const deltas = [
          curr && last ? deltaChip("Sets",   last.sets,       curr.sets)              : "",
          curr && last ? deltaChip("Reps",   last.reps,       curr.reps)              : "",
          curr && last ? deltaChip("Weight", last.weight_used, curr.weight_used, "kg") : "",
        ].filter(Boolean).join("");


        const completedBadge = curr?.completed
          ? `<span class="chip chip-lime">✓ Done</span>`
          : last
            ? `<span class="chip chip-muted">Skipped</span>`
            : `<span class="chip chip-muted">Not logged</span>`;


        // ── Build per-week history rows ───────────────
        let allWeeksRows = "";
        if (allRows.length) {
          allWeeksRows = `
            <div style="margin-top:.8rem">
              <div class="label" style="margin-bottom:.5rem;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--sub)">All logged weeks</div>
              <div style="overflow-x:auto;scrollbar-width:none">
                <table class="hist-table">
                  <thead>
                    <tr>
                      <th>Week</th>
                      <th>Sets</th>
                      <th>Reps</th>
                      <th>Weight</th>
                      <th>Diff</th>
                      <th>Enjoy</th>
                      <th>Progress</th>
                      <th>Done</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${allRows.map((r, ri) => {
                      const prevRow = allRows[ri - 1];
                      const wDelta  = prevRow ? r.weight_used - prevRow.weight_used : null;
                      const rDelta  = prevRow ? r.reps        - prevRow.reps        : null;
                      const wCell   = wDelta !== null && wDelta !== 0
                        ? `<span class="${wDelta > 0 ? "td-up" : "td-dn"}">${r.weight_used ?? "—"}kg ${wDelta > 0 ? "↑" : "↓"}${Math.abs(wDelta)}</span>`
                        : `${r.weight_used ?? "—"}kg`;
                      const rCell   = rDelta !== null && rDelta !== 0
                        ? `<span class="${rDelta > 0 ? "td-up" : "td-dn"}">${r.reps ?? "—"} ${rDelta > 0 ? "↑" : "↓"}${Math.abs(rDelta)}</span>`
                        : `${r.reps ?? "—"}`;
                      const progMap  = {"-1":"↓ Worse", "0":"→ Same", "1":"↑ Better"};
                      const progLabel = r.progress_score != null ? progMap[r.progress_score] : "—";
                      const progCls   = r.progress_score === 1 ? "td-up" : r.progress_score === -1 ? "td-dn" : "";
                      return `
                        <tr class="${r.week_number === thisWeek ? "tr-current" : ""}">
                          <td><span class="wk-badge">Wk ${r.week_number}${r.week_number === thisWeek ? " ●" : ""}</span></td>
                          <td>${r.sets ?? "—"}</td>
                          <td>${rCell}</td>
                          <td>${wCell}</td>
                          <td>${r.difficulty_rating != null ? "🔥".repeat(r.difficulty_rating) : "—"}</td>
                          <td>${r.enjoyment_rating  != null ? "★".repeat(r.enjoyment_rating)  : "—"}</td>
                          <td><span class="${progCls}">${progLabel}</span></td>
                          <td>${r.completed ? "✓" : "✗"}</td>
                        </tr>
                      `;
                    }).join("")}
                  </tbody>
                </table>
              </div>
            </div>
          `;
        } else {
          allWeeksRows = `<div style="margin-top:.6rem;font-size:12px;color:var(--sub)">No logs recorded yet.</div>`;
        }


        // ── Progress sparkline (weight over weeks) ────
        const sparkData = (allLogsMap[ex.id] || [])
          .filter(r => r.completed && r.weight_used != null)
          .sort((a,b) => a.week_number - b.week_number);


        let sparkSVG = "";
        if (sparkData.length >= 2) {
          const vals    = sparkData.map(r => r.weight_used);
          const minV    = Math.min(...vals);
          const maxV    = Math.max(...vals);
          const range   = maxV - minV || 1;
          const W = 120, H = 28, pad = 3;
          const pts = vals.map((v, i) => {
            const x = pad + (i / (vals.length - 1)) * (W - pad * 2);
            const y = H - pad - ((v - minV) / range) * (H - pad * 2);
            return `${x},${y}`;
          }).join(" ");
          sparkSVG = `
            <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;overflow:visible">
              <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round"/>
              ${sparkData.map((v, i) => {
                const x = pad + (i / (vals.length - 1)) * (W - pad * 2);
                const y = H - pad - ((vals[i] - minV) / range) * (H - pad * 2);
                return `<circle cx="${x}" cy="${y}" r="2.5" fill="var(--accent)"/>`;
              }).join("")}
            </svg>
          `;
        }


        const hCard = document.createElement("div");
        hCard.className = "hist-card";
        hCard.innerHTML = `
          <div class="hist-head" onclick="toggleHistCard('hb-${ex.id}')">
            <span class="type-pip pip-${ex.exType}" style="width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0"></span>
            <span class="hist-name">${ex.name}</span>
            <div class="hist-meta">
              ${completedBadge}
              ${sparkSVG ? `<div style="opacity:.7">${sparkSVG}</div>` : ""}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   style="color:var(--muted);transition:transform .2s;flex-shrink:0" id="arr-${ex.id}">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </div>


          <div class="hist-body" id="hb-${ex.id}" style="display:none">


            <!-- Week-by-week table -->
            ${allWeeksRows}


            <!-- Current vs last side-by-side -->
            <div style="margin-top:.8rem;padding-top:.8rem;border-top:1px solid var(--border)">
              <div class="label" style="margin-bottom:.5rem;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--sub)">Last week vs this week</div>
              <div class="compare-row">
                <div class="compare-col">
                  <div class="compare-week-lbl">Week ${lastWeek || "—"}</div>
                  <div class="compare-metric"><span>Sets</span><span>${lastSets}</span></div>
                  <div class="compare-metric"><span>Reps</span><span>${lastReps}</span></div>
                  <div class="compare-metric"><span>Weight</span><span>${lastWeight}</span></div>
                  ${last?.difficulty_rating != null ? `<div class="compare-metric"><span>Difficulty</span><span>${"★".repeat(last.difficulty_rating)}${"☆".repeat(5-last.difficulty_rating)}</span></div>` : ""}
                  ${last?.enjoyment_rating  != null ? `<div class="compare-metric"><span>Enjoyment</span><span>${"★".repeat(last.enjoyment_rating)}${"☆".repeat(5-last.enjoyment_rating)}</span></div>` : ""}
                </div>
                <div class="compare-divider"></div>
                <div class="compare-col">
                  <div class="compare-week-lbl accent">Week ${thisWeek}</div>
                  <div class="compare-metric"><span>Sets</span><span>${currSets}</span></div>
                  <div class="compare-metric"><span>Reps</span><span>${currReps}</span></div>
                  <div class="compare-metric"><span>Weight</span><span>${currWeight}</span></div>
                  ${curr?.difficulty_rating != null ? `<div class="compare-metric"><span>Difficulty</span><span>${"★".repeat(curr.difficulty_rating)}${"☆".repeat(5-curr.difficulty_rating)}</span></div>` : ""}
                  ${curr?.enjoyment_rating  != null ? `<div class="compare-metric"><span>Enjoyment</span><span>${"★".repeat(curr.enjoyment_rating)}${"☆".repeat(5-curr.enjoyment_rating)}</span></div>` : ""}
                </div>
              </div>
              ${deltas ? `<div class="delta-row">${deltas}</div>` : ""}
            </div>


            <!-- Inline update form (this week only) -->
            <div style="margin-top:.8rem;padding-top:.8rem;border-top:1px solid var(--border)">
              <div class="label" style="margin-bottom:.5rem">Update this week's log (Week ${thisWeek})</div>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:.7rem">
                <div style="display:flex;flex-direction:column;gap:4px">
                  <span class="label">Sets</span>
                  <input class="num-input" type="number" id="h-sets-${ex.id}"
                    value="${curr?.sets ?? ex.sets ?? 3}" min="1" max="20"/>
                </div>
                <div style="display:flex;flex-direction:column;gap:4px">
                  <span class="label">Reps</span>
                  <input class="num-input" type="number" id="h-reps-${ex.id}"
                    value="${curr?.reps ?? parseReps(ex.reps)}" min="1" max="100"/>
                </div>
                <div style="display:flex;flex-direction:column;gap:4px">
                  <span class="label">Weight</span>
                  <div class="w-wrap">
                    <input class="num-input" type="number" id="h-weight-${ex.id}"
                      value="${curr?.weight_used ?? parseFloat(ex.startingWeight) ?? 10}" min="1" max="999" step="0.5"/>
                    <span class="w-unit">kg</span>
                  </div>
                </div>
              </div>


              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:.7rem">
                <div>
                  <div class="label" style="margin-bottom:4px">Difficulty</div>
                  <div class="stars-row" id="h-diff-${ex.id}">
                    ${[1,2,3,4,5].map(n =>
                      `<button class="star-btn${curr?.difficulty_rating >= n ? " on-diff":""}"
                        data-v="${n}" onclick="hSetRating('${ex.id}','diff',${n})">🔥</button>`
                    ).join("")}
                  </div>
                </div>
                <div>
                  <div class="label" style="margin-bottom:4px">Enjoyment</div>
                  <div class="stars-row" id="h-enjoy-${ex.id}">
                    ${[1,2,3,4,5].map(n =>
                      `<button class="star-btn${curr?.enjoyment_rating >= n ? " on-enjoy":""}"
                        data-v="${n}" onclick="hSetRating('${ex.id}','enjoy',${n})">★</button>`
                    ).join("")}
                  </div>
                </div>
              </div>


              <div class="label" style="margin-bottom:4px">Progress vs last week</div>
              <div class="prog-row" id="h-prog-${ex.id}">
                <button class="prog-pill${curr?.progress_score===-1?" sel-worse":""}" onclick="hSetProg('${ex.id}',-1)">↓ Worse</button>
                <button class="prog-pill${curr?.progress_score===0?" sel-same":""}"   onclick="hSetProg('${ex.id}',0)">→ Same</button>
                <button class="prog-pill${curr?.progress_score===1?" sel-better":""}" onclick="hSetProg('${ex.id}',1)">↑ Better</button>
              </div>


              <button class="btn-ghost" style="width:100%;margin-top:.7rem" onclick="hSaveEx('${ex.id}')">
                Update log
              </button>
            </div>


          </div>
        `;


        group.appendChild(hCard);
      });


      container.appendChild(group);
    });
  }


  // Initial render — show all weeks
  renderHistory("All");


  // CSS for new table + sparkline elements (injected once)
  if (!document.getElementById("hist-extra-styles")) {
    const style = document.createElement("style");
    style.id = "hist-extra-styles";
    style.textContent = `
      .hist-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
        color: var(--text);
        min-width: 400px;
      }
      .hist-table th {
        text-align: left;
        padding: 4px 8px;
        color: var(--sub);
        font-weight: 600;
        font-size: 10px;
        letter-spacing: .05em;
        text-transform: uppercase;
        border-bottom: 1px solid var(--border2);
        white-space: nowrap;
      }
      .hist-table td {
        padding: 5px 8px;
        border-bottom: 1px solid var(--border);
        white-space: nowrap;
        vertical-align: middle;
      }
      .hist-table tr:last-child td { border-bottom: none; }
      .tr-current td {
        background: color-mix(in srgb, var(--accent) 8%, transparent);
      }
      .wk-badge {
        background: var(--s3);
        border: 1px solid var(--border2);
        border-radius: 10px;
        padding: 1px 7px;
        font-size: 11px;
        white-space: nowrap;
      }
      .td-up { color: var(--lime, #a3e635); font-weight: 600; }
      .td-dn { color: #f87171; font-weight: 600; }
      .week-filter-btn::-webkit-scrollbar { display: none; }
    `;
    document.head.appendChild(style);
  }
}


window.toggleHistCard = function(id) {
  const el  = document.getElementById(id);
  const exId = id.replace("hb-", "");
  const arr  = document.getElementById("arr-" + exId);
  const open = el.style.display === "none" || !el.style.display;
  el.style.display = open ? "block" : "none";
  if (arr) arr.style.transform = open ? "rotate(180deg)" : "";
};


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

window.toggleHistCard = function(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const open = el.style.display === "none" || el.style.display === "";
  el.style.display = open ? "block" : "none";
};

import { supabase } from "../lib/supabaseClient.js";

/* ══════════════════════════════════════
   USER
══════════════════════════════════════ */
const {
  data: { user },
} = await supabase.auth.getUser();

if (!user) window.location.href = "/login";

/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
let logs = [];

/* ══════════════════════════════════════
   SAFE NUMBER PARSER
══════════════════════════════════════ */
function parseNumber(value) {
  if (value == null) return 0;

  return (
    Number(
      String(value).replace(/[^\d.-]/g, "")
    ) || 0
  );
}

/* ══════════════════════════════════════
   FETCH LOGS
══════════════════════════════════════ */
async function fetchLogs() {
  const { data, error } = await supabase
    .from("user_exercise_logs")
    .select(`
      *,
      exercises (
        id,
        name
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Fetch error:", error);
    return;
  }

  logs = data || [];

  console.log("LOGS:", logs);

  renderStats();
  renderCharts();
  renderTable();
}

/* ══════════════════════════════════════
   STATS
══════════════════════════════════════ */
function renderStats() {
  let totalVolume = 0;
  let totalStrength = 0;
  let totalSets = 0;

  logs.forEach((l) => {
    const sets = parseNumber(l.sets);
    const reps = parseNumber(l.reps);
    const weight = parseNumber(l.weight_used);

    totalVolume += sets * reps * weight;
    totalStrength += weight;
    totalSets += sets;
  });

  const avgStrength = logs.length
    ? Math.round(totalStrength / logs.length)
    : 0;

  document.getElementById(
    "total-volume"
  ).textContent =
    `${totalVolume.toLocaleString()} kg`;

  document.getElementById(
    "avg-strength"
  ).textContent =
    `${avgStrength} kg`;

  document.getElementById(
    "total-sessions"
  ).textContent =
    logs.length;

  document.getElementById(
    "duration"
  ).textContent =
    `${totalSets * 2} mins`;
}

/* ══════════════════════════════════════
   RENDER ALL CHARTS
══════════════════════════════════════ */
function renderCharts() {
  renderVolumeChart();
  renderStrengthChart();
  renderSplitChart();
  renderFrequencyChart();
}

/* ══════════════════════════════════════
   WEEKLY VOLUME CHART
══════════════════════════════════════ */
function renderVolumeChart() {
  const grouped = {};

  logs.forEach((l) => {
    const week = l.week_number || 0;

    const volume =
      parseNumber(l.sets) *
      parseNumber(l.reps) *
      parseNumber(l.weight_used);

    grouped[week] =
      (grouped[week] || 0) + volume;
  });

  new Chart(
    document.getElementById("volumeChart"),
    {
      type: "line",

      data: {
        labels: Object.keys(grouped).map(
          (w) => `Week ${w}`
        ),

        datasets: [
          {
            label: "Weekly Volume",

            data: Object.values(grouped),

            borderColor: "#d9ff3f",

            backgroundColor:
              "rgba(217,255,63,0.15)",

            fill: true,
            tension: 0.4,
          },
        ],
      },

      options: {
        responsive: true,

        plugins: {
          legend: {
            labels: {
              color: "white",
            },
          },
        },

        scales: {
          x: {
            ticks: {
              color: "white",
            },
          },

          y: {
            ticks: {
              color: "white",
            },
          },
        },
      },
    }
  );
}

/* ══════════════════════════════════════
   STRENGTH CHART
══════════════════════════════════════ */
function renderStrengthChart() {
  const labels = logs.map(
    (_, i) => `#${i + 1}`
  );

  const values = logs.map((l) =>
    parseNumber(l.weight_used)
  );

  new Chart(
    document.getElementById("strengthChart"),
    {
      type: "bar",

      data: {
        labels,

        datasets: [
          {
            label: "Strength",

            data: values,

            backgroundColor:
              "rgba(255,255,255,0.7)",

            borderRadius: 14,
          },
        ],
      },

      options: {
        responsive: true,

        plugins: {
          legend: {
            labels: {
              color: "white",
            },
          },
        },

        scales: {
          x: {
            ticks: {
              color: "white",
            },
          },

          y: {
            ticks: {
              color: "white",
            },
          },
        },
      },
    }
  );
}

/* ══════════════════════════════════════
   SPLIT ANALYSIS
══════════════════════════════════════ */
function renderSplitChart() {
  const splitMap = {
    Glutes: 0,
    Chest: 0,
    Back: 0,
    Legs: 0,
  };

  logs.forEach((l) => {
    const name = (
      l.exercises?.name || ""
    ).toLowerCase();

    if (
      name.includes("thrust") ||
      name.includes("glute") ||
      name.includes("kickback")
    ) {
      splitMap.Glutes++;
    }

    else if (
      name.includes("bench") ||
      name.includes("chest")
    ) {
      splitMap.Chest++;
    }

    else if (
      name.includes("row") ||
      name.includes("pull") ||
      name.includes("lat")
    ) {
      splitMap.Back++;
    }

    else {
      splitMap.Legs++;
    }
  });

  new Chart(
    document.getElementById("splitChart"),
    {
      type: "doughnut",

      data: {
        labels: Object.keys(splitMap),

        datasets: [
          {
            data: Object.values(splitMap),

            backgroundColor: [
              "#d9ff3f",
              "#ffffff",
              "#888888",
              "#444444",
            ],
          },
        ],
      },

      options: {
        responsive: true,

        plugins: {
          legend: {
            labels: {
              color: "white",
            },
          },
        },
      },
    }
  );
}

/* ══════════════════════════════════════
   EXERCISE FREQUENCY
══════════════════════════════════════ */
function renderFrequencyChart() {
  const freq = {};

  logs.forEach((l) => {
    const name =
      l.exercises?.name || "Unknown";

    freq[name] =
      (freq[name] || 0) + 1;
  });

  new Chart(
    document.getElementById(
      "frequencyChart"
    ),
    {
      type: "polarArea",

      data: {
        labels: Object.keys(freq),

        datasets: [
          {
            data: Object.values(freq),

            backgroundColor: [
              "#d9ff3f",
              "#ffffff",
              "#888888",
              "#666666",
              "#444444",
            ],
          },
        ],
      },

      options: {
        responsive: true,

        plugins: {
          legend: {
            labels: {
              color: "white",
            },
          },
        },
      },
    }
  );
}

/* ══════════════════════════════════════
   EXERCISE TABLE
══════════════════════════════════════ */
function renderTable() {
  const tbody = document.getElementById(
    "exercise-table-body"
  );

  const grouped = {};

  logs.forEach((l) => {
    const name =
      l.exercises?.name || "Unknown";

    if (!grouped[name]) {
      grouped[name] = {
        volume: 0,
        sets: 0,
        best: 0,
      };
    }

    const volume =
      parseNumber(l.sets) *
      parseNumber(l.reps) *
      parseNumber(l.weight_used);

    grouped[name].volume += volume;

    grouped[name].sets +=
      parseNumber(l.sets);

    grouped[name].best = Math.max(
      grouped[name].best,
      parseNumber(l.weight_used)
    );
  });

  tbody.innerHTML = Object.entries(grouped)
    .map(
      ([name, data]) => `
      <tr>
        <td>${name}</td>
        <td>${data.volume.toLocaleString()} kg</td>
        <td>${data.sets}</td>
        <td>${data.best} kg</td>
      </tr>
    `
    )
    .join("");
}

/* ══════════════════════════════════════
   START
══════════════════════════════════════ */
fetchLogs();
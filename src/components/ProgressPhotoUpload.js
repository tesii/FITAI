import { supabase } from "../lib/supabaseClient.js";

/* ---------------- MEDIA PIPE ---------------- */
const pose = new window.Pose({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let latestLandmarks = null;

/* ---------------- LOAD IMAGE ---------------- */
document.getElementById("file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const img = new Image();
  img.src = URL.createObjectURL(file);

  img.onload = async () => {
    canvas.width = img.width;
    canvas.height = img.height;

    ctx.drawImage(img, 0, 0);

    await pose.send({ image: img });
  };
});

/* ---------------- POSE RESULT ---------------- */
pose.onResults((results) => {
  if (!results.poseLandmarks) {
    document.getElementById("result").innerText =
      "No body detected ❌";
    return;
  }

  latestLandmarks = results.poseLandmarks;

  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

  window.drawConnectors(
    ctx,
    results.poseLandmarks,
    window.POSE_CONNECTIONS,
    { color: "#d4ff3f", lineWidth: 2 }
  );

  window.drawLandmarks(
    ctx,
    results.poseLandmarks,
    { color: "#38d39f", lineWidth: 2 }
  );
});

/* ---------------- METRICS ---------------- */
function getMetrics(lm) {
  const shoulder = Math.abs(lm[11].x - lm[12].x);
  const hip = Math.abs(lm[23].x - lm[24].x);

  return {
    shoulderRatio: shoulder,
    hipRatio: hip,
    bodyScore: shoulder / hip
  };
}

/* ---------------- SAVE ---------------- */
window.analyzeImage = async function () {
  const resultBox = document.getElementById("result");

  const fileInput = document.getElementById("file");
  const weight = document.getElementById("weight").value;
  const notes = document.getElementById("notes").value;

  try {
    if (!latestLandmarks) {
      resultBox.innerText = "No analysis yet. Upload image first.";
      return;
    }

    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;

    if (!user) {
      resultBox.innerText = "Login required ❌";
      return;
    }

    const metrics = getMetrics(latestLandmarks);

    /* ---------------- UPLOAD IMAGE ---------------- */
    const file = fileInput.files[0];

    const fileName = `${user.id}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("progress-photos")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("progress-photos")
      .getPublicUrl(fileName);

    const photo_url = data.publicUrl;

    /* ---------------- SAVE TO DB ---------------- */
    const { error } = await supabase
      .from("progress_photos")
      .insert([
        {
          user_id: user.id,
          photo_url,
          shoulder_ratio: metrics.shoulderRatio,
          hip_ratio: metrics.hipRatio,
          body_score: metrics.bodyScore,
          weight: weight ? parseFloat(weight) : null,
          notes: notes || null,
          created_at: new Date()
        }
      ]);

    if (error) {
      console.log(error);
      resultBox.innerText = "Database save failed ❌";
      return;
    }

    resultBox.innerText =
      `Saved ✅\n\nBody Score: ${metrics.bodyScore.toFixed(3)}`;

  } catch (err) {
    console.log(err);
    resultBox.innerText = "Error ❌";
  }
};
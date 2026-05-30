import { supabase } from "../lib/supabaseClient";

// Button
const saveBtn = document.getElementById("saveBtn");

saveBtn.addEventListener("click", async () => {

try {
// ───────────────────────────────────────────────
// 1. Get logged-in user
// ───────────────────────────────────────────────
const { data: { user }, error: userError } = await supabase.auth.getUser();


if (userError || !user) {
  alert("User not logged in");
  return;
}

// ───────────────────────────────────────────────
// 2. Collect form data
// ───────────────────────────────────────────────
const height = document.getElementById("height").value;
const weight = document.getElementById("weight").value;

const goal = document.getElementById("goal").value;

// MULTI-SELECT MUSCLES
const muscleSelect = document.getElementById("muscles");
const selectedMuscles = Array.from(muscleSelect.selectedOptions)
  .map(option => option.value);

// ───────────────────────────────────────────────
// 3. Upload image (if exists)
// ───────────────────────────────────────────────
let imageUrl = null;

const fileInput = document.getElementById("image");
const file = fileInput.files[0];

if (file) {
  const fileName = `${user.id}-${Date.now()}`;

  const { data: uploadData, error: uploadError } = await supabase
    .storage
    .from("profiles") // ⚠️ make sure bucket exists
    .upload(fileName, file);

  if (uploadError) {
    console.error(uploadError);
    alert("Image upload failed");
    return;
  }

  // Get public URL
  const { data: publicUrlData } = supabase
    .storage
    .from("profiles")
    .getPublicUrl(fileName);

  imageUrl = publicUrlData.publicUrl;
}

// ───────────────────────────────────────────────
// 4. Save to user_profiles
// ───────────────────────────────────────────────
const { error: insertError } = await supabase
  .from("user_profiles")
  .upsert([
    {
      user_id: user.id,
      height_cm: height ? parseInt(height) : null,
      weight_kg: weight ? parseInt(weight) : null,
      goal_muscles: selectedMuscles,
      fitness_goal: goal,
      profile_image: imageUrl
    }
  ]);

if (insertError) {
  console.error(insertError);
  alert("Error saving profile");
  return;
}

// ───────────────────────────────────────────────
// 5. Success
// ───────────────────────────────────────────────
alert("Profile saved successfully!");

// Redirect to workout page
window.location.href = "workout.html";


} catch (err) {
console.error(err);
alert("Something went wrong");
}

});

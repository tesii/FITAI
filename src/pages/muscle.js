import { supabase } from "/src/lib/supabaseClient.js";

/* SAVE PROFILE */
document.getElementById('saveBtn').addEventListener('click', async () => {

  const height = document.getElementById('height').value;
  const weight = document.getElementById('weight').value;
  const goal = document.getElementById('goal').value;
  const message = document.getElementById('message');

  const muscleSelect = document.getElementById('muscles');
  const selectedMuscles = Array.from(muscleSelect.selectedOptions).map(o => o.value);

  /* ✅ VALIDATION */
  if (!height || !weight || selectedMuscles.length === 0 || !goal) {
    message.textContent = "Please fill all fields";
    message.style.color = "red";
    return;
  }

  /* ✅ GET LOGGED-IN USER */
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    message.textContent = "User not logged in!";
    message.style.color = "red";
    return;
  }

  /* ✅ PROFILE DATA */
  const profileData = {
    user_id: user.id,
    height: parseFloat(height),
    weight: parseFloat(weight),
    fitness_goal: goal,
    goal_muscles: selectedMuscles
  };

  /* ✅ INSERT INTO DATABASE */
  const { error } = await supabase
    .from('user_profiles')
    .insert([profileData]);

  if (error) {
    console.error(error);
    message.textContent = "Error saving profile";
    message.style.color = "red";
    return;
  }

  /* ✅ STORE DATA LOCALLY (for workout page use) */
  localStorage.setItem("userProfile", JSON.stringify(profileData));

  /* ✅ SUCCESS MESSAGE */
  message.textContent = "Profile saved successfully!";
  message.style.color = "#22c55e";

  /* ✅ REDIRECT AFTER SHORT DELAY */
  setTimeout(() => {
    window.location.href = "workout.html";
  }, 800);

});
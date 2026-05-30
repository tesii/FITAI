const supabase = window.supabase.createClient(
  "https://ojzeaqememaevlxcyabn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qemVhcWVtZW1hZXZseGN5YWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NTQxODIsImV4cCI6MjA4OTMzMDE4Mn0.4Dg17eTLAK0AlHXmrCCvxEIa2RngJIu0kr1v5rX439Y"
);
const form = document.getElementById('signupForm');
const message = document.getElementById('message');

function showMessage(text, type = 'info') {
  message.textContent = text;
  message.className = type;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm_password').value;
  const role = document.getElementById('role').value;

  // 1️⃣ Validate passwords
  if (password !== confirmPassword) {
    showMessage("Passwords do not match!", "error");
    return;
  }

  try {
    showMessage("Creating account...", "info");

    // 2️⃣ Sign up user in Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signUp({
        email,
        password,
      });

    if (authError) {
      console.error(authError);
      showMessage(authError.message, "error");
      return;
    }

    const user = authData.user;

    if (!user) {
      showMessage("Signup failed: no user returned", "error");
      return;
    }

    console.log("Auth user created:", user.id);

    // 3️⃣ Insert profile into users table (IMPORTANT FIX)
    const { error: insertError } = await supabase
      .from('users')
      .insert([
        {
          auth_user_id: user.id,
          name,
          email,
          role
        }
      ]);

    if (insertError) {
      console.error(insertError);
      showMessage("Profile save failed: " + insertError.message, "error");
      return;
    }

    // 4️⃣ SUCCESS
    showMessage("Account created successfully!", "success");

    form.reset();

    setTimeout(() => {
      window.location.href = "login.html";
    }, 1200);

  } catch (err) {
    console.error(err);
    showMessage("Something went wrong", "error");
  }
});

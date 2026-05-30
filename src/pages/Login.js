const supabase = window.supabase.createClient(
  "https://ojzeaqememaevlxcyabn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qemVhcWVtZW1hZXZseGN5YWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NTQxODIsImV4cCI6MjA4OTMzMDE4Mn0.4Dg17eTLAK0AlHXmrCCvxEIa2RngJIu0kr1v5rX439Y"
);
const form = document.getElementById('login-form');
const message = document.getElementById('message');

function showMessage(text, type = 'info') {
  message.textContent = text;
  message.className = type;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    showMessage('Please enter email and password', 'error');
    return;
  }

  try {
    showMessage('Logging in...', 'info');

    // 1️⃣ ALWAYS CLEAR OLD SESSION FIRST (fix refresh token error)
    await supabase.auth.signOut();

    // 2️⃣ LOGIN
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      console.error(authError);
      showMessage(authError.message, 'error');
      return;
    }

    const user = authData.user;

    if (!user) {
      showMessage('Login failed: no user returned', 'error');
      return;
    }

    console.log('Logged in user:', user.id);

    // 3️⃣ FORCE SESSION REFRESH (IMPORTANT FIX FOR YOUR ERROR)
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      showMessage('Session not available', 'error');
      return;
    }

    // 4️⃣ FETCH ROLE FROM USERS TABLE
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error(profileError);
      showMessage('Failed to load user role', 'error');
      return;
    }

    if (!profile) {
      showMessage('User profile not found', 'error');
      return;
    }

    console.log('User role:', profile.role);

    // 5️⃣ SUCCESS
    showMessage('Login successful! Redirecting...', 'success');

    setTimeout(() => {
      if (profile.role === 'coach') {
        window.location.href = '/coach_dashboard.html';
      } else {
        window.location.href = '/user_dashboard.html';
      }
    }, 800);

  } catch (err) {
    console.error(err);
    showMessage('Something went wrong', 'error');
  }
});

import { supabase } from "../lib/supabaseClient.js";

const API_URL = "http://localhost:3000";

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("subscribe-btn");
  if (btn) btn.addEventListener("click", startSubscription);
});


async function startSubscription() {
  const btn = document.getElementById("subscribe-btn");

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerText = "Processing...";
    }

    const res = await fetch(`${API_URL}/api/create-payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user_id: user.id,
        email: user.email,
        plan: "monthly"
      })
    });

    const data = await res.json();

    if (!res.ok || !data.paymentLink) {
      throw new Error(data.message || "Payment failed");
    }

    window.location.href = data.paymentLink;

  } catch (err) {
    console.error(err);
    alert("Subscription error: " + err.message);

  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Subscribe Now";
    }
  }
  
}

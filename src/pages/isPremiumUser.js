import { supabase } from "../lib/supabaseClient.js";

/**
 * Check if user is premium
 */
export async function isPremiumUser() {
  const { data: auth } = await supabase.auth.getUser();

  if (!auth?.user) return false;

  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("status")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    console.error("Premium check error:", error);
    return false;
  }

  return data?.status === "premium";
}

/**
 * Protect page
 */
export async function protectPremiumPage() {
  const premium = await isPremiumUser();

  if (!premium) {
    window.location.href = "/subscribe.html";
  }
}
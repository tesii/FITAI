const API = "http://localhost:3000";

async function verifyPayment() {
  const params = new URLSearchParams(window.location.search);
  const tx_ref = params.get("tx_ref");

  if (!tx_ref) return;

  const res = await fetch(`${API}/api/verify-payment/${tx_ref}`);
  const data = await res.json();

  if (data.success) {
    document.getElementById("status").innerText =
      "Payment Successful 🎉 Premium Activated";
  } else {
    document.getElementById("status").innerText =
      "Payment Failed";
  }
}

verifyPayment();
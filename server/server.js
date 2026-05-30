import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* ───────── SUPABASE ───────── */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/* ───────── TEST ROUTE ───────── */
app.get("/", (req, res) => {
  res.send("FitAI Payment Server Running 🚀");
});

/* ───────── CREATE PAYMENT ───────── */
app.post("/api/create-payment", async (req, res) => {
  try {
    const { user_id, email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const tx_ref = `fitai-${Date.now()}`;

    const payload = {
      tx_ref,
      amount: 9,
      currency: "USD",
      redirect_url: `http://localhost:5173/payment-success.html?tx_ref=${tx_ref}`,
      customer: {
        email
      },
      meta: {
        user_id
      },
      customizations: {
        title: "FitAI Premium",
        description: "Monthly Subscription"
      }
    };

    /* ───── FLUTTERWAVE INIT ───── */
    const response = await axios.post(
      "https://api.flutterwave.com/v3/payments/initialize",
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("FLW RESPONSE:", response.data);

    const link = response.data?.data?.link;

    if (!link) {
      return res.status(500).json({
        success: false,
        message: "Payment link not generated",
        debug: response.data
      });
    }

    return res.json({
      success: true,
      paymentLink: link,
      tx_ref
    });

  } catch (err) {
    console.log("CREATE PAYMENT ERROR:", err.response?.data || err.message);

    return res.status(500).json({
      success: false,
      message: "Payment creation failed"
    });
  }
});

/* ───────── VERIFY PAYMENT ───────── */
app.get("/api/verify-payment/:tx_ref", async (req, res) => {
  try {
    const { tx_ref } = req.params;

    const response = await axios.get(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${tx_ref}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`
        }
      }
    );

    const data = response.data.data;

    if (data.status === "successful") {
      const user_id = data.meta?.user_id;

      await supabase.from("user_subscriptions").upsert({
        user_id,
        status: "premium",
        plan: "monthly",
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      return res.json({
        success: true,
        message: "Payment verified"
      });
    }

    return res.json({
      success: false,
      message: "Payment not successful"
    });

  } catch (err) {
    console.log("VERIFY ERROR:", err.message);

    return res.status(500).json({
      success: false,
      message: "Verification failed"
    });
  }
});

/* ───────── START SERVER ───────── */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
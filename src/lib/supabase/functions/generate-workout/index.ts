import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface ReqPayload {
  goal: string;
  weight: number;
  height: number;
  experience?: string;
}

console.info("Workout AI function started");

Deno.serve(async (req: Request) => {
  try {
    const { goal, weight, height, experience }: ReqPayload = await req.json();

    // 🔐 Correct Supabase secret
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing GEMINI_API_KEY" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 🧠 Prompt
    const prompt = `
You are a professional fitness coach.

Create a weekly workout plan:

Goal: ${goal}
Weight: ${weight} kg
Height: ${height} cm
Experience: ${experience || "beginner"}

Rules:
- 4 to 6 training days
- Include rest days
- Each workout must include exercises with sets and reps
- Focus on the goal muscles

Return ONLY valid JSON in this format:

{
  "goal": "${goal}",
  "plan": [
    {
      "day": "Monday",
      "focus": "Lower Body",
      "exercises": [
        {
          "name": "Squats",
          "sets": 4,
          "reps": 12
        }
      ]
    }
  ]
}
`;

    // 🔥 SAFE MODEL (most compatible across all accounts)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    const result = await response.json();

    console.log("FULL GEMINI RESPONSE:", JSON.stringify(result, null, 2));

    // 🧾 Extract text safely
    const aiText =
      result?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!aiText) {
      return new Response(
        JSON.stringify({
          error: "Empty response from Gemini",
          raw: result,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 🔄 Parse JSON safely
    let parsed;
    try {
      parsed = JSON.parse(aiText);
    } catch {
      parsed = {
        error: "AI returned non-JSON output",
        raw: aiText,
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error.message || "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
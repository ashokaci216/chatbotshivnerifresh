// api/chat.js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  try {
    // Handle GET requests (for testing)
    if (req.method === "GET") {
      return res.status(200).json({ message: "Chat API ready ✅" });
    }

    // Handle POST requests
    const { message } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: "Missing message field" });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are Shivneri Fresh grocery assistant." },
        { role: "user", content: message },
      ],
    });

    const reply = completion.choices?.[0]?.message?.content || "No response.";
    res.status(200).json({ reply });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details: error.message,
    });
  }
}

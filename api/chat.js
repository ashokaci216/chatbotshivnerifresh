// api/chat.js
import OpenAI from "openai";

// ✅ Ensure correct runtime (Node.js recommended for OpenAI SDK)
export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  try {
    // ✅ Handle only POST requests
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    // ✅ Extract message safely
    const { message } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Invalid message format" });
    }

    // ✅ Initialize OpenAI with secret key from Vercel Environment Variable
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // ✅ Send message to OpenAI model
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are Shivneri Fresh grocery assistant. Be helpful, polite, and reply in short clear Hinglish.",
        },
        { role: "user", content: message },
      ],
    });

    // ✅ Send back response to frontend
    res.status(200).json({
      reply: completion.choices[0].message.content,
    });
  } catch (err) {
    console.error("❌ Server Error:", err);
    res.status(500).json({
      error: "Server Error: " + err.message,
    });
  }
}

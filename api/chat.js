// api/chat.js
import OpenAI from "openai";

export default async function handler(req, res) {
  try {
    const { message } = req.body;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are Shivneri Fresh grocery assistant." },
        { role: "user", content: message },
      ],
    });

    res.status(200).json({ reply: completion.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

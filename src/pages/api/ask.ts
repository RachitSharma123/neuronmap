import type { APIRoute } from "astro";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const { termName, definition, question, history } = await request.json();
    if (!termName || !question) return new Response("Missing fields", { status: 400 });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `You are a sharp AI/ML expert on aigraph.site — a knowledge graph about artificial intelligence. The user is reading about "${termName}" (${definition}).

Answer ONLY questions about AI, ML, data science, software engineering, or technology. If asked anything off-topic (weather, cooking, personal life, etc.), reply exactly: "I only answer AI & tech questions here! Ask me something about ${termName} or related AI concepts."

Keep answers concise: 3–5 sentences, plain language, no markdown headers. Be direct and insightful.`,
      },
    ];

    // Inject conversation history
    for (const turn of (history || [])) {
      messages.push({ role: "user", content: turn.q });
      messages.push({ role: "assistant", content: turn.a });
    }

    messages.push({ role: "user", content: question });

    const response = await client.chat.completions.create({
      model: "deepseek-chat",
      max_tokens: 300,
      messages,
    });

    const answer = response.choices[0]?.message?.content ?? "Could not generate a response.";
    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

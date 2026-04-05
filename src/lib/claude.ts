import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type NewTerm = {
  name: string;
  full_name: string;
  category: string;
  definition: string;
  connections: string[];
};

const CATEGORIES = [
  "Core ML",
  "LLM",
  "Infra",
  "Tools",
  "Ethics",
  "Applications",
  "Emerging",
  "Data",
  "Dev Tools",
  "APIs & Platforms",
];

export async function fetchNewTerm(existingNames: string[]): Promise<NewTerm | null> {
  const existingList = existingNames.join(", ");

  const prompt = `You are tracking the AI/ML ecosystem in real-time.

Give me exactly 1 genuinely new, recently launched, or currently trending AI term, tool, model, framework, or concept that is NOT in this list:
${existingList}

Return ONLY valid JSON with no explanation, no markdown, no extra text:
{
  "name": "short identifier (max 30 chars)",
  "full_name": "expanded full name",
  "category": "one of: ${CATEGORIES.join(", ")}",
  "definition": "2 sentences max, clear and precise",
  "connections": ["3 to 5 term names from the existing list above that this concept relates to"]
}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as NewTerm;
    if (!parsed.name || !parsed.category || !parsed.definition) return null;

    return parsed;
  } catch {
    return null;
  }
}

export async function fetchELI5(termName: string, definition: string): Promise<string> {
  const prompt = `Explain "${termName}" (${definition}) to a curious 8-year-old child using a simple real-world analogy. Max 3 sentences. No jargon.`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "Could not generate explanation.";
}

import type { APIRoute } from "astro";
import { fetchELI5 } from "../../lib/claude";

export const POST: APIRoute = async ({ request }) => {
  try {
    const { termName, definition } = await request.json();
    if (!termName || !definition) {
      return new Response("Missing fields", { status: 400 });
    }

    const explanation = await fetchELI5(termName, definition);
    return new Response(JSON.stringify({ explanation }), {
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

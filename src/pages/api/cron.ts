import type { APIRoute } from "astro";
import { getSupabaseAdmin } from "../../lib/supabase";
import { fetchNewTerm } from "../../lib/claude";

export const GET: APIRoute = async ({ request }) => {
  // Verify cron secret to prevent unauthorized calls
  const secret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV === "production") {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  try {
    // Fetch all existing term names
    const { data: existingTerms, error: fetchError } = await supabase
      .from("terms")
      .select("id, name");

    if (fetchError) throw fetchError;

    const nameToId = new Map((existingTerms || []).map((t) => [t.name.toLowerCase(), t.id]));
    const existingNames = Array.from(nameToId.keys());

    // Call Claude to get one new trending term
    const newTerm = await fetchNewTerm(existingNames.map((n) =>
      existingTerms!.find((t) => t.name.toLowerCase() === n)?.name || n
    ));

    if (!newTerm) {
      return new Response(JSON.stringify({ ok: false, reason: "Claude returned no term" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check for duplicate
    if (nameToId.has(newTerm.name.toLowerCase())) {
      return new Response(JSON.stringify({ ok: false, reason: "Duplicate term", term: newTerm.name }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Insert new term
    const { data: inserted, error: insertError } = await supabase
      .from("terms")
      .insert({
        name: newTerm.name,
        full_name: newTerm.full_name,
        category: newTerm.category,
        definition: newTerm.definition,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    const newId = inserted.id;

    // Resolve connections to IDs and insert
    const connectionRows: { from_id: string; to_id: string; weight: number }[] = [];

    for (const connName of newTerm.connections) {
      const connId = nameToId.get(connName.toLowerCase());
      if (connId && connId !== newId) {
        connectionRows.push({ from_id: newId, to_id: connId, weight: 1 });
      }
    }

    if (connectionRows.length > 0) {
      await supabase.from("connections").insert(connectionRows);
    }

    return new Response(
      JSON.stringify({ ok: true, term: newTerm.name, connections: connectionRows.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

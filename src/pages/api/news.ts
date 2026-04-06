import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  try {
    const url = "https://hn.algolia.com/api/v1/search_by_date?query=AI+OR+machine+learning+OR+LLM+OR+artificial+intelligence&tags=story&hitsPerPage=50";
    const res = await fetch(url);
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "HN fetch failed", status: res.status }), { status: 200 });
    }
    const data = await res.json();
    
    const stories = (data.hits || [])
      .filter((h: any) => h.title && (h.url || h.story_url) && h.points > 1)
      .slice(0, 20)
      .map((h: any) => ({ title: h.title, url: h.url || h.story_url, points: h.points, author: h.author }));

    return new Response(JSON.stringify({ stories, debug: { totalHits: data.nbHits || 0, hits: data.hits?.slice(0,3) } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ stories: [], error: String(err), stack: err instanceof Error ? err.stack : null }), { status: 200 });
  }
};

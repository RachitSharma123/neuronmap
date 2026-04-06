import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  try {
    const url = "https://hn.algolia.com/api/v1/search?query=AI+machine+learning+LLM&tags=story&hitsPerPage=30";
    const res = await fetch(url);
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "HN fetch failed", status: res.status }), { status: 200 });
    }
    const data = await res.json();
    
    const stories = (data.hits || [])
      .filter((h: any) => h.title && h.url && h.points > 1)
      .slice(0, 20)
      .map((h: any) => ({ title: h.title, url: h.url, points: h.points, author: h.author }));

    return new Response(JSON.stringify({ stories }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "s-maxage=300" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ stories: [], error: String(err) }), { status: 200 });
  }
};

import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  try {
    // HackerNews Algolia — top AI/ML stories
    const url = "https://hn.algolia.com/api/v1/search?query=AI+machine+learning+LLM+artificial+intelligence&tags=story&hitsPerPage=30&sortBy=points";

    const res = await fetch(url);
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
    console.error("News fetch error:", err);
    return new Response(JSON.stringify({ stories: [], error: String(err) }), { status: 200 });
  }
};

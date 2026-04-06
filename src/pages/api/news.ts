import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  console.log("NEWS API HIT");
  try {
    const url = "https://hn.algolia.com/api/v1/search?query=AI+machine+learning+LLM+artificial+intelligence&tags=story&hitsPerPage=30&sortBy=points";
    console.log("Fetching:", url);
    const res = await fetch(url);
    const data = await res.json();
    console.log("HN response:", JSON.stringify(data).slice(0, 500));
    const hits = data.hits || [];
    console.log("Hits count:", hits.length);

    const stories = hits
      .filter((h: any) => h.title && h.url && h.points > 1)
      .slice(0, 20)
      .map((h: any) => ({ title: h.title, url: h.url, points: h.points, author: h.author }));

    console.log("Stories filtered:", stories.length);
    return new Response(JSON.stringify({ stories }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "s-maxage=300" },
    });
  } catch (err) {
    console.error("News fetch error:", err);
    return new Response(JSON.stringify({ stories: [], error: String(err) }), { status: 200 });
  }
};

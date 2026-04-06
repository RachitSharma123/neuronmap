import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { createClient } from "@supabase/supabase-js";
import type { Term, Connection } from "../lib/supabase";
import NodePanel from "./NodePanel";

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ─── Category colors (Obsidian-inspired) ────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  "Core ML": "#a78bfa",       // purple
  "LLM": "#2dd4bf",           // teal
  "Infra": "#60a5fa",         // blue
  "Tools": "#fbbf24",         // amber
  "Ethics": "#f87171",        // coral/red
  "Applications": "#34d399",  // green
  "Emerging": "#f472b6",      // pink
  "Data": "#94a3b8",          // slate
  "Dev Tools": "#38bdf8",     // sky blue
  "APIs & Platforms": "#4ade80", // lime green
};

const getColor = (cat: string) => CATEGORY_COLORS[cat] ?? "#94a3b8";

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  full_name: string;
  category: string;
  definition: string;
  created_at: string;
  connectionCount: number;
  isNew?: boolean;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  weight: number;
}

export default function MindMap() {
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);

  const [selectedTerm, setSelectedTerm] = useState<Term | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; term: GraphNode } | null>(null);
  const [termCount, setTermCount] = useState(0);
  const [newFlash, setNewFlash] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ─── Build initial graph data ─────────────────────────────────────────────
  const buildGraph = useCallback((terms: Term[], connections: Connection[]) => {
    const connCount = new Map<string, number>();
    connections.forEach((c) => {
      connCount.set(c.from_id, (connCount.get(c.from_id) ?? 0) + 1);
      connCount.set(c.to_id, (connCount.get(c.to_id) ?? 0) + 1);
    });

    const nodes: GraphNode[] = terms.map((t) => ({
      id: t.id,
      name: t.name,
      full_name: t.full_name,
      category: t.category,
      definition: t.definition,
      created_at: t.created_at,
      connectionCount: connCount.get(t.id) ?? 0,
    }));

    const idSet = new Set(nodes.map((n) => n.id));
    const links: GraphLink[] = connections
      .filter((c) => idSet.has(c.from_id) && idSet.has(c.to_id))
      .map((c) => ({ source: c.from_id, target: c.to_id, weight: c.weight }));

    return { nodes, links };
  }, []);

  // ─── D3 Render ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function fetchAndRender() {
      try {
        const [{ data: terms, error: e1 }, { data: connections, error: e2 }] = await Promise.all([
          supabase.from("terms").select("id, name, full_name, category, definition, created_at").order("created_at"),
          supabase.from("connections").select("from_id, to_id, weight"),
        ]);

        if (e1 || e2) throw new Error((e1 || e2)?.message);
        if (cancelled) return;

        setTermCount(terms?.length ?? 0);
        setLoading(false);
        renderGraph(terms ?? [], connections ?? []);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load");
        setLoading(false);
      }
    }

    fetchAndRender();
    return () => { cancelled = true; };
  }, []);

  function renderGraph(initialTerms: Term[], initialConnections: Connection[]) {
    if (!svgRef.current) return;

    const { nodes, links } = buildGraph(initialTerms, initialConnections);
    nodesRef.current = nodes;
    linksRef.current = links;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Clear previous render
    svg.selectAll("*").remove();

    // Background click to deselect
    svg.on("click", () => {
      setSelectedTerm(null);
      setTooltip(null);
      resetHighlight();
    });

    // Zoom + pan
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.6));

    const g = svg.append("g");
    gRef.current = g;

    // Glow filter
    const defs = svg.append("defs");
    const filter = defs.append("filter").attr("id", "glow");
    filter.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // New-node glow (stronger)
    const filterNew = defs.append("filter").attr("id", "glow-new");
    filterNew.append("feGaussianBlur").attr("stdDeviation", "8").attr("result", "coloredBlur");
    const feMergeNew = filterNew.append("feMerge");
    feMergeNew.append("feMergeNode").attr("in", "coloredBlur");
    feMergeNew.append("feMergeNode").attr("in", "SourceGraphic");

    // Force simulation
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links)
        .id((d) => d.id)
        .distance((d) => {
          const src = d.source as GraphNode;
          const tgt = d.target as GraphNode;
          const bigNode = Math.max(src.connectionCount, tgt.connectionCount);
          return 80 + bigNode * 8;
        })
        .strength(0.3)
      )
      .force("charge", d3.forceManyBody().strength(-180))
      .force("center", d3.forceCenter(0, 0))
      .force("collision", d3.forceCollide<GraphNode>().radius((d) => nodeRadius(d) + 8));

    simRef.current = simulation;

    // ─── Links ──────────────────────────────────────────────────────────────
    const linkGroup = g.append("g").attr("class", "links");
    const link = linkGroup.selectAll<SVGLineElement, GraphLink>("line")
      .data(links)
      .join("line")
      .attr("class", "edge")
      .attr("stroke", "#1e2030")
      .attr("stroke-width", (d) => 0.5 + (d.weight ?? 1) * 0.3)
      .attr("stroke-opacity", 0.6);

    // ─── Nodes ──────────────────────────────────────────────────────────────
    const nodeGroup = g.append("g").attr("class", "nodes");
    const node = nodeGroup.selectAll<SVGGElement, GraphNode>("g")
      .data(nodes, (d) => d.id)
      .join("g")
      .attr("class", "node-group")
      .attr("cursor", "pointer")
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
      );

    // Outer glow ring
    node.append("circle")
      .attr("r", (d) => nodeRadius(d) + 4)
      .attr("fill", "none")
      .attr("stroke", (d) => getColor(d.category))
      .attr("stroke-opacity", 0.15)
      .attr("stroke-width", 6);

    // Main node circle
    node.append("circle")
      .attr("class", "node-circle")
      .attr("r", (d) => nodeRadius(d))
      .attr("fill", (d) => getColor(d.category))
      .attr("fill-opacity", 0.9)
      .attr("filter", "url(#glow)");

    // Labels (only for hub nodes with many connections)
    node.filter((d) => d.connectionCount >= 3)
      .append("text")
      .attr("class", "node-label")
      .attr("dy", (d) => nodeRadius(d) + 12)
      .attr("text-anchor", "middle")
      .attr("fill", "#c8ccd4")
      .attr("font-size", (d) => Math.max(9, Math.min(13, 8 + d.connectionCount * 0.4)))
      .attr("font-family", "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif")
      .attr("pointer-events", "none")
      .text((d) => d.name);

    // ─── Hover events ───────────────────────────────────────────────────────
    node
      .on("mouseenter", function (event, d) {
        event.stopPropagation();
        highlightNode(d, link, node);

        // SVG coords → screen coords
        const svgEl = svgRef.current!;
        const pt = svgEl.createSVGPoint();
        pt.x = event.clientX;
        pt.y = event.clientY;

        setTooltip({ x: event.clientX, y: event.clientY, term: d });
      })
      .on("mousemove", (event) => {
        setTooltip((prev) => prev ? { ...prev, x: event.clientX, y: event.clientY } : null);
      })
      .on("mouseleave", function (event) {
        resetHighlight(link, node);
        setTooltip(null);
      })
      .on("click", function (event, d) {
        event.stopPropagation();
        setSelectedTerm({
          id: d.id,
          name: d.name,
          full_name: d.full_name,
          category: d.category,
          definition: d.definition,
          created_at: d.created_at,
        });
        setTooltip(null);
      });

    // ─── Simulation tick ────────────────────────────────────────────────────
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode).y ?? 0);

      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // ─── Resize ─────────────────────────────────────────────────────────────
    const handleResize = () => {
      svg.attr("width", window.innerWidth).attr("height", window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      simulation.stop();
      window.removeEventListener("resize", handleResize);
    };
  }

  // ─── Supabase Realtime subscription ────────────────────────────────────────
  useEffect(() => {

    const channel = supabase
      .channel("terms-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "terms" }, async (payload) => {
        const newTerm = payload.new as Term;

        // Fetch its connections
        const { data: newConns } = await supabase
          .from("connections")
          .select("from_id, to_id, weight")
          .or(`from_id.eq.${newTerm.id},to_id.eq.${newTerm.id}`);

        addNewNode(newTerm, newConns ?? []);
        setTermCount((c) => c + 1);
        setNewFlash(newTerm.name);
        setTimeout(() => setNewFlash(null), 4000);
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, []);

  // ─── Add node to live simulation ─────────────────────────────────────────
  const addNewNode = useCallback((term: Term, newConns: Connection[]) => {
    if (!simRef.current || !gRef.current) return;

    const simulation = simRef.current;
    const g = gRef.current;

    // Calculate connection count
    const connCount = newConns.length;
    const newNode: GraphNode = {
      id: term.id,
      name: term.name,
      full_name: term.full_name,
      category: term.category,
      definition: term.definition,
      created_at: term.created_at,
      connectionCount: connCount,
      isNew: true,
      // Start at edge of viewport
      x: (Math.random() - 0.5) * 2000,
      y: (Math.random() - 0.5) * 2000,
    };

    nodesRef.current = [...nodesRef.current, newNode];

    // Add new links
    const idSet = new Set(nodesRef.current.map((n) => n.id));
    const addedLinks: GraphLink[] = newConns
      .filter((c) => idSet.has(c.from_id) && idSet.has(c.to_id))
      .map((c) => ({ source: c.from_id, target: c.to_id, weight: c.weight }));

    linksRef.current = [...linksRef.current, ...addedLinks];

    // Update simulation
    simulation.nodes(nodesRef.current);
    (simulation.force("link") as d3.ForceLink<GraphNode, GraphLink>).links(linksRef.current);

    // Re-render links
    const linkGroup = g.select<SVGGElement>(".links");
    linkGroup.selectAll<SVGLineElement, GraphLink>("line")
      .data(linksRef.current)
      .join("line")
      .attr("class", "edge")
      .attr("stroke", "#1e2030")
      .attr("stroke-width", (d) => 0.5 + (d.weight ?? 1) * 0.3)
      .attr("stroke-opacity", 0.6);

    // Add new node to DOM with flash animation
    const nodeGroup = g.select<SVGGElement>(".nodes");
    const newG = nodeGroup.append("g")
      .attr("class", "node-group")
      .attr("cursor", "pointer")
      .datum(newNode)
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
      );

    newG.append("circle")
      .attr("r", nodeRadius(newNode) + 4)
      .attr("fill", "none")
      .attr("stroke", getColor(newNode.category))
      .attr("stroke-opacity", 0.15)
      .attr("stroke-width", 6);

    // New-node gets extra bright glow
    newG.append("circle")
      .attr("class", "node-circle")
      .attr("r", nodeRadius(newNode))
      .attr("fill", getColor(newNode.category))
      .attr("fill-opacity", 1)
      .attr("filter", "url(#glow-new)")
      .transition().duration(3000)
      .attr("filter", "url(#glow)");

    if (newNode.connectionCount >= 3) {
      newG.append("text")
        .attr("class", "node-label")
        .attr("dy", nodeRadius(newNode) + 12)
        .attr("text-anchor", "middle")
        .attr("fill", "#c8ccd4")
        .attr("font-size", 10)
        .attr("font-family", "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif")
        .attr("pointer-events", "none")
        .text(newNode.name);
    }

    newG
      .on("mouseenter", function (event, d) {
        const allLinks = g.selectAll<SVGLineElement, GraphLink>(".edge");
        const allNodes = g.selectAll<SVGGElement, GraphNode>(".node-group");
        highlightNode(d, allLinks, allNodes);
        setTooltip({ x: event.clientX, y: event.clientY, term: d });
      })
      .on("mousemove", (event) => {
        setTooltip((prev) => prev ? { ...prev, x: event.clientX, y: event.clientY } : null);
      })
      .on("mouseleave", function () {
        const allLinks = g.selectAll<SVGLineElement, GraphLink>(".edge");
        const allNodes = g.selectAll<SVGGElement, GraphNode>(".node-group");
        resetHighlight(allLinks, allNodes);
        setTooltip(null);
      })
      .on("click", function (event, d) {
        event.stopPropagation();
        setSelectedTerm({ id: d.id, name: d.name, full_name: d.full_name, category: d.category, definition: d.definition, created_at: d.created_at });
        setTooltip(null);
      });

    simulation.alpha(0.5).restart();

    simulation.on("tick", () => {
      g.selectAll<SVGLineElement, GraphLink>(".edge")
        .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode).y ?? 0);

      g.selectAll<SVGGElement, GraphNode>(".node-group")
        .attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });
  }, []);

  // ─── Search highlight ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!gRef.current) return;
    const g = gRef.current;
    const q = searchQuery.toLowerCase();

    if (!q && !activeCategory) {
      g.selectAll<SVGGElement, GraphNode>(".node-group")
        .attr("opacity", 1);
      g.selectAll<SVGLineElement, GraphLink>(".edge")
        .attr("opacity", 0.6);
      return;
    }

    g.selectAll<SVGGElement, GraphNode>(".node-group")
      .attr("opacity", (d) => {
        const matchSearch = !q || d.name.toLowerCase().includes(q) || d.full_name.toLowerCase().includes(q);
        const matchCat = !activeCategory || d.category === activeCategory;
        return matchSearch && matchCat ? 1 : 0.06;
      });
  }, [searchQuery, activeCategory]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function nodeRadius(d: GraphNode) {
    return Math.max(4, Math.min(18, 4 + Math.sqrt(d.connectionCount) * 2.5));
  }

  function highlightNode(
    d: GraphNode,
    link: d3.Selection<SVGLineElement, GraphLink, SVGGElement, unknown>,
    node: d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown>
  ) {
    const connectedIds = new Set<string>();
    connectedIds.add(d.id);

    link.each(function (l) {
      const src = typeof l.source === "string" ? l.source : (l.source as GraphNode).id;
      const tgt = typeof l.target === "string" ? l.target : (l.target as GraphNode).id;
      if (src === d.id || tgt === d.id) {
        connectedIds.add(src);
        connectedIds.add(tgt);
      }
    });

    node.attr("opacity", (n) => connectedIds.has(n.id) ? 1 : 0.05);
    link
      .attr("stroke", (l) => {
        const src = typeof l.source === "string" ? l.source : (l.source as GraphNode).id;
        const tgt = typeof l.target === "string" ? l.target : (l.target as GraphNode).id;
        return (src === d.id || tgt === d.id) ? getColor(d.category) : "#1e2030";
      })
      .attr("stroke-opacity", (l) => {
        const src = typeof l.source === "string" ? l.source : (l.source as GraphNode).id;
        const tgt = typeof l.target === "string" ? l.target : (l.target as GraphNode).id;
        return (src === d.id || tgt === d.id) ? 0.9 : 0.15;
      });
  }

  function resetHighlight(
    link?: d3.Selection<SVGLineElement, GraphLink, SVGGElement, unknown>,
    node?: d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown>
  ) {
    if (!gRef.current) return;
    const g = gRef.current;
    (node ?? g.selectAll<SVGGElement, GraphNode>(".node-group")).attr("opacity", 1);
    (link ?? g.selectAll<SVGLineElement, GraphLink>(".edge"))
      .attr("stroke", "#1e2030")
      .attr("stroke-opacity", 0.6);
  }

  const categories = Object.keys(CATEGORY_COLORS);

  if (loadError) return (
    <div style={{ width: "100vw", height: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171", fontFamily: "sans-serif", fontSize: 14 }}>
      Failed to load: {loadError}
    </div>
  );

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", background: "#0a0a0f", overflow: "hidden" }}>

      {/* ── Loading overlay ── */}
      {loading && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", zIndex: 200, background: "#0a0a0f",
        }}>
          <div style={{ fontSize: 28, marginBottom: 16, animation: "spin 2s linear infinite", display: "inline-block" }}>⬡</div>
          <div style={{ color: "#a78bfa", fontSize: 16, fontWeight: 600 }}>NeuronMap</div>
          <div style={{ color: "#475569", fontSize: 12, marginTop: 6 }}>Loading knowledge graph...</div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      {/* ── SVG Graph ── */}
      <svg ref={svgRef} style={{ width: "100%", height: "100%", display: "block" }} />

      {/* ── Top Bar ── */}
      <div style={{
        position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
        display: "flex", alignItems: "center", gap: 12, zIndex: 10,
        background: "rgba(10,10,20,0.85)", backdropFilter: "blur(12px)",
        border: "1px solid #1e2030", borderRadius: 12, padding: "8px 16px",
        boxShadow: "0 4px 32px rgba(0,0,0,0.5)",
      }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", letterSpacing: "-0.3px" }}>
          ⬡ NeuronMap
        </span>
        <div style={{ width: 1, height: 18, background: "#1e2030" }} />
        <input
          type="text"
          placeholder="Search terms..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            background: "transparent", border: "none", outline: "none",
            color: "#c8ccd4", fontSize: 13, width: 180,
            caretColor: "#a78bfa",
          }}
        />
        <div style={{ width: 1, height: 18, background: "#1e2030" }} />
        <span style={{ fontSize: 12, color: "#64748b" }}>
          {termCount} terms
        </span>
      </div>

      {/* ── Category Legend / Filter ── */}
      <div style={{
        position: "absolute", bottom: 24, left: 24, zIndex: 10,
        display: "flex", flexDirection: "column", gap: 4,
      }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory((prev) => prev === cat ? null : cat)}
            style={{
              display: "flex", alignItems: "center", gap: 7, background: "none",
              border: "none", cursor: "pointer", padding: "2px 0",
              opacity: activeCategory && activeCategory !== cat ? 0.3 : 1,
              transition: "opacity 0.2s",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: CATEGORY_COLORS[cat], flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "-apple-system, sans-serif" }}>{cat}</span>
          </button>
        ))}
      </div>

      {/* ── Hover Tooltip ── */}
      {tooltip && (
        <div style={{
          position: "fixed",
          left: Math.min(tooltip.x + 16, window.innerWidth - 280),
          top: Math.min(tooltip.y - 10, window.innerHeight - 100),
          background: "rgba(13,14,25,0.97)",
          border: `1px solid ${getColor(tooltip.term.category)}44`,
          borderLeft: `3px solid ${getColor(tooltip.term.category)}`,
          borderRadius: 8, padding: "10px 14px",
          maxWidth: 260, zIndex: 100, pointerEvents: "none",
          boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 20px ${getColor(tooltip.term.category)}18`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{
              fontSize: 10, fontWeight: 600, color: getColor(tooltip.term.category),
              background: `${getColor(tooltip.term.category)}18`, borderRadius: 4,
              padding: "2px 6px", textTransform: "uppercase", letterSpacing: "0.5px",
            }}>
              {tooltip.term.category}
            </span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>
            {tooltip.term.name}
          </div>
          {tooltip.term.full_name !== tooltip.term.name && (
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6 }}>{tooltip.term.full_name}</div>
          )}
          <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>{tooltip.term.definition}</div>
          <div style={{ fontSize: 10, color: "#475569", marginTop: 6 }}>
            {tooltip.term.connectionCount} connection{tooltip.term.connectionCount !== 1 ? "s" : ""} · click to explore
          </div>
        </div>
      )}

      {/* ── New Term Flash ── */}
      {newFlash && (
        <div style={{
          position: "absolute", top: 70, left: "50%", transform: "translateX(-50%)",
          background: "rgba(167,139,250,0.12)", border: "1px solid #a78bfa44",
          borderRadius: 8, padding: "8px 16px", zIndex: 20,
          color: "#a78bfa", fontSize: 12, fontWeight: 500,
          animation: "fadeInOut 4s ease forwards",
        }}>
          ✦ New term added: <strong>{newFlash}</strong>
        </div>
      )}

      {/* ── Side Panel ── */}
      {selectedTerm && (
        <NodePanel
          term={selectedTerm}
          relatedTerms={
            linksRef.current
              .filter((l) => {
                const src = typeof l.source === "string" ? l.source : (l.source as GraphNode).id;
                const tgt = typeof l.target === "string" ? l.target : (l.target as GraphNode).id;
                return src === selectedTerm.id || tgt === selectedTerm.id;
              })
              .map((l) => {
                const otherId = ((l.source as GraphNode).id === selectedTerm.id)
                  ? (l.target as GraphNode).id
                  : (l.source as GraphNode).id;
                return nodesRef.current.find((n) => n.id === otherId)!;
              })
              .filter(Boolean)
          }
          onClose={() => setSelectedTerm(null)}
          onSelectTerm={(t) => setSelectedTerm(t)}
        />
      )}

      <style>{`
        @keyframes fadeInOut {
          0%   { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          15%  { opacity: 1; transform: translateX(-50%) translateY(0); }
          70%  { opacity: 1; }
          100% { opacity: 0; transform: translateX(-50%) translateY(-4px); }
        }
        .node-circle { transition: r 0.3s; }
        .node-group:hover .node-circle { filter: brightness(1.3); }
        svg { cursor: grab; }
        svg:active { cursor: grabbing; }
        input::placeholder { color: #475569; }
      `}</style>
    </div>
  );
}

// AI Graph — Pure vanilla JS, no bundler involved
// D3 + Supabase loaded via CDN script tags

const COLORS = {
  "Core ML": "#a78bfa",
  "LLM": "#2dd4bf",
  "Infra": "#60a5fa",
  "Tools": "#fbbf24",
  "Ethics": "#f87171",
  "Applications": "#34d399",
  "Emerging": "#f472b6",
  "Data": "#94a3b8",
  "Dev Tools": "#38bdf8",
  "APIs & Platforms": "#4ade80",
};
const color = (cat) => COLORS[cat] || "#94a3b8";
const nodeR = (n) => Math.max(4, Math.min(12, 4 + Math.sqrt(n.connectionCount || 0) * 1.8));

// ── Read config injected by Astro via window.NM ──────────────────────────────
const SUPA_URL = window.NM?.url;
const SUPA_KEY = window.NM?.key;

// ── State ────────────────────────────────────────────────────────────────────
let nodes = [], links = [], simulation, gSel, svgSel;
let selectedTerm = null;
let zoomBehavior = null;
let rotating = true;
let rotAngle = 0;

// ── DOM setup ─────────────────────────────────────────────────────────────────
const app = document.getElementById("app");
app.innerHTML = `
  <div id="loader" style="position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#04040e;z-index:999">
    <div id="spinner" style="font-size:32px;animation:spin 2s linear infinite">✦</div>
    <div style="color:#a78bfa;font-size:16px;font-weight:600;margin-top:12px">AI Graph</div>
    <div style="color:#475569;font-size:12px;margin-top:6px">Loading knowledge graph...</div>
  </div>
  <svg id="graph" style="width:100vw;height:100vh;display:block;position:relative;z-index:1"></svg>
  <div id="topbar" style="position:fixed;top:16px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,rgba(88,28,235,0.35) 0%,rgba(15,60,200,0.30) 50%,rgba(88,28,235,0.25) 100%);backdrop-filter:blur(20px);border:1px solid rgba(167,139,250,0.45);border-radius:14px;padding:9px 18px;z-index:10;box-shadow:0 4px 40px rgba(88,28,235,0.3),0 0 0 1px rgba(255,255,255,0.06),inset 0 1px 0 rgba(255,255,255,0.1)">
    <span style="font-size:15px;font-weight:800;background:linear-gradient(90deg,#c4b5fd,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:-.3px">✦ AI Graph</span>
    <div style="width:1px;height:18px;background:#1e2030"></div>
    <input id="search" placeholder="Search terms..." style="background:transparent;border:none;outline:none;color:#c8ccd4;font-size:13px;width:180px;caret-color:#a78bfa" />
    <div style="width:1px;height:18px;background:#1e2030"></div>
    <span id="count" style="font-size:12px;color:#64748b">— terms</span>
    <div style="width:1px;height:18px;background:#1e2030"></div>
    <button id="zoom-out" title="Zoom out" style="background:none;border:1px solid #1e2030;border-radius:6px;color:#94a3b8;font-size:16px;width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;padding:0;transition:all .15s">−</button>
    <button id="zoom-in"  title="Zoom in"  style="background:none;border:1px solid #1e2030;border-radius:6px;color:#94a3b8;font-size:16px;width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;padding:0;transition:all .15s">+</button>
    <button id="rotate-toggle" title="Toggle rotation" style="background:none;border:1px solid #a78bfa44;border-radius:6px;color:#a78bfa;font-size:13px;width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;padding:0;transition:all .15s">⟳</button>
    <button id="help-btn" title="How to use" style="background:none;border:1px solid #1e2030;border-radius:6px;color:#64748b;font-size:12px;font-weight:700;width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;padding:0;transition:all .15s">?</button>
  </div>
  <div id="booklet" style="position:fixed;top:80px;left:16px;z-index:10;width:200px">
    <div id="booklet-header" style="display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,rgba(88,28,235,0.3),rgba(15,60,200,0.25));border:1px solid rgba(167,139,250,0.35);border-radius:10px 10px 0 0;padding:8px 12px;cursor:pointer;user-select:none">
      <span style="font-size:11px;font-weight:700;color:#c4b5fd;letter-spacing:.5px;text-transform:uppercase">📖 How to use</span>
      <span id="booklet-arrow" style="font-size:10px;color:#a78bfa;transition:transform .2s">▲</span>
    </div>
    <div id="booklet-body" style="background:rgba(4,4,18,0.92);border:1px solid rgba(167,139,250,0.2);border-top:none;border-radius:0 0 10px 10px;padding:10px 12px;display:flex;flex-direction:column;gap:8px;backdrop-filter:blur(12px)">
      <div style="display:flex;gap:8px;align-items:flex-start"><span style="font-size:13px">🖱️</span><span style="font-size:11px;color:#94a3b8;line-height:1.5"><b style="color:#c8ccd4">Drag</b> to pan · <b style="color:#c8ccd4">Scroll</b> to zoom</span></div>
      <div style="display:flex;gap:8px;align-items:flex-start"><span style="font-size:13px">✨</span><span style="font-size:11px;color:#94a3b8;line-height:1.5"><b style="color:#c8ccd4">Click</b> any node — get definition + ELI5</span></div>
      <div style="display:flex;gap:8px;align-items:flex-start"><span style="font-size:13px">🔍</span><span style="font-size:11px;color:#94a3b8;line-height:1.5"><b style="color:#c8ccd4">Hover</b> to highlight connections</span></div>
      <div style="display:flex;gap:8px;align-items:flex-start"><span style="font-size:13px">🏷️</span><span style="font-size:11px;color:#94a3b8;line-height:1.5"><b style="color:#c8ccd4">Legend</b> below — filter by category</span></div>
      <div style="display:flex;gap:8px;align-items:flex-start"><span style="font-size:13px">⟳</span><span style="font-size:11px;color:#94a3b8;line-height:1.5"><b style="color:#c8ccd4">Rotation</b> pauses when you read</span></div>
      <div style="display:flex;gap:8px;align-items:flex-start"><span style="font-size:13px">🤖</span><span style="font-size:11px;color:#94a3b8;line-height:1.5">New term added <b style="color:#c8ccd4">every hour</b> by AI</span></div>
    </div>
  </div>
  <div id="legend" style="position:fixed;bottom:24px;left:16px;display:flex;flex-direction:column;gap:4px;z-index:10"></div>
  <div id="tooltip" style="display:none;position:fixed;pointer-events:none;z-index:100;max-width:260px;border-radius:8px;padding:10px 14px;background:rgba(4,4,20,.97);box-shadow:0 8px 32px rgba(0,0,0,.6)"></div>
  <div id="panel" style="display:none;position:fixed;right:0;top:0;bottom:0;width:360px;background:rgba(4,4,18,.97);border-left:1px solid #1e2030;flex-direction:column;z-index:50;backdrop-filter:blur(20px);box-shadow:-8px 0 48px rgba(0,0,0,.6)"></div>
  <div id="flash" style="display:none;position:fixed;top:70px;left:50%;transform:translateX(-50%);background:rgba(167,139,250,.12);border:1px solid #a78bfa44;border-radius:8px;padding:8px 16px;z-index:20;color:#a78bfa;font-size:12px;font-weight:500"></div>
  <div style="position:fixed;bottom:20px;right:20px;z-index:10;font-size:11px;color:rgba(255,255,255,0.22);letter-spacing:.3px;font-weight:500;pointer-events:none;user-select:none">crafted by <span style="color:rgba(167,139,250,0.55);font-weight:600">Rachit Sharma</span></div>
  <div id="help-modal" style="display:none;position:fixed;inset:0;z-index:200;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px)">
    <div style="background:linear-gradient(135deg,rgba(10,8,28,0.98),rgba(4,4,18,0.98));border:1px solid rgba(167,139,250,0.25);border-radius:16px;padding:28px 32px;max-width:480px;width:90%;box-shadow:0 24px 80px rgba(0,0,0,.8),0 0 0 1px rgba(255,255,255,0.03),inset 0 1px 0 rgba(255,255,255,0.06)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div>
          <h2 style="font-size:18px;font-weight:800;color:#f0f2f8">How to use AI Graph</h2>
          <p style="font-size:12px;color:#475569;margin-top:2px">The AI knowledge graph that teaches you connections</p>
        </div>
        <button id="help-close" style="background:none;border:none;cursor:pointer;color:#475569;font-size:20px;padding:4px;line-height:1">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="display:flex;gap:14px;align-items:flex-start">
          <span style="font-size:20px;flex-shrink:0">🖱️</span>
          <div><div style="font-size:13px;font-weight:600;color:#d4d8e8">Navigate the graph</div><div style="font-size:12px;color:#64748b;margin-top:2px">Click + drag on empty space to pan · Scroll wheel or +/− buttons to zoom</div></div>
        </div>
        <div style="display:flex;gap:14px;align-items:flex-start">
          <span style="font-size:20px;flex-shrink:0">✨</span>
          <div><div style="font-size:13px;font-weight:600;color:#d4d8e8">Explore a concept</div><div style="font-size:12px;color:#64748b;margin-top:2px">Click any node to open its panel — read the Definition, get an ELI5 from Claude, or browse Related terms</div></div>
        </div>
        <div style="display:flex;gap:14px;align-items:flex-start">
          <span style="font-size:20px;flex-shrink:0">🔗</span>
          <div><div style="font-size:13px;font-weight:600;color:#d4d8e8">See connections</div><div style="font-size:12px;color:#64748b;margin-top:2px">Hover over any node to highlight its direct connections and dim everything else</div></div>
        </div>
        <div style="display:flex;gap:14px;align-items:flex-start">
          <span style="font-size:20px;flex-shrink:0">🔍</span>
          <div><div style="font-size:13px;font-weight:600;color:#d4d8e8">Search & filter</div><div style="font-size:12px;color:#64748b;margin-top:2px">Type in the search bar to find terms · Click a category in the legend (bottom-left) to isolate it</div></div>
        </div>
        <div style="display:flex;gap:14px;align-items:flex-start">
          <span style="font-size:20px;flex-shrink:0">⟳</span>
          <div><div style="font-size:13px;font-weight:600;color:#d4d8e8">Rotation</div><div style="font-size:12px;color:#64748b;margin-top:2px">The graph slowly rotates like Earth. Click ⟳ to pause/resume. Dragging a node pauses it temporarily.</div></div>
        </div>
        <div style="display:flex;gap:14px;align-items:flex-start">
          <span style="font-size:20px;flex-shrink:0">🤖</span>
          <div><div style="font-size:13px;font-weight:600;color:#d4d8e8">Self-evolving</div><div style="font-size:12px;color:#64748b;margin-top:2px">Claude adds a new AI term to the graph every hour automatically — watch for the flash notification</div></div>
        </div>
      </div>
      <button id="help-got-it" style="margin-top:24px;width:100%;background:linear-gradient(135deg,#7c3aed,#4f46e5);border:none;border-radius:8px;color:#fff;font-size:13px;font-weight:600;padding:10px;cursor:pointer;letter-spacing:.3px">Got it — let me explore ✦</button>
    </div>
  </div>
`;

const style = document.createElement("style");
style.textContent = `
  @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
  svg{cursor:grab;background:transparent}
  svg:active{cursor:grabbing}
  input::placeholder{color:#475569}
  #zoom-in:hover,#zoom-out:hover{border-color:#a78bfa88;color:#e2e8f0}
  #rotate-toggle:hover{border-color:#a78bfa;background:#a78bfa18}
  #help-btn:hover{border-color:#a78bfa88;color:#e2e8f0}
  #help-modal{display:none}
  #help-modal.open{display:flex}
  #help-got-it:hover{filter:brightness(1.15)}
`;
document.head.appendChild(style);

// ── Help modal ───────────────────────────────────────────────────────────────
// ── Booklet toggle ────────────────────────────────────────────────────────────
document.getElementById("booklet-header").addEventListener("click", () => {
  const body = document.getElementById("booklet-body");
  const arrow = document.getElementById("booklet-arrow");
  const open = body.style.display !== "none";
  body.style.display = open ? "none" : "flex";
  arrow.style.transform = open ? "rotate(180deg)" : "rotate(0deg)";
});

const helpModal = document.getElementById("help-modal");
const closeHelp = () => { helpModal.classList.remove("open"); setTimeout(() => { rotating = true; }, 600); };
document.getElementById("help-btn").onclick = () => { helpModal.classList.add("open"); rotating = false; };
document.getElementById("help-close").onclick = closeHelp;
document.getElementById("help-got-it").onclick = closeHelp;
helpModal.addEventListener("click", e => { if (e.target === helpModal) closeHelp(); });

// ── Legend ───────────────────────────────────────────────────────────────────
const legend = document.getElementById("legend");
Object.entries(COLORS).forEach(([cat, clr]) => {
  const btn = document.createElement("button");
  btn.style.cssText = "display:flex;align-items:center;gap:7px;background:none;border:none;cursor:pointer;padding:2px 0";
  btn.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:${clr};flex-shrink:0"></span><span style="font-size:11px;color:#94a3b8">${cat}</span>`;
  btn.dataset.cat = cat;
  btn.addEventListener("click", () => toggleCategory(cat));
  legend.appendChild(btn);
});

let activeCategory = null;
function toggleCategory(cat) {
  activeCategory = activeCategory === cat ? null : cat;
  legend.querySelectorAll("button").forEach(b => {
    b.style.opacity = activeCategory && b.dataset.cat !== activeCategory ? "0.3" : "1";
  });
  applyFilter();
}

// ── Search ───────────────────────────────────────────────────────────────────
document.getElementById("search").addEventListener("focus", () => { rotating = false; });
document.getElementById("search").addEventListener("blur",  () => { if (!selectedTerm) setTimeout(() => { rotating = true; }, 800); });
document.getElementById("search").addEventListener("input", applyFilter);

function applyFilter() {
  const q = document.getElementById("search").value.toLowerCase();
  if (!gSel) return;
  gSel.selectAll(".node-g").attr("opacity", d => {
    const ms = !q || d.name.toLowerCase().includes(q) || d.full_name.toLowerCase().includes(q);
    const mc = !activeCategory || d.category === activeCategory;
    return ms && mc ? 1 : 0.05;
  });
}

// ── Main init ─────────────────────────────────────────────────────────────────
async function init() {
  if (!window.d3 || !window.supabase) {
    showError("D3/Supabase CDN not loaded. Try a hard refresh (Ctrl+Shift+R).");
    return;
  }
  if (!SUPA_URL || !SUPA_KEY) {
    showError("Supabase config missing. Check Vercel env vars.");
    return;
  }

  const db = window.supabase.createClient(SUPA_URL, SUPA_KEY);

  try {
    const [tRes, cRes] = await Promise.all([
      db.from("terms").select("id,name,full_name,category,definition,created_at").order("created_at"),
      db.from("connections").select("from_id,to_id,weight"),
    ]);
    if (tRes.error) throw tRes.error;
    if (cRes.error) throw cRes.error;

    buildGraph(tRes.data, cRes.data);
    document.getElementById("loader").style.display = "none";
    document.getElementById("count").textContent = `${tRes.data.length} terms`;

    // Realtime
    db.channel("terms-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "terms" }, async payload => {
        const t = payload.new;
        const { data: nc } = await db.from("connections").select("from_id,to_id,weight")
          .or(`from_id.eq.${t.id},to_id.eq.${t.id}`);
        addNode(t, nc || []);
        document.getElementById("count").textContent = `${nodes.length} terms`;
        showFlash(`✦ New: ${t.name}`);
      })
      .subscribe();

  } catch (err) {
    showError(err.message || "Failed to load");
  }
}

function showError(msg) {
  document.getElementById("loader").innerHTML = `<div style="color:#f87171;font-size:14px">Failed to load: ${msg}</div>`;
}

// ── Build graph ───────────────────────────────────────────────────────────────
function buildGraph(terms, conns) {
  const d3 = window.d3;
  const W = window.innerWidth, H = window.innerHeight;

  // Count connections per node
  const cnt = {};
  conns.forEach(c => { cnt[c.from_id] = (cnt[c.from_id] || 0) + 1; cnt[c.to_id] = (cnt[c.to_id] || 0) + 1; });

  nodes = terms.map(t => ({ ...t, connectionCount: cnt[t.id] || 0 }));
  const idSet = new Set(nodes.map(n => n.id));
  links = conns.filter(c => idSet.has(c.from_id) && idSet.has(c.to_id))
    .map(c => ({ source: c.from_id, target: c.to_id, weight: c.weight }));

  const svg = d3.select("#graph").attr("width", W).attr("height", H);
  svgSel = svg;

  // Defs: glow filters
  const defs = svg.append("defs");

  // Node glow
  const glow = defs.append("filter").attr("id", "glow");
  glow.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "cb");
  const fm = glow.append("feMerge"); fm.append("feMergeNode").attr("in", "cb"); fm.append("feMergeNode").attr("in", "SourceGraphic");

  const glowNew = defs.append("filter").attr("id", "glow-new");
  glowNew.append("feGaussianBlur").attr("stdDeviation", "8").attr("result", "cb2");
  const fm2 = glowNew.append("feMerge"); fm2.append("feMergeNode").attr("in", "cb2"); fm2.append("feMergeNode").attr("in", "SourceGraphic");


  // ── IMPORTANT: declare g and rotG BEFORE zoom setup (TDZ safety) ──────────
  const g = svg.append("g");
  const rotG = g.append("g");   // rotation lives here; zoom/pan lives on g
  gSel = rotG;

  // Zoom
  zoomBehavior = d3.zoom().scaleExtent([0.05, 4]).on("zoom", e => g.attr("transform", e.transform));
  svg.call(zoomBehavior).call(zoomBehavior.transform, d3.zoomIdentity.translate(W / 2, H / 2).scale(0.28));
  svg.on("click", () => { resetHL(); closePanel(); });

  // Wire zoom buttons
  document.getElementById("zoom-in").onclick = () =>
    svgSel.transition().duration(300).call(zoomBehavior.scaleBy, 1.4);
  document.getElementById("zoom-out").onclick = () =>
    svgSel.transition().duration(300).call(zoomBehavior.scaleBy, 0.71);
  document.getElementById("rotate-toggle").onclick = () => {
    rotating = !rotating;
    const btn = document.getElementById("rotate-toggle");
    btn.style.color = rotating ? "#a78bfa" : "#475569";
    btn.style.borderColor = rotating ? "#a78bfa44" : "#1e2030";
  };

  // Links — plain bright stroke, no filter (filters are expensive at scale)
  const linkG = rotG.append("g");
  linkG.selectAll("line").data(links).join("line")
    .attr("stroke", "rgba(255,255,255,0.22)")
    .attr("stroke-width", d => 0.5 + (d.weight || 1) * 0.3);

  // Nodes
  const nodeG = rotG.append("g");
  renderNodes(nodeG, nodes);

  // Simulation
  simulation = d3.forceSimulation(nodes)
    .alphaDecay(0.03)
    .force("link", d3.forceLink(links).id(d => d.id).distance(130).strength(0.18))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(0, 0).strength(0.04))
    .force("radial", d3.forceRadial(d => d.connectionCount >= 4 ? 260 : 600, 0, 0).strength(0.1))
    .force("collision", d3.forceCollide().radius(d => nodeR(d) + 52));

  simulation.on("tick", () => {
    linkG.selectAll("line")
      .attr("x1", d => d.source.x || 0).attr("y1", d => d.source.y || 0)
      .attr("x2", d => d.target.x || 0).attr("y2", d => d.target.y || 0);
    rotG.selectAll(".node-g").attr("transform", d => `translate(${d.x || 0},${d.y || 0})`);
  });

  window.addEventListener("resize", () => {
    svg.attr("width", window.innerWidth).attr("height", window.innerHeight);
  });

  // ── Earth rotation RAF ────────────────────────────────────────────────────
  (function rotFrame() {
    if (rotating) {
      rotAngle = (rotAngle + 0.04) % 360;   // ~2.4°/s at 60fps — smooth, medium
      rotG.attr("transform", `rotate(${rotAngle})`);
    }
    requestAnimationFrame(rotFrame);
  })();
}

function renderNodes(parent, data) {
  const d3 = window.d3;
  const ng = parent.selectAll(".node-g").data(data, d => d.id).join("g")
    .attr("class", "node-g").attr("cursor", "pointer")
    .call(d3.drag()
      .on("start", (e, d) => {
        rotating = false;  // pause rotation while dragging
        if (!e.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on("drag",  (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on("end",   (e, d) => {
        if (!e.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
        // Resume rotation after a moment
        setTimeout(() => { rotating = true; }, 1500);
      }));

  ng.append("circle").attr("r", d => nodeR(d) + 4).attr("fill", "none")
    .attr("stroke", d => color(d.category)).attr("stroke-opacity", 0.15).attr("stroke-width", 6);

  ng.append("circle").attr("class", "dot").attr("r", d => nodeR(d))
    .attr("fill", d => color(d.category)).attr("fill-opacity", 0.9).attr("filter", "url(#glow)");

  ng.filter(d => d.connectionCount >= 1).append("text")
    .attr("dy", d => nodeR(d) + 15).attr("text-anchor", "middle")
    .attr("fill", "#dde2f0").attr("pointer-events", "none")
    .attr("font-weight", d => d.connectionCount >= 5 ? "600" : "400")
    .attr("font-size", d => Math.max(12, Math.min(17, 11 + d.connectionCount * 0.5)))
    .style("text-shadow", "0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7)")
    .text(d => d.name);

  ng.on("mouseenter", function(e, d) {
    e.stopPropagation();
    showTooltip(e, d);
    highlightNode(d);
  })
  .on("mousemove", e => moveTooltip(e))
  .on("mouseleave", () => { hideTooltip(); resetHL(); })
  .on("click", (e, d) => { e.stopPropagation(); openPanel(d); hideTooltip(); });

  return ng;
}

// ── Add new node (realtime) ───────────────────────────────────────────────────
function addNode(term, newConns) {
  const d3 = window.d3;
  if (!gSel || !simulation) return;

  term.connectionCount = newConns.length;
  term.x = (Math.random() - 0.5) * 2000;
  term.y = (Math.random() - 0.5) * 2000;
  nodes.push(term);

  const idSet = new Set(nodes.map(n => n.id));
  const newLinks = newConns.filter(c => idSet.has(c.from_id) && idSet.has(c.to_id))
    .map(c => ({ source: c.from_id, target: c.to_id, weight: c.weight }));
  links.push(...newLinks);

  simulation.nodes(nodes);
  simulation.force("link").links(links);

  gSel.select("g").selectAll("line").data(links).join("line")
    .attr("stroke", "rgba(255,255,255,0.22)")
    .attr("stroke-width", d => 0.5 + (d.weight || 1) * 0.3);

  const ng = gSel.selectAll(".node-g").data(nodes, d => d.id);
  const entered = ng.enter().append("g").attr("class", "node-g").attr("cursor", "pointer")
    .call(d3.drag()
      .on("start", (e, d) => {
        rotating = false;
        if (!e.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on("drag",  (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on("end",   (e, d) => {
        if (!e.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
        setTimeout(() => { rotating = true; }, 1500);
      }));

  entered.append("circle").attr("r", d => nodeR(d) + 4).attr("fill", "none")
    .attr("stroke", d => color(d.category)).attr("stroke-opacity", 0.15).attr("stroke-width", 6);
  entered.append("circle").attr("class", "dot").attr("r", d => nodeR(d))
    .attr("fill", d => color(d.category)).attr("fill-opacity", 0.9).attr("filter", "url(#glow-new)")
    .transition().duration(3000).attr("filter", "url(#glow)");
  entered.filter(d => d.connectionCount >= 1).append("text")
    .attr("dy", d => nodeR(d) + 15).attr("text-anchor", "middle")
    .attr("fill", "#dde2f0").attr("pointer-events", "none").attr("font-size", 13)
    .style("text-shadow", "0 1px 4px rgba(0,0,0,0.9)")
    .text(d => d.name);
  entered.on("mouseenter", function(e, d) { e.stopPropagation(); showTooltip(e, d); highlightNode(d); })
    .on("mousemove", e => moveTooltip(e)).on("mouseleave", () => { hideTooltip(); resetHL(); })
    .on("click", (e, d) => { e.stopPropagation(); openPanel(d); hideTooltip(); });

  simulation.alpha(0.5).restart();
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
const tip = document.getElementById("tooltip");
function showTooltip(e, d) {
  const clr = color(d.category);
  tip.style.cssText += `;display:block;left:${Math.min(e.clientX+16, window.innerWidth-280)}px;top:${Math.min(e.clientY-10, window.innerHeight-120)}px;border:1px solid ${clr}44;border-left:3px solid ${clr};box-shadow:0 8px 32px rgba(0,0,0,.6),0 0 20px ${clr}18`;
  tip.innerHTML = `
    <div style="margin-bottom:6px"><span style="font-size:10px;font-weight:600;color:${clr};background:${clr}18;border-radius:4px;padding:2px 6px;text-transform:uppercase;letter-spacing:.5px">${d.category}</span></div>
    <div style="font-size:13px;font-weight:700;color:#e2e8f0;margin-bottom:4px">${d.name}</div>
    ${d.full_name !== d.name ? `<div style="font-size:10px;color:#64748b;margin-bottom:6px">${d.full_name}</div>` : ""}
    <div style="font-size:11px;color:#94a3b8;line-height:1.5">${d.definition}</div>
    <div style="font-size:10px;color:#475569;margin-top:6px">${d.connectionCount} connections</div>
    <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);font-size:10px;color:#a78bfa;font-weight:600;letter-spacing:.3px">✦ Click for ELI5 · Related · Full panel</div>`;
}
function moveTooltip(e) {
  tip.style.left = Math.min(e.clientX + 16, window.innerWidth - 280) + "px";
  tip.style.top  = Math.min(e.clientY - 10, window.innerHeight - 120) + "px";
}
function hideTooltip() { tip.style.display = "none"; }

// ── Highlight ─────────────────────────────────────────────────────────────────
function highlightNode(d) {
  if (!gSel) return;
  const connected = new Set([d.id]);
  gSel.selectAll("line").each(function(l) {
    const s = l.source.id || l.source, t = l.target.id || l.target;
    if (s === d.id || t === d.id) { connected.add(s); connected.add(t); }
  });
  gSel.selectAll(".node-g").attr("opacity", n => connected.has(n.id) ? 1 : 0.05);
  gSel.selectAll("line")
    .attr("stroke", l => {
      const s = l.source.id || l.source, t = l.target.id || l.target;
      return (s === d.id || t === d.id) ? color(d.category) : "rgba(255,255,255,0.04)";
    })
    .attr("stroke-opacity", l => {
      const s = l.source.id || l.source, t = l.target.id || l.target;
      return (s === d.id || t === d.id) ? 0.95 : 0.4;
    })
;
}
function resetHL() {
  if (!gSel) return;
  gSel.selectAll(".node-g").attr("opacity", 1);
  gSel.selectAll("line")
    .attr("stroke", "rgba(255,255,255,0.22)")
    .attr("stroke-opacity", 1);
}

// ── Flash ─────────────────────────────────────────────────────────────────────
function showFlash(msg) {
  const f = document.getElementById("flash");
  f.textContent = msg; f.style.display = "block";
  setTimeout(() => { f.style.display = "none"; }, 4000);
}

// ── Side Panel ────────────────────────────────────────────────────────────────
const panel = document.getElementById("panel");
function openPanel(d) {
  selectedTerm = d;
  const clr = color(d.category);
  const related = links.filter(l => {
    const s = l.source.id || l.source, t = l.target.id || l.target;
    return s === d.id || t === d.id;
  }).map(l => {
    const otherId = (l.source.id || l.source) === d.id ? (l.target.id || l.target) : (l.source.id || l.source);
    return nodes.find(n => n.id === otherId);
  }).filter(Boolean);

  rotating = false;
  panel.style.display = "flex";
  panel.style.borderLeftColor = clr + "30";
  panel.innerHTML = `
    <div style="padding:20px 20px 16px;border-bottom:1px solid ${clr}20;background:linear-gradient(135deg,${clr}08 0%,transparent 100%)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <span style="font-size:10px;font-weight:600;color:${clr};background:${clr}18;border-radius:4px;padding:2px 7px;text-transform:uppercase;letter-spacing:.5px">${d.category}</span>
          <h2 style="font-size:20px;font-weight:800;color:#f0f2f8;margin-top:8px;line-height:1.2">${d.name}</h2>
          ${d.full_name !== d.name ? `<div style="font-size:12px;color:#64748b;margin-top:2px">${d.full_name}</div>` : ""}
        </div>
        <button id="close-panel" style="background:none;border:none;cursor:pointer;color:#475569;font-size:18px;padding:4px;line-height:1;margin-left:12px;margin-top:-4px">✕</button>
      </div>
      <div style="display:flex;gap:12px;margin-top:12px">
        <span style="font-size:11px;color:#475569"><span style="color:${clr};font-weight:700">${related.length}</span> connections</span>
        <span style="font-size:11px;color:#475569">Added ${new Date(d.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
      </div>
    </div>
    <div style="display:flex;border-bottom:1px solid #1e2030;padding:0 20px" id="tabs">
      <button class="tab active-tab" data-tab="def" style="background:none;border:none;cursor:pointer;padding:12px 4px;margin-right:20px;font-size:12px;font-weight:500;color:${clr};border-bottom:2px solid ${clr}">Definition</button>
      <button class="tab" data-tab="eli5" style="background:none;border:none;cursor:pointer;padding:12px 4px;margin-right:20px;font-size:12px;font-weight:500;color:#475569;border-bottom:2px solid transparent">Explain like I'm 5</button>
      <button class="tab" data-tab="rel" style="background:none;border:none;cursor:pointer;padding:12px 4px;font-size:12px;font-weight:500;color:#475569;border-bottom:2px solid transparent">Related</button>
    </div>
    <div id="tab-content" style="overflow-y:auto;padding:20px;flex:1;min-height:0"></div>
    <div id="qa-section" style="border-top:1px solid rgba(167,139,250,0.15);padding:14px 16px;background:rgba(88,28,235,0.05);flex-shrink:0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:11px;font-weight:700;color:#a78bfa;text-transform:uppercase;letter-spacing:.5px">✦ Ask a follow-up</span>
        <span id="qa-counter" style="font-size:10px;color:#475569;background:rgba(255,255,255,0.05);border-radius:20px;padding:2px 8px">5 questions left</span>
      </div>
      <div id="qa-history" style="max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;margin-bottom:10px"></div>
      <div style="display:flex;gap:8px;align-items:flex-end">
        <textarea id="qa-input" placeholder="Ask anything about ${d.name} or AI..." rows="2"
          style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(167,139,250,0.25);border-radius:8px;color:#e2e8f0;font-size:12px;padding:8px 10px;resize:none;outline:none;font-family:inherit;line-height:1.5;caret-color:#a78bfa"></textarea>
        <button id="qa-send" style="background:linear-gradient(135deg,#7c3aed,#4f46e5);border:none;border-radius:8px;color:#fff;font-size:16px;width:36px;height:36px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center">↑</button>
      </div>
    </div>`;

  showTab("def", d, related, clr);

  document.getElementById("close-panel").onclick = closePanel;
  document.querySelectorAll(".tab").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".tab").forEach(b => { b.style.color = "#475569"; b.style.borderBottomColor = "transparent"; });
      btn.style.color = clr; btn.style.borderBottomColor = clr;
      showTab(btn.dataset.tab, d, related, clr);
    };
  });

  // Q&A logic
  let qaCount = 0;
  const maxQ = 5;
  const history = [];

  function updateCounter() {
    const left = maxQ - qaCount;
    const el = document.getElementById("qa-counter");
    if (el) el.textContent = left > 0 ? `${left} question${left !== 1 ? "s" : ""} left` : "Limit reached";
    const inp = document.getElementById("qa-input");
    const btn = document.getElementById("qa-send");
    if (inp && left === 0) { inp.disabled = true; inp.placeholder = "You've used all 5 questions for this term."; inp.style.opacity = "0.4"; }
    if (btn && left === 0) { btn.disabled = true; btn.style.opacity = "0.4"; }
  }

  async function sendQuestion() {
    const inp = document.getElementById("qa-input");
    if (!inp) return;
    const q = inp.value.trim();
    if (!q || qaCount >= maxQ) return;
    inp.value = "";
    qaCount++;
    updateCounter();

    const histEl = document.getElementById("qa-history");
    if (!histEl) return;

    // User bubble
    histEl.insertAdjacentHTML("beforeend", `
      <div style="align-self:flex-end;background:rgba(124,58,237,0.25);border:1px solid rgba(167,139,250,0.3);border-radius:10px 10px 2px 10px;padding:8px 12px;max-width:90%;font-size:12px;color:#e2e8f0;line-height:1.5">${q}</div>
      <div id="qa-thinking-${qaCount}" style="align-self:flex-start;display:flex;align-items:center;gap:6px;font-size:12px;color:#a78bfa;font-weight:600"><span style="animation:spin 1s linear infinite">◌</span> Thinking...</div>`);
    histEl.scrollTop = histEl.scrollHeight;

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termName: d.name, definition: d.definition, question: q, history }),
      });
      const data = await res.json();
      const answer = data.answer || "Could not get a response.";
      history.push({ q, a: answer });

      const thinking = document.getElementById(`qa-thinking-${qaCount}`);
      if (thinking) thinking.outerHTML = `
        <div style="align-self:flex-start;background:rgba(15,20,40,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:10px 10px 10px 2px;padding:8px 12px;max-width:95%;font-size:12px;color:#c8ccd4;line-height:1.6">${answer}</div>`;
    } catch {
      const thinking = document.getElementById(`qa-thinking-${qaCount}`);
      if (thinking) thinking.outerHTML = `<div style="font-size:12px;color:#f87171">Failed. Try again.</div>`;
    }
    histEl.scrollTop = histEl.scrollHeight;
  }

  document.getElementById("qa-send").addEventListener("click", sendQuestion);
  document.getElementById("qa-input").addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendQuestion(); }
  });
}

function showTab(tab, d, related, clr) {
  const content = document.getElementById("tab-content");
  if (tab === "def") {
    content.innerHTML = `
      <p style="font-size:14px;color:#b0b8cc;line-height:1.7;margin-bottom:20px">${d.definition}</p>
      <div style="border-top:1px solid rgba(167,139,250,0.15);padding-top:16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <div style="font-size:14px;font-weight:800;color:#a78bfa;letter-spacing:-.2px">✦ Explain like I'm 5</div>
          <div id="eli5-spinner" style="animation:spin 1s linear infinite;color:#a78bfa;font-size:13px">◌</div>
        </div>
        <div id="eli5-text" style="font-size:14px;color:#64748b;font-style:italic">Loading...</div>
      </div>`;
    fetch("/api/eli5", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ termName: d.name, definition: d.definition }) })
      .then(r => r.json()).then(data => {
        const spinner = document.getElementById("eli5-spinner");
        const eli5text = document.getElementById("eli5-text");
        if (spinner) spinner.style.display = "none";
        if (eli5text) { eli5text.style.color = "#d4d8e8"; eli5text.textContent = `"${data.explanation || "Could not generate."}"` ; }
      }).catch(() => {
        const eli5text = document.getElementById("eli5-text");
        if (eli5text) { eli5text.style.color = "#f87171"; eli5text.textContent = "Failed to load. Try again."; }
      });
  } else if (tab === "eli5") {
    content.innerHTML = `<div style="display:flex;align-items:center;gap:10px;color:#a78bfa;font-size:14px;font-weight:600"><div style="animation:spin 1s linear infinite">◌</div>Thinking...</div>`;
    fetch("/api/eli5", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ termName: d.name, definition: d.definition }) })
      .then(r => r.json()).then(data => {
        content.innerHTML = `
          <div style="font-size:15px;font-weight:800;color:#a78bfa;margin-bottom:12px;letter-spacing:-.2px">✦ Here you go!</div>
          <p style="font-size:15px;color:#d4d8e8;line-height:1.8;font-style:italic">"${data.explanation || "Could not generate."}"</p>`;
      }).catch(() => { content.innerHTML = `<div style="color:#f87171;font-size:13px">Failed to fetch. Try again.</div>`; });
  } else if (tab === "rel") {
    if (!related.length) { content.innerHTML = `<p style="font-size:13px;color:#475569">No connections yet.</p>`; return; }
    content.innerHTML = related.map(r => {
      const rc = color(r.category);
      return `<button onclick="window.__openTerm('${r.id}')" style="display:block;width:100%;background:${rc}08;border:1px solid ${rc}20;border-radius:8px;padding:10px 14px;cursor:pointer;text-align:left;margin-bottom:8px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:13px;font-weight:600;color:#d4d8e8">${r.name}</span>
          <span style="font-size:9px;color:${rc};background:${rc}18;padding:1px 5px;border-radius:3px;text-transform:uppercase;letter-spacing:.4px">${r.category}</span>
        </div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">${r.full_name}</div>
      </button>`;
    }).join("");
  }
}

window.__openTerm = (id) => {
  const term = nodes.find(n => n.id === id);
  if (term) openPanel(term);
};

function closePanel() { panel.style.display = "none"; selectedTerm = null; setTimeout(() => { rotating = true; }, 600); }

// ── Asteroid news ─────────────────────────────────────────────────────────────
(function asteroidSystem() {
  let newsPool = [];
  let poolIndex = 0;
  let activeCount = 0;
  const MAX_ACTIVE = 3;

  const asteroidCSS = `
    @keyframes asteroid-fly {
      0%   { transform: translateX(0) translateY(0) rotate(0deg);   opacity: 0; }
      5%   { opacity: 1; }
      95%  { opacity: 1; }
      100% { transform: translateX(-120vw) translateY(var(--drift)) rotate(-18deg); opacity: 0; }
    }
    .asteroid {
      position: fixed; z-index: 15; pointer-events: auto; cursor: pointer;
      display: flex; align-items: center; gap: 8px;
      background: rgba(10,8,30,0.82);
      border: 1px solid rgba(167,139,250,0.45);
      border-radius: 42% 58% 55% 45% / 48% 52% 48% 52%;
      padding: 7px 14px 7px 10px;
      max-width: 320px;
      backdrop-filter: blur(10px);
      box-shadow: 0 0 18px rgba(120,60,255,0.25), inset 0 1px 0 rgba(255,255,255,0.06);
      animation: asteroid-fly var(--dur) linear forwards;
      right: -340px;
      user-select: none;
    }
    .asteroid:hover { border-color: rgba(167,139,250,0.85); box-shadow: 0 0 28px rgba(120,60,255,0.5); animation-play-state: paused; }
    .asteroid-icon { font-size: 16px; flex-shrink: 0; animation: spin 8s linear infinite; display: inline-block; }
    .asteroid-text { font-size: 11px; color: #c4b5fd; font-weight: 500; line-height: 1.4; }
    .asteroid-pts  { font-size: 10px; color: #a78bfa; opacity: 0.7; white-space: nowrap; flex-shrink: 0; }
  `;
  const s = document.createElement("style");
  s.textContent = asteroidCSS;
  document.head.appendChild(s);

  async function fetchNews() {
    try {
      const res = await fetch("/api/news");
      const data = await res.json();
      if (data.stories?.length) {
        newsPool = data.stories;
        poolIndex = 0;
      }
    } catch {}
  }

  function spawnAsteroid() {
    if (!newsPool.length || activeCount >= MAX_ACTIVE) return;
    const story = newsPool[poolIndex % newsPool.length];
    poolIndex++;
    activeCount++;

    const el = document.createElement("div");
    el.className = "asteroid";
    const top = 80 + Math.random() * (window.innerHeight - 180);
    const dur = 14 + Math.random() * 8; // 14–22s
    const drift = (Math.random() - 0.5) * 60;
    el.style.cssText += `top:${top}px; --dur:${dur}s; --drift:${drift}px;`;
    el.title = story.title;
    el.innerHTML = `
      <span class="asteroid-icon">🪨</span>
      <span class="asteroid-text">${story.title.length > 52 ? story.title.slice(0, 52) + "…" : story.title}</span>
      <span class="asteroid-pts">▲${story.points}</span>`;
    el.addEventListener("click", () => window.open(story.url, "_blank", "noopener"));
    el.addEventListener("animationend", () => { el.remove(); activeCount = Math.max(0, activeCount - 1); });
    document.body.appendChild(el);
  }

  // Boot: fetch then spawn first one after 5s, then every 60s
  fetchNews().then(() => {
    setTimeout(spawnAsteroid, 5000);
    setInterval(() => {
      spawnAsteroid();
      // Refresh pool every 10 spawns
      if (poolIndex % 10 === 0) fetchNews();
    }, 60000);
  });
})();

// ── Go ────────────────────────────────────────────────────────────────────────
init();

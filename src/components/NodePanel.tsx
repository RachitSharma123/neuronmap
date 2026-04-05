import { useState } from "react";
import type { Term } from "../lib/supabase";

const CATEGORY_COLORS: Record<string, string> = {
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

interface RelatedNode {
  id: string;
  name: string;
  full_name: string;
  category: string;
  definition: string;
  created_at: string;
  connectionCount: number;
}

interface Props {
  term: Term;
  relatedTerms: RelatedNode[];
  onClose: () => void;
  onSelectTerm: (term: Term) => void;
}

type Tab = "definition" | "eli5" | "related";

export default function NodePanel({ term, relatedTerms, onClose, onSelectTerm }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("definition");
  const [eli5Text, setEli5Text] = useState<string | null>(null);
  const [eli5Loading, setEli5Loading] = useState(false);
  const [eli5Error, setEli5Error] = useState<string | null>(null);

  const color = CATEGORY_COLORS[term.category] ?? "#94a3b8";

  const fetchEli5 = async () => {
    if (eli5Text) { setActiveTab("eli5"); return; }
    setActiveTab("eli5");
    setEli5Loading(true);
    setEli5Error(null);

    try {
      const res = await fetch("/api/eli5", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termName: term.name, definition: term.definition }),
      });
      const data = await res.json();
      if (data.explanation) setEli5Text(data.explanation);
      else setEli5Error("Could not generate explanation.");
    } catch {
      setEli5Error("Network error. Try again.");
    } finally {
      setEli5Loading(false);
    }
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute", right: 0, top: 0, bottom: 0,
        width: 360, background: "rgba(10,10,18,0.97)",
        borderLeft: `1px solid ${color}30`,
        display: "flex", flexDirection: "column", zIndex: 50,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        backdropFilter: "blur(20px)",
        boxShadow: `-8px 0 48px rgba(0,0,0,0.6)`,
        animation: "slideIn 0.2s ease",
      }}
    >
      {/* ── Header ── */}
      <div style={{
        padding: "20px 20px 16px",
        borderBottom: `1px solid ${color}20`,
        background: `linear-gradient(135deg, ${color}08 0%, transparent 100%)`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <span style={{
              fontSize: 10, fontWeight: 600, color: color,
              background: `${color}18`, borderRadius: 4,
              padding: "2px 7px", textTransform: "uppercase", letterSpacing: "0.5px",
            }}>
              {term.category}
            </span>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#f0f2f8", marginTop: 8, lineHeight: 1.2 }}>
              {term.name}
            </h2>
            {term.full_name !== term.name && (
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{term.full_name}</div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#475569", fontSize: 18, padding: 4, lineHeight: 1,
              marginLeft: 12, marginTop: -4,
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#94a3b8")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
          >
            ✕
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <div style={{ fontSize: 11, color: "#475569" }}>
            <span style={{ color: color, fontWeight: 700 }}>{relatedTerms.length}</span> connections
          </div>
          <div style={{ fontSize: 11, color: "#475569" }}>
            Added {new Date(term.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display: "flex", borderBottom: `1px solid #1e2030`,
        padding: "0 20px",
      }}>
        {(["definition", "eli5", "related"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              if (tab === "eli5") fetchEli5();
              else setActiveTab(tab);
            }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "12px 4px", marginRight: 20,
              fontSize: 12, fontWeight: 500,
              color: activeTab === tab ? color : "#475569",
              borderBottom: activeTab === tab ? `2px solid ${color}` : "2px solid transparent",
              transition: "color 0.2s",
              textTransform: "capitalize",
            }}
          >
            {tab === "eli5" ? "Explain to me like I'm 5" : tab === "definition" ? "Definition" : "Related"}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>

        {/* Definition Tab */}
        {activeTab === "definition" && (
          <div>
            <p style={{ fontSize: 14, color: "#b0b8cc", lineHeight: 1.7, margin: 0 }}>
              {term.definition}
            </p>
          </div>
        )}

        {/* ELI5 Tab */}
        {activeTab === "eli5" && (
          <div>
            {eli5Loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#475569", fontSize: 13 }}>
                <div style={{ animation: "spin 1s linear infinite", fontSize: 16 }}>◌</div>
                Asking Claude...
              </div>
            )}
            {eli5Error && (
              <div style={{ fontSize: 13, color: "#f87171" }}>{eli5Error}</div>
            )}
            {eli5Text && !eli5Loading && (
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: "#475569",
                  marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px",
                }}>
                  ✦ Claude explains
                </div>
                <p style={{
                  fontSize: 15, color: "#d4d8e8", lineHeight: 1.8,
                  margin: 0, fontStyle: "italic",
                }}>
                  "{eli5Text}"
                </p>
              </div>
            )}
          </div>
        )}

        {/* Related Terms Tab */}
        {activeTab === "related" && (
          <div>
            {relatedTerms.length === 0 ? (
              <p style={{ fontSize: 13, color: "#475569" }}>No connections yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {relatedTerms.map((rt) => {
                  const rtColor = CATEGORY_COLORS[rt.category] ?? "#94a3b8";
                  return (
                    <button
                      key={rt.id}
                      onClick={() => onSelectTerm({
                        id: rt.id, name: rt.name, full_name: rt.full_name,
                        category: rt.category, definition: rt.definition, created_at: rt.created_at,
                      })}
                      style={{
                        background: `${rtColor}08`, border: `1px solid ${rtColor}20`,
                        borderRadius: 8, padding: "10px 14px", cursor: "pointer",
                        textAlign: "left", transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = `${rtColor}15`;
                        (e.currentTarget as HTMLButtonElement).style.borderColor = `${rtColor}40`;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = `${rtColor}08`;
                        (e.currentTarget as HTMLButtonElement).style.borderColor = `${rtColor}20`;
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#d4d8e8" }}>{rt.name}</span>
                        <span style={{
                          fontSize: 9, color: rtColor, background: `${rtColor}18`,
                          padding: "1px 5px", borderRadius: 3, textTransform: "uppercase",
                          letterSpacing: "0.4px",
                        }}>{rt.category}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>{rt.full_name}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(30px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

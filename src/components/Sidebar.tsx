import { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  Search,
  Type,
  FileText,
  MessageSquare,
  MessagesSquare,
  MessageSquareText,
  MessageCircle,
  Bot,
  Link,
  GitBranch,
  Split,
  Merge,
  Globe,
  Search as SearchIcon,
  Wrench,
  Box,
  Sparkles,
  GripVertical,
  Plug,
  Plus,
  X,
  Server,
  Cloud,
  Code
} from "lucide-react";
import { NODE_CATEGORIES, NODE_TYPES_BY_CATEGORY } from "@/nodeTypes";
import type { NodeTypeDef } from "@/types";
import CreateApiToolModal from "./CreateApiToolModal";
import CreateMcpToolModal from "./CreateMcpToolModal";
import ToolDetailsModal from "./ToolDetailsModal";

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  Type,
  FileText,
  MessageSquare,
  MessagesSquare,
  MessageSquareText,
  MessageCircle,
  Bot,
  Link,
  GitBranch,
  Split,
  Merge,
  Globe,
  Search: SearchIcon,
  Wrench,
  Box,
  Sparkles,
  Plug,
};

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState<"components" | "tools">("components");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const [showApiToolModal, setShowApiToolModal] = useState(false);
  const [showMcpToolModal, setShowMcpToolModal] = useState(false);
  const [showExtTools, setShowExtTools] = useState(false);
  
  const [selectedToolData, setSelectedToolData] = useState<any | null>(null);
  const [selectedToolType, setSelectedToolType] = useState<"api" | "mcp" | "external" | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [customTools, setCustomTools] = useState<any[]>([]);
  const [mcpTools, setMcpTools] = useState<any[]>([]);
  const [extStatus, setExtStatus] = useState<{github: boolean, huggingface: boolean}>({github: false, huggingface: false});

  const fetchData = async () => {
    try {
      const [apiRes, mcpRes, extRes, allExtRes] = await Promise.all([
        fetch("http://localhost:8001/api/custom-tools"),
        fetch("http://localhost:8001/api/custom-mcp-tools"),
        fetch("http://localhost:8001/api/external-tools/status"),
        fetch("http://localhost:8001/api/external-tools/all").catch(() => ({ json: () => ({ tools: [] }) }))
      ]);
      const apiData = await apiRes.json();
      const mcpData = await mcpRes.json();
      const extData = await extRes.json();
      const allExtData = await (allExtRes as any).json();
      
      setCustomTools(apiData.tools || []);
      
      if (NODE_TYPES_BY_CATEGORY["tools"]) {
        const apiCallNode = NODE_TYPES_BY_CATEGORY["tools"].find(n => n.type === "api_call");
        if (apiCallNode) {
          apiCallNode.options = [
            { label: "Select an API tool...", value: "" },
            ...(apiData.tools || []).map((t: any) => ({ label: t.name, value: t.name }))
          ];
        }
      }
      
      if (NODE_TYPES_BY_CATEGORY["external"]) {
        const extToolNode = NODE_TYPES_BY_CATEGORY["external"].find(n => n.type === "external_tool");
        if (extToolNode) {
          const combinedMcpTools = [
            ...(mcpData.tools || []),
            ...(allExtData.tools || [])
          ];
          
          if (combinedMcpTools.length > 0) {
            extToolNode.options = [
              { label: "Select an MCP/External tool...", value: "" },
              ...combinedMcpTools.map((t: any) => ({ label: t.name, value: t.name }))
            ];
          } else {
             extToolNode.options = [
              { label: "Connect a provider first...", value: "" }
             ];
          }
        }
      }

      setMcpTools(mcpData.tools || []);
      setExtStatus(extData || {github: false, huggingface: false});
    } catch (e) {
      console.error("Failed to fetch tools", e);
    }
  };

  useEffect(() => {
    if (activeTab === "tools") {
      fetchData();
    }
  }, [activeTab]);

  const toggle = (cat: string) =>
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const onDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    nodeDef: NodeTypeDef,
  ) => {
    e.dataTransfer.setData("application/graphnode", JSON.stringify(nodeDef));
    e.dataTransfer.effectAllowed = "move";
  };

  const lowerSearch = search.toLowerCase();

  const handleOpenDetails = (type: "api" | "mcp" | "external", data: any) => {
    setSelectedToolType(type);
    setSelectedToolData(data);
    setShowDetailsModal(true);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header" style={{ paddingBottom: '0' }}>
        <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-light)' }}>
          <button
            onClick={() => setActiveTab("components")}
            style={{
              flex: 1, padding: '12px 8px', background: 'transparent', border: 'none',
              borderBottom: activeTab === 'components' ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === 'components' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'components' ? 600 : 400, cursor: 'pointer',
              fontSize: '14px', transition: 'all 0.2s'
            }}
          >
            Components
          </button>
          <button
            onClick={() => setActiveTab("tools")}
            style={{
              flex: 1, padding: '12px 8px', background: 'transparent', border: 'none',
              borderBottom: activeTab === 'tools' ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === 'tools' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'tools' ? 600 : 400, cursor: 'pointer',
              fontSize: '14px', transition: 'all 0.2s'
            }}
          >
            Tools
          </button>
        </div>
      </div>

      {activeTab === "components" && (
        <>
          <div className="sidebar-search">
            <Search size={14} className="sidebar-search-icon" />
            <input
              type="text"
              placeholder="Search components..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sidebar-search-input"
            />
          </div>

          <div className="sidebar-list">
            {Object.entries(NODE_CATEGORIES).map(([catKey, cat]) => {
              const items = (NODE_TYPES_BY_CATEGORY[catKey] || []).filter(
                (n) =>
                  !lowerSearch ||
                  n.label.toLowerCase().includes(lowerSearch) ||
                  n.description.toLowerCase().includes(lowerSearch),
              );
              if (items.length === 0) return null;

              const isCollapsed = collapsed[catKey];

              return (
                <div key={catKey} className="sidebar-category">
                  <button
                    className="sidebar-category-btn"
                    onClick={() => toggle(catKey)}
                  >
                    <span
                      className="sidebar-category-dot"
                      style={{ background: cat.color }}
                    />
                    <span className="sidebar-category-label">{cat.label}</span>
                    <span className="sidebar-category-count">{items.length}</span>
                    {isCollapsed ? (
                      <ChevronRight size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                  </button>

                  {!isCollapsed && (
                    <div className="sidebar-items">
                      {items.map((node) => {
                        const Icon = ICONS[node.icon] || Box;
                        return (
                          <div
                            key={node.type}
                            className="sidebar-item"
                            draggable
                            onDragStart={(e) => onDragStart(e, node)}
                            style={{ "--c": node.color } as React.CSSProperties}
                          >
                            <GripVertical size={12} className="sidebar-item-grip" />
                            <span className="sidebar-item-icon">
                              <Icon size={14} />
                            </span>
                            <div className="sidebar-item-text">
                              <span className="sidebar-item-name">
                                {node.label}
                              </span>
                              <span className="sidebar-item-desc">
                                {node.description}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeTab === "tools" && (
        <div className="sidebar-list" style={{ padding: '16px' }}>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            <button
              className="toolbar-btn"
              onClick={() => setShowApiToolModal(true)}
              title="Add API Tool"
              style={{ flex: 1, justifyContent: 'center', padding: '6px', color: '#0ea5e9', borderColor: '#0ea5e9' }}
            >
              <Code size={14} />
              <span style={{ fontSize: '11px' }}>API</span>
            </button>
            <button
              className="toolbar-btn"
              onClick={() => setShowMcpToolModal(true)}
              title="Add MCP Tool"
              style={{ flex: 1, justifyContent: 'center', padding: '6px', color: '#10b981', borderColor: '#10b981' }}
            >
              <Server size={14} />
              <span style={{ fontSize: '11px' }}>MCP</span>
            </button>
            <div style={{ position: 'relative', flex: 1 }}>
              <button
                className="toolbar-btn"
                onClick={() => setShowExtTools(!showExtTools)}
                title="External Tools"
                style={{ width: '100%', justifyContent: 'center', padding: '6px', color: '#f97316', borderColor: '#f97316' }}
              >
                <Cloud size={14} />
                <span style={{ fontSize: '11px' }}>Ext</span>
              </button>

              {showExtTools && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '4px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: '10px', padding: '8px', width: '200px', zIndex: 999,
                  boxShadow: 'var(--shadow-xl)'
                }}>
                  <button
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                      padding: '10px 12px', background: 'transparent', border: 'none',
                      color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '8px',
                      fontSize: '13px', textAlign: 'left',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => {
                      if (extStatus.github) {
                        fetch("http://localhost:8001/api/external-tools/disconnect", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ provider: "github" })
                        }).then(() => fetchData());
                      } else {
                        const popup = window.open(
                          "http://localhost:8001/api/auth/github/login",
                          "github_auth", "width=600,height=700,scrollbars=yes"
                        );
                        const handler = (event: MessageEvent) => {
                          if (event.data?.type === 'oauth_success' && event.data?.provider === 'github') {
                            fetchData();
                            setShowExtTools(false);
                            window.removeEventListener('message', handler);
                          }
                        };
                        window.addEventListener('message', handler);
                      }
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>GitHub</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {extStatus.github ? 'Connected' : 'Not Connected'}
                      </div>
                    </div>
                  </button>

                  <button
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                      padding: '10px 12px', background: 'transparent', border: 'none',
                      color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '8px',
                      fontSize: '13px', textAlign: 'left',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={async () => {
                      if (extStatus.huggingface) {
                        fetch("http://localhost:8001/api/external-tools/disconnect", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ provider: "huggingface" })
                        }).then(() => fetchData());
                      } else {
                        const token = window.prompt(
                          "Paste your HuggingFace Access Token (hf_...):\n\n" +
                          "Get one from: https://huggingface.co/settings/tokens"
                        );
                        if (token && token.trim()) {
                          try {
                            const res = await fetch("http://localhost:8001/api/external-tools/connect", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ provider: "huggingface", token: token.trim() })
                            });
                            if (res.ok) {
                              const data = await res.json();
                              alert(`✅ HuggingFace connected! Loaded ${data.tool_count} tools.`);
                              fetchData();
                              setShowExtTools(false);
                            } else {
                              const err = await res.json();
                              alert(`❌ Failed to connect: ${err.detail || "Unknown error"}`);
                            }
                          } catch (e) {
                            alert(`❌ Connection error: ${e}`);
                          }
                        }
                      }
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>🤗</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>HuggingFace</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {extStatus.huggingface ? 'Connected' : 'Not Connected'}
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>

          <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '8px' }}>Configured Tools</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
            {customTools.map((t, i) => (
              <div 
                key={i} 
                onClick={() => handleOpenDetails("api", t)}
                style={{ padding: '12px', background: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer', transition: 'border-color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Code size={14} color="#0ea5e9" />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>{t.name}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.description}</div>
              </div>
            ))}
            {mcpTools.map((t, i) => (
              <div 
                key={i} 
                onClick={() => handleOpenDetails("mcp", t)}
                style={{ padding: '12px', background: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer', transition: 'border-color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Server size={14} color="#10b981" />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>{t.name}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.description}</div>
              </div>
            ))}
            {customTools.length === 0 && mcpTools.length === 0 && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px' }}>No tools configured yet.</div>
            )}
          </div>

          <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '8px' }}>External Integrations</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {extStatus.github && (
              <div 
                onClick={() => handleOpenDetails("external", { name: "GitHub", provider: "github" })}
                style={{ padding: '12px', background: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer', transition: 'border-color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Cloud size={14} color="#f97316" />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>GitHub</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Connected</div>
              </div>
            )}
            {extStatus.huggingface && (
              <div 
                onClick={() => handleOpenDetails("external", { name: "HuggingFace", provider: "huggingface" })}
                style={{ padding: '12px', background: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer', transition: 'border-color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '14px' }}>🤗</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>HuggingFace</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Connected</div>
              </div>
            )}
            {!extStatus.github && !extStatus.huggingface && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px' }}>No external integrations connected.</div>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      <CreateApiToolModal 
        isOpen={showApiToolModal} 
        onClose={() => setShowApiToolModal(false)} 
        onSave={async (config) => {
          try {
            const res = await fetch("http://localhost:8001/api/custom-tools", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(config)
            });
            if (!res.ok) throw new Error(await res.text());
            fetchData();
          } catch (e: any) {
            alert(`Failed to create API Tool: ${e.message}`);
          }
        }} 
      />
      <CreateMcpToolModal 
        isOpen={showMcpToolModal} 
        onClose={() => setShowMcpToolModal(false)} 
        onSave={async (config) => {
          try {
            const res = await fetch("http://localhost:8001/api/custom-mcp-tools", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(config)
            });
            if (!res.ok) throw new Error(await res.text());
            fetchData();
          } catch (e: any) {
            alert(`Failed to create MCP Tool: ${e.message}`);
          }
        }} 
      />
      <ToolDetailsModal 
        isOpen={showDetailsModal} 
        onClose={() => setShowDetailsModal(false)} 
        toolData={selectedToolData} 
        toolType={selectedToolType} 
        onDelete={async () => {
          if (!confirm(`Are you sure you want to ${selectedToolType === 'external' ? 'disconnect' : 'delete'} this tool?`)) return;
          try {
            if (selectedToolType === "api") {
              await fetch(`http://localhost:8001/api/custom-tools/${selectedToolData.name}`, { method: "DELETE" });
            } else if (selectedToolType === "mcp") {
              await fetch(`http://localhost:8001/api/custom-mcp-tools/${selectedToolData.name}`, { method: "DELETE" });
            } else if (selectedToolType === "external") {
              await fetch("http://localhost:8001/api/external-tools/disconnect", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ provider: selectedToolData.provider })
              });
            }
            setShowDetailsModal(false);
            fetchData();
          } catch (e: any) {
            alert(`Failed to delete/disconnect: ${e.message}`);
          }
        }}
      />
    </aside>
  );
}

import React, { useState, useEffect } from "react";
import { X, Search } from "lucide-react";

interface ToolDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  toolData: any | null;
  toolType: "api" | "mcp" | "external" | null;
  onDelete?: () => void;
}

export default function ToolDetailsModal({ isOpen, onClose, toolData, toolType, onDelete }: ToolDetailsModalProps) {
  const [externalTools, setExternalTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (isOpen && toolType === "external" && toolData?.provider) {
      setLoading(true);
      fetch(`http://localhost:8001/api/external-tools/${toolData.provider}/tools`)
        .then(res => res.json())
        .then(data => {
          setExternalTools(data.tools || []);
        })
        .catch(err => console.error("Failed to fetch external tools", err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, toolType, toolData]);

  if (!isOpen || !toolData) return null;

  const renderAuthDetails = (authType: string, config: any) => {
    switch (authType) {
      case "api_key":
        return <div><strong>Auth Type:</strong> API Key ({config.apiKeyHeader})</div>;
      case "basic_auth":
        return <div><strong>Auth Type:</strong> Basic Auth (Username: {config.basicUsername})</div>;
      case "bearer_token":
        return (
          <div>
            <strong>Auth Type:</strong> Bearer Token
            <div><strong>Token URL:</strong> {config.bearerTokenUrl}</div>
            <div><strong>Response Field:</strong> {config.bearerTokenField}</div>
          </div>
        );
      case "oauth2":
        return (
          <div>
            <strong>Auth Type:</strong> OAuth 2.0 ({config.oauthGrantType})
            {config.oauthAuthUrl && <div><strong>Auth URL:</strong> {config.oauthAuthUrl}</div>}
            {config.oauthTokenUrl && <div><strong>Token URL:</strong> {config.oauthTokenUrl}</div>}
            <div><strong>Client ID:</strong> {config.oauthClientId}</div>
          </div>
        );
      default:
        return <div><strong>Auth Type:</strong> No Auth</div>;
    }
  };

  const filteredExternalTools = externalTools.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content api-tool-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {toolType === "api" && `API Tool: ${toolData.name}`}
            {toolType === "mcp" && `MCP Tool: ${toolData.name}`}
            {toolType === "external" && `External Provider: ${toolData.name}`}
          </h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {toolType !== "external" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <strong>Description:</strong>
                <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>{toolData.description}</p>
              </div>

              {toolType === "api" && (
                <>
                  <div>
                    <strong>Endpoint:</strong>
                    <div style={{ marginTop: '4px', padding: '8px', background: 'var(--bg-base)', borderRadius: '6px', fontFamily: 'monospace' }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{toolData.httpMethod}</span> {toolData.url}
                    </div>
                  </div>
                  {renderAuthDetails(toolData.authType, toolData)}
                  {toolData.headers && toolData.headers.length > 0 && (
                    <div>
                      <strong>Headers:</strong>
                      <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                        {toolData.headers.map((h: any, i: number) => (
                          <li key={i}>{h.key}: {h.value}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {toolData.bodyParams && toolData.bodyParams.length > 0 && (
                    <div>
                      <strong>Request Body:</strong>
                      <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                        {toolData.bodyParams.map((p: any, i: number) => (
                          <li key={i}>{p.name} ({p.type}) {p.required ? '*' : ''}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {toolData.responseParams && toolData.responseParams.length > 0 && (
                    <div>
                      <strong>Response Body:</strong>
                      <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                        {toolData.responseParams.map((p: any, i: number) => (
                          <li key={i}>{p.key} ({p.type})</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {toolType === "mcp" && (
                <>
                  <div>
                    <strong>MCP URL:</strong>
                    <div style={{ marginTop: '4px', padding: '8px', background: 'var(--bg-base)', borderRadius: '6px', fontFamily: 'monospace' }}>
                      {toolData.mcpUrl}
                    </div>
                  </div>
                  {renderAuthDetails(toolData.authType, toolData)}
                  {toolData.headers && toolData.headers.length > 0 && (
                    <div>
                      <strong>Headers:</strong>
                      <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                        {toolData.headers.map((h: any, i: number) => (
                          <li key={i}>{h.key}: {h.value}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {toolType === "external" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                This provider connects multiple tools to your workflow.
              </p>
              
              <div className="sidebar-search" style={{ margin: 0 }}>
                <Search size={14} className="sidebar-search-icon" />
                <input
                  type="text"
                  placeholder="Search available tools..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="sidebar-search-input"
                />
              </div>

              {loading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading tools...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredExternalTools.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>No tools found.</div>
                  ) : (
                    filteredExternalTools.map((t, i) => (
                      <div key={i} style={{ padding: '12px', background: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{t.name}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t.description}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px', display: 'flex', justifyContent: 'space-between' }}>
          {onDelete ? (
            <button className="btn-secondary danger" style={{ color: '#ef4444', borderColor: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={onDelete}>
              {toolType === "external" ? "Disconnect" : "Delete Tool"}
            </button>
          ) : <div />}
          <button className="btn-primary" onClick={onClose}>Close</button>
        </div>

      </div>
    </div>
  );
}

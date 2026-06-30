import React, { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";

interface CreateMcpToolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (toolConfig: any) => Promise<void>;
}

export default function CreateMcpToolModal({ isOpen, onClose, onSave }: CreateMcpToolModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [authType, setAuthType] = useState("no_auth");

  const [apiKeyHeader, setApiKeyHeader] = useState("X-API-Key");
  const [apiKey, setApiKey] = useState("");
  const [basicUsername, setBasicUsername] = useState("");
  const [basicPassword, setBasicPassword] = useState("");

  const [oauthGrantType, setOauthGrantType] = useState("authorization_code");
  const [oauthAuthUrl, setOauthAuthUrl] = useState("");
  const [oauthTokenUrl, setOauthTokenUrl] = useState("");
  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [oauthScope, setOauthScope] = useState("");
  const [oauthUsername, setOauthUsername] = useState("");
  const [oauthPassword, setOauthPassword] = useState("");

  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([]);

  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleAddHeader = () => {
    setHeaders([...headers, { key: "", value: "" }]);
  };

  const handleSave = async () => {
    if (!name || !mcpUrl) {
      alert("Name and MCP URL are required.");
      return;
    }

    setIsSaving(true);
    const toolConfig = {
      name,
      description,
      mcpUrl,
      authType,
      apiKeyHeader: authType === "api_key" ? apiKeyHeader : undefined,
      apiKey: authType === "api_key" ? apiKey : undefined,
      basicUsername: authType === "basic_auth" ? basicUsername : undefined,
      basicPassword: authType === "basic_auth" ? basicPassword : undefined,
      oauthGrantType: authType === "oauth2" ? oauthGrantType : undefined,
      oauthAuthUrl: authType === "oauth2" ? oauthAuthUrl : undefined,
      oauthTokenUrl: authType === "oauth2" ? oauthTokenUrl : undefined,
      oauthClientId: authType === "oauth2" ? oauthClientId : undefined,
      oauthClientSecret: authType === "oauth2" ? oauthClientSecret : undefined,
      oauthScope: authType === "oauth2" ? oauthScope : undefined,
      oauthUsername: authType === "oauth2" ? oauthUsername : undefined,
      oauthPassword: authType === "oauth2" ? oauthPassword : undefined,
      headers: headers.filter(h => h.key && h.value),
    };

    await onSave(toolConfig);
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content api-tool-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create MCP Tool</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Name <span className="required">*</span></label>
            <input
              type="text"
              placeholder="e.g. internal_wiki_mcp"
              maxLength={30}
              value={name}
              onChange={e => setName(e.target.value.replace(/\s+/g, "_"))}
            />
            <small>{name.length} / 30. Must be a valid identifier (no spaces).</small>
          </div>

          <div className="form-group">
            <label>Description <span className="required">*</span></label>
            <textarea
              placeholder="What does this MCP server provide? e.g., 'Provides access to internal company wiki tools'"
              maxLength={200}
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
            />
            <small>{description.length} / 200.</small>
          </div>

          <div className="form-section">
            <h3>Server Configuration</h3>
            <div className="form-group">
              <label>MCP URL <span className="required">*</span></label>
              <input
                type="url"
                placeholder="https://mcp.example.com/sse"
                value={mcpUrl}
                onChange={e => setMcpUrl(e.target.value)}
              />
              <small>The SSE endpoint for the MCP server.</small>
            </div>
          </div>

          <div className="form-section">
            <div className="section-header">
              <h3>Request Headers</h3>
              <button className="btn-secondary small" onClick={handleAddHeader}><Plus size={14} /> Add</button>
            </div>
            {headers.length === 0 && <p className="empty-text">No headers added. Click below to add one.</p>}
            {headers.map((h, i) => (
              <div key={i} className="dynamic-row">
                <input type="text" placeholder="Header Name *" value={h.key} onChange={e => {
                  const newH = [...headers]; newH[i].key = e.target.value; setHeaders(newH);
                }} />
                <input type="text" placeholder="Header Value *" value={h.value} onChange={e => {
                  const newH = [...headers]; newH[i].value = e.target.value; setHeaders(newH);
                }} />
                <button className="btn-icon danger" onClick={() => setHeaders(headers.filter((_, idx) => idx !== i))}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>

          <div className="form-section">
            <h3>Authentication</h3>
            <div className="form-group">
              <label>Auth Type <span className="required">*</span></label>
              <select value={authType} onChange={e => setAuthType(e.target.value)}>
                <option value="no_auth">No Auth</option>
                <option value="api_key">API Key</option>
                <option value="basic_auth">Basic Authentication</option>
                <option value="oauth2">OAuth 2.0</option>
              </select>
            </div>

            {authType === "api_key" && (
              <div className="form-group-container">
                <p className="empty-text" style={{margin: '0 0 10px'}}>Add the header name and value used by your provider to send the API key.</p>
                <div className="form-row">
                  <div className="form-group half">
                    <label>Header Name <span className="required">*</span></label>
                    <input type="text" value={apiKeyHeader} onChange={e => setApiKeyHeader(e.target.value)} />
                  </div>
                  <div className="form-group half">
                    <label>Value <span className="required">*</span></label>
                    <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {authType === "basic_auth" && (
              <div className="form-group-container">
                <p className="empty-text" style={{margin: '0 0 10px'}}>Add credentials used by your provider for basic authentication.</p>
                <div className="form-row">
                  <div className="form-group half">
                    <label>Username <span className="required">*</span></label>
                    <input type="text" value={basicUsername} onChange={e => setBasicUsername(e.target.value)} />
                  </div>
                  <div className="form-group half">
                    <label>Password <span className="required">*</span></label>
                    <input type="password" value={basicPassword} onChange={e => setBasicPassword(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {authType === "oauth2" && (
              <div className="form-group-container">
                <div className="form-group">
                  <label>Grant Type <span className="required">*</span></label>
                  <select value={oauthGrantType} onChange={e => setOauthGrantType(e.target.value)}>
                    <option value="authorization_code">Authorization Code</option>
                    <option value="authorization_code_pkce">Authorization Code (With PKCE)</option>
                    <option value="implicit">Implicit</option>
                    <option value="password_credentials">Password Credentials</option>
                    <option value="client_credentials">Client Credentials</option>
                  </select>
                </div>

                {(oauthGrantType === "authorization_code" || oauthGrantType === "authorization_code_pkce" || oauthGrantType === "implicit") && (
                  <div className="form-group">
                    <label>Authorization URL <span className="required">*</span></label>
                    <input type="url" value={oauthAuthUrl} onChange={e => setOauthAuthUrl(e.target.value)} />
                  </div>
                )}

                {oauthGrantType !== "implicit" && (
                  <div className="form-group">
                    <label>Token URL <span className="required">*</span></label>
                    <input type="url" value={oauthTokenUrl} onChange={e => setOauthTokenUrl(e.target.value)} />
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group half">
                    <label>Client ID <span className="required">*</span></label>
                    <input type="text" value={oauthClientId} onChange={e => setOauthClientId(e.target.value)} />
                  </div>
                  {oauthGrantType !== "implicit" && (
                    <div className="form-group half">
                      <label>Client Secret</label>
                      <input type="password" value={oauthClientSecret} onChange={e => setOauthClientSecret(e.target.value)} />
                    </div>
                  )}
                </div>

                {oauthGrantType === "password_credentials" && (
                  <div className="form-row">
                    <div className="form-group half">
                      <label>Username <span className="required">*</span></label>
                      <input type="text" value={oauthUsername} onChange={e => setOauthUsername(e.target.value)} />
                    </div>
                    <div className="form-group half">
                      <label>Password <span className="required">*</span></label>
                      <input type="password" value={oauthPassword} onChange={e => setOauthPassword(e.target.value)} />
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label>Scope (Optional)</label>
                  <input type="text" placeholder="e.g. read write" value={oauthScope} onChange={e => setOauthScope(e.target.value)} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Create Tool"}
          </button>
        </div>
      </div>
    </div>
  );
}

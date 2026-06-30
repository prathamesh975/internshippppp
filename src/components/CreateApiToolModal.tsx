import React, { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";

interface CreateApiToolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (toolConfig: any) => Promise<void>;
}

export default function CreateApiToolModal({ isOpen, onClose, onSave }: CreateApiToolModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState("GET");
  const [contentType, setContentType] = useState("application/json");
  const [authType, setAuthType] = useState("no_auth");

  const [apiKeyHeader, setApiKeyHeader] = useState("X-API-Key");
  const [apiKey, setApiKey] = useState("");
  const [bearerTokenUrl, setBearerTokenUrl] = useState("");
  const [bearerUsername, setBearerUsername] = useState("");
  const [bearerPassword, setBearerPassword] = useState("");
  const [bearerTokenField, setBearerTokenField] = useState("");
  const [basicUsername, setBasicUsername] = useState("");
  const [basicPassword, setBasicPassword] = useState("");

  const [sessionRequired, setSessionRequired] = useState(false);

  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([]);
  const [parameters, setParameters] = useState<{ name: string; type: string; in: string; description: string; required: boolean }[]>([]);
  const [responseParams, setResponseParams] = useState<{ key: string; type: string }[]>([]);

  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleAddHeader = () => {
    setHeaders([...headers, { key: "", value: "" }]);
  };

  const handleAddParameter = () => {
    setParameters([...parameters, { name: "", type: "string", in: "body", description: "", defaultValue: "", required: false } as any]);
  };

  const handleSave = async () => {
    if (!name || !url) {
      alert("Name and API URL are required.");
      return;
    }

    setIsSaving(true);
    
    const pathParamNames = [...url.matchAll(/{([^}]+)}/g)].map(m => m[1]);
    const extractedPathParams = pathParamNames.map(name => ({
      name, type: "string", in: "path", description: "Path parameter", required: true
    }));

    const toolConfig = {
      name,
      description,
      url,
      httpMethod: method,
      contentType,
      authType,
      apiKeyHeader: authType === "api_key" ? apiKeyHeader : undefined,
      apiKey: authType === "api_key" ? apiKey : undefined,
      bearerTokenUrl: authType === "bearer_token" ? bearerTokenUrl : undefined,
      bearerUsername: authType === "bearer_token" ? bearerUsername : undefined,
      bearerPassword: authType === "bearer_token" ? bearerPassword : undefined,
      bearerTokenField: authType === "bearer_token" ? bearerTokenField : undefined,
      basicUsername: authType === "basic_auth" ? basicUsername : undefined,
      basicPassword: authType === "basic_auth" ? basicPassword : undefined,
      sessionRequired,
      headers: headers.filter(h => h.key && h.value),
      pathParams: extractedPathParams,
      queryParams: parameters.filter((p: any) => p.in === "query"),
      bodyParams: parameters.filter((p: any) => p.in === "body"),
      responseParams: responseParams.filter((p: any) => p.key),
    };

    await onSave(toolConfig);
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content api-tool-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create API Tool</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Name <span className="required">*</span></label>
            <input
              type="text"
              placeholder="e.g. fetch_user_details"
              value={name}
              onChange={e => setName(e.target.value.replace(/\s+/g, "_"))}
            />
            <small>Must be a valid function name (no spaces).</small>
          </div>

          <div className="form-group">
            <label>Description <span className="required">*</span></label>
            <textarea
              placeholder="What does this tool do? The AI will read this to know when to use it."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="form-section">
            <h3>API Configuration</h3>

            <div className="form-group">
              <label>API URL <span className="required">*</span></label>
              <input
                type="url"
                placeholder="https://api.example.com/v1/users/{user_id}"
                value={url}
                onChange={e => setUrl(e.target.value)}
              />
              <small>Use {"{param_name}"} for path parameters.</small>
            </div>

            <div className="form-row">
              <div className="form-group half">
                <label>HTTP Method <span className="required">*</span></label>
                <select value={method} onChange={e => setMethod(e.target.value)}>
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
              <div className="form-group half">
                <label>Content Type</label>
                <select value={contentType} onChange={e => setContentType(e.target.value)}>
                  <option value="application/json">application/json</option>
                  <option value="application/x-www-form-urlencoded">application/x-www-form-urlencoded</option>
                  <option value="multipart/form-data">multipart/form-data</option>
                </select>
              </div>
            </div>

            <div className="checkbox-group">
              <input
                type="checkbox"
                id="sessionReq"
                checked={sessionRequired}
                onChange={e => setSessionRequired(e.target.checked)}
              />
              <label htmlFor="sessionReq">Session Required in Body? (Injects conversation session ID)</label>
            </div>
          </div>

          <div className="form-section">
            <h3>Authentication</h3>
            <div className="form-group">
              <select value={authType} onChange={e => setAuthType(e.target.value)}>
                <option value="no_auth">No Auth</option>
                <option value="api_key">API Key</option>
                <option value="bearer_token">Bearer Token</option>
                <option value="basic_auth">Basic Auth</option>
              </select>
            </div>

            {authType === "api_key" && (
              <div className="form-row">
                <div className="form-group half">
                  <label>Header Name</label>
                  <input type="text" value={apiKeyHeader} onChange={e => setApiKeyHeader(e.target.value)} />
                </div>
                <div className="form-group half">
                  <label>API Key</label>
                  <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} />
                </div>
              </div>
            )}

            {authType === "bearer_token" && (
              <div className="form-group-container">
                <div className="form-group">
                  <label>Token URL <span className="required">*</span></label>
                  <input type="url" value={bearerTokenUrl} onChange={e => setBearerTokenUrl(e.target.value)} />
                </div>
                <div className="form-row">
                  <div className="form-group half">
                    <label>Username <span className="required">*</span></label>
                    <input type="text" value={bearerUsername} onChange={e => setBearerUsername(e.target.value)} />
                  </div>
                  <div className="form-group half">
                    <label>Password <span className="required">*</span></label>
                    <input type="password" value={bearerPassword} onChange={e => setBearerPassword(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Token Response Field <span className="required">*</span></label>
                  <input type="text" placeholder="e.g., access_token, token" value={bearerTokenField} onChange={e => setBearerTokenField(e.target.value)} />
                </div>
              </div>
            )}

            {authType === "basic_auth" && (
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
            )}
          </div>

          <div className="form-section">
            <div className="section-header">
              <h3>Request Headers</h3>
              <button className="btn-secondary small" onClick={handleAddHeader}><Plus size={14} /> Add</button>
            </div>
            {headers.length === 0 && <p className="empty-text" style={{ marginBottom: '10px' }}>No headers added. Click below to add one.</p>}
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
            <div className="section-header">
              <h3>Response Body</h3>
              <button className="btn-secondary small" onClick={() => setResponseParams([...responseParams, { key: "", type: "string" }])}><Plus size={14} /> Add</button>
            </div>
            {responseParams.length === 0 && <p className="empty-text" style={{ marginBottom: '10px' }}>No response parameters added. Click below to add one.</p>}
            {responseParams.map((p, i) => (
              <div key={i} className="dynamic-row" style={{ alignItems: 'center' }}>
                <input type="text" placeholder="Key (e.g. data.users)" value={p.key} onChange={e => {
                  const newP = [...responseParams]; newP[i].key = e.target.value; setResponseParams(newP);
                }} />
                <select value={p.type} onChange={e => {
                  const newP = [...responseParams]; newP[i].type = e.target.value; setResponseParams(newP);
                }} style={{ width: '150px' }}>
                  <option value="string">String</option>
                  <option value="integer">Integer</option>
                  <option value="boolean">Boolean</option>
                  <option value="object">Object</option>
                  <option value="array">Array</option>
                </select>
                <button className="btn-icon danger" onClick={() => setResponseParams(responseParams.filter((_, idx) => idx !== i))}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>

          {method !== "GET" && (
            <div className="form-section">
              <div className="section-header">
                <h3>Request Body</h3>
                <button className="btn-secondary small" onClick={handleAddParameter}><Plus size={14} /> Add</button>
              </div>
              {parameters.length === 0 && <p className="empty-text">No body fields added.</p>}
              {parameters.map((p: any, i) => (
                <div key={i} className="parameter-card" style={{ marginBottom: '12px', padding: '12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <div className="form-row" style={{ marginBottom: '8px' }}>
                    <div className="form-group half" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '11px', marginBottom: '4px' }}>Key <span className="required">*</span></label>
                      <input className="param-name" type="text" placeholder="param1" value={p.name} onChange={e => {
                        const newP = [...parameters] as any[]; newP[i].name = e.target.value; setParameters(newP);
                      }} />
                    </div>
                    <div className="form-group half" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '11px', marginBottom: '4px' }}>Type <span className="required">*</span></label>
                      <select value={p.type} onChange={e => {
                        const newP = [...parameters] as any[]; newP[i].type = e.target.value; setParameters(newP);
                      }}>
                        <option value="string">String</option>
                        <option value="integer">Integer</option>
                        <option value="boolean">Boolean</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-row" style={{ alignItems: 'center' }}>
                    <div className="form-group half" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '11px', marginBottom: '4px' }}>Default Value</label>
                      <input type="text" placeholder="Optional" value={p.defaultValue || ""} onChange={e => {
                        const newP = [...parameters] as any[]; newP[i].defaultValue = e.target.value; setParameters(newP);
                      }} />
                    </div>
                    <div className="form-group half" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="checkbox" id={`req-${i}`} checked={p.required} onChange={e => {
                        const newP = [...parameters] as any[]; newP[i].required = e.target.checked; setParameters(newP);
                      }} />
                      <label htmlFor={`req-${i}`} style={{ margin: 0, fontSize: '12px' }}>Required</label>
                      <button className="btn-icon danger" style={{ marginLeft: 'auto' }} onClick={() => setParameters(parameters.filter((_, idx) => idx !== i))}><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

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

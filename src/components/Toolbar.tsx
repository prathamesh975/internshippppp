import { useRef, useState } from "react";
import {
  ArrowLeft,
  Save,
  Download,
  Upload,
  Trash2,
  FileJson,
  Rocket,
  MessageCircle,
  Play,
  Pause,
  Wrench,
  X,
  Plus,
} from "lucide-react";
import { useAppStore } from "@/appStore";
import { useFlowStore } from "@/flowStore";
import { downloadJson, buildExportPayload, readJsonFile } from "@/utils";
import type { GraphExport } from "@/types";

interface ToolbarProps {
  onTestFlow: () => void;
}

export default function Toolbar({ onTestFlow }: ToolbarProps) {
  const currentFlowName = useAppStore((s) => s.currentFlowName);
  const setCurrentFlowName = useAppStore((s) => s.setCurrentFlowName);
  const setView = useAppStore((s) => s.setView);
  const saveFlow = useAppStore((s) => s.saveFlow);
  const currentFlowId = useAppStore((s) => s.currentFlowId);
  const savedFlows = useAppStore((s) => s.savedFlows);
  
  const activeVersionId = useAppStore((s) => s.activeVersionId);
  const setActiveVersionId = useAppStore((s) => s.setActiveVersionId);
  const publishVersion = useAppStore((s) => s.publishVersion);
  const restoreVersionToDraft = useAppStore((s) => s.restoreVersionToDraft);

  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const clearCanvas = useFlowStore((s) => s.clearCanvas);
  const loadFlow = useFlowStore((s) => s.loadFlow);
  const rf = useFlowStore((s) => s.reactFlowInstance);
  const executionState = useFlowStore((s) => s.executionState);
  const sessionId = useFlowStore((s) => s.sessionId);
  const resumeStream = useFlowStore((s) => s.resumeStream);

  const importRef = useRef<HTMLInputElement>(null);
  const [publishAnim, setPublishAnim] = useState(false);

  const currentFlow = savedFlows.find((f) => f.id === currentFlowId);
  const versions = currentFlow?.versions || [];

  const getViewport = () =>
    rf?.getViewport() ?? { x: 0, y: 0, zoom: 1 };

  const handleSave = () => {
    if (activeVersionId === null) {
      saveFlow({ nodes, edges, viewport: getViewport() });
    }
  };

  const handleExport = () => {
    const payload = buildExportPayload(
      currentFlowName,
      nodes,
      edges,
      getViewport(),
    );
    downloadJson(payload, `${currentFlowName.replace(/\s+/g, "_")}${activeVersionId ? "_v" + activeVersionId : ""}.json`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await readJsonFile<GraphExport>(file);
      if (data.nodes && data.edges) {
        loadFlow(data.nodes, data.edges, data.viewport);
        if (data.metadata?.name) setCurrentFlowName(data.metadata.name);
        setActiveVersionId(null); 
      }
    } catch {
      alert("Invalid JSON file");
    }
    e.target.value = "";
  };

  const handleBack = () => {
    setView("home");
    clearCanvas();
  };

  const handlePublish = () => {
    if (activeVersionId === null) {
      handleSave();
    }
    const vName = window.prompt("Enter a name for this version:", `v${versions.length + 1}`);
    if (!vName) return;
    publishVersion(vName, nodes, edges, getViewport());
    setPublishAnim(true);
    setTimeout(() => setPublishAnim(false), 1200);
  };

  const handleVersionSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (activeVersionId === null) {
      handleSave(); 
    }
    
    if (val === "draft") {
      setActiveVersionId(null);
      const flow = useAppStore.getState().savedFlows.find((f) => f.id === currentFlowId);
      if (flow) {
        loadFlow(flow.nodes, flow.edges, flow.viewport);
      }
    } else {
      setActiveVersionId(val);
      const v = versions.find((v) => v.id === val);
      if (v) {
        loadFlow(v.nodes, v.edges, v.viewport);
      }
    }
  };

  const handleRestoreToDraft = () => {
    if (!activeVersionId) return;
    const flow = restoreVersionToDraft(activeVersionId);
    if (flow) {
      loadFlow(flow.nodes, flow.edges, flow.viewport);
      alert("Draft has been overwritten with this version. You are now editing the Draft.");
    }
  };

  const handlePause = async () => {
    try {
      await fetch("http://localhost:8001/api/chat/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <button
          className="toolbar-btn toolbar-btn--ghost"
          onClick={handleBack}
          title="Back to Home"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="toolbar-divider" />
        <FileJson size={18} className="toolbar-flow-icon" />
        <input
          className="toolbar-name"
          value={currentFlowName}
          onChange={(e) => setCurrentFlowName(e.target.value)}
          spellCheck={false}
          disabled={activeVersionId !== null}
        />
        
        {/* Version Selector */}
        <select 
          className="toolbar-version-select" 
          value={activeVersionId || "draft"}
          onChange={handleVersionSelect}
          style={{
            marginLeft: '12px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            padding: '4px 8px',
            borderRadius: '6px',
            outline: 'none',
            fontSize: '13px'
          }}
        >
          <option value="draft">Working Draft</option>
          {versions.map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </div>

      <div className="toolbar-right">
        {activeVersionId === null && (
          <button className="toolbar-btn" onClick={handleSave} title="Save Flow">
            <Save size={16} />
            <span>Save</span>
          </button>
        )}
        <button
          className="toolbar-btn"
          onClick={handleExport}
          title="Export JSON"
        >
          <Download size={16} />
          <span>Export</span>
        </button>
        <button
          className="toolbar-btn"
          onClick={() => importRef.current?.click()}
          title="Import JSON"
        >
          <Upload size={16} />
          <span>Import</span>
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".json"
          style={{ display: "none" }}
          onChange={handleImport}
        />



        {/* ── Publish & Versions ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {activeVersionId !== null && (
            <button
              className="toolbar-btn"
              onClick={handleRestoreToDraft}
              title="Overwrite Draft with this version"
              style={{ color: "var(--accent)", borderColor: "var(--accent)" }}
            >
              <Plus size={16} />
              <span>Restore to Draft</span>
            </button>
          )}
          <button
            className={`toolbar-btn toolbar-btn--publish ${publishAnim ? "toolbar-btn--publish-anim" : ""}`}
            onClick={handlePublish}
            title={"Publish Flow Version"}
            disabled={nodes.length === 0}
          >
            <Rocket size={16} />
            <span>Publish Version</span>
          </button>
        </div>



        {/* ── Test Flow ── */}
        <button
          className="toolbar-btn toolbar-btn--test"
          onClick={onTestFlow}
          title="Open Test Chat"
        >
          <MessageCircle size={16} />
          <span>Test Flow</span>
        </button>

        {executionState === 'running' && (
          <button className="toolbar-btn" onClick={handlePause} style={{ color: "#ef4444", borderColor: "#ef4444" }}>
            <Pause size={16} />
            <span>Pause</span>
          </button>
        )}
        
        {executionState === 'paused' && (
          <button className="toolbar-btn" onClick={resumeStream} style={{ color: "#10b981", borderColor: "#10b981" }}>
            <Play size={16} />
            <span>Resume</span>
          </button>
        )}

        <div className="toolbar-divider" />
        <button
          className="toolbar-btn toolbar-btn--danger"
          onClick={clearCanvas}
          title="Clear Canvas"
        >
          <Trash2 size={16} />
        </button>
      </div>


    </header>
  );
}

import { useEffect } from "react";
import { Plus, Trash2, Workflow } from "lucide-react";
import { useAppStore } from "@/appStore";
import { useFlowStore } from "@/flowStore";
import { formatDate } from "@/utils";

export default function HomePage() {
  const savedFlows = useAppStore((s) => s.savedFlows);
  const loadSavedFlows = useAppStore((s) => s.loadSavedFlows);
  const createNewFlow = useAppStore((s) => s.createNewFlow);
  const openFlow = useAppStore((s) => s.openFlow);
  const deleteFlow = useAppStore((s) => s.deleteFlow);
  const loadFlowToCanvas = useFlowStore((s) => s.loadFlow);

  useEffect(() => {
    loadSavedFlows();
  }, [loadSavedFlows]);

  const handleOpen = (id: string) => {
    const flow = openFlow(id);
    if (flow) {
      loadFlowToCanvas(flow.nodes, flow.edges, flow.viewport);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteFlow(id);
  };

  return (
    <div className="home">
      <div className="home-inner">
        {/* Hero */}
        <div className="home-hero">
          <div className="home-hero-icon">
            <Workflow size={40} />
          </div>
          <h1 className="home-title">Graph Builder</h1>
          <p className="home-subtitle">
            Create visual workflows, export as JSON for your backend.
          </p>
        </div>

        {/* Grid */}
        <div className="home-grid">
          {/* New flow card */}
          <button className="flow-card flow-card--new" onClick={createNewFlow}>
            <div className="flow-card-new-icon">
              <Plus size={32} />
            </div>
            <span className="flow-card-new-label">New Flow</span>
          </button>

          {/* Saved flows */}
          {savedFlows.map((flow) => (
            <div
              key={flow.id}
              className="flow-card"
              onClick={() => handleOpen(flow.id)}
            >
              <div className="flow-card-header">
                <Workflow size={20} className="flow-card-icon" />
                <button
                  className="flow-card-delete"
                  onClick={(e) => handleDelete(e, flow.id)}
                  title="Delete flow"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <h3 className="flow-card-name">{flow.name}</h3>
              <div className="flow-card-meta">
                <span>
                  {flow.nodeCount} node{flow.nodeCount !== 1 ? "s" : ""}
                </span>
                <span>·</span>
                <span>
                  {flow.edgeCount} edge{flow.edgeCount !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flow-card-date">{formatDate(flow.updatedAt)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

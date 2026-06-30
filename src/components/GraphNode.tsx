import { Handle, Position, useReactFlow, useUpdateNodeInternals } from "@xyflow/react";
import type { NodeProps, Node } from "@xyflow/react";
import { memo, useCallback, useEffect, useState } from "react";
import { useFlowStore } from "@/flowStore";
import {
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
  Search,
  Wrench,
  Box,
  Sparkles,
  CircleStop,
} from "lucide-react";
import type { GraphNodeData } from "@/types";

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
  Search,
  Wrench,
  Box,
  Sparkles,
  CircleStop,
};


const HEADER_H = 40;
const PORT_H = 28;

const PLACEHOLDERS: Record<string, string> = {
  text_input: "Enter your text here…",
  chat_input: "Type a message…",
  file_input: "File path or URL…",
  text_output: "Output will appear here…",
  chat_output: "Chat response preview…",
  prompt: "Write your prompt template…\ne.g. You are a {role}. Answer about {topic}.",
  agent: "Agent instructions…",
  orchestrator_agent: "Agent instructions…",
  aggregator_agent: "Agent instructions…",
  chain: "Chain configuration…",
  condition: "if input contains…",
  router: "Routing rules…",
  merger: "Merge strategy…",
  api_call: "https://api.example.com/endpoint",
  search: "Search query…",
  custom_tool: "Tool configuration…",
};

type GraphNodeType = Node<GraphNodeData, "graphNode">;

function GraphNode({ id, data, selected }: NodeProps<GraphNodeType>) {
  const { updateNodeData } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  
  const activeNodes = useFlowStore((s) => s.activeNodes);
  const nodeResults = useFlowStore((s) => s.nodeResults);
  const isActive = activeNodes.includes(id);
  const result = nodeResults[id];

  const [dynamicOptions, setDynamicOptions] = useState(data.options);

  const Icon = ICONS[data.icon] || Box;
  const maxPorts = Math.max(data.inputs.length, data.outputs.length, 0);
  const placeholder = PLACEHOLDERS[data.type] || "Enter value…";

  useEffect(() => {
    updateNodeInternals(id);
  }, [data.inputs.length, data.outputs.length, id, updateNodeInternals]);

  useEffect(() => {
    if (data.type === "custom_tool") {
      fetch("http://localhost:8001/api/tools")
        .then(res => res.json())
        .then(json => {
          if (json.tools && json.tools.length > 0) {
            setDynamicOptions([
              { label: "Select a tool...", value: "" },
              ...json.tools.map((t: any) => ({ label: t.name, value: t.name }))
            ]);
          }
        })
        .catch(err => console.error("Failed to fetch dynamic tools", err));
    } else if (data.type === "external_tool") {
      fetch("http://localhost:8001/api/external-tools")
        .then(res => res.json())
        .then(json => {
          if (json.tools && json.tools.length > 0) {
            setDynamicOptions([
              { label: "Select an external tool...", value: "" },
              ...json.tools.map((t: any) => ({ label: t.name, value: t.name }))
            ]);
          } else {
            setDynamicOptions([
              { label: "Connect a provider first...", value: "" }
            ]);
          }
        })
        .catch(err => console.error("Failed to fetch external tools", err));
    }
  }, [data.type]);

  const handleFieldChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { fieldValue: e.target.value });
    },
    [id, updateNodeData],
  );

  return (
    <div
      className={`gn ${selected ? "gn--selected" : ""} ${isActive ? "gn-executing" : ""}`}
      style={{ "--c": data.color } as React.CSSProperties}
    >
      {/* ── Status Badge / Tooltip ── */}
      {result && (
        <div className="gn-result-badge tooltip-container">
          <span style={{ fontSize: "10px" }}>✓</span>
          <div className="tooltip-content nodrag nowheel">
             <div className="tooltip-header">Execution Result</div>
             <pre>{typeof result === 'string' ? result : JSON.stringify(result, null, 2)}</pre>
          </div>
        </div>
      )}

      {/* ── Input handles ── */}
      {data.inputs.map((inp, i) => (
        <Handle
          key={`in-${inp.id}`}
          type="target"
          position={Position.Left}
          id={inp.id}
          className="gn-handle gn-handle--input"
          style={{ top: HEADER_H + PORT_H * i + PORT_H / 2 }}
        />
      ))}

      {/* ── Output handles ── */}
      {data.outputs.map((out, i) => (
        <Handle
          key={`out-${out.id}`}
          type="source"
          position={Position.Right}
          id={out.id}
          className="gn-handle gn-handle--output"
          style={{ top: HEADER_H + PORT_H * i + PORT_H / 2 }}
        />
      ))}

      {/* ── Header ── */}
      <div className="gn-header" style={{ height: HEADER_H }}>
        <span className="gn-icon">
          <Icon size={15} />
        </span>
        <span className="gn-title">{data.label}</span>
        
        {/* Breakpoint Toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            updateNodeData(id, { breakpoint: !data.breakpoint });
          }}
          className="nodrag"
          title={data.breakpoint ? "Remove Breakpoint" : "Set Breakpoint"}
          style={{
            marginLeft: data.type === "orchestrator_agent" ? "4px" : "auto",
            marginRight: data.type === "orchestrator_agent" ? "0" : "8px",
            background: "transparent",
            border: "none",
            color: data.breakpoint ? "#ef4444" : "rgba(255,255,255,0.2)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            padding: "2px"
          }}
        >
          <CircleStop size={14} fill={data.breakpoint ? "rgba(239,68,68,0.2)" : "transparent"} />
        </button>
        {data.type === "orchestrator_agent" && (
            <div style={{ marginLeft: "auto", display: "flex", gap: "4px", paddingRight: "8px" }}>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (data.outputs.length > 2) {
                     updateNodeData(id, { outputs: data.outputs.slice(0, -1) })
                  }
                }}
                className="nodrag"
                title="Remove Route"
                style={{ cursor: "pointer", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", color: "white", borderRadius: "4px", width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px" }}>-</button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (data.outputs.length < 7) {
                     const newRouteNum = data.outputs.length + 1;
                     updateNodeData(id, { outputs: [...data.outputs, { id: `route_${newRouteNum}`, label: `Route ${newRouteNum}`, type: "any" }] })
                  }
                }}
                className="nodrag"
                title="Add Route"
                style={{ cursor: "pointer", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", color: "white", borderRadius: "4px", width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px" }}>+</button>
            </div>
        )}
      </div>

      {/* ── Port labels ── */}
      {maxPorts > 0 && (
        <div className="gn-body">
          {Array.from({ length: maxPorts }).map((_, i) => {
            const outDef = data.outputs[i];
            const isRoute = outDef && (data.type === "router" || data.type === "orchestrator_agent") && outDef.id.startsWith("route_");
            return (
              <div key={i} className="gn-row" style={{ height: PORT_H }}>
                <span className="gn-port-label gn-port-label--left">
                  {data.inputs[i]?.label ?? ""}
                </span>
                <span className="gn-port-label gn-port-label--right" style={{ display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end" }}>
                  {isRoute ? (
                    <>
                      <span style={{ fontSize: "10px", opacity: 0.8 }}>{outDef.label}</span>
                      <input
                        type="text"
                        className="nodrag nowheel"
                        placeholder="Route intent..."
                        value={data.routeDescriptions?.[outDef.id] || ""}
                        onChange={(e) => {
                          const newRouteDesc = { ...(data.routeDescriptions || {}) };
                          newRouteDesc[outDef.id] = e.target.value;
                          updateNodeData(id, { routeDescriptions: newRouteDesc });
                        }}
                        style={{
                          width: "70px",
                          fontSize: "10px",
                          padding: "2px 4px",
                          background: "rgba(0,0,0,0.2)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "white",
                          borderRadius: "2px"
                        }}
                      />
                    </>
                  ) : (
                    outDef?.label ?? ""
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Editable field ── */}
      <div className="gn-field">
        {dynamicOptions && dynamicOptions.length > 0 ? (
          <select
            className="gn-textarea nodrag nowheel"
            value={data.fieldValue ?? ""}
            onChange={(e) => updateNodeData(id, { fieldValue: e.target.value })}
            style={{ appearance: "auto", cursor: "pointer" }}
            onFocus={() => {
              if (data.type === "custom_tool") {
                fetch("http://localhost:8001/api/tools")
                  .then(res => res.json())
                  .then(json => {
                    if (json.tools && json.tools.length > 0) {
                      setDynamicOptions([
                        { label: "Select a tool...", value: "" },
                        ...json.tools.map((t: any) => ({ label: t.name, value: t.name }))
                      ]);
                    }
                  }).catch(() => {});
              } else if (data.type === "external_tool") {
                fetch("http://localhost:8001/api/external-tools")
                  .then(res => res.json())
                  .then(json => {
                    if (json.tools && json.tools.length > 0) {
                      setDynamicOptions([
                        { label: "Select an external tool...", value: "" },
                        ...json.tools.map((t: any) => ({ label: t.name, value: t.name }))
                      ]);
                    } else {
                      setDynamicOptions([
                        { label: "Connect a provider first...", value: "" }
                      ]);
                    }
                  }).catch(() => {});
              }
            }}
          >
            {dynamicOptions.map((opt: any) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <textarea
            className="gn-textarea nodrag nowheel"
            value={data.fieldValue ?? ""}
            onChange={handleFieldChange}
            placeholder={placeholder}
            rows={2}
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
}

export default memo(GraphNode);

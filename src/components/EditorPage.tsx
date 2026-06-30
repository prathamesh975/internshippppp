import { useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type ReactFlowInstance,
} from "@xyflow/react";
import { useFlowStore } from "@/flowStore";
import { generateNodeId } from "@/utils";
import type { NodeTypeDef, GraphNodeData, GraphNode, GraphEdge } from "@/types";
import GraphNodeComponent from "./GraphNode";
import Sidebar from "./Sidebar";
import Toolbar from "./Toolbar";
import ChatPopup from "./ChatPopup";

const nodeTypes = { graphNode: GraphNodeComponent };

export default function EditorPage() {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const onNodesChange = useFlowStore((s) => s.onNodesChange);
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange);
  const onConnect = useFlowStore((s) => s.onConnect);
  const setReactFlowInstance = useFlowStore((s) => s.setReactFlowInstance);
  const addNode = useFlowStore((s) => s.addNode);
  const deleteSelected = useFlowStore((s) => s.deleteSelected);
  const executionState = useFlowStore((s) => s.executionState);
  const rf = useFlowStore((s) => s.reactFlowInstance);

  const [chatOpen, setChatOpen] = useState(false);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData("application/graphnode");
      if (!raw || !rf) return;

      const def: NodeTypeDef = JSON.parse(raw);
      const position = rf.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const newNode: GraphNode = {
        id: generateNodeId(def.type),
        type: "graphNode",
        position,
        data: {
          label: def.label,
          type: def.type,
          category: def.category,
          color: def.color,
          icon: def.icon,
          inputs: def.inputs,
          outputs: def.outputs,
          description: def.description,
          fieldValue: "",
          options: def.options,
        },
      };

      addNode(newNode);
    },
    [rf, addNode],
  );

  const onInit = useCallback(
    (instance: ReactFlowInstance<GraphNode, GraphEdge>) => setReactFlowInstance(instance),
    [setReactFlowInstance],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        deleteSelected();
      }
    },
    [deleteSelected],
  );
  console.log(nodes, edges, executionState);
  return (
    <div className="editor" onKeyDown={onKeyDown} tabIndex={0}>
      <Toolbar onTestFlow={() => setChatOpen(true)} />
      <div className="editor-body">
        <Sidebar />
        <div className="editor-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={onInit}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={null}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ animated: true, type: "default" }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="rgba(255,255,255,0.07)"
            />
            <Controls
              className="canvas-controls"
              showInteractive={false}
            />
            <MiniMap
              className="canvas-minimap"
              nodeColor={(n) => {
                const data = n.data as GraphNodeData;
                return data?.color ?? "#71717a";
              }}
              maskColor="rgba(0,0,0,0.7)"
              pannable
              zoomable
            />
          </ReactFlow>
        </div>
      </div>

      {/* Chat popup */}
      <ChatPopup open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );

}

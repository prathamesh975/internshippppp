import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import { create } from "zustand";
import type { GraphNode, GraphEdge } from "@/types";

export interface TraceEvent {
  node: string;
  type: string;
  summary: string;
  output?: any;
  input?: any;
  schema?: any;
}

interface FlowState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  reactFlowInstance: ReactFlowInstance<GraphNode, GraphEdge> | null;

  activeNodes: string[];
  nodeResults: Record<string, any>;
  traces: any[];
  executionState: 'idle' | 'running' | 'paused';
  sessionId: string;
  resumeStream: () => void;

  setNodes: (
    change: GraphNode[] | ((prev: GraphNode[]) => GraphNode[]),
  ) => void;
  setEdges: (
    change: GraphEdge[] | ((prev: GraphEdge[]) => GraphEdge[]),
  ) => void;
  setActiveNodes: (nodes: string[]) => void;
  setNodeResult: (nodeId: string, result: any) => void;
  addTrace: (newTraces: any[]) => void;
  clearNodeResults: () => void;
  setExecutionState: (state: 'idle' | 'running' | 'paused') => void;
  setSessionId: (id: string) => void;
  setResumeStream: (fn: () => void) => void;
  
  onNodesChange: (changes: NodeChange<GraphNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<GraphEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  setReactFlowInstance: (instance: ReactFlowInstance<GraphNode, GraphEdge> | null) => void;
  addNode: (node: GraphNode) => void;
  updateNodeField: (nodeId: string, value: string) => void;
  deleteSelected: () => void;
  clearCanvas: () => void;
  loadFlow: (
    nodes: GraphNode[],
    edges: GraphEdge[],
    viewport?: { x: number; y: number; zoom: number },
  ) => void;
}

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: [],
  edges: [],
  reactFlowInstance: null,
  activeNodes: [],
  nodeResults: {},
  traces: [],
  executionState: 'idle',
  sessionId: "session-" + Date.now(),
  resumeStream: () => {},

  setActiveNodes: (nodes) => set({ activeNodes: nodes }),
  setNodeResult: (nodeId, result) => set({ nodeResults: { ...get().nodeResults, [nodeId]: result } }),
  addTrace: (newTraces) => set({ traces: [...get().traces, ...newTraces] }),
  clearNodeResults: () => set({ nodeResults: {}, activeNodes: [], traces: [], executionState: 'idle' }),
  setExecutionState: (state) => set({ executionState: state }),
  setSessionId: (id) => set({ sessionId: id }),
  setResumeStream: (fn) => set({ resumeStream: fn }),

  setNodes: (change) => {
    const next = typeof change === "function" ? change(get().nodes) : change;
    set({ nodes: next });
  },

  setEdges: (change) => {
    const next = typeof change === "function" ? change(get().edges) : change;
    set({ edges: next });
  },

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    set({
      edges: addEdge(
        { ...connection, type: "default", animated: true },
        get().edges,
      ),
    });
  },

  setReactFlowInstance: (instance) => set({ reactFlowInstance: instance }),

  addNode: (node) => set({ nodes: [...get().nodes, node] }),

  updateNodeField: (nodeId, value) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, fieldValue: value } } : n,
      ),
    });
  },

  deleteSelected: () => {
    const selectedNodeIds = new Set(
      get()
        .nodes.filter((n) => n.selected)
        .map((n) => n.id),
    );
    const selectedEdgeIds = new Set(
      get()
        .edges.filter((e) => e.selected)
        .map((e) => e.id),
    );
    set({
      nodes: get().nodes.filter((n) => !selectedNodeIds.has(n.id)),
      edges: get().edges.filter(
        (e) =>
          !selectedEdgeIds.has(e.id) &&
          !selectedNodeIds.has(e.source) &&
          !selectedNodeIds.has(e.target),
      ),
    });
  },

  clearCanvas: () => set({ nodes: [], edges: [] }),

  loadFlow: (nodes, edges, viewport) => {
    set({ nodes, edges });
    if (viewport) {
      setTimeout(() => get().reactFlowInstance?.setViewport(viewport), 50);
    }
  },
}));

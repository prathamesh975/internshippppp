import { create } from "zustand";
import { nanoid } from "nanoid";
import type { SavedFlow, GraphNode, GraphEdge } from "@/types";

type View = "home" | "editor";

interface AppState {
  view: View;
  currentFlowId: string | null;
  currentFlowName: string;
  savedFlows: SavedFlow[];

  setView: (view: View) => void;
  setCurrentFlowName: (name: string) => void;
  loadSavedFlows: () => void;
  saveFlow: (data: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    viewport: { x: number; y: number; zoom: number };
  }) => void;
  deleteFlow: (id: string) => void;
  createNewFlow: () => void;
  openFlow: (id: string) => SavedFlow | undefined;
  
  // Versioning
  activeVersionId: string | null;
  setActiveVersionId: (id: string | null) => void;
  publishVersion: (
    versionName: string,
    nodes: GraphNode[],
    edges: GraphEdge[],
    viewport: { x: number; y: number; zoom: number }
  ) => void;
  restoreVersionToDraft: (versionId: string) => SavedFlow | undefined;
}

const STORAGE_KEY = "graph-builder-flows";

function readStorage(): SavedFlow[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeStorage(flows: SavedFlow[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(flows));
}

export const useAppStore = create<AppState>((set, get) => ({
  view: "home",
  currentFlowId: null,
  currentFlowName: "Untitled Flow",
  savedFlows: [],
  activeVersionId: null,

  setView: (view) => set({ view }),
  setCurrentFlowName: (name) => set({ currentFlowName: name }),
  setActiveVersionId: (id) => set({ activeVersionId: id }),

  loadSavedFlows: () => set({ savedFlows: readStorage() }),

  saveFlow: ({ nodes, edges, viewport }) => {
    const now = new Date().toISOString();
    const flows = readStorage();
    const id = get().currentFlowId;
    const name = get().currentFlowName;
    const idx = flows.findIndex((f) => f.id === id);

    const entry: SavedFlow = {
      id: id || nanoid(),
      name,
      nodes,
      edges,
      viewport,
      createdAt: idx >= 0 ? flows[idx].createdAt : now,
      updatedAt: now,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      versions: idx >= 0 ? flows[idx].versions : [],
    };

    if (idx >= 0) {
      flows[idx] = entry;
    } else {
      flows.unshift(entry);
    }

    writeStorage(flows);
    set({ savedFlows: flows, currentFlowId: entry.id });
  },

  deleteFlow: (id) => {
    const flows = readStorage().filter((f) => f.id !== id);
    writeStorage(flows);
    set({ savedFlows: flows });
  },

  publishVersion: (versionName, nodes, edges, viewport) => {
    const flows = readStorage();
    const id = get().currentFlowId;
    if (!id) return;

    const idx = flows.findIndex((f) => f.id === id);
    if (idx < 0) return;

    const flow = flows[idx];
    const newVersion = {
      id: nanoid(),
      name: versionName,
      nodes,
      edges,
      viewport,
      publishedAt: new Date().toISOString(),
    };

    flow.versions = flow.versions || [];
    flow.versions.push(newVersion);
    writeStorage(flows);
    set({ savedFlows: flows, activeVersionId: newVersion.id });
  },

  restoreVersionToDraft: (versionId) => {
    const flows = readStorage();
    const id = get().currentFlowId;
    if (!id) return;

    const idx = flows.findIndex((f) => f.id === id);
    if (idx < 0) return;

    const flow = flows[idx];
    const version = (flow.versions || []).find((v) => v.id === versionId);
    if (!version) return;

    flow.nodes = version.nodes;
    flow.edges = version.edges;
    flow.viewport = version.viewport;
    flow.updatedAt = new Date().toISOString();
    flow.nodeCount = version.nodes.length;
    flow.edgeCount = version.edges.length;

    writeStorage(flows);
    set({
      savedFlows: flows,
      activeVersionId: null, 
    });
    return flow;
  },

  createNewFlow: () => {
    set({
      currentFlowId: nanoid(),
      currentFlowName: "Untitled Flow",
      view: "editor",
      activeVersionId: null,
    });
  },

  openFlow: (id) => {
    const flows = readStorage();
    const flow = flows.find((f) => f.id === id);
    if (flow) {
      set({
        currentFlowId: flow.id,
        currentFlowName: flow.name,
        view: "editor",
        activeVersionId: null,
      });
    }
    return flow;
  },
}));

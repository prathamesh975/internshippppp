import type { Node, Edge } from "@xyflow/react";

/* ── Node type definition (palette items) ── */

export interface PortDef {
  id: string;
  label: string;
  type: string;
}

export interface NodeTypeDef {
  type: string;
  label: string;
  category: string;
  categoryLabel: string;
  icon: string;
  color: string;
  inputs: PortDef[];
  outputs: PortDef[];
  description: string;
  options?: { label: string; value: string }[];
  routeDescriptions?: Record<string, string>;
}


export interface GraphNodeData extends Record<string, unknown> {
  label: string;
  type: string;
  category: string;
  color: string;
  icon: string;
  inputs: PortDef[];
  outputs: PortDef[];
  description?: string;
  fieldValue?: string;
  options?: { label: string; value: string }[];
  breakpoint?: boolean;
  routeDescriptions?: Record<string, string>;
}

export type GraphNode = Node<GraphNodeData, "graphNode">;
export type GraphEdge = Edge;

/* ── Persisted flow ── */

export interface PublishedVersion {
  id: string;
  name: string; // e.g. "v1", "v2"
  nodes: GraphNode[];
  edges: GraphEdge[];
  viewport: { x: number; y: number; zoom: number };
  publishedAt: string;
}

export interface SavedFlow {
  id: string;
  name: string;
  nodes: GraphNode[]; // The current working draft
  edges: GraphEdge[]; // The current working draft
  viewport: { x: number; y: number; zoom: number };
  createdAt: string;
  updatedAt: string;
  nodeCount: number;
  edgeCount: number;
  versions?: PublishedVersion[]; // Optional for backwards compatibility
}

/* ── Export payload (what the backend receives) ── */

export interface GraphExport {
  nodes: GraphNode[];
  edges: GraphEdge[];
  viewport: { x: number; y: number; zoom: number };
  metadata: {
    name: string;
    exportedAt: string;
    version: string;
  };
}

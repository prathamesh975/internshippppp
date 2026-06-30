import { nanoid } from "nanoid";
import type { GraphExport, GraphNode, GraphEdge } from "@/types";

/** Generate a unique node ID prefixed by its type. */
export function generateNodeId(type: string): string {
  return `${type}-${nanoid(8)}`;
}

/** Human-readable date string. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Download an object as a .json file. */
export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Build the export payload that the backend will consume. */
export function buildExportPayload(
  name: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  viewport: { x: number; y: number; zoom: number },
): GraphExport {
  return {
    nodes,
    edges,
    viewport,
    metadata: {
      name,
      exportedAt: new Date().toISOString(),
      version: "1.0.0",
    },
  };
}

/** Read a JSON file from an input event and return parsed object. */
export function readJsonFile<T = unknown>(file: File): Promise<T> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result as string));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

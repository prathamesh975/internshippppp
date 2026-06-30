import type { NodeTypeDef } from "@/types";


export const NODE_CATEGORIES: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  inputs: { label: "Inputs", color: "#10b981", icon: "ArrowDownToLine" },
  outputs: { label: "Outputs", color: "#3b82f6", icon: "ArrowUpFromLine" },
  ai: { label: "AI", color: "#8b5cf6", icon: "Sparkles" },
  logic: { label: "Logic", color: "#f59e0b", icon: "GitBranch" },
  tools: { label: "Tools", color: "#06b6d4", icon: "Wrench" },
  external: { label: "External", color: "#f97316", icon: "Plug" },
};


export const NODE_TYPES: NodeTypeDef[] = [
  {
    type: "text_input",
    label: "Text Input",
    category: "inputs",
    categoryLabel: "Inputs",
    icon: "Type",
    color: "#10b981",
    inputs: [],
    outputs: [{ id: "output", label: "Text", type: "string" }],
    description: "Text entry point",
  },
  {
    type: "chat_input",
    label: "Chat Input",
    category: "inputs",
    categoryLabel: "Inputs",
    icon: "MessageCircle",
    color: "#10b981",
    inputs: [],
    outputs: [{ id: "output", label: "Message", type: "string" }],
    description: "Chat message input",
  },
  {
    type: "file_input",
    label: "File Input",
    category: "inputs",
    categoryLabel: "Inputs",
    icon: "FileText",
    color: "#10b981",
    inputs: [],
    outputs: [{ id: "output", label: "File Data", type: "file" }],
    description: "File upload",
  },

  {
    type: "text_output",
    label: "Text Output",
    category: "outputs",
    categoryLabel: "Outputs",
    icon: "MessageSquare",
    color: "#3b82f6",
    inputs: [{ id: "input", label: "Text", type: "string" }],
    outputs: [],
    description: "Display text result",
  },
  {
    type: "chat_output",
    label: "Chat Output",
    category: "outputs",
    categoryLabel: "Outputs",
    icon: "MessagesSquare",
    color: "#3b82f6",
    inputs: [{ id: "input", label: "Message", type: "string" }],
    outputs: [],
    description: "Chat response display",
  },
  {
    type: "end",
    label: "End",
    category: "outputs",
    categoryLabel: "Outputs",
    icon: "CircleStop",
    color: "#ef4444",
    inputs: [{ id: "input", label: "Final", type: "any" }],
    outputs: [],
    description: "Flow termination point",
  },

  {
    type: "prompt",
    label: "Prompt",
    category: "ai",
    categoryLabel: "AI",
    icon: "MessageSquareText",
    color: "#8b5cf6",
    inputs: [
      { id: "context", label: "Context", type: "string" },
      { id: "variables", label: "Variables", type: "object" },
    ],
    outputs: [{ id: "output", label: "Prompt", type: "string" }],
    description: "Prompt template",
  },
  {
    type: "agent",
    label: "Agent",
    category: "ai",
    categoryLabel: "AI",
    icon: "Bot",
    color: "#8b5cf6",
    inputs: [
      { id: "input", label: "Input", type: "string" },
      { id: "prompt", label: "Prompt", type: "string" },
      { id: "tools", label: "Tools", type: "array" },
      { id: "memory", label: "Memory", type: "object" },
    ],
    outputs: [{ id: "response", label: "Response", type: "string" }],
    description: "AI agent with tools",
  },
  {
    type: "chain",
    label: "Chain",
    category: "ai",
    categoryLabel: "AI",
    icon: "Link",
    color: "#8b5cf6",
    inputs: [
      { id: "input", label: "Input", type: "string" },
      { id: "prompt", label: "Prompt", type: "string" },
    ],
    outputs: [{ id: "output", label: "Output", type: "string" }],
    description: "Sequential chain",
  },
  {
    type: "orchestrator_agent",
    label: "Orchestrator Agent",
    category: "ai",
    categoryLabel: "AI",
    icon: "Split",
    color: "#8b5cf6",
    inputs: [
      { id: "input", label: "Input", type: "string" },
      { id: "prompt", label: "Prompt", type: "string" },
      { id: "tools", label: "Tools", type: "array" },
    ],
    outputs: [
      { id: "route_1", label: "Route 1", type: "any" },
      { id: "route_2", label: "Route 2", type: "any" },
    ],
    description: "Coordinates parallel execution",
  },
  {
    type: "aggregator_agent",
    label: "Aggregator Agent",
    category: "ai",
    categoryLabel: "AI",
    icon: "Merge",
    color: "#8b5cf6",
    inputs: [
      { id: "input", label: "Input", type: "any" },
      { id: "prompt", label: "Prompt", type: "string" },
    ],
    outputs: [{ id: "response", label: "Response", type: "string" }],
    description: "Aggregates parallel branches",
  },

  /* ─ Logic ─ */
  {
    type: "condition",
    label: "Condition",
    category: "logic",
    categoryLabel: "Logic",
    icon: "GitBranch",
    color: "#f59e0b",
    inputs: [{ id: "input", label: "Input", type: "any" }],
    outputs: [
      { id: "true_out", label: "True", type: "any" },
      { id: "false_out", label: "False", type: "any" },
    ],
    description: "Conditional branch",
  },
  {
    type: "router",
    label: "Router",
    category: "logic",
    categoryLabel: "Logic",
    icon: "Split",
    color: "#f59e0b",
    inputs: [{ id: "input", label: "Input", type: "any" }],
    outputs: [
      { id: "route_a", label: "Route A", type: "any" },
      { id: "route_b", label: "Route B", type: "any" },
      { id: "route_c", label: "Route C", type: "any" },
    ],
    description: "Multi-path routing",
  },
  {
    type: "merger",
    label: "Merger",
    category: "logic",
    categoryLabel: "Logic",
    icon: "Merge",
    color: "#f59e0b",
    inputs: [
      { id: "input_a", label: "Input A", type: "any" },
      { id: "input_b", label: "Input B", type: "any" },
    ],
    outputs: [{ id: "output", label: "Merged", type: "any" }],
    description: "Merge inputs",
  },

  /* ─ Tools ─ */
  {
    type: "api_call",
    label: "API Call",
    category: "tools",
    categoryLabel: "Tools",
    icon: "Globe",
    color: "#06b6d4",
    inputs: [{ id: "request", label: "Request", type: "object" }],
    outputs: [{ id: "response", label: "Response", type: "object" }],
    description: "HTTP request",
  },
  {
    type: "search",
    label: "Search",
    category: "tools",
    categoryLabel: "Tools",
    icon: "Search",
    color: "#06b6d4",
    inputs: [{ id: "query", label: "Query", type: "string" }],
    outputs: [{ id: "results", label: "Results", type: "array" }],
    description: "Search tool",
  },
  {
    type: "custom_tool",
    label: "Core Tools",
    category: "tools",
    categoryLabel: "Tools",
    icon: "Wrench",
    color: "#06b6d4",
    inputs: [{ id: "input", label: "Input", type: "any" }],
    outputs: [{ id: "output", label: "Output", type: "any" }],
    description: "Custom integration",
    options: [
      { label: "Select a tool...", value: "" },
      { label: "Get Patient Info", value: "get-patient-info" },
      { label: "Get Lab Results", value: "get-lab-results" },
      { label: "Get Medications", value: "get-medications" },
      { label: "Get Doctors", value: "get-doctors" },
      { label: "Check Availability", value: "check-availability" },
      { label: "Book Appointment", value: "book-appointment" }
    ]
  },

  /* ─ External (MCP providers) ─ */
  {
    type: "external_tool",
    label: "External Tool",
    category: "external",
    categoryLabel: "External",
    icon: "Plug",
    color: "#f97316",
    inputs: [{ id: "input", label: "Input", type: "any" }],
    outputs: [{ id: "output", label: "Output", type: "any" }],
    description: "MCP tool from GitHub, HuggingFace, etc.",
    options: [
      { label: "Connect a provider first...", value: "" },
    ]
  },
];

/* ── Grouped by category (for the sidebar) ── */

export const NODE_TYPES_BY_CATEGORY = NODE_TYPES.reduce(
  (acc, node) => {
    if (!acc[node.category]) acc[node.category] = [];
    acc[node.category].push(node);
    return acc;
  },
  {} as Record<string, NodeTypeDef[]>,
);

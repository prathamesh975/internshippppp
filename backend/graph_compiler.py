from typing import Any, Callable, Dict, List, TypedDict, Annotated
import json
import operator
from collections import defaultdict
from pydantic import BaseModel, Field

from langgraph.graph import END, StateGraph, START
from langgraph.prebuilt import create_react_agent
from langchain_aws import ChatBedrockConverse
import os
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "DocumentPredictionHandler"))
from langgraph_flow_demo.tools import TOOL_REGISTRY

class RouterDecision(BaseModel):
    route_id: str = Field(description="The ID of the route to take")

class OrchestratorDecision(BaseModel):
    route_ids: List[str] = Field(description="The IDs of the routes to take")

def merge_dicts(a: dict, b: dict):
    if not a: return b
    if not b: return a
    c = a.copy()
    c.update(b)
    return c

def keep_last(a: Any, b: Any):
    return b if b is not None else a

class FlowState(TypedDict, total=False):
    """The state that gets passed around the LangGraph nodes."""
    messages: List[Dict[str, str]]  
    values: Annotated[Dict[str, Any], merge_dicts]  
    trace: Annotated[List[Dict[str, Any]], operator.add]  
    final_response: Annotated[Any, keep_last]             

class DynamicGraphCompiler:
    def __init__(self, graph_json: Dict[str, Any], bedrock_client):
        self.flow = graph_json
        self.nodes = {node["id"]: node for node in self.flow.get("nodes", [])}
        self.edges = self.flow.get("edges", [])
        self.bedrock_client = bedrock_client
        
        # adjacency lists logcis
        self.incoming = defaultdict(list)
        self.outgoing = defaultdict(list)
        for edge in self.edges:
            self.incoming[edge["target"]].append(edge)
            self.outgoing[edge["source"]].append(edge)
        self.model = ChatBedrockConverse(
            model_id="us.anthropic.claude-haiku-4-5-20251001-v1:0",
            client=self.bedrock_client,
            max_tokens=4000,
            temperature=0.0,
        )

    def compile(self, checkpointer=None) -> Any:
        """Compiles the frontend graph into a runnable LangGraph StateGraph."""
        builder = StateGraph(FlowState)
        
        if not self.nodes:
            raise ValueError("Graph has no nodes.")
        for node_id in self.nodes:
            builder.add_node(node_id, self._create_node_func(node_id))
        indegree = {node_id: 0 for node_id in self.nodes}
        for edge in self.edges:
            indegree[edge["target"]] += 1
            
        start_nodes = [nid for nid, deg in indegree.items() if deg == 0]
        
        if not start_nodes:
            raise ValueError("Graph has no entry points (possible cycle with no inputs).")
        router_nodes = [n for n in self.nodes.values() if n.get("data", {}).get("type") in ("router", "orchestrator_agent")]
        router_ids = {n["id"] for n in router_nodes}

        for edge in self.edges:
            if edge["source"] not in router_ids:
                builder.add_edge(edge["source"], edge["target"])

        for router in router_nodes:
            r_id = router["id"]
            
            def make_condition(router_id, edges):
                def condition_func(state: FlowState):
                    decision = state["values"].get(f"{router_id}_decision")
                    if not decision: return END
                    
                    if isinstance(decision, list):
                        targets = []
                        for route in decision:
                            for e in edges:
                                if e["sourceHandle"] == route:
                                    targets.append(e["target"])
                        return targets if targets else END
                    else:
                        for e in edges:
                            if e["sourceHandle"] == decision:
                                return e["target"]
                        return END
                return condition_func
                
            r_edges = [e for e in self.edges if e["source"] == r_id]
            builder.add_conditional_edges(r_id, make_condition(r_id, r_edges))

        if len(start_nodes) == 1:
            builder.add_edge(START, start_nodes[0])
        else:
            async def broadcast_start(state: FlowState) -> FlowState:
                return state
            builder.add_node("_entry_point_", broadcast_start)
            builder.add_edge(START, "_entry_point_")
            for nid in start_nodes:
                builder.add_edge("_entry_point_", nid)

        # visual breakpoints from the canvas
        breakpoints = []
        for nid, node in self.nodes.items():
            if node.get("data", {}).get("breakpoint"):
                breakpoints.append(nid)

        return builder.compile(checkpointer=checkpointer, interrupt_before=breakpoints)

    def _create_node_func(self, node_id: str) -> Callable[[FlowState], FlowState]:
        """Creates an async function for a specific LangGraph node."""
        async def runner(state: FlowState) -> FlowState:
            node = self.nodes[node_id]
            data = node.get("data", {})
            node_type = data.get("type", "unknown")
            label = data.get("label", node_type)
            field_value = data.get("fieldValue", data.get("selectedOption", data.get("toolName", "")))
            
            values = dict(state.get("values", {}))
            trace = []
            messages = list(state.get("messages", []))
            final_response = state.get("final_response")
            
            summary = "Executed node"
            result: Any = None
            input_payload: Any = None
            schema_payload: Any = None

            if node_type in ("text_input", "chat_input", "file_input"):
                user_msg = ""
                if messages and messages[-1].get("role") == "user":
                    user_msg = messages[-1].get("content", "")
                
                result = user_msg or field_value
                input_payload = result
                summary = "Processed user input"

            elif node_type == "prompt":
                context_parts = []
                for edge in self.incoming[node_id]:
                    source_val = values.get(edge["source"])
                    if source_val:
                        context_parts.append(str(source_val))
                
                combined_context = "\\n".join(context_parts)
                prompt_template = field_value or "Summarize the context."
                result = f"System Instructions:\\n{prompt_template}\\n\\nContext:\\n{combined_context}"
                input_payload = combined_context
                schema_payload = prompt_template
                summary = "Rendered prompt template"

            elif node_type in ("custom_tool", "api_call", "search"):
                result = field_value.strip()
                schema_payload = result
                summary = f"Passed tool: {result}"

            elif node_type == "external_tool":
                tool_name = field_value.strip()
                if not tool_name:
                    result = "No external tool selected"
                    summary = "External tool: none selected"
                else:
                    from mcp_manager import get_external_tool_by_name
                    ext_tool = get_external_tool_by_name(tool_name)
                    if ext_tool:
                        tool_input = ""
                        for edge in self.incoming[node_id]:
                            if edge.get("targetHandle") == "input":
                                tool_input = str(values.get(edge["source"], ""))
                        
                        try:
                            tool_result = await ext_tool.ainvoke({"input": tool_input} if tool_input else {})
                            result = str(tool_result)
                            input_payload = tool_input
                            schema_payload = tool_name
                            summary = f"Invoked external tool: {tool_name}"
                        except Exception as e:
                            result = f"External tool error: {str(e)}"
                            summary = f"External tool failed: {tool_name}"
                    else:
                        result = f"External tool '{tool_name}' not found. Is the provider connected?"
                        summary = f"External tool not found: {tool_name}"

            elif node_type == "agent" or node_type == "chain":
                agent_input = ""
                system_prompt = ""
                tool_names = []
                
                for edge in self.incoming[node_id]:
                    if edge.get("targetHandle") == "input":
                        agent_input = str(values.get(edge["source"], ""))
                    elif edge.get("targetHandle") == "prompt":
                        system_prompt = str(values.get(edge["source"], ""))
                    elif edge.get("targetHandle") == "tools":
                        val = values.get(edge["source"])
                        if isinstance(val, list):
                            tool_names.extend([str(v).strip() for v in val])
                        elif val:
                            tool_names.append(str(val).strip())
                
                if not agent_input and messages:
                    agent_input = messages[-1].get("content", "")
                if not system_prompt:
                    system_prompt = field_value or "You are a helpful AI assistant."

                import mcp_manager
                bound_tools = []
                print(f"[DEBUG GRAPH_COMPILER] Node {node_id} received tool_names from UI: {tool_names}")
                for name in tool_names:
                    if name in TOOL_REGISTRY:
                        bound_tools.append(TOOL_REGISTRY[name])
                        print(f"[DEBUG GRAPH_COMPILER] Found '{name}' in TOOL_REGISTRY")
                    else:
                        ext_tool = mcp_manager.get_external_tool_by_name(name)
                        if ext_tool:
                            bound_tools.append(ext_tool)
                            print(f"[DEBUG GRAPH_COMPILER] Found '{name}' in external providers")
                        else:
                            print(f"[DEBUG GRAPH_COMPILER] WARNING: Tool '{name}' not found anywhere!")

                print(f"[DEBUG GRAPH_COMPILER] Final bound_tools length: {len(bound_tools)}")

                try:
                    if bound_tools:
                        agent = create_react_agent(self.model, tools=bound_tools, prompt=system_prompt)
                        invoke_msgs = []
                        for m in messages:
                            invoke_msgs.append(m)
                        if agent_input and (not invoke_msgs or invoke_msgs[-1].get("content") != agent_input):
                            invoke_msgs.append({"role": "user", "content": agent_input})
                        if not invoke_msgs:
                            invoke_msgs = [{"role": "user", "content": "Hello"}]
                            
                        response = await agent.ainvoke({"messages": invoke_msgs})
                        result = response["messages"][-1].content
                        input_payload = agent_input or "Hello"
                        schema_payload = str(tool_names)
                        summary = f"Invoked ReAct Agent with {len(bound_tools)} tools"
                    else:
                        invoke_msgs = []
                        if system_prompt:
                            invoke_msgs.append(("system", system_prompt))
                        if agent_input:
                            invoke_msgs.append(("human", agent_input))
                        else:
                            invoke_msgs.append(("human", "Hello"))

                        response = await self.model.ainvoke(invoke_msgs)
                        result = response.content
                        summary = "Invoked AI model (Haiku) directly"
                except Exception as e:
                    result = f"Error calling model: {str(e)}"
                    summary = "Model invocation failed"

            elif node_type in ("router", "orchestrator_agent"):
                agent_input = ""
                system_prompt = ""
                for edge in self.incoming[node_id]:
                    if edge.get("targetHandle") == "input":
                        agent_input = str(values.get(edge["source"], ""))
                    elif edge.get("targetHandle") == "prompt":
                        system_prompt = str(values.get(edge["source"], ""))
                
                if not agent_input and messages:
                    agent_input = messages[-1].get("content", "")
                
                route_descs = data.get("routeDescriptions", {})
                route_text = "\\n".join([f"- {rid}: {desc}" for rid, desc in route_descs.items() if desc.strip()])
                if not route_text:
                    route_text = "No descriptions provided. Route dynamically."
                    
                prompt = system_prompt or field_value or "Decide which routes to take."
                full_prompt = f"{prompt}\\n\\nAvailable Routes:\\n{route_text}\\n\\nBased on the user input, choose the appropriate route{'s' if node_type == 'orchestrator_agent' else ''}. If no routes are applicable, you may return an empty list."
                
                schema = RouterDecision if node_type == "router" else OrchestratorDecision
                llm = self.model.with_structured_output(schema)
                
                try:
                    response = await llm.ainvoke([("system", full_prompt), ("human", agent_input or "Hello")])
                    if node_type == "router":
                        decision = response.route_id
                    else:
                        decision = response.route_ids
                    
                    values[f"{node_id}_decision"] = decision
                    # passes the output
                    result = agent_input or "Hello"
                    
                    input_payload = agent_input or "Hello"
                    schema_payload = str(schema.__name__)
                    summary = f"Routed to {decision}"
                except Exception as e:
                    values[f"{node_id}_decision"] = [] if node_type == "orchestrator_agent" else ""
                    result = agent_input or "Hello"
                    summary = f"Routing error: {str(e)}"

            elif node_type == "aggregator_agent":
                aggregated_inputs = []
                system_prompt = ""
                
                for edge in self.incoming[node_id]:
                    if edge.get("targetHandle") == "prompt":
                        system_prompt = str(values.get(edge["source"], ""))
                    else:
                        #for aggregation
                        val = values.get(edge["source"])
                        if val is not None:
                            # Use source node's label for context
                            source_label = self.nodes[edge["source"]].get("data", {}).get("label", "Branch")
                            aggregated_inputs.append(f"--- From {source_label} ---\\n{val}")
                
                combined_input = "\\n\\n".join(aggregated_inputs)
                if not system_prompt:
                    system_prompt = field_value or "You are an Aggregator. Summarize and combine the following parallel branch results into a cohesive final output."

                try:
                    response = await self.model.ainvoke([
                        ("system", system_prompt),
                        ("human", f"Parallel Results to Aggregate:\\n{combined_input}")
                    ])
                    result = response.content
                    input_payload = combined_input
                    schema_payload = system_prompt
                    summary = f"Aggregated {len(aggregated_inputs)} branches"
                except Exception as e:
                    result = f"Error: {str(e)}"
                    summary = "Aggregator error"

            elif node_type == "condition":
                condition_input = ""
                for edge in self.incoming[node_id]:
                    if edge.get("targetHandle") == "input":
                        condition_input = str(values.get(edge["source"], "")).strip()

                expected_val = str(field_value).strip()
                is_true = (condition_input == expected_val)
                result = {
                    "true_out": condition_input if is_true else None,
                    "false_out": condition_input if not is_true else None
                }
                input_payload = condition_input
                schema_payload = f"Expected: {expected_val}"
                summary = f"Condition evaluated to {is_true}"

            elif node_type in ("text_output", "chat_output", "end"):
                branch_taken = True
                val = None
                has_incoming = len(self.incoming[node_id]) > 0
                
                if has_incoming:
                    branch_taken = False
                    for edge in self.incoming[node_id]:
                        source_val = values.get(edge["source"])
                        
                        if isinstance(source_val, dict) and edge.get("sourceHandle") in source_val:
                            val = source_val.get(edge["sourceHandle"])
                        else:
                            val = source_val
                            
                        if val is not None:
                            branch_taken = True
                            break

                if branch_taken:
                    if str(field_value).strip():
                        result = field_value
                    else:
                        result = val
                        
                    final_response = result
                    summary = "Set final output"
                else:
                    summary = "Branch not taken (condition false)"

            else:
                result = f"Passthrough: {field_value}"
                summary = f"Skipped unimplemented node type: {node_type}"

            values[node_id] = result
            trace.append({
                "node": label,
                "type": node_type,
                "summary": summary,
                "input": str(input_payload) if input_payload is not None else None,
                "schema": str(schema_payload) if schema_payload is not None else None,
                "output": str(result) if result is not None else None
            })

            return {
                "values": {node_id: result},
                "trace": trace,
                "final_response": final_response
            }

        return runner

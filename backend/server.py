from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
import json
from langgraph.checkpoint.memory import MemorySaver
import asyncio
import boto3
import os
import uvicorn
from botocore.config import Config
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from contextlib import asynccontextmanager

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), "DocumentPredictionHandler"))
from langgraph_flow_demo.tools import TOOL_REGISTRY, load_mcp_tools_into_registry

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Loading MCP tools...")
    await load_mcp_tools_into_registry()
    print("MCP tools loaded.")
    
    # Auto-reconnect external tool providers from persisted tokens
    from mcp_manager import auto_reconnect
    print("Auto-reconnecting external tools...")
    await auto_reconnect()
    print("External tools reconnection complete.")
    from api_tool_manager import register_all_api_tools
    print("Loading custom API tools...")
    register_all_api_tools()
    print("Custom API tools loaded.")
    from custom_mcp_manager import load_all_mcp_tools
    print("Loading custom MCP tools...")
    await load_all_mcp_tools()
    print("Custom MCP tools loaded.")
    yield

app = FastAPI(title="LangGraph Dynamic Backend", lifespan=lifespan)
from graph_compiler import DynamicGraphCompiler
from auth_routes import router as auth_router

app.include_router(auth_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    graph: Dict[str, Any]
    message: Optional[str] = None
    session_id: str = "default"
    resume: bool = False

memory_saver = MemorySaver()
REGION_NAME = "us-east-1"
RETRY_CONFIG = Config(
    region_name=REGION_NAME,
    retries={"max_attempts": 10, "mode": "adaptive"},)
bedrock_client = boto3.client(
    service_name="bedrock-runtime",
    region_name=REGION_NAME,
    config=RETRY_CONFIG,
)

PAUSED_SESSIONS = set()

@app.post("/api/chat/stream")
async def chat_stream_endpoint(request: ChatRequest):
    try:
        compiler = DynamicGraphCompiler(request.graph, bedrock_client)
        langgraph_app = compiler.compile(checkpointer=memory_saver)
        
        config = {"configurable": {"thread_id": request.session_id}}
        
        if request.resume:
            input_data = None
        else:
            input_data = {
                "messages": [{"role": "user", "content": request.message}],
                "values": {},
                "trace": [],
                "final_response": None
            }

        async def event_generator():
            try:
                async for event in langgraph_app.astream(input_data, stream_mode="updates", config=config):
                    for node_name, output in event.items():
                          # we yield the node upate
                        yield f"data: {json.dumps({'type': 'node_update', 'node': node_name, 'output': output})}\n\n"
                        #sleepp
                        await asyncio.sleep(0.3)
                    
                    if request.session_id in PAUSED_SESSIONS:
                        PAUSED_SESSIONS.remove(request.session_id)
                        yield f"data: {json.dumps({'type': 'paused'})}\n\n"
                        break
                else:
                    state = langgraph_app.get_state(config)
                    if state.next:
                        yield f"data: {json.dumps({'type': 'paused'})}\n\n"
                    else:
                        # final output
                        values = state.values.get("values", {})
                        reply = values.get(list(values.keys())[-1]) if values else state.values.get("final_response")
                        yield f"data: {json.dumps({'type': 'end', 'reply': str(reply)})}\n\n"
            except Exception as e:
                import traceback
                traceback.print_exc()
                yield f"data: {json.dumps({'type': 'error', 'detail': str(e)})}\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat/pause")
async def pause_endpoint(body: dict):
    session_id = body.get("session_id", "default")
    PAUSED_SESSIONS.add(session_id)
    return {"status": "paused"}

@app.get("/api/tools")
async def get_tools_endpoint():
    tools = []
    for name, tool in TOOL_REGISTRY.items():
        tools.append({"name": name, "description": getattr(tool, "description", "")})
    return {"tools": tools}

import api_tool_manager

@app.get("/api/custom-tools")
async def get_custom_tools():
    return {"tools": api_tool_manager.get_all_api_tools()}

@app.post("/api/custom-tools")
async def create_custom_tool(config: dict):
    tool = api_tool_manager.create_api_tool(config)
    return {"tool": tool}

@app.put("/api/custom-tools/{tool_id}")
async def update_custom_tool(tool_id: str, config: dict):
    tool = api_tool_manager.update_api_tool(tool_id, config)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return {"tool": tool}

@app.delete("/api/custom-tools/{tool_id}")
async def delete_custom_tool(tool_id: str):
    success = api_tool_manager.delete_api_tool(tool_id)
    if not success:
        raise HTTPException(status_code=404, detail="Tool not found")
    return {"status": "success"}

import custom_mcp_manager

@app.get("/api/custom-mcp-tools")
async def get_custom_mcp_tools():
    return {"tools": custom_mcp_manager.load_mcp_configs()}

@app.post("/api/custom-mcp-tools")
async def create_custom_mcp_tool(config: dict):
    custom_mcp_manager.add_mcp_config(config)
    # Attempt to connect to the new MCP tool
    asyncio.create_task(custom_mcp_manager.connect_mcp_tool(config))
    return {"status": "success", "tool": config}

@app.delete("/api/custom-mcp-tools/{tool_name}")
async def delete_custom_mcp_tool(tool_name: str):
    custom_mcp_manager.delete_mcp_config(tool_name)
    return {"status": "success"}

from mcp_manager import get_tools_for_provider, get_all_external_tools
@app.get("/api/external-tools/{provider}/tools")
async def get_external_provider_tools(provider: str):
    return {"tools": get_tools_for_provider(provider)}

@app.get("/api/external-tools/all")
async def get_all_ext_tools():
    return {"tools": get_all_external_tools()}



if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)

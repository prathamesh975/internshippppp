"""
API Tool Manager — Create, persist, and execute user-defined REST API tools.

Each tool is a REST endpoint wrapper with configurable:
- HTTP method, URL, content type
- Auth (None, API Key, Bearer Token, Basic Auth)
- Headers, query params, body params
- Response parameter mapping
- Timeout and session config

Tools are persisted to ~/.graph-builder/api_tools.json and registered
into TOOL_REGISTRY at startup so LangGraph agents can invoke them.
"""

import json
import os
import sys
import uuid
import base64
import httpx
from pathlib import Path
from typing import Dict, List, Optional, Any
from langchain_core.tools import StructuredTool

TOOLS_DIR = Path.home() / ".graph-builder"
TOOLS_FILE = TOOLS_DIR / "api_tools.json"


def _ensure_dir():
    TOOLS_DIR.mkdir(parents=True, exist_ok=True)


def load_api_tools() -> List[Dict]:
    """Load all persisted API tool definitions."""
    _ensure_dir()
    if TOOLS_FILE.exists():
        try:
            return json.loads(TOOLS_FILE.read_text())
        except Exception:
            return []
    return []


def save_api_tools(tools: List[Dict]):
    """Persist all API tool definitions to disk."""
    _ensure_dir()
    TOOLS_FILE.write_text(json.dumps(tools, indent=2))


def create_api_tool(config: Dict) -> Dict:
    """Create and persist a new API tool. Returns the full config with generated ID."""
    tool_id = str(uuid.uuid4())[:8]
    config["id"] = tool_id
    config["status"] = "active"

    tools = load_api_tools()
    tools.append(config)
    save_api_tools(tools)

    _register_tool(config)

    return config


def update_api_tool(tool_id: str, config: Dict) -> Optional[Dict]:
    """Update an existing API tool by ID."""
    tools = load_api_tools()
    for i, t in enumerate(tools):
        if t["id"] == tool_id:
            config["id"] = tool_id
            config["status"] = t.get("status", "active")
            tools[i] = config
            save_api_tools(tools)

            _unregister_tool(tool_id)
            _register_tool(config)
            return config
    return None


def delete_api_tool(tool_id: str) -> bool:
    """Delete an API tool and unregister it."""
    tools = load_api_tools()
    new_tools = [t for t in tools if t["id"] != tool_id]
    if len(new_tools) == len(tools):
        return False

    save_api_tools(new_tools)
    _unregister_tool(tool_id)
    return True


def get_api_tool(tool_id: str) -> Optional[Dict]:
    """Get a single API tool by ID."""
    for t in load_api_tools():
        if t["id"] == tool_id:
            return t
    return None


def get_all_api_tools() -> List[Dict]:
    """Return all API tool configs (safe for frontend — masks secrets)."""
    tools = load_api_tools()
    safe_tools = []
    for t in tools:
        safe = {**t}
        if safe.get("apiKey"):
            safe["apiKey"] = "••••" + safe["apiKey"][-4:] if len(safe["apiKey"]) > 4 else "••••"
        if safe.get("bearerToken"):
            safe["bearerToken"] = "••••" + safe["bearerToken"][-4:] if len(safe["bearerToken"]) > 4 else "••••"
        if safe.get("basicPassword"):
            safe["basicPassword"] = "••••"
        safe_tools.append(safe)
    return safe_tools


def _build_auth_headers(config: Dict) -> Dict[str, str]:
    """Build static authentication headers based on auth type."""
    auth_type = config.get("authType", "no_auth")
    headers = {}

    if auth_type == "api_key":
        header_name = config.get("apiKeyHeader", "X-API-Key")
        api_key = config.get("apiKey", "")
        if api_key:
            headers[header_name] = api_key

    elif auth_type == "basic_auth":
        username = config.get("basicUsername", "")
        password = config.get("basicPassword", "")
        creds = base64.b64encode(f"{username}:{password}".encode()).decode()
        headers["Authorization"] = f"Basic {creds}"

    return headers


def _register_tool(config: Dict):
    """Create a LangChain StructuredTool from config and register into TOOL_REGISTRY."""
    sys.path.append(os.path.join(os.path.dirname(__file__), "DocumentPredictionHandler"))
    from langgraph_flow_demo.tools import TOOL_REGISTRY

    tool_name = config["name"].strip().replace(" ", "_").lower()
    description = config.get("description", "Custom API tool")
    url = config["url"]
    method = config.get("httpMethod", "GET").upper()
    content_type = config.get("contentType", "application/json")
    timeout = config.get("timeout", 30)
    session_required = config.get("sessionRequired", False)

    # Merge custom headers
    custom_headers = {}
    for h in config.get("headers", []):
        if h.get("key") and h.get("value"):
            custom_headers[h["key"]] = h["value"]

    auth_headers = _build_auth_headers(config)

    from pydantic import create_model, Field

    body_params = config.get("bodyParams", [])
    query_params = config.get("queryParams", [])
    path_params = config.get("pathParams", [])
    all_params = body_params + query_params + path_params

    param_doc = ""
    fields = {}
    if all_params:
        param_doc = "\n\nParameters:\n"
        for p in all_params:
            req = " (required)" if p.get("required") else ""
            param_doc += f"  - {p['name']}: {p.get('type', 'string')}{req} — {p.get('description', '')}\n"
            
            p_type_str = p.get("type", "string")
            if p_type_str == "integer":
                p_type = int
            elif p_type_str == "boolean":
                p_type = bool
            else:
                p_type = str
            
            is_req = bool(p.get("required", False))
            default_val = ... if is_req else p.get("defaultValue", None)
            
            if not is_req and p.get("defaultValue"):
                if p_type == int:
                    try:
                        default_val = int(p["defaultValue"])
                    except ValueError:
                        default_val = 0
                elif p_type == bool:
                    default_val = str(p["defaultValue"]).lower() in ("true", "1", "yes")
                else:
                    default_val = str(p["defaultValue"])
                    
            fields[p["name"]] = (p_type, Field(default=default_val, description=p.get("description", "")))
            
    if not fields:
        DynamicSchema = create_model("DynamicSchema")
    else:
        DynamicSchema = create_model("DynamicSchema", **fields)

    full_description = description + param_doc

    async def api_tool_func(**kwargs) -> str:
        """Execute the configured API call."""
        try:
            final_url = url
            for pp in path_params:
                if pp["name"] in kwargs:
                    final_url = final_url.replace(f"{{{pp['name']}}}", str(kwargs.pop(pp["name"])))

            q_params = {}
            b_params = {}
            q_names = {p["name"] for p in query_params}
            b_names = {p["name"] for p in body_params}

            for k, v in kwargs.items():
                if k in q_names:
                    q_params[k] = v
                elif k in b_names:
                    b_params[k] = v
                else:
                    if method in ("POST", "PUT", "PATCH"):
                        b_params[k] = v
                    else:
                        q_params[k] = v

            if session_required:
                b_params["session_id"] = kwargs.get("session_id", "default")

            merged_headers = {**custom_headers, **auth_headers}
            
            auth_type = config.get("authType", "no_auth")
            if auth_type == "bearer_token":
                token_url = config.get("bearerTokenUrl", "")
                token_user = config.get("bearerUsername", "")
                token_pass = config.get("bearerPassword", "")
                token_field = config.get("bearerTokenField", "access_token")
                
                if token_url:
                    async with httpx.AsyncClient(timeout=10) as t_client:
                        try:
                            t_auth = httpx.BasicAuth(token_user, token_pass) if token_user else None
                            t_resp = await t_client.post(token_url, auth=t_auth, data={"grant_type": "client_credentials"})
                            if not t_resp.is_success:
                                t_resp = await t_client.post(token_url, json={"username": token_user, "password": token_pass})
                                
                            t_resp.raise_for_status()
                            t_data = t_resp.json()
                            fetched_token = t_data.get(token_field)
                            if not fetched_token:
                                return json.dumps({"error": f"Token field '{token_field}' not found in response from {token_url}"})
                            merged_headers["Authorization"] = f"Bearer {fetched_token}"
                        except Exception as te:
                            return json.dumps({"error": f"Failed to fetch bearer token: {str(te)}"})

            if content_type and method in ("POST", "PUT", "PATCH"):
                merged_headers["Content-Type"] = content_type

            async with httpx.AsyncClient(timeout=timeout) as client:
                if method == "GET":
                    resp = await client.get(final_url, params=q_params, headers=merged_headers)
                elif method == "POST":
                    if content_type == "application/json":
                        resp = await client.post(final_url, json=b_params, params=q_params, headers=merged_headers)
                    else:
                        resp = await client.post(final_url, data=b_params, params=q_params, headers=merged_headers)
                elif method == "PUT":
                    resp = await client.put(final_url, json=b_params, params=q_params, headers=merged_headers)
                elif method == "DELETE":
                    resp = await client.delete(final_url, params=q_params, headers=merged_headers)
                elif method == "PATCH":
                    resp = await client.patch(final_url, json=b_params, params=q_params, headers=merged_headers)
                else:
                    return json.dumps({"error": f"Unsupported HTTP method: {method}"})

                # Parse response
                try:
                    data = resp.json()
                    
                    # Apply Response Parameters filtering if provided
                    response_params = config.get("responseParams", [])
                    if response_params and isinstance(data, dict):
                        filtered_data = {}
                        for p in response_params:
                            key = p.get("key")
                            if not key:
                                continue
                            
                            # Support dot notation (e.g. "data.users")
                            parts = key.split(".")
                            current = data
                            for part in parts:
                                if isinstance(current, dict) and part in current:
                                    current = current[part]
                                else:
                                    current = None
                                    break
                            
                            if current is not None:
                                filtered_data[key] = current
                        
                        if filtered_data:
                            return json.dumps(filtered_data, indent=2)
                            
                    return json.dumps(data, indent=2)
                except Exception:
                    return resp.text

        except httpx.TimeoutException:
            return json.dumps({"error": f"API call timed out after {timeout}s"})
        except Exception as e:
            return json.dumps({"error": f"API call failed: {str(e)}"})

    # Create LangChain tool
    tool = StructuredTool.from_function(
        coroutine=api_tool_func,
        name=tool_name,
        description=full_description,
        args_schema=DynamicSchema,
    )

    # Tag it so we can find it later for unregistration
    tool._api_tool_id = config["id"]

    TOOL_REGISTRY[tool_name] = tool
    print(f"[API TOOL] Registered: {tool_name} ({method} {url})")


def _unregister_tool(tool_id: str):
    """Remove a tool from TOOL_REGISTRY by its API tool ID."""
    sys.path.append(os.path.join(os.path.dirname(__file__), "DocumentPredictionHandler"))
    from langgraph_flow_demo.tools import TOOL_REGISTRY

    to_remove = []
    for name, tool in TOOL_REGISTRY.items():
        if hasattr(tool, "_api_tool_id") and tool._api_tool_id == tool_id:
            to_remove.append(name)

    for name in to_remove:
        del TOOL_REGISTRY[name]
        print(f"[API TOOL] Unregistered: {name}")


def register_all_api_tools():
    """Called at startup — loads all persisted API tools into TOOL_REGISTRY."""
    tools = load_api_tools()
    for config in tools:
        try:
            _register_tool(config)
        except Exception as e:
            print(f"[API TOOL] Failed to register '{config.get('name', '?')}': {e}")
    print(f"[API TOOL] Loaded {len(tools)} API tools from disk")

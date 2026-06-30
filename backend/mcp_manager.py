import json
import os
import asyncio
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Any
from langchain_core.tools import BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient

TOKENS_DIR = Path.home() / ".graph-builder"
TOKENS_FILE = TOKENS_DIR / "tokens.json"


def _ensure_dir():
    TOKENS_DIR.mkdir(parents=True, exist_ok=True)


def load_tokens() -> Dict[str, str]:
    """Load persisted OAuth tokens from disk."""
    _ensure_dir()
    if TOKENS_FILE.exists():
        try:
            return json.loads(TOKENS_FILE.read_text())
        except Exception:
            return {}
    return {}


def save_token(provider: str, token: str):
    """Persist an OAuth token for a provider."""
    _ensure_dir()
    tokens = load_tokens()
    tokens[provider] = token
    TOKENS_FILE.write_text(json.dumps(tokens, indent=2))


def remove_token(provider: str):
    """Remove a persisted token for a provider."""
    _ensure_dir()
    tokens = load_tokens()
    tokens.pop(provider, None)
    TOKENS_FILE.write_text(json.dumps(tokens, indent=2))


def get_token(provider: str) -> Optional[str]:
    """Get a persisted token for a provider."""
    return load_tokens().get(provider)

_active_clients: Dict[str, MultiServerMCPClient] = {}
_active_tools: Dict[str, List[BaseTool]] = {}  # provider -> list of tools


MCP_SERVER_CONFIGS = {
    "github": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env_key": "GITHUB_PERSONAL_ACCESS_TOKEN",
        "transport": "stdio",
    },
    "huggingface": {
        "command": "npx",
        "args": ["-y", "@huggingface/mcp-server"],
        "env_key": "HF_TOKEN",
        "transport": "stdio",
    },
}


async def connect_provider(provider: str, token: str) -> List[Dict[str, str]]:
    """
    Connect to a provider's MCP server using the given OAuth token.
    Saves the token to disk for persistence.
    Returns the list of discovered tools.
    """
    if provider not in MCP_SERVER_CONFIGS:
        raise ValueError(f"Unknown provider: {provider}")

    save_token(provider, token)

    config = MCP_SERVER_CONFIGS[provider]

    env = dict(os.environ)
    env[config["env_key"]] = token

    connections = {
        provider: {
            "command": config["command"],
            "args": config["args"],
            "transport": config["transport"],
            "env": env,
        }
    }

    try:
        client = MultiServerMCPClient(connections)
        tools = await client.get_tools()

        wrapped_tools = []
        for t in tools:
            wrapped_tools.append(_make_robust_tool(t))

        _active_clients[provider] = client
        _active_tools[provider] = wrapped_tools

        print(f"[MCP MANAGER] Connected to {provider}, loaded {len(wrapped_tools)} tools")
        return [{"name": t.name, "description": getattr(t, "description", "")} for t in wrapped_tools]

    except Exception as e:
        print(f"[MCP MANAGER] Failed to connect to {provider}: {e}")
        remove_token(provider)
        raise


async def disconnect_provider(provider: str):
    """Disconnect from a provider's MCP server and remove persisted token."""
    remove_token(provider)

    if provider in _active_clients:
        try:

            del _active_clients[provider]
        except Exception:
            pass

    _active_tools.pop(provider, None)
    print(f"[MCP MANAGER] Disconnected from {provider}")


def get_connected_providers() -> Dict[str, bool]:
    """Return the connection status for all external providers."""
    return {
        "github": "github" in _active_tools and len(_active_tools["github"]) > 0,
        "huggingface": "huggingface" in _active_tools and len(_active_tools["huggingface"]) > 0,
    }


def get_tools_for_provider(provider: str) -> List[Dict[str, str]]:
    """Return a list of tool info dictionaries for a specific provider."""
    tools = _active_tools.get(provider, [])
    return [{"name": t.name, "description": getattr(t, "description", "")} for t in tools]


def get_all_external_tools() -> List[Dict[str, str]]:
    """Return all tools from all connected providers."""
    result = []
    for provider, tools in _active_tools.items():
        for t in tools:
            result.append({
                "name": t.name,
                "description": getattr(t, "description", ""),
                "provider": provider,
            })
    return result


def get_external_tool_by_name(tool_name: str) -> Optional[BaseTool]:
    """Look up an external tool by name across all connected providers."""
    for provider, tools in _active_tools.items():
        for t in tools:
            if t.name == tool_name:
                return t
    return None


async def auto_reconnect():
    """On startup, check for persisted tokens and reconnect MCP servers."""
    tokens = load_tokens()
    for provider, token in tokens.items():
        if token and provider in MCP_SERVER_CONFIGS:
            try:
                print(f"[MCP MANAGER] Auto-reconnecting to {provider}...")
                await connect_provider(provider, token)
            except Exception as e:
                print(f"[MCP MANAGER] Auto-reconnect failed for {provider}: {e}")


def _make_robust_tool(tool: BaseTool) -> BaseTool:
    """Wrap a tool with robust error handling (same pattern as tools.py)."""
    original_arun = tool._arun

    def resolve_ref(ref_str, full_schema):
        if not isinstance(ref_str, str) or not ref_str.startswith("#/"):
            return {}
        parts = ref_str[2:].split("/")
        curr = full_schema
        for p in parts:
            if p in curr:
                curr = curr[p]
            else:
                return {}
        return curr

    def prune_args(data, schema, full_schema):
        if not isinstance(data, dict) or not isinstance(schema, dict):
            return data
        if "$ref" in schema:
            schema = resolve_ref(schema["$ref"], full_schema)
        if "anyOf" in schema:
            for s in schema["anyOf"]:
                s_resolved = resolve_ref(s["$ref"], full_schema) if isinstance(s, dict) and "$ref" in s else s
                if isinstance(s_resolved, dict) and (s_resolved.get("type") == "object" or "properties" in s_resolved):
                    return prune_args(data, s_resolved, full_schema)
            return data
        if "properties" in schema:
            cleaned = {}
            for k, v in data.items():
                if k in schema["properties"]:
                    prop_schema = schema["properties"][k]
                    if isinstance(prop_schema, dict) and "$ref" in prop_schema:
                        prop_schema = resolve_ref(prop_schema["$ref"], full_schema)
                    if isinstance(v, dict):
                        cleaned[k] = prune_args(v, prop_schema, full_schema)
                    elif isinstance(v, list) and prop_schema.get("type") == "array":
                        item_schema = prop_schema.get("items", {})
                        cleaned[k] = [prune_args(i, item_schema, full_schema) if isinstance(i, dict) else i for i in v]
                    else:
                        cleaned[k] = v
            return cleaned
        return data

    async def robust_arun(*args, config=None, run_manager=None, **kwargs):
        try:
            internal_keys = ["callbacks", "tags", "metadata"]
            internal_kwargs = {k: kwargs.pop(k) for k in internal_keys if k in kwargs}

            if hasattr(tool, "args_schema") and tool.args_schema:
                schema_obj = tool.args_schema
                if isinstance(schema_obj, dict):
                    full_schema = schema_obj
                elif hasattr(schema_obj, "model_json_schema"):
                    full_schema = schema_obj.model_json_schema()
                else:
                    full_schema = schema_obj.schema()
                kwargs = prune_args(kwargs, full_schema, full_schema)

            kwargs.update(internal_kwargs)
            return await original_arun(*args, config=config, run_manager=run_manager, **kwargs)
        except Exception as e:
            err_msg = str(e)
            print(f"[MCP Warning] Tool execution failed: {err_msg}")
            
            if "Invalid input" in err_msg or "required" in err_msg.lower() or "missing" in err_msg.lower():
                err_msg += "\n\nCRITICAL: You are missing required arguments for this tool. If you know the arguments, call the tool again. If you DO NOT know the arguments (like 'q', 'owner', 'repo'), YOU MUST ASK THE USER to provide them! Do NOT pretend you don't have tools attached."
            else:
                err_msg += "\n\nCRITICAL: DO NOT APOLOGIZE. If you know how to fix this, call the tool again. If you need more info, ASK THE USER. Do NOT say you don't have tools."
                
            if getattr(tool, "response_format", "content") == "content_and_artifact":
                return (err_msg, None)
            return err_msg

    tool._arun = robust_arun
    return tool

import json
import os
from pathlib import Path
from typing import Dict, List, Optional
import httpx
from langchain_mcp_adapters.client import MultiServerMCPClient

MCP_CONFIGS_DIR = Path.home() / ".graph-builder"
MCP_CONFIGS_FILE = MCP_CONFIGS_DIR / "custom_mcp_tools.json"

def _ensure_dir():
    MCP_CONFIGS_DIR.mkdir(parents=True, exist_ok=True)

def load_mcp_configs() -> List[Dict]:
    _ensure_dir()
    if MCP_CONFIGS_FILE.exists():
        try:
            return json.loads(MCP_CONFIGS_FILE.read_text())
        except Exception:
            return []
    return []

def save_mcp_configs(configs: List[Dict]):
    _ensure_dir()
    MCP_CONFIGS_FILE.write_text(json.dumps(configs, indent=2))

def add_mcp_config(config: Dict):
    configs = load_mcp_configs()
    configs.append(config)
    save_mcp_configs(configs)

def delete_mcp_config(name: str):
    configs = load_mcp_configs()
    configs = [c for c in configs if c.get("name") != name]
    save_mcp_configs(configs)

async def _fetch_oauth_token(config: Dict) -> Optional[str]:
    """Helper to fetch token based on OAuth Grant Type"""
    grant_type = config.get("oauthGrantType")
    
    if grant_type == "client_credentials":
        # Standard OAuth2 Client Credentials
        try:
            async with httpx.AsyncClient() as client:
                data = {
                    "grant_type": "client_credentials",
                    "client_id": config.get("oauthClientId"),
                    "client_secret": config.get("oauthClientSecret")
                }
                if config.get("oauthScope"):
                    data["scope"] = config.get("oauthScope")
                
                resp = await client.post(config.get("oauthTokenUrl"), data=data)
                resp.raise_for_status()
                return resp.json().get("access_token")
        except Exception as e:
            print(f"Error fetching Client Credentials token: {e}")
            return None
            
    elif grant_type == "password_credentials":
        # Password Credentials
        try:
            async with httpx.AsyncClient() as client:
                data = {
                    "grant_type": "password",
                    "username": config.get("oauthUsername"),
                    "password": config.get("oauthPassword"),
                    "client_id": config.get("oauthClientId"),
                    "client_secret": config.get("oauthClientSecret")
                }
                if config.get("oauthScope"):
                    data["scope"] = config.get("oauthScope")
                
                resp = await client.post(config.get("oauthTokenUrl"), data=data)
                resp.raise_for_status()
                return resp.json().get("access_token")
        except Exception as e:
            print(f"Error fetching Password Credentials token: {e}")
            return None
            
    elif grant_type in ["authorization_code", "authorization_code_pkce", "implicit"]:
        # Interactive flows require the user to have already logged in via a frontend UI.
        # For this prototype, we'll assume the frontend obtained the token and passed it in a header,
        # or we could implement a full OAuth redirect flow here. Since we only have the config here,
        # interactive flows cannot be fully executed headless without user interaction.
        print(f"Warning: Interactive grant type '{grant_type}' requires frontend redirect flow.")
        return None

    return None

async def connect_mcp_tool(config: Dict):
    """
    Connect to a Custom MCP Server via SSE.
    """
    name = config.get("name")
    mcp_url = config.get("mcpUrl")
    auth_type = config.get("authType")
    
    headers = {h["key"]: h["value"] for h in config.get("headers", [])}
    
    # Resolve Auth
    if auth_type == "api_key":
        header_name = config.get("apiKeyHeader", "Authorization")
        headers[header_name] = config.get("apiKey")
    elif auth_type == "basic_auth":
        import base64
        creds = f"{config.get('basicUsername')}:{config.get('basicPassword')}"
        encoded = base64.b64encode(creds.encode()).decode()
        headers["Authorization"] = f"Basic {encoded}"
    elif auth_type == "oauth2":
        # Attempt to fetch token headlessly if possible
        token = await _fetch_oauth_token(config)
        if token:
            headers["Authorization"] = f"Bearer {token}"
    
    # We would use Langchain's MultiServerMCPClient to connect.
    # Note: MultiServerMCPClient currently supports STDIO primarily in some versions,
    # but the python `mcp` library supports SSE.
    # For now, we stub the connection since Langchain's exact SSE MultiServerMCPClient usage
    # might require custom transport setup.
    print(f"Connecting to Custom MCP Tool '{name}' at {mcp_url} with headers: {list(headers.keys())}")
    
    # In a full implementation, we'd dynamically add the fetched tools to TOOL_REGISTRY:
    # from langgraph_flow_demo.tools import TOOL_REGISTRY
    # TOOL_REGISTRY[name] = ...
    
    return True

async def load_all_mcp_tools():
    configs = load_mcp_configs()
    for config in configs:
        await connect_mcp_tool(config)

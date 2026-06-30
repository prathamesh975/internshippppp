"""
OAuth routes for external tool providers (GitHub, HuggingFace).

Each provider has:
- GET /api/auth/{provider}/login    → Redirects to provider's OAuth page
- GET /api/auth/{provider}/callback → Exchanges code for token, starts MCP, closes popup
"""

import os
import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from mcp_manager import (
    connect_provider,
    disconnect_provider,
    get_connected_providers,
    get_all_external_tools,
    get_token,
)

router = APIRouter()

# ── OAuth configs loaded from env ──

def _github_config():
    return {
        "client_id": os.environ.get("GITHUB_CLIENT_ID", ""),
        "client_secret": os.environ.get("GITHUB_CLIENT_SECRET", ""),
        "authorize_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "scope": "repo read:org",
    }

def _huggingface_config():
    return {
        "client_id": os.environ.get("HUGGINGFACE_CLIENT_ID", ""),
        "client_secret": os.environ.get("HUGGINGFACE_CLIENT_SECRET", ""),
        "authorize_url": "https://huggingface.co/oauth/authorize",
        "token_url": "https://huggingface.co/oauth/token",
        "scope": "openid profile email read-repos",
    }


# ── HTML that closes the popup and notifies the parent window ──

def _success_html(provider: str, tool_count: int) -> str:
    return f"""
    <!DOCTYPE html>
    <html>
    <head><title>Connected!</title></head>
    <body style="background:#0a0a0f;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
      <div style="text-align:center">
        <div style="font-size:48px;margin-bottom:16px">✅</div>
        <h2 style="margin:0 0 8px">{provider.title()} Connected!</h2>
        <p style="color:#888">Loaded {tool_count} tools. This window will close automatically.</p>
      </div>
      <script>
        window.opener && window.opener.postMessage({{
          type: 'oauth_success',
          provider: '{provider}',
          toolCount: {tool_count}
        }}, '*');
        setTimeout(() => window.close(), 1500);
      </script>
    </body>
    </html>
    """

def _error_html(provider: str, error: str) -> str:
    return f"""
    <!DOCTYPE html>
    <html>
    <head><title>Error</title></head>
    <body style="background:#0a0a0f;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
      <div style="text-align:center">
        <div style="font-size:48px;margin-bottom:16px">❌</div>
        <h2 style="margin:0 0 8px">{provider.title()} Connection Failed</h2>
        <p style="color:#f87171">{error}</p>
        <p style="color:#888;margin-top:16px">You can close this window and try again.</p>
      </div>
      <script>
        window.opener && window.opener.postMessage({{
          type: 'oauth_error',
          provider: '{provider}',
          error: '{error}'
        }}, '*');
      </script>
    </body>
    </html>
    """


# ════════════════════════════════════════
# GitHub OAuth
# ════════════════════════════════════════

@router.get("/api/auth/github/login")
async def github_login():
    cfg = _github_config()
    if not cfg["client_id"]:
        raise HTTPException(400, "GITHUB_CLIENT_ID not configured in .env")
    
    url = (
        f"{cfg['authorize_url']}"
        f"?client_id={cfg['client_id']}"
        f"&scope={cfg['scope']}"
        f"&redirect_uri=http://localhost:8001/api/auth/github/callback"
    )
    return RedirectResponse(url)


@router.get("/api/auth/github/callback")
async def github_callback(code: str = ""):
    if not code:
        return HTMLResponse(_error_html("github", "No authorization code received"))

    cfg = _github_config()

    try:
        # Exchange code for access token
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                cfg["token_url"],
                data={
                    "client_id": cfg["client_id"],
                    "client_secret": cfg["client_secret"],
                    "code": code,
                    "redirect_uri": "http://localhost:8001/api/auth/github/callback",
                },
                headers={"Accept": "application/json"},
            )
            data = resp.json()

        token = data.get("access_token")
        if not token:
            error = data.get("error_description", data.get("error", "Unknown error"))
            return HTMLResponse(_error_html("github", error))

        # Connect MCP server with the token
        tools = await connect_provider("github", token)
        return HTMLResponse(_success_html("github", len(tools)))

    except Exception as e:
        return HTMLResponse(_error_html("github", str(e)))


# ════════════════════════════════════════
# HuggingFace OAuth
# ════════════════════════════════════════

@router.get("/api/auth/huggingface/login")
async def huggingface_login():
    cfg = _huggingface_config()
    if not cfg["client_id"]:
        raise HTTPException(400, "HUGGINGFACE_CLIENT_ID not configured in .env")

    url = (
        f"{cfg['authorize_url']}"
        f"?client_id={cfg['client_id']}"
        f"&scope={cfg['scope']}"
        f"&redirect_uri=http://localhost:8001/api/auth/huggingface/callback"
        f"&response_type=code"
    )
    return RedirectResponse(url)


@router.get("/api/auth/huggingface/callback")
async def huggingface_callback(code: str = ""):
    if not code:
        return HTMLResponse(_error_html("huggingface", "No authorization code received"))

    cfg = _huggingface_config()

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                cfg["token_url"],
                data={
                    "client_id": cfg["client_id"],
                    "client_secret": cfg["client_secret"],
                    "code": code,
                    "redirect_uri": "http://localhost:8001/api/auth/huggingface/callback",
                    "grant_type": "authorization_code",
                },
                headers={"Accept": "application/json"},
            )
            data = resp.json()

        token = data.get("access_token")
        if not token:
            error = data.get("error_description", data.get("error", "Unknown error"))
            return HTMLResponse(_error_html("huggingface", error))

        tools = await connect_provider("huggingface", token)
        return HTMLResponse(_success_html("huggingface", len(tools)))

    except Exception as e:
        return HTMLResponse(_error_html("huggingface", str(e)))


# ════════════════════════════════════════
# Status & Management endpoints
# ════════════════════════════════════════

@router.get("/api/external-tools")
async def list_external_tools():
    """List all tools from connected external providers."""
    return {"tools": get_all_external_tools()}


@router.get("/api/external-tools/status")
async def external_tools_status():
    """Return connection status for each provider."""
    return get_connected_providers()



@router.post("/api/external-tools/disconnect")
async def disconnect_external_tool(body: dict):
    """Disconnect from a provider and remove its persisted token."""
    provider = body.get("provider")
    if not provider:
        raise HTTPException(400, "Provider name required")
    
    await disconnect_provider(provider)
    return {"status": "disconnected", "provider": provider}


@router.post("/api/external-tools/connect")
async def connect_external_tool_direct(body: dict):
    """Connect to a provider by directly providing a token (no OAuth flow needed).
    
    Body: { "provider": "huggingface", "token": "hf_..." }
    """
    provider = body.get("provider")
    token = body.get("token")
    if not provider or not token:
        raise HTTPException(400, "Both 'provider' and 'token' are required")

    try:
        tools = await connect_provider(provider, token)
        return {"status": "connected", "provider": provider, "tool_count": len(tools), "tools": tools}
    except Exception as e:
        raise HTTPException(500, f"Failed to connect to {provider}: {str(e)}")

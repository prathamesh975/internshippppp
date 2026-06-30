from mcp.server.fastmcp import FastMCP
import json
import sys

mcp = FastMCP("MedicalAdminServer")

INSURANCE_DB = [
    {"patient": "Rahul Kumar", "provider": "HealthCare Plus", "policy_number": "HC-100234", "status": "Active", "copay": "$20"},
    {"patient": "Amit Desai", "provider": "MediShield", "policy_number": "MS-998877", "status": "Active", "copay": "$50"},
]

BILLING_DB = [
    {"patient": "Rahul Kumar", "outstanding_balance": "$150.00", "last_payment_date": "2026-05-15"},
    {"patient": "Amit Desai", "outstanding_balance": "$0.00", "last_payment_date": "2026-06-01"},
]

@mcp.tool()
def get_insurance_info(patient_name: str) -> str:
    print(f"\n[MCP SERVER LOG] Received request for get_insurance_info: {patient_name}", file=sys.stderr)
    name_lower = patient_name.lower()
    for record in INSURANCE_DB:
        if name_lower in record["patient"].lower():
            print(f"[MCP SERVER LOG]s Found insurance record for {patient_name}", file=sys.stderr)
            return json.dumps(record)
    
    print(f"[MCP SERVER LOG]  No insurance records found for {patient_name}", file=sys.stderr)
    return json.dumps({"error": f"No insurance records found for {patient_name}."})

@mcp.tool()
def get_billing_details(patient_name: str) -> str:
    print(f"\n[MCP SERVER LOG]  Received request for get_billing_details: {patient_name}", file=sys.stderr)
    name_lower = patient_name.lower()
    for record in BILLING_DB:
        if name_lower in record["patient"].lower():
            print(f"[MCP SERVER LOG] Found billing record for {patient_name}", file=sys.stderr)
            return json.dumps(record)
            
    print(f"[MCP SERVER LOG] No billing records found for {patient_name}", file=sys.stderr)
    return json.dumps({"error": f"No billing records found for {patient_name}."})

if __name__ == "__main__":
    # Starts the server using stdio transport by default
    mcp.run(transport="stdio")

    # --- Alternative: SSE Transport ---
    # To run the MCP server over HTTP with Server-Sent Events (SSE) instead of stdio,
    # you would comment out the line above and uncomment the line below:
    # mcp.run(transport="sse", host="127.0.0.1", port=8000)

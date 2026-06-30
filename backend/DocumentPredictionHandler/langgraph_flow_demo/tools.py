from typing import Any, List
import json
import sys
import asyncio
import atexit
from pathlib import Path
from langchain_core.tools import tool
from langchain_core.tools import BaseTool, StructuredTool
from collections.abc import Callable
from langchain_mcp_adapters.client import MultiServerMCPClient
import os
import mcp.client.session

# --- MONKEYPATCH ---
# The official MCP client strictly validates structuredContent against outputSchema.
# If an external API (like CRM) returns extra properties (e.g., 'createdBy'), it crashes the local client!
# We monkeypatch the validation to allow extra properties to pass through cleanly to the LLM.
async def _patched_validate_tool_result(self, name: str, result: any) -> None:
    pass

mcp.client.session.ClientSession._validate_tool_result = _patched_validate_tool_result
# -------------------

DOCTORS_DB = [
    {"name": "Dr. Priya Sharma",   "specialization": "Primary care",   "location": "Mumbai",    "available_days": [1, 2, 3], "rating": 4.8, "telehealth": True},
    {"name": "Dr. James Wilson",   "specialization": "Primary care",   "location": "Mumbai",    "available_days": [0, 2, 4], "rating": 4.6, "telehealth": False},
    {"name": "Dr. Ananya Patel",   "specialization": "Cardiology",     "location": "Bangalore", "available_days": [0, 1, 2], "rating": 4.9, "telehealth": True},
    {"name": "Dr. Sanjay Kumar",   "specialization": "Cardiology",     "location": "Delhi",     "available_days": [3, 4],    "rating": 4.7, "telehealth": False},
    {"name": "Dr. Arjun Reddy",    "specialization": "Neurology",      "location": "Chennai",   "available_days": [1, 3, 4], "rating": 4.9, "telehealth": True},
    {"name": "Dr. Smita Rao",      "specialization": "Dermatology",    "location": "Delhi",     "available_days": [0, 2, 4], "rating": 4.5, "telehealth": False},
    {"name": "Dr. Aisha Khan",     "specialization": "Neurology",      "location": "Bangalore", "available_days": [2, 3],    "rating": 4.8, "telehealth": True},
    {"name": "Dr. Rajiv Menon",    "specialization": "Orthopedics",    "location": "Chennai",   "available_days": [0, 1, 4], "rating": 4.6, "telehealth": False},
]

APPOINTMENTS_DB = [
    {"id": "APT-1001", "patient": "Rahul Kumar", "doctor": "Dr. Priya Sharma", "date": "2026-06-05", "status": "confirmed", "type": "Primary care"},
    {"id": "APT-1003", "patient": "Amit Desai",  "doctor": "Dr. Ananya Patel", "date": "2026-06-07", "status": "confirmed", "type": "Cardiology"},
]

PATIENTS_DB = [
    {"id": "PAT-501", "name": "Rahul Kumar",   "age": 34, "blood_group": "O+", "allergies": ["Penicillin"],       "city": "Mumbai", "chronic_conditions": ["Hypertension"]},
    {"id": "PAT-503", "name": "Amit Desai",    "age": 45, "blood_group": "B+", "allergies": ["Sulfa", "Aspirin"], "city": "Bangalore", "chronic_conditions": ["Type 2 Diabetes", "High Cholesterol"]},
    {"id": "PAT-504", "name": "Sneha Iyer",    "age": 31, "blood_group": "AB-","allergies": [],                   "city": "Chennai", "chronic_conditions": ["Migraine"]},
    {"id": "PAT-505", "name": "Rohan Das",     "age": 52, "blood_group": "O-", "allergies": ["Latex"],            "city": "Mumbai", "chronic_conditions": ["Coronary Artery Disease"]},
]

MEDICATIONS_DB = [
    {"name": "Amoxicillin",   "category": "Antibiotic",     "dosage": "500mg",  "frequency": "3x daily", "patient": "Rahul Kumar"},
    {"name": "Metformin",     "category": "Antidiabetic",   "dosage": "850mg",  "frequency": "2x daily", "patient": "Amit Desai"},
    {"name": "Amlodipine",    "category": "Antihypertensive","dosage": "5mg",   "frequency": "1x daily", "patient": "Rahul Kumar"},
    {"name": "Atorvastatin",  "category": "Statin",         "dosage": "20mg",   "frequency": "1x daily", "patient": "Amit Desai"},
    {"name": "Sumatriptan",   "category": "Triptan",        "dosage": "50mg",   "frequency": "As needed","patient": "Sneha Iyer"},
    {"name": "Aspirin",       "category": "Antiplatelet",   "dosage": "81mg",   "frequency": "1x daily", "patient": "Rohan Das"},
]

LAB_RESULTS_DB = [
    {"patient": "Rahul Kumar",  "test": "CBC",              "result": "Normal",   "date": "2026-05-28", "status": "final"},
    {"patient": "Rahul Kumar",  "test": "Blood Pressure",   "result": "145/90",   "date": "2026-05-28", "status": "flagged"},
    {"patient": "Amit Desai",   "test": "Lipid Profile",    "result": "LDL: 165", "date": "2026-05-25", "status": "high"},
    {"patient": "Amit Desai",   "test": "HbA1c",            "result": "7.8%",     "date": "2026-05-25", "status": "high"},
    {"patient": "Rohan Das",    "test": "ECG",              "result": "Abnormal", "date": "2026-05-10", "status": "critical"},
]

@tool
def get_patient_info(patient_name: str) -> str:
    """Fetch demographic and medical history for a patient given their full name."""
    name_lower = patient_name.lower()
    for p in PATIENTS_DB:
        if name_lower in p["name"].lower():
            return json.dumps(p)
    return json.dumps({"error": f"Patient '{patient_name}' not found."})

@tool
def get_lab_results(patient_name: str) -> str:
    """Fetch recent laboratory test results for a patient given their full name."""
    name_lower = patient_name.lower()
    results = [l for l in LAB_RESULTS_DB if name_lower in l["patient"].lower()]
    return json.dumps(results) if results else json.dumps({"error": "No lab results found."})

@tool
def get_medications(patient_name: str) -> str:
    """Fetch active medication list for a patient given their full name."""
    name_lower = patient_name.lower()
    meds = [m for m in MEDICATIONS_DB if name_lower in m["patient"].lower()]
    return json.dumps(meds) if meds else json.dumps({"error": "No medications found."})

@tool
def get_doctors(specialization: str, city: str) -> str:
    """Find doctors matching a specific specialization and city. Suggests telehealth alternatives if none are found."""
    spec_lower = specialization.lower()
    city_lower = city.lower()
    matches = [d for d in DOCTORS_DB if spec_lower in d["specialization"].lower() and city_lower in d["location"].lower()]
    if not matches:
        telehealth = [d for d in DOCTORS_DB if spec_lower in d["specialization"].lower() and d["telehealth"]]
        if telehealth:
            return json.dumps({"status": "no_local_match", "telehealth_alternatives": telehealth})
        return json.dumps({"error": f"No {specialization} found anywhere."})
    return json.dumps(matches)

@tool
def check_availability(doctor_name: str) -> str:
    """Check the next available appointment slot for a specific doctor."""
    name_lower = doctor_name.lower()
    for d in DOCTORS_DB:
        if name_lower in d["name"].lower():
            return json.dumps({"doctor": d["name"], "next_available_slot": "2026-06-15 10:00 AM", "status": "available"})
    return json.dumps({"error": "Doctor not found."})

@tool
def book_appointment(patient_name: str, doctor_name: str, date: str) -> str:
    """Book an appointment for a patient with a doctor on a specific date."""
    return json.dumps({
        "status": "confirmed",
        "booking_id": f"APT-9999",
        "patient": patient_name,
        "doctor": doctor_name,
        "date": date
    })

TOOL_REGISTRY = {
    "get-patient-info": get_patient_info,
    "get-lab-results": get_lab_results,
    "get-medications": get_medications,
    "get-doctors": get_doctors,
    "check-availability": check_availability,
    "book-appointment": book_appointment,
}

_mcp_client = None

async def load_mcp_tools_into_registry():
    global _mcp_client
    
    if getattr(load_mcp_tools_into_registry, "_initialized", False):
        return
    load_mcp_tools_into_registry._initialized = True

    mcp_script = Path(__file__).parent / "mcp_server.py"
    sse_url = os.environ.get("MCP_SSE_URL", "https://znpwnbjban.us-east-1.awsapprunner.com/p4t1-0wcWHyCBUJf5ulI0/dev/mcp")

    connections = {
        "local": {
            "command": sys.executable,
            "args": [str(mcp_script)],
            "transport": "stdio",
        }

    }

    if sse_url:
        connections["remote"] = {
            "url": sse_url,
            "transport": "http",
        }
    '''
    third_server_url = ""
    if third_server_url:
        connections["third_server"] = {
            "url": third_server_url,
            "transport": "sse",
        }'''

    _mcp_client = MultiServerMCPClient(connections)

    try:
        print(f"\n[MCP CLIENT] Initializing MultiServerMCPClient connections...")
        print(f"[MCP CLIENT] Configured Servers: {list(connections.keys())}")
        
        mcp_tools = await _mcp_client.get_tools()
        
        # Production-grade dynamic schema validator & error handler
        def make_robust_tool(tool):
            original_arun = tool._arun
            
            def resolve_ref(ref_str, full_schema):
                if not isinstance(ref_str, str) or not ref_str.startswith("#/"): return {}
                parts = ref_str[2:].split("/")
                curr = full_schema
                for p in parts:
                    if p in curr: curr = curr[p]
                    else: return {}
                return curr

            def prune_args(data, schema, full_schema):
                if not isinstance(data, dict) or not isinstance(schema, dict): return data
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
                    import traceback
                    traceback.print_exc()
                    err_msg = f"Tool execution failed with schema validation error: {str(e)}\n\nCRITICAL: DO NOT APOLOGIZE. If you are missing required arguments (like 'q', 'owner', 'repo'), YOU MUST ASK THE USER to provide them! Do NOT pretend you don't have tools attached. If you know how to fix it, call the tool again."
                    if getattr(tool, "response_format", "content") == "content_and_artifact":
                        return (err_msg, None)
                    return err_msg
                    
            tool._arun = robust_arun
            return tool

        for t in mcp_tools:
            TOOL_REGISTRY[t.name] = make_robust_tool(t)
            
        print(f"[MCP CLIENT] Successfully loaded {len(mcp_tools)} tools into registry via MultiServerMCPClient.")
    except Exception as e:
        print(f"\n[MCP CLIENT] Failed to load MCP tools: {e}")
        if hasattr(e, 'exceptions'):
            for i, sub_e in enumerate(e.exceptions):
                print(f"  -> Sub-error {i+1}: {repr(sub_e)}")



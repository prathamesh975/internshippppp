from langchain_core.tools import tool

@tool
def calculator(expression: str) -> str:
    """Simple calculator."""
    return str(eval(expression))

TOOL_REGISTRY = {
    "calculator": calculator
}
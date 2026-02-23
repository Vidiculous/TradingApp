import asyncio
import inspect
import time
from typing import Any, Dict, List, Optional, Callable, Awaitable

class ToolManager:
    def __init__(self):
        self._tools: Dict[str, Dict[str, Any]] = {}
        self._cache: Dict[str, Dict[str, Any]] = {} # key -> {value, expires_at}
        
    def register_tool(self, name: str, func: Callable[..., Awaitable[Any]], schema: Dict[str, Any], ttl: int = 60):
        """
        Register a tool with a name, implementation, JSON schema, and default TTL.
        """
        self._tools[name] = {
            "func": func,
            "schema": schema,
            "ttl": ttl
        }
        
    def get_tool_schemas(self) -> List[Dict[str, Any]]:
        """Returns all tool schemas for LLM-side definition."""
        return [t["schema"] for t in self._tools.values()]

    async def execute_tool(self, name: str, arguments: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Any:
        """
        Execute a tool with caching and context logic.
        """
        tool_entry = self._tools.get(name)
        if not tool_entry:
            return {"error": f"Tool '{name}' not found."}

        # Generate cache key based on name and sorted arguments
        arg_str = "_".join(f"{k}:{v}" for k, v in sorted(arguments.items()))
        cache_key = f"{name}_{arg_str}"

        # Check cache
        now = time.time()
        cached = self._cache.get(cache_key)
        if cached and cached["expires_at"] > now:
            print(f"    [ToolManager] Cache hit for {name} ({cache_key[:30]}...)")
            return cached["value"]

        # Execute
        try:
            print(f"    [ToolManager] Executing {name}...")
            full_kwargs = {**arguments}
            # Only pass context if the tool function explicitly accepts it
            if context:
                sig = inspect.signature(tool_entry["func"])
                if "context" in sig.parameters:
                    full_kwargs["context"] = context

            result = await tool_entry["func"](**full_kwargs)
            
            # Save to cache
            ttl = tool_entry["ttl"]
            self._cache[cache_key] = {
                "value": result,
                "expires_at": now + ttl
            }
            return result
        except Exception as e:
            return {"error": str(e)}

    def view(self, *allowed_tool_names: str) -> "AgentToolView":
        """Return a read-only view that exposes only the specified tools to an agent.
        Execution and caching are delegated back to this shared ToolManager instance,
        so results are shared across all agents that call the same tool."""
        return AgentToolView(self, list(allowed_tool_names))

    def clear_cache(self):
        self._cache = {}


class AgentToolView:
    """Thin façade over a shared ToolManager that limits which tools an agent can see.
    All tool calls and cache lookups go through the parent ToolManager."""

    def __init__(self, parent: ToolManager, allowed: List[str]):
        self._parent = parent
        self._allowed = set(allowed)

    def get_tool_schemas(self) -> List[Dict[str, Any]]:
        return [
            t["schema"]
            for name, t in self._parent._tools.items()
            if name in self._allowed
        ]

    async def execute_tool(self, name: str, arguments: Dict[str, Any], context=None) -> Any:
        if name not in self._allowed:
            return {"error": f"Tool '{name}' is not available to this agent."}
        return await self._parent.execute_tool(name, arguments, context=context)

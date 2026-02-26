import asyncio
import json
import os
import random
import sys
import time
from typing import Any, Dict, List, Optional, Union

import pandas as pd
from dotenv import load_dotenv

# Ensure project paths for importing services
base_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(base_dir))
backend_dir = os.path.join(project_root, "backend")
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from services.llm_provider import LLMProvider

# Load env variables (assuming .env is in backend/)
load_dotenv(os.path.join(backend_dir, ".env"))


class BaseAgent:
    def __init__(self, name, prompt_file=None):
        self.name = name
        self.system_prompt = ""
        self.registry: Dict[str, 'BaseAgent'] = {} # Agent registry for inter-agent comms
        self.tool_manager = None
        self._tool_context: Optional[Dict] = None
        if prompt_file:
            self.load_prompt(prompt_file)

    def _get_default_config(self) -> Dict[str, str]:
        """Returns the default configuration from environment variables."""
        provider = os.getenv("LLM_PROVIDER", "gemini").lower()
        if provider == "openai":
            return {
                "provider": "openai",
                "model": os.getenv("OPENAI_MODEL", "gpt-4o"),
                "api_key": os.getenv("OPENAI_API_KEY"),
            }
        elif provider == "anthropic":
            return {
                "provider": "anthropic",
                "model": os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20240620"),
                "api_key": os.getenv("ANTHROPIC_API_KEY"),
            }
        else:
            return {
                "provider": "gemini",
                "model": os.getenv("GEMINI_MODEL", "gemini-3-flash-preview"),
                "api_key": os.getenv("GEMINI_API_KEY"),
            }

    def load_prompt(self, filename):
        """Loads the system prompt from the prompts directory."""
        current_dir = os.path.dirname(os.path.abspath(__file__))
        prompts_dir = os.path.join(os.path.dirname(current_dir), "prompts")
        file_path = os.path.join(prompts_dir, filename)

        if not os.path.exists(file_path):
            raise FileNotFoundError(
                f"Prompt file not found for {self.name}: {file_path}"
            )

        try:
            with open(file_path, encoding="utf-8") as f:
                self.system_prompt = f.read()
        except FileNotFoundError:
            raise
        except Exception as e:
            print(f"Error loading prompt for {self.name}: {e}")

    @staticmethod
    def sanitize_data(data):
        """Recursively replace NaN/Inf/Bytes with JSON-friendly types."""
        if data is None:
            return None
        if isinstance(data, dict):
            return {k: BaseAgent.sanitize_data(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [BaseAgent.sanitize_data(i) for i in data]
        elif isinstance(data, bytes):
            return "<binary_data_omitted>"  # Prevent bytes from crashing JSON serialization

        # Handle pandas/numpy NaN
        try:
            if pd.isna(data):
                return None
        except:
            pass

        # Handle numpy types
        try:
            if hasattr(data, "item"):
                val = data.item()
                if isinstance(val, float) and (
                    pd.isna(val) or val == float("inf") or val == float("-inf")
                ):
                    return None
                return val
        except:
            pass

        return data

    _RETRYABLE_PATTERNS = ["429", "500", "503", "rate limit", "quota", "Resource has been exhausted", "overloaded"]
    _NON_RETRYABLE_PATTERNS = ["401", "403", "400"]

    async def _retry_with_backoff(self, func, max_retries=3):
        """Retry an async callable with exponential backoff on transient errors."""
        last_exception = None
        for attempt in range(max_retries + 1):
            try:
                return await func()
            except Exception as e:
                last_exception = e
                err_str = str(e).lower()

                # Don't retry on auth / bad-request errors
                if any(p.lower() in err_str for p in self._NON_RETRYABLE_PATTERNS):
                    raise

                # Only retry on known transient errors
                is_retryable = any(p.lower() in err_str for p in self._RETRYABLE_PATTERNS)
                if not is_retryable or attempt >= max_retries:
                    raise

                # Exponential backoff: 1s, 2s, 4s — plus jitter
                delay = (2 ** attempt) + random.uniform(0, 1)
                print(
                    f"  [{self.name}] Retry {attempt + 1}/{max_retries} after {delay:.1f}s — {e}"
                )
                await asyncio.sleep(delay)

        raise last_exception  # type: ignore[misc]

    @staticmethod
    def _strip_markdown_fences(text):
        """Remove markdown code fences from API response text."""
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        else:
            return text
        # Find the last closing fence and trim there
        last_fence = text.rfind("```")
        if last_fence != -1:
            text = text[:last_fence]
        return text.strip()

    async def call_model(self, user_content, api_config=None, is_json=True, tool_manager=None):
        """Calls the configured LLM with the system prompt and user content.

        Tool calls are handled by injecting results back into the prompt as text,
        rather than using provider-specific conversation history formats. On the
        final round, tools are withheld so the model must return a JSON answer.
        """
        config = api_config or self._get_default_config()
        tm = tool_manager or self.tool_manager
        max_tool_rounds = 3  # Max rounds of tool calls before forcing a final answer

        if not config.get("api_key"):
            msg = f"API key not found for provider {config.get('provider')}"
            return {"error": msg, "signal": "NEUTRAL"} if is_json else msg

        try:
            start_time = time.time()
            print(f"    [{self.name}] Calling model (Provider: {config.get('provider')})...")

            # Accumulate ALL tool results across rounds in one dict.
            # Each round may call one or more tools; results are merged here so the
            # final prompt always contains the complete set of fetched data.
            all_tool_results: Dict[str, Any] = {}

            for round_num in range(max_tool_rounds + 1):
                # Only offer tools before the final round; on the last round withhold
                # them so the model is forced to produce a text/JSON answer.
                offer_tools = (tm is not None) and (round_num < max_tool_rounds)
                tool_schemas = tm.get_tool_schemas() if offer_tools else None

                # Build the content for this round: original prompt + ALL results so far
                if all_tool_results:
                    tool_text = json.dumps(all_tool_results, indent=2, default=str)
                    current_content = (
                        str(user_content)
                        + f"\n\n<tool_results>\n{tool_text}\n</tool_results>\n\n"
                        + ("Provide your final analysis in the required JSON format."
                           if not offer_tools else
                           "You may call additional tools if needed, or provide your final analysis.")
                    )
                else:
                    current_content = user_content

                # Capture loop-locals for the closure
                _content = current_content
                _schemas = tool_schemas

                async def _call():
                    return await LLMProvider.call(
                        provider=config.get("provider", "gemini"),
                        model_id=config.get("model", "gemini-3-flash-preview"),
                        api_key=config.get("api_key"),
                        system_prompt=self.system_prompt,
                        user_content=_content,
                        is_json=is_json if not _schemas else False,
                        tools=_schemas,
                    )

                response = await self._retry_with_backoff(_call)

                # --- Handle tool calls ---
                if isinstance(response, dict) and "tool_calls" in response:
                    for tc in response["tool_calls"]:
                        result = await tm.execute_tool(tc["name"], tc["arguments"], context=self._tool_context)
                        all_tool_results[tc["name"]] = result  # merge into cumulative dict
                        print(f"    [{self.name}] Tool '{tc['name']}' executed.")

                    print(f"    [{self.name}] Tools gathered so far: {list(all_tool_results.keys())} (round {round_num + 1}/{max_tool_rounds}). Re-calling...")
                    continue

                # --- Final answer ---
                elapsed = time.time() - start_time
                print(f"    [{self.name}] Response received in {elapsed:.2f}s")

                text = response.strip() if isinstance(response, str) else str(response)
                text = self._strip_markdown_fences(text)

                if not is_json:
                    return text

                try:
                    parsed = json.loads(text)
                except json.JSONDecodeError:
                    import re
                    match = re.search(r"\{.*\}", text, re.DOTALL)
                    if match:
                        parsed = json.loads(match.group())
                    else:
                        raise

                if isinstance(parsed, list):
                    parsed = parsed[0] if parsed else {}

                return BaseAgent.sanitize_data(parsed)

            return {"error": "Failed to converge after tool calls", "signal": "NEUTRAL"}
        except Exception as e:
            print(f"LLM Error ({self.name}): {e}")
            return {"error": str(e), "signal": "NEUTRAL"} if is_json else f"I encountered an error: {str(e)}"

    async def chat(self, message, context=None, api_config=None, depth=0):
        """
        Chat with the agent.
        """
        print(f"[{self.name}] Chatting...")

        from datetime import datetime

        now = datetime.now()
        datetime_context = f"""
CURRENT DATE AND TIME: {now.strftime('%Y-%m-%d %H:%M:%S')}
TODAY IS: {now.strftime('%A, %B %d, %Y')}
CRITICAL: You MUST base all responses on this current date. Do NOT reference events from your training data as if they are current.
"""

        context_str = ""
        if context:
            context_str = f"\nCONTEXT FROM PREVIOUS ANALYSIS:\n{json.dumps(context, indent=2)}\n"

        prompt = f"""
        {datetime_context}
        
        {context_str}
        
        USER QUESTION:
        {message}
        
        Answer as {self.name}. Be concise and professional.
        IMPORTANT: This is a chat conversation. Reply in clear PLAIN TEXT only. Do NOT output a JSON object.
        CRITICAL: The current date is {now.strftime('%B %d, %Y')}.
        STRICT: Skip long introductory greetings or filler. Start the response DIRECTLY with the relevant information.
        """

        return await self.call_model(
            prompt,
            api_config=api_config,
            is_json=False,
        )

    async def ask_agent(self, agent_id: str, question: str, context: Any = None, api_config: Dict = None, depth: int = 0) -> str:
        """Query another agent by its ID."""
        if depth > 2:
            return "Error: max inter-agent depth reached."
        target = self.registry.get(agent_id.lower())
        if not target:
            return f"Error: Agent '{agent_id}' not found in registry."

        print(f"    [{self.name}] -> Asking [{target.name}]: {question[:50]}...")
        return await target.chat(question, context=context, api_config=api_config, depth=depth + 1)

    async def analyze(self, ticker, horizon, data):
        raise NotImplementedError

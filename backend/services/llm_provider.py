import asyncio
import base64
import json
import os
import logging
from typing import Any, Dict, List, Optional, Union

import openai
import anthropic
from google import genai

logger = logging.getLogger(__name__)

class LLMProvider:
    """
    Adapter service for multiple LLM providers.
    Supports Gemini (Google), OpenAI (GPT), and Anthropic (Claude).
    """

    @staticmethod
    async def call(
        provider: str,
        model_id: str,
        api_key: str,
        system_prompt: str,
        user_content: Union[str, list],
        is_json: bool = True,
        tools: Optional[List[Dict[str, Any]]] = None
    ) -> Union[str, Dict[str, Any]]:
        provider = provider.lower()
        
        # Normalize user_content if it's a list (multimodal)
        normalized_content = LLMProvider._normalize_content(user_content, provider)
        
        try:
            print(f"  [LLMProvider] Calling {provider}/{model_id}...")
            if provider == "openai":
                res = await LLMProvider._call_openai(model_id, api_key, system_prompt, normalized_content, is_json, tools)
            elif provider == "anthropic":
                res = await LLMProvider._call_anthropic(model_id, api_key, system_prompt, normalized_content, is_json)
            else: # Default to Gemini
                res = await LLMProvider._call_gemini(model_id, api_key, system_prompt, normalized_content, is_json, tools)
            print(f"  [LLMProvider] {provider} call completed successfully.")
            return res
        except Exception as e:
            print(f"  [LLMProvider] {provider} call FAILED: {e}")
            logger.error(f"LLM Call Failed ({provider}/{model_id}): {e}")
            raise

    @staticmethod
    def _normalize_content(content, provider):
        """Converts generic multimodal list into provider-specific format."""
        if not isinstance(content, list):
            return content

        if provider == "gemini":
            # The google-genai SDK expects Contents, which have a 'role' and 'parts'.
            # If we receive a list of OpenAI-style messages, we must translate.
            if isinstance(content, list) and len(content) > 0 and isinstance(content[0], dict) and "role" in content[0]:
                translated_contents = []
                for msg in content:
                    role = msg.get("role")
                    if role == "assistant":
                        role = "model"
                    
                    parts = []
                    # Handle text content
                    if "content" in msg and msg["content"]:
                        parts.append(genai.types.Part(text=msg["content"]))
                    
                    # Handle tool calls (assistant role)
                    if "tool_calls" in msg:
                        for tc in msg["tool_calls"]:
                            parts.append(genai.types.Part(
                                function_call=genai.types.FunctionCall(
                                    name=tc["name"],
                                    args=tc["arguments"]
                                )
                            ))
                    
                    # Handle structured tool results (tool role)
                    if role == "tool" and "results" in msg:
                        for res in msg["results"]:
                            # Gemini expects tool responses to be in a 'user' role message
                            # containing FunctionResponse parts.
                            parts.append(genai.types.Part(
                                function_response=genai.types.FunctionResponse(
                                    name=res["name"],
                                    response={"result": res["content"]}
                                )
                            ))
                        role = "user"

                    if parts:
                        translated_contents.append(genai.types.Content(role=role, parts=parts))
                return translated_contents

            # Fallback for simple list of parts (already handled by genai SDK if passed as contents)
            parts = []
            for item in content:
                if isinstance(item, dict) and item.get("type") == "image":
                    parts.append(genai.types.Part.from_bytes(data=item["data"], mime_type=item.get("mime_type", "image/png")))
                elif isinstance(item, str):
                    parts.append(genai.types.Part(text=item))
                else:
                    parts.append(item)
            return parts

        elif provider == "openai":
            parts = []
            for item in content:
                if isinstance(item, dict) and item.get("type") == "image":
                    b64 = base64.b64encode(item["data"]).decode("utf-8")
                    parts.append({
                        "type": "image_url",
                        "image_url": {"url": f"data:{item.get('mime_type', 'image/png')};base64,{b64}"}
                    })
                elif isinstance(item, str):
                    parts.append({"type": "text", "text": item})
                else:
                    parts.append(item)
            return parts

        elif provider == "anthropic":
            parts = []
            for item in content:
                if isinstance(item, dict) and item.get("type") == "image":
                    b64 = base64.b64encode(item["data"]).decode("utf-8")
                    parts.append({
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": item.get("mime_type", "image/png"),
                            "data": b64
                        }
                    })
                elif isinstance(item, str):
                    parts.append({"type": "text", "text": item})
                else:
                    parts.append(item)
            return parts

        return content

    @staticmethod
    async def _call_openai(model_id, api_key, system, content, is_json, tools=None):
        client = openai.AsyncOpenAI(api_key=api_key)
        
        # content is already list of dicts if multimodal, or str if text
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": content}
        ]
        
        response = await client.chat.completions.create(
            model=model_id,
            messages=messages,
            response_format={"type": "json_object"} if is_json else None,
            tools=[{"type": "function", "function": t} for t in tools] if tools else None,
            tool_choice="auto" if tools else None,
            temperature=0.2,
            timeout=60.0 # 60s timeout
        )
        
        message = response.choices[0].message
        if message.tool_calls:
            return {
                "tool_calls": [
                    {
                        "id": tc.id,
                        "name": tc.function.name,
                        "arguments": json.loads(tc.function.arguments)
                    } for tc in message.tool_calls
                ]
            }
            
        return message.content

    @staticmethod
    async def _call_anthropic(model_id, api_key, system, content, is_json):
        client = anthropic.AsyncAnthropic(api_key=api_key)
        
        # content is already list of dicts if multimodal, or str if text
        messages = [{"role": "user", "content": content}]
        
        response = await client.messages.create(
            model=model_id,
            max_tokens=4096,
            system=system,
            messages=messages,
            temperature=0.2,
            timeout=60.0 # 60s timeout
        )
        return response.content[0].text

    @staticmethod
    async def _call_gemini(model_id, api_key, system, content, is_json, tools=None):
        import time
        t0 = time.time()
        print(f"    [Gemini] Initializing Client (Key: {api_key[:10]}...)...")
        client = genai.Client(api_key=api_key)
        print(f"    [Gemini] Client ready in {time.time()-t0:.2f}s.")
        
        def _do():
            return client.models.generate_content(
                model=model_id,
                contents=content,
                config=genai.types.GenerateContentConfig(
                    system_instruction=system,
                    response_mime_type="application/json" if is_json else None,
                    tools=[genai.types.Tool(function_declarations=tools)] if tools else None,
                    temperature=0.2,
                    http_options={"timeout": 90000} # 90s timeout in ms
                )
            )
            
        print(f"    [Gemini] Calling generate_content for {model_id}...")
        t1 = time.time()
        try:
            response = await asyncio.to_thread(_do)
            print(f"    [Gemini] generate_content finished in {time.time()-t1:.2f}s.")
            
            # Check for function calls in the primary candidate
            if response.candidates and response.candidates[0].content.parts:
                parts = response.candidates[0].content.parts
                tool_calls = [
                    {
                        "name": p.function_call.name,
                        "arguments": p.function_call.args
                    } for p in parts if p.function_call
                ]
                if tool_calls:
                    return {"tool_calls": tool_calls}

            return response.text
        except Exception as e:
            logger.error(f"Gemini API Error: {str(e)}")
            raise

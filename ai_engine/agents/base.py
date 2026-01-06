import asyncio
import json
import os
import time

# Load env variables (assuming .env is in backend/)
import pandas as pd
from dotenv import load_dotenv
from google import genai

base_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(base_dir))
load_dotenv(os.path.join(project_root, "backend", ".env"))

api_key = os.getenv("GEMINI_API_KEY")
client = None
if api_key:
    client = genai.Client(api_key=api_key)


class BaseAgent:
    def __init__(self, name, prompt_file=None):
        self.name = name
        self.system_prompt = ""
        if prompt_file:
            self.load_prompt(prompt_file)

    def load_prompt(self, filename):
        """Loads the system prompt from the prompts directory."""
        try:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            prompts_dir = os.path.join(os.path.dirname(current_dir), "prompts")
            file_path = os.path.join(prompts_dir, filename)

            with open(file_path, encoding="utf-8") as f:
                self.system_prompt = f.read()
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

    async def call_gemini(self, user_content, model_id=None):
        """Calls the Gemini API with the system prompt and user content, expecting JSON."""
        if not client:
            return {"error": "Gemini API key not found"}

        if not model_id:
            model_id = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

        try:
            start_time = time.time()

            # Use system_instruction in config
            def do_generate():
                return client.models.generate_content(
                    model=model_id,
                    contents=user_content,
                    config=genai.types.GenerateContentConfig(
                        system_instruction=self.system_prompt, response_mime_type="application/json"
                    ),
                )

            response = await asyncio.to_thread(do_generate)
            elapsed = time.time() - start_time
            print(f"  [{self.name}] AI response received in {elapsed:.2f}s")

            text = response.text.strip()
            # Cleanup markdown if present
            if text.startswith("```json"):
                text = text[7:-3]
            elif text.startswith("```"):
                text = text[3:-3]

            parsed = json.loads(text)
            if isinstance(parsed, list):
                if parsed:
                    parsed = parsed[0]
                else:
                    parsed = {}

            return BaseAgent.sanitize_data(parsed)
        except Exception as e:
            print(f"Gemini JSON Error ({self.name}): {e}")
            return {"error": str(e), "signal": "NEUTRAL"}

    async def call_gemini_text(self, user_content, model_id=None, system_instruction=None):
        """Calls the Gemini API expecting plain text response (Chat)."""
        if not client:
            return "Error: Gemini API key not found"

        if not model_id:
            model_id = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

        try:
            start_time = time.time()
            # Use provided instruction or fallback to class default
            instruction = system_instruction if system_instruction else self.system_prompt

            def do_generate():
                return client.models.generate_content(
                    model=model_id,
                    contents=user_content,
                    config=genai.types.GenerateContentConfig(system_instruction=instruction),
                )

            response = await asyncio.to_thread(do_generate)
            elapsed = time.time() - start_time
            print(f"  [{self.name}] AI text response received in {elapsed:.2f}s")
            return response.text.strip()
        except Exception as e:
            print(f"Gemini Text Error ({self.name}): {e}")
            return f"I encountered an error: {str(e)}"

    async def chat(self, message, context=None):
        """
        Chat with the agent.
        Context should include previous analysis if available.
        """
        print(f"[{self.name}] Chatting...")

        # Get current datetime for grounding
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
        CRITICAL: The current date is {now.strftime('%B %d, %Y')}. If you reference any historical events or dates, make it clear they are in the past relative to TODAY.
        STRICT: Skip long introductory greetings or filler (e.g., "Understood", "As the Chartist..."). Start the response DIRECTLY with the relevant information.
        """

        return await self.call_gemini_text(
            prompt,
            system_instruction=f"You are {self.name}, an expert AI trading assistant. The current date is {now.strftime('%B %d, %Y')}. Answer the user's questions clearly and professionally in plain text. Do NOT use MARKDOWN JSON formatting. Do NOT reference outdated information from your training data as if it were current.",
        )

    async def analyze(self, data):
        raise NotImplementedError

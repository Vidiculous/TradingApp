import json

from .base import BaseAgent


class RiskOfficer(BaseAgent):
    def __init__(self):
        super().__init__("RiskOfficer", "risk_officer.md")

    async def validate(self, context):
        print("  [RiskOfficer] Validating trade...")
        try:
            trade_plan = context.get("trade_plan", {})
            portfolio = context.get("portfolio", {})

            # Format content for LLM
            plan_text = json.dumps(trade_plan, indent=2)
            portfolio_text = json.dumps(portfolio, indent=2)

            prompt_content = f"""
            Proposed Trade Plan:
            {plan_text}
            
            Current Portfolio State:
            {portfolio_text}
            
            Validate this trade against risk management rules.
            """

            response = await self.call_gemini(prompt_content)
            return response

        except Exception as e:
            print(f"  [RiskOfficer] Error: {e}")
            return {"approved": False, "veto_reason": f"Error: {str(e)}"}

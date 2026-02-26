import json

from .base import BaseAgent


class RiskOfficer(BaseAgent):
    def __init__(self):
        super().__init__("RiskOfficer", "risk_officer.md")

    def _run_deterministic_checks(self, trade_plan: dict, portfolio: dict) -> list[dict]:
        """Run hard-coded risk checks before the LLM call.

        Returns a list of check results, each a dict with keys:
            - check: name of the check
            - passed: bool
            - detail: human-readable explanation
        """
        results: list[dict] = []
        action = str(trade_plan.get("action", "")).upper()

        entry_zone_str = trade_plan.get("entry_zone", "")
        entry = trade_plan.get("entry")
        if entry is None and entry_zone_str:
            try:
                parts = [float(x.strip()) for x in str(entry_zone_str).split("-") if x.strip()]
                entry = sum(parts) / len(parts) if parts else None
            except (ValueError, TypeError):
                pass
        stop_loss = trade_plan.get("stop_loss")
        target = trade_plan.get("target")

        # --- 1. Stop-loss sanity check ---
        if entry is not None and stop_loss is not None and action in ("BUY", "SELL"):
            try:
                entry_f = float(entry)
                sl_f = float(stop_loss)
                if action == "BUY":
                    # For a BUY, stop_loss must be meaningfully below entry (at least 2% gap)
                    if entry_f > 0 and sl_f >= entry_f * (1 - 0.02):
                        results.append({
                            "check": "stop_loss_sanity",
                            "passed": False,
                            "detail": (
                                f"Stop loss is on the wrong side of entry. "
                                f"For a BUY, stop_loss ({sl_f}) must be below "
                                f"entry ({entry_f}) by more than 2%."
                            ),
                        })
                    else:
                        results.append({
                            "check": "stop_loss_sanity",
                            "passed": True,
                            "detail": (
                                f"Stop loss ({sl_f}) is correctly below entry ({entry_f}) for BUY."
                            ),
                        })
                elif action == "SELL":
                    # For a SELL, stop_loss must be meaningfully above entry (at least 2% gap)
                    if entry_f > 0 and sl_f <= entry_f * (1 + 0.02):
                        results.append({
                            "check": "stop_loss_sanity",
                            "passed": False,
                            "detail": (
                                f"Stop loss is on the wrong side of entry. "
                                f"For a SELL, stop_loss ({sl_f}) must be above "
                                f"entry ({entry_f}) by more than 2%."
                            ),
                        })
                    else:
                        results.append({
                            "check": "stop_loss_sanity",
                            "passed": True,
                            "detail": (
                                f"Stop loss ({sl_f}) is correctly above entry ({entry_f}) for SELL."
                            ),
                        })
            except (ValueError, TypeError):
                pass  # Non-numeric values; skip this check

        # --- 2. Risk:Reward ratio check (>= 2:1) ---
        if entry is not None and stop_loss is not None and target is not None:
            try:
                entry_f = float(entry)
                sl_f = float(stop_loss)
                target_f = float(target)
                risk = abs(entry_f - sl_f)
                reward = abs(target_f - entry_f)
                if risk > 0:
                    rr_ratio = reward / risk
                    if rr_ratio < 2.0:
                        results.append({
                            "check": "risk_reward_ratio",
                            "passed": False,
                            "detail": (
                                f"Risk:Reward ratio is {rr_ratio:.2f}:1 which is below "
                                f"the required minimum of 2:1. "
                                f"(risk={risk:.4f}, reward={reward:.4f})"
                            ),
                        })
                    else:
                        results.append({
                            "check": "risk_reward_ratio",
                            "passed": True,
                            "detail": (
                                f"Risk:Reward ratio is {rr_ratio:.2f}:1, meets the 2:1 minimum. "
                                f"(risk={risk:.4f}, reward={reward:.4f})"
                            ),
                        })
            except (ValueError, TypeError):
                pass  # Non-numeric values; skip this check

        # --- 3. Max position size (10% of portfolio value) ---
        position_value = trade_plan.get("position_value")
        if position_value is None:
            # Try to compute from quantity * entry
            qty = trade_plan.get("quantity") or trade_plan.get("qty") or trade_plan.get("size")
            if qty is not None and entry is not None:
                try:
                    position_value = float(qty) * float(entry)
                except (ValueError, TypeError):
                    position_value = None

        if position_value is not None:
            try:
                position_value_f = float(position_value)
                cash = float(portfolio.get("cash", 0))
                total_value = float(
                    portfolio.get("total_value", portfolio.get("cash", 100000))
                )
                max_allowed = total_value * 0.10
                if position_value_f > max_allowed:
                    results.append({
                        "check": "max_position_size",
                        "passed": False,
                        "detail": (
                            f"Position value (${position_value_f:,.2f}) exceeds 10% of "
                            f"total portfolio value (${total_value:,.2f}). "
                            f"Maximum allowed: ${max_allowed:,.2f}."
                        ),
                    })
                else:
                    results.append({
                        "check": "max_position_size",
                        "passed": True,
                        "detail": (
                            f"Position value (${position_value_f:,.2f}) is within 10% of "
                            f"total portfolio value (${total_value:,.2f})."
                        ),
                    })
            except (ValueError, TypeError):
                pass  # Non-numeric values; skip this check

        return results

    async def validate(self, context):
        print("  [RiskOfficer] Validating trade...")
        try:
            trade_plan = context.get("trade_plan", {})
            portfolio = context.get("portfolio", {})
            action = str(trade_plan.get("action", "")).upper()

            # If action is HOLD, skip all checks and approve automatically
            if action == "HOLD":
                print("  [RiskOfficer] Action is HOLD — auto-approved, skipping checks.")
                return {
                    "approved": True,
                    "reasoning": "HOLD action requires no risk validation.",
                    "conclusion": "APPROVED",
                    "deterministic_checks": [],
                }

            # Run deterministic checks before LLM call
            check_results = self._run_deterministic_checks(trade_plan, portfolio)

            failed_checks = [c for c in check_results if not c["passed"]]
            if failed_checks:
                veto_reasons = "; ".join(c["detail"] for c in failed_checks)
                print(f"  [RiskOfficer] Deterministic veto: {veto_reasons}")
                return {
                    "approved": False,
                    "veto_reason": veto_reasons,
                    "deterministic_checks": check_results,
                }

            # All deterministic checks passed — include results as context for LLM
            checks_text = json.dumps(check_results, indent=2)
            plan_text = json.dumps(trade_plan, indent=2)
            portfolio_text = json.dumps(portfolio, indent=2)

            prompt_content = f"""
            Proposed Trade Plan:
            {plan_text}

            Current Portfolio State:
            {portfolio_text}

            Deterministic Risk Checks (all passed):
            {checks_text}

            The above deterministic checks have all passed. Now provide your qualitative
            risk assessment on top of these results. Validate this trade against risk
            management rules and add any additional concerns or observations.
            """

            response = await self.call_model(prompt_content, api_config=context.get("api_config"))

            # Attach deterministic check results to the LLM response
            if isinstance(response, dict):
                response["deterministic_checks"] = check_results
            return response

        except Exception as e:
            print(f"  [RiskOfficer] Error: {e}")
            return {"approved": False, "veto_reason": f"Error: {str(e)}"}

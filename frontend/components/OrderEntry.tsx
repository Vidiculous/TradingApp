"use client";

import { ChevronDown, DollarSign, RefreshCw, ShoppingCart } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { formatCurrency } from "../utils/format";

interface OrderEntryProps {
  symbol: string;
  currentPrice: number;
  currency: string;
  onOrderPlaced: () => void;
}

const CustomSelect = ({ value, onChange, options, disabled, label }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((o: any) => o.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
          {label}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="group flex w-full cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold text-white outline-none transition-all focus:border-emerald-500/50 focus:bg-white/10 disabled:opacity-30"
      >
        <span className="truncate">{selectedOption?.label || "Select..."}</span>
        <ChevronDown
          size={14}
          className={`text-gray-500 transition-transform group-hover:text-white ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="animate-fade-in absolute z-[100] mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-[#18181b]/95 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl">
          {options.map((opt: any) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-[10px] font-bold transition-colors ${value === opt.value
                ? "bg-emerald-500/20 text-emerald-400"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const OrderEntry = ({ symbol, currentPrice, currency, onOrderPlaced }: OrderEntryProps) => {
  const [mode, setMode] = useState<"OPEN" | "CLOSE">("OPEN"); // OPEN=BUY, CLOSE=SELL
  const [strategy, setStrategy] = useState<"LONG" | "SHORT">("LONG");
  const [currentPosition, setCurrentPosition] = useState<{ quantity: number; average_cost: number } | null>(null);
  const [qty, setQty] = useState(1);
  const [slType, setSlType] = useState<"fixed" | "trailing_fixed" | "trailing_pct">("fixed");
  const [stopLoss, setStopLoss] = useState<number | "">("");
  const [tpType, setTpType] = useState<"fixed" | "scaled" | "breakeven" | "trailing">("fixed");
  const [takeProfit, setTakeProfit] = useState<number | "">("");

  // Fetch current position for the symbol
  const fetchPosition = async () => {
    try {
      const res = await fetch("/api/paper/portfolio");
      if (res.ok) {
        const data = await res.json();
        const pos = data.holdings[symbol];
        setCurrentPosition(pos || null);
      }
    } catch (e) {
      console.error("Failed to fetch position", e);
    }
  };

  useEffect(() => {
    fetchPosition();
  }, [symbol]);

  // UI improvement: contrast for labels
  const labelStyle =
    "text-[10px] uppercase tracking-widest text-gray-400 font-bold block mb-1.5 transition-colors group-focus-within:text-emerald-400";

  // Advanced TP states
  const [scaledTargets, setScaledTargets] = useState([
    { price: "", pct: 0.5 },
    { price: "", pct: 0.5 },
  ]);
  const [beTarget, setBeTarget] = useState<number | "">("");
  const [traActivation, setTraActivation] = useState<number | "">("");
  const [traDistance, setTraDistance] = useState<number | "">("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const totalCost = qty * currentPrice;

  const playSuccessSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;

      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      // Nice cheerful chord arpeggio
      const now = ctx.currentTime;

      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      osc.frequency.setValueAtTime(1046.5, now + 0.3); // C6

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

      osc.start(now);
      osc.stop(now + 0.6);
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };

  const handleOrder = async () => {
    setLoading(true);
    setMessage("");

    try {
      // Determine side based on mode and strategy
      let finalSide: "BUY" | "SELL" = "BUY";
      if (mode === "OPEN") {
        finalSide = strategy === "LONG" ? "BUY" : "SELL";
      } else {
        // CLOSE mode: opposite of current holding
        if (!currentPosition || currentPosition.quantity === 0) {
          throw new Error("No position to close");
        }
        finalSide = currentPosition.quantity > 0 ? "SELL" : "BUY";
      }

      let tp_config: any = null;
      if (tpType === "scaled") {
        tp_config = {
          type: "scaled",
          targets: scaledTargets
            .filter((t) => t.price !== "")
            .map((t) => ({ price: Number(t.price), qty_pct: t.pct, triggered: false })),
        };
      } else if (tpType === "breakeven") {
        tp_config = { type: "breakeven", target: Number(beTarget), triggered: false };
      } else if (tpType === "trailing") {
        tp_config = {
          type: "trailing",
          activation_price: Number(traActivation),
          distance: Number(traDistance),
          active: false,
        };
      }

      const payload = {
        symbol,
        side: finalSide,
        qty,
        price: currentPrice,
        stop_loss: stopLoss === "" ? null : stopLoss,
        sl_type: slType,
        take_profit: tpType === "fixed" ? (takeProfit === "" ? null : takeProfit) : null,
        tp_config,
      };

      const res = await fetch("/api/paper/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Order failed");
      }

      setMessage("Order Filled!");
      playSuccessSound();
      fetchPosition(); // Refresh local position state
      onOrderPlaced();

      // Clear message after 3s
      setTimeout(() => setMessage(""), 3000);
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel rounded-3xl p-6">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
        <ShoppingCart className="text-emerald-400" size={18} />
        Trade {symbol}
      </h3>

      {/* Mode Toggle (BUY/SELL) */}
      <div className="mx-auto mb-3 flex max-w-[280px] rounded-lg bg-white/5 p-1">
        <button
          onClick={() => setMode("OPEN")}
          className={`flex-1 rounded-md py-1.5 text-xs font-bold transition-all ${mode === "OPEN"
            ? "bg-emerald-500 text-white shadow-sm"
            : "text-gray-400 hover:text-white"
            }`}
        >
          BUY
        </button>
        <button
          onClick={() => setMode("CLOSE")}
          className={`flex-1 rounded-md py-1.5 text-xs font-bold transition-all ${mode === "CLOSE"
            ? "bg-red-500 text-white shadow-sm"
            : "text-gray-400 hover:text-white"
            }`}
        >
          SELL
        </button>
      </div>

      {mode === "OPEN" ? (
        <div className="mx-auto mb-4 flex max-w-[200px] gap-1 rounded-lg border border-white/5 bg-black/20 p-1">
          <button
            onClick={() => setStrategy("LONG")}
            className={`flex-1 rounded px-2 py-1 text-[10px] font-black uppercase transition-all ${strategy === "LONG" ? "bg-emerald-500/20 text-emerald-400" : "text-gray-600 hover:text-gray-400"
              }`}
          >
            Long
          </button>
          <button
            onClick={() => setStrategy("SHORT")}
            className={`flex-1 rounded px-2 py-1 text-[10px] font-black uppercase transition-all ${strategy === "SHORT" ? "bg-red-500/20 text-red-400" : "text-gray-600 hover:text-gray-400"
              }`}
          >
            Short
          </button>
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
            Current Position
          </span>
          <div className="mt-1 font-mono text-sm font-bold text-white">
            {currentPosition && currentPosition.quantity !== 0 ? (
              <>
                {Math.abs(currentPosition.quantity)} {currentPosition.quantity > 0 ? "LONG" : "SHORT"}
                <span className="ml-2 text-xs font-normal text-gray-500">
                  @ {formatCurrency(currentPosition.average_cost, currency)}
                </span>
              </>
            ) : (
              <span className="text-gray-600">No Position</span>
            )}
          </div>
        </div>
      )}

      {/* Inputs - Only show strategy inputs if opening */}
      <div className="mb-3 space-y-3">
        {/* Quantity - Full Width */}
        <div className="group">
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold block transition-colors group-focus-within:text-emerald-400">Quantity</label>
            {mode === "CLOSE" && currentPosition && (
              <button
                onClick={() => setQty(Math.abs(currentPosition.quantity))}
                className="text-[9px] font-black uppercase text-blue-400 hover:text-blue-300 transition-colors"
                type="button"
              >
                Max: {Math.abs(currentPosition.quantity)}
              </button>
            )}
          </div>
          <input
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 font-mono text-white outline-none transition-all focus:border-emerald-500/50 focus:bg-white/10"
          />
        </div>

        {mode === "OPEN" && (
          <>
            {/* SL Type + TP Type - Same Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <CustomSelect
                  label="SL Type"
                  value={slType}
                  onChange={(val: any) => setSlType(val)}
                  options={[
                    { value: "fixed", label: "Fixed Price" },
                    { value: "trailing_fixed", label: "Trail ($)" },
                    { value: "trailing_pct", label: "Trail (%)" },
                  ]}
                />
              </div>
              <div>
                <CustomSelect
                  label="TP Type"
                  value={tpType}
                  onChange={(val: any) => setTpType(val)}
                  options={[
                    { value: "fixed", label: "Single Target" },
                    { value: "scaled", label: "Scaled (Multi)" },
                    { value: "breakeven", label: "Breakeven Trigger" },
                    { value: "trailing", label: "Trailing Activation" },
                  ]}
                />
              </div>
            </div>

            <div className="space-y-3 border-t border-white/5 pt-3">
              <div className="group flex flex-col gap-2">
                <label className={labelStyle}>
                  {slType === "fixed" ? "Stop Loss ($)" : "SL Distance"}
                </label>
                <input
                  type="number"
                  placeholder={slType === "fixed" ? "e.g. 150.00" : "e.g. 2.50"}
                  step="0.01"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 font-mono text-white outline-none transition-all placeholder:text-gray-700 focus:border-emerald-500/50 focus:bg-white/10"
                />
              </div>

              {tpType === "fixed" && (
                <div className="group flex flex-col gap-2">
                  <label className={labelStyle}>Target Price ($)</label>
                  <input
                    type="number"
                    placeholder="e.g. 210.00"
                    step="0.01"
                    value={takeProfit}
                    onChange={(e) =>
                      setTakeProfit(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-white outline-none transition-all placeholder:text-gray-700 focus:border-emerald-500/50 focus:bg-white/10"
                  />
                </div>
              )}

              {tpType === "scaled" && (
                <div className="space-y-3">
                  <label className={labelStyle}>Scaled Targets</label>
                  {scaledTargets.map((t, i) => (
                    <div key={i} className="group/target flex gap-2">
                      <input
                        type="number"
                        placeholder={`Target ${i + 1}`}
                        value={t.price}
                        onChange={(e) => {
                          const newTargets = [...scaledTargets];
                          newTargets[i].price = e.target.value;
                          setScaledTargets(newTargets);
                        }}
                        className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-white outline-none transition-all focus:border-emerald-500/50"
                      />
                      <div className="w-24">
                        <CustomSelect
                          value={t.pct}
                          onChange={(val: any) => {
                            const newTargets = [...scaledTargets];
                            newTargets[i].pct = Number(val);
                            setScaledTargets(newTargets);
                          }}
                          options={[
                            { value: 0.25, label: "25%" },
                            { value: 0.5, label: "50%" },
                            { value: 1.0, label: "100%" },
                          ]}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tpType === "breakeven" && (
                <div className="group flex flex-col gap-2">
                  <label className={labelStyle}>Trigger Price ($)</label>
                  <input
                    type="number"
                    placeholder="Move SL to BE at..."
                    value={beTarget}
                    onChange={(e) => setBeTarget(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-white outline-none transition-all focus:border-emerald-500/50 focus:bg-white/10"
                  />
                </div>
              )}

              {tpType === "trailing" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="group">
                    <label className={labelStyle}>Activation</label>
                    <input
                      type="number"
                      placeholder="Start at..."
                      value={traActivation}
                      onChange={(e) =>
                        setTraActivation(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-white outline-none transition-all focus:border-emerald-500/50"
                    />
                  </div>
                  <div className="group">
                    <label className={labelStyle}>Trail ($)</label>
                    <input
                      type="number"
                      placeholder="Dist."
                      value={traDistance}
                      onChange={(e) =>
                        setTraDistance(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-white outline-none transition-all focus:border-emerald-500/50"
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Est. Total
          </span>
          <span className="font-mono text-xl font-black text-white">
            {formatCurrency(totalCost, currency)}
          </span>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleOrder}
        disabled={loading || qty <= 0 || (mode === "CLOSE" && (!currentPosition || currentPosition.quantity === 0))}
        className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all ${loading || (mode === "CLOSE" && (!currentPosition || currentPosition.quantity === 0))
          ? "cursor-not-allowed bg-gray-700 opacity-50"
          : mode === "OPEN"
            ? (strategy === "LONG" ? "bg-emerald-500 shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)]" : "bg-red-500 shadow-[0_0_20px_-5px_rgba(239,68,68,0.4)]")
            : "bg-blue-600 shadow-[0_0_20px_-5px_rgba(37,99,235,0.4)]"
          } text-white`}
      >
        {loading ? <RefreshCw className="animate-spin" size={16} /> : <DollarSign size={16} />}
        {mode === "OPEN" ? (strategy === "LONG" ? "Go Long" : "Go Short") : "Close Position"} {symbol}
      </button>

      {message && (
        <div
          className={`mt-3 text-center text-xs font-bold ${message.includes("Error") ? "text-red-400" : "text-emerald-400"}`}
        >
          {message}
        </div>
      )}
    </div>
  );
};

"use client";

import { Bell, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Alert {
  id: string;
  symbol: string;
  target_price: number;
  condition: "ABOVE" | "BELOW";
}

function showToast(message: string) {
  const toast = document.createElement("div");
  toast.className =
    "fixed top-6 right-6 bg-blue-600 text-white px-6 py-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[99999] animate-in slide-in-from-right duration-300 font-bold border border-white/20 backdrop-blur-md";

  const flex = document.createElement("div");
  flex.className = "flex items-center gap-3";

  const iconWrap = document.createElement("div");
  iconWrap.className = "p-2 bg-white/20 rounded-lg";
  iconWrap.innerHTML =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';

  const textWrap = document.createElement("div");
  const label = document.createElement("div");
  label.className = "text-[10px] opacity-70 uppercase tracking-widest font-black";
  label.textContent = "Alert Triggered";
  const body = document.createElement("div");
  body.className = "text-sm";
  body.textContent = message;
  textWrap.appendChild(label);
  textWrap.appendChild(body);

  flex.appendChild(iconWrap);
  flex.appendChild(textWrap);
  toast.appendChild(flex);
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("animate-out", "fade-out", "slide-out-to-right");
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

export const AlertsCenter = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [condition, setCondition] = useState<"ABOVE" | "BELOW">("ABOVE");
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Track previous alerts to detect triggered ones (deleted by backend on fire)
  const prevAlerts = useRef<Alert[]>([]);
  const initialized = useRef(false);

  const fetchAlerts = async () => {
    try {
      const res = await fetch("/api/alerts");
      if (!res.ok) return;
      const data: Alert[] = await res.json();

      // Detect triggered alerts: present in previous poll but gone now
      if (initialized.current) {
        const currentIds = new Set(data.map((a) => a.id));
        for (const prev of prevAlerts.current) {
          if (!currentIds.has(prev.id)) {
            showToast(`${prev.symbol} alert triggered at $${prev.target_price}`);
          }
        }
      }

      prevAlerts.current = data;
      initialized.current = true;
      setAlerts(data);
    } catch (e) {
      console.error(e);
    }
  };

  const addAlert = async () => {
    if (!symbol || !targetPrice) return;
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: symbol.toUpperCase().trim(),
          target_price: parseFloat(targetPrice),
          condition,
        }),
      });
      if (res.ok) {
        setSymbol("");
        setTargetPrice("");
        fetchAlerts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const removeAlert = async (id: string) => {
    try {
      await fetch(`/api/alerts/${id}`, { method: "DELETE" });
      fetchAlerts();
    } catch (e) {
      console.error(e);
    }
  };

  // Initial fetch + poll every 30 seconds
  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Group alerts by symbol
  const grouped = alerts.reduce<Record<string, Alert[]>>((acc, a) => {
    if (!acc[a.symbol]) acc[a.symbol] = [];
    acc[a.symbol].push(a);
    return acc;
  }, {});

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen((o) => !o)}
        className={`rounded-lg border border-white/5 bg-white/5 p-1.5 transition-all ${
          alerts.length > 0 ? "text-blue-400 hover:text-blue-300" : "text-gray-500 hover:text-white"
        }`}
        aria-label="Alerts Center"
        title="Alerts Center"
      >
        <div className="relative">
          <Bell size={16} />
          {alerts.length > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[9px] font-black text-white">
              {alerts.length > 9 ? "9+" : alerts.length}
            </span>
          )}
        </div>
      </button>

      {isOpen &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
            <div
              className="animate-in zoom-in-95 fixed z-[9999] w-80 rounded-2xl border border-white/10 bg-[#18181b] shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl duration-200"
              style={{
                top: buttonRef.current
                  ? buttonRef.current.getBoundingClientRect().bottom + 8
                  : 60,
                right: 16,
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                <h3 className="flex items-center gap-2 font-bold text-white">
                  <Bell size={14} className="text-blue-400" />
                  Alerts Center
                </h3>
                <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white">
                  <X size={14} />
                </button>
              </div>

              {/* Add new alert form */}
              <div className="border-b border-white/5 p-4">
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-600">
                  New Alert
                </p>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Ticker (e.g. AAPL)"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white uppercase placeholder:normal-case placeholder:text-gray-600 outline-none focus:border-blue-500/50"
                  />
                  <div className="flex gap-2 text-xs">
                    <button
                      onClick={() => setCondition("ABOVE")}
                      className={`flex-1 rounded-md py-1.5 font-bold transition-colors ${
                        condition === "ABOVE"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-white/5 text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      ABOVE
                    </button>
                    <button
                      onClick={() => setCondition("BELOW")}
                      className={`flex-1 rounded-md py-1.5 font-bold transition-colors ${
                        condition === "BELOW"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-white/5 text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      BELOW
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Price…"
                      value={targetPrice}
                      onChange={(e) => setTargetPrice(e.target.value)}
                      className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500/50"
                    />
                    <button
                      onClick={addAlert}
                      disabled={!symbol || !targetPrice}
                      className="flex items-center justify-center rounded-lg bg-blue-600 px-3 text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Alert list grouped by symbol */}
              <div className="custom-scrollbar max-h-64 overflow-y-auto p-3">
                {Object.keys(grouped).length === 0 ? (
                  <p className="py-6 text-center text-xs italic text-gray-600">No active alerts</p>
                ) : (
                  Object.entries(grouped).map(([sym, symAlerts]) => (
                    <div key={sym} className="mb-3">
                      <p className="mb-1.5 px-1 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        {sym}
                      </p>
                      <div className="space-y-1.5">
                        {symAlerts.map((alert) => (
                          <div
                            key={alert.id}
                            className="group flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-bold ${
                                  alert.condition === "ABOVE"
                                    ? "text-emerald-400"
                                    : "text-red-400"
                                }`}
                              >
                                {alert.condition === "ABOVE" ? "↑" : "↓"}
                              </span>
                              <span className="font-mono text-gray-200">
                                ${alert.target_price.toLocaleString()}
                              </span>
                            </div>
                            <button
                              onClick={() => removeAlert(alert.id)}
                              className="text-gray-600 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
};

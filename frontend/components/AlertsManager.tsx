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

interface AlertsManagerProps {
  symbol: string;
  currentPrice: number;
}

export const AlertsManager = ({ symbol, currentPrice }: AlertsManagerProps) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [targetPrice, setTargetPrice] = useState<string>("");
  const [condition, setCondition] = useState<"ABOVE" | "BELOW">("ABOVE");
  const buttonRef = useRef<HTMLButtonElement>(null);

  // To prevent spamming toasts for the same crossing
  const triggeredAlerts = useRef<Set<string>>(new Set());

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`/api/alerts?symbol=${symbol}`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const addAlert = async () => {
    if (!targetPrice) return;
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          target_price: parseFloat(targetPrice),
          condition,
        }),
      });
      if (res.ok) {
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

  // Initial fetch and permission request
  useEffect(() => {
    if (isOpen) fetchAlerts();

    // Request notification permission if not already granted
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [isOpen, symbol]);

  // Monitoring Logic
  useEffect(() => {
    if (alerts.length === 0) return;

    alerts.forEach((alert) => {
      if (triggeredAlerts.current.has(alert.id)) return;

      let fileTriggered = false;
      if (alert.condition === "ABOVE" && currentPrice >= alert.target_price) {
        fileTriggered = true;
      } else if (alert.condition === "BELOW" && currentPrice <= alert.target_price) {
        fileTriggered = true;
      }

      if (fileTriggered) {
        const message = `${symbol} crossed ${alert.condition} $${alert.target_price}`;

        // 1. Native OS Notification
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(`Price Alert: ${symbol}`, {
            body: message,
            icon: "/favicon.ico", // Optional: path to an icon
          });
        }

        // 2. In-App Visual feedback (Fallback/Extra layering fix)
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
        label.textContent = "Market Alert";
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

        triggeredAlerts.current.add(alert.id);
      }
    });
  }, [currentPrice, alerts, symbol]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`rounded-lg p-2 transition-colors ${isOpen || alerts.length > 0 ? "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
        title="Price Alerts"
      >
        <div className="relative">
          <Bell size={20} />
          {alerts.length > 0 && (
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-blue-500" />
          )}
        </div>
      </button>

      {/* Popover Panel */}
      {isOpen &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
            <div
              className="animate-in zoom-in-95 fixed z-[9999] w-80 rounded-2xl border border-white/10 bg-[#18181b] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl duration-200"
              style={{
                top: buttonRef.current ? buttonRef.current.getBoundingClientRect().bottom + 8 : 0,
                left: buttonRef.current ? buttonRef.current.getBoundingClientRect().right - 320 : 0,
              }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-bold text-white">
                  <Bell size={16} className="text-blue-400" />
                  Alerts for {symbol}
                </h3>
                <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              {/* Add New */}
              <div className="mb-4 space-y-2 rounded-xl bg-white/5 p-3">
                <div className="flex gap-2 text-xs">
                  <button
                    onClick={() => setCondition("ABOVE")}
                    className={`flex-1 rounded-md py-1.5 font-bold transition-colors ${condition === "ABOVE" ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-gray-500 hover:text-gray-300"}`}
                  >
                    ABOVE
                  </button>
                  <button
                    onClick={() => setCondition("BELOW")}
                    className={`flex-1 rounded-md py-1.5 font-bold transition-colors ${condition === "BELOW" ? "bg-red-500/20 text-red-400" : "bg-white/5 text-gray-500 hover:text-gray-300"}`}
                  >
                    BELOW
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Price..."
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500/50"
                  />
                  <button
                    onClick={addAlert}
                    disabled={!targetPrice}
                    className="flex items-center justify-center rounded-lg bg-blue-600 px-3 text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="custom-scrollbar max-h-40 space-y-2 overflow-y-auto">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="group flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"
                  >
                    <div>
                      <span
                        className={`mr-2 text-xs font-bold ${alert.condition === "ABOVE" ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {alert.condition === "ABOVE" ? ">" : "<"}
                      </span>
                      <span className="font-mono text-gray-200">${alert.target_price}</span>
                    </div>
                    <button
                      onClick={() => removeAlert(alert.id)}
                      className="text-gray-600 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {alerts.length === 0 && (
                  <div className="py-4 text-center text-xs italic text-gray-600">
                    No active alerts
                  </div>
                )}
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
};

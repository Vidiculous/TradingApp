"use client";

import { Calendar, Clock } from "lucide-react";
import { useEffect, useState } from "react";

interface EconomicEvent {
  id: string;
  date: string;
  time: string;
  event: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  actual: string;
  forecast: string;
  status: "COMPLETED" | "UPCOMING";
}

export const EconomicCalendar = () => {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCalendar = async () => {
      try {
        const res = await fetch("/api/market/calendar");
        if (res.ok) {
          const data = await res.json();
          setEvents(data?.events || data || []);
        }
      } catch (error) {
        console.error("Failed to fetch calendar", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCalendar();
  }, []);

  if (loading) return <div className="h-40 animate-pulse rounded-3xl bg-white/5" />;

  return (
    <div className="glass-panel rounded-3xl p-6">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
        <Calendar className="text-blue-400" size={18} />
        Economic Calendar
      </h3>

      <div className="space-y-3">
        {events.slice(0, 5).map((evt) => (
          <div key={evt.id} className="group flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex min-w-[30px] flex-col items-center">
                <span className="font-mono text-[10px] text-gray-500">{evt.time}</span>
                <div
                  className={`mt-1 h-1.5 w-1.5 rounded-full ${
                    evt.impact === "HIGH"
                      ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                      : evt.impact === "MEDIUM"
                        ? "bg-orange-500"
                        : "bg-blue-400"
                  }`}
                ></div>
              </div>

              <div className="flex flex-col">
                <span
                  className={`text-sm font-medium transition-colors ${evt.impact === "HIGH" ? "text-gray-200 group-hover:text-white" : "text-gray-400 group-hover:text-gray-300"}`}
                >
                  {evt.event}
                </span>
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  <span>Fcst: {evt.forecast}</span>
                  {evt.actual !== "-" && (
                    <span className="text-emerald-400">Act: {evt.actual}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-white/5 pt-3 text-center">
        <button className="text-xs text-blue-400 transition-colors hover:text-blue-300">
          View Weekly Schedule
        </button>
      </div>
    </div>
  );
};

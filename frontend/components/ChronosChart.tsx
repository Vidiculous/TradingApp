"use client";

import { useEffect, useRef } from "react";

export interface StepData {
  step: number;
  median: number;
  q10: number;
  q90: number;
}

export interface HistoryPoint {
  date: string; // "YYYY-MM-DD"
  close: number;
}

interface ChronosChartProps {
  currentPrice: number;
  forecastStepsData: StepData[];
  horizon: string;
  isUp: boolean;
  history?: HistoryPoint[];
  height?: number;
  zoomable?: boolean;
}

function toUnixSec(dateStr: string): number {
  // Parse YYYY-MM-DD as UTC midnight
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 1000);
}

function addBusinessDays(baseUtcMs: number, n: number): number {
  let ms = baseUtcMs;
  let added = 0;
  while (added < n) {
    ms += 86400_000;
    const dow = new Date(ms).getUTCDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return Math.floor(ms / 1000);
}

export function ChronosChart({
  currentPrice,
  forecastStepsData,
  horizon,
  isUp,
  history = [],
  height = 200,
  zoomable = false,
}: ChronosChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let chart: any = null;
    let ro: ResizeObserver | null = null;
    let cancelled = false;

    (async () => {
      try {
        const LWC = await import("lightweight-charts");
        if (cancelled || !containerRef.current) return;

        const { createChart, ColorType, LineSeries } = LWC as any;

        containerRef.current.innerHTML = "";

        const accentColor = isUp ? "#34d399" : "#f87171";

        chart = createChart(containerRef.current, {
          layout: {
            background: { type: ColorType.Solid, color: "transparent" },
            textColor: "rgba(156,163,175,0.85)",
            fontSize: 11,
          },
          width: containerRef.current.clientWidth,
          height,
          grid: {
            vertLines: { color: "rgba(255,255,255,0.04)" },
            horzLines: { color: "rgba(255,255,255,0.04)" },
          },
          crosshair: { mode: 1 },
          timeScale: {
            timeVisible: false,
            borderColor: "rgba(255,255,255,0.08)",
            fixLeftEdge: !zoomable,
            fixRightEdge: !zoomable,
          },
          rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
          handleScroll: zoomable,
          handleScale: zoomable,
        });

        // ── Series ─────────────────────────────────────────────────────────
        const priceSeries = chart.addSeries(LineSeries, {
          color: "rgba(255,255,255,0.65)",
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          title: "Price",
        });

        const medianSeries = chart.addSeries(LineSeries, {
          color: accentColor,
          lineWidth: 2,
          priceLineVisible: true,
          lastValueVisible: true,
          title: "Median",
        });

        const q90Series = chart.addSeries(LineSeries, {
          color: "rgba(139,92,246,0.75)",
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          title: "Q90",
        });

        const q10Series = chart.addSeries(LineSeries, {
          color: "rgba(139,92,246,0.75)",
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          title: "Q10",
        });

        // ── Build time values ───────────────────────────────────────────────

        // Today at UTC midnight in ms
        const todayMs = Date.UTC(
          new Date().getUTCFullYear(),
          new Date().getUTCMonth(),
          new Date().getUTCDate()
        );
        const nowSec = Math.floor(todayMs / 1000);

        // Historical bars — sorted ascending, deduped
        const histData: { time: number; value: number }[] = [];
        const seen = new Set<number>();
        for (const h of history) {
          const t = toUnixSec(h.date);
          if (!seen.has(t)) { seen.add(t); histData.push({ time: t, value: h.close }); }
        }
        histData.sort((a, b) => a.time - b.time);

        // "Now" anchor — only append if not already the last history bar
        const lastHistTime = histData.length > 0 ? histData[histData.length - 1].time : -1;
        const nowPoint = { time: nowSec, value: currentPrice };
        const priceData =
          histData.length === 0
            ? [nowPoint]
            : lastHistTime === nowSec
            ? histData                          // today already in history
            : [...histData, nowPoint];

        // Forecast timestamps (business days forward from today)
        const fMedian = forecastStepsData.map((s) => ({
          time: addBusinessDays(todayMs, s.step),
          value: s.median,
        }));
        const fQ90 = forecastStepsData.map((s) => ({
          time: addBusinessDays(todayMs, s.step),
          value: s.q90,
        }));
        const fQ10 = forecastStepsData.map((s) => ({
          time: addBusinessDays(todayMs, s.step),
          value: s.q10,
        }));

        // ── Set data ────────────────────────────────────────────────────────
        if (priceData.length > 0) priceSeries.setData(priceData as any);
        if (fMedian.length > 0) medianSeries.setData([nowPoint, ...fMedian] as any);
        if (fQ90.length > 0) q90Series.setData([nowPoint, ...fQ90] as any);
        if (fQ10.length > 0) q10Series.setData([nowPoint, ...fQ10] as any);

        // ── Visible range ───────────────────────────────────────────────────
        if (zoomable && histData.length >= 5) {
          const from = histData[histData.length - 5].time;
          const to   = fMedian.length ? fMedian[fMedian.length - 1].time : nowSec;
          chart.timeScale().setVisibleRange({ from, to });
        } else {
          chart.timeScale().fitContent();
        }

        // ── Resize observer ─────────────────────────────────────────────────
        ro = new ResizeObserver(() => {
          if (containerRef.current && chart) {
            chart.applyOptions({ width: containerRef.current.clientWidth });
          }
        });
        ro.observe(containerRef.current);

      } catch (err) {
        console.error("[ChronosChart] Failed to initialize chart:", err);
      }
    })();

    return () => {
      cancelled = true;
      if (ro) ro.disconnect();
      if (chart) { try { chart.remove(); } catch (_) {} }
    };
  // stringify arrays so React detects deep changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPrice, isUp, height, zoomable, JSON.stringify(forecastStepsData), JSON.stringify(history)]);

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}

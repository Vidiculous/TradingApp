"use client";

import type {
  IChartApi,
  ISeriesApi,
  Time,
  SeriesOptionsCommon,
} from "lightweight-charts";
import { Info } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../contexts/ThemeContext";

interface ChartProps {
  data: any[];
  colors?: {
    backgroundColor?: string;
    lineColor?: string;
    textColor?: string;
    areaTopColor?: string;
    areaBottomColor?: string;
  };
  interval?: string;
  symbol?: string;
  activeIndicator?: "NONE" | "RSI" | "MACD";
  activeOverlays?: Set<string>;
  chartType?: "candles" | "line" | "area";
  showMarkers?: boolean;
  history?: any[];
}

export const TradingViewChart = ({
  data,
  colors,
  interval,
  symbol,
  activeIndicator = "NONE",
  activeOverlays = new Set(),
  chartType = "candles",
  showMarkers = false,
  history = [],
}: ChartProps) => {
  const { theme } = useTheme();
  const isLight = theme === "light";

  const palette = useMemo(() => ({
    candleUp:      isLight ? "#059669" : "#10b981",
    candleDown:    isLight ? "#dc2626" : "#ef4444",
    lineColor:     isLight ? "#2563eb" : "#3b82f6",
    areaTop:       isLight ? "rgba(37,99,235,0.3)"  : "rgba(59,130,246,0.4)",
    areaBottom:    isLight ? "rgba(37,99,235,0.0)"  : "rgba(59,130,246,0.0)",
    textColor:     isLight ? "#374151" : "#d1d5db",
    subTextColor:  isLight ? "#6b7280" : "#9ca3af",
    gridColor:     isLight ? "rgba(0,0,0,0.08)"     : "rgba(255,255,255,0.05)",
    borderColor:   isLight ? "rgba(0,0,0,0.12)"     : "rgba(255,255,255,0.1)",
    watermark:     isLight ? "rgba(0,0,0,0.05)"     : "rgba(255,255,255,0.05)",
    rsiColor:      isLight ? "#7c3aed" : "#a855f7",
    macdFast:      isLight ? "#0891b2" : "#00E5FF",
    macdSignal:    isLight ? "#ca8a04" : "#FFEA00",
    macdHist:      "#26a69a",
    zeroLine:      isLight ? "rgba(0,0,0,0.3)"      : "rgba(255,255,255,0.5)",
    vwapColor:     "#2962FF",
    ema9Color:     isLight ? "#d97706" : "#FDD835",
    ema21Color:    isLight ? "#ea580c" : "#FB8C00",
  }), [isLight]);

  const mainChartContainerRef = useRef<HTMLDivElement>(null);
  const indicatorChartContainerRef = useRef<HTMLDivElement>(null);
  const mainChartRef = useRef<IChartApi | null>(null);
  const indicatorChartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Line"> | ISeriesApi<"Area"> | null>(null);
  // State for readiness
  const [isReady, setIsReady] = useState(false);
  const markersPrimitiveRef = useRef<any>(null); // Store marker primitive

  // Drawing State
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawings, setDrawings] = useState<number[]>([]);

  // Shift timestamp by local timezone offset for Lightweight Charts
  const getLocalTime = (ts: string | number | Date): Time => {
    const d = new Date(ts);
    return Math.floor(d.getTime() / 1000 - d.getTimezoneOffset() * 60) as Time;
  };

  // Load drawings
  useEffect(() => {
    if (!symbol) return;
    try {
      const saved = localStorage.getItem(`drawings_${symbol}`);
      if (saved) {
        setDrawings(JSON.parse(saved));
      } else {
        setDrawings([]);
      }
    } catch (e) {
      console.error(e);
    }
  }, [symbol]);

  // Save drawings
  useEffect(() => {
    if (!symbol) return;
    try {
      localStorage.setItem(`drawings_${symbol}`, JSON.stringify(drawings));
    } catch (e) {
      console.error(e);
    }
  }, [drawings, symbol]);

  // --- Main Chart Initialization ---
  useEffect(() => {
    if (!mainChartContainerRef.current) return;

    let isMounted = true;
    let resizeObserver: ResizeObserver | null = null;
    let mainChart: IChartApi | null = null;
    let indicatorChart: IChartApi | null = null;

    const initChart = async () => {
      const LWC = await import("lightweight-charts");
      console.log("[TradingViewChart] LWC library keys:", Object.keys(LWC));

      const {
        createChart,
        ColorType,
        CandlestickSeries,
        LineSeries,
        AreaSeries,
        HistogramSeries,
        createSeriesMarkers,
      } = LWC as any;

      (window as any).LWC_createSeriesMarkers = createSeriesMarkers; // Store for effect hook

      if (!isMounted) return;

      // Clear any existing chart content
      mainChartContainerRef.current!.innerHTML = "";
      if (indicatorChartContainerRef.current) {
        indicatorChartContainerRef.current.innerHTML = "";
      }

      mainChart = createChart(mainChartContainerRef.current!, {
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: colors?.textColor || palette.textColor,
        },
        width: mainChartContainerRef.current!.clientWidth,
        height: activeIndicator === "NONE" ? 400 : 300,
        grid: {
          vertLines: { color: palette.gridColor },
          horzLines: { color: palette.gridColor },
        },
        crosshair: {
          mode: isDrawing ? 1 : 0,
        },
        timeScale: {
          timeVisible: true,
          borderColor: palette.borderColor,
        },
        rightPriceScale: {
          borderColor: palette.borderColor,
        },
        watermark: {
          visible: true,
          fontSize: 64,
          horzAlign: "center",
          vertAlign: "center",
          color: palette.watermark,
          text: `${symbol} ${interval}`,
        },
      } as any);

      mainChartRef.current = mainChart;
      console.log("[TradingViewChart] mainChart keys:", Object.keys(mainChart || {}));

      let mainSeries: any;
      if (chartType === "candles") {
        mainSeries = mainChart.addSeries(CandlestickSeries, {
          upColor: palette.candleUp,
          downColor: palette.candleDown,
          borderVisible: false,
          wickUpColor: palette.candleUp,
          wickDownColor: palette.candleDown,
        });
      } else if (chartType === "line") {
        mainSeries = mainChart.addSeries(LineSeries, {
          color: palette.lineColor,
          lineWidth: 2,
        });
      } else {
        mainSeries = mainChart.addSeries(AreaSeries, {
          topColor: palette.areaTop,
          bottomColor: palette.areaBottom,
          lineColor: palette.lineColor,
        });
      }
      candleSeriesRef.current = mainSeries;
      (window as any).debug_candleSeries = mainSeries; // EXPOSE FOR DEBUGGING

      // Set Series Data
      const formattedData = data.map((d) => ({
        time: getLocalTime(d.timestamp),
        ...(chartType === "candles"
          ? { open: d.open, high: d.high, low: d.low, close: d.close }
          : { value: d.close }
        )
      }));
      mainSeries.setData(formattedData);

      // Restore Drawings
      drawings.forEach((price) => {
        mainSeries.createPriceLine({
          price,
          color: "#3b82f6",
          lineWidth: 2,
          lineStyle: 2, // Dashed
          axisLabelVisible: true,
          title: "Supp/Res",
        });
      });

      // Click Handler for Drawing
      mainChart.subscribeClick((param) => {
        if (param.point && param.seriesData.get(mainSeries)) {
          const price = mainSeries.coordinateToPrice(param.point.y);
          if (price) {
            setDrawings((prev) => [...prev, price]);
            setIsDrawing(false);
          }
        } else if (param.point) {
          const price = mainSeries.coordinateToPrice(param.point.y);
          if (price) {
            setDrawings((prev) => [...prev, price]);
            setIsDrawing(false);
          }
        }
      });

      // --- Overlays ---
      if (activeOverlays.has("VWAP")) {
        const vwapSeries = mainChart.addSeries(LineSeries, {
          color: palette.vwapColor,
          lineWidth: 2,
          crosshairMarkerVisible: false,
          lastValueVisible: false,
          priceLineVisible: false,
          title: "VWAP",
        });
        vwapSeries.setData(data.filter(d => d.vwap != null).map(d => ({
          time: getLocalTime(d.timestamp),
          value: d.vwap,
        })));
      }

      if (activeOverlays.has("EMA9")) {
        const ema9Series = mainChart.addSeries(LineSeries, {
          color: palette.ema9Color,
          lineWidth: 1,
          crosshairMarkerVisible: false,
          lastValueVisible: false,
          priceLineVisible: false,
          title: "EMA9",
        });
        const ema9Data = data
          .filter((d) => d.ema9 !== null && d.ema9 !== undefined)
          .map((d) => ({
            time: getLocalTime(d.timestamp),
            value: d.ema9,
          }));
        ema9Series.setData(ema9Data);
      }

      if (activeOverlays.has("EMA21")) {
        const ema21Series = mainChart.addSeries(LineSeries, {
          color: palette.ema21Color,
          lineWidth: 1,
          crosshairMarkerVisible: false,
          lastValueVisible: false,
          priceLineVisible: false,
          title: "EMA21",
        });
        const ema21Data = data
          .filter((d) => d.ema21 !== null && d.ema21 !== undefined)
          .map((d) => ({
            time: getLocalTime(d.timestamp),
            value: d.ema21,
          }));
        ema21Series.setData(ema21Data);
      }

      // --- Indicator Chart Setup ---
      if (activeIndicator !== "NONE" && indicatorChartContainerRef.current) {
        indicatorChart = createChart(indicatorChartContainerRef.current, {
          layout: {
            background: { type: ColorType.Solid, color: "transparent" },
            textColor: palette.subTextColor,
          },
          width: indicatorChartContainerRef.current.clientWidth,
          height: 100,
          grid: {
            vertLines: { color: palette.gridColor },
            horzLines: { color: palette.gridColor },
          },
          timeScale: {
            visible: false,
          },
          rightPriceScale: {
            borderColor: palette.borderColor,
          },
        } as any);

        indicatorChartRef.current = indicatorChart;

        if (activeIndicator === "RSI") {
          const rsiSeries = indicatorChart.addSeries(LineSeries, {
            color: palette.rsiColor,
            lineWidth: 2,
            autoscaleInfoProvider: () => ({
              priceRange: {
                minValue: 0,
                maxValue: 100,
              },
            }),
          });

          const rsiData = data
            .filter((d) => d.rsi !== null && d.rsi !== undefined)
            .map((d) => ({
              time: getLocalTime(d.timestamp),
              value: d.rsi,
            }));
          rsiSeries.setData(rsiData);
        }

        if (activeIndicator === "MACD") {
          const macdSeries = indicatorChart.addSeries(LineSeries, { color: palette.macdFast, lineWidth: 2 });
          const signalSeries = indicatorChart.addSeries(LineSeries, {
            color: palette.macdSignal,
            lineWidth: 2,
          });
          const histSeries = indicatorChart.addSeries(HistogramSeries, { color: palette.macdHist });

          // Add Zero Line
          macdSeries.createPriceLine({
            price: 0,
            color: palette.zeroLine,
            lineWidth: 1,
            lineStyle: 2, // Dashed
            axisLabelVisible: false,
            title: "",
          });

          macdSeries.setData(data.filter(d => d.macd != null).map(d => ({
            time: getLocalTime(d.timestamp),
            value: d.macd
          })));
          signalSeries.setData(data.filter(d => d.macd_signal != null).map(d => ({
            time: getLocalTime(d.timestamp),
            value: d.macd_signal
          })));
          histSeries.setData(data.filter(d => d.macd_hist != null).map(d => ({
            time: getLocalTime(d.timestamp),
            value: d.macd_hist,
            color: d.macd_hist >= 0 ? "rgba(38, 166, 154, 0.6)" : "rgba(255, 82, 82, 0.6)"
          })));
        }

        // Synchronization logic...
        mainChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
          if (indicatorChart && range) indicatorChart.timeScale().setVisibleLogicalRange(range);
        });
        indicatorChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
          if (mainChart && range) mainChart.timeScale().setVisibleLogicalRange(range);
        });
      }

      mainChart.timeScale().fitContent();
      setIsReady(true);

      // Resize Observer
      resizeObserver = new ResizeObserver(() => {
        if (mainChartContainerRef.current && mainChart) {
          mainChart.applyOptions({ width: mainChartContainerRef.current.clientWidth });
        }
      });
      resizeObserver.observe(mainChartContainerRef.current!);
    };

    initChart();

    return () => {
      isMounted = false;
      if (resizeObserver) resizeObserver.disconnect();
      if (mainChart) mainChart.remove();
      if (indicatorChart) indicatorChart.remove();
      mainChartRef.current = null;
      indicatorChartRef.current = null;
      candleSeriesRef.current = null; // Clear ref on cleanup
      setIsReady(false);
    };
  }, [symbol, interval, chartType, activeIndicator, activeOverlays, data, colors, isDrawing, drawings, palette]);

  // --- Trade Markers Effect ---
  useEffect(() => {
    // Only proceed if the series is ready AND we have a chart
    if (!isReady || !candleSeriesRef.current || !mainChartRef.current) {
      console.log("[TradingViewChart] Skipping markers: series or chart not ready", {
        isReady,
        hasSeries: !!candleSeriesRef.current,
        hasChart: !!mainChartRef.current
      });
      return;
    }

    const setMarkersFn = (window as any).LWC_createSeriesMarkers || (candleSeriesRef.current as any).setMarkers;

    // Cleanup function for markers
    const cleanupMarkers = () => {
      if (markersPrimitiveRef.current) {
        console.log("[TradingViewChart] Cleaning up marker primitive...", markersPrimitiveRef.current);
        // Try various removal methods
        try {
          if (typeof (candleSeriesRef.current as any).detachPrimitive === 'function') {
            (candleSeriesRef.current as any).detachPrimitive(markersPrimitiveRef.current);
          } else if (typeof markersPrimitiveRef.current.detach === 'function') {
            markersPrimitiveRef.current.detach();
          } else if (typeof markersPrimitiveRef.current.remove === 'function') {
            markersPrimitiveRef.current.remove();
          }
        } catch (e) {
          console.error("Failed to cleanup markers", e);
        }
        markersPrimitiveRef.current = null;
      }
    };

    cleanupMarkers(); // Always cleanup before updating

    if (!showMarkers || history.length === 0) {
      if (!(window as any).LWC_createSeriesMarkers && typeof setMarkersFn === 'function') {
        // Fallback for standard setMarkers (non-primitive)
        candleSeriesRef.current.setMarkers([]);
      }
      return;
    }

    const markers = history
      .map((h: any) => {
        const tradeTime = getLocalTime(h.timestamp) as number;

        // Find best matching bar
        let closestBarTime: number | null = null;
        for (let i = data.length - 1; i >= 0; i--) {
          const barTime = getLocalTime(data[i].timestamp) as number;
          if (barTime <= tradeTime) {
            closestBarTime = barTime;
            break;
          }
        }

        if (closestBarTime === null) return null;

        // Skip if bar is too far
        const dataStart = getLocalTime(data[0].timestamp) as number;
        const dataEnd = getLocalTime(data[data.length - 1].timestamp) as number;
        if (closestBarTime < dataStart || closestBarTime > dataEnd) return null;

        const tradeSide = h.side.toUpperCase();
        return {
          time: closestBarTime as Time,
          position: (tradeSide === "BUY" ? "belowBar" : "aboveBar") as any,
          color: tradeSide === "BUY" ? "#10b981" : "#ef4444",
          shape: (tradeSide === "BUY" ? "arrowUp" : "arrowDown") as any,
          text: `${tradeSide} @ ${h.price.toFixed(2)}`,
        };
      })
      .filter((m) => m !== null)
      .sort((a, b) => (a!.time as number) - (b!.time as number)) as any[];

    if (typeof setMarkersFn === 'function') {
      console.log("[TradingViewChart] Setting markers", markers.length);
      if ((window as any).LWC_createSeriesMarkers) {
        markersPrimitiveRef.current = setMarkersFn(candleSeriesRef.current, markers);
        console.log("[TradingViewChart] New marker primitive created", markersPrimitiveRef.current);
      } else {
        candleSeriesRef.current.setMarkers(markers);
      }
    }
  }, [isReady, showMarkers, history, data]);

  return (
    <div className="group relative flex w-full flex-col gap-1">
      <div
        ref={mainChartContainerRef}
        className="w-full"
        style={{ height: activeIndicator === "NONE" ? 400 : 300 }}
      />

      {/* Drawing Toolbar */}
      <div className="absolute left-4 top-4 z-20 flex gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <button
          onClick={() => setIsDrawing(!isDrawing)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-bold backdrop-blur-md transition-all ${isDrawing
            ? "border-blue-400 bg-blue-500 text-white shadow-lg shadow-blue-500/20"
            : "border-white/10 bg-black/40 text-gray-300 hover:bg-black/60"
            }`}
        >
          {isDrawing ? "Click on Chart" : "+ Support Line"}
        </button>
        {drawings.length > 0 && (
          <button
            onClick={() => setDrawings([])}
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-bold text-red-400 backdrop-blur-md hover:bg-red-500/10"
          >
            Clear
          </button>
        )}
      </div>

      {activeIndicator !== "NONE" && (
        <div className="relative w-full">
          {/* Indicator Chart Container */}
          <div ref={indicatorChartContainerRef} className="h-[120px] w-full" />

          {/* Legend & Info Overlay */}
          <div className="pointer-events-none absolute left-3 top-1 z-10 flex select-none items-center gap-4">
            {activeIndicator === "MACD" && (
              <>
                {/* Legend Items */}
                <div className="flex items-center gap-2 rounded-md border border-white/5 bg-black/20 px-2 py-1 font-mono text-[10px] backdrop-blur-sm">
                  <span className="flex items-center gap-1.5 text-[#00E5FF]">
                    <span className="h-0.5 w-2 bg-[#00E5FF]"></span> MACD (12,26)
                  </span>
                  <span className="flex items-center gap-1.5 text-[#FFEA00]">
                    <span className="h-0.5 w-2 bg-[#FFEA00]"></span> Signal (9)
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="h-2 w-2 rounded-sm bg-teal-500/60"></span> Hist
                  </span>
                </div>

                {/* Info Tooltip Trigger (Pointer events enabled for hover) */}
                <div className="group pointer-events-auto relative">
                  <div className="cursor-help rounded-full p-1 text-gray-400 transition-colors hover:bg-white/10">
                    <Info size={12} />
                  </div>

                  {/* Tooltip Content */}
                  <div className="absolute left-0 top-full z-50 mt-2 w-56 translate-y-2 rounded-lg border border-white/10 bg-gray-900/95 p-3 text-[10px] text-gray-300 opacity-0 shadow-xl backdrop-blur-xl transition-all group-hover:translate-y-0 group-hover:opacity-100">
                    <div className="mb-2 border-b border-white/10 pb-1 font-bold text-white">
                      MACD Cheat Sheet
                    </div>

                    <div className="space-y-3">
                      {/* Signals */}
                      <div>
                        <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                          Signals
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            <span>
                              <span className="text-[#00E5FF]">Cyan</span> line crosses UP ={" "}
                              <strong className="text-white">BUY</strong>
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                            <span>
                              <span className="text-[#00E5FF]">Cyan</span> line crosses DOWN ={" "}
                              <strong className="text-white">SELL</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Histogram */}
                      <div>
                        <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                          The Bars (Histogram)
                        </div>
                        <p className="leading-relaxed text-gray-400">
                          Shows the <strong className="text-gray-300">gap</strong> between the two
                          lines.
                          <br />
                          Big bars = Strong Momentum.
                          <br />
                          Shrinking bars = Trend is slowing down.
                        </p>
                      </div>

                      {/* Zero Line */}
                      <div>
                        <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                          The Zero Line (Dashed)
                        </div>
                        <p className="leading-relaxed text-gray-400">
                          The middle baseline.
                          <br />
                          Above 0 = <span className="text-emerald-400">Bullish Trend</span>
                          <br />
                          Below 0 = <span className="text-red-400">Bearish Trend</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeIndicator === "RSI" && (
              <div className="flex items-center gap-2 rounded-md border border-white/5 bg-black/20 px-2 py-1 font-mono text-[10px] backdrop-blur-sm">
                <span className="flex items-center gap-1.5 text-[#a855f7]">
                  <span className="h-0.5 w-2 bg-[#a855f7]"></span> RSI (14)
                </span>
                <span className="ml-1 text-[9px] text-gray-500">
                  Overbought &gt; 70 • Oversold &lt; 30
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

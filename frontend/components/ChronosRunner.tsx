"use client";

import { Play, RotateCcw, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { ChronosChart } from "./ChronosChart";

interface RunnerResult {
  ticker: string;
  horizon: string;
  lookback_days: number;
  forecast_steps: number;
  current_price: number;
  history: { date: string; close: number }[];
  forecast: {
    direction: string;
    probability: number;
    prob_up: number;
    confidence: string;
    current_price: number;
    median_forecast: number;
    range_q10_q90: [number, number];
    forecast_steps: number;
    forecast_steps_data: { step: number; median: number; q10: number; q90: number }[];
    skipped?: boolean;
    error?: string;
  };
}

// Presets: populate both sliders with sensible defaults per horizon
const HORIZON_PRESETS: Record<string, { lookback: number; steps: number }> = {
  Scalp:  { lookback: 10,  steps: 1  },
  Swing:  { lookback: 90,  steps: 5  },
  Invest: { lookback: 365, steps: 20 },
};

interface SliderInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  hint?: string;
  onChange: (v: number) => void;
}

function SliderInput({ label, value, min, max, step = 1, unit, hint, onChange }: SliderInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</span>
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-sm font-bold text-violet-300">{value}</span>
          <span className="text-[10px] text-gray-600">{unit}</span>
          {hint && <span className="text-[10px] text-gray-700">· {hint}</span>}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-violet-500"
      />
      <div className="flex justify-between text-[9px] text-gray-700">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

interface ChronosRunnerProps {
  defaultSymbol?: string;
}

export function ChronosRunner({ defaultSymbol = "" }: ChronosRunnerProps) {
  const [ticker, setTicker] = useState(defaultSymbol);
  const [activePreset, setActivePreset] = useState("Swing");
  const [lookback, setLookback] = useState(90);
  const [forecastSteps, setForecastSteps] = useState(5);
  const [numSamples, setNumSamples] = useState(150);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RunnerResult | null>(null);
  const [error, setError] = useState("");

  const applyPreset = (preset: string) => {
    setActivePreset(preset);
    setLookback(HORIZON_PRESETS[preset].lookback);
    setForecastSteps(HORIZON_PRESETS[preset].steps);
  };

  // Approximate trading days from calendar days (≈ 5/7 ratio)
  const tradingDaysHint = (cal: number) => `~${Math.round(cal * 5 / 7)} trading days`;

  const run = async () => {
    const sym = ticker.trim().toUpperCase();
    if (!sym) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const url = `/api/ml/predict/${sym}?horizon=${activePreset}&lookback_days=${lookback}&forecast_steps=${forecastSteps}&num_samples=${numSamples}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Prediction failed");
      }
      setResult(await res.json());
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const forecast = result?.forecast;
  const isUp = forecast?.direction === "UP";
  const dirColor = isUp ? "text-emerald-400" : "text-red-400";
  const dirBg   = isUp ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20";
  const confColor =
    forecast?.confidence === "HIGH"   ? "text-emerald-400" :
    forecast?.confidence === "MEDIUM" ? "text-yellow-400"  : "text-gray-400";
  const confBg =
    forecast?.confidence === "HIGH"   ? "bg-emerald-500/10 border-emerald-500/20" :
    forecast?.confidence === "MEDIUM" ? "bg-yellow-500/10 border-yellow-500/20"  :
    "bg-gray-500/10 border-gray-500/20";

  return (
    <div className="glass-panel overflow-hidden rounded-3xl border border-violet-500/15 p-6">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-xl bg-violet-500/15 p-2">
          <Sparkles size={20} className="text-violet-400" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white">Chronos ML Runner</h3>
          <p className="text-[10px] text-gray-500">
            Direct Chronos-T5-Small inference — configure context and forecast window freely
          </p>
        </div>
      </div>

      {/* Row 1: Ticker + Preset + Run */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="Ticker (e.g. AAPL)"
          className="w-36 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-mono font-bold text-white placeholder-gray-600 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
        />

        {/* Horizon preset buttons */}
        <div className="flex gap-1 rounded-lg bg-black/20 p-1">
          {Object.keys(HORIZON_PRESETS).map((h) => (
            <button
              key={h}
              onClick={() => applyPreset(h)}
              title={`Preset: ${HORIZON_PRESETS[h].lookback}d lookback, ${HORIZON_PRESETS[h].steps} step forecast`}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                activePreset === h
                  ? "bg-violet-500/20 text-violet-300"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {h}
            </button>
          ))}
        </div>

        <button
          onClick={run}
          disabled={loading || !ticker.trim()}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition-all hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? <RotateCcw size={14} className="animate-spin" />
            : <Play size={14} fill="currentColor" />
          }
          {loading ? "Running..." : "Run Chronos"}
        </button>
      </div>

      {/* Row 2: Sliders */}
      <div className="mt-5 grid grid-cols-3 gap-x-8 gap-y-1 rounded-2xl border border-white/5 bg-white/3 px-5 py-4">
        <SliderInput
          label="Context window"
          value={lookback}
          min={20}
          max={730}
          step={5}
          unit="d"
          hint={tradingDaysHint(lookback)}
          onChange={setLookback}
        />
        <SliderInput
          label="Forecast steps"
          value={forecastSteps}
          min={1}
          max={60}
          unit=" days"
          onChange={setForecastSteps}
        />
        <SliderInput
          label="Sample paths"
          value={numSamples}
          min={10}
          max={500}
          step={10}
          unit=""
          hint="↑ more stable, ↑ slower"
          onChange={setNumSamples}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Result */}
      {result && forecast && !forecast.skipped && (
        <div className="mt-5 space-y-4">
          {/* Ticker + config summary */}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono text-xl font-black text-white">{result.ticker}</span>
            <span className="font-mono text-sm text-gray-400">${result.current_price.toFixed(2)}</span>
            <span className="text-[10px] text-gray-700">·</span>
            <span className="text-[10px] text-gray-500">
              {result.lookback_days}d context ({tradingDaysHint(result.lookback_days)})
            </span>
            <span className="text-[10px] text-gray-700">·</span>
            <span className="text-[10px] text-gray-500">
              {result.forecast_steps}-step forecast
            </span>
          </div>

          {/* Stats pills */}
          <div className="flex flex-wrap gap-3">
            <div className={`flex items-center gap-2 rounded-xl border px-4 py-2 ${dirBg}`}>
              {isUp
                ? <TrendingUp size={15} className={dirColor} />
                : <TrendingDown size={15} className={dirColor} />
              }
              <span className={`text-sm font-bold ${dirColor}`}>{forecast.direction}</span>
            </div>
            <div className="flex flex-col rounded-xl border border-white/10 bg-white/5 px-4 py-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Probability</span>
              <span className="font-mono text-base font-bold text-white">
                {(forecast.probability * 100).toFixed(1)}%
              </span>
            </div>
            <div className={`flex flex-col rounded-xl border px-4 py-2 ${confBg}`}>
              <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Confidence</span>
              <span className={`text-sm font-bold ${confColor}`}>{forecast.confidence}</span>
            </div>
            <div className="flex flex-col rounded-xl border border-white/10 bg-white/5 px-4 py-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Median Target</span>
              <span className="font-mono text-sm font-bold text-white">
                ${forecast.median_forecast.toFixed(2)}
              </span>
            </div>
            <div className="flex flex-col rounded-xl border border-white/10 bg-white/5 px-4 py-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Q10–Q90 Range</span>
              <span className="font-mono text-sm font-bold text-white">
                ${forecast.range_q10_q90[0].toFixed(2)} – ${forecast.range_q10_q90[1].toFixed(2)}
              </span>
            </div>
          </div>

          {/* Chart */}
          <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-gray-600">
              {result.lookback_days}d history + {result.forecast_steps}-step forecast
            </p>
            <ChronosChart
              currentPrice={result.current_price}
              forecastStepsData={forecast.forecast_steps_data}
              horizon={activePreset}
              isUp={isUp}
              history={result.history}
              height={300}
              zoomable
            />
          </div>

          <p className="text-[10px] text-gray-600">
            General-purpose time series model · No news or macro awareness · Pattern/momentum signal only
          </p>
        </div>
      )}

      {result?.forecast?.skipped && (
        <div className="mt-4 rounded-xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-sm text-orange-400">
          {result.forecast.error || "Chronos skipped — insufficient data or model unavailable."}
        </div>
      )}
    </div>
  );
}

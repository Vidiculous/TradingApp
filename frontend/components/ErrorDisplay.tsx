import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorDisplayProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorDisplay = ({ message, onRetry }: ErrorDisplayProps) => {
  return (
    <div className="glass-panel animate-in fade-in zoom-in mx-auto max-w-md rounded-3xl border-red-500/30 bg-red-500/5 p-8 text-center text-red-200 shadow-[0_0_50px_-10px_rgba(239,68,68,0.15)] backdrop-blur-md duration-300">
      <div className="mb-6 flex justify-center">
        <div className="rounded-2xl bg-red-500/10 p-4 shadow-inner ring-1 ring-red-500/20">
          <AlertTriangle className="text-red-400" size={32} />
        </div>
      </div>

      <h3 className="mb-2 text-xl font-bold text-white">Unavailable</h3>
      <p className="mb-8 font-medium text-red-200/70">{message}</p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 py-3 font-semibold text-red-400 transition-all hover:scale-[1.02] hover:bg-red-500/20 active:scale-[0.98]"
        >
          <RefreshCw size={18} />
          Try Again
        </button>
      )}
    </div>
  );
};

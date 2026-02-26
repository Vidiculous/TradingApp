"use client";

import { Eye, EyeOff, Save, Settings, X, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface LLMSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const LLMSettingsModal = ({ isOpen, onClose }: LLMSettingsModalProps) => {
    const [provider, setProvider] = useState("gemini");
    const [model, setModel] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        try {
            const savedProvider = localStorage.getItem("trading_llm_provider");
            const savedModel = localStorage.getItem("trading_llm_model");
            const savedKey = localStorage.getItem("trading_llm_api_key");
            if (savedProvider) setProvider(savedProvider);
            if (savedModel) setModel(savedModel);
            if (savedKey) setApiKey(savedKey);
        } catch {
            // localStorage unavailable — use defaults
        }

        return () => setMounted(false);
    }, [isOpen]);

    const handleSave = () => {
        try {
            localStorage.setItem("trading_llm_provider", provider);
            localStorage.setItem("trading_llm_model", model);
            localStorage.setItem("trading_llm_api_key", apiKey);
        } catch {
            // localStorage unavailable (private browsing / quota exceeded) — settings not persisted
        }
        onClose();
    };

    if (!isOpen || !mounted) return null;

    const providers = [
        { id: "gemini", name: "Google Gemini", defaultModel: "gemini-3-flash-preview" },
        { id: "openai", name: "OpenAI GPT", defaultModel: "gpt-4o" },
        { id: "anthropic", name: "Anthropic Claude", defaultModel: "claude-3-5-sonnet-20240620" },
    ];

    return createPortal(
        <div
            className="animate-in fade-in fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 duration-200"
            onClick={onClose}
        >
            <div
                className="animate-in zoom-in-95 relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#09090b] shadow-2xl duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-white/5 bg-white/5 p-6">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-emerald-500/20 p-2 text-emerald-400">
                            <Settings size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">AI Engine Settings</h3>
                            <p className="text-xs text-gray-400">Configure your LLM provider & credentials</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-6 p-6">
                    {/* Provider Select */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                            Provider
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {providers.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => {
                                        setProvider(p.id);
                                        if (!model) setModel(p.defaultModel);
                                    }}
                                    className={`rounded-xl border p-3 text-center transition-all ${provider === p.id
                                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                                        : "border-white/5 bg-white/5 text-gray-400 hover:border-white/10 hover:text-gray-300"
                                        }`}
                                >
                                    <span className="text-xs font-bold">{p.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Model Input */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                Model ID (Optional)
                            </label>
                            <div className="group relative">
                                <Info size={12} className="text-gray-600 cursor-help" />
                                <div className="pointer-events-none absolute bottom-full right-0 mb-2 w-48 rounded-lg bg-gray-800 p-2 text-[10px] text-gray-300 opacity-0 shadow-xl transition-all group-hover:opacity-100">
                                    Leave empty to use the provider's default model (e.g. {providers.find(p => p.id === provider)?.defaultModel}).
                                </div>
                            </div>
                        </div>
                        <input
                            type="text"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            placeholder={providers.find(p => p.id === provider)?.defaultModel}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-emerald-500/50 focus:outline-none"
                        />
                    </div>

                    {/* API Key Input */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                            API Key
                        </label>
                        <div className="relative">
                            <input
                                type={showKey ? "text" : "password"}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Enter your API key..."
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-12 text-sm text-white placeholder:text-gray-600 focus:border-emerald-500/50 focus:outline-none"
                            />
                            <button
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-3 text-gray-500 hover:text-gray-300"
                            >
                                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-500">
                            Note: Keys are stored exclusively in your browser's local storage and sent only to the backend AI workers.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={onClose}
                            className="flex-1 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-bold text-gray-400 transition-all hover:bg-white/10 hover:text-gray-300"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
                        >
                            <Save size={18} />
                            Save Settings
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

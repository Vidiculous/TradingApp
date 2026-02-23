"use client";

import { FileText, Loader2, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Document {
    id: string;
    filename: string;
    original_name: string;
    type: string;
    upload_date: string;
    content_preview: string;
    content_length: number;
}

interface DocumentManagerProps {
    symbol: string;
}

export const DocumentManager = ({ symbol }: DocumentManagerProps) => {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchDocuments = async () => {
        if (!symbol) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/documents/${symbol}`);
            if (res.ok) {
                const data = await res.json();
                setDocuments(data.documents || []);
            }
        } catch (e) {
            console.error("Failed to fetch documents", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, [symbol]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !symbol) return;

        setUploading(true);
        setError("");

        const formData = new FormData();
        formData.append("file", file);
        formData.append("ticker", symbol);
        formData.append("doc_type", "report"); // Default type

        try {
            const res = await fetch("/api/documents/upload", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Upload failed");
            }

            await fetchDocuments();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleDelete = async (docId: string) => {
        try {
            await fetch(`/api/documents/${symbol}/${docId}`, {
                method: "DELETE",
            });
            setDocuments(documents.filter((d) => d.id !== docId));
        } catch (e) {
            console.error("Failed to delete document", e);
        }
    };

    return (
        <div className="flex h-full flex-col p-4">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-gray-200">Analyst Documents</h3>
                    <p className="text-[10px] text-gray-500">
                        Upload 10-K, 10-Q, or Transcripts for AI Analysis
                    </p>
                </div>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-400 transition-colors hover:bg-emerald-500/30"
                >
                    {uploading ? <Loader2 className="animate-spin" size={14} /> : <UploadCloud size={14} />}
                    Upload
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".pdf,.txt,.md"
                />
            </div>

            {error && (
                <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-xs text-red-400">{error}</div>
            )}

            {loading ? (
                <div className="flex flex-1 items-center justify-center">
                    <Loader2 className="animate-spin text-gray-500" size={24} />
                </div>
            ) : documents.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 bg-white/5 p-8 text-center">
                    <FileText className="text-gray-600" size={32} />
                    <p className="text-sm text-gray-500">No documents uploaded yet.</p>
                    <p className="text-xs text-gray-600">
                        Upload PDFs or text files to give the Analyst agent more context.
                    </p>
                </div>
            ) : (
                <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto">
                    {documents.map((doc) => (
                        <div
                            key={doc.id}
                            className="group flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3 transition-colors hover:border-white/10 hover:bg-white/10"
                        >
                            <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-blue-500/20 p-2 text-blue-400">
                                    <FileText size={18} />
                                </div>
                                <div>
                                    <h4 className="max-w-[180px] truncate text-xs font-bold text-gray-200" title={doc.original_name}>
                                        {doc.original_name}
                                    </h4>
                                    <p className="text-[10px] text-gray-500">
                                        {new Date(doc.upload_date).toLocaleDateString()} • {Math.round(doc.content_length / 1024)} KB
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(doc.id)}
                                className="opacity-0 transition-opacity group-hover:opacity-100 p-2 text-gray-500 hover:text-red-400"
                                title="Delete"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

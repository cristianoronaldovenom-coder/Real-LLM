import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Trash2, FileText, AlertCircle } from "lucide-react";
import { api } from "../lib/utils";

export default function KnowledgePage() {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"paste" | "file">("paste");
  const [fileContent, setFileContent] = useState<{ name: string; content: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: api.listDocuments,
  });

  const createMutation = useMutation({
    mutationFn: api.createDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setText("");
      setName("");
      setFileContent(null);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteDocument,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setFileContent({ name: file.name, content });
    if (!name) setName(file.name);
  };

  const handleSubmit = () => {
    const content = mode === "file" ? fileContent?.content : text;
    const docName = mode === "file" ? (name || fileContent?.name || "Document") : (name || "Pasted Text");
    if (!content?.trim()) { setError("Content cannot be empty"); return; }
    createMutation.mutate({ name: docName, content, type: "text" });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-[hsl(var(--border))]">
        <h1 className="text-xl font-semibold">Knowledge Base</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Upload documents that the AI can reference when answering questions (enable "Knowledge Base" on a conversation).
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Add document */}
        <div className="border border-[hsl(var(--border))] rounded-xl p-5 bg-[hsl(var(--card))]">
          <h2 className="font-medium mb-4">Add Document</h2>

          <div className="flex gap-2 mb-4">
            {(["paste", "file"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${
                  mode === m
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]"
                }`}
              >
                {m === "paste" ? "Paste Text" : "Upload File"}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Document name (optional)"
              className="w-full px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />

            {mode === "paste" ? (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your text here…"
                rows={8}
                className="w-full px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none font-mono"
              />
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[hsl(var(--border))] rounded-lg p-8 cursor-pointer hover:border-[hsl(var(--primary))] transition-colors">
                <Upload className="w-8 h-8 text-[hsl(var(--muted-foreground))]" />
                <span className="text-sm text-[hsl(var(--muted-foreground))]">
                  {fileContent ? fileContent.name : "Click to upload a .txt, .md, or other text file"}
                </span>
                <input type="file" accept=".txt,.md,.csv,.json,.ts,.js,.py,.html,.css,.xml" onChange={handleFileChange} className="hidden" />
              </label>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-[hsl(var(--destructive))]">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="px-5 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {createMutation.isPending ? "Adding…" : "Add Document"}
            </button>
          </div>
        </div>

        {/* Document list */}
        <div>
          <h2 className="font-medium mb-3">Documents ({documents?.length ?? 0})</h2>
          {isLoading ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
          ) : documents?.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No documents yet. Add one above.</p>
          ) : (
            <div className="space-y-2">
              {documents?.map((doc) => (
                <div key={doc.id} className="flex items-start gap-3 p-4 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))]">
                  <FileText className="w-5 h-5 text-[hsl(var(--primary))] shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{doc.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">{doc.preview}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                      {doc.charCount.toLocaleString()} chars · {doc.chunkCount} chunks
                    </p>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(doc.id)}
                    className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

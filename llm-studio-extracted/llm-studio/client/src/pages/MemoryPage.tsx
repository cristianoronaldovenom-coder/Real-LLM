import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Brain, Zap } from "lucide-react";
import { api } from "../lib/utils";

export default function MemoryPage() {
  const queryClient = useQueryClient();
  const [newMemory, setNewMemory] = useState("");

  const { data: memories, isLoading } = useQuery({
    queryKey: ["memories"],
    queryFn: api.listMemories,
  });

  const createMutation = useMutation({
    mutationFn: (content: string) => api.createMemory(content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memories"] });
      setNewMemory("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteMemory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["memories"] }),
  });

  const clearMutation = useMutation({
    mutationFn: api.clearMemories,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["memories"] }),
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-[hsl(var(--border))]">
        <h1 className="text-xl font-semibold">Memory</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Facts the AI remembers about you. Auto-learned from conversations, or added manually.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Add memory */}
        <div className="border border-[hsl(var(--border))] rounded-xl p-5 bg-[hsl(var(--card))]">
          <h2 className="font-medium mb-3">Add Memory</h2>
          <div className="flex gap-2">
            <input
              value={newMemory}
              onChange={(e) => setNewMemory(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newMemory.trim()) createMutation.mutate(newMemory.trim()); }}
              placeholder='e.g. "The user prefers Python over JavaScript"'
              maxLength={500}
              className="flex-1 px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
            <button
              onClick={() => { if (newMemory.trim()) createMutation.mutate(newMemory.trim()); }}
              disabled={createMutation.isPending || !newMemory.trim()}
              className="px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </div>

        {/* Memory list */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Memories ({memories?.length ?? 0})</h2>
            {(memories?.length ?? 0) > 0 && (
              <button
                onClick={() => { if (confirm("Clear all memories? This cannot be undone.")) clearMutation.mutate(); }}
                className="text-xs text-[hsl(var(--destructive))] hover:underline"
              >
                Clear all
              </button>
            )}
          </div>

          {isLoading ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
          ) : memories?.length === 0 ? (
            <div className="text-center py-12 text-[hsl(var(--muted-foreground))]">
              <Brain className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No memories yet. Chat a while and I'll start learning!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {memories?.map((mem) => (
                <div key={mem.id} className="flex items-start gap-3 p-3 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))]">
                  <div className="shrink-0 mt-0.5">
                    {mem.source === "auto" ? (
                      <Zap className="w-4 h-4 text-[hsl(var(--primary))]" title="Auto-learned" />
                    ) : (
                      <Brain className="w-4 h-4 text-[hsl(var(--muted-foreground))]" title="Manual" />
                    )}
                  </div>
                  <p className="flex-1 text-sm">{mem.content}</p>
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0 mt-0.5 uppercase tracking-wide">
                    {mem.source}
                  </span>
                  <button
                    onClick={() => deleteMutation.mutate(mem.id)}
                    className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] transition-colors shrink-0"
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

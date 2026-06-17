import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Key, CheckCircle, AlertCircle, Trash2, ExternalLink, Server, Monitor } from "lucide-react";
import { api } from "../lib/utils";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: api.getStats,
  });

  const updateMutation = useMutation({
    mutationFn: (key: string) => api.updateSettings(key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setApiKey("");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-[hsl(var(--border))]">
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-2xl">
        {/* API Key */}
        <div className="border border-[hsl(var(--border))] rounded-xl p-5 bg-[hsl(var(--card))]">
          <div className="flex items-center gap-2 mb-1">
            <Key className="w-4 h-4 text-[hsl(var(--primary))]" />
            <h2 className="font-medium">OpenRouter API Key</h2>
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
            Required to call AI models. Get a free key at{" "}
            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-[hsl(var(--primary))] hover:underline inline-flex items-center gap-0.5">
              openrouter.ai/keys <ExternalLink className="w-3 h-3" />
            </a>
          </p>

          {!isLoading && (
            <div className="mb-4">
              {settings?.hasKey ? (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>
                    Key active: <code className="font-mono bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded text-xs">{settings.keyPreview}</code>
                    {settings.source === "env" && (
                      <span className="ml-2 text-[hsl(var(--muted-foreground))] text-xs">(from environment)</span>
                    )}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                  <AlertCircle className="w-4 h-4" />
                  No API key configured.
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-or-v1-…"
              className="flex-1 px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] font-mono"
            />
            <button
              onClick={() => { if (apiKey.trim()) updateMutation.mutate(apiKey.trim()); }}
              disabled={updateMutation.isPending || !apiKey.trim()}
              className="px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saved ? "Saved ✓" : updateMutation.isPending ? "Saving…" : "Save"}
            </button>
            {settings?.hasKey && settings.source === "user" && (
              <button
                onClick={() => deleteMutation.mutate()}
                className="px-3 py-2 text-[hsl(var(--destructive))] border border-[hsl(var(--destructive))]/30 text-sm rounded-lg hover:bg-[hsl(var(--destructive))]/10 transition-colors"
                title="Remove key"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="border border-[hsl(var(--border))] rounded-xl p-5 bg-[hsl(var(--card))]">
            <h2 className="font-medium mb-4">Usage Stats</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Conversations", value: stats.conversations },
                { label: "Messages", value: stats.messages },
                { label: "Documents", value: stats.documents },
                { label: "Memories", value: stats.memories },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[hsl(var(--muted))]/50 rounded-lg p-3">
                  <p className="text-2xl font-bold">{value.toLocaleString()}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Deployment guide */}
        <div className="border border-[hsl(var(--border))] rounded-xl p-5 bg-[hsl(var(--card))]">
          <h2 className="font-medium mb-4">Deployment</h2>
          <div className="space-y-4">
            <div className="flex gap-3 p-3 rounded-lg bg-[hsl(var(--muted))]/30">
              <Monitor className="w-5 h-5 text-[hsl(var(--primary))] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Local</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                  Run with <code className="font-mono bg-[hsl(var(--muted))] px-1 rounded">npm run dev</code> from the project root. Requires PostgreSQL.
                </p>
              </div>
            </div>
            <div className="flex gap-3 p-3 rounded-lg bg-[hsl(var(--muted))]/30">
              <Server className="w-5 h-5 text-[hsl(var(--primary))] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Datacenter / VPS</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                  Run <code className="font-mono bg-[hsl(var(--muted))] px-1 rounded">npm run docker:up</code> to start the full stack with Docker Compose.
                  Set <code className="font-mono bg-[hsl(var(--muted))] px-1 rounded">OPENROUTER_API_KEY</code> in your <code className="font-mono bg-[hsl(var(--muted))] px-1 rounded">.env</code>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
